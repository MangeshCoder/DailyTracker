using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using DailyTrackerAPI.Data;
using DailyTrackerAPI.Helpers;
using DailyTrackerAPI.Models.Auth;
using DailyTrackerAPI.Models.HR;
using Microsoft.Extensions.DependencyInjection;

namespace DailyTrackerAPI.Tests;

/// <summary>
/// Expense claims (1 Oct 2026): a bill with the amount, approved by the manager /
/// team lead, paid back with that month's salary. Bills are private.
///   1 Mangesh (Manager) · 2 Tina (Team Lead) · 3 Priya (reports to Tina)
///   4 Ravi (reports to Mangesh) · 5 Om (Team Lead, nobody reports to him)
/// </summary>
public class ExpenseTests : IDisposable
{
    private readonly ApiFactory _factory = new();
    private readonly HttpClient _manager, _lead, _priya, _ravi, _om;
    private static readonly DateTime Today = AppClock.TodayIst;
    private static readonly byte[] Pdf = Encoding.ASCII.GetBytes("%PDF-1.4\n% bill\n1 0 obj << >> endobj\n%%EOF");
    private static readonly byte[] Png = { 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0, 0, 0, 0x0D };

    public ExpenseTests()
    {
        var users = new[]
        {
            new User { Id = 1, FullName = "Mangesh", Email = "m@test.dev", PasswordHash = "x", Role = "Manager", IsActive = true },
            new User { Id = 2, FullName = "Tina", Email = "t@test.dev", PasswordHash = "x", Role = "TeamLead", IsActive = true, ManagerId = 1 },
            new User { Id = 3, FullName = "Priya", Email = "p@test.dev", PasswordHash = "x", Role = "Developer", IsActive = true, ManagerId = 2 },
            new User { Id = 4, FullName = "Ravi", Email = "r@test.dev", PasswordHash = "x", Role = "Developer", IsActive = true, ManagerId = 1 },
            new User { Id = 5, FullName = "Om", Email = "o@test.dev", PasswordHash = "x", Role = "TeamLead", IsActive = true, ManagerId = 1 },
        };
        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            TestDatabase.CreateSchema(db);
            db.Users.AddRange(users);
            db.SaveChanges();
            db.EmployeeSalaries.Add(new EmployeeSalary { UserId = 3, MonthlySalary = 44000, Currency = "INR", SetByUserId = 1 });
            db.SaveChanges();
            TestDatabase.AfterSeed(db);
        }
        _manager = ClientFor(users[0]);
        _lead = ClientFor(users[1]);
        _priya = ClientFor(users[2]);
        _ravi = ClientFor(users[3]);
        _om = ClientFor(users[4]);
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

    private static Task<HttpResponseMessage> Claim(HttpClient c, decimal amount = 450.50m, string category = "Travel",
        DateTime? date = null, byte[]? file = null, string fileName = "cab.pdf", string description = "Cab to client office")
    {
        var form = new MultipartFormDataContent
        {
            { new StringContent((date ?? Today).ToString("yyyy-MM-dd")), "expenseDate" },
            { new StringContent(category), "category" },
            { new StringContent(amount.ToString(System.Globalization.CultureInfo.InvariantCulture)), "amount" },
            { new StringContent(description), "description" },
        };
        if (file != null)
            form.Add(new ByteArrayContent(file) { Headers = { ContentType = new MediaTypeHeaderValue("application/pdf") } }, "receipt", fileName);
        return c.PostAsync("/api/expenses", form);
    }

    private async Task<int> Submitted(HttpClient c, decimal amount = 450.50m) =>
        (await Json(await Claim(c, amount, file: Pdf))).GetProperty("id").GetInt32();

    [Fact]
    public async Task A_claim_with_a_bill_reaches_the_employees_team_lead_and_the_manager_only()
    {
        var r = await Claim(_priya, file: Pdf);
        Assert.Equal(HttpStatusCode.OK, r.StatusCode);
        var claim = await Json(r);
        Assert.Equal("Pending", claim.GetProperty("status").GetString());
        Assert.Equal(450.50m, claim.GetProperty("amount").GetDecimal());

        Assert.Single((await Json(await _lead.GetAsync("/api/expenses/pending"))).EnumerateArray());
        Assert.Single((await Json(await _manager.GetAsync("/api/expenses/pending"))).EnumerateArray());
        Assert.Empty((await Json(await _om.GetAsync("/api/expenses/pending"))).EnumerateArray());
        Assert.Equal(HttpStatusCode.Forbidden, (await _priya.GetAsync("/api/expenses/pending")).StatusCode);
        Assert.True(Db(db => db.Notifications.Any(n => n.UserId == 2 && n.Title.Contains("Expense"))));
        Assert.StartsWith("expenses/3/", Db(db => db.ExpenseClaims.Single().ReceiptKey));   // private storage, not uploads/
    }

    [Theory]
    [InlineData(0, "Travel", 0, true, "amount")]
    [InlineData(150000, "Travel", 0, true, "at most")]
    [InlineData(100, "Shopping", 0, true, "category")]
    [InlineData(100, "Food", -1, true, "future")]
    [InlineData(100, "Food", 91, true, "older than")]
    [InlineData(100, "Food", 0, false, "attach the bill")]
    public async Task Bad_claims_are_refused_with_a_clear_message(decimal amount, string category, int daysAgo, bool withBill, string message)
    {
        var r = await Claim(_priya, amount, category, Today.AddDays(-daysAgo), withBill ? Pdf : null);
        Assert.Equal(HttpStatusCode.BadRequest, r.StatusCode);
        Assert.Contains(message, await Message(r));
        Assert.False(Db(db => db.ExpenseClaims.Any()));
    }

    [Fact]
    public async Task A_file_that_is_not_really_a_pdf_or_photo_is_refused()
    {
        var r = await Claim(_priya, file: Encoding.ASCII.GetBytes("<script>alert(1)</script>"), fileName: "bill.pdf");
        Assert.Equal(HttpStatusCode.BadRequest, r.StatusCode);
        Assert.Contains("PDF, JPG, PNG or WEBP", await Message(r));
        Assert.Equal(HttpStatusCode.OK, (await Claim(_priya, file: Png, fileName: "photo.png")).StatusCode);
    }

    [Fact]
    public async Task Only_the_employee_and_their_approvers_can_open_the_bill()
    {
        var id = await Submitted(_priya);
        var own = await _priya.GetAsync($"/api/expenses/{id}/receipt");
        Assert.Equal(HttpStatusCode.OK, own.StatusCode);
        Assert.Equal(Pdf, await own.Content.ReadAsByteArrayAsync());
        Assert.Equal(HttpStatusCode.OK, (await _lead.GetAsync($"/api/expenses/{id}/receipt")).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await _manager.GetAsync($"/api/expenses/{id}/receipt")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await _ravi.GetAsync($"/api/expenses/{id}/receipt")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await _om.GetAsync($"/api/expenses/{id}/receipt")).StatusCode);
    }

    [Fact]
    public async Task An_approved_claim_is_paid_with_this_months_salary()
    {
        var before = await Json(await _priya.GetAsync($"/api/payroll/my?month={Today.Month}&year={Today.Year}"));
        var id = await Submitted(_priya, 1200m);
        Assert.Equal(HttpStatusCode.Forbidden, (await _om.PutAsJsonAsync($"/api/expenses/{id}/review", new { status = "Approved" })).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await _lead.PutAsJsonAsync($"/api/expenses/{id}/review", new { status = "Approved" })).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await _lead.PutAsJsonAsync($"/api/expenses/{id}/review", new { status = "Rejected", note = "x" })).StatusCode);

        var slip = await Json(await _priya.GetAsync($"/api/payroll/my?month={Today.Month}&year={Today.Year}"));
        Assert.Equal(1200m, slip.GetProperty("reimbursements").GetDecimal());
        Assert.Equal(before.GetProperty("netPay").GetDecimal() + 1200m, slip.GetProperty("netPay").GetDecimal());
        Assert.Equal(before.GetProperty("grossEarnings").GetDecimal(), slip.GetProperty("grossEarnings").GetDecimal());   // not salary
        var html = await (await _priya.GetAsync($"/api/payroll/my/download?month={Today.Month}&year={Today.Year}")).Content.ReadAsStringAsync();
        Assert.Contains("Reimbursements (approved expense claims)", html);

        var mine = (await Json(await _priya.GetAsync("/api/expenses/my")))[0];
        Assert.Equal(new DateTime(Today.Year, Today.Month, 1).ToString("MMMM yyyy"), mine.GetProperty("paidWith").GetString());
        Assert.True(Db(db => db.Notifications.Any(n => n.UserId == 3 && n.Title.Contains("approved"))));
    }

    [Fact]
    public async Task Declining_needs_a_reason_and_a_team_lead_cannot_approve_their_own_claim()
    {
        var id = await Submitted(_priya);
        var noReason = await _lead.PutAsJsonAsync($"/api/expenses/{id}/review", new { status = "Rejected" });
        Assert.Equal(HttpStatusCode.BadRequest, noReason.StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await _lead.PutAsJsonAsync($"/api/expenses/{id}/review", new { status = "Rejected", note = "Personal trip" })).StatusCode);
        Assert.Equal("Rejected", (await Json(await _priya.GetAsync("/api/expenses/my")))[0].GetProperty("status").GetString());

        var own = await Submitted(_lead);
        Assert.Empty((await Json(await _lead.GetAsync("/api/expenses/pending"))).EnumerateArray());
        Assert.Equal(HttpStatusCode.Forbidden, (await _lead.PutAsJsonAsync($"/api/expenses/{own}/review", new { status = "Approved" })).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await _manager.PutAsJsonAsync($"/api/expenses/{own}/review", new { status = "Approved" })).StatusCode);
    }

    [Fact]
    public async Task A_waiting_claim_can_be_withdrawn_a_decided_one_cannot()
    {
        var waiting = await Submitted(_priya);
        var decided = await Submitted(_priya);
        await _lead.PutAsJsonAsync($"/api/expenses/{decided}/review", new { status = "Approved" });

        Assert.Equal(HttpStatusCode.NotFound, (await _ravi.DeleteAsync($"/api/expenses/{waiting}")).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await _priya.DeleteAsync($"/api/expenses/{waiting}")).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await _priya.DeleteAsync($"/api/expenses/{decided}")).StatusCode);
        Assert.Single((await Json(await _priya.GetAsync("/api/expenses/my"))).EnumerateArray());
    }

    [Fact]
    public async Task The_excel_file_has_my_claims_or_my_teams()
    {
        await Submitted(_priya);
        await Submitted(_ravi, 99m);
        var mine = await _priya.GetAsync("/api/expenses/export");
        Assert.Equal(XlsxWriter.ContentType, mine.Content.Headers.ContentType?.MediaType);
        using var zip = new System.IO.Compression.ZipArchive(await mine.Content.ReadAsStreamAsync());
        using var sheet = new StreamReader(zip.GetEntry("xl/worksheets/sheet1.xml")!.Open());
        var text = await sheet.ReadToEndAsync();
        Assert.Contains("Priya", text);
        Assert.DoesNotContain("Ravi", text);
        Assert.Equal(HttpStatusCode.OK, (await _manager.GetAsync("/api/expenses/export")).StatusCode);
    }
}
