using System.IO.Compression;
using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using DailyTrackerAPI.Data;
using DailyTrackerAPI.Helpers;
using DailyTrackerAPI.Models.Auth;
using DailyTrackerAPI.Models.HR;
using DailyTrackerAPI.Models.Tasks;
using Microsoft.Extensions.DependencyInjection;

namespace DailyTrackerAPI.Tests;

/// <summary>
/// Excel downloads (30 Sep 2026): attendance, leave, the monthly report and payroll.
/// Each file is a real .xlsx; people only get their own data unless they manage others.
///   1 Mangesh (Manager) · 2 Tina (Team Lead) · 3 Priya (reports to Tina) · 4 Ravi (reports to Mangesh)
/// </summary>
public class ExcelExportTests : IDisposable
{
    private readonly ApiFactory _factory = new();
    private readonly HttpClient _manager, _lead, _priya;
    private static readonly DateTime Today = AppClock.TodayIst;

    public ExcelExportTests()
    {
        var users = new[]
        {
            new User { Id = 1, FullName = "Mangesh", Email = "m@test.dev", PasswordHash = "x", Role = "Manager", IsActive = true },
            new User { Id = 2, FullName = "Tina", Email = "t@test.dev", PasswordHash = "x", Role = "TeamLead", IsActive = true, ManagerId = 1 },
            new User { Id = 3, FullName = "Priya", Email = "p@test.dev", PasswordHash = "x", Role = "Developer", IsActive = true, ManagerId = 2 },
            new User { Id = 4, FullName = "Ravi <R&D>", Email = "r@test.dev", PasswordHash = "x", Role = "Developer", IsActive = true, ManagerId = 1 },
        };
        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            TestDatabase.CreateSchema(db);
            db.Users.AddRange(users);
            db.SaveChanges();
            var checkIn = AppClock.FromIst(Today.AddHours(10).AddMinutes(14));
            db.DailyLogs.Add(new DailyLog { UserId = 3, LogDate = Today, DayStatus = "Present", CheckInTime = checkIn, CheckOutTime = checkIn.AddHours(8), TotalWorkMinutes = 480 });
            db.DailyLogs.Add(new DailyLog { UserId = 4, LogDate = Today, DayStatus = "Present", CheckInTime = checkIn, CheckOutTime = checkIn.AddHours(7), TotalWorkMinutes = 420 });
            db.LeaveRequests.Add(new LeaveRequest { UserId = 3, FromDate = Today.AddDays(20), ToDate = Today.AddDays(20), LeaveType = "Casual", Reason = "=cmd|' /C calc'!A0", Status = "Pending" });
            db.LeaveRequests.Add(new LeaveRequest { UserId = 4, FromDate = Today.AddDays(21), ToDate = Today.AddDays(21), LeaveType = "Sick", Reason = "fever", Status = "Approved" });
            db.EmployeeSalaries.Add(new EmployeeSalary { UserId = 3, MonthlySalary = 50000, Currency = "INR", OvertimeMultiplier = 1.5m, SetByUserId = 1 });
            db.SaveChanges();
            TestDatabase.AfterSeed(db);
        }
        _manager = ClientFor(users[0]);
        _lead = ClientFor(users[1]);
        _priya = ClientFor(users[2]);
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

    /// <summary>Download, check it is a workbook, and return the sheet names and all text in it</summary>
    private static async Task<(List<string> Sheets, string Text)> Xlsx(HttpClient c, string url, string saveAs)
    {
        var r = await c.GetAsync(url);
        Assert.Equal(HttpStatusCode.OK, r.StatusCode);
        Assert.Equal(XlsxWriter.ContentType, r.Content.Headers.ContentType?.MediaType);
        Assert.EndsWith(".xlsx", r.Content.Headers.ContentDisposition?.FileNameStar ?? r.Content.Headers.ContentDisposition?.FileName?.Trim('"'));
        var bytes = await r.Content.ReadAsByteArrayAsync();
        if (Environment.GetEnvironmentVariable("EXPORT_DIR") is { Length: > 0 } dir)
            await File.WriteAllBytesAsync(Path.Combine(dir, saveAs), bytes);

        using var zip = new ZipArchive(new MemoryStream(bytes));
        string Read(string path) { using var s = new StreamReader(zip.GetEntry(path)!.Open()); return s.ReadToEnd(); }
        var workbook = Read("xl/workbook.xml");
        var sheets = System.Text.RegularExpressions.Regex.Matches(workbook, "<sheet name=\"([^\"]+)\"").Select(m => System.Net.WebUtility.HtmlDecode(m.Groups[1].Value)).ToList();
        var text = string.Concat(Enumerable.Range(1, sheets.Count).Select(i => Read($"xl/worksheets/sheet{i}.xml")));
        return (sheets, System.Net.WebUtility.HtmlDecode(text));
    }

    [Fact]
    public async Task A_manager_downloads_team_attendance_with_a_summary_and_every_day_in_India_time()
    {
        var (sheets, text) = await Xlsx(_manager, $"/api/wfh-requests/team-monthly/export?month={Today.Month}&year={Today.Year}", "team-attendance.xlsx");
        Assert.Equal(new[] { "Summary", "Daily" }, sheets);
        Assert.Contains("Ravi <R&D>", text);                       // the same people as the page (direct reports); special characters survive
        Assert.Contains("10:14 AM", text);                         // check-in shown in India time
    }

    [Fact]
    public async Task A_team_lead_gets_only_their_team_and_an_employee_gets_no_team_files()
    {
        var (_, text) = await Xlsx(_lead, "/api/wfh-requests/team-monthly/export", "lead-attendance.xlsx");
        Assert.Contains("Priya", text);
        Assert.DoesNotContain("Ravi", text);

        Assert.Equal(HttpStatusCode.Forbidden, (await _priya.GetAsync("/api/wfh-requests/team-monthly/export")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await _priya.GetAsync("/api/payroll/team/export")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await _lead.GetAsync("/api/payroll/team/export")).StatusCode);
    }

    [Fact]
    public async Task An_employee_downloads_their_own_attendance_and_monthly_report()
    {
        var (sheets, text) = await Xlsx(_priya, "/api/report/my/attendance/export", "my-attendance.xlsx");
        Assert.Equal(new[] { "Summary", "Daily" }, sheets);
        Assert.Contains("10:14 AM", text);

        var from = Today.AddDays(-Today.Day + 1).ToString("yyyy-MM-dd");
        (sheets, text) = await Xlsx(_priya, $"/api/report/my/download?format=xlsx&from={from}&to={Today:yyyy-MM-dd}", "my-report.xlsx");
        Assert.Equal(new[] { "Summary", "Daily" }, sheets);
        Assert.Contains("Priya", text);
    }

    [Fact]
    public async Task Leave_export_has_requests_balances_and_comp_off_and_employees_see_only_their_own()
    {
        var (sheets, text) = await Xlsx(_manager, $"/api/leave/export?year={Today.AddDays(20).Year}", "team-leave.xlsx");
        Assert.Contains("Leave requests", sheets);
        Assert.Contains("Comp-off", sheets);
        Assert.Contains("fever", text);
        Assert.Contains("'=cmd", text);                            // a formula-looking reason stays plain text

        (_, text) = await Xlsx(_priya, $"/api/leave/export?year={Today.AddDays(20).Year}", "my-leave.xlsx");
        Assert.DoesNotContain("fever", text);
        Assert.DoesNotContain("Ravi", text);
    }

    [Fact]
    public async Task A_manager_downloads_payroll_with_a_total_row()
    {
        var (sheets, text) = await Xlsx(_manager, $"/api/payroll/team/export?month={Today.Month}&year={Today.Year}", "payroll.xlsx");
        Assert.Single(sheets);
        Assert.StartsWith("Payroll", sheets[0]);
        Assert.Contains("TOTAL", text);
        Assert.Contains("50000", text);                            // salary is a number, not text
    }
}
