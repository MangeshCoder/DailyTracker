using System.Collections.Concurrent;
using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using DailyTrackerAPI.Data;
using DailyTrackerAPI.Helpers;
using DailyTrackerAPI.Models.Attendance;
using DailyTrackerAPI.Models.Auth;
using DailyTrackerAPI.Models.HR;
using DailyTrackerAPI.Services.Auth;
using Microsoft.Extensions.DependencyInjection;

namespace DailyTrackerAPI.Tests;

/// <summary>
/// Leave and WFH / half-day requests end to end (real API):
///   1 Mangesh (Manager) · 2 Priya (Developer, reports to 1)
///   3 Ravi (Developer, no manager assigned) · 4 Asha (second Manager)
/// Email is NOT configured in tests, so every email fails — requests must still succeed.
/// </summary>
public class LeaveWfhTests : IDisposable
{
    private readonly ApiFactory _factory;
    private readonly RecordingEmailService? _emails;
    private readonly HttpClient _manager, _priya, _ravi, _manager2;

    // a week ahead, Monday → Friday (never "the past", never a weekend)
    private static readonly DateTime Monday = NextMonday(AppClock.TodayIst.AddDays(7));
    private static DateTime NextMonday(DateTime d) { while (d.DayOfWeek != DayOfWeek.Monday) d = d.AddDays(1); return d; }
    private static string D(DateTime d) => d.ToString("yyyy-MM-dd");

    public LeaveWfhTests() : this(recordEmails: false) { }

    private LeaveWfhTests(bool recordEmails)
    {
        if (recordEmails) _emails = new RecordingEmailService();
        _factory = new ApiFactory(configureServices: recordEmails
            ? s => s.AddSingleton<IEmailService>(_emails!)
            : null);

        var users = new Dictionary<int, User>();
        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            TestDatabase.CreateSchema(db);
            users[1] = new User { Id = 1, FullName = "Mangesh", Email = "m@test.dev", PasswordHash = "x", Role = "Manager", IsActive = true };
            users[2] = new User { Id = 2, FullName = "Priya", Email = "p@test.dev", PasswordHash = "x", Role = "Developer", IsActive = true, ManagerId = 1 };
            users[3] = new User { Id = 3, FullName = "Ravi", Email = "r@test.dev", PasswordHash = "x", Role = "Developer", IsActive = true };
            users[4] = new User { Id = 4, FullName = "Asha", Email = "a@test.dev", PasswordHash = "x", Role = "Manager", IsActive = true };
            db.Users.AddRange(users.Values);
            db.SaveChanges();
            TestDatabase.AfterSeed(db);
        }
        _manager = ClientFor(users[1]); _priya = ClientFor(users[2]); _ravi = ClientFor(users[3]); _manager2 = ClientFor(users[4]);
    }

    public static LeaveWfhTests WithRecordedEmails() => new(recordEmails: true);
    public void Dispose() => _factory.Dispose();

    private HttpClient ClientFor(User u)
    {
        using var scope = _factory.Services.CreateScope();
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer",
            scope.ServiceProvider.GetRequiredService<JwtHelper>().GenerateAccessToken(u).Token);
        return client;
    }

    private static async Task<JsonElement> Json(HttpResponseMessage r) =>
        JsonDocument.Parse(await r.Content.ReadAsStringAsync()).RootElement;

    private static async Task<string> Message(HttpResponseMessage r) =>
        (await Json(r)).GetProperty("message").GetString()!;

    private static Task<HttpResponseMessage> ApplyLeave(HttpClient c, DateTime from, DateTime to, string type = "Casual") =>
        c.PostAsJsonAsync("/api/leave", new { fromDate = D(from), toDate = D(to), leaveType = type, reason = "family" });

    private static Task<HttpResponseMessage> RequestWfh(HttpClient c, DateTime date, string type = "WFH", string? slot = null) =>
        c.PostAsJsonAsync("/api/wfh-requests", new { requestType = type, requestDate = D(date), halfDaySlot = slot, reason = "plumber visit" });

    private async Task<int> PendingWfhId(HttpClient manager, string employee)
    {
        var pending = await Json(await manager.GetAsync("/api/wfh-requests/pending"));
        return pending.EnumerateArray().Single(r => r.GetProperty("employeeName").GetString() == employee).GetProperty("id").GetInt32();
    }

    // ── Leave ─────────────────────────────────────────────────────────────

    [Fact]
    public async Task Applying_leave_succeeds_and_reaches_the_manager_even_when_email_fails()
    {
        var r = await ApplyLeave(_priya, Monday, Monday.AddDays(1));

        Assert.Equal(HttpStatusCode.OK, r.StatusCode);                 // was: 500 "failed" but saved anyway
        Assert.Equal("Priya", (await Json(r)).GetProperty("userName").GetString());
        var all = await Json(await _manager.GetAsync("/api/leave/all"));
        Assert.Equal("Pending", all.EnumerateArray().Single().GetProperty("status").GetString());
        Assert.Single((await Json(await _priya.GetAsync("/api/leave/my"))).EnumerateArray());
    }

    [Fact]
    public async Task Invalid_leave_requests_get_a_clear_400_and_save_nothing()
    {
        var weekend = Monday.AddDays(5);
        var cases = new (Task<HttpResponseMessage> call, string expect)[]
        {
            (ApplyLeave(_priya, weekend, weekend.AddDays(1)), "weekends or public holidays"),
            (ApplyLeave(_priya, Monday.AddDays(2), Monday), "From date cannot be after To date"),
            (ApplyLeave(_priya, Monday, Monday, "Vacation"), "valid leave type"),
            (ApplyLeave(_priya, Monday, Monday.AddDays(20), "Sick"), "annual limit exceeded"),
        };
        foreach (var (call, expect) in cases)
        {
            var r = await call;
            Assert.Equal(HttpStatusCode.BadRequest, r.StatusCode);
            Assert.Contains(expect, await Message(r));
        }
        Assert.Empty((await Json(await _priya.GetAsync("/api/leave/my"))).EnumerateArray());
    }

    [Fact]
    public async Task Overlapping_leave_is_refused()
    {
        Assert.Equal(HttpStatusCode.OK, (await ApplyLeave(_priya, Monday, Monday.AddDays(2))).StatusCode);

        var r = await ApplyLeave(_priya, Monday.AddDays(1), Monday.AddDays(3), "Sick");

        Assert.Equal(HttpStatusCode.BadRequest, r.StatusCode);
        Assert.Contains("overlaps", await Message(r));
    }

    [Fact]
    public async Task Review_rules_approve_once_valid_status_managers_only_not_own_leave()
    {
        var leaveId = (await Json(await ApplyLeave(_priya, Monday, Monday))).GetProperty("id").GetInt32();

        var notManager = await _priya.PutAsJsonAsync($"/api/leave/{leaveId}/review", new { status = "Approved" });
        Assert.Equal(HttpStatusCode.Forbidden, notManager.StatusCode);

        var badStatus = await _manager.PutAsJsonAsync($"/api/leave/{leaveId}/review", new { status = "Maybe" });
        Assert.Equal(HttpStatusCode.BadRequest, badStatus.StatusCode);

        var ok = await _manager.PutAsJsonAsync($"/api/leave/{leaveId}/review", new { status = "Approved", reviewNote = "enjoy" });
        Assert.Equal(HttpStatusCode.OK, ok.StatusCode);                // email fails silently, review is saved

        var again = await _manager2.PutAsJsonAsync($"/api/leave/{leaveId}/review", new { status = "Rejected" });
        Assert.Equal(HttpStatusCode.BadRequest, again.StatusCode);
        Assert.Contains("already approved", await Message(again));

        var mine = (await Json(await ApplyLeave(_manager, Monday.AddDays(3), Monday.AddDays(3)))).GetProperty("id").GetInt32();
        var own = await _manager.PutAsJsonAsync($"/api/leave/{mine}/review", new { status = "Approved" });
        Assert.Equal(HttpStatusCode.BadRequest, own.StatusCode);
        Assert.Contains("own leave", await Message(own));
    }

    [Fact]
    public async Task Approved_leave_shows_as_On_Leave_on_the_manager_dashboard_not_absent()
    {
        var leaveId = (await Json(await ApplyLeave(_priya, Monday, Monday.AddDays(1)))).GetProperty("id").GetInt32();
        await _manager.PutAsJsonAsync($"/api/leave/{leaveId}/review", new { status = "Approved" });

        var status = await Json(await _manager.GetAsync($"/api/wfh-requests/team-status?date={D(Monday)}"));
        Assert.Equal(1, status.GetProperty("onLeaveCount").GetInt32());
        var priya = status.GetProperty("members").EnumerateArray().Single(m => m.GetProperty("fullName").GetString() == "Priya");
        Assert.Equal("On Leave", priya.GetProperty("effectiveStatus").GetString());

        var monthly = await Json(await _manager.GetAsync($"/api/wfh-requests/team-monthly?month={Monday.Month}&year={Monday.Year}"));
        var p = monthly.EnumerateArray().Single(m => m.GetProperty("fullName").GetString() == "Priya");
        var leaveDaysThisMonth = Enumerable.Range(0, 2).Count(i => Monday.AddDays(i).Month == Monday.Month);
        Assert.Equal(leaveDaysThisMonth, p.GetProperty("daysOnLeave").GetInt32());
    }

    // ── WFH / half day ────────────────────────────────────────────────────

    [Fact]
    public async Task WFH_request_succeeds_when_email_fails_and_the_assigned_manager_can_approve_it()
    {
        var r = await RequestWfh(_priya, Monday);
        Assert.Equal(HttpStatusCode.OK, r.StatusCode);                 // was: 500 but saved

        var id = await PendingWfhId(_manager, "Priya");
        var approve = await _manager.PostAsJsonAsync($"/api/wfh-requests/{id}/approve", new { note = "ok" });
        Assert.Equal(HttpStatusCode.OK, approve.StatusCode);

        var again = await _manager.PostAsJsonAsync($"/api/wfh-requests/{id}/approve", new { note = "ok" });
        Assert.Equal(HttpStatusCode.BadRequest, again.StatusCode);

        var status = await Json(await _manager.GetAsync($"/api/wfh-requests/team-status?date={D(Monday)}"));
        Assert.Equal(1, status.GetProperty("wfhCount").GetInt32());
        Assert.Empty((await Json(await _manager.GetAsync("/api/wfh-requests/pending"))).EnumerateArray());
    }

    [Fact]
    public async Task Someone_without_an_assigned_manager_can_request_and_managers_see_it()
    {
        var r = await RequestWfh(_ravi, Monday, "HalfDay", "Morning");

        Assert.Equal(HttpStatusCode.OK, r.StatusCode);                 // was: "No manager assigned" (500) after saving
        Assert.True(await PendingWfhId(_manager, "Ravi") > 0);
    }

    [Fact]
    public async Task Invalid_WFH_requests_get_a_clear_400_and_save_nothing()
    {
        await ApplyLeave(_priya, Monday.AddDays(3), Monday.AddDays(3));   // Thursday on leave
        Assert.Equal(HttpStatusCode.OK, (await RequestWfh(_priya, Monday)).StatusCode);

        var cases = new (Task<HttpResponseMessage> call, string expect)[]
        {
            (RequestWfh(_priya, AppClock.TodayIst.AddDays(-1)), "past dates"),
            (RequestWfh(_priya, Monday.AddDays(5)), "weekend"),
            (RequestWfh(_priya, Monday), "already have a pending"),
            (RequestWfh(_priya, Monday.AddDays(1), "HalfDay"), "Morning or Afternoon"),
            (RequestWfh(_priya, Monday.AddDays(3)), "leave on"),
            (RequestWfh(_priya, Monday.AddDays(2), "Holiday"), "WFH or HalfDay"),
        };
        foreach (var (call, expect) in cases)
        {
            var r = await call;
            Assert.Equal(HttpStatusCode.BadRequest, r.StatusCode);
            Assert.Contains(expect, await Message(r));
        }
        Assert.Single((await Json(await _priya.GetAsync("/api/wfh-requests/my"))).EnumerateArray());
    }

    [Fact]
    public async Task A_manager_cannot_approve_their_own_request_and_gets_403_not_500()
    {
        Assert.Equal(HttpStatusCode.OK, (await RequestWfh(_manager, Monday)).StatusCode);
        Assert.Empty((await Json(await _manager.GetAsync("/api/wfh-requests/pending"))).EnumerateArray());

        var id = await PendingWfhId(_manager2, "Mangesh");
        var own = await _manager.PostAsJsonAsync($"/api/wfh-requests/{id}/approve", new { note = "self" });

        Assert.Equal(HttpStatusCode.Forbidden, own.StatusCode);
        Assert.Contains("own request", await Message(own));
        Assert.Equal(HttpStatusCode.OK, (await _manager2.PostAsJsonAsync($"/api/wfh-requests/{id}/approve", new { note = "ok" })).StatusCode);
    }

    [Fact]
    public async Task Email_links_cannot_be_forged_or_edited()
    {
        await RequestWfh(_priya, Monday);
        var id = await PendingWfhId(_manager, "Priya");
        var anon = _factory.CreateClient();

        // the old link format: plain base64 of "id|manager|expiry" — anyone could build it
        var forged = Convert.ToBase64String(Encoding.UTF8.GetBytes($"{id}|1|{DateTime.UtcNow.AddDays(1):O}"));
        var r1 = await anon.PostAsync($"/api/wfh-requests/review?token={Uri.EscapeDataString(forged)}&status=Approved", null);
        Assert.Equal(HttpStatusCode.BadRequest, r1.StatusCode);

        var signedWithWrongKey = SignedActionToken.Create("wfh-review", id, 1, DateTime.UtcNow.AddDays(1), "not-the-server-key");
        var r2 = await anon.PostAsync($"/api/wfh-requests/review?token={signedWithWrongKey}&status=Approved", null);
        Assert.Equal(HttpStatusCode.BadRequest, r2.StatusCode);

        var pending = await Json(await _manager.GetAsync("/api/wfh-requests/pending"));
        Assert.Single(pending.EnumerateArray());                        // still pending
    }

    [Fact]
    public async Task The_real_email_link_approves_once()
    {
        using var t = WithRecordedEmails();
        await RequestWfh(t._priya, Monday);
        var link = t._emails!.WfhTokens.Single();
        Assert.Equal("m@test.dev", link.To);                            // sent to Priya's manager only
        var anon = t._factory.CreateClient();

        var ok = await anon.PostAsync($"/api/wfh-requests/review?token={link.Token}&status=Approved", null);
        Assert.Equal(HttpStatusCode.OK, ok.StatusCode);

        var again = await anon.PostAsync($"/api/wfh-requests/review?token={link.Token}&status=Rejected", null);
        Assert.Equal(HttpStatusCode.BadRequest, again.StatusCode);
        Assert.Single(t._emails.Reviewed, "Approved");                  // Priya told once
    }

    // ── Errors elsewhere now say what's wrong ─────────────────────────────

    [Fact]
    public async Task Business_errors_elsewhere_return_their_message_instead_of_500()
    {
        var r = await _manager.PutAsJsonAsync("/api/chat/conversations/999/group-info", new { name = "x" });
        Assert.Equal(HttpStatusCode.NotFound, r.StatusCode);
        Assert.Contains("not found", await Message(r));
    }

    /// <summary>Records emails instead of sending them</summary>
    private sealed class RecordingEmailService : IEmailService
    {
        public ConcurrentBag<(string To, string Token)> WfhTokens { get; } = new();
        public ConcurrentBag<string> Reviewed { get; } = new();
        public Task SendOtpEmailAsync(string email, string code, string purpose) => Task.CompletedTask;
        public Task SendWelcomeEmailAsync(string email, string fullName) => Task.CompletedTask;
        public Task SendLeaveAppliedEmailAsync(string to, string managerName, string employeeName, LeaveRequest leave, string token) => Task.CompletedTask;
        public Task SendLeaveReviewedEmailAsync(string to, string employeeName, string managerName, LeaveRequest leave, string status, string? note) => Task.CompletedTask;
        public Task SendWFHAppliedEmailAsync(string to, string managerName, string employeeName, WFHRequest request, string token)
        { WfhTokens.Add((to, token)); return Task.CompletedTask; }
        public Task SendWFHReviewedEmailAsync(string to, string employeeName, string managerName, WFHRequest request, string status, string? note)
        { Reviewed.Add(status); return Task.CompletedTask; }
    }
}
