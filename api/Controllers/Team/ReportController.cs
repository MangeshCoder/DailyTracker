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
            if (month == 0) month = DateTime.UtcNow.Month;
            if (year == 0) year = DateTime.UtcNow.Year;

            var userId = User.GetUserId();
            var result = await _managerService.GetUserMonthlyAttendanceAsync(userId, month, year);
            return Ok(result);
        }

        /// <summary>Get current user's attendance calendar for a month.</summary>
        [HttpGet("my/calendar")]
        public async Task<IActionResult> GetMyCalendar(
            [FromQuery] int month = 0,
            [FromQuery] int year = 0)
        {
            if (month == 0) month = DateTime.UtcNow.Month;
            if (year == 0) year = DateTime.UtcNow.Year;

            var userId = User.GetUserId();
            var result = await _managerService.GetUserAttendanceCalendarAsync(userId, month, year);
            return Ok(result);
        }
    }
}
