using System.Net;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using DailyTrackerAPI.Data;
using DailyTrackerAPI.Helpers;
using DailyTrackerAPI.Models.Auth;
using DailyTrackerAPI.Models.Tasks;
using DailyTrackerAPI.Services.AI;
using Microsoft.Extensions.DependencyInjection;

namespace DailyTrackerAPI.Tests;

/// <summary>
/// AI team summary on the Manager Dashboard (7 Oct 2026). Numbers are counted from the database; Gemini (faked here)
/// writes the text; without it a plain summary is put together. Each person only sees their own team.
///   1 Mangesh (Manager) · 2 Tina (Team Lead) · 3 Priya, 6 Neha (Tina's team) · 4 Ravi (Mangesh's team) · 5 a pending sign-up
/// </summary>
public class TeamSummaryTests : IDisposable
{
    private sealed class FakeGemini : HttpMessageHandler
    {
        public Func<HttpResponseMessage> Reply = () => new HttpResponseMessage(HttpStatusCode.InternalServerError);
        public string RequestBody = "";
        public string? Key;
        public int Calls;

        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct)
        {
            Calls++;
            Key = request.Headers.TryGetValues("x-goog-api-key", out var k) ? k.Single() : null;
            RequestBody = request.Content == null ? "" : await request.Content.ReadAsStringAsync(ct);
            return Reply();
        }

        public static HttpResponseMessage Answer(object json) => new(HttpStatusCode.OK)
        {
            Content = new StringContent(JsonSerializer.Serialize(new
            {
                candidates = new[] { new { content = new { parts = new[] { new { text = JsonSerializer.Serialize(json) } } } } },
            }), Encoding.UTF8, "application/json"),
        };
    }

    private static readonly DateTime Today = AppClock.TodayIst;
    private readonly FakeGemini _gemini = new();
    private ApiFactory _factory = null!;
    private readonly Dictionary<int, HttpClient> _as = new();

    private void Start(string? apiKey)
    {
        _factory = new ApiFactory(
            settings: new Dictionary<string, string?> { ["Gemini:ApiKey"] = apiKey ?? "" },
            configureServices: s => s.AddHttpClient<IAiService, GeminiService>().ConfigurePrimaryHttpMessageHandler(() => _gemini));
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        TestDatabase.CreateSchema(db);
        var users = new[]
        {
            new User { Id = 1, FullName = "Mangesh", Email = "m@test.dev", PasswordHash = "x", Role = "Manager", IsActive = true },
            new User { Id = 2, FullName = "Tina", Email = "t@test.dev", PasswordHash = "x", Role = "TeamLead", IsActive = true, ManagerId = 1 },
            new User { Id = 3, FullName = "Priya", Email = "p@test.dev", PasswordHash = "x", Role = "Developer", IsActive = true, ManagerId = 2 },
            new User { Id = 4, FullName = "Ravi", Email = "r@test.dev", PasswordHash = "x", Role = "Developer", IsActive = true, ManagerId = 1 },
            new User { Id = 5, FullName = "Pending Person", Email = "x@test.dev", PasswordHash = "x", Role = "Pending", IsActive = true },
            new User { Id = 6, FullName = "Neha", Email = "n@test.dev", PasswordHash = "x", Role = "Developer", IsActive = true, ManagerId = 2 },
        };
        db.Users.AddRange(users);

        // Priya: two hard days, both reported, with a blocker; 3 tasks done
        foreach (var (back, mood, done) in new[] { (2, "Tired", 1), (1, "Stressed", 2) })
        {
            var log = new DailyLog { UserId = 3, LogDate = Today.AddDays(-back), CheckInTime = DateTime.UtcNow.AddDays(-back), TotalWorkMinutes = 540 };
            for (var i = 0; i < done; i++) log.TaskLogs.Add(new TaskLog { TaskTitle = $"Task {back}-{i}", Status = "Completed" });
            db.DailyLogs.Add(log);
            db.EODReports.Add(new EODReport
            {
                UserId = 3, DailyLog = log, ReportDate = Today.AddDays(-back), MoodRating = mood,
                WhatWasDone = $"Payroll screen work day {back}", Blockers = "Waiting for the bank API keys",
            });
        }
        // Ravi: worked yesterday, no report, one blocked task
        var ravi = new DailyLog { UserId = 4, LogDate = Today.AddDays(-1), CheckInTime = DateTime.UtcNow.AddDays(-1), TotalWorkMinutes = 480 };
        ravi.TaskLogs.Add(new TaskLog { TaskTitle = "Server move", Status = "Blocked" });
        db.DailyLogs.Add(ravi);
        // an old report outside the 7 days
        var old = new DailyLog { UserId = 6, LogDate = Today.AddDays(-20), CheckInTime = DateTime.UtcNow.AddDays(-20), TotalWorkMinutes = 300 };
        db.DailyLogs.Add(old);
        db.EODReports.Add(new EODReport { UserId = 6, DailyLog = old, ReportDate = Today.AddDays(-20), WhatWasDone = "Very old work" });

        db.SaveChanges();
        TestDatabase.AfterSeed(db);
        var jwt = scope.ServiceProvider.GetRequiredService<JwtHelper>();
        foreach (var u in users)
        {
            var c = _factory.CreateClient();
            c.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", jwt.GenerateAccessToken(u).Token);
            _as[u.Id] = c;
        }
    }

    public void Dispose() => _factory?.Dispose();

    private async Task<JsonElement> Summary(int who, int days = 7)
    {
        var r = await _as[who].GetAsync($"/api/aichat/team-summary?days={days}");
        Assert.True(r.IsSuccessStatusCode, $"{(int)r.StatusCode} {await r.Content.ReadAsStringAsync()}");
        return JsonDocument.Parse(await r.Content.ReadAsStringAsync()).RootElement;
    }

    private static JsonElement Person(JsonElement s, string name) =>
        s.GetProperty("people").EnumerateArray().Single(p => p.GetProperty("name").GetString() == name);

    private static List<string> Strings(JsonElement s, string name) =>
        s.GetProperty(name).EnumerateArray().Select(v => v.GetString()!).ToList();

    [Fact]
    public async Task A_manager_gets_an_AI_summary_with_exact_numbers()
    {
        Start("test-key");
        _gemini.Reply = () => FakeGemini.Answer(new
        {
            overview = "A busy week focused on payroll.",
            highlights = new[] { "• Priya finished 3 payroll tasks." },
            blockers = new[] { "Priya is waiting for the bank API keys." },
            needsAttention = new[] { "Priya felt tired and stressed.", "  " },
        });

        var s = await Summary(1);
        Assert.Equal("ai", s.GetProperty("source").GetString());
        Assert.Equal("A busy week focused on payroll.", s.GetProperty("overview").GetString());
        Assert.Equal(new[] { "Priya finished 3 payroll tasks." }, Strings(s, "highlights"));   // bullet trimmed
        Assert.Equal(new[] { "Priya felt tired and stressed." }, Strings(s, "needsAttention"));  // blank dropped

        // everyone but the manager and the pending sign-up
        Assert.Equal(new[] { "Neha", "Priya", "Ravi", "Tina" },
            s.GetProperty("people").EnumerateArray().Select(p => p.GetProperty("name").GetString()).ToArray());
        var priya = Person(s, "Priya");
        Assert.Equal((2, 1080, 3, 2, 0, "Stressed"), (priya.GetProperty("daysWorked").GetInt32(), priya.GetProperty("workMinutes").GetInt32(),
            priya.GetProperty("tasksCompleted").GetInt32(), priya.GetProperty("eodsSubmitted").GetInt32(),
            priya.GetProperty("eodsMissing").GetInt32(), priya.GetProperty("lastMood").GetString()));
        var ravi = Person(s, "Ravi");
        Assert.Equal((1, 1, 0), (ravi.GetProperty("eodsMissing").GetInt32(), ravi.GetProperty("tasksBlocked").GetInt32(), ravi.GetProperty("eodsSubmitted").GetInt32()));
        Assert.Equal(0, Person(s, "Neha").GetProperty("daysWorked").GetInt32());   // the 20-day-old work isn't in this week

        // Gemini got the reports, not the old one; the key went in a header
        Assert.Equal("test-key", _gemini.Key);
        Assert.Contains("Payroll screen work day 1", _gemini.RequestBody);
        Assert.Contains("Waiting for the bank API keys", _gemini.RequestBody);
        Assert.DoesNotContain("Very old work", _gemini.RequestBody);
        Assert.DoesNotContain("Pending Person", _gemini.RequestBody);
    }

    [Fact]
    public async Task A_team_lead_only_sees_their_own_people()
    {
        Start("test-key");
        _gemini.Reply = () => FakeGemini.Answer(new { overview = "Fine.", highlights = Array.Empty<string>(), blockers = Array.Empty<string>(), needsAttention = Array.Empty<string>() });

        var s = await Summary(2);
        Assert.Equal(new[] { "Neha", "Priya" }, s.GetProperty("people").EnumerateArray().Select(p => p.GetProperty("name").GetString()).ToArray());
        Assert.DoesNotContain("Ravi", _gemini.RequestBody);
        Assert.DoesNotContain("Server move", _gemini.RequestBody);
    }

    [Fact]
    public async Task Someone_without_a_team_is_refused_and_nothing_is_sent()
    {
        Start("test-key");
        var r = await _as[3].GetAsync("/api/aichat/team-summary");
        Assert.Equal(HttpStatusCode.Forbidden, r.StatusCode);
        Assert.Equal(0, _gemini.Calls);
    }

    [Theory]
    [InlineData(null)]          // no key: Gemini isn't called
    [InlineData("bad-answer")]  // Gemini answers without an overview
    public async Task Without_AI_a_plain_summary_is_put_together(string? mode)
    {
        Start(mode == null ? null : "test-key");
        _gemini.Reply = () => FakeGemini.Answer(new { overview = "", highlights = new[] { "x" }, blockers = Array.Empty<string>(), needsAttention = Array.Empty<string>() });

        var s = await Summary(1);
        Assert.Equal("template", s.GetProperty("source").GetString());
        Assert.Equal("2 of 4 people worked in this period: 26h 0m in total, 3 tasks completed and 2 EOD reports sent.", s.GetProperty("overview").GetString());
        Assert.Equal(new[] { "Priya completed 3 tasks." }, Strings(s, "highlights"));
        Assert.Contains(Strings(s, "blockers"), b => b.StartsWith("Priya (") && b.EndsWith("Waiting for the bank API keys"));
        Assert.Equal(new[]
        {
            "Priya marked 2 days as Tired or Stressed.",
            "Ravi has 1 worked day without an EOD report.",
            "Ravi has 1 blocked task.",
        }, Strings(s, "needsAttention"));
        if (mode == null) Assert.Equal(0, _gemini.Calls);
    }

    [Fact]
    public async Task Long_AI_lists_are_capped()
    {
        Start("test-key");
        _gemini.Reply = () => FakeGemini.Answer(new
        {
            overview = "Ok.",
            highlights = Enumerable.Range(1, 15).Select(i => $"Point {i} " + new string('x', 400)).ToArray(),
            blockers = Array.Empty<string>(),
            needsAttention = Array.Empty<string>(),
        });
        var highlights = Strings(await Summary(1), "highlights");
        Assert.Equal(8, highlights.Count);
        Assert.All(highlights, h => Assert.True(h.Length <= 300));
    }
}
