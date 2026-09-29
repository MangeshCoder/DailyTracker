using System.IO.Compression;
using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using DailyTrackerAPI.Data;
using DailyTrackerAPI.Helpers;
using DailyTrackerAPI.Models.Auth;
using DailyTrackerAPI.Models.Communication;
using DailyTrackerAPI.Models.HR;
using DailyTrackerAPI.Models.Monitoring;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace DailyTrackerAPI.Tests;

/// <summary>
/// Restore puts a backup back exactly, is all-or-nothing, and can be undone.
///   1 Mangesh (Manager) · 2 Priya (reports to 1) · 3 Ravi (reports to 2)
///   a leave, a chat with a reply (links within the same table)
/// </summary>
public class RestoreTests : IDisposable
{
    private readonly ApiFactory _factory = new();
    private readonly HttpClient _manager, _priya;

    public RestoreTests()
    {
        var users = new[]
        {
            new User { Id = 1, FullName = "Mangesh", Email = "m@test.dev", PasswordHash = "x", Role = "Manager", IsActive = true },
            new User { Id = 2, FullName = "Priya", Email = "p@test.dev", PasswordHash = "x", Role = "Developer", IsActive = true, ManagerId = 1 },
            new User { Id = 3, FullName = "Ravi", Email = "r@test.dev", PasswordHash = "x", Role = "Developer", IsActive = true, ManagerId = 2 },
        };
        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            TestDatabase.CreateSchema(db);
            db.Users.AddRange(users);
            db.LeaveRequests.Add(new LeaveRequest { Id = 1, UserId = 2, FromDate = new DateTime(2026, 10, 5), ToDate = new DateTime(2026, 10, 6), Reason = "wedding", Status = "Approved", ReviewedByUserId = 1 });
            db.SchedulerRuns.Add(new SchedulerRun { Id = 1, JobKey = "EOD_REMINDER", RunDate = new DateOnly(2026, 9, 29) });
            var conv = new Conversation { Id = 1, Type = "Group", GroupName = "Dev", CreatedByUserId = 1 };
            conv.Members.Add(new ConversationMember { UserId = 1, Role = "Admin" });
            conv.Members.Add(new ConversationMember { UserId = 2, Role = "Member" });
            db.Conversations.Add(conv);
            db.SaveChanges();
            db.ChatMessages.Add(new ChatMessage { Id = 1, ConversationId = 1, SenderId = 1, Content = "Release today?" });
            db.SaveChanges();
            db.ChatMessages.Add(new ChatMessage { Id = 2, ConversationId = 1, SenderId = 2, Content = "Yes, at 5", ReplyToMessageId = 1 });
            db.SaveChanges();
            TestDatabase.AfterSeed(db);
        }
        _manager = ClientFor(users[0]);
        _priya = ClientFor(users[1]);
    }

    public void Dispose() => _factory.Dispose();

    private HttpClient ClientFor(User u)
    {
        using var scope = _factory.Services.CreateScope();
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer",
            scope.ServiceProvider.GetRequiredService<JwtHelper>().GenerateAccessToken(u).Token);
        return client;
    }

    private T Db<T>(Func<AppDbContext, T> work)
    {
        using var scope = _factory.Services.CreateScope();
        return work(scope.ServiceProvider.GetRequiredService<AppDbContext>());
    }

    private static async Task<JsonElement> Json(HttpResponseMessage r) =>
        JsonDocument.Parse(await r.Content.ReadAsStringAsync()).RootElement;

    private static async Task<string> Message(HttpResponseMessage r) =>
        (await Json(r)).GetProperty("message").GetString()!;

    private async Task<int> BackUp()
    {
        var r = await _manager.PostAsync("/api/monitoring/backups", null);
        Assert.Equal(HttpStatusCode.OK, r.StatusCode);
        return (await Json(r)).GetProperty("id").GetInt32();
    }

    private Task<HttpResponseMessage> Restore(int id, string confirm = "RESTORE") =>
        _manager.PostAsJsonAsync($"/api/monitoring/backups/{id}/restore", new { confirm });

    /// <summary>Changes after the backup: a new user, an edit, a deletion, a new reply</summary>
    private void ChangeEverything()
    {
        Db(db =>
        {
            db.Users.Add(new User { FullName = "Intruder", Email = "x@test.dev", PasswordHash = "x", Role = "Developer", IsActive = true });
            db.Users.Find(2)!.FullName = "Priya (renamed)";
            db.LeaveRequests.Remove(db.LeaveRequests.Find(1)!);
            db.ChatMessages.Add(new ChatMessage { ConversationId = 1, SenderId = 1, Content = "added later", ReplyToMessageId = 2 });
            return db.SaveChanges();
        });
    }

    private record Snapshot(string Users, string Leaves, string Messages, string Runs);

    private Snapshot Take() => Db(db => new Snapshot(
        string.Join("|", db.Users.AsNoTracking().OrderBy(u => u.Id).Select(u => $"{u.Id}:{u.FullName}:{u.ManagerId}:{u.CreatedAt:O}")),
        string.Join("|", db.LeaveRequests.AsNoTracking().OrderBy(l => l.Id).Select(l => $"{l.Id}:{l.UserId}:{l.FromDate:O}:{l.Status}:{l.ReviewedByUserId}")),
        string.Join("|", db.ChatMessages.AsNoTracking().OrderBy(m => m.Id).Select(m => $"{m.Id}:{m.Content}:{m.ReplyToMessageId}:{m.SentAt:O}")),
        string.Join("|", db.SchedulerRuns.AsNoTracking().OrderBy(r => r.Id).Select(r => $"{r.Id}:{r.JobKey}:{r.RunDate}"))));

    [Fact]
    public async Task Restore_puts_every_row_back_exactly_and_removes_later_changes()
    {
        var before = Take();
        var backupId = await BackUp();
        ChangeEverything();
        Assert.NotEqual(before, Take());

        var r = await Restore(backupId);

        Assert.Equal(HttpStatusCode.OK, r.StatusCode);
        Assert.Equal(before, Take());                              // users (incl. manager chain), leave, chat replies, dates
        var body = await Json(r);
        Assert.True(body.GetProperty("rows").GetInt64() > 0);

        // new rows get fresh ids after the restored ones (no "duplicate key")
        var added = Db(db =>
        {
            var u = new User { FullName = "New joiner", Email = "n@test.dev", PasswordHash = "x", Role = "Developer", IsActive = true };
            db.Users.Add(u);
            db.SaveChanges();
            return u.Id;
        });
        Assert.True(added > 3);
    }

    [Fact]
    public async Task A_safety_backup_is_taken_first_so_a_restore_can_be_undone()
    {
        var backupId = await BackUp();
        ChangeEverything();
        var changed = Take();

        var r = await Restore(backupId);
        var safetyId = (await Json(r)).GetProperty("safetyBackupId").GetInt32();
        var safety = Db(db => db.DatabaseBackups.AsNoTracking().Single(b => b.Id == safetyId));
        Assert.Equal("PreRestore", safety.Trigger);
        Assert.Equal("Succeeded", safety.Status);

        Assert.Equal(HttpStatusCode.OK, (await Restore(safetyId)).StatusCode);   // undo
        Assert.Equal(changed, Take());
    }

    [Fact]
    public async Task Restore_from_an_uploaded_file_works()
    {
        var backupId = await BackUp();
        var file = await (await _manager.GetAsync($"/api/monitoring/backups/{backupId}/download")).Content.ReadAsByteArrayAsync();
        var before = Take();
        ChangeEverything();

        var r = await Upload(file);

        Assert.Equal(HttpStatusCode.OK, r.StatusCode);
        Assert.Equal(before, Take());
    }

    private Task<HttpResponseMessage> Upload(byte[] file, string confirm = "RESTORE")
    {
        var form = new MultipartFormDataContent
        {
            { new ByteArrayContent(file), "file", "backup.json.gz" },
            { new StringContent(confirm), "confirm" },
        };
        return _manager.PostAsync("/api/monitoring/restore", form);
    }

    [Fact]
    public async Task Nothing_changes_without_typing_RESTORE_or_with_a_bad_file()
    {
        var backupId = await BackUp();
        ChangeEverything();
        var changed = Take();

        var noConfirm = await Restore(backupId, "restore");
        Assert.Equal(HttpStatusCode.BadRequest, noConfirm.StatusCode);
        Assert.Contains("Type RESTORE", await Message(noConfirm));

        var notGzip = await Upload(Encoding.UTF8.GetBytes("hello"));
        Assert.Equal(HttpStatusCode.BadRequest, notGzip.StatusCode);
        Assert.Contains("isn't a DailyTracker backup", await Message(notGzip));

        var unknownTable = await Upload(Gzip("""{"format":1,"tables":[{"name":"Spaceships","columns":["Id"],"rows":[[1]]}]}"""));
        Assert.Equal(HttpStatusCode.BadRequest, unknownTable.StatusCode);
        Assert.Contains("Spaceships", await Message(unknownTable));

        var missingColumn = await Upload(Gzip("""{"format":1,"tables":[{"name":"Users","columns":["Id"],"rows":[[1]]}]}"""));
        Assert.Equal(HttpStatusCode.BadRequest, missingColumn.StatusCode);
        Assert.Contains("too old", await Message(missingColumn));

        Assert.Equal(changed, Take());
        Assert.Equal(1, Db(db => db.DatabaseBackups.Count()));      // no safety backup for requests that were refused
    }

    [Fact]
    public async Task A_restore_that_fails_halfway_is_rolled_back_completely()
    {
        var backupId = await BackUp();
        var file = await (await _manager.GetAsync($"/api/monitoring/backups/{backupId}/download")).Content.ReadAsByteArrayAsync();
        ChangeEverything();
        var changed = Take();

        // same file, but the second Users row copies the first one's id → the database refuses it midway
        var doc = JsonDocument.Parse(Gunzip(file)).RootElement;
        var tables = doc.GetProperty("tables").EnumerateArray().Select(t =>
        {
            if (t.GetProperty("name").GetString() != "Users") return (object)t;
            var rows = t.GetProperty("rows").EnumerateArray().Select(x => x.Clone()).ToList();
            var dup = JsonSerializer.Deserialize<List<JsonElement>>(rows[1].GetRawText())!;
            dup[t.GetProperty("columns").EnumerateArray().Select(c => c.GetString()).ToList().IndexOf("Id")] = JsonDocument.Parse("1").RootElement;
            rows[1] = JsonSerializer.SerializeToElement(dup);
            return new { name = "Users", columns = t.GetProperty("columns"), rows };
        }).ToList();
        var broken = Gzip(JsonSerializer.Serialize(new { format = 1, createdAtUtc = DateTime.UtcNow, tables }));

        var r = await Upload(broken);

        Assert.Equal(HttpStatusCode.BadRequest, r.StatusCode);
        Assert.Contains("nothing was changed", await Message(r));
        Assert.Equal(changed, Take());
    }

    [Fact]
    public async Task Only_managers_can_restore()
    {
        var backupId = await BackUp();
        Assert.Equal(HttpStatusCode.Forbidden, (await _priya.PostAsJsonAsync($"/api/monitoring/backups/{backupId}/restore", new { confirm = "RESTORE" })).StatusCode);
    }

    [Fact]
    public async Task The_error_log_and_backup_list_survive_a_restore()
    {
        var backupId = await BackUp();
        Db(db =>
        {
            db.AppErrorLogs.Add(new AppErrorLog { Method = "GET", Path = "/api/after-backup", StatusCode = 500 });
            return db.SaveChanges();
        });

        Assert.Equal(HttpStatusCode.OK, (await Restore(backupId)).StatusCode);

        Assert.Equal("/api/after-backup", Db(db => db.AppErrorLogs.Single().Path));
        Assert.Equal(2, Db(db => db.DatabaseBackups.Count()));     // the backup + the safety backup
    }

    private static byte[] Gzip(string json)
    {
        using var ms = new MemoryStream();
        using (var gz = new GZipStream(ms, CompressionLevel.Fastest)) gz.Write(Encoding.UTF8.GetBytes(json));
        return ms.ToArray();
    }

    private static string Gunzip(byte[] data)
    {
        using var gz = new GZipStream(new MemoryStream(data), CompressionMode.Decompress);
        using var reader = new StreamReader(gz);
        return reader.ReadToEnd();
    }
}
