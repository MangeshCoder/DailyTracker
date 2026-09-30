using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using DailyTrackerAPI.Data;
using DailyTrackerAPI.Helpers;
using DailyTrackerAPI.Models.Tasks;
using DailyTrackerAPI.Models.Auth;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace DailyTrackerAPI.Tests;

/// <summary>
/// The office runs on India time (30 Sep 2026): a 10:14 AM check-in showed as
/// 04:44 AM in AI Help — the UTC time printed as it was. Every time the API sends
/// is now marked UTC ("…Z") and every time written into text is India time.
///   1 Mangesh (Manager) · 2 Priya (reports to Mangesh)
/// </summary>
public class IndiaTimeTests : IDisposable
{
    private readonly ApiFactory _factory = new();
    private readonly HttpClient _manager, _priya;
    private static readonly DateTime CheckIn = AppClock.FromIst(AppClock.TodayIst.AddHours(10).AddMinutes(14));   // 04:44 UTC

    public IndiaTimeTests()
    {
        var manager = new User { Id = 1, FullName = "Mangesh", Email = "m@test.dev", PasswordHash = "x", Role = "Manager", IsActive = true };
        var priya = new User { Id = 2, FullName = "Priya", Email = "p@test.dev", PasswordHash = "x", Role = "Developer", IsActive = true, ManagerId = 1 };
        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            TestDatabase.CreateSchema(db);
            db.Users.AddRange(manager, priya);
            db.SaveChanges();
            db.DailyLogs.Add(new DailyLog { UserId = 2, LogDate = AppClock.TodayIst, CheckInTime = CheckIn, DayStatus = "Present" });
            db.SaveChanges();
            TestDatabase.AfterSeed(db);
        }
        _manager = ClientFor(manager);
        _priya = ClientFor(priya);
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

    private T Db<T>(Func<AppDbContext, T> read)
    {
        using var scope = _factory.Services.CreateScope();
        return read(scope.ServiceProvider.GetRequiredService<AppDbContext>());
    }

    [Fact]
    public async Task Times_read_back_from_the_database_are_sent_as_UTC_and_dates_stay_plain_dates()
    {
        var json = await _priya.GetFromJsonAsync<JsonElement>("/api/DailyLog/today");
        var checkIn = json.GetProperty("checkInTime").GetString()!;
        Assert.EndsWith("Z", checkIn);                                                     // the browser shows it in India time
        Assert.Equal(CheckIn, DateTime.Parse(checkIn).ToUniversalTime());
        Assert.Equal(AppClock.TodayIst.ToString("yyyy-MM-dd'T'00:00:00"), json.GetProperty("logDate").GetString());   // no zone on a date
    }

    [Fact]
    public async Task AI_Help_says_the_check_in_time_in_India_time()
    {
        var r = await _priya.PostAsJsonAsync("/api/AiChat/send", new { message = "How many hours have I worked today?", history = Array.Empty<object>() });
        var reply = (await r.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("reply").GetString()!;
        Assert.Contains("10:14 AM", reply);
        Assert.DoesNotContain("04:44", reply);

        var summary = await _priya.GetStringAsync("/api/AiChat/context-summary");      // what the AI model is given
        Assert.Contains("10:14 AM", summary);
        Assert.DoesNotContain("04:44", summary);
    }

    [Fact]
    public async Task The_team_daily_view_shows_India_time()
    {
        var body = await _manager.GetStringAsync("/api/Manager/team/daily");
        Assert.Contains("10:14 AM", body);
        Assert.DoesNotContain("04:44", body);
    }

    [Theory]
    [InlineData("2026-10-05T15:00:00")]          // no zone: the time picked in India
    [InlineData("2026-10-05T15:00:00+05:30")]    // what the page sends now
    [InlineData("2026-10-05T09:30:00Z")]         // already UTC
    public async Task A_meeting_at_3_PM_is_saved_as_3_PM_India_time(string scheduledAt)
    {
        var r = await _manager.PostAsJsonAsync("/api/meetings", new { title = "Sprint review", meetingType = "Review", scheduledAt, durationMinutes = 30, isRecurring = false, attendeeIds = new[] { 2 } });
        r.EnsureSuccessStatusCode();
        Assert.Equal(new DateTime(2026, 10, 5, 9, 30, 0), Db(db => db.Meetings.Single().ScheduledAt));

        var list = await _priya.GetFromJsonAsync<JsonElement>("/api/meetings?month=10&year=2026");
        Assert.Equal("2026-10-05T09:30:00Z", list.EnumerateArray().Single().GetProperty("scheduledAt").GetString());
    }
}
