using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using DailyTrackerAPI.Data;
using DailyTrackerAPI.Helpers;
using DailyTrackerAPI.Models.Auth;
using DailyTrackerAPI.Services.Auth;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace DailyTrackerAPI.Tests;

/// <summary>
/// "Reports to" (8 Oct 2026): approving a sign-up used to always link them to the approving manager, so team leads
/// never got their people's requests. Now the manager picks the Team Lead / Manager, and can change it later.
///   1 Mangesh (Manager) · 2 Tina (Team Lead) · 3 Priya (sign-up) · 4 Ravi (Tina's team) · 5 Neha (Team Lead under Tina)
///   6 Old (inactive Team Lead) · 7 Amit (Developer, Mangesh's team)
/// </summary>
public class ReportsToTests : IDisposable
{
    private readonly ApiFactory _factory = new();
    private readonly HttpClient _mangesh, _tina, _ravi;

    public ReportsToTests()
    {
        var users = new[]
        {
            new User { Id = 1, FullName = "Mangesh", Email = "m@test.dev", PasswordHash = "x", Role = "Manager", IsActive = true },
            new User { Id = 2, FullName = "Tina", Email = "t@test.dev", PasswordHash = "x", Role = "TeamLead", IsActive = true, ManagerId = 1 },
            new User { Id = 3, FullName = "Priya", Email = "p@test.dev", PasswordHash = "x", Role = "Pending", IsActive = true },
            new User { Id = 4, FullName = "Ravi", Email = "r@test.dev", PasswordHash = "x", Role = "Developer", IsActive = true, ManagerId = 2 },
            new User { Id = 5, FullName = "Neha", Email = "n@test.dev", PasswordHash = "x", Role = "TeamLead", IsActive = true, ManagerId = 2 },
            new User { Id = 6, FullName = "Old", Email = "o@test.dev", PasswordHash = "x", Role = "TeamLead", IsActive = false, ManagerId = 1 },
            new User { Id = 7, FullName = "Amit", Email = "a@test.dev", PasswordHash = "x", Role = "Developer", IsActive = true, ManagerId = 1 },
        };
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        TestDatabase.CreateSchema(db);
        db.Users.AddRange(users);
        db.SaveChanges();
        TestDatabase.AfterSeed(db);
        var jwt = scope.ServiceProvider.GetRequiredService<JwtHelper>();
        HttpClient Client(User u) { var c = _factory.CreateClient(); c.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", jwt.GenerateAccessToken(u).Token); return c; }
        (_mangesh, _tina, _ravi) = (Client(users[0]), Client(users[1]), Client(users[3]));
    }

    public void Dispose() => _factory.Dispose();

    private T Db<T>(Func<AppDbContext, T> f)
    {
        using var scope = _factory.Services.CreateScope();
        return f(scope.ServiceProvider.GetRequiredService<AppDbContext>());
    }
    private int? ManagerOf(int id) => Db(db => db.Users.AsNoTracking().Single(u => u.Id == id).ManagerId);
    private HashSet<int>? TeamOf(int actor)
    {
        using var scope = _factory.Services.CreateScope();
        return scope.ServiceProvider.GetRequiredService<ITeamScope>().ManagedUserIdsAsync(actor).GetAwaiter().GetResult();
    }

    private static async Task<string> Refused(HttpResponseMessage r)
    {
        Assert.Equal(HttpStatusCode.BadRequest, r.StatusCode);
        return JsonDocument.Parse(await r.Content.ReadAsStringAsync()).RootElement.GetProperty("message").GetString()!;
    }

    [Fact]
    public async Task Approving_a_sign_up_can_put_them_in_a_team_leads_team()
    {
        var r = await _mangesh.PostAsJsonAsync("/api/auth/assign-role", new { userId = 3, role = "Developer", managerId = 2 });
        Assert.True(r.IsSuccessStatusCode, await r.Content.ReadAsStringAsync());
        Assert.Equal(2, ManagerOf(3));
        Assert.Contains(3, TeamOf(2)!);          // Tina now sees Priya's requests
    }

    [Fact]
    public async Task Without_a_choice_they_report_to_the_approving_manager_as_before()
    {
        (await _mangesh.PostAsJsonAsync("/api/auth/assign-role", new { userId = 3, role = "Developer" })).EnsureSuccessStatusCode();
        Assert.Equal(1, ManagerOf(3));
    }

    [Theory]
    [InlineData(7, "Manager or a Team Lead")]   // a developer
    [InlineData(6, "isn't an active user")]       // an inactive team lead
    [InlineData(3, "themselves")]
    [InlineData(999, "isn't an active user")]
    public async Task Only_an_active_manager_or_team_lead_can_be_chosen(int managerId, string why)
    {
        Assert.Contains(why, await Refused(await _mangesh.PostAsJsonAsync("/api/auth/assign-role", new { userId = 3, role = "Developer", managerId })));
        Assert.Equal("Pending", Db(db => db.Users.AsNoTracking().Single(u => u.Id == 3).Role));   // nothing changed
    }

    [Fact]
    public async Task A_manager_can_change_who_someone_reports_to_later()
    {
        var r = await _mangesh.PutAsJsonAsync("/api/auth/users/7/reports-to", new { managerId = 2 });
        Assert.True(r.IsSuccessStatusCode, await r.Content.ReadAsStringAsync());
        Assert.Equal("Tina", JsonDocument.Parse(await r.Content.ReadAsStringAsync()).RootElement.GetProperty("managerName").GetString());
        Assert.Equal(2, ManagerOf(7));
        Assert.Contains(7, TeamOf(2)!);

        // the manager's user list shows it
        var list = JsonDocument.Parse(await _mangesh.GetStringAsync("/api/manager/users")).RootElement;
        Assert.Equal(2, list.EnumerateArray().Single(u => u.GetProperty("id").GetInt32() == 7).GetProperty("managerId").GetInt32());
    }

    [Fact]
    public async Task Reports_to_changes_are_checked()
    {
        Assert.Equal(HttpStatusCode.Forbidden, (await _tina.PutAsJsonAsync("/api/auth/users/4/reports-to", new { managerId = 5 })).StatusCode);   // team leads can't
        Assert.Equal(HttpStatusCode.Forbidden, (await _ravi.PutAsJsonAsync("/api/auth/users/4/reports-to", new { managerId = 1 })).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await _mangesh.PutAsJsonAsync("/api/auth/users/3/reports-to", new { managerId = 2 })).StatusCode); // still a sign-up
        Assert.Contains("Managers don't report", await Refused(await _mangesh.PutAsJsonAsync("/api/auth/users/1/reports-to", new { managerId = 2 })));
        Assert.Contains("Manager or a Team Lead", await Refused(await _mangesh.PutAsJsonAsync("/api/auth/users/4/reports-to", new { managerId = 7 })));
        // Neha reports to Tina, so Tina can't report to Neha
        Assert.Contains("loop", await Refused(await _mangesh.PutAsJsonAsync("/api/auth/users/2/reports-to", new { managerId = 5 })));
        // the profile edit uses the same rule
        Assert.Contains("loop", await Refused(await _mangesh.PutAsJsonAsync("/api/profile/2/admin", new { managerId = 5 })));
        Assert.Equal(1, ManagerOf(2));
    }

    [Fact]
    public async Task When_a_team_lead_becomes_a_developer_their_people_move_up()
    {
        (await _mangesh.PostAsJsonAsync("/api/auth/assign-role", new { userId = 2, role = "Developer" })).EnsureSuccessStatusCode();
        Assert.Equal(1, ManagerOf(4));   // Ravi and Neha now report to Mangesh, not to a developer
        Assert.Equal(1, ManagerOf(5));
        Assert.Equal(1, ManagerOf(2));
    }

    private static DateTime NextWeekday(int daysAhead)
    {
        var d = AppClock.TodayIst.AddDays(daysAhead);
        while (d.DayOfWeek is DayOfWeek.Saturday or DayOfWeek.Sunday) d = d.AddDays(1);
        return d;
    }

    [Fact]
    public async Task The_manager_still_sees_people_who_report_to_a_team_lead_in_the_attendance_hub()
    {
        var day = NextWeekday(3).ToString("yyyy-MM-dd");
        var r = await _ravi.PostAsJsonAsync("/api/wfh-requests", new { requestType = "WFH", requestDate = day, reason = "Plumber visit" });
        Assert.True(r.IsSuccessStatusCode, await r.Content.ReadAsStringAsync());

        // pending WFH: Ravi reports to Tina, yet the manager can decide it
        var pending = JsonDocument.Parse(await _mangesh.GetStringAsync("/api/wfh-requests/pending")).RootElement;
        Assert.Contains(pending.EnumerateArray(), x => x.GetProperty("userId").GetInt32() == 4);

        static HashSet<int> Members(JsonElement e) =>
            e.GetProperty("members").EnumerateArray().Select(m => m.GetProperty("userId").GetInt32()).ToHashSet();
        // today's presence: the manager sees everyone (not sign-ups or nobody else), Tina sees her own people
        var all = Members(JsonDocument.Parse(await _mangesh.GetStringAsync("/api/wfh-requests/team-status")).RootElement);
        Assert.Equal(new HashSet<int> { 1, 2, 4, 5, 7 }, all);    // not the sign-up (3) or Old, who has left (6)
        var tinas = Members(JsonDocument.Parse(await _tina.GetStringAsync("/api/wfh-requests/team-status")).RootElement);
        Assert.Equal(new HashSet<int> { 2, 4, 5 }, tinas);

        // the monthly matrix: everyone still here; Old (left, no days this month) isn't listed
        var month = AppClock.TodayIst;
        var monthly = JsonDocument.Parse(await _mangesh.GetStringAsync($"/api/wfh-requests/team-monthly?month={month.Month}&year={month.Year}")).RootElement
            .EnumerateArray().Select(m => m.GetProperty("userId").GetInt32()).ToHashSet();
        Assert.Equal(new HashSet<int> { 1, 2, 4, 5, 7 }, monthly);
    }

    [Fact]
    public async Task Someone_who_left_still_shows_in_the_months_they_worked()
    {
        var day = AppClock.TodayIst;
        Db(db =>
        {
            db.DailyLogs.Add(new DailyTrackerAPI.Models.Tasks.DailyLog
            {
                UserId = 6, LogDate = day, DayStatus = "Present",
                CheckInTime = day.AddHours(4), CheckOutTime = day.AddHours(12), TotalWorkMinutes = 420, CreatedAt = day.AddHours(4),
            });
            return db.SaveChanges();
        });
        var monthly = JsonDocument.Parse(await _mangesh.GetStringAsync($"/api/wfh-requests/team-monthly?month={day.Month}&year={day.Year}")).RootElement
            .EnumerateArray().Select(m => m.GetProperty("userId").GetInt32()).ToHashSet();
        Assert.Contains(6, monthly);
        // …but not in today's presence: they can't check in any more
        var today = JsonDocument.Parse(await _mangesh.GetStringAsync("/api/wfh-requests/team-status")).RootElement
            .GetProperty("members").EnumerateArray().Select(m => m.GetProperty("userId").GetInt32());
        Assert.DoesNotContain(6, today);
    }
}
