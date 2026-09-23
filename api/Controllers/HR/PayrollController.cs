using DailyTrackerAPI.Data;
using DailyTrackerAPI.DTOs;
using DailyTrackerAPI.Helpers;
using DailyTrackerAPI.Models.Auth;
using DailyTrackerAPI.Models.HR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace DailyTrackerAPI.Controllers.HR
{
    // ─────────────────────────────────────────────────────────────────────────
    //  PayrollController
    //
    //  No separate service — uses AppDbContext directly (read-heavy, like Overtime).
    //
    //  PAYROLL FORMULA:
    //    PerDayRate     = MonthlySalary / WorkingDaysInMonth
    //    HourlyRate     = MonthlySalary / (WorkingDaysInMonth × 8)
    //    BasicEarnings = MonthlySalary (full monthly salary, deductions applied separately)
    //    OvertimePay    = (OvertimeMinutes / 60) × HourlyRate × OvertimeMultiplier
    //    GrossEarnings  = BasicEarnings + OvertimePay
    //    Deductions     = (DaysUnpaidLeave + DaysAbsent) × PerDayRate
    //    NetPay         = GrossEarnings − Deductions
    //
    //  Endpoints:
    //    GET /api/payroll/my?month=X&year=Y          → own payslip
    //    GET /api/payroll/salary/my                  → own salary config
    //    GET /api/payroll/team?month=X&year=Y        → full team payroll (Manager/TeamLead)
    //    GET /api/payroll/salary/team                → all salary configs (Manager/TeamLead)
    //    PUT /api/payroll/salary/{userId}            → set salary (Manager/TeamLead)
    // ─────────────────────────────────────────────────────────────────────────
    [ApiController, Route("api/payroll"), Authorize]
    public class PayrollController : ControllerBase
    {
        private readonly AppDbContext _db;

        public PayrollController(AppDbContext db) => _db = db;

        // ── GET /api/payroll/my ───────────────────────────────────────────────
        [HttpGet("my")]
        public async Task<IActionResult> GetMyPayslip(
            [FromQuery] int? month, [FromQuery] int? year)
        {
            var now = DateTime.UtcNow;
            var m = month ?? now.Month;
            var y = year ?? now.Year;
            var userId = User.GetUserId();

            var payslip = await BuildPayslipAsync(userId, m, y);
            return Ok(payslip);
        }

        // ── GET /api/payroll/salary/my ────────────────────────────────────────
        [HttpGet("salary/my")]
        public async Task<IActionResult> GetMySalary()
        {
            var userId = User.GetUserId();
            var salary = await _db.EmployeeSalaries
                .Include(s => s.User)
                .Include(s => s.SetBy)
                .FirstOrDefaultAsync(s => s.UserId == userId);

            if (salary == null)
                return Ok(null);  // employee has no salary configured yet

            return Ok(MapSalaryDto(salary));
        }

        // ── GET /api/payroll/my/download ──────────────────────────────────────
        /// <summary>
        /// Returns a print-ready HTML payslip.
        /// Frontend fetches as blob → opens in new tab → user prints/saves as PDF.
        /// Exact same pattern as GET /api/report/my/download.
        /// </summary>
        [HttpGet("my/download")]
        public async Task<IActionResult> DownloadMyPayslip(
            [FromQuery] int? month, [FromQuery] int? year)
        {
            var now = DateTime.UtcNow;
            var m = month ?? now.Month;
            var y = year ?? now.Year;
            var userId = User.GetUserId();

            var payslip = await BuildPayslipAsync(userId, m, y);
            var html = BuildPayslipHtml(payslip);
            var bytes = System.Text.Encoding.UTF8.GetBytes(html);

            var safeName = payslip.FullName.Replace(" ", "_");
            var fileName = $"Payslip_{safeName}_{payslip.MonthLabel.Replace(" ", "_")}.html";

            return File(bytes, "text/html; charset=utf-8", fileName);
        }

        // ── GET /api/payroll/team ─────────────────────────────────────────────
        [HttpGet("team"), Authorize(Roles = "Manager,TeamLead")]
        public async Task<IActionResult> GetTeamPayroll(
            [FromQuery] int? month, [FromQuery] int? year)
        {
            var now = DateTime.UtcNow;
            var m = month ?? now.Month;
            var y = year ?? now.Year;

            var users = await _db.Users
                .Where(u => u.IsActive)
                .OrderBy(u => u.FullName)
                .ToListAsync();

            var members = new List<PayslipDto>();
            foreach (var u in users)
                members.Add(await BuildPayslipAsync(u.Id, m, y, u));

            var configured = members.Count(p => p.SalaryConfigured);
            var notConfigured = members.Count(p => !p.SalaryConfigured);

            return Ok(new TeamPayrollDto
            {
                Month = m,
                Year = y,
                MonthLabel = new DateTime(y, m, 1).ToString("MMMM yyyy"),
                TeamTotalGross = members.Sum(p => p.GrossEarnings),
                TeamTotalNet = members.Sum(p => p.NetPay),
                TeamTotalDeductions = members.Sum(p => p.TotalDeductions),
                TeamTotalOvertimePay = members.Sum(p => p.OvertimePay),
                MembersConfigured = configured,
                MembersNotConfigured = notConfigured,
                Members = members,
            });
        }

        /// <summary>
        /// Manager report: who came in on weekends and holidays this month.
        /// GET /api/payroll/weekend-holiday-report?month=X&year=Y
        /// </summary>
        [HttpGet("weekend-holiday-report"), Authorize(Roles = "Manager,TeamLead")]
        public async Task<IActionResult> GetWeekendHolidayReport(
            [FromQuery] int? month, [FromQuery] int? year)
        {
            var now = DateTime.UtcNow;
            var m = month ?? now.Month;
            var y = year ?? now.Year;

            var from = new DateTime(y, m, 1);
            var to = from.AddMonths(1).AddDays(-1);

            // Get all weekend/holiday logs for the month
            var logs = await _db.DailyLogs
                .Include(d => d.User)
                .Where(d =>
                    d.LogDate >= from &&
                    d.LogDate <= to &&
                    (d.DayStatus == "Weekend" || d.DayStatus == "Holiday"))
                .OrderBy(d => d.LogDate)
                .ToListAsync();

            // Get holidays for name lookup
            var holidays = await _db.Holidays
                .Where(h => h.Date >= from && h.Date <= to)
                .ToListAsync();

            var entries = logs.Select(l =>
            {
                var holidayName = l.DayStatus == "Holiday"
                    ? holidays.FirstOrDefault(h => h.Date.Date == l.LogDate.Date)?.Name
                    : null;

                return new WeekendHolidayAttendanceDto
                {
                    UserId = l.UserId,
                    FullName = l.User.FullName,
                    Role = l.User.Role,
                    Date = l.LogDate,
                    DayStatus = l.DayStatus,
                    DayOfWeek = l.LogDate.DayOfWeek.ToString(),
                    HolidayName = holidayName,
                    CheckInTime = l.CheckInTime,
                    CheckOutTime = l.CheckOutTime,
                    WorkMinutes = l.TotalWorkMinutes,
                    WorkHours = FormatMinutes(l.TotalWorkMinutes),
                };
            }).ToList();

            return Ok(new
            {
                Month = m,
                Year = y,
                MonthLabel = from.ToString("MMMM yyyy"),
                TotalEntries = entries.Count,
                WeekendEntries = entries.Count(e => e.DayStatus == "Weekend"),
                HolidayEntries = entries.Count(e => e.DayStatus == "Holiday"),
                Entries = entries,
            });
        }

        // ── GET /api/payroll/salary/team ──────────────────────────────────────
        [HttpGet("salary/team"), Authorize(Roles = "Manager,TeamLead")]
        public async Task<IActionResult> GetTeamSalaries()
        {
            var salaries = await _db.EmployeeSalaries
                .Include(s => s.User)
                .Include(s => s.SetBy)
                .OrderBy(s => s.User.FullName)
                .ToListAsync();

            return Ok(salaries.Select(MapSalaryDto).ToList());
        }

        // ── PUT /api/payroll/salary/{userId} ──────────────────────────────────
        [HttpPut("salary/{userId:int}"), Authorize(Roles = "Manager,TeamLead")]
        public async Task<IActionResult> SetSalary(
            int userId, [FromBody] SetSalaryDto dto)
        {
            if (dto.MonthlySalary <= 0)
                return BadRequest(new { message = "Monthly salary must be greater than 0." });

            var employee = await _db.Users.FindAsync(userId);
            if (employee == null || !employee.IsActive)
                return NotFound(new { message = "Employee not found." });

            var managerId = User.GetUserId();
            var existing = await _db.EmployeeSalaries
                .FirstOrDefaultAsync(s => s.UserId == userId);

            if (existing != null)
            {
                // Update existing
                existing.MonthlySalary = dto.MonthlySalary;
                existing.Currency = dto.Currency.Trim().ToUpper();
                existing.OvertimeMultiplier = dto.OvertimeMultiplier;
                existing.SetByUserId = managerId;
                existing.UpdatedAt = DateTime.UtcNow;
            }
            else
            {
                // Create new
                _db.EmployeeSalaries.Add(new EmployeeSalary
                {
                    UserId = userId,
                    MonthlySalary = dto.MonthlySalary,
                    Currency = dto.Currency.Trim().ToUpper(),
                    OvertimeMultiplier = dto.OvertimeMultiplier,
                    SetByUserId = managerId,
                    EffectiveFrom = DateTime.UtcNow,
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow,
                });
            }

            await _db.SaveChangesAsync();

            // Reload to include navigation properties for the response
            var saved = await _db.EmployeeSalaries
                .Include(s => s.User)
                .Include(s => s.SetBy)
                .FirstAsync(s => s.UserId == userId);

            return Ok(MapSalaryDto(saved));
        }

        // ── Core payslip calculation ──────────────────────────────────────────
        private async Task<PayslipDto> BuildPayslipAsync(
            int userId, int month, int year,
            User? userObj = null)
        {
            userObj ??= await _db.Users.FindAsync(userId);
            if (userObj == null) return new PayslipDto();

            var from = new DateTime(year, month, 1);
            var to = from.AddMonths(1).AddDays(-1);
            var monthLabel = from.ToString("MMMM yyyy");

            // ── Salary config ──────────────────────────────────────────────
            var salary = await _db.EmployeeSalaries
                .FirstOrDefaultAsync(s => s.UserId == userId);

            var monthlySalary = salary?.MonthlySalary ?? 0m;
            var currency = salary?.Currency ?? "INR";
            var otMultiplier = salary?.OvertimeMultiplier ?? 1.5m;
            var configured = salary != null;

            // ── Working days in month (Mon–Fri only) ───────────────────────
            var workingDays = CountWorkingDays(from, to);
            var perDayRate = workingDays > 0 ? monthlySalary / workingDays : 0m;
            var hourlyRate = workingDays > 0 ? monthlySalary / (workingDays * 8m) : 0m;

            // ── DailyLogs for the month ────────────────────────────────────
            var logs = await _db.DailyLogs
                .Where(d => d.UserId == userId
                         && d.LogDate >= from
                         && d.LogDate <= to)
                .ToListAsync();

            // ── DailyGoals for overtime standard calculation ───────────────
            var goals = await _db.DailyGoals
                .Where(g => g.UserId == userId
                         && g.GoalDate >= from
                         && g.GoalDate <= to)
                .ToListAsync();

            // ── Approved leave requests overlapping this month ─────────────
            var leaves = await _db.LeaveRequests
                .Where(l => l.UserId == userId
                         && l.Status == "Approved"
                         && l.FromDate <= to
                         && l.ToDate >= from)
                .ToListAsync();

            // ── Attendance breakdown ───────────────────────────────────────
            int daysPresent = logs.Count(l =>
                l.DayStatus is "Present" or "WFH" or "Weekend" or "Holiday");
            int daysHalfDay = logs.Count(l => l.DayStatus == "HalfDay");
            int daysWeekend = logs.Count(l => l.DayStatus == "Weekend");
            int daysHoliday = logs.Count(l => l.DayStatus == "Holiday");

            // Leave days that fall within this month
            int daysPaidLeave = 0;
            int daysUnpaidLeave = 0;
            foreach (var leave in leaves)
            {
                var leaveFrom = leave.FromDate < from ? from : leave.FromDate;
                var leaveTo = leave.ToDate > to ? to : leave.ToDate;
                var leaveDays = CountWorkingDays(leaveFrom, leaveTo);

                if (leave.LeaveType == "Unpaid")
                    daysUnpaidLeave += leaveDays;
                else
                    daysPaidLeave += leaveDays;
            }

            // Absent = working days not covered by any presence or leave
            var coveredDays = daysPresent
                            + daysHalfDay
                            + daysPaidLeave
                            + daysUnpaidLeave;
            var daysAbsent = Math.Max(0, workingDays - coveredDays);

            // ── Overtime calculation ───────────────────────────────────────
            int totalOvertimeMinutes = 0;
            foreach (var log in logs.Where(l => l.DayStatus != "Absent"))
            {
                var goal = goals.FirstOrDefault(g => g.GoalDate.Date == log.LogDate.Date);
                var standard = (goal?.TargetWorkMinutes > 0) ? goal.TargetWorkMinutes : 480;
                totalOvertimeMinutes += Math.Max(0, log.TotalWorkMinutes - standard);
            }
            var overtimeHours = (decimal)totalOvertimeMinutes / 60m;

            // ── Earnings ──────────────────────────────────────────────────────────
            // CORRECT APPROACH: Start with full monthly salary.
            // Deduct for absent/unpaid/halfday. Add overtime on top.
            // This is the standard payslip model — never double-penalise.
            var basicEarnings = monthlySalary;
            var overtimePay = overtimeHours * hourlyRate * otMultiplier;
            var grossEarnings = basicEarnings + overtimePay;

            // ── Deductions ────────────────────────────────────────────────────────
            // HalfDay   = deduct 0.5 day   (worked half, lose half)
            // UnpaidLeave = deduct full day (approved but no pay)
            // Absent    = deduct full day  (no log, no approved leave)
            var halfDayDeduction = daysHalfDay * 0.5m * perDayRate;
            var unpaidLeaveDeduction = daysUnpaidLeave * perDayRate;
            var absentDeduction = daysAbsent * perDayRate;
            var totalDeductions = halfDayDeduction + unpaidLeaveDeduction + absentDeduction;

            // ── Net Pay ───────────────────────────────────────────────────
            var netPay = grossEarnings - totalDeductions;

            // ── Build readable line items ─────────────────────────────────
            var cur = CurrencySymbol(currency);

            var earnings = new List<PayslipEarningDto>
            {
                new()
                {
                    Label  = "Basic Pay",
                    Amount = basicEarnings,
                    Note   = $"Full monthly salary — {monthLabel}",
                },
            };
            if (overtimePay > 0)
            {
                earnings.Add(new PayslipEarningDto
                {
                    Label = $"Overtime ({otMultiplier}×)",
                    Amount = overtimePay,
                    Note = $"{overtimeHours:0.##}h × {cur}{hourlyRate:N2}/h × {otMultiplier}",
                });
            }

            var deductions = new List<PayslipDeductionDto>();
            if (halfDayDeduction > 0)
            {
                deductions.Add(new PayslipDeductionDto
                {
                    Label = "Half Day Deduction",
                    Amount = halfDayDeduction,
                    Note = $"{daysHalfDay} half day{(daysHalfDay != 1 ? "s" : "")} × {cur}{(perDayRate * 0.5m):N2}",
                });
            }
            if (unpaidLeaveDeduction > 0)
            {
                deductions.Add(new PayslipDeductionDto
                {
                    Label = "Unpaid Leave",
                    Amount = unpaidLeaveDeduction,
                    Note = $"{daysUnpaidLeave} day{(daysUnpaidLeave != 1 ? "s" : "")} × {cur}{perDayRate:N2}",
                });
            }
            if (absentDeduction > 0)
            {
                deductions.Add(new PayslipDeductionDto
                {
                    Label = "Absent Deduction",
                    Amount = absentDeduction,
                    Note = $"{daysAbsent} day{(daysAbsent != 1 ? "s" : "")} × {cur}{perDayRate:N2}",
                });
            }

            return new PayslipDto
            {
                UserId = userId,
                FullName = userObj.FullName,
                Role = userObj.Role,
                Email = userObj.Email,
                Month = month,
                Year = year,
                MonthLabel = monthLabel,
                MonthlySalary = monthlySalary,
                Currency = currency,
                OvertimeMultiplier = otMultiplier,
                SalaryConfigured = configured,
                WorkingDaysInMonth = workingDays,
                PerDayRate = Math.Round(perDayRate, 2),
                HourlyRate = Math.Round(hourlyRate, 2),
                DaysPresent = daysPresent,
                DaysHalfDay = daysHalfDay,
                DaysWeekend = daysWeekend,
                DaysHoliday = daysHoliday,
                DaysPaidLeave = daysPaidLeave,
                DaysUnpaidLeave = daysUnpaidLeave,
                DaysAbsent = daysAbsent,
                OvertimeMinutes = totalOvertimeMinutes,
                OvertimeHours = FormatMinutes(totalOvertimeMinutes),
                BasicEarnings = Math.Round(basicEarnings, 2),
                OvertimePay = Math.Round(overtimePay, 2),
                GrossEarnings = Math.Round(grossEarnings, 2),
                UnpaidLeaveDeduction = Math.Round(unpaidLeaveDeduction, 2),
                AbsentDeduction = Math.Round(absentDeduction, 2),
                TotalDeductions = Math.Round(totalDeductions, 2),
                NetPay = Math.Round(netPay, 2),
                Earnings = earnings,
                Deductions = deductions,
            };
        }

        // ── Helpers ───────────────────────────────────────────────────────────
        private static int CountWorkingDays(DateTime from, DateTime to)
        {
            int count = 0;
            for (var d = from; d <= to; d = d.AddDays(1))
                if (d.DayOfWeek is not DayOfWeek.Saturday and not DayOfWeek.Sunday)
                    count++;
            return count;
        }

        private static string FormatMinutes(int minutes)
        {
            var h = minutes / 60;
            var m = minutes % 60;
            return $"{h}h {m}m";
        }

        private static string CurrencySymbol(string currency) => currency switch
        {
            "INR" => "₹",
            "USD" => "$",
            "EUR" => "€",
            "GBP" => "£",
            _ => currency + " ",
        };

        // ── Payslip HTML builder ──────────────────────────────────────────────
        private static string BuildPayslipHtml(PayslipDto p)
        {
            var cur = p.Currency;
            var sym = CurrencySymbol(cur);
            var logoPath = @"C: \Users\Mangesh Ghule\DailyTrackerAPI\Images\montcrest_software_pvt_ltd_cover.jpg";
            var genDate = DateTime.Now.ToString("dd MMM yyyy, hh:mm tt");

            // ── Helper: format money ──────────────────────────────────────────
            string Fmt(decimal amount) =>
                $"{sym}{amount:N2}";

            // ── Attendance badge color ────────────────────────────────────────
            string AttBadge(string label, int value, string color) =>
                $@"<div class='att-item'>
                     <span class='att-label'>{label}</span>
                     <span class='att-value' style='color:{color}'>{value}</span>
                   </div>";

            // ── Earning / deduction row ───────────────────────────────────────
            string EarnRow(string label, string note, decimal amount, string color) =>
                $@"<tr>
                     <td class='row-label'>{label}</td>
                     <td class='row-note'>{note}</td>
                     <td class='row-amount' style='color:{color}'>{Fmt(amount)}</td>
                   </tr>";

            // ── Build earnings rows ───────────────────────────────────────────
            var earningRows = new System.Text.StringBuilder();
            foreach (var e in p.Earnings)
                earningRows.Append(EarnRow(e.Label, e.Note, e.Amount, "#16a34a"));

            // ── Build deduction rows ──────────────────────────────────────────
            var deductionRows = new System.Text.StringBuilder();
            if (p.Deductions.Count == 0)
            {
                deductionRows.Append(@"<tr>
                    <td colspan='3' style='color:#16a34a;font-style:italic;padding:12px 14px;'>
                      ✓ No deductions this month
                    </td>
                  </tr>");
            }
            else
            {
                foreach (var d in p.Deductions)
                    deductionRows.Append(EarnRow(d.Label, d.Note, d.Amount, "#dc2626"));
            }

            // ── Attendance items ──────────────────────────────────────────────
            var attItems = new System.Text.StringBuilder();
            attItems.Append(AttBadge("Days Present / WFH", p.DaysPresent, "#16a34a"));
            attItems.Append(AttBadge("Half Days", p.DaysHalfDay, "#d97706"));
            attItems.Append(AttBadge("Paid Leave", p.DaysPaidLeave, "#2563eb"));
            attItems.Append(AttBadge("Unpaid Leave", p.DaysUnpaidLeave, "#ea580c"));
            attItems.Append(AttBadge("Absent", p.DaysAbsent, "#dc2626"));

            if (p.OvertimeMinutes > 0)
                attItems.Append($@"<div class='att-item' style='border-top:1px solid #e2e8f0;margin-top:8px;padding-top:8px;'>
                    <span class='att-label'>Overtime Hours</span>
                    <span class='att-value' style='color:#ea580c'>{p.OvertimeHours}</span>
                  </div>");

            // ── Not-configured state ──────────────────────────────────────────
            if (!p.SalaryConfigured)
            {
                return $@"<!DOCTYPE html><html><head><meta charset='UTF-8'/>
                  <title>Payslip Not Configured</title></head>
                  <body style='font-family:Arial;padding:60px;text-align:center;color:#78350f'>
                    <h2>⚠️ Salary Not Configured</h2>
                    <p>Your manager has not set your salary yet.</p>
                  </body></html>";
            }

            return $@"<!DOCTYPE html>
                <html lang='en'>
                <head>
                  <meta charset='UTF-8'/>
                  <title>Payslip – {p.FullName} – {p.MonthLabel}</title>
                  <style>
                    * {{ box-sizing: border-box; margin: 0; padding: 0; }}

                    body {{
                      font-family: 'Segoe UI', Arial, sans-serif;
                      background: #f8fafc;
                      color: #1e293b;
                      padding: 0;
                    }}

                    /* ── Page wrapper ───────────────────────────── */
                    .page {{
                      max-width: 820px;
                      margin: 0 auto;
                      background: #ffffff;
                      min-height: 100vh;
                      box-shadow: 0 0 40px rgba(0,0,0,0.08);
                    }}

                    /* ── Header ─────────────────────────────────── */
                    .header {{
                      background: linear-gradient(135deg, #1e3a5f 0%, #1e40af 100%);
                      padding: 32px 40px;
                      display: flex;
                      justify-content: space-between;
                      align-items: center;
                    }}
                    .header-left {{ display: flex; align-items: center; gap: 16px; }}
                    .company-logo {{ height: 52px; width: auto; object-fit: contain;
                                     background: #fff; border-radius: 8px; padding: 4px 8px; }}
                    .company-name  {{ color: #ffffff; font-size: 20px; font-weight: 800;
                                      letter-spacing: -0.3px; }}
                    .company-sub   {{ color: #93c5fd; font-size: 11px; margin-top: 3px;
                                      text-transform: uppercase; letter-spacing: 1px; }}
                    .header-right  {{ text-align: right; }}
                    .payslip-title {{ color: #ffffff; font-size: 22px; font-weight: 700; }}
                    .payslip-period {{ color: #93c5fd; font-size: 13px; margin-top: 4px; }}
                    .generated-on  {{ color: #6b9bd2; font-size: 11px; margin-top: 2px; }}

                    /* ── Net pay banner ─────────────────────────── */
                    .net-banner {{
                      background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%);
                      border-bottom: 3px solid #16a34a;
                      padding: 24px 40px;
                      display: flex;
                      justify-content: space-between;
                      align-items: center;
                    }}
                    .net-left p {{ color: #166534; font-size: 13px; font-weight: 600; }}
                    .net-amount  {{ color: #15803d; font-size: 38px; font-weight: 800;
                                    letter-spacing: -1px; }}
                    .net-right   {{ text-align: right; }}
                    .net-gross   {{ color: #4b5563; font-size: 13px; }}
                    .net-period  {{ color: #6b7280; font-size: 12px; margin-top: 3px; }}

                    /* ── Body padding ───────────────────────────── */
                    .body {{ padding: 32px 40px; }}

                    /* ── Employee info strip ────────────────────── */
                    .emp-strip {{
                      background: #f8fafc;
                      border: 1px solid #e2e8f0;
                      border-radius: 12px;
                      padding: 20px 24px;
                      display: flex;
                      gap: 48px;
                      margin-bottom: 28px;
                    }}
                    .emp-field label {{ display: block; font-size: 10px; font-weight: 700;
                                        color: #94a3b8; text-transform: uppercase;
                                        letter-spacing: 0.6px; margin-bottom: 4px; }}
                    .emp-field span  {{ font-size: 14px; font-weight: 600; color: #1e293b; }}

                    /* ── Section heading ────────────────────────── */
                    .section-title {{
                      font-size: 13px;
                      font-weight: 700;
                      color: #475569;
                      text-transform: uppercase;
                      letter-spacing: 0.8px;
                      margin-bottom: 12px;
                      padding-bottom: 8px;
                      border-bottom: 2px solid #e2e8f0;
                    }}

                    /* ── Two-column grid ────────────────────────── */
                    .two-col {{ display: grid; grid-template-columns: 1fr 1fr; gap: 20px;
                                margin-bottom: 20px; }}

                    /* ── Card ───────────────────────────────────── */
                    .card {{
                      background: #ffffff;
                      border: 1px solid #e2e8f0;
                      border-radius: 12px;
                      padding: 20px 24px;
                    }}

                    /* ── Attendance list ────────────────────────── */
                    .att-item {{
                      display: flex;
                      justify-content: space-between;
                      align-items: center;
                      padding: 7px 0;
                      border-bottom: 1px solid #f1f5f9;
                    }}
                    .att-item:last-child {{ border-bottom: none; }}
                    .att-label {{ font-size: 13px; color: #475569; }}
                    .att-value {{ font-size: 16px; font-weight: 800; }}

                    /* ── Earnings / deductions table ────────────── */
                    .fin-table {{ width: 100%; border-collapse: collapse; }}
                    .fin-table .row-label  {{ font-size: 13px; font-weight: 600; color: #1e293b;
                                              padding: 10px 14px; width: 40%; }}
                    .fin-table .row-note   {{ font-size: 11px; color: #94a3b8;
                                              padding: 10px 14px; }}
                    .fin-table .row-amount {{ font-size: 14px; font-weight: 700;
                                              padding: 10px 14px; text-align: right; white-space: nowrap; }}
                    .fin-table tr {{ border-bottom: 1px solid #f1f5f9; }}
                    .fin-table tr:last-child {{ border-bottom: none; }}
                    .total-row td {{ background: #f8fafc; font-weight: 700 !important;
                                     font-size: 14px !important; border-top: 2px solid #e2e8f0 !important; }}

                    /* ── Net pay summary table ──────────────────── */
                    .summary-table {{ width: 100%; border-collapse: collapse; }}
                    .summary-table td {{ padding: 10px 0; font-size: 13px; }}
                    .summary-table .s-label {{ color: #475569; }}
                    .summary-table .s-value {{ text-align: right; font-weight: 600; color: #1e293b; }}
                    .summary-table .s-total td {{ border-top: 2px solid #1e293b;
                                                   padding-top: 14px; }}
                    .summary-table .s-total .s-label {{ font-size: 16px; font-weight: 700;
                                                         color: #1e293b; }}
                    .summary-table .s-total .s-value  {{ font-size: 20px; font-weight: 800;
                                                         color: #15803d; }}

                    /* ── Working days note ──────────────────────── */
                    .rate-note {{
                      background: #eff6ff;
                      border: 1px solid #bfdbfe;
                      border-radius: 10px;
                      padding: 14px 20px;
                      font-size: 12px;
                      color: #1e40af;
                      margin-bottom: 20px;
                      display: flex;
                      gap: 32px;
                    }}
                    .rate-note span {{ font-weight: 700; }}

                    /* ── Footer ─────────────────────────────────── */
                    .footer {{
                      margin: 0 40px 32px;
                      padding-top: 20px;
                      border-top: 1px solid #e2e8f0;
                      display: flex;
                      justify-content: space-between;
                      font-size: 11px;
                      color: #94a3b8;
                    }}

                    /* ── Watermark CONFIDENTIAL ─────────────────── */
                    .confidential-stamp {{
                      display: inline-block;
                      border: 2px solid #e2e8f0;
                      color: #cbd5e1;
                      font-size: 11px;
                      font-weight: 700;
                      letter-spacing: 2px;
                      padding: 3px 10px;
                      border-radius: 4px;
                      text-transform: uppercase;
                    }}

                    @media print {{
                      body {{ background: white; }}
                      .page {{ box-shadow: none; }}
                      .header {{ -webkit-print-color-adjust: exact; print-color-adjust: exact; }}
                      .net-banner {{ -webkit-print-color-adjust: exact; print-color-adjust: exact; }}
                    }}
                  </style>
                </head>
                <body>
                  <div class='page'>

                    <!-- ── Header ───────────────────────────────── -->
                    <div class='header'>
                      <div class='header-left'>
                        <img src='{logoPath}' alt='Company Logo' class='company-logo' onerror=""this.style.display='none'"" />
                        <div>
                          <div class='company-name'>Montcrest Software Pvt. Ltd.</div>
                          <div class='company-sub'>Employee Payslip</div>
                        </div>
                      </div>
                      <div class='header-right'>
                        <div class='payslip-title'>PAYSLIP</div>
                        <div class='payslip-period'>{p.MonthLabel}</div>
                        <div class='generated-on'>Generated: {genDate}</div>
                      </div>
                    </div>

                    <!-- ── Net Pay Banner ───────────────────────── -->
                    <div class='net-banner'>
                      <div class='net-left'>
                        <p>💰 NET PAY FOR {p.MonthLabel.ToUpper()}</p>
                        <div class='net-amount'>{Fmt(p.NetPay)}</div>
                      </div>
                      <div class='net-right'>
                        <div class='net-gross'>Gross: {Fmt(p.GrossEarnings)}</div>
                        <div class='net-period'>Deductions: {Fmt(p.TotalDeductions)}</div>
                        <div class='net-period'>{p.WorkingDaysInMonth} working days in {p.MonthLabel}</div>
                      </div>
                    </div>

                    <!-- ── Body ─────────────────────────────────── -->
                    <div class='body'>

                      <!-- Employee Details -->
                      <div class='emp-strip'>
                        <div class='emp-field'>
                          <label>Employee Name</label>
                          <span>{System.Net.WebUtility.HtmlEncode(p.FullName)}</span>
                        </div>
                        <div class='emp-field'>
                          <label>Designation</label>
                          <span>{p.Role}</span>
                        </div>
                        <div class='emp-field'>
                          <label>Email</label>
                          <span>{p.Email}</span>
                        </div>
                        <div class='emp-field'>
                          <label>Pay Period</label>
                          <span>01 {p.MonthLabel} – {p.WorkingDaysInMonth} working days</span>
                        </div>
                      </div>

                      <!-- Rates note -->
                      <div class='rate-note'>
                        <div>Base Salary: <span>{Fmt(p.MonthlySalary)} / month</span></div>
                        <div>Per-Day Rate: <span>{Fmt(p.PerDayRate)}</span></div>
                        <div>Hourly Rate: <span>{Fmt(p.HourlyRate)}</span></div>
                        <div>OT Multiplier: <span>{p.OvertimeMultiplier}×</span></div>
                      </div>

                      <!-- Attendance + Earnings (side by side) -->
                      <div class='two-col'>

                        <!-- Attendance -->
                        <div class='card'>
                          <div class='section-title'>📅 Attendance Summary</div>
                          <div>{attItems}</div>
                        </div>

                        <!-- Earnings -->
                        <div class='card'>
                          <div class='section-title'>💵 Earnings</div>
                          <table class='fin-table'>
                            <tbody>
                              {earningRows}
                            </tbody>
                            <tfoot>
                              <tr class='total-row'>
                                <td class='row-label'>Gross Earnings</td>
                                <td class='row-note'></td>
                                <td class='row-amount' style='color:#1e293b'>{Fmt(p.GrossEarnings)}</td>
                              </tr>
                            </tfoot>
                          </table>
                        </div>

                      </div>

                      <!-- Deductions + Net Summary (side by side) -->
                      <div class='two-col'>

                        <!-- Deductions -->
                        <div class='card'>
                          <div class='section-title'>📉 Deductions</div>
                          <table class='fin-table'>
                            <tbody>
                              {deductionRows}
                            </tbody>
                            {(p.Deductions.Count > 0 ? $@"
                            <tfoot>
                              <tr class='total-row'>
                                <td class='row-label'>Total Deductions</td>
                                <td class='row-note'></td>
                                <td class='row-amount' style='color:#dc2626'>−{Fmt(p.TotalDeductions)}</td>
                              </tr>
                            </tfoot>" : "")}
                          </table>
                        </div>

                        <!-- Net Pay Summary -->
                        <div class='card' style='background:linear-gradient(135deg,#f0fdf4,#dcfce7);
                                                  border-color:#bbf7d0;'>
                          <div class='section-title' style='border-color:#86efac'>✅ Net Pay Summary</div>
                          <table class='summary-table'>
                            <tbody>
                              <tr>
                                <td class='s-label'>Gross Earnings</td>
                                <td class='s-value'>{Fmt(p.GrossEarnings)}</td>
                              </tr>
                              <tr>
                                <td class='s-label'>Total Deductions</td>
                                <td class='s-value' style='color:#dc2626'>−{Fmt(p.TotalDeductions)}</td>
                              </tr>
                              <tr class='s-total'>
                                <td class='s-label'>NET PAY</td>
                                <td class='s-value'>{Fmt(p.NetPay)}</td>
                              </tr>
                            </tbody>
                          </table>
                        </div>

                      </div>

                    </div><!-- /body -->

                    <!-- ── Footer ───────────────────────────────── -->
                    <div class='footer'>
                      <div>
                        <div>Montcrest Software Pvt. Ltd.</div>
                        <div style='margin-top:2px'>This is a system-generated payslip — no signature required.</div>
                      </div>
                      <div style='text-align:right'>
                        <div class='confidential-stamp'>Confidential</div>
                        <div style='margin-top:4px'>Generated on {genDate}</div>
                      </div>
                    </div>

                  </div><!-- /page -->

                  <!-- Print trigger: opens print dialog automatically when page loads -->
                  <script>
                    window.addEventListener('load', function () {{
                      setTimeout(function () {{ window.print(); }}, 600);
                    }});
                  </script>
                </body>
                </html>";
        }

        private static EmployeeSalaryDto MapSalaryDto(EmployeeSalary s) => new()
        {
            UserId = s.UserId,
            FullName = s.User?.FullName ?? "",
            Role = s.User?.Role ?? "",
            MonthlySalary = s.MonthlySalary,
            Currency = s.Currency,
            OvertimeMultiplier = s.OvertimeMultiplier,
            EffectiveFrom = s.EffectiveFrom,
            SetByName = s.SetBy?.FullName ?? "",
            UpdatedAt = s.UpdatedAt,
        };
    }
}
