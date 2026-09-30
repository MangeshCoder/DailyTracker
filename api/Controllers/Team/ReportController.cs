using DailyTrackerAPI.Helpers;
using DailyTrackerAPI.Services.Team;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace DailyTrackerAPI.Controllers.Team
{
    // ─────────────────────────────────────────────────────────────────────────
    //  ReportController  – accessible by all authenticated users (own report)
    //
    //  Routes:
    //    GET /api/report/my?from=&to=             → own full report (JSON)
    //    GET /api/report/my/download?format=&from=&to= → download own report
    //    GET /api/report/my/attendance?month=&year=    → own monthly attendance
    //    GET /api/report/my/calendar?month=&year=      → own attendance calendar
    // ─────────────────────────────────────────────────────────────────────────

    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class ReportController : ControllerBase
    {
        private readonly IManagerService _managerService;
        private readonly IReportService _reportService;

        public ReportController(IManagerService managerService, IReportService reportService)
        {
            _managerService = managerService;
            _reportService = reportService;
        }

        /// <summary>Get current user's full report data.</summary>
        [HttpGet("my")]
        public async Task<IActionResult> GetMyReport(
            [FromQuery] DateTime? from,
            [FromQuery] DateTime? to)
        {
            var userId = User.GetUserId();
            var fromDate = from ?? DateTime.UtcNow.AddDays(-30);
            var toDate = to ?? DateTime.UtcNow;

            var result = await _managerService.GetUserFullReportAsync(userId, fromDate, toDate);
            return Ok(result);
        }

        /// <summary>Download current user's own report.</summary>
        [HttpGet("my/download")]
        public async Task<IActionResult> DownloadMyReport(
            [FromQuery] string format = "pdf",
            [FromQuery] DateTime? from = null,
            [FromQuery] DateTime? to = null)
        {
            var userId = User.GetUserId();
            var fromDate = from ?? DateTime.UtcNow.AddDays(-30);
            var toDate = to ?? DateTime.UtcNow;

            var report = await _managerService.GetUserFullReportAsync(userId, fromDate, toDate);

            var safeName = report.User.FullName.Replace(" ", "_");
            var period = $"{fromDate:yyyyMMdd}_to_{toDate:yyyyMMdd}";

            if (format.Equals("xlsx", StringComparison.OrdinalIgnoreCase))
            {
                var bytes = new XlsxWriter()
                    .AddSheet("Summary", new[] { "Employee", "From", "To", "Working days", "Days present", "Attendance %",
                                                 "Total hours", "Avg hours / day", "Tasks completed", "Tasks logged", "Support given" },
                        new[] { new object?[] { report.User.FullName, report.FromDate.Date, report.ToDate.Date, report.TotalWorkingDays,
                            report.DaysPresent, Math.Round(report.AttendancePercentage, 1), report.TotalWorkHours,
                            Math.Round(report.AverageDailyHours, 2), report.TotalTasksCompleted, report.TotalTasksLogged, report.TotalSupportGiven } })
                    .AddSheet("Daily", new[] { "Date", "Day", "Status", "Check-in (IST)", "Check-out (IST)", "Work hours", "Break minutes", "Tasks", "Support", "Notes" },
                        report.DailyEntries.OrderBy(e => e.Date).Select(e => new object?[] { e.Date.Date, e.Date.DayOfWeek.ToString(), e.DayStatus,
                            e.CheckIn, e.CheckOut, e.WorkHours, e.BreakMinutes, string.Join("; ", e.TasksSummary), string.Join("; ", e.SupportSummary), e.Notes }))
                    .ToBytes();
                return File(bytes, XlsxWriter.ContentType, $"MyReport_{safeName}_{period}.xlsx");
            }

            if (format.Equals("docx", StringComparison.OrdinalIgnoreCase))
            {
                var bytes = _reportService.GenerateWordReport(report);
                return File(bytes,
                    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                    $"MyReport_{safeName}_{period}.docx");
            }
            else
            {
                var bytes = _reportService.GeneratePdfReport(report);
                return File(bytes, "text/html; charset=utf-8",
                    $"MyReport_{safeName}_{period}.html");
            }
        }

        /// <summary>Get current user's monthly attendance summary.</summary>
        [HttpGet("my/attendance")]
        public async Task<IActionResult> GetMyAttendance(
            [FromQuery] int month = 0,
            [FromQuery] int year = 0)
        {
            if (month == 0) month = AppClock.TodayIst.Month;
            if (year == 0) year = AppClock.TodayIst.Year;

            var userId = User.GetUserId();
            var result = await _managerService.GetUserMonthlyAttendanceAsync(userId, month, year);
            return Ok(result);
        }

        /// <summary>My attendance for a month as an Excel file</summary>
        [HttpGet("my/attendance/export")]
        public async Task<IActionResult> ExportMyAttendance([FromQuery] int month = 0, [FromQuery] int year = 0)
        {
            if (month is < 1 or > 12) month = AppClock.TodayIst.Month;
            if (year < 2000) year = AppClock.TodayIst.Year;
            var userId = User.GetUserId();
            var summary = await _managerService.GetUserMonthlyAttendanceAsync(userId, month, year);
            var days = await _managerService.GetUserAttendanceCalendarAsync(userId, month, year);
            var label = new DateTime(year, month, 1).ToString("MMMM yyyy");

            var bytes = new XlsxWriter()
                .AddSheet("Summary", new[] { "Employee", "Month", "Working days", "Present", "WFH", "Half day", "Absent",
                                             "Weekend days worked", "Holidays worked", "Attendance %", "Total hours", "Avg hours / day", "Tasks completed" },
                    new[] { new object?[] { summary.User.FullName, label, summary.WorkingDaysInMonth, summary.DaysPresent, summary.DaysWFH,
                        summary.DaysHalfDay, summary.DaysAbsent, summary.DaysWeekend, summary.DaysHoliday, Math.Round(summary.AttendancePercentage, 1),
                        summary.TotalWorkHours, Math.Round(summary.AverageDailyHours, 2), summary.TotalTasksCompleted } })
                .AddSheet("Daily", new[] { "Date", "Day", "Status", "Check-in (IST)", "Check-out (IST)", "Work hours", "Tasks completed" },
                    days.Select(d => new object?[] { d.Date, d.Date.DayOfWeek.ToString(), d.Status, d.CheckIn, d.CheckOut, d.WorkHours, d.TasksCompleted }))
                .ToBytes();
            return File(bytes, XlsxWriter.ContentType, $"My_Attendance_{label.Replace(" ", "_")}.xlsx");
        }

        /// <summary>Get current user's attendance calendar for a month.</summary>
        [HttpGet("my/calendar")]
        public async Task<IActionResult> GetMyCalendar(
            [FromQuery] int month = 0,
            [FromQuery] int year = 0)
        {
            if (month == 0) month = AppClock.TodayIst.Month;
            if (year == 0) year = AppClock.TodayIst.Year;

            var userId = User.GetUserId();
            var result = await _managerService.GetUserAttendanceCalendarAsync(userId, month, year);
            return Ok(result);
        }
    }
}
