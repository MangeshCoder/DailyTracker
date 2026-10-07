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
/// "Auto-Generate Draft" on the EOD page (4 Oct 2026): Gemini writes the report from the day's records;
/// without a key, or when Gemini fails or answers badly, the fixed template is used. Gemini is faked here.
/// </summary>
public class EodAiDraftTests : IDisposable
{
    /// <summary>Stands in for Gemini: remembers what was sent, answers with whatever the test sets.</summary>
    private sealed class FakeGemini : HttpMessageHandler
    {
        public Func<HttpResponseMessage> Reply = () => new HttpResponseMessage(HttpStatusCode.InternalServerError);
        public HttpRequestMessage? Request;
        public string RequestBody = "";
        public int Calls;

        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct)
        {
            Calls++;
            Request = request;
            RequestBody = request.Content == null ? "" : await request.Content.ReadAsStringAsync(ct);
            return Reply();
        }

        /// <summary>A Gemini answer whose text is <paramref name="modelText"/>.</summary>
        public static HttpResponseMessage Answer(string modelText) => new(HttpStatusCode.OK)
        {
            Content = new StringContent(JsonSerializer.Serialize(new
            {
                candidates = new[] { new { content = new { role = "model", parts = new[] { new { text = modelText } } } } },
            }), Encoding.UTF8, "application/json"),
        };
    }

    private readonly FakeGemini _gemini = new();
    private ApiFactory _factory = null!;
    private HttpClient _priya = null!;

    private void Start(string? apiKey, bool checkedIn = true)
    {
        _factory = new ApiFactory(
            settings: new Dictionary<string, string?> { ["Gemini:ApiKey"] = apiKey ?? "" },
            configureServices: s => s.AddHttpClient<IAiService, GeminiService>().ConfigurePrimaryHttpMessageHandler(() => _gemini));
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        TestDatabase.CreateSchema(db);
        var priya = new User { Id = 3, FullName = "Priya", Email = "p@test.dev", PasswordHash = "x", Role = "Developer", IsActive = true };
        var ravi = new User { Id = 4, FullName = "Ravi", Email = "r@test.dev", PasswordHash = "x", Role = "Developer", IsActive = true };
        db.Users.AddRange(priya, ravi);
        if (checkedIn)
        {
            var log = new DailyLog { UserId = 3, LogDate = AppClock.TodayIst, CheckInTime = DateTime.UtcNow.AddHours(-6), DayStatus = "WFH" };
            log.TaskLogs.Add(new TaskLog { TaskTitle = "Login page fix", Description = "Fixed the password reset link", ProjectName = "Portal", Status = "Completed", TimeSpentMinutes = 120 });
            log.TaskLogs.Add(new TaskLog { TaskTitle = "Payroll export", Status = "InProgress", TimeSpentMinutes = 90 });
            log.TaskLogs.Add(new TaskLog { TaskTitle = "Bank API", Status = "Blocked", TimeSpentMinutes = 30 });
            log.SupportLogs.Add(new SupportLog { SupportEngineerId = 3, SupportedDeveloperId = 4, IssueDescription = "Docker build failing", TimeSpentMinutes = 20 });
            db.DailyLogs.Add(log);
        }
        db.SaveChanges();
        TestDatabase.AfterSeed(db);
        var jwt = scope.ServiceProvider.GetRequiredService<JwtHelper>();
        _priya = _factory.CreateClient();
        _priya.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", jwt.GenerateAccessToken(priya).Token);
    }

    public void Dispose() => _factory?.Dispose();

    private async Task<JsonElement> Draft()
    {
        var r = await _priya.GetAsync("/api/aichat/eod-draft");
        Assert.True(r.IsSuccessStatusCode, $"{(int)r.StatusCode} {await r.Content.ReadAsStringAsync()}");
        return JsonDocument.Parse(await r.Content.ReadAsStringAsync()).RootElement;
    }

    private static string S(JsonElement e, string name) => e.GetProperty(name).GetString()!;

    [Fact]
    public async Task Gemini_writes_the_draft_from_the_days_records()
    {
        Start("test-key");
        _gemini.Reply = () => FakeGemini.Answer(JsonSerializer.Serialize(new
        {
            whatWasDone = "• I fixed the password reset link on the Portal login page.\n• I helped Ravi get the Docker build working.",
            blockers = "• Bank API work is blocked.",
            planForTomorrow = "• Finish the payroll export.",
            learnings = "",
        }));

        var res = await Draft();
        Assert.True(res.GetProperty("success").GetBoolean());
        Assert.Equal("ai", S(res, "source"));
        var d = res.GetProperty("draft");
        Assert.StartsWith("• I fixed the password reset link", S(d, "whatWasDone"));
        Assert.Equal("• Bank API work is blocked.", S(d, "blockers"));
        Assert.Equal("• Finish the payroll export.", S(d, "planForTomorrow"));
        Assert.Equal("Good", S(d, "moodRating"));   // mood is suggested from the numbers, not by the AI

        // what went to Gemini: the day's real records, the key in a header (not the URL), JSON output asked for
        Assert.Equal(1, _gemini.Calls);
        Assert.Equal("test-key", _gemini.Request!.Headers.GetValues("x-goog-api-key").Single());
        Assert.DoesNotContain("test-key", _gemini.Request.RequestUri!.ToString());
        foreach (var fact in new[] { "Login page fix", "Fixed the password reset link", "[Blocked] Bank API", "Payroll export", "Helped Ravi", "Docker build failing" })
            Assert.Contains(fact, _gemini.RequestBody);
        Assert.Contains("application/json", _gemini.RequestBody);
    }

    [Fact]
    public async Task A_too_long_answer_is_cut_to_fit_the_form()
    {
        Start("test-key");
        var longText = string.Join("\n", Enumerable.Range(1, 40).Select(i => $"• Point number {i} about the work done today"));
        _gemini.Reply = () => FakeGemini.Answer(JsonSerializer.Serialize(new { whatWasDone = longText, blockers = "", planForTomorrow = "", learnings = "" }));

        var done = S((await Draft()).GetProperty("draft"), "whatWasDone");
        Assert.True(done.Length <= GeminiService.EodWhatWasDoneMax, $"{done.Length} characters");
        Assert.EndsWith("about the work done today", done);   // cut at a line end, not mid-word
    }

    [Theory]
    [InlineData("error")]       // Gemini returns 500
    [InlineData("not-json")]    // the model answers with prose
    [InlineData("empty")]       // JSON without the main field
    public async Task When_Gemini_cant_be_used_the_template_fills_the_form(string failure)
    {
        Start("test-key");
        _gemini.Reply = failure switch
        {
            "error" => () => new HttpResponseMessage(HttpStatusCode.InternalServerError),
            "not-json" => () => FakeGemini.Answer("Sure! Here is your report: you did great today."),
            _ => () => FakeGemini.Answer("{\"whatWasDone\":\"  \",\"blockers\":\"\",\"planForTomorrow\":\"\",\"learnings\":\"\"}"),
        };

        var res = await Draft();
        Assert.Equal("template", S(res, "source"));
        var d = res.GetProperty("draft");
        Assert.Contains("• Completed: Login page fix (120m)", S(d, "whatWasDone"));
        Assert.Contains("• Assisted Ravi (20m)", S(d, "whatWasDone"));
        Assert.Equal("• Blocked: Bank API", S(d, "blockers"));
        Assert.Contains("• Continue working on: Payroll export", S(d, "planForTomorrow"));
    }

    [Fact]
    public async Task Without_a_key_Gemini_is_not_called()
    {
        Start(apiKey: null);
        var res = await Draft();
        Assert.Equal("template", S(res, "source"));
        Assert.Equal(0, _gemini.Calls);
    }

    [Fact]
    public async Task Before_checking_in_there_is_nothing_to_draft()
    {
        Start("test-key", checkedIn: false);
        var res = await Draft();
        Assert.False(res.GetProperty("success").GetBoolean());
        Assert.Contains("not checked in", S(res, "message"));
        Assert.Equal(0, _gemini.Calls);
    }
}
