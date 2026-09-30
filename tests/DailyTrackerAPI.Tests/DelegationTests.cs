using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using DailyTrackerAPI.Data;
using DailyTrackerAPI.Helpers;
using DailyTrackerAPI.Models.Auth;
using DailyTrackerAPI.Models.HR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace DailyTrackerAPI.Tests;

/// <summary>
/// Approval delegation (1 Oct 2026): a manager / team lead going on leave hands
/// their approvals to a colleague for some days; nothing waits for them.
///   1 Mangesh (Manager) · 2 Tina (Team Lead) · 3 Priya (reports to Tina)
///   4 Ravi (reports to Mangesh) · 5 Om (Team Lead, nobody reports to him) · 6 Dev (Developer)
/// </summary>
public class DelegationTests : IDisposable
{
    private readonly ApiFactory _factory = new();
    private readonly HttpClient _manager, _tina, _priya, _ravi, _om, _dev;
    private static readonly DateTime Today = AppClock.TodayIst;
    private static readonly DateTime Monday = NextMonday(Today.AddDays(7));
    private static DateTime NextMonday(DateTime d) { while (d.DayOfWeek != DayOfWeek.Monday) d = d.AddDays(1); return d; }
    private static string D(DateTime d) => d.ToString("yyyy-MM-dd");
    private static readonly byte[] Pdf = Encoding.ASCII.GetBytes("%PDF-1.4\n%%EOF");

    public DelegationTests()
    {
        var users = new[]
        {
            new User { Id = 1, FullName = "Mangesh", Email = "m@test.dev", PasswordHash = "x", Role = "Manager", IsActive = true },
            new User { Id = 2, FullName = "Tina", Email = "t@test.dev", PasswordHash = "x", Role = "TeamLead", IsActive = true, ManagerId = 1 },
            new User { Id = 3, FullName = "Priya", Email = "p@test.dev", PasswordHash = "x", Role = "Developer", IsActive = true, ManagerId = 2 },
            new User { Id = 4, FullName = "Ravi", Email = "r@test.dev", PasswordHash = "x", Role = "Developer", IsActive = true, ManagerId = 1 },
            new User { Id = 5, FullName = "Om", Email = "o@test.dev", PasswordHash = "x", Role = "TeamLead", IsActive = true, ManagerId = 1 },
            new User { Id = 6, FullName = "Dev", Email = "d@test.dev", PasswordHash = "x", Role = "Developer", IsActive = true, ManagerId = 1 },
        };
        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            TestDatabase.CreateSchema(db);
            db.Users.AddRange(users);
            db.SaveChanges();
            TestDatabase.AfterSeed(db);
        }
        _manager = ClientFor(users[0]);
        _tina = ClientFor(users[1]);
        _priya = ClientFor(users[2]);
        _ravi = ClientFor(users[3]);
        _om = ClientFor(users[4]);
        _dev = ClientFor(users[5]);
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
        (await Json(r)).GetProperty("message").GetString()!;

    private static Task<HttpResponseMessage> HandOver(HttpClient c, int to, DateTime from, DateTime until) =>
        c.PostAsJsonAsync("/api/delegations", new { toUserId = to, startDate = D(from), endDate = D(until), note = "On leave" });

    private static Task<HttpResponseMessage> Expense(HttpClient c)
    {
        var form = new MultipartFormDataContent
        {
            { new StringContent(D(Today)), "expenseDate" }, { new StringContent("Food"), "category" },
            { new StringContent("300"), "amount" }, { new StringContent("Team lunch") , "description" },
        };
        form.Add(new ByteArrayContent(Pdf), "receipt", "bill.pdf");
        return c.PostAsync("/api/expenses", form);
    }

    private async Task<int> WfhRequest(HttpClient c) =>
        (await Json(await c.PostAsJsonAsync("/api/wfh-requests", new { requestType = "WFH", requestDate = D(Monday), reason = "plumber" }))).GetProperty("id").GetInt32();

    [Fact]
    public async Task While_a_team_lead_is_away_the_colleague_decides_their_teams_requests_and_gets_them()
    {
        Assert.Equal(HttpStatusCode.OK, (await HandOver(_tina, 5, Today, Today.AddDays(3))).StatusCode);
        Assert.True(Db(db => db.Notifications.Any(n => n.UserId == 5 && n.Title.Contains("covering"))));

        // new requests from Tina's team go to Om, not Tina
        (await Expense(_priya)).EnsureSuccessStatusCode();
        Assert.True(Db(db => db.Notifications.Any(n => n.UserId == 5 && n.Title.Contains("Expense"))));
        Assert.False(Db(db => db.Notifications.Any(n => n.UserId == 2 && n.Title.Contains("Expense"))));

        var pending = await Json(await _om.GetAsync("/api/expenses/pending"));
        var claim = pending.EnumerateArray().Single(c => c.GetProperty("userName").GetString() == "Priya");
        Assert.Equal(HttpStatusCode.OK, (await _om.PutAsJsonAsync($"/api/expenses/{claim.GetProperty("id").GetInt32()}/review", new { status = "Approved" })).StatusCode);

        var wfh = await WfhRequest(_priya);
        Assert.Contains((await Json(await _om.GetAsync("/api/wfh-requests/pending"))).EnumerateArray(), r => r.GetProperty("id").GetInt32() == wfh);
        Assert.Equal(HttpStatusCode.OK, (await _om.PostAsJsonAsync($"/api/wfh-requests/{wfh}/approve", new { note = "ok" })).StatusCode);

        var mine = await Json(await _om.GetAsync("/api/delegations/my"));
        Assert.Equal("Tina", mine.GetProperty("actingFor")[0].GetProperty("fromName").GetString());
    }

    [Fact]
    public async Task Taking_the_approvals_back_ends_it_at_once()
    {
        var id = (await Json(await HandOver(_tina, 5, Today, Today.AddDays(3)))).GetProperty("id").GetInt32();
        Assert.Equal(HttpStatusCode.OK, (await _tina.DeleteAsync($"/api/delegations/{id}")).StatusCode);

        var wfh = await WfhRequest(_priya);
        Assert.Equal(HttpStatusCode.Forbidden, (await _om.PostAsJsonAsync($"/api/wfh-requests/{wfh}/approve", new { note = "ok" })).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await _tina.PostAsJsonAsync($"/api/wfh-requests/{wfh}/approve", new { note = "ok" })).StatusCode);
    }

    [Fact]
    public async Task A_hand_over_that_starts_later_gives_nothing_yet()
    {
        (await HandOver(_tina, 5, Today.AddDays(2), Today.AddDays(4))).EnsureSuccessStatusCode();
        var wfh = await WfhRequest(_priya);
        Assert.Equal(HttpStatusCode.Forbidden, (await _om.PostAsJsonAsync($"/api/wfh-requests/{wfh}/approve", new { note = "ok" })).StatusCode);
        Assert.Equal(1, (await Json(await _om.GetAsync("/api/delegations/my"))).GetProperty("upcoming").GetArrayLength());
    }

    [Fact]
    public async Task A_team_lead_covering_for_the_manager_decides_leave_but_not_their_own()
    {
        Assert.Equal(HttpStatusCode.Forbidden, (await _om.GetAsync("/api/leave/all?status=Pending")).StatusCode);   // not covering yet
        (await HandOver(_manager, 5, Today, Today.AddDays(5))).EnsureSuccessStatusCode();

        (await _ravi.PostAsJsonAsync("/api/leave", new { fromDate = D(Monday), toDate = D(Monday), leaveType = "Casual", reason = "family" })).EnsureSuccessStatusCode();
        (await _om.PostAsJsonAsync("/api/leave", new { fromDate = D(Monday), toDate = D(Monday), leaveType = "Casual", reason = "trip" })).EnsureSuccessStatusCode();
        Assert.True(Db(db => db.Notifications.Any(n => n.UserId == 5 && n.Title.Contains("Leave request"))));

        var all = await Json(await _om.GetAsync("/api/leave/all?status=Pending"));
        var ravis = all.EnumerateArray().Single(l => l.GetProperty("userName").GetString() == "Ravi").GetProperty("id").GetInt32();
        var own = all.EnumerateArray().Single(l => l.GetProperty("userName").GetString() == "Om");
        Assert.False(own.GetProperty("canReview").GetBoolean());

        Assert.Equal(HttpStatusCode.OK, (await _om.PutAsJsonAsync($"/api/leave/{ravis}/review", new { status = "Approved" })).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await _om.PutAsJsonAsync($"/api/leave/{own.GetProperty("id").GetInt32()}/review", new { status = "Approved" })).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await _tina.PutAsJsonAsync($"/api/leave/{ravis}/review", new { status = "Rejected" })).StatusCode);   // Tina isn't covering
    }

    [Fact]
    public async Task Bad_hand_overs_are_refused_with_a_clear_message()
    {
        async Task Refused(HttpResponseMessage r, string text)
        {
            Assert.Equal(HttpStatusCode.BadRequest, r.StatusCode);
            Assert.Contains(text, await Message(r));
        }
        await Refused(await HandOver(_tina, 6, Today, Today), "active manager or team lead");      // to a developer
        await Refused(await HandOver(_tina, 2, Today, Today), "someone else");
        await Refused(await HandOver(_tina, 5, Today.AddDays(-1), Today), "past");
        await Refused(await HandOver(_tina, 5, Today.AddDays(3), Today), "on or after");
        await Refused(await HandOver(_tina, 5, Today, Today.AddDays(95)), "at most 90");

        (await HandOver(_om, 1, Today, Today.AddDays(2))).EnsureSuccessStatusCode();
        await Refused(await HandOver(_tina, 5, Today.AddDays(1), Today.AddDays(1)), "Om is away");
        await Refused(await HandOver(_om, 2, Today.AddDays(1), Today.AddDays(4)), "already handed over");
        Assert.Equal(HttpStatusCode.Forbidden, (await HandOver(_dev, 5, Today, Today)).StatusCode);   // developers have nothing to hand over
    }

    [Fact]
    public async Task Without_a_hand_over_a_team_lead_cannot_approve_other_teams_wfh()
    {
        var wfh = await WfhRequest(_ravi);                  // Ravi reports to the manager
        Assert.Equal(HttpStatusCode.Forbidden, (await _om.PostAsJsonAsync($"/api/wfh-requests/{wfh}/approve", new { note = "ok" })).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await _tina.PostAsJsonAsync($"/api/wfh-requests/{wfh}/reject", new { note = "no" })).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await _manager.PostAsJsonAsync($"/api/wfh-requests/{wfh}/approve", new { note = "ok" })).StatusCode);
    }
}
