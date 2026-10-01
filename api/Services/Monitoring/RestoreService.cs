using System.Data.Common;
using System.Globalization;
using System.IO.Compression;
using System.Text.Json;
using DailyTrackerAPI.Custom;
using DailyTrackerAPI.Data;
using DailyTrackerAPI.Services.Storage;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata;
using Microsoft.EntityFrameworkCore.Storage;

namespace DailyTrackerAPI.Services.Monitoring
{
    public record RestoreResult(int Tables, long Rows, int SafetyBackupId, DateTime BackupCreatedAtUtc);

    public interface IRestoreService
    {
        /// <summary>Puts a backup from the list back into the database</summary>
        Task<RestoreResult> RestoreStoredAsync(int backupId, int requestedBy, CancellationToken ct = default);

        /// <summary>Puts an uploaded backup file (.json.gz) back into the database</summary>
        Task<RestoreResult> RestoreFileAsync(Stream file, int requestedBy, CancellationToken ct = default);
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  Restore a backup (see BackupService for the file format)
    //
    //  1. Read and check the whole file first — a bad file changes nothing.
    //  2. Take a "PreRestore" backup of the current data (so a restore can
    //     itself be undone). If that fails, stop.
    //  3. In ONE transaction: empty every table, insert the backup's rows,
    //     move the id counters past the restored ids. Any error → rolled back,
    //     the database is exactly as before.
    //
    //  Tables are filled parents-first (Users before DailyLogs …). Links that
    //  go in a circle or point at the same table (a user's manager) are filled
    //  in afterwards. The error log and the backup list are never touched.
    //  A backup made before a later update still works: columns added since
    //  then get their default, columns removed since then are skipped.
    // ─────────────────────────────────────────────────────────────────────────
    public class RestoreService : IRestoreService
    {
        private static readonly HashSet<string> Untouched = new(StringComparer.OrdinalIgnoreCase)
            { "AppErrorLogs", "DatabaseBackups", "__EFMigrationsHistory" };

        private const int MaxParameters = 2000;

        private readonly AppDbContext _db;
        private readonly IBackupService _backups;
        private readonly IFileStorage _files;
        private readonly ILogger<RestoreService> _logger;

        public RestoreService(AppDbContext db, IBackupService backups, IFileStorage files, ILogger<RestoreService> logger)
        {
            _db = db;
            _backups = backups;
            _files = files;
            _logger = logger;
        }

        public async Task<RestoreResult> RestoreStoredAsync(int backupId, int requestedBy, CancellationToken ct = default)
        {
            var backup = await _db.DatabaseBackups.AsNoTracking()
                .FirstOrDefaultAsync(b => b.Id == backupId && b.Status == "Succeeded", ct);
            if (backup?.FileKey == null) throw new KeyNotFoundException("Backup not found.");

            await using var stream = await _files.OpenReadAsync(backup.FileKey, ct)
                ?? throw new ValidationException("The backup file is missing from storage.");
            return await RestoreFileAsync(stream, requestedBy, ct);
        }

        public async Task<RestoreResult> RestoreFileAsync(Stream file, int requestedBy, CancellationToken ct = default)
        {
            // ── 1. Read and check ────────────────────────────────────────────
            using var doc = await ReadAsync(file, ct);
            var plan = BuildPlan(doc.RootElement);

            // ── 2. Safety backup of what's there now ────────────────────────
            var safety = await _backups.RunAsync("PreRestore", requestedBy, ct);
            if (safety.Status != "Succeeded")
                throw new InvalidOperationException(
                    $"Could not make a safety backup of the current data first, so nothing was restored: {safety.Error}");

            // ── 3. Replace the data in one transaction ───────────────────────
            _db.ChangeTracker.Clear();
            var strategy = _db.Database.CreateExecutionStrategy();
            long rows;
            try
            {
                rows = await ReplaceAllAsync(strategy, plan, ct);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                _logger.LogError(ex, "Restore failed and was rolled back (safety backup {Safety})", safety.Id);
                throw new InvalidOperationException(
                    "The restore failed and nothing was changed — your data is exactly as before. " +
                    $"Reason: {ex.GetBaseException().Message}", ex);
            }

            _db.ChangeTracker.Clear();
            DailyTrackerAPI.Services.Communication.VapidKeys.ResetCache();   // push keys come from the restored data now
            _logger.LogWarning("Database restored by user {User}: {Tables} tables, {Rows} rows from a backup made {Created:u} (safety backup {Safety})",
                requestedBy, plan.Order.Count, rows, plan.CreatedAtUtc, safety.Id);
            return new RestoreResult(plan.Order.Count, rows, safety.Id, plan.CreatedAtUtc);
        }

        private Task<long> ReplaceAllAsync(IExecutionStrategy strategy, Plan plan, CancellationToken ct) =>
            strategy.ExecuteAsync(async () =>
            {
                await using var tx = await _db.Database.BeginTransactionAsync(ct);
                var conn = _db.Database.GetDbConnection();
                var dbTx = tx.GetDbTransaction();
                bool pg = _db.Database.IsNpgsql();

                if (!pg) await ExecAsync(conn, dbTx, "PRAGMA defer_foreign_keys = ON", ct);

                // empty (children first)
                if (pg)
                    await ExecAsync(conn, dbTx, "TRUNCATE " + string.Join(", ", plan.Order.Select(t => Quote(t.Table))), ct);
                else
                    foreach (var t in Enumerable.Reverse(plan.Order))
                        await ExecAsync(conn, dbTx, $"DELETE FROM {Quote(t.Table)}", ct);

                // fill (parents first)
                long inserted = 0;
                foreach (var t in plan.Order)
                    inserted += await InsertAsync(conn, dbTx, t, pg, ct);
                foreach (var t in plan.Order.Where(t => t.Deferred.Count > 0))
                    await FillDeferredAsync(conn, dbTx, t, pg, ct);

                if (pg) await ExecAsync(conn, dbTx, ResetIdCountersSql, ct);

                await tx.CommitAsync(ct);
                return inserted;
            });

        // ── Reading ─────────────────────────────────────────────────────────
        private static async Task<JsonDocument> ReadAsync(Stream file, CancellationToken ct)
        {
            try
            {
                await using var gzip = new GZipStream(file, CompressionMode.Decompress, leaveOpen: true);
                return await JsonDocument.ParseAsync(gzip, new JsonDocumentOptions { MaxDepth = 16 }, ct);
            }
            catch (Exception ex) when (ex is InvalidDataException or JsonException)
            {
                throw new ValidationException("This isn't a DailyTracker backup file (expected the .json.gz file from the Backups tab).");
            }
        }

        // ── Planning: which tables, in what order, which columns ────────────
        private sealed class TablePlan
        {
            public ITable Table = null!;
            public List<IColumn> Columns = new();              // columns to insert (in the backup and in the database)
            public List<int> SourceIndex = new();              // position of each column in the backup's rows
            public HashSet<IColumn> Deferred = new();          // filled in after every table is loaded
            public List<JsonElement> Rows = new();
        }

        private sealed record Plan(List<TablePlan> Order, DateTime CreatedAtUtc);

        private Plan BuildPlan(JsonElement root)
        {
            if (root.ValueKind != JsonValueKind.Object
                || !root.TryGetProperty("format", out var format) || format.ValueKind != JsonValueKind.Number || format.GetInt32() != 1
                || !root.TryGetProperty("tables", out var tables) || tables.ValueKind != JsonValueKind.Array)
                throw new ValidationException("This isn't a DailyTracker backup file (expected the .json.gz file from the Backups tab).");

            var created = root.TryGetProperty("createdAtUtc", out var c) && c.TryGetDateTime(out var d) ? d : DateTime.MinValue;

            var dbTables = _db.Model.GetRelationalModel().Tables
                .Where(t => !Untouched.Contains(t.Name))
                .ToDictionary(t => t.Name, StringComparer.OrdinalIgnoreCase);

            var plans = new Dictionary<ITable, TablePlan>();
            foreach (var table in tables.EnumerateArray())
            {
                var name = table.GetProperty("name").GetString() ?? "";
                if (Untouched.Contains(name)) continue;
                if (!dbTables.TryGetValue(name, out var dbTable))
                    throw new ValidationException($"The backup has a table \"{name}\" that this version of the app doesn't have — it may be from a newer version.");

                var backupColumns = table.GetProperty("columns").EnumerateArray().Select(x => x.GetString() ?? "").ToList();
                var plan = new TablePlan { Table = dbTable };
                foreach (var column in dbTable.Columns)
                {
                    int i = backupColumns.FindIndex(n => string.Equals(n, column.Name, StringComparison.OrdinalIgnoreCase));
                    if (i >= 0) { plan.Columns.Add(column); plan.SourceIndex.Add(i); }
                    else if (!column.IsNullable && column.DefaultValue == null && column.DefaultValueSql == null)
                        throw new ValidationException($"The backup is too old for this version of the app: \"{name}.{column.Name}\" is missing.");
                }
                plan.Rows = table.GetProperty("rows").EnumerateArray().ToList();
                if (plan.Rows.Any(r => r.ValueKind != JsonValueKind.Array || r.GetArrayLength() != backupColumns.Count))
                    throw new ValidationException($"The backup file is damaged (table \"{name}\").");
                plans[dbTable] = plan;
            }
            if (!plans.ContainsKey(dbTables["Users"]))
                throw new ValidationException("The backup has no Users table — it can't be a full DailyTracker backup.");

            // tables that exist now but not in the backup are emptied too
            foreach (var t in dbTables.Values.Where(t => !plans.ContainsKey(t)))
                plans[t] = new TablePlan { Table = t };

            return new Plan(Order(plans), created);
        }

        /// <summary>Parents before children; links in a circle are filled in afterwards</summary>
        private static List<TablePlan> Order(Dictionary<ITable, TablePlan> plans)
        {
            var edges = new List<(TablePlan child, TablePlan parent, IForeignKeyConstraint fk)>();
            foreach (var plan in plans.Values)
                foreach (var fk in plan.Table.ForeignKeyConstraints)
                {
                    if (!plans.TryGetValue(fk.PrincipalTable, out var parent)) continue;
                    if (parent == plan) { Defer(plan, fk); continue; }         // points at its own table
                    edges.Add((plan, parent, fk));
                }

            var order = new List<TablePlan>();
            var remaining = plans.Values.OrderBy(p => p.Table.Name, StringComparer.Ordinal).ToList();
            while (remaining.Count > 0)
            {
                var ready = remaining.Where(p => !edges.Any(e => e.child == p && remaining.Contains(e.parent))).ToList();
                if (ready.Count == 0)
                {
                    // a circle: fill one optional link later and carry on
                    var edge = edges.FirstOrDefault(e => remaining.Contains(e.child) && remaining.Contains(e.parent)
                                                         && e.fk.Columns.All(col => col.IsNullable));
                    if (edge.child == null)
                        throw new InvalidOperationException("Tables link to each other in a way that can't be restored.");
                    Defer(edge.child, edge.fk);
                    edges.Remove(edge);
                    continue;
                }
                order.AddRange(ready);
                remaining.RemoveAll(ready.Contains);
            }
            return order;
        }

        private static void Defer(TablePlan plan, IForeignKeyConstraint fk)
        {
            foreach (var col in fk.Columns)
            {
                if (!col.IsNullable)
                    throw new InvalidOperationException($"{plan.Table.Name}.{col.Name} links in a circle and can't be empty — it can't be restored.");
                plan.Deferred.Add(col);
            }
        }

        // ── Writing ─────────────────────────────────────────────────────────
        private static async Task<long> InsertAsync(DbConnection conn, DbTransaction tx, TablePlan t, bool pg, CancellationToken ct)
        {
            if (t.Rows.Count == 0 || t.Columns.Count == 0) return 0;
            var columnList = string.Join(", ", t.Columns.Select(c => Quote(c.Name)));
            int rowsPerCommand = Math.Max(1, MaxParameters / t.Columns.Count);

            foreach (var chunk in t.Rows.Chunk(rowsPerCommand))
            {
                await using var cmd = conn.CreateCommand();
                cmd.Transaction = tx;
                cmd.CommandTimeout = 300;
                var values = new List<string>();
                int p = 0;
                foreach (var row in chunk)
                {
                    var cells = new List<string>();
                    for (int i = 0; i < t.Columns.Count; i++)
                    {
                        var column = t.Columns[i];
                        var value = t.Deferred.Contains(column) ? null : ToValue(row[t.SourceIndex[i]], column);
                        cells.Add(Parameter(cmd, $"p{p++}", value, column, pg));
                    }
                    values.Add("(" + string.Join(", ", cells) + ")");
                }
                cmd.CommandText = $"INSERT INTO {Quote(t.Table)} ({columnList}) VALUES {string.Join(", ", values)}";
                await cmd.ExecuteNonQueryAsync(ct);
            }
            return t.Rows.Count;
        }

        private static async Task FillDeferredAsync(DbConnection conn, DbTransaction tx, TablePlan t, bool pg, CancellationToken ct)
        {
            var key = t.Table.PrimaryKey?.Columns
                ?? throw new InvalidOperationException($"{t.Table.Name} has no primary key.");
            var deferred = t.Columns.Where(t.Deferred.Contains).ToList();
            foreach (var row in t.Rows)
            {
                var sets = deferred.Where(c => row[t.SourceIndex[t.Columns.IndexOf(c)]].ValueKind != JsonValueKind.Null).ToList();
                if (sets.Count == 0) continue;

                await using var cmd = conn.CreateCommand();
                cmd.Transaction = tx;
                int p = 0;
                string Param(IColumn c) => Parameter(cmd, $"p{p++}", ToValue(row[t.SourceIndex[t.Columns.IndexOf(c)]], c), c, pg);
                var set = string.Join(", ", sets.Select(c => $"{Quote(c.Name)} = {Param(c)}"));
                var where = string.Join(" AND ", key.Select(c => $"{Quote(c.Name)} = {Param(c)}"));
                cmd.CommandText = $"UPDATE {Quote(t.Table)} SET {set} WHERE {where}";
                await cmd.ExecuteNonQueryAsync(ct);
            }
        }

        private static string Parameter(DbCommand cmd, string name, object? value, IColumn column, bool pg)
        {
            var parameter = cmd.CreateParameter();
            parameter.ParameterName = name;
            parameter.Value = value ?? DBNull.Value;
            cmd.Parameters.Add(parameter);
            // PostgreSQL: say the column's exact type (citext, date …)
            return pg ? $"@{name}::{column.StoreType}" : $"@{name}";
        }

        /// <summary>A JSON value from the file → the C# type the database column expects</summary>
        private static object? ToValue(JsonElement v, IColumn column)
        {
            if (v.ValueKind == JsonValueKind.Null) return null;
            var type = Nullable.GetUnderlyingType(column.ProviderClrType) ?? column.ProviderClrType;
            var inv = CultureInfo.InvariantCulture;
            string Text() => v.ValueKind == JsonValueKind.String ? v.GetString()! : v.GetRawText();

            try
            {
                if (type == typeof(string)) return Text();
                if (type == typeof(bool))
                    return v.ValueKind switch
                    {
                        JsonValueKind.True => true,
                        JsonValueKind.False => false,
                        JsonValueKind.Number => v.GetInt64() != 0,
                        _ => bool.Parse(Text()),
                    };
                if (type == typeof(int)) return v.ValueKind == JsonValueKind.Number ? v.GetInt32() : int.Parse(Text(), inv);
                if (type == typeof(long)) return v.ValueKind == JsonValueKind.Number ? v.GetInt64() : long.Parse(Text(), inv);
                if (type == typeof(short)) return v.ValueKind == JsonValueKind.Number ? v.GetInt16() : short.Parse(Text(), inv);
                if (type == typeof(byte)) return v.ValueKind == JsonValueKind.Number ? v.GetByte() : byte.Parse(Text(), inv);
                if (type == typeof(decimal)) return v.ValueKind == JsonValueKind.Number ? v.GetDecimal() : decimal.Parse(Text(), inv);
                if (type == typeof(double)) return v.ValueKind == JsonValueKind.Number ? v.GetDouble() : double.Parse(Text(), inv);
                if (type == typeof(float)) return v.ValueKind == JsonValueKind.Number ? v.GetSingle() : float.Parse(Text(), inv);
                if (type == typeof(DateTime)) return DateTime.Parse(Text(), inv, DateTimeStyles.RoundtripKind);
                if (type == typeof(DateTimeOffset)) return DateTimeOffset.Parse(Text(), inv, DateTimeStyles.RoundtripKind);
                if (type == typeof(DateOnly))
                {
                    var s = Text();
                    return s.Length == 10 ? DateOnly.ParseExact(s, "yyyy-MM-dd", inv) : DateOnly.FromDateTime(DateTime.Parse(s, inv));
                }
                if (type == typeof(TimeSpan)) return TimeSpan.Parse(Text(), inv);
                if (type == typeof(TimeOnly)) return TimeOnly.Parse(Text(), inv);
                if (type == typeof(Guid)) return Guid.Parse(Text());
                if (type == typeof(byte[])) return v.GetBytesFromBase64();
                return JsonSerializer.Deserialize(v.GetRawText(), type);
            }
            catch (Exception ex) when (ex is FormatException or InvalidOperationException or OverflowException or JsonException)
            {
                throw new ValidationException($"The backup file is damaged: \"{column.Table.Name}.{column.Name}\" has an unexpected value.");
            }
        }

        private static async Task ExecAsync(DbConnection conn, DbTransaction tx, string sql, CancellationToken ct)
        {
            await using var cmd = conn.CreateCommand();
            cmd.Transaction = tx;
            cmd.CommandTimeout = 300;
            cmd.CommandText = sql;
            await cmd.ExecuteNonQueryAsync(ct);
        }

        private static string Quote(ITable t) =>
            (t.Schema == null ? "" : Quote(t.Schema) + ".") + Quote(t.Name);

        private static string Quote(string name) => $"\"{name.Replace("\"", "\"\"")}\"";

        /// <summary>PostgreSQL: new rows continue after the highest restored id</summary>
        private const string ResetIdCountersSql = """
            DO $$ DECLARE r record; BEGIN
              FOR r IN SELECT table_name, column_name FROM information_schema.columns
                       WHERE table_schema = current_schema() AND is_identity = 'YES' LOOP
                EXECUTE format('SELECT setval(pg_get_serial_sequence(%L, %L), COALESCE((SELECT MAX(%I) FROM %I), 0) + 1, false)',
                               quote_ident(r.table_name), r.column_name, r.column_name, r.table_name);
              END LOOP;
            END $$;
            """;
    }
}
