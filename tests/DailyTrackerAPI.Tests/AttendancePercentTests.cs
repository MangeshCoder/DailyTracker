using System.Net;
using System.Net.Http.Headers;
using System.Text.Json;
using DailyTrackerAPI.Data;
using DailyTrackerAPI.Helpers;
using DailyTrackerAPI.Models.Auth;
using DailyTrackerAPI.Models.HR;
using DailyTrackerAPI.Models.Tasks;
using Microsoft.Extensions.DependencyInjection;

namespace DailyTrackerAPI.Tests;

/// <summary>
/// Team Dashboard → Monthly Stats (30 Sep 2026): someone with 1 day in and 1 day absent
/// showed 100%, because a check-in from before their recorded join date counted as
/// attended but not as expected. Attendance % is now "days came in ÷ days expected",
/// both counted over the same days, and counting starts at the first check-in if that
/// was before the join date. All cases use last month so the whole month is in the past.
///   1 Manager · 2 Long-timer (2 office + 1 WFH at month end) · 3 Early starter (checked in
///   the day before his join date, then absent) · 4 New joiner (joined and came in on the
///   last day) · 5 Worked only on a day later made a public holiday
/// </summary>
public class AttendancePercentTests : IDisposable
{
    private readonly ApiFactory _factory = new();
    private readonly HttpClient _manager;
    private static readonly DateTime LastMonth = new DateTime(AppClock.TodayIst.Year, AppClock.TodayIst.Month, 1).AddMonths(-1);
    private static readonly DateTime MonthEnd = LastMonth.AddMonths(1).AddDays(-1);
    private static readonly DateTime LastDay = PrevWeekday(MonthEnd);            // last working day
    private static readonly DateTime DayBefore = PrevWeekday(LastDay.AddDays(-1));
    private static readonly DateTime TwoBefore = PrevWeekday(DayBefore.AddDays(-1));
    private static readonly DateTime HolidayDay = PrevWeekday(LastMonth.AddDays(9));

    public AttendancePercentTests()
    {
        var yearAgo = DateTime.UtcNow.AddYears(-1);
        var users = new[]
        {
            new User { Id = 1, FullName = "Boss", Email = "b@test.dev", PasswordHash = "x", Role = "Manager", IsActive = true, CreatedAt = yearAgo },
            new User { Id = 2, FullName = "Long Timer", Email = "l@test.dev", PasswordHash = "x", Role = "Developer", IsActive = true, ManagerId = 1, CreatedAt = yearAgo },
            new User { Id = 3, FullName = "Early Starter", Email = "e@test.dev", PasswordHash = "x", Role = "Developer", IsActive = true, ManagerId = 1,
                       CreatedAt = yearAgo, JoinDate = DateTime.SpecifyKind(LastDay, DateTimeKind.Utc) },
            new User { Id = 4, FullName = "New Joiner", Email = "n@test.dev", PasswordHash = "x", Role = "Developer", IsActive = true, ManagerId = 1,
                       CreatedAt = yearAgo, JoinDate = DateTime.SpecifyKind(LastDay, DateTimeKind.Utc) },
            new User { Id = 5, FullName = "Holiday Worker", Email = "h@test.dev", PasswordHash = "x", Role = "Developer", IsActive = true, ManagerId = 1, CreatedAt = yearAgo },
        };
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        TestDatabase.CreateSchema(db);
        db.Users.AddRange(users);
        db.DailyLogs.AddRange(
            Log(2, TwoBefore, "Present"), Log(2, DayBefore, "Present"), Log(2, LastDay, "WFH"),
            Log(3, DayBefore, "Present"),
            Log(4, LastDay, "Present"),
            Log(5, HolidayDay, "Present"));   // checked in as normal, holiday declared afterwards
        db.Holidays.Add(new Holiday { Date = HolidayDay, Name = "Declared later", Type = "Public", Year = HolidayDay.Year });
        db.SaveChanges();
        TestDatabase.AfterSeed(db);
        _manager = _factory.CreateClient();
        _manager.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer",
            scope.ServiceProvider.GetRequiredService<JwtHelper>().GenerateAccessToken(users[0]).Token);
    }

    public void Dispose() => _factory.Dispose();

    private static DailyLog Log(int userId, DateTime day, string status) =>
        new() { UserId = userId, LogDate = day, CheckInTime = DateTime.SpecifyKind(day.AddHours(4), DateTimeKind.Utc), DayStatus = status };

    private static DateTime PrevWeekday(DateTime d)
    {
        while (d.DayOfWeek is DayOfWeek.Saturday or DayOfWeek.Sunday) d = d.AddDays(-1);
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

    private async Task<JsonElement> Member(int userId)
    {
        var stats = await Get($"/api/Manager/team/monthly?month={LastMonth.Month}&year={LastMonth.Year}");
        return stats.GetProperty("members").EnumerateArray().Single(m => m.GetProperty("user").GetProperty("id").GetInt32() == userId);
    }

    private static (int attended, int expected, int absent, double pct) Numbers(JsonElement m) =>
        (m.GetProperty("daysAttended").GetInt32(), m.GetProperty("daysExpected").GetInt32(),
         m.GetProperty("daysAbsent").GetInt32(), m.GetProperty("attendancePercentage").GetDouble());

    [Fact]
    public async Task Long_timer_is_measured_against_every_working_day_of_the_month()
    {
        var m = await Member(2);
        int expected = Weekdays(LastMonth, MonthEnd) - 1;   // minus the public holiday
        Assert.Equal((3, expected, expected - 3, Math.Round(300.0 / expected, 1)), Numbers(m));
        Assert.Equal(2, m.GetProperty("daysPresent").GetInt32());   // office days; WFH is separate, not double counted
        Assert.Equal(1, m.GetProperty("daysWFH").GetInt32());
    }

    [Fact]
    public async Task A_day_in_and_a_day_absent_is_fifty_percent_not_hundred()
    {
        // checked in the day before the recorded join date, then missed the join date itself
        Assert.Equal((1, 2, 1, 50.0), Numbers(await Member(3)));

        var cal = await Get($"/api/Manager/user/3/calendar?month={LastMonth.Month}&year={LastMonth.Year}");
        string StatusOn(DateTime d) => cal.EnumerateArray().Single(x => x.GetProperty("date").GetDateTime().Date == d).GetProperty("status").GetString()!;
        Assert.Equal("Present", StatusOn(DayBefore));
        Assert.Equal("Absent", StatusOn(LastDay));
        Assert.Equal("NotJoined", StatusOn(TwoBefore));

        var report = await Get($"/api/Manager/user/3/report?from={LastMonth:yyyy-MM-dd}&to={MonthEnd:yyyy-MM-dd}");
        Assert.Equal(50.0, report.GetProperty("attendancePercentage").GetDouble());

        var team = await Get($"/api/wfh-requests/team-monthly?month={LastMonth.Month}&year={LastMonth.Year}");
        var row = team.EnumerateArray().Single(u => u.GetProperty("userId").GetInt32() == 3);
        Assert.Equal(1, row.GetProperty("daysAbsent").GetInt32());
        Assert.Equal(50.0, row.GetProperty("attendancePercentage").GetDouble());
    }

    [Fact]
    public async Task New_joiner_who_came_in_on_every_day_since_joining_is_hundred_percent()
    {
        Assert.Equal((1, 1, 0, 100.0), Numbers(await Member(4)));
    }

    [Fact]
    public async Task Work_on_a_public_holiday_does_not_count_towards_attendance()
    {
        int expected = Weekdays(LastMonth, MonthEnd) - 1;   // the holiday isn't expected
        Assert.Equal((0, expected, expected, 0.0), Numbers(await Member(5)));
    }
}
