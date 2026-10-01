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
/// Missed check-in requests (2 Oct 2026): "I worked that day but forgot to check in".
///   1 Mangesh (Manager) · 2 Tina (Team Lead) · 3 Priya (Tina's team) · 4 Ravi (Mangesh's team)
/// </summary>
public class MissedCheckInTests : IDisposable
{
    private readonly ApiFactory _factory = new();
    private readonly HttpClient _mangesh, _tina, _priya, _ravi;
    private static readonly DateTime Today = AppClock.TodayIst;
    private static readonly DateTime WorkDay = PrevWeekday(Today.AddDays(-1));          // a past working day
    private static readonly DateTime OtherWorkDay = PrevWeekday(WorkDay.AddDays(-1));
    private static readonly DateTime LeaveDay = PrevWeekday(OtherWorkDay.AddDays(-1));
    private static readonly DateTime CheckedInDay = PrevWeekday(LeaveDay.AddDays(-1));

    private static DateTime PrevWeekday(DateTime d)
    {
        while (d.DayOfWeek is DayOfWeek.Saturday or DayOfWeek.Sunday) d = d.AddDays(-1);
        return d;
    }

    public MissedCheckInTests()
    {
        var joined = DateTime.SpecifyKind(Today.AddMonths(-6), DateTimeKind.Utc);
        var users = new[]
        {
            new User { Id = 1, FullName = "Mangesh", Email = "m@test.dev", PasswordHash = "x", Role = "Manager", IsActive = true, JoinDate = joined },
            new User { Id = 2, FullName = "Tina", Email = "t@test.dev", PasswordHash = "x", Role = "TeamLead", IsActive = true, ManagerId = 1, JoinDate = joined },
            new User { Id = 3, FullName = "Priya", Email = "p@test.dev", PasswordHash = "x", Role = "Developer", IsActive = true, ManagerId = 2, JoinDate = joined },
            new User { Id = 4, FullName = "Ravi", Email = "r@test.dev", PasswordHash = "x", Role = "Developer", IsActive = true, ManagerId = 1, JoinDate = joined },
        };
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        TestDatabase.CreateSchema(db);
        db.Users.AddRange(users);
        db.LeaveRequests.Add(new LeaveRequest { UserId = 3, FromDate = LeaveDay, ToDate = LeaveDay, LeaveType = "Casual", Status = "Approved", Reason = "family" });
        db.DailyLogs.Add(new DailyLog { UserId = 3, LogDate = CheckedInDay, CheckInTime = AppClock.FromIst(CheckedInDay.AddHours(9)), DayStatus = "Present" });
        db.SaveChanges();
        TestDatabase.AfterSeed(db);
        var jwt = scope.ServiceProvider.GetRequiredService<JwtHelper>();
        HttpClient Client(User u) { var c = _factory.CreateClient(); c.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", jwt.GenerateAccessToken(u).Token); return c; }
        (_mangesh, _tina, _priya, _ravi) = (Client(users[0]), Client(users[1]), Client(users[2]), Client(users[3]));
    }

    public void Dispose() => _factory.Dispose();

    private static async Task<JsonElement> Ok(HttpResponseMessage r)
    {
        Assert.True(r.IsSuccessStatusCode, $"{(int)r.StatusCode} {await r.Content.ReadAsStringAsync()}");
        return JsonDocument.Parse(await r.Content.ReadAsStringAsync()).RootElement;
    }

    private static async Task<string> Refused(HttpResponseMessage r)
    {
        Assert.Equal(HttpStatusCode.BadRequest, r.StatusCode);
        return JsonDocument.Parse(await r.Content.ReadAsStringAsync()).RootElement.GetProperty("message").GetString()!;
    }

    private Task<HttpResponseMessage> Ask(HttpClient c, DateTime day, string from = "09:30", string to = "18:30", string mode = "Office", string reason = "Phone battery died") =>
        c.PostAsJsonAsync("/api/missed-checkin", new { date = day.ToString("yyyy-MM-dd"), checkIn = from, checkOut = to, workMode = mode, reason });

    private T Db<T>(Func<AppDbContext, T> f)
    {
        using var scope = _factory.Services.CreateScope();
        return f(scope.ServiceProvider.GetRequiredService<AppDbContext>());
    }

    private async Task<int> AbsentDays(DateTime day)
    {
        var s = await Ok(await _mangesh.GetAsync($"/api/Manager/user/3/attendance?month={day.Month}&year={day.Year}"));
        return s.GetProperty("daysAbsent").GetInt32();
    }

    [Fact]
    public async Task Approving_adds_the_day_so_it_is_no_longer_absent()
    {
        var absentBefore = await AbsentDays(WorkDay);
        var req = await Ok(await Ask(_priya, WorkDay));
        Assert.Equal("Pending", req.GetProperty("status").GetString());

        // her team lead and the manager see it; a colleague can't
        var forTina = await Ok(await _tina.GetAsync("/api/missed-checkin/pending"));
        Assert.Equal("Priya", forTina.EnumerateArray().Single().GetProperty("userName").GetString());
        Assert.Single((await Ok(await _mangesh.GetAsync("/api/missed-checkin/pending"))).EnumerateArray());
        Assert.Equal(HttpStatusCode.Forbidden, (await _ravi.GetAsync("/api/missed-checkin/pending")).StatusCode);
        Assert.True(Db(db => db.Notifications.Any(n => n.UserId == 2 && n.Title.Contains("Missed check-in"))));

        var id = req.GetProperty("id").GetInt32();
        var done = await Ok(await _tina.PutAsJsonAsync($"/api/missed-checkin/{id}/review", new { status = "Approved" }));
        Assert.Equal("Approved", done.GetProperty("status").GetString());

        // the day is a normal attendance record now: 09:30–18:30 IST = 04:00–13:00 UTC, 9 hours
        var log = Db(db => db.DailyLogs.AsNoTracking().Single(l => l.UserId == 3 && l.LogDate == WorkDay));
        Assert.Equal("Present", log.DayStatus);
        Assert.Equal(AppClock.FromIst(WorkDay.AddHours(9.5)), log.CheckInTime);
        Assert.Equal(540, log.TotalWorkMinutes);
        Assert.Equal(absentBefore - 1, await AbsentDays(WorkDay));
        Assert.True(Db(db => db.Notifications.Any(n => n.UserId == 3 && n.Title.Contains("Missed check-in added"))));
        Assert.Empty((await Ok(await _tina.GetAsync("/api/missed-checkin/pending"))).EnumerateArray());
    }

    [Fact]
    public async Task A_WFH_day_is_added_as_WFH()
    {
        var id = (await Ok(await Ask(_ravi, WorkDay, mode: "WFH"))).GetProperty("id").GetInt32();
        await Ok(await _mangesh.PutAsJsonAsync($"/api/missed-checkin/{id}/review", new { status = "Approved" }));
        Assert.Equal("WFH", Db(db => db.DailyLogs.Single(l => l.UserId == 4 && l.LogDate == WorkDay).DayStatus));
    }

    [Fact]
    public async Task Requests_that_cant_be_right_are_refused_with_a_clear_reason()
    {
        Assert.Contains("just check in", await Refused(await Ask(_priya, Today)));
        Assert.Contains("already passed", await Refused(await Ask(_priya, Today.AddDays(3))));
        var saturday = Today.AddDays(-1); while (saturday.DayOfWeek != DayOfWeek.Saturday) saturday = saturday.AddDays(-1);
        Assert.Contains("weekend", await Refused(await Ask(_priya, saturday)));
        Assert.Contains("last 30 days", await Refused(await Ask(_priya, PrevWeekday(Today.AddDays(-40)))));
        Assert.Contains("after the check-in", await Refused(await Ask(_priya, WorkDay, "18:00", "09:00")));
        Assert.Contains("hours:minutes", await Refused(await Ask(_priya, WorkDay, "9.30am", "18:00")));
        Assert.Contains("already have a check-in", await Refused(await Ask(_priya, CheckedInDay)));
        Assert.Contains("approved leave", await Refused(await Ask(_priya, LeaveDay)));
        Assert.Contains("why", await Refused(await Ask(_priya, WorkDay, reason: " ")));

        await Ok(await Ask(_priya, OtherWorkDay));
        Assert.Contains("already asked", await Refused(await Ask(_priya, OtherWorkDay)));
    }

    [Fact]
    public async Task A_day_before_joining_is_refused()
    {
        Db(db => { db.Users.Find(4)!.JoinDate = DateTime.SpecifyKind(WorkDay, DateTimeKind.Utc); return db.SaveChanges(); });
        Assert.Contains("before you joined", await Refused(await Ask(_ravi, OtherWorkDay)));
        await Ok(await Ask(_ravi, WorkDay));                                              // the joining day itself is fine
    }

    [Fact]
    public async Task Days_after_the_first_check_in_count_even_if_the_join_date_is_later()
    {
        // like the attendance calendar: someone who checked in had clearly joined
        Db(db =>
        {
            db.Users.Find(4)!.JoinDate = DateTime.SpecifyKind(Today, DateTimeKind.Utc);
            db.DailyLogs.Add(new DailyLog { UserId = 4, LogDate = LeaveDay, CheckInTime = AppClock.FromIst(LeaveDay.AddHours(9)), DayStatus = "Present" });
            return db.SaveChanges();
        });
        await Ok(await Ask(_ravi, OtherWorkDay));                                         // after his first check-in
        Assert.Contains("before you joined", await Refused(await Ask(_ravi, CheckedInDay)));   // before it
    }

    [Fact]
    public async Task Declining_needs_a_reason_and_adds_nothing_and_pending_ones_can_be_cancelled()
    {
        var id = (await Ok(await Ask(_priya, WorkDay))).GetProperty("id").GetInt32();
        Assert.Contains("reason for declining", await Refused(await _tina.PutAsJsonAsync($"/api/missed-checkin/{id}/review", new { status = "Rejected" })));
        await Ok(await _tina.PutAsJsonAsync($"/api/missed-checkin/{id}/review", new { status = "Rejected", note = "You were not in office that day" }));
        Assert.False(Db(db => db.DailyLogs.Any(l => l.UserId == 3 && l.LogDate == WorkDay)));
        var mine = await Ok(await _priya.GetAsync("/api/missed-checkin/mine"));
        Assert.Equal(("Rejected", "You were not in office that day", "Tina"),
            (mine[0].GetProperty("status").GetString(), mine[0].GetProperty("reviewNote").GetString(), mine[0].GetProperty("reviewedBy").GetString()));

        var id2 = (await Ok(await Ask(_priya, OtherWorkDay))).GetProperty("id").GetInt32();
        Assert.Equal(HttpStatusCode.NotFound, (await _ravi.DeleteAsync($"/api/missed-checkin/{id2}")).StatusCode);   // not his
        await Ok(await _priya.DeleteAsync($"/api/missed-checkin/{id2}"));
        Assert.Empty((await Ok(await _tina.GetAsync("/api/missed-checkin/pending"))).EnumerateArray());
        await Ok(await Ask(_priya, OtherWorkDay));                                     // can ask again after cancelling
    }

    [Fact]
    public async Task A_team_lead_cannot_decide_for_someone_outside_their_team()
    {
        var id = (await Ok(await Ask(_ravi, WorkDay))).GetProperty("id").GetInt32();
        Assert.Empty((await Ok(await _tina.GetAsync("/api/missed-checkin/pending"))).EnumerateArray());
        Assert.Equal(HttpStatusCode.Forbidden, (await _tina.PutAsJsonAsync($"/api/missed-checkin/{id}/review", new { status = "Approved" })).StatusCode);
    }
}
