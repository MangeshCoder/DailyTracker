using System.Net;
using System.Net.Http.Headers;
using System.Text.Json;
using DailyTrackerAPI.Data;
using DailyTrackerAPI.Helpers;
using DailyTrackerAPI.Models.Auth;
using DailyTrackerAPI.Models.HR;
using Microsoft.Extensions.DependencyInjection;

namespace DailyTrackerAPI.Tests;

/// <summary>
/// Data problems found in the phone &amp; light-theme check (30 Sep 2026):
///   U4 — days before someone joined (and today) were counted as Absent
///   U5 — the unapproved "Pending" account showed up in team lists
///   1 Mangesh (Manager) · 2 Tina (Team Lead, joined mid last month) · 3 Priya (joined today)
///   4 Ravi (long-time employee) · 5 Pending Person (not approved)
/// </summary>
public class UiCheckFixesTests : IDisposable
{
    private readonly ApiFactory _factory = new();
    private readonly HttpClient _manager;
    private static readonly DateTime Today = AppClock.TodayIst;
    private static readonly DateTime LastMonth = new DateTime(Today.Year, Today.Month, 1).AddMonths(-1);
    private static readonly DateTime TinaJoined = LastMonth.AddDays(14);                 // the 15th of last month
    private static readonly DateTime RaviLeaveDay = FirstWeekday(LastMonth.AddDays(7));   // a working day of last month

    public UiCheckFixesTests()
    {
        var users = new[]
        {
            new User { Id = 1, FullName = "Mangesh", Email = "m@test.dev", PasswordHash = "x", Role = "Manager", IsActive = true, CreatedAt = DateTime.UtcNow.AddYears(-1) },
            new User { Id = 2, FullName = "Tina", Email = "t@test.dev", PasswordHash = "x", Role = "TeamLead", IsActive = true, ManagerId = 1,
                       JoinDate = DateTime.SpecifyKind(TinaJoined, DateTimeKind.Utc) },
            new User { Id = 3, FullName = "Priya", Email = "p@test.dev", PasswordHash = "x", Role = "Developer", IsActive = true, ManagerId = 1, CreatedAt = DateTime.UtcNow },
            new User { Id = 4, FullName = "Ravi", Email = "r@test.dev", PasswordHash = "x", Role = "Developer", IsActive = true, ManagerId = 1, CreatedAt = DateTime.UtcNow.AddYears(-1) },
            new User { Id = 5, FullName = "Pending Person", Email = "n@test.dev", PasswordHash = "x", Role = "Pending", IsActive = true },
        };
        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            TestDatabase.CreateSchema(db);
            db.Users.AddRange(users);
            db.LeaveRequests.Add(new LeaveRequest { UserId = 4, FromDate = RaviLeaveDay, ToDate = RaviLeaveDay, LeaveType = "Casual", Status = "Approved", Reason = "family" });
            db.SaveChanges();
            TestDatabase.AfterSeed(db);
            var client = _factory.CreateClient();
            client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer",
                scope.ServiceProvider.GetRequiredService<JwtHelper>().GenerateAccessToken(users[0]).Token);
            _manager = client;
        }
    }

    public void Dispose() => _factory.Dispose();

    private static DateTime FirstWeekday(DateTime d)
    {
        while (d.DayOfWeek is DayOfWeek.Saturday or DayOfWeek.Sunday) d = d.AddDays(1);
        return d;
    }

    private static int Weekdays(DateTime from, DateTime to)
    {
        int n = 0;
        for (var d = from; d <= to; d = d.AddDays(1))
            if (d.DayOfWeek is not DayOfWeek.Saturday and not DayOfWeek.Sunday) n++;
        return n;
    }

    private async Task<JsonElement> Get(string url)
    {
        var r = await _manager.GetAsync(url);
        Assert.Equal(HttpStatusCode.OK, r.StatusCode);
        return JsonDocument.Parse(await r.Content.ReadAsStringAsync()).RootElement;
    }

    private static string Status(JsonElement day) => day.GetProperty("status").GetString()!;
    private static DateTime Date(JsonElement day) => day.GetProperty("date").GetDateTime().Date;

    // ── U4: absent days start at joining and end yesterday ──────────────────

    [Fact]
    public async Task Someone_who_joined_today_has_no_absent_days_this_month()
    {
        var cal = await Get($"/api/Manager/user/3/calendar?month={Today.Month}&year={Today.Year}");
        Assert.DoesNotContain(cal.EnumerateArray(), d => Status(d) == "Absent");
        Assert.All(cal.EnumerateArray().Where(d => Date(d) < Today && Date(d).DayOfWeek is not DayOfWeek.Saturday and not DayOfWeek.Sunday),
            d => Assert.Equal("NotJoined", Status(d)));

        var summary = await Get($"/api/Manager/user/3/attendance?month={Today.Month}&year={Today.Year}");
        Assert.Equal(0, summary.GetProperty("daysAbsent").GetInt32());

        var team = await Get($"/api/wfh-requests/team-monthly?month={Today.Month}&year={Today.Year}");
        var priya = team.EnumerateArray().Single(u => u.GetProperty("userId").GetInt32() == 3);
        Assert.Equal(0, priya.GetProperty("daysAbsent").GetInt32());   // was: every working day of the month
    }

    [Fact]
    public async Task Days_before_joining_are_not_absent_and_days_after_are()
    {
        var monthEnd = LastMonth.AddMonths(1).AddDays(-1);
        var cal = await Get($"/api/Manager/user/2/calendar?month={LastMonth.Month}&year={LastMonth.Year}");
        foreach (var d in cal.EnumerateArray().Where(d => Date(d).DayOfWeek is not DayOfWeek.Saturday and not DayOfWeek.Sunday))
            Assert.Equal(Date(d) < TinaJoined ? "NotJoined" : "Absent", Status(d));

        var summary = await Get($"/api/Manager/user/2/attendance?month={LastMonth.Month}&year={LastMonth.Year}");
        Assert.Equal(Weekdays(TinaJoined, monthEnd), summary.GetProperty("daysAbsent").GetInt32());
    }

    [Fact]
    public async Task Approved_leave_is_shown_as_leave_not_absent()
    {
        var monthEnd = LastMonth.AddMonths(1).AddDays(-1);
        var cal = await Get($"/api/Manager/user/4/calendar?month={LastMonth.Month}&year={LastMonth.Year}");
        Assert.Equal("Leave", Status(cal.EnumerateArray().Single(d => Date(d) == RaviLeaveDay)));

        var summary = await Get($"/api/Manager/user/4/attendance?month={LastMonth.Month}&year={LastMonth.Year}");
        Assert.Equal(Weekdays(LastMonth, monthEnd) - 1, summary.GetProperty("daysAbsent").GetInt32());

        var team = await Get($"/api/wfh-requests/team-monthly?month={LastMonth.Month}&year={LastMonth.Year}");
        var ravi = team.EnumerateArray().Single(u => u.GetProperty("userId").GetInt32() == 4);
        Assert.Equal(Weekdays(LastMonth, monthEnd) - 1, ravi.GetProperty("daysAbsent").GetInt32());
        Assert.Equal(1, ravi.GetProperty("daysOnLeave").GetInt32());
    }

    // ── U5: sign-ups waiting for a role aren't team members ─────────────────

    [Theory]
    [InlineData("/api/profile/directory")]
    [InlineData("/api/presence/team")]
    [InlineData("/api/team-calendar")]
    [InlineData("/api/Manager/users")]
    [InlineData("/api/leave/balance")]
    public async Task The_pending_account_is_not_in_team_lists(string url)
    {
        var r = await _manager.GetAsync(url);
        Assert.Equal(HttpStatusCode.OK, r.StatusCode);
        var body = await r.Content.ReadAsStringAsync();
        Assert.Contains("Ravi", body);                 // the list itself works
        Assert.DoesNotContain("Pending Person", body);
    }
}
