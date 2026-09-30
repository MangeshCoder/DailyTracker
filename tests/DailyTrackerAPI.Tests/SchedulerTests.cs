using DailyTrackerAPI.Models.Tasks;
using DailyTrackerAPI.Helpers;
using System.Reflection;
using DailyTrackerAPI.Data;
using DailyTrackerAPI.Models.Auth;
using DailyTrackerAPI.Services.Communication;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;

namespace DailyTrackerAPI.Tests;

/// <summary>
/// The hosted server restarts on every deploy; a daily reminder must still go
/// out only once per day.
/// </summary>
public class SchedulerTests : IDisposable
{
    private readonly ApiFactory _factory = new();
    public void Dispose() => _factory.Dispose();

    private Task RunJob(string jobKey, DateOnly day)
    {
        // a fresh scheduler = the app after a restart (nothing remembered in memory)
        var scheduler = new NotificationSchedulerService(_factory.Services, NullLogger<NotificationSchedulerService>.Instance);
        var run = typeof(NotificationSchedulerService).GetMethod("RunJobAsync", BindingFlags.Instance | BindingFlags.NonPublic)!;
        return (Task)run.Invoke(scheduler, new object[] { jobKey, day, CancellationToken.None })!;
    }

    [Fact]
    public async Task A_daily_reminder_is_sent_once_even_after_a_restart()
    {
        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            TestDatabase.CreateSchema(db);
            db.Users.Add(new User { Id = 1, FullName = "Priya", Email = "p@test.dev", PasswordHash = "x", Role = "Developer", IsActive = true });
            db.SaveChanges();
            TestDatabase.AfterSeed(db);
        }
        var today = DateOnly.FromDateTime(DateTime.UtcNow);

        await RunJob("LOG_REMINDER", today);
        await RunJob("LOG_REMINDER", today);                 // restarted: same day again
        await RunJob("LOG_REMINDER", today.AddDays(1));      // next day: sends again

        using var check = _factory.Services.CreateScope();
        var db2 = check.ServiceProvider.GetRequiredService<AppDbContext>();
        Assert.Equal(2, db2.Notifications.Count(n => n.UserId == 1 && n.Title.Contains("Daily Log Missing")));
        Assert.Equal(2, db2.SchedulerRuns.Count(r => r.JobKey == "LOG_REMINDER"));
    }

    [Fact]
    public async Task At_7_pm_only_people_still_checked_in_get_a_check_out_reminder()
    {
        var today = AppClock.TodayIst;
        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            TestDatabase.CreateSchema(db);
            db.Users.AddRange(
                new User { Id = 1, FullName = "Still In", Email = "a@test.dev", PasswordHash = "x", Role = "Developer", IsActive = true },
                new User { Id = 2, FullName = "Went Home", Email = "b@test.dev", PasswordHash = "x", Role = "Developer", IsActive = true },
                new User { Id = 3, FullName = "Not In", Email = "c@test.dev", PasswordHash = "x", Role = "Developer", IsActive = true });
            db.SaveChanges();
            TestDatabase.AfterSeed(db);
            db.DailyLogs.AddRange(
                new DailyLog { UserId = 1, LogDate = today, CheckInTime = DateTime.UtcNow.AddHours(-8) },
                new DailyLog { UserId = 2, LogDate = today, CheckInTime = DateTime.UtcNow.AddHours(-9), CheckOutTime = DateTime.UtcNow.AddHours(-1) });
            db.SaveChanges();
        }

        await RunJob("CHECKOUT_REMINDER", DateOnly.FromDateTime(today));

        using var check = _factory.Services.CreateScope();
        var reminded = check.ServiceProvider.GetRequiredService<AppDbContext>().Notifications
            .Where(n => n.Title.Contains("Still checked in")).Select(n => n.UserId).ToList();
        Assert.Equal(new[] { 1 }, reminded);
    }

    [Fact]
    public async Task The_morning_job_closes_every_forgotten_shift()
    {
        var day = AppClock.TodayIst.AddDays(-2);
        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            TestDatabase.CreateSchema(db);
            db.Users.Add(new User { Id = 1, FullName = "Priya", Email = "p@test.dev", PasswordHash = "x", Role = "Developer", IsActive = true });
            db.SaveChanges();
            TestDatabase.AfterSeed(db);
            db.DailyLogs.Add(new DailyLog { UserId = 1, LogDate = day, CheckInTime = AppClock.FromIst(day.AddHours(9)) });
            db.SaveChanges();
        }

        await RunJob("AUTO_CHECKOUT", DateOnly.FromDateTime(AppClock.TodayIst));

        using var check = _factory.Services.CreateScope();
        var cdb = check.ServiceProvider.GetRequiredService<AppDbContext>();
        var log = cdb.DailyLogs.Single();
        Assert.True(log.AutoCheckedOut);
        Assert.Equal(AppClock.FromIst(day.AddHours(17)), log.CheckOutTime);
        Assert.Single(cdb.Notifications.Where(n => n.UserId == 1 && n.Title.Contains("didn't check out")));
    }
}

public class PostgresConnectionTests
{
    [Fact]
    public void Neon_style_urls_are_converted()
    {
        var cs = new Npgsql.NpgsqlConnectionStringBuilder(DailyTrackerAPI.Helpers.PostgresConnection.Normalize(
            "postgresql://neondb_owner:p%40ss%3Aword@ep-cool-sun-123.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require"));
        Assert.Equal("ep-cool-sun-123.ap-southeast-1.aws.neon.tech", cs.Host);
        Assert.Equal(5432, cs.Port);
        Assert.Equal("neondb", cs.Database);
        Assert.Equal("neondb_owner", cs.Username);
        Assert.Equal("p@ss:word", cs.Password);
        Assert.Equal(Npgsql.SslMode.Require, cs.SslMode);
        Assert.Equal(Npgsql.ChannelBinding.Require, cs.ChannelBinding);
    }

    [Fact]
    public void Key_value_strings_are_left_alone()
    {
        const string plain = "Host=localhost;Database=dailytracker;Username=postgres";
        Assert.Equal(plain, DailyTrackerAPI.Helpers.PostgresConnection.Normalize(plain));
    }
}
