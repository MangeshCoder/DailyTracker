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
/// Onboarding (30 Sep 2026): approving a new account starts a getting-started
/// checklist; app steps tick themselves; the employee ticks their own steps, the
/// manager / team lead the rest and chooses a buddy; all done → finished.
///   1 Mangesh (Manager) · 2 Tina (Team Lead) · 3 Neha (new, Pending) · 4 Ravi (reports to Mangesh)
///   5 Om (Team Lead, nobody reports to him) · 6 Priya (joined last week, reports to Tina)
/// </summary>
public class OnboardingTests : IDisposable
{
    private readonly ApiFactory _factory = new();
    private readonly Dictionary<int, User> _users = new();
    private readonly HttpClient _manager, _lead, _ravi, _om;
    private HttpClient _neha;

    public OnboardingTests()
    {
        _users[1] = new User { Id = 1, FullName = "Mangesh", Email = "m@test.dev", PasswordHash = "x", Role = "Manager", IsActive = true, CreatedAt = DateTime.UtcNow.AddYears(-2) };
        _users[2] = new User { Id = 2, FullName = "Tina", Email = "t@test.dev", PasswordHash = "x", Role = "TeamLead", IsActive = true, ManagerId = 1, CreatedAt = DateTime.UtcNow.AddYears(-1) };
        _users[3] = new User { Id = 3, FullName = "Neha", Email = "n@test.dev", PasswordHash = "x", Role = "Pending", IsActive = true };
        _users[4] = new User { Id = 4, FullName = "Ravi", Email = "r@test.dev", PasswordHash = "x", Role = "Developer", IsActive = true, ManagerId = 1, CreatedAt = DateTime.UtcNow.AddYears(-1) };
        _users[5] = new User { Id = 5, FullName = "Om", Email = "o@test.dev", PasswordHash = "x", Role = "TeamLead", IsActive = true, ManagerId = 1, CreatedAt = DateTime.UtcNow.AddYears(-1) };
        _users[6] = new User { Id = 6, FullName = "Priya", Email = "p@test.dev", PasswordHash = "x", Role = "Developer", IsActive = true, ManagerId = 2, CreatedAt = DateTime.UtcNow.AddDays(-7) };
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
        _neha = ClientFor(_users[3]);
        _ravi = ClientFor(_users[4]);
        _om = ClientFor(_users[5]);
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

    private static JsonElement Step(JsonElement plan, string title) =>
        plan.GetProperty("tasks").EnumerateArray().Single(t => t.GetProperty("title").GetString()!.StartsWith(title));

    private async Task<JsonElement> ApproveNeha()
    {
        (await _manager.PostAsJsonAsync("/api/auth/assign-role", new { userId = 3, role = "Developer" })).EnsureSuccessStatusCode();
        _neha = ClientFor(Db(db => db.Users.AsNoTracking().Single(u => u.Id == 3)));   // a fresh sign-in: no longer Pending
        return await Json(await _neha.GetAsync("/api/onboarding/my"));
    }

    [Fact]
    public async Task Approving_a_new_account_starts_the_checklist_and_app_steps_tick_themselves()
    {
        Assert.Equal(HttpStatusCode.NoContent, (await _ravi.GetAsync("/api/onboarding/my")).StatusCode);   // old hands have none

        var plan = await ApproveNeha();
        Assert.Equal(10, plan.GetProperty("totalCount").GetInt32());
        Assert.Equal(0, plan.GetProperty("doneCount").GetInt32());
        Assert.Equal("/face-setup", Step(plan, "Set up face check-in").GetProperty("link").GetString());
        Assert.True(Db(db => db.Notifications.Any(n => n.UserId == 3 && n.Title.Contains("Welcome"))));

        Db(db =>
        {
            var neha = db.Users.Single(u => u.Id == 3);
            neha.Phone = "98200 00000"; neha.Department = "Engineering"; neha.Designation = "Developer";
            neha.FaceRegistered = true;
            db.Documents.Add(new Document { OwnerUserId = 3, UploadedByUserId = 3, Title = "Aadhaar", FileName = "a.pdf", FilePath = "x/a.pdf", MimeType = "application/pdf" });
            db.UserTwoFactors.Add(new UserTwoFactor { UserId = 3, EmailOtpEnabled = true });
            db.DailyLogs.Add(new DailyLog { UserId = 3, LogDate = AppClock.TodayIst, CheckInTime = DateTime.UtcNow, DayStatus = "Present" });
            return db.SaveChanges();
        });
        plan = await Json(await _neha.GetAsync("/api/onboarding/my"));
        foreach (var step in new[] { "Complete your profile", "Set up face check-in", "Turn on two-step", "Upload your ID", "Check in for your first day" })
            Assert.True(Step(plan, step).GetProperty("done").GetBoolean(), step);
        Assert.False(Step(plan, "Choose a buddy").GetProperty("done").GetBoolean());
        Assert.Equal(5, plan.GetProperty("doneCount").GetInt32());
    }

    [Fact]
    public async Task The_employee_ticks_their_own_steps_but_not_the_managers_or_the_apps()
    {
        var plan = await ApproveNeha();
        var mine = Step(plan, "Read the feature guide").GetProperty("id").GetInt32();
        var managers = Step(plan, "Laptop, email").GetProperty("id").GetInt32();
        var app = Step(plan, "Set up face").GetProperty("id").GetInt32();

        Assert.True(Step(plan, "Read the feature guide").GetProperty("canTick").GetBoolean());
        Assert.False(Step(plan, "Laptop, email").GetProperty("canTick").GetBoolean());

        var ok = await _neha.PutAsJsonAsync($"/api/onboarding/tasks/{mine}", new { done = true });
        Assert.True(Step(await Json(ok), "Read the feature guide").GetProperty("done").GetBoolean());
        Assert.Equal(HttpStatusCode.Forbidden, (await _neha.PutAsJsonAsync($"/api/onboarding/tasks/{managers}", new { done = true })).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await _neha.PutAsJsonAsync($"/api/onboarding/tasks/{app}", new { done = true })).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await _ravi.PutAsJsonAsync($"/api/onboarding/tasks/{mine}", new { done = false })).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await _neha.GetAsync("/api/onboarding")).StatusCode);
    }

    [Fact]
    public async Task A_team_lead_starts_onboarding_for_a_recent_joiner_in_their_team_and_chooses_a_buddy()
    {
        var candidates = await Json(await _lead.GetAsync("/api/onboarding/candidates"));
        Assert.Equal(new[] { "Priya" }, candidates.EnumerateArray().Select(c => c.GetProperty("fullName").GetString()));
        Assert.Equal(0, (await Json(await _om.GetAsync("/api/onboarding/candidates"))).GetArrayLength());
        Assert.Equal(HttpStatusCode.Forbidden, (await _om.PostAsJsonAsync("/api/onboarding", new { userId = 6 })).StatusCode);

        var started = await _lead.PostAsJsonAsync("/api/onboarding", new { userId = 6, buddyUserId = 4 });
        Assert.Equal(HttpStatusCode.OK, started.StatusCode);
        var plan = await Json(started);
        Assert.Equal("Ravi", plan.GetProperty("buddyName").GetString());
        Assert.True(Step(plan, "Choose a buddy").GetProperty("done").GetBoolean());
        Assert.True(Db(db => db.Notifications.Any(n => n.UserId == 4 && n.Title.Contains("buddy"))));

        Assert.Equal(HttpStatusCode.BadRequest, (await _lead.PostAsJsonAsync("/api/onboarding", new { userId = 6 })).StatusCode);   // already has one
        var id = plan.GetProperty("id").GetInt32();
        Assert.Equal(HttpStatusCode.BadRequest, (await _lead.PutAsJsonAsync($"/api/onboarding/{id}/buddy", new { buddyUserId = 6 })).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await _om.PutAsJsonAsync($"/api/onboarding/{id}/buddy", new { buddyUserId = 1 })).StatusCode);
        Assert.Empty((await Json(await _om.GetAsync("/api/onboarding"))).EnumerateArray());
        Assert.Single((await Json(await _manager.GetAsync("/api/onboarding"))).EnumerateArray());

        // no buddy again → the step opens again
        plan = await Json(await _lead.PutAsJsonAsync($"/api/onboarding/{id}/buddy", new { buddyUserId = (int?)null }));
        Assert.False(Step(plan, "Choose a buddy").GetProperty("done").GetBoolean());
    }

    [Fact]
    public async Task A_pending_account_cannot_be_onboarded_until_approved()
    {
        var r = await _manager.PostAsJsonAsync("/api/onboarding", new { userId = 3 });
        Assert.Equal(HttpStatusCode.BadRequest, r.StatusCode);
    }

    [Fact]
    public async Task When_every_step_is_done_the_checklist_is_finished_and_a_new_step_reopens_it()
    {
        var plan = await ApproveNeha();
        var id = plan.GetProperty("id").GetInt32();
        Db(db =>
        {
            var neha = db.Users.Single(u => u.Id == 3);
            neha.Phone = "1"; neha.Department = "Eng"; neha.Designation = "Dev"; neha.FaceRegistered = true;
            db.Documents.Add(new Document { OwnerUserId = 3, UploadedByUserId = 1, Title = "PAN", FileName = "p.pdf", FilePath = "x/p.pdf", MimeType = "application/pdf" });
            db.UserTwoFactors.Add(new UserTwoFactor { UserId = 3, TotpEnabled = true });
            db.DailyLogs.Add(new DailyLog { UserId = 3, LogDate = AppClock.TodayIst, CheckInTime = DateTime.UtcNow, DayStatus = "Present" });
            return db.SaveChanges();
        });
        await _manager.PutAsJsonAsync($"/api/onboarding/{id}/buddy", new { buddyUserId = 4 });
        foreach (var t in plan.GetProperty("tasks").EnumerateArray().Where(t => t.GetProperty("kind").GetString() == "Manual"))
            (await _manager.PutAsJsonAsync($"/api/onboarding/tasks/{t.GetProperty("id").GetInt32()}", new { done = true })).EnsureSuccessStatusCode();

        plan = await Json(await _neha.GetAsync("/api/onboarding/my"));
        Assert.Equal(plan.GetProperty("totalCount").GetInt32(), plan.GetProperty("doneCount").GetInt32());
        Assert.NotEqual(JsonValueKind.Null, plan.GetProperty("completedAt").ValueKind);
        Assert.True(Db(db => db.Notifications.Any(n => n.UserId == 1 && n.Title.Contains("Onboarding complete"))));

        plan = await Json(await _manager.PostAsJsonAsync($"/api/onboarding/{id}/tasks", new { title = "Security training", owner = "Employee" }));
        Assert.Equal(JsonValueKind.Null, plan.GetProperty("completedAt").ValueKind);
        var added = Step(plan, "Security training").GetProperty("id").GetInt32();
        Assert.Equal(HttpStatusCode.OK, (await _manager.DeleteAsync($"/api/onboarding/tasks/{added}")).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await _manager.PostAsJsonAsync($"/api/onboarding/{id}/tasks", new { title = " ", owner = "Employee" })).StatusCode);

        Assert.Equal(HttpStatusCode.OK, (await _manager.DeleteAsync($"/api/onboarding/{id}")).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await _neha.GetAsync("/api/onboarding/my")).StatusCode);
    }
}

