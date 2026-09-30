using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using DailyTrackerAPI.Data;
using DailyTrackerAPI.Helpers;
using DailyTrackerAPI.Models.Auth;
using DailyTrackerAPI.Models.HR;
using DailyTrackerAPI.Models.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace DailyTrackerAPI.Tests;

/// <summary>
/// Comp-off (30 Sep 2026): working 4+ hours on a weekend or holiday earns a day
/// off; the manager / team lead approves it; a "CompOff" leave spends it; a
/// rejected or cancelled leave gives it back; it runs out 60 days after the day worked.
///   1 Mangesh (Manager) · 2 Tina (Team Lead) · 3 Priya (reports to Tina)
///   4 Ravi (reports to Mangesh) · 5 Om (Team Lead, nobody reports to him)
/// </summary>
public class CompOffTests : IDisposable
{
    private readonly ApiFactory _factory = new();
    private readonly HttpClient _manager, _lead, _priya, _ravi, _om;
    private static readonly DateTime LastSunday = PreviousSunday(AppClock.TodayIst);
    private static readonly DateTime Monday = NextWeekday(AppClock.TodayIst.AddDays(7), DayOfWeek.Monday);

    private static DateTime PreviousSunday(DateTime d) { d = d.AddDays(-1); while (d.DayOfWeek != DayOfWeek.Sunday) d = d.AddDays(-1); return d; }
    private static DateTime NextWeekday(DateTime d, DayOfWeek day) { while (d.DayOfWeek != day) d = d.AddDays(1); return d; }
    private static string D(DateTime d) => d.ToString("yyyy-MM-dd");

    public CompOffTests()
    {
        var users = new[]
        {
            new User { Id = 1, FullName = "Mangesh", Email = "m@test.dev", PasswordHash = "x", Role = "Manager", IsActive = true },
            new User { Id = 2, FullName = "Tina", Email = "t@test.dev", PasswordHash = "x", Role = "TeamLead", IsActive = true, ManagerId = 1 },
            new User { Id = 3, FullName = "Priya", Email = "p@test.dev", PasswordHash = "x", Role = "Developer", IsActive = true, ManagerId = 2 },
            new User { Id = 4, FullName = "Ravi", Email = "r@test.dev", PasswordHash = "x", Role = "Developer", IsActive = true, ManagerId = 1 },
            new User { Id = 5, FullName = "Om", Email = "o@test.dev", PasswordHash = "x", Role = "TeamLead", IsActive = true, ManagerId = 1 },
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
        _lead = ClientFor(users[1]);
        _priya = ClientFor(users[2]);
        _ravi = ClientFor(users[3]);
        _om = ClientFor(users[4]);
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

    /// <summary>A weekend / holiday day worked and checked out</summary>
    private int Worked(int userId, DateTime day, int minutes, string status = "Weekend", bool checkedOut = true) => Db(db =>
    {
        var checkIn = AppClock.FromIst(day.AddHours(10));
        var log = new DailyLog
        {
            UserId = userId, LogDate = day, DayStatus = status, CheckInTime = checkIn,
            CheckOutTime = checkedOut ? checkIn.AddMinutes(minutes) : null, TotalWorkMinutes = checkedOut ? minutes : 0,
        };
        db.DailyLogs.Add(log);
        db.SaveChanges();
        return log.Id;
    });

    private async Task<JsonElement> Mine(HttpClient c) => await Json(await c.GetAsync("/api/compoff/my"));

    private async Task<int> EarnApproved(int userId, HttpClient employee, DateTime day)
    {
        Worked(userId, day, 6 * 60);
        await employee.GetAsync("/api/compoff/my");
        var id = Db(db => db.CompOffCredits.Single(c => c.UserId == userId && c.WorkDate == day).Id);
        (await _manager.PutAsJsonAsync($"/api/compoff/{id}/review", new { status = "Approved" })).EnsureSuccessStatusCode();
        return id;
    }

    private Task<HttpResponseMessage> ApplyCompOff(HttpClient c, DateTime from, DateTime to) =>
        c.PostAsJsonAsync("/api/leave", new { fromDate = D(from), toDate = D(to), leaveType = "CompOff", reason = "rest after the release" });

    private async Task<int> CompOffBalance(HttpClient c) =>
        (await Json(await c.GetAsync("/api/leave/balance")))[0].GetProperty("balances").EnumerateArray()
            .Single(b => b.GetProperty("leaveType").GetString() == "CompOff").GetProperty("remaining").GetInt32();

    // ── Earning ─────────────────────────────────────────────────────────────

    [Fact]
    public async Task Four_hours_on_a_weekend_earns_a_day_waiting_for_approval_less_or_still_open_earns_nothing()
    {
        Worked(3, LastSunday, 5 * 60);
        Worked(3, LastSunday.AddDays(-1), 3 * 60);                   // Saturday, only 3 hours
        Worked(4, LastSunday, 0, checkedOut: false);                  // Ravi hasn't checked out

        var mine = await Mine(_priya);
        Assert.Equal(1, mine.GetProperty("pending").GetInt32());
        Assert.Equal(0, mine.GetProperty("available").GetInt32());
        var credit = mine.GetProperty("credits")[0];
        Assert.Equal("Pending", credit.GetProperty("state").GetString());
        Assert.Equal("Sunday", credit.GetProperty("occasion").GetString());
        Assert.Equal(D(LastSunday.AddDays(60)), credit.GetProperty("expiresOn").GetString()![..10]);

        Assert.Equal(0, (await Mine(_ravi)).GetProperty("credits").GetArrayLength());
        await _priya.GetAsync("/api/compoff/my");                     // asking again doesn't double it
        Assert.Equal(1, Db(db => db.CompOffCredits.Count()));
        Assert.True(Db(db => db.Notifications.Any(n => n.UserId == 2 && n.Title.Contains("Comp-off"))));   // her team lead is told
    }

    [Fact]
    public async Task A_public_holiday_is_named_after_the_holiday()
    {
        var diwali = LastSunday.AddDays(-2);                          // a Friday
        Db(db => { db.Holidays.Add(new Holiday { Date = diwali, Name = "Diwali", Type = "Public", Year = diwali.Year }); return db.SaveChanges(); });
        Worked(4, diwali, 8 * 60, status: "Holiday");
        var credit = (await Mine(_ravi)).GetProperty("credits")[0];
        Assert.Equal("Diwali", credit.GetProperty("occasion").GetString());
    }

    // ── Approving ───────────────────────────────────────────────────────────

    [Fact]
    public async Task A_team_lead_approves_only_their_own_team()
    {
        Worked(3, LastSunday, 6 * 60);
        Worked(4, LastSunday, 6 * 60);
        await _manager.GetAsync("/api/compoff/pending");              // turns the work into comp-off days

        var leadSees = await Json(await _lead.GetAsync("/api/compoff/pending"));
        Assert.Equal(new[] { "Priya" }, leadSees.EnumerateArray().Select(c => c.GetProperty("userName").GetString()));
        Assert.Equal(0, (await Json(await _om.GetAsync("/api/compoff/pending"))).GetArrayLength());
        Assert.Equal(2, (await Json(await _manager.GetAsync("/api/compoff/pending"))).GetArrayLength());

        var ravis = Db(db => db.CompOffCredits.Single(c => c.UserId == 4).Id);
        Assert.Equal(HttpStatusCode.Forbidden, (await _lead.PutAsJsonAsync($"/api/compoff/{ravis}/review", new { status = "Approved" })).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await _priya.PutAsJsonAsync($"/api/compoff/{ravis}/review", new { status = "Approved" })).StatusCode);

        var priyas = leadSees[0].GetProperty("id").GetInt32();
        var ok = await _lead.PutAsJsonAsync($"/api/compoff/{priyas}/review", new { status = "Approved", note = "Thanks for Sunday" });
        Assert.Equal(HttpStatusCode.OK, ok.StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await _lead.PutAsJsonAsync($"/api/compoff/{priyas}/review", new { status = "Rejected" })).StatusCode);

        Assert.Equal(1, (await Mine(_priya)).GetProperty("available").GetInt32());
        Assert.Equal(1, await CompOffBalance(_priya));
        Assert.True(Db(db => db.Notifications.Any(n => n.UserId == 3 && n.Title.Contains("approved"))));
    }

    [Fact]
    public async Task A_team_lead_cannot_approve_their_own_comp_off()
    {
        Worked(2, LastSunday, 6 * 60);
        await _lead.GetAsync("/api/compoff/my");
        Assert.Equal(0, (await Json(await _lead.GetAsync("/api/compoff/pending"))).GetArrayLength());
        var id = Db(db => db.CompOffCredits.Single().Id);
        Assert.Equal(HttpStatusCode.Forbidden, (await _lead.PutAsJsonAsync($"/api/compoff/{id}/review", new { status = "Approved" })).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await _manager.PutAsJsonAsync($"/api/compoff/{id}/review", new { status = "Approved" })).StatusCode);
    }

    // ── Spending ────────────────────────────────────────────────────────────

    [Fact]
    public async Task A_comp_off_leave_uses_the_day_and_a_rejected_or_cancelled_leave_gives_it_back()
    {
        await EarnApproved(4, _ravi, LastSunday);

        var tooLong = await ApplyCompOff(_ravi, Monday, Monday.AddDays(1));
        Assert.Equal(HttpStatusCode.BadRequest, tooLong.StatusCode);
        Assert.Contains("1 comp-off day available but asked for 2", await Message(tooLong));

        Assert.Equal(HttpStatusCode.OK, (await ApplyCompOff(_ravi, Monday, Monday)).StatusCode);
        Assert.Equal(0, await CompOffBalance(_ravi));
        var mine = await Mine(_ravi);
        Assert.Equal("Used", mine.GetProperty("credits")[0].GetProperty("state").GetString());
        Assert.Equal(HttpStatusCode.BadRequest, (await ApplyCompOff(_ravi, Monday.AddDays(1), Monday.AddDays(1))).StatusCode);

        // the manager rejects the leave → the day is available again
        var leaveId = Db(db => db.LeaveRequests.Single().Id);
        (await _manager.PutAsJsonAsync($"/api/leave/{leaveId}/review", new { status = "Rejected", reviewNote = "Release week" })).EnsureSuccessStatusCode();
        Assert.Equal(1, await CompOffBalance(_ravi));

        // applied again and cancelled → available again
        Assert.Equal(HttpStatusCode.OK, (await ApplyCompOff(_ravi, Monday.AddDays(1), Monday.AddDays(1))).StatusCode);
        Assert.Equal(0, await CompOffBalance(_ravi));
        var second = Db(db => db.LeaveRequests.Single(l => l.Status == "Pending").Id);
        Assert.Equal(HttpStatusCode.OK, (await _ravi.DeleteAsync($"/api/leave/{second}")).StatusCode);
        Assert.Equal(1, await CompOffBalance(_ravi));
        Assert.Null(Db(db => db.CompOffCredits.Single().UsedByLeaveId));
    }

    [Fact]
    public async Task Without_approved_comp_off_a_comp_off_leave_is_refused_with_a_clear_message()
    {
        Worked(4, LastSunday, 6 * 60);                                // earned but still waiting
        await _ravi.GetAsync("/api/compoff/my");
        var r = await ApplyCompOff(_ravi, Monday, Monday);
        Assert.Equal(HttpStatusCode.BadRequest, r.StatusCode);
        Assert.Contains("no approved comp-off days", await Message(r));
        Assert.False(Db(db => db.LeaveRequests.Any()));
    }

    [Fact]
    public async Task Each_leave_day_uses_the_comp_off_that_runs_out_first()
    {
        var older = await EarnApproved(4, _ravi, LastSunday.AddDays(-7));
        var newer = await EarnApproved(4, _ravi, LastSunday);
        Assert.Equal(HttpStatusCode.OK, (await ApplyCompOff(_ravi, Monday, Monday)).StatusCode);
        Assert.NotNull(Db(db => db.CompOffCredits.Single(c => c.Id == older).UsedByLeaveId));
        Assert.Null(Db(db => db.CompOffCredits.Single(c => c.Id == newer).UsedByLeaveId));
    }

    // ── Running out ─────────────────────────────────────────────────────────

    [Fact]
    public async Task Comp_off_runs_out_after_60_days_with_a_reminder_the_week_before()
    {
        var id = await EarnApproved(4, _ravi, LastSunday);
        Db(db =>
        {
            var c = db.CompOffCredits.Single(x => x.Id == id);
            c.ExpiresOn = AppClock.TodayIst.AddDays(3);               // runs out this week
            return db.SaveChanges();
        });
        using (var scope = _factory.Services.CreateScope())
        {
            var svc = scope.ServiceProvider.GetRequiredService<DailyTrackerAPI.Services.HR.ICompOffService>();
            Assert.Equal(1, await svc.SendExpiryRemindersAsync());
            Assert.Equal(0, await svc.SendExpiryRemindersAsync()); // only once
        }
        Assert.Equal(1, Db(db => db.Notifications.Count(n => n.UserId == 4 && n.Title.Contains("running out"))));

        Db(db => { db.CompOffCredits.Single(x => x.Id == id).ExpiresOn = AppClock.TodayIst.AddDays(-1); return db.SaveChanges(); });
        var mine = await Mine(_ravi);
        Assert.Equal("Expired", mine.GetProperty("credits")[0].GetProperty("state").GetString());
        Assert.Equal(0, mine.GetProperty("available").GetInt32());
        Assert.Equal(HttpStatusCode.BadRequest, (await ApplyCompOff(_ravi, Monday, Monday)).StatusCode);
    }

    [Fact]
    public async Task The_nightly_job_turns_weekend_work_into_comp_off_for_everyone()
    {
        Worked(3, LastSunday, 6 * 60);
        Worked(4, LastSunday, 7 * 60);
        using var scope = _factory.Services.CreateScope();
        var svc = scope.ServiceProvider.GetRequiredService<DailyTrackerAPI.Services.HR.ICompOffService>();
        Assert.Equal(2, await svc.SyncAsync());
        Assert.Equal(0, await svc.SyncAsync());
    }
}
