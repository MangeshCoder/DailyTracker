using System.IO.Compression;
using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using DailyTrackerAPI.Data;
using DailyTrackerAPI.DTOs;
using DailyTrackerAPI.Helpers;
using DailyTrackerAPI.Models.Auth;
using DailyTrackerAPI.Models.Monitoring;
using DailyTrackerAPI.Models.Tasks;
using DailyTrackerAPI.Services.HR;
using DailyTrackerAPI.Services.Monitoring;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace DailyTrackerAPI.Tests;

/// <summary>
/// The managers' System page: error log, weekly backups — and the India date
/// for shifts that run past midnight.
///   1 Mangesh (Manager) · 2 Priya (Developer)
/// </summary>
public class MonitoringTests : IDisposable
{
    private readonly ApiFactory _factory;
    private readonly HttpClient _manager, _priya;

    public MonitoringTests()
    {
        // the leave service is swapped for one that crashes, to produce real 500s
        _factory = new ApiFactory(configureServices: s => s.AddScoped<ILeaveService, BrokenLeaveService>());
        var users = new[]
        {
            new User { Id = 1, FullName = "Mangesh", Email = "m@test.dev", PasswordHash = "x", Role = "Manager", IsActive = true },
            new User { Id = 2, FullName = "Priya", Email = "p@test.dev", PasswordHash = "x", Role = "Developer", IsActive = true, ManagerId = 1 },
        };
        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            TestDatabase.CreateSchema(db);
            db.Users.AddRange(users);
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

    private T InScope<T>(Func<IServiceProvider, T> work)
    {
        using var scope = _factory.Services.CreateScope();
        return work(scope.ServiceProvider);
    }

    private async Task<T> InScopeAsync<T>(Func<IServiceProvider, Task<T>> work)
    {
        using var scope = _factory.Services.CreateScope();
        return await work(scope.ServiceProvider);
    }

    private static async Task<JsonElement> Json(HttpResponseMessage r) =>
        JsonDocument.Parse(await r.Content.ReadAsStringAsync()).RootElement;

    // ── Error log ───────────────────────────────────────────────────────────

    [Fact]
    public async Task A_server_error_is_saved_with_who_and_where_but_the_user_sees_the_generic_message()
    {
        var r = await _priya.GetAsync("/api/leave/my?access_token=secret123&page=2");

        Assert.Equal(HttpStatusCode.InternalServerError, r.StatusCode);
        Assert.Equal("An unexpected error occurred.", (await Json(r)).GetProperty("message").GetString());

        var log = await Json(await _manager.GetAsync("/api/monitoring/errors"));
        var e = log.GetProperty("items").EnumerateArray().Single();
        Assert.Equal("Error", e.GetProperty("kind").GetString());
        Assert.Equal(500, e.GetProperty("statusCode").GetInt32());
        Assert.Equal("GET", e.GetProperty("method").GetString());
        Assert.Equal("/api/leave/my?access_token=***&page=2", e.GetProperty("path").GetString());   // no secrets saved
        Assert.Equal("Priya", e.GetProperty("userName").GetString());
        Assert.Equal("The leave table is on fire", e.GetProperty("message").GetString());
        Assert.Contains("BrokenLeaveService", e.GetProperty("details").GetString());

        var summary = await Json(await _manager.GetAsync("/api/monitoring/summary"));
        Assert.Equal(1, summary.GetProperty("errors24h").GetInt32());
    }

    [Fact]
    public async Task Business_errors_are_not_logged_only_real_failures()
    {
        var r = await _priya.PostAsJsonAsync("/api/wfh-requests", new { requestType = "WFH", requestDate = "2020-01-01", reason = "x" });
        Assert.Equal(HttpStatusCode.BadRequest, r.StatusCode);
        Assert.Empty((await Json(await _manager.GetAsync("/api/monitoring/errors"))).GetProperty("items").EnumerateArray());
    }

    [Fact]
    public async Task Slow_API_calls_are_logged_but_chat_hubs_and_fast_calls_are_not()
    {
        var writer = _factory.Services.GetRequiredService<ErrorLogWriter>();
        HttpContext Request(string path) { var c = new DefaultHttpContext(); c.Request.Method = "GET"; c.Request.Path = path; c.Response.StatusCode = 200; return c; }

        await writer.RecordAsync(Request("/api/manager/team"), 3400, null);
        await writer.RecordAsync(Request("/api/manager/team"), 300, null);         // fast
        await writer.RecordAsync(Request("/hubs/chat"), 60_000, null);            // long-lived connection
        await writer.RecordAsync(Request("/api/chat/upload"), 9_000, null);        // big file

        var items = (await Json(await _manager.GetAsync("/api/monitoring/errors?kind=Slow"))).GetProperty("items").EnumerateArray().ToList();
        var slow = Assert.Single(items);
        Assert.Equal("/api/manager/team", slow.GetProperty("path").GetString());
        Assert.Equal(3400, slow.GetProperty("durationMs").GetInt32());
        Assert.Equal("Took 3.4 s", slow.GetProperty("message").GetString());
    }

    [Fact]
    public async Task Only_managers_can_see_the_System_page()
    {
        Assert.Equal(HttpStatusCode.Forbidden, (await _priya.GetAsync("/api/monitoring/errors")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await _priya.PostAsync("/api/monitoring/backups", null)).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await _priya.GetAsync("/api/monitoring/backups/1/download")).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await _factory.CreateClient().GetAsync("/api/monitoring/summary")).StatusCode);
    }

    [Fact]
    public async Task Old_error_log_entries_are_cleaned_up_and_the_log_can_be_cleared()
    {
        InScope(sp =>
        {
            var db = sp.GetRequiredService<AppDbContext>();
            db.AppErrorLogs.AddRange(
                new AppErrorLog { OccurredAt = DateTime.UtcNow.AddDays(-31), Method = "GET", Path = "/old", StatusCode = 500 },
                new AppErrorLog { OccurredAt = DateTime.UtcNow.AddDays(-2), Method = "GET", Path = "/new", StatusCode = 500 });
            return db.SaveChanges();
        });

        var removed = await InScopeAsync(sp => sp.GetRequiredService<IBackupService>().CleanupErrorLogAsync());
        Assert.Equal(1, removed);
        var left = (await Json(await _manager.GetAsync("/api/monitoring/errors"))).GetProperty("items").EnumerateArray().Single();
        Assert.Equal("/new", left.GetProperty("path").GetString());

        Assert.Equal(HttpStatusCode.OK, (await _manager.DeleteAsync("/api/monitoring/errors")).StatusCode);
        Assert.Empty((await Json(await _manager.GetAsync("/api/monitoring/errors"))).GetProperty("items").EnumerateArray());
    }

    // ── Backups ─────────────────────────────────────────────────────────────

    [Fact]
    public async Task Back_up_now_saves_every_table_and_the_file_can_be_downloaded()
    {
        var r = await _manager.PostAsync("/api/monitoring/backups", null);
        Assert.Equal(HttpStatusCode.OK, r.StatusCode);

        var list = (await Json(await _manager.GetAsync("/api/monitoring/backups"))).EnumerateArray().ToList();
        var b = Assert.Single(list);
        Assert.Equal("Succeeded", b.GetProperty("status").GetString());
        Assert.Equal("Manual", b.GetProperty("trigger").GetString());
        Assert.Equal("Mangesh", b.GetProperty("requestedBy").GetString());

        var file = await _manager.GetAsync($"/api/monitoring/backups/{b.GetProperty("id").GetInt32()}/download");
        Assert.Equal(HttpStatusCode.OK, file.StatusCode);
        Assert.Equal("application/gzip", file.Content.Headers.ContentType?.MediaType);

        await using var gz = new GZipStream(await file.Content.ReadAsStreamAsync(), CompressionMode.Decompress);
        var doc = await JsonDocument.ParseAsync(gz);
        var tables = doc.RootElement.GetProperty("tables").EnumerateArray().ToList();
        var names = tables.Select(t => t.GetProperty("name").GetString()).ToList();

        // every table of the app (except the log/backup lists themselves)
        var expected = InScope(sp => sp.GetRequiredService<AppDbContext>().Model.GetEntityTypes()
            .Select(t => t.GetTableName()).Where(n => n != null).Distinct().Count());
        Assert.Equal(expected - 2, tables.Count);
        Assert.DoesNotContain("AppErrorLogs", names);
        Assert.DoesNotContain("DatabaseBackups", names);

        var users = tables.Single(t => t.GetProperty("name").GetString() == "Users");
        var cols = users.GetProperty("columns").EnumerateArray().Select(c => c.GetString()).ToList();
        var rows = users.GetProperty("rows").EnumerateArray().ToList();
        Assert.Equal(2, rows.Count);
        Assert.Contains(rows, row => row[cols.IndexOf("FullName")].GetString() == "Priya");
        Assert.Equal(tables.Sum(t => t.GetProperty("rows").GetArrayLength()), b.GetProperty("rowCount").GetInt64());
    }

    [Fact]
    public async Task The_weekly_backup_runs_once_a_week_and_only_the_newest_8_are_kept()
    {
        var first = await InScopeAsync(sp => sp.GetRequiredService<IBackupService>().RunIfDueAsync());
        Assert.NotNull(first);
        Assert.Equal("Weekly", first!.Trigger);
        Assert.Null(await InScopeAsync(sp => sp.GetRequiredService<IBackupService>().RunIfDueAsync()));   // not due yet

        for (int i = 0; i < 9; i++)
            await InScopeAsync(sp => sp.GetRequiredService<IBackupService>().RunAsync("Manual"));

        var kept = InScope(sp => sp.GetRequiredService<AppDbContext>().DatabaseBackups.AsNoTracking().ToList());
        Assert.Equal(BackupService.Keep, kept.Count);
        Assert.DoesNotContain(kept, k => k.Id == first.Id);                        // oldest removed …
        var backupDir = Path.Combine(_factory.ContentRoot, "App_Data", "backups");
        Assert.Equal(BackupService.Keep, Directory.GetFiles(backupDir).Length);    // … file included
    }

    [Fact]
    public async Task A_failed_backup_is_recorded_and_retried_later_not_every_hour()
    {
        InScope(sp =>
        {
            var db = sp.GetRequiredService<AppDbContext>();
            db.DatabaseBackups.Add(new DatabaseBackup { StartedAt = DateTime.UtcNow.AddHours(-1), Status = "Failed", Error = "bucket unreachable" });
            return db.SaveChanges();
        });
        Assert.Null(await InScopeAsync(sp => sp.GetRequiredService<IBackupService>().RunIfDueAsync()));

        var list = (await Json(await _manager.GetAsync("/api/monitoring/backups"))).EnumerateArray().Single();
        Assert.Equal("bucket unreachable", list.GetProperty("error").GetString());
        Assert.False(list.GetProperty("canDownload").GetBoolean());
    }

    // ── India date ──────────────────────────────────────────────────────────

    [Fact]
    public async Task A_shift_that_runs_past_midnight_can_still_check_out()
    {
        var yesterday = AppClock.TodayIst.AddDays(-1);
        InScope(sp =>
        {
            var db = sp.GetRequiredService<AppDbContext>();
            db.DailyLogs.Add(new DailyLog { UserId = 2, LogDate = yesterday, DayStatus = "WFH", CheckInTime = DateTime.UtcNow.AddHours(-5) });
            return db.SaveChanges();
        });

        var today = await Json(await _priya.GetAsync("/api/DailyLog/today"));
        Assert.StartsWith(yesterday.ToString("yyyy-MM-dd"), today.GetProperty("logDate").GetString());

        var r = await _priya.PutAsJsonAsync("/api/DailyLog/checkout", new CheckOutDto { Latitude = 0, Longitude = 0 });
        Assert.Equal(HttpStatusCode.OK, r.StatusCode);

        var log = InScope(sp => sp.GetRequiredService<AppDbContext>().DailyLogs.AsNoTracking().Single());
        Assert.NotNull(log.CheckOutTime);
        Assert.InRange(log.TotalWorkMinutes, 299, 301);
    }

    [Fact]
    public void The_India_day_starts_at_18_30_UTC_the_evening_before()
    {
        var start = AppClock.TodayStartUtc;
        Assert.Equal(new TimeSpan(18, 30, 0), start.TimeOfDay);
        Assert.Equal(AppClock.TodayIst.AddDays(-1), start.Date);
    }

    /// <summary>Every call crashes like a real bug would</summary>
    private sealed class BrokenLeaveService : ILeaveService
    {
        private static Exception Boom() => new Exception("The leave table is on fire");
        public Task<LeaveResponseDto> ApplyAsync(int userId, ApplyLeaveDto dto) => throw Boom();
        public Task<List<LeaveResponseDto>> GetMyLeavesAsync(int userId) => throw Boom();
        public Task<List<LeaveResponseDto>> GetAllLeavesAsync(string? status = null, int? viewerId = null) => throw Boom();
        public Task ReviewAsync(int leaveId, int managerId, ReviewLeaveDto dto) => throw Boom();
        public Task CancelAsync(int leaveId, int userId) => throw Boom();
        public Task<List<LeaveBalanceDto>> GetAnnualBalanceAsync(int? userId = null) => throw Boom();
    }
}
