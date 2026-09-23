using DailyTrackerAPI.DTOs;
using DailyTrackerAPI.Services.Team;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace DailyTrackerAPI.Controllers.Team
{
    // ─────────────────────────────────────────────────────────────────────────
    //  ManagerController  – only accessible by Manager role
    //
    //  Routes:
    //    GET /api/manager/team/daily?date=          → all users' activity for a date
    //    GET /api/manager/team/monthly?month=&year= → team monthly stats
    //    GET /api/manager/user/{id}/attendance?month=&year= → one user's attendance
    //    GET /api/manager/user/{id}/calendar?month=&year=   → calendar view
    //    GET /api/manager/user/{id}/report?from=&to=        → full report data
    //    GET /api/manager/user/{id}/download?format=&from=&to= → download PDF/DOCX
    // ─────────────────────────────────────────────────────────────────────────

    [ApiController]
    [Route("api/[controller]")]
    [Authorize(Roles = "Manager,TeamLead")]
    public class ManagerController : ControllerBase
    {
        private readonly IManagerService _managerService;
        private readonly IReportService _reportService;

        public ManagerController(IManagerService managerService, IReportService reportService)
        {
            _managerService = managerService;
            _reportService = reportService;
        }

        /// <summary>Team daily activity overview for a specific date.</summary>
        [HttpGet("team/daily")]
        public async Task<IActionResult> GetTeamDaily([FromQuery] DateTime? date)
        {
            var targetDate = date ?? DateTime.UtcNow;
            var result = await _managerService.GetTeamDailyActivityAsync(targetDate);
            return Ok(result);
        }

        /// <summary>Team monthly attendance and productivity stats.</summary>
        [HttpGet("team/monthly")]
        public async Task<IActionResult> GetTeamMonthly(
            [FromQuery] int month = 0,
            [FromQuery] int year = 0)
        {
            if (month == 0) month = DateTime.UtcNow.Month;
            if (year == 0) year = DateTime.UtcNow.Year;

            var result = await _managerService.GetTeamMonthlyStatsAsync(month, year);
            return Ok(result);
        }

        /// <summary>Single user's monthly attendance summary.</summary>
        [HttpGet("user/{userId}/attendance")]
        public async Task<IActionResult> GetUserAttendance(
            int userId,
            [FromQuery] int month = 0,
            [FromQuery] int year = 0)
        {
            if (month == 0) month = DateTime.UtcNow.Month;
            if (year == 0) year = DateTime.UtcNow.Year;

            try
            {
                var result = await _managerService.GetUserMonthlyAttendanceAsync(userId, month, year);
                return Ok(result);
            }
            catch (KeyNotFoundException)
            {
                return NotFound(new { message = "User not found." });
            }
        }

        /// <summary>Attendance calendar view for a user (day-by-day status).</summary>
        [HttpGet("user/{userId}/calendar")]
        public async Task<IActionResult> GetUserCalendar(
            int userId,
            [FromQuery] int month = 0,
            [FromQuery] int year = 0)
        {
            if (month == 0) month = DateTime.UtcNow.Month;
            if (year == 0) year = DateTime.UtcNow.Year;

            var result = await _managerService.GetUserAttendanceCalendarAsync(userId, month, year);
            return Ok(result);
        }

        /// <summary>Full report data for a user (JSON) over a date range.</summary>
        [HttpGet("user/{userId}/report")]
        public async Task<IActionResult> GetUserReport(
            int userId,
            [FromQuery] DateTime? from,
            [FromQuery] DateTime? to)
        {
            var fromDate = from ?? DateTime.UtcNow.AddDays(-30);
            var toDate = to ?? DateTime.UtcNow;

            try
            {
                var result = await _managerService.GetUserFullReportAsync(userId, fromDate, toDate);
                return Ok(result);
            }
            catch (KeyNotFoundException)
            {
                return NotFound(new { message = "User not found." });
            }
        }

        /// <summary>Download a user's report as PDF (HTML) or DOCX.</summary>
        [HttpGet("user/{userId}/download")]
        public async Task<IActionResult> DownloadUserReport(
            int userId,
            [FromQuery] string format = "pdf",
            [FromQuery] DateTime? from = null,
            [FromQuery] DateTime? to = null)
        {
            var fromDate = from ?? DateTime.UtcNow.AddDays(-30);
            var toDate = to ?? DateTime.UtcNow;

            try
            {
                var report = await _managerService.GetUserFullReportAsync(userId, fromDate, toDate);
                return GenerateFileResult(report, format);
            }
            catch (KeyNotFoundException)
            {
                return NotFound(new { message = "User not found." });
            }
        }

        /// <summary>Activate or Deactivate a user</summary>
        [HttpPut("user/{userId}/toggle-status")]
        public async Task<IActionResult> ToggleUserStatus(int userId)
        {
            try
            {
                var result = await _managerService.ToggleUserStatusAsync(userId);
                return Ok(result);
            }
            catch (KeyNotFoundException)
            {
                return NotFound(new { message = "User not found." });
            }
        }

        [HttpGet("users")]
        public async Task<IActionResult> GetAllUsers()
        {
            try
            {
                var users = await _managerService.GetAllUsersForManagerAsync();
                return Ok(users);
            }
            catch (KeyNotFoundException)
            {
                return NotFound(new { message = "No users found." });
            }
        }

        private FileResult GenerateFileResult(UserFullReportDto report, string format)
        {
            var safeName = report.User.FullName.Replace(" ", "_");
            var period = $"{report.FromDate:yyyyMMdd}_to_{report.ToDate:yyyyMMdd}";

            if (format.Equals("docx", StringComparison.OrdinalIgnoreCase))
            {
                var bytes = _reportService.GenerateWordReport(report);
                return File(bytes,
                    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                    $"Report_{safeName}_{period}.docx");
            }
            else // pdf / html
            {
                var bytes = _reportService.GeneratePdfReport(report);
                return File(bytes, "text/html; charset=utf-8",
                    $"Report_{safeName}_{period}.html");
            }
        }
    }
}
