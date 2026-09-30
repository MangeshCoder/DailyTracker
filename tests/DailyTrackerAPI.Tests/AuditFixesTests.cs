using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using DailyTrackerAPI.Data;
using DailyTrackerAPI.Helpers;
using DailyTrackerAPI.Models.Auth;
using DailyTrackerAPI.Models.HR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace DailyTrackerAPI.Tests;

/// <summary>
/// Everything found in the full audit (30 Sep 2026), each as a test so it can't come back.
///   1 Mangesh (Manager) · 2 Tina (Team Lead) · 3 Priya (Developer, reports to Tina)
///   4 Ravi (Developer, reports to Mangesh — NOT Tina's) · 5 Pending Person (not approved)
/// </summary>
public class AuditFixesTests : IDisposable
{
    private readonly ApiFactory _factory = new();
    private readonly Dictionary<int, User> _users = new();
    private readonly HttpClient _manager, _lead, _priya, _ravi;

    // the office (appsettings.json CompanyLocation)
    private const double OfficeLat = 18.738089228557875, OfficeLng = 73.67283053582766;

    public AuditFixesTests()
    {
        _users[1] = new User { Id = 1, FullName = "Mangesh", Email = "m@test.dev", PasswordHash = "x", Role = "Manager", IsActive = true };
        _users[2] = new User { Id = 2, FullName = "Tina", Email = "t@test.dev", PasswordHash = "x", Role = "TeamLead", IsActive = true, ManagerId = 1 };
        _users[3] = new User { Id = 3, FullName = "Priya", Email = "p@test.dev", PasswordHash = "x", Role = "Developer", IsActive = true, ManagerId = 2 };
        _users[4] = new User { Id = 4, FullName = "Ravi", Email = "r@test.dev", PasswordHash = "x", Role = "Developer", IsActive = true, ManagerId = 1 };
        _users[5] = new User { Id = 5, FullName = "Pending Person", Email = "n@test.dev", PasswordHash = "x", Role = "Pending", IsActive = true };
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

    private static async Task<JsonElement> Json(HttpResponseMessage r) =>
        JsonDocument.Parse(await r.Content.ReadAsStringAsync()).RootElement;

    private static async Task<string> Message(HttpResponseMessage r) =>
        (await Json(r)).GetProperty("message").GetString() ?? "";

    private static Task<HttpResponseMessage> CheckIn(HttpClient c) =>
        c.PostAsJsonAsync("/api/DailyLog/checkin", new { dayStatus = "Present", latitude = OfficeLat, longitude = OfficeLng });

    // ── F26: a Team Lead manages only their own reports ─────────────────────

    [Fact]
    public async Task A_team_lead_sees_their_own_reports_but_not_the_rest_of_the_company()
    {
        Assert.Equal(HttpStatusCode.OK, (await _lead.GetAsync("/api/Manager/user/3/report")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await _lead.GetAsync("/api/Manager/user/4/report")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await _lead.GetAsync("/api/Manager/user/4/attendance")).StatusCode);

        var daily = await Json(await _lead.GetAsync("/api/Manager/team/daily"));
        var names = daily.GetProperty("members").EnumerateArray().Select(m => m.GetProperty("user").GetProperty("fullName").GetString()).ToList();
        Assert.Equal(new[] { "Priya" }, names);

        // the manager still sees everyone approved (not the Pending account)
        var all = await Json(await _manager.GetAsync("/api/Manager/team/daily"));
        Assert.DoesNotContain(all.GetProperty("members").EnumerateArray(), m => m.GetProperty("user").GetProperty("fullName").GetString() == "Pending Person");
    }

    [Fact]
    public async Task Salaries_and_deactivating_people_are_for_managers_only()
    {
        Assert.Equal(HttpStatusCode.Forbidden, (await _lead.GetAsync("/api/payroll/salary/team")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await _lead.PutAsJsonAsync("/api/payroll/salary/3", new { monthlySalary = 1, currency = "INR", overtimeMultiplier = 1 })).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await _lead.GetAsync("/api/payroll/team")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await _lead.PutAsync("/api/Manager/user/3/toggle-status", null)).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await _manager.PutAsJsonAsync("/api/payroll/salary/3", new { monthlySalary = 50000, currency = "INR", overtimeMultiplier = 1.5 })).StatusCode);
    }

    [Fact]
    public async Task A_team_lead_cannot_open_documents_or_face_data_outside_their_team()
    {
        Db(db =>
        {
            db.Documents.AddRange(
                new Document { OwnerUserId = 3, UploadedByUserId = 3, Title = "Priya offer", FileName = "a.pdf", FilePath = "uploads/documents/x/a.pdf", MimeType = "application/pdf", FileSizeBytes = 1 },
                new Document { OwnerUserId = 4, UploadedByUserId = 4, Title = "Ravi offer", FileName = "b.pdf", FilePath = "uploads/documents/y/b.pdf", MimeType = "application/pdf", FileSizeBytes = 1 });
            return db.SaveChanges();
        });

        Assert.Equal(HttpStatusCode.Forbidden, (await _lead.GetAsync("/api/documents/user/4")).StatusCode);
        var all = (await Json(await _lead.GetAsync("/api/documents/all"))).EnumerateArray().Select(d => d.GetProperty("title").GetString()).ToList();
        Assert.Equal(new[] { "Priya offer" }, all);
        var ravisDoc = Db(db => db.Documents.Single(d => d.OwnerUserId == 4).Id);
        Assert.Equal(HttpStatusCode.NotFound, (await _lead.GetAsync($"/api/documents/{ravisDoc}")).StatusCode);

        var face = System.Text.Json.JsonSerializer.Serialize(Enumerable.Range(0, 128).Select(i => i * 0.01f));
        Assert.Equal(HttpStatusCode.Forbidden, (await _lead.PostAsJsonAsync("/api/face/register", new { descriptor = face, targetUserId = 1 })).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await _lead.GetAsync("/api/face/descriptor/4")).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await _lead.PostAsJsonAsync("/api/face/register", new { descriptor = face, targetUserId = 3 })).StatusCode);
    }

    [Fact]
    public async Task F30_an_employee_cannot_replace_their_own_registered_face()
    {
        var face = System.Text.Json.JsonSerializer.Serialize(Enumerable.Range(0, 128).Select(i => i * 0.01f));
        Assert.Equal(HttpStatusCode.OK, (await _ravi.PostAsJsonAsync("/api/face/register", new { descriptor = face })).StatusCode);
        var again = await _ravi.PostAsJsonAsync("/api/face/register", new { descriptor = face });
        Assert.Equal(HttpStatusCode.Forbidden, again.StatusCode);
        Assert.Contains("Ask your manager", await Message(again));
        Assert.Equal(HttpStatusCode.OK, (await _manager.PostAsJsonAsync("/api/face/register", new { descriptor = face, targetUserId = 4 })).StatusCode);
    }

    [Fact]
    public async Task F18_only_the_owner_or_their_own_lead_can_change_a_training()
    {
        var r = await _ravi.PostAsJsonAsync("/api/training", new { title = "AWS", trainingType = "Online", startDate = "2026-10-01", durationHours = 10, status = "Planned" });
        var id = (await Json(r)).GetProperty("id").GetInt32();

        Assert.NotEqual(HttpStatusCode.OK, (await _lead.PutAsJsonAsync($"/api/training/{id}", new { title = "hijack" })).StatusCode);
        Assert.NotEqual(HttpStatusCode.NoContent, (await _lead.DeleteAsync($"/api/training/{id}")).StatusCode);
        Assert.Equal("AWS", Db(db => db.Trainings.Single().Title));

        var bad = await _ravi.PostAsJsonAsync("/api/training", new { title = "x", trainingType = "Online", startDate = "2026-10-10", endDate = "2026-10-01", durationHours = -3, status = "Banana" });
        Assert.Equal(HttpStatusCode.BadRequest, bad.StatusCode);
    }

    // ── F3 / F22 / F2: accounts ──────────────────────────────────────────────

    [Fact]
    public async Task F3_a_pending_account_can_only_see_who_they_are()
    {
        var pending = ClientFor(_users[5]);
        Assert.Equal(HttpStatusCode.OK, (await pending.GetAsync("/api/auth/me")).StatusCode);
        var blocked = await pending.GetAsync("/api/tasks/today");
        Assert.Equal(HttpStatusCode.Forbidden, blocked.StatusCode);
        Assert.Contains("waiting for a manager", await Message(blocked));
        Assert.Equal(HttpStatusCode.Forbidden, (await pending.GetAsync("/api/auth/users")).StatusCode);
        Assert.DoesNotContain((await Json(await _priya.GetAsync("/api/chat/users"))).EnumerateArray(),
            u => u.GetProperty("fullName").GetString() == "Pending Person");
    }

    [Fact]
    public async Task F22_someone_deactivated_or_whose_role_changed_loses_access_with_their_old_login()
    {
        Db(db => { db.Users.Find(4)!.IsActive = false; return db.SaveChanges(); });
        Assert.Equal(HttpStatusCode.Unauthorized, (await _ravi.GetAsync("/api/auth/me")).StatusCode);

        Db(db => { db.Users.Find(3)!.Role = "TeamLead"; return db.SaveChanges(); });
        Assert.Equal(HttpStatusCode.Unauthorized, (await _priya.GetAsync("/api/auth/me")).StatusCode);   // must sign in again
    }

    [Fact]
    public async Task F2_a_manager_cannot_change_their_own_role()
    {
        var r = await _manager.PostAsJsonAsync("/api/auth/assign-role", new { userId = 1, role = "Developer" });
        Assert.Equal(HttpStatusCode.BadRequest, r.StatusCode);
        Assert.Equal("Manager", Db(db => db.Users.Find(1)!.Role));
    }

    [Fact]
    public async Task F1_registration_succeeds_even_when_the_welcome_email_fails()
    {
        Db(db =>
        {
            db.EmailOtps.Add(new EmailOtp { Email = "new@test.dev", Code = "123456", Purpose = "Register", ExpiresAt = DateTime.UtcNow.AddMinutes(10) });
            return db.SaveChanges();
        });   // email isn't configured in tests, so the welcome email fails

        var r = await _factory.CreateClient().PostAsJsonAsync("/api/auth/verify-register-otp",
            new { fullName = "New Joiner", email = "new@test.dev", password = "Passw0rd!23", code = "123456" });

        Assert.Equal(HttpStatusCode.OK, r.StatusCode);
        Assert.True(Db(db => db.Users.Any(u => u.Email == "new@test.dev" && u.Role == "Pending")));
    }

    // ── F25: AI Help can't skip the attendance rules ─────────────────────────

    [Fact]
    public async Task F25_AI_help_cannot_check_in_without_the_normal_face_and_location_check()
    {
        var r = await _priya.PostAsJsonAsync("/api/AiChat/execute-action", new { type = "CHECK_IN", payload = new { } });
        Assert.Equal(HttpStatusCode.BadRequest, r.StatusCode);
        Assert.False(Db(db => db.DailyLogs.Any()));
    }

    // ── F4 / F5 / F7 / F9: the working day ──────────────────────────────────

    [Fact]
    public async Task The_working_day_rules_tasks_breaks_support_and_check_out()
    {
        Assert.Equal(HttpStatusCode.OK, (await CheckIn(_priya)).StatusCode);

        // F4 tasks
        Assert.Equal(HttpStatusCode.BadRequest, (await _priya.PostAsJsonAsync("/api/Tasks", new { taskTitle = "neg", status = "InProgress", priority = "High", timeSpentMinutes = -50 })).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await _priya.PostAsJsonAsync("/api/Tasks", new { taskTitle = "bad", status = "Banana", priority = "Nope", timeSpentMinutes = 5 })).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await _priya.PostAsJsonAsync("/api/Tasks", new { taskTitle = "ok", status = "inprogress", priority = "high", timeSpentMinutes = 5 })).StatusCode);

        // F5 breaks
        Assert.Equal(HttpStatusCode.BadRequest, (await _priya.PostAsJsonAsync("/api/Breaks/start", new { breakType = "Nap" })).StatusCode);
        var tea = await Json(await _priya.PostAsJsonAsync("/api/Breaks/start", new { breakType = "Tea" }));
        var teaId = tea.GetProperty("id").GetInt32();
        var firstEnd = (await Json(await _priya.PutAsync($"/api/Breaks/end/{teaId}", null))).GetProperty("endTime").GetString();
        await Task.Delay(20);
        var secondEnd = (await Json(await _priya.PutAsync($"/api/Breaks/end/{teaId}", null))).GetProperty("endTime").GetString();
        Assert.Equal(DateTime.Parse(firstEnd!).Ticks / 10_000_000, DateTime.Parse(secondEnd!).Ticks / 10_000_000);   // not rewritten

        // F7 support: not to yourself, not between two other people
        object Support(int engineer, int developer) => new { supportEngineerId = engineer, supportedDeveloperId = developer, issueDescription = "build", timeSpentMinutes = 10, supportType = "Debugging", latitude = OfficeLat, longitude = OfficeLng };
        Assert.Equal(HttpStatusCode.BadRequest, (await _priya.PostAsJsonAsync("/api/Support", Support(3, 3))).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await _priya.PostAsJsonAsync("/api/Support", Support(4, 1))).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await _priya.PostAsJsonAsync("/api/Support", Support(4, 3))).StatusCode);   // Ravi helped Priya — she logs it

        // F9 check-out once; nothing new afterwards
        Assert.Equal(HttpStatusCode.OK, (await _priya.PutAsJsonAsync("/api/DailyLog/checkout", new { latitude = OfficeLat, longitude = OfficeLng })).StatusCode);
        var outTime = Db(db => db.DailyLogs.Single().CheckOutTime);
        Assert.Equal(HttpStatusCode.BadRequest, (await _priya.PutAsJsonAsync("/api/DailyLog/checkout", new { latitude = OfficeLat, longitude = OfficeLng })).StatusCode);
        Assert.Equal(outTime, Db(db => db.DailyLogs.Single().CheckOutTime));
        Assert.Equal(HttpStatusCode.BadRequest, (await _priya.PostAsJsonAsync("/api/Breaks/start", new { breakType = "Tea" })).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await _priya.PostAsJsonAsync("/api/Tasks", new { taskTitle = "late", status = "InProgress", priority = "Low", timeSpentMinutes = 0 })).StatusCode);
    }

    [Fact]
    public async Task F8_an_empty_EOD_is_refused_and_a_saved_one_shows_the_real_name()
    {
        await CheckIn(_priya);
        Assert.Equal(HttpStatusCode.BadRequest, (await _priya.PostAsJsonAsync("/api/eod", new { whatWasDone = "  ", moodRating = "Good" })).StatusCode);
        var ok = await Json(await _priya.PostAsJsonAsync("/api/eod", new { whatWasDone = "Login page", moodRating = "Good" }));
        Assert.Equal("Priya", ok.GetProperty("userName").GetString());
    }

    // ── F17: resignations ────────────────────────────────────────────────────

    [Fact]
    public async Task F17_a_resignation_decision_must_be_accepted_or_rejected()
    {
        var res = await Json(await _ravi.PostAsJsonAsync("/api/resignation", new { reason = "Moving", requestedLastDay = AppClock.TodayIst.AddDays(30).ToString("yyyy-MM-dd") }));
        var id = res.GetProperty("id").GetInt32();

        var maybe = await _manager.PutAsJsonAsync($"/api/resignation/{id}/review", new { decision = "Maybe" });
        Assert.Equal(HttpStatusCode.BadRequest, maybe.StatusCode);
        Assert.Equal("Pending", Db(db => db.Resignations.Single().Status));

        // Ravi isn't Tina's report
        Assert.Equal(HttpStatusCode.Forbidden, (await _lead.PutAsJsonAsync($"/api/resignation/{id}/review", new { decision = "Rejected" })).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await _manager.PutAsJsonAsync($"/api/resignation/{id}/review",
            new { decision = "accepted", noticePeriodEndDate = AppClock.TodayIst.AddDays(30).ToString("yyyy-MM-dd") })).StatusCode);
        Assert.Equal("Accepted", Db(db => db.Resignations.Single().Status));
    }

    // ── F28: payroll ─────────────────────────────────────────────────────────

    [Fact]
    public async Task F28_payroll_doesnt_count_days_before_joining_or_days_not_yet_happened_as_absent()
    {
        Db(db => { db.Users.Find(3)!.JoinDate = AppClock.TodayIst; return db.SaveChanges(); });
        await _manager.PutAsJsonAsync("/api/payroll/salary/3", new { monthlySalary = 50000, currency = "INR", overtimeMultiplier = 1.5 });

        var slip = await Json(await _priya.GetAsync("/api/payroll/my"));

        Assert.Equal(0, slip.GetProperty("daysAbsent").GetInt32());
        var today = AppClock.TodayIst;
        var workDaysBefore = Enumerable.Range(1, today.Day - 1)
            .Select(d => new DateTime(today.Year, today.Month, d))
            .Count(d => d.DayOfWeek is not DayOfWeek.Saturday and not DayOfWeek.Sunday);
        var labels = slip.GetProperty("deductions").EnumerateArray().Select(d => d.GetProperty("label").GetString()).ToList();
        Assert.DoesNotContain("Absent Deduction", labels);
        if (workDaysBefore > 0) Assert.Contains("Before Joining", labels);
    }

    // ── former server errors (500) → clear messages ─────────────────────────

    [Fact]
    public async Task Bad_input_gets_a_clear_message_instead_of_a_server_error()
    {
        Assert.Equal(HttpStatusCode.OK, (await _manager.PostAsJsonAsync("/api/holidays", new { date = "2026-11-09", name = "Diwali", type = "Public" })).StatusCode);
        var dup = await _manager.PostAsJsonAsync("/api/holidays", new { date = "2026-11-09", name = "Again", type = "Public" });
        Assert.Equal(HttpStatusCode.BadRequest, dup.StatusCode);
        Assert.Contains("already a holiday", await Message(dup));

        var ghostMeeting = await _lead.PostAsJsonAsync("/api/meetings", new { title = "Ghost", meetingType = "Standup", scheduledAt = "2026-10-01T04:30:00Z", durationMinutes = 15, isRecurring = false, attendeeIds = new[] { 999 } });
        Assert.Equal(HttpStatusCode.BadRequest, ghostMeeting.StatusCode);

        Assert.Equal(HttpStatusCode.NotFound, (await _priya.PostAsync("/api/announcements/9999/read", null)).StatusCode);

        var ghostCycle = await _manager.PostAsJsonAsync("/api/reviews/cycles", new { title = "Q4", cycleType = "Quarterly", startDate = "2026-10-01", endDate = "2026-12-31", revieweeIds = new[] { 999 } });
        Assert.Equal(HttpStatusCode.BadRequest, ghostCycle.StatusCode);
        Assert.False(Db(db => db.ReviewCycles.Any()));   // nothing half-saved

        Assert.Equal(HttpStatusCode.BadRequest, (await _manager.PostAsJsonAsync("/api/reviews/cycles", new { title = "Back", cycleType = "Quarterly", startDate = "2026-12-31", endDate = "2026-10-01", revieweeIds = new[] { 3 } })).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await _priya.PostAsJsonAsync("/api/kudos", new { toUserId = 4, message = "x", badgeType = "Banana" })).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await _manager.PostAsJsonAsync("/api/announcements", new { title = "", content = "", category = "General", isPinned = false })).StatusCode);
    }

    [Fact]
    public async Task F23_a_profile_photo_must_really_be_an_image()
    {
        var fake = new MultipartFormDataContent();
        var bytes = new ByteArrayContent(System.Text.Encoding.UTF8.GetBytes("<html>not an image</html>"));
        bytes.Headers.ContentType = new MediaTypeHeaderValue("image/png");
        fake.Add(bytes, "photo", "x.png");
        Assert.Equal(HttpStatusCode.BadRequest, (await _priya.PostAsync("/api/profile/me/photo", fake)).StatusCode);

        var real = new MultipartFormDataContent();
        var png = new ByteArrayContent(TestFiles.Png);
        png.Headers.ContentType = new MediaTypeHeaderValue("image/png");
        real.Add(png, "photo", "me.html");   // the name doesn't decide the type
        var ok = await _priya.PostAsync("/api/profile/me/photo", real);
        Assert.Equal(HttpStatusCode.OK, ok.StatusCode);
        Assert.EndsWith(".png", (await Json(ok)).GetProperty("profilePhotoUrl").GetString());
    }
}
