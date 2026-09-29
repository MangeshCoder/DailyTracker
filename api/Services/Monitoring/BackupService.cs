using System.Data;
using System.Data.Common;
using System.IO.Compression;
using System.Text.Json;
using DailyTrackerAPI.Data;
using DailyTrackerAPI.Helpers;
using DailyTrackerAPI.Models.Monitoring;
using DailyTrackerAPI.Services.Storage;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;

namespace DailyTrackerAPI.Services.Monitoring
{
    public interface IBackupService
    {
        /// <summary>Copies every table to one .json.gz file in file storage</summary>
        Task<DatabaseBackup> RunAsync(string trigger, int? requestedBy = null, CancellationToken ct = default);

        /// <summary>Runs the weekly backup if the last good one is 7+ days old</summary>
        Task<DatabaseBackup?> RunIfDueAsync(CancellationToken ct = default);

        /// <summary>Removes error log entries older than 30 days</summary>
        Task<int> CleanupErrorLogAsync(CancellationToken ct = default);
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  Database backup
    //
    //  File format (gzip-compressed JSON), one entry per table, every column:
    //    { "format": 1, "createdAtUtc": "…", "migration": "2026…_InitialPostgres",
    //      "tables": [ { "name": "Users", "columns": ["Id", …], "rows": [[1, …], …] }, … ] }
    //
    //  Read straight from the tables (not through the C# classes), so every
    //  column is included and new tables are picked up automatically.
    //  Saved under backups/ in file storage: App_Data/backups on your PC, the
    //  private Backblaze bucket when hosted. The newest 8 are kept.
    // ─────────────────────────────────────────────────────────────────────────
    public class BackupService : IBackupService
    {
        public static readonly TimeSpan Interval = TimeSpan.FromDays(7);
        public const int Keep = 8;
        public const int ErrorLogDays = 30;

        // the backup list itself and the error log aren't worth restoring
        private static readonly HashSet<string> SkipTables = new(StringComparer.OrdinalIgnoreCase)
            { "AppErrorLogs", "DatabaseBackups" };

        private readonly AppDbContext _db;
        private readonly IFileStorage _files;
        private readonly ILogger<BackupService> _logger;

        public BackupService(AppDbContext db, IFileStorage files, ILogger<BackupService> logger)
        {
            _db = db;
            _files = files;
            _logger = logger;
        }

        public async Task<DatabaseBackup?> RunIfDueAsync(CancellationToken ct = default)
        {
            var now = DateTime.UtcNow;
            var recent = await _db.DatabaseBackups
                .Where(b => b.StartedAt > now - Interval)
                .ToListAsync(ct);
            if (recent.Any(b => b.Status == "Succeeded")) return null;
            if (recent.Any(b => b.Status == "Running" && b.StartedAt > now.AddHours(-1))) return null;
            // after a failure, try again every 6 hours (not every hour)
            if (recent.Any(b => b.Status == "Failed" && b.StartedAt > now.AddHours(-6))) return null;
            return await RunAsync("Weekly", null, ct);
        }

        public async Task<DatabaseBackup> RunAsync(string trigger, int? requestedBy = null, CancellationToken ct = default)
        {
            if (await _db.DatabaseBackups.AnyAsync(b => b.Status == "Running" && b.StartedAt > DateTime.UtcNow.AddHours(-1), ct))
                throw new InvalidOperationException("A backup is already running — please wait a minute.");

            var backup = new DatabaseBackup { Trigger = trigger, RequestedByUserId = requestedBy };
            _db.DatabaseBackups.Add(backup);
            await _db.SaveChangesAsync(ct);

            var temp = Path.Combine(Path.GetTempPath(), $"dt-backup-{Guid.NewGuid():N}.json.gz");
            try
            {
                var (tables, rows) = await WriteFileAsync(temp, ct);
                var key = $"backups/db-{AppClock.NowIst:yyyy-MM-dd-HHmm}-{backup.Id}.json.gz";
                await using (var file = File.OpenRead(temp))
                    await _files.SaveAsync(key, file, "application/gzip", ct);

                backup.FileKey = key;
                backup.SizeBytes = new FileInfo(temp).Length;
                backup.TableCount = tables;
                backup.RowCount = rows;
                backup.Status = "Succeeded";
                _logger.LogInformation("Backup {Id}: {Tables} tables, {Rows} rows, {Bytes} bytes → {Key}",
                    backup.Id, tables, rows, backup.SizeBytes, key);
            }
            catch (Exception ex)
            {
                backup.Status = "Failed";
                backup.Error = ex.Message.Length > 2000 ? ex.Message[..2000] : ex.Message;
                _logger.LogError(ex, "Backup {Id} failed", backup.Id);
            }
            finally
            {
                try { File.Delete(temp); } catch { /* temp file */ }
            }

            backup.FinishedAt = DateTime.UtcNow;
            _db.ChangeTracker.Clear();
            _db.DatabaseBackups.Update(backup);
            await _db.SaveChangesAsync(CancellationToken.None);

            if (backup.Status == "Succeeded") await RemoveOldBackupsAsync();
            return backup;
        }

        public async Task<int> CleanupErrorLogAsync(CancellationToken ct = default)
        {
            var cutoff = DateTime.UtcNow.AddDays(-ErrorLogDays);
            return await _db.AppErrorLogs.Where(e => e.OccurredAt < cutoff).ExecuteDeleteAsync(ct);
        }

        // ── Writing the file ─────────────────────────────────────────────────
        private async Task<(int tables, long rows)> WriteFileAsync(string path, CancellationToken ct)
        {
            var tableNames = _db.Model.GetEntityTypes()
                .Where(t => t.GetTableName() != null && t.GetViewName() == null && t.FindOwnership() == null)
                .Select(t => (name: t.GetTableName()!, schema: t.GetSchema()))
                .Where(t => !SkipTables.Contains(t.name))
                .Distinct()
                .OrderBy(t => t.name, StringComparer.Ordinal)
                .ToList();

            string? migration = null;
            try { migration = (await _db.Database.GetAppliedMigrationsAsync(ct)).LastOrDefault(); }
            catch { /* test databases have no migration history */ }

            var strategy = _db.Database.CreateExecutionStrategy();
            return await strategy.ExecuteAsync(async () =>
            {
                long rows = 0;
                await using var fileStream = File.Create(path);
                await using var gzip = new GZipStream(fileStream, CompressionLevel.Optimal);
                await using var json = new Utf8JsonWriter(gzip);

                // one consistent snapshot of all tables
                await using var tx = await _db.Database.BeginTransactionAsync(
                    _db.Database.IsNpgsql() ? IsolationLevel.RepeatableRead : IsolationLevel.Serializable, ct);
                var conn = _db.Database.GetDbConnection();

                json.WriteStartObject();
                json.WriteNumber("format", 1);
                json.WriteString("createdAtUtc", DateTime.UtcNow);
                json.WriteString("migration", migration);
                json.WriteStartArray("tables");
                foreach (var (name, schema) in tableNames)
                {
                    await using var cmd = conn.CreateCommand();
                    cmd.Transaction = tx.GetDbTransaction();
                    cmd.CommandText = $"SELECT * FROM {Quote(schema, name)}";
                    await using var reader = await cmd.ExecuteReaderAsync(ct);

                    json.WriteStartObject();
                    json.WriteString("name", name);
                    json.WriteStartArray("columns");
                    for (int i = 0; i < reader.FieldCount; i++) json.WriteStringValue(reader.GetName(i));
                    json.WriteEndArray();
                    json.WriteStartArray("rows");
                    while (await reader.ReadAsync(ct))
                    {
                        json.WriteStartArray();
                        for (int i = 0; i < reader.FieldCount; i++) WriteValue(json, reader, i);
                        json.WriteEndArray();
                        rows++;
                        if (rows % 5000 == 0) await json.FlushAsync(ct);
                    }
                    json.WriteEndArray();
                    json.WriteEndObject();
                }
                json.WriteEndArray();
                json.WriteEndObject();
                await json.FlushAsync(ct);
                await tx.CommitAsync(ct);
                return (tableNames.Count, rows);
            });
        }

        private static string Quote(string? schema, string name) =>
            (schema == null ? "" : $"\"{schema.Replace("\"", "\"\"")}\".") + $"\"{name.Replace("\"", "\"\"")}\"";

        private static void WriteValue(Utf8JsonWriter json, DbDataReader reader, int i)
        {
            if (reader.IsDBNull(i)) { json.WriteNullValue(); return; }
            switch (reader.GetValue(i))
            {
                case string s: json.WriteStringValue(s); break;
                case bool b: json.WriteBooleanValue(b); break;
                case int n: json.WriteNumberValue(n); break;
                case long n: json.WriteNumberValue(n); break;
                case short n: json.WriteNumberValue(n); break;
                case decimal n: json.WriteNumberValue(n); break;
                case double n: json.WriteNumberValue(n); break;
                case float n: json.WriteNumberValue(n); break;
                case DateTime d: json.WriteStringValue(d.ToString("O")); break;
                case DateTimeOffset d: json.WriteStringValue(d.ToString("O")); break;
                case DateOnly d: json.WriteStringValue(d.ToString("yyyy-MM-dd")); break;
                case TimeSpan t: json.WriteStringValue(t.ToString("c")); break;
                case Guid g: json.WriteStringValue(g); break;
                case byte[] bytes: json.WriteBase64StringValue(bytes); break;
                case var other: JsonSerializer.Serialize(json, other, other.GetType()); break;
            }
        }

        // ── Keep the newest 8 good backups ──────────────────────────────────
        private async Task RemoveOldBackupsAsync()
        {
            try
            {
                var keepFrom = await _db.DatabaseBackups
                    .Where(b => b.Status == "Succeeded")
                    .OrderByDescending(b => b.StartedAt)
                    .Skip(Keep - 1)
                    .Select(b => (DateTime?)b.StartedAt)
                    .FirstOrDefaultAsync();
                if (keepFrom == null) return;

                var old = await _db.DatabaseBackups.Where(b => b.StartedAt < keepFrom).ToListAsync();
                foreach (var b in old.Where(b => b.FileKey != null))
                    await _files.DeleteAsync(b.FileKey!);
                _db.DatabaseBackups.RemoveRange(old);
                await _db.SaveChangesAsync();
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Could not remove old backups (the new backup is fine)");
            }
        }
    }

    /// <summary>Hourly: weekly backup when due, and error log clean-up</summary>
    public class MaintenanceService : BackgroundService
    {
        private readonly IServiceScopeFactory _scopes;
        private readonly ILogger<MaintenanceService> _logger;

        public MaintenanceService(IServiceScopeFactory scopes, ILogger<MaintenanceService> logger)
        {
            _scopes = scopes;
            _logger = logger;
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            // let the app finish starting (and the database wake up) first
            try { await Task.Delay(TimeSpan.FromMinutes(2), stoppingToken); } catch (OperationCanceledException) { return; }

            using var timer = new PeriodicTimer(TimeSpan.FromHours(1));
            do
            {
                try
                {
                    using var scope = _scopes.CreateScope();
                    var backups = scope.ServiceProvider.GetRequiredService<IBackupService>();
                    await backups.RunIfDueAsync(stoppingToken);
                    await backups.CleanupErrorLogAsync(stoppingToken);
                }
                catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { return; }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Maintenance run failed");
                }
            }
            while (await timer.WaitForNextTickAsync(stoppingToken));
        }
    }
}
