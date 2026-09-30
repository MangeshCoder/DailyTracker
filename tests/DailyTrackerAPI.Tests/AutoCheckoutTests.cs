using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using DailyTrackerAPI.Data;
using DailyTrackerAPI.Helpers;
using DailyTrackerAPI.Models.Attendance;
using DailyTrackerAPI.Models.Auth;
using DailyTrackerAPI.Models.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace DailyTrackerAPI.Tests;

/// <summary>
/// Forgotten check-outs (30 Sep 2026): the day is closed at the last proof of work
/// (so late work keeps its overtime) or after a normal day; the next morning is a
/// fresh check-in; the employee confirms or sends the real time; the manager decides.
///   1 Mangesh (Manager) · 2 Tina (Team Lead) · 3 Priya (reports to Tina)
///   4 Ravi (reports to Mangesh) · 5 Other Manager
/// </summary>
public class AutoCheckoutTests : IDisposable
{
    private readonly ApiFactory _factory = new();
    private readonly Dictionary<int, User> _users = new();
    private readonly HttpClient _manager, _lead, _priya, _ravi;
    private static readonly DateTime Day = AppClock.TodayIst.AddDays(-2);           // always past the overnight cut-off
    private static DateTime Ist(int hour, int minute = 0) => AppClock.FromIst(Day.AddHours(hour).AddMinutes(minute));
    private const double OfficeLat = 18.738089228557875, OfficeLng = 73.67283053582766;

    public AutoCheckoutTests()
    {
        _users[1] = new User { Id = 1, FullName = "Mangesh", Email = "m@test.dev", PasswordHash = "x", Role = "Manager", IsActive = true };
        _users[2] = new User { Id = 2, FullName = "Tina", Email = "t@test.dev", PasswordHash = "x", Role = "TeamLead", IsActive = true, ManagerId = 1 };
        _users[3] = new User { Id = 3, FullName = "Priya", Email = "p@test.dev", PasswordHash = "x", Role = "Developer", IsActive = true, ManagerId = 2 };
        _users[4] = new User { Id = 4, FullName = "Ravi", Email = "r@test.dev", PasswordHash = "x", Role = "Developer", IsActive = true, ManagerId = 1 };
        _users[5] = new User { Id = 5, FullName = "Other Manager", Email = "o@test.dev", PasswordHash = "x", Role = "Manager", IsActive = true };
        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            TestDatabase.CreateSchema(db);
            db.Users.AddRange(_users.Values);
            db.SaveChanges();
            TestDatabase.AfterSeed(db);
        }
        _manager = ClientFor(_users[1]);
        _lead = ClientFor(_users[2]);
        _priya = ClientFor(_users[3]);
        _ravi = ClientFor(_users[4]);
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

    /// <summary>A day checked in at 09:00 and never checked out, with optional task / break</summary>
    private int ForgottenDay(int userId, DateTime? taskAt = null, (DateTime start, DateTime end)? breakAt = null) => Db(db =>
    {
        var log = new DailyLog { UserId = userId, LogDate = Day, CheckInTime = Ist(9), DayStatus = "Present" };
        db.DailyLogs.Add(log);
        db.SaveChanges();
        if (taskAt is DateTime t)
            db.TaskLogs.Add(new TaskLog { DailyLogId = log.Id, TaskTitle = "Release", CreatedAt = t });
        if (breakAt is var (s, e))
            db.BreakLogs.Add(new BreakLog { DailyLogId = log.Id, BreakType = "Lunch", StartTime = s, EndTime = e,
                                            DurationMinutes = (int)(e - s).TotalMinutes, IsActive = false });
        db.SaveChanges();
        return log.Id;
    });

    private DailyLog Log(int id) => Db(db => db.DailyLogs.AsNoTracking().First(d => d.Id == id));

    private static async Task<JsonElement> Json(HttpResponseMessage r) =>
        JsonDocument.Parse(await r.Content.ReadAsStringAsync()).RootElement;

    // ── Closing ─────────────────────────────────────────────────────────────

    [Fact]
    public async Task Late_work_keeps_its_overtime_the_day_closes_at_the_last_proof_of_work()
    {
        var id = ForgottenDay(3, taskAt: Ist(22, 30), breakAt: (Ist(13), Ist(14)));
        await _priya.GetAsync("/api/DailyLog/today");                  // opening the app closes it

        var log = Log(id);
        Assert.True(log.AutoCheckedOut);
        Assert.Equal("LastActivity", log.AutoCheckOutBasis);
        Assert.Equal(Ist(22, 30), log.CheckOutTime);
        Assert.Equal(60, log.TotalBreakMinutes);
        Assert.Equal(12 * 60 + 30, log.TotalWorkMinutes);             // 09:00–22:30 minus lunch — overtime kept
    }

    [Fact]
    public async Task With_no_late_activity_the_day_closes_after_a_normal_day_never_24_hours()
    {
        var id = ForgottenDay(3, taskAt: Ist(11), breakAt: (Ist(13), Ist(13, 30)));
        await _priya.GetAsync("/api/DailyLog/today");

        var log = Log(id);
        Assert.Equal("NormalDay", log.AutoCheckOutBasis);
        Assert.Equal(Ist(17, 30), log.CheckOutTime);                 // 8 h of work + the 30-min break
        Assert.Equal(8 * 60, log.TotalWorkMinutes);
    }

    [Fact]
    public async Task The_next_morning_is_a_fresh_check_in_not_yesterdays_check_out()
    {
        ForgottenDay(3);
        var today = await _priya.GetAsync("/api/DailyLog/today");
        Assert.Equal(HttpStatusCode.NotFound, today.StatusCode);     // nothing open — the old day was closed
        var checkIn = await _priya.PostAsJsonAsync("/api/DailyLog/checkin",
            new { dayStatus = "Present", latitude = OfficeLat, longitude = OfficeLng });
        Assert.Equal(HttpStatusCode.OK, checkIn.StatusCode);
    }

    [Fact]
    public async Task A_break_left_running_does_not_eat_the_day()
    {
        var id = ForgottenDay(3);
        Db(db => { db.BreakLogs.Add(new BreakLog { DailyLogId = id, BreakType = "Tea", StartTime = Ist(16), IsActive = true }); return db.SaveChanges(); });
        await _priya.GetAsync("/api/DailyLog/today");
        var log = Log(id);
        Assert.Equal(0, log.TotalBreakMinutes);
        Assert.Equal(8 * 60, log.TotalWorkMinutes);
    }

    // ── The employee's answer ───────────────────────────────────────────────

    [Fact]
    public async Task One_click_confirm_and_the_question_goes_away()
    {
        var id = ForgottenDay(3);
        var ask = await Json(await _priya.GetAsync("/api/DailyLog/auto-checkout"));
        Assert.Equal(id, ask.GetProperty("logId").GetInt32());
        Assert.Equal("NormalDay", ask.GetProperty("basis").GetString());

        Assert.Equal(HttpStatusCode.OK, (await _priya.PostAsync($"/api/DailyLog/{id}/auto-checkout/confirm", null)).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await _priya.GetAsync("/api/DailyLog/auto-checkout")).StatusCode);
        Assert.Equal("Confirmed", Log(id).CorrectionStatus);
        Assert.Equal(HttpStatusCode.BadRequest, (await _priya.PostAsync($"/api/DailyLog/{id}/auto-checkout/confirm", null)).StatusCode);
    }

    [Fact]
    public async Task A_correction_approved_by_the_team_lead_updates_the_hours()
    {
        var id = ForgottenDay(3, breakAt: (Ist(13), Ist(14)));
        await _priya.GetAsync("/api/DailyLog/auto-checkout");        // closed at 18:00 (normal day)

        var send = await _priya.PostAsJsonAsync($"/api/DailyLog/{id}/checkout-correction",
            new { checkOutTime = Ist(21), reason = "Stayed for the release" });
        Assert.Equal(HttpStatusCode.OK, send.StatusCode);
        Assert.Equal("Pending", Log(id).CorrectionStatus);

        var pending = await Json(await _lead.GetAsync("/api/DailyLog/checkout-corrections/pending"));
        var row = Assert.Single(pending.EnumerateArray());
        Assert.Equal("Priya", row.GetProperty("userName").GetString());
        Assert.Equal("Stayed for the release", row.GetProperty("reason").GetString());

        var ok = await _lead.PutAsJsonAsync($"/api/DailyLog/{id}/checkout-correction/review", new { status = "Approved", note = "Thanks" });
        Assert.Equal(HttpStatusCode.OK, ok.StatusCode);
        var log = Log(id);
        Assert.Equal("Approved", log.CorrectionStatus);
        Assert.Equal(Ist(21), log.CheckOutTime);
        Assert.Equal(11 * 60, log.TotalWorkMinutes);                  // 09:00–21:00 minus lunch: overtime counted
        Assert.Equal(2, log.CorrectionReviewedById);
    }

    [Fact]
    public async Task A_rejected_correction_keeps_the_saved_time()
    {
        var id = ForgottenDay(4);
        await _ravi.GetAsync("/api/DailyLog/auto-checkout");
        await _ravi.PostAsJsonAsync($"/api/DailyLog/{id}/checkout-correction", new { checkOutTime = Ist(23), reason = "late" });
        var no = await _manager.PutAsJsonAsync($"/api/DailyLog/{id}/checkout-correction/review", new { status = "Rejected" });
        Assert.Equal(HttpStatusCode.OK, no.StatusCode);
        var log = Log(id);
        Assert.Equal("Rejected", log.CorrectionStatus);
        Assert.Equal(Ist(17), log.CheckOutTime);
        Assert.Equal(8 * 60, log.TotalWorkMinutes);
    }

    [Theory]
    [InlineData(8, 0, "after your check-in")]        // before check-in
    [InlineData(30, 0, "at most")]                   // after 05:00 the next morning
    public async Task A_correction_time_must_be_within_the_shift(int hour, int minute, string message)
    {
        var id = ForgottenDay(3);
        await _priya.GetAsync("/api/DailyLog/auto-checkout");
        var r = await _priya.PostAsJsonAsync($"/api/DailyLog/{id}/checkout-correction",
            new { checkOutTime = Ist(hour, minute), reason = "x" });
        Assert.Equal(HttpStatusCode.BadRequest, r.StatusCode);
        Assert.Contains(message, (await Json(r)).GetProperty("message").GetString());
    }

    [Fact]
    public async Task A_correction_needs_a_reason_and_only_for_an_auto_closed_day()
    {
        var id = ForgottenDay(3);
        await _priya.GetAsync("/api/DailyLog/auto-checkout");
        Assert.Equal(HttpStatusCode.BadRequest, (await _priya.PostAsJsonAsync($"/api/DailyLog/{id}/checkout-correction",
            new { checkOutTime = Ist(20), reason = " " })).StatusCode);

        var ownDay = Db(db =>
        {
            var l = new DailyLog { UserId = 3, LogDate = Day.AddDays(-1), CheckInTime = Ist(9).AddDays(-1), CheckOutTime = Ist(18).AddDays(-1) };
            db.DailyLogs.Add(l); db.SaveChanges(); return l.Id;
        });
        Assert.Equal(HttpStatusCode.BadRequest, (await _priya.PostAsJsonAsync($"/api/DailyLog/{ownDay}/checkout-correction",
            new { checkOutTime = Ist(20).AddDays(-1), reason = "x" })).StatusCode);
        // someone else's day
        Assert.Equal(HttpStatusCode.NotFound, (await _ravi.PostAsJsonAsync($"/api/DailyLog/{id}/checkout-correction",
            new { checkOutTime = Ist(20), reason = "x" })).StatusCode);
    }

    // ── Who decides ─────────────────────────────────────────────────────────

    [Fact]
    public async Task Only_the_persons_own_team_lead_or_a_manager_decides()
    {
        var id = ForgottenDay(4);                                     // Ravi reports to Mangesh, not Tina
        await _ravi.GetAsync("/api/DailyLog/auto-checkout");
        await _ravi.PostAsJsonAsync($"/api/DailyLog/{id}/checkout-correction", new { checkOutTime = Ist(20), reason = "late" });

        Assert.Empty((await Json(await _lead.GetAsync("/api/DailyLog/checkout-corrections/pending"))).EnumerateArray());
        Assert.Equal(HttpStatusCode.Forbidden, (await _lead.PutAsJsonAsync($"/api/DailyLog/{id}/checkout-correction/review",
            new { status = "Approved" })).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await _priya.GetAsync("/api/DailyLog/checkout-corrections/pending")).StatusCode);
        Assert.Equal("Pending", Log(id).CorrectionStatus);
    }

    [Fact]
    public async Task A_manager_cannot_approve_their_own_correction_when_another_manager_exists()
    {
        var id = ForgottenDay(1);
        await _manager.GetAsync("/api/DailyLog/auto-checkout");
        await _manager.PostAsJsonAsync($"/api/DailyLog/{id}/checkout-correction", new { checkOutTime = Ist(20), reason = "late" });
        Assert.Empty((await Json(await _manager.GetAsync("/api/DailyLog/checkout-corrections/pending"))).EnumerateArray());
        Assert.Equal(HttpStatusCode.Forbidden, (await _manager.PutAsJsonAsync($"/api/DailyLog/{id}/checkout-correction/review",
            new { status = "Approved" })).StatusCode);
    }

    [Fact]
    public async Task The_daily_log_says_when_the_app_closed_the_day()
    {
        ForgottenDay(3);
        var history = await Json(await _priya.GetAsync("/api/DailyLog/history?days=7"));
        var day = history.EnumerateArray().First(d => d.GetProperty("logDate").GetDateTime().Date == Day);
        Assert.True(day.GetProperty("autoCheckedOut").GetBoolean());
    }
}
