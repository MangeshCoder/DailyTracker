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
