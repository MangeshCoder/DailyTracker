using DailyTrackerAPI.Data;
using DailyTrackerAPI.DTOs;
using DailyTrackerAPI.Helpers;
using DailyTrackerAPI.Models.Auth;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace DailyTrackerAPI.Controllers.Attendance
{
    // ─────────────────────────────────────────────────────────────────────────
    //  OvertimeController
    //
    //  No separate service file — overtime is derived data (read-only).
    //  Same pattern as TeamCalendarController.
    //
    //  Standard hours source (priority order):
    //    1. DailyGoal.TargetWorkMinutes for that user + date (if set)
    //    2. 480 minutes (8 hours) — matches rest of codebase default
    //
    //  Overtime = MAX(0, TotalWorkMinutes − StandardMinutes)
    //
    //  Endpoints:
    //    GET /api/overtime/my?month=X&year=Y         → own monthly overtime
    //    GET /api/overtime/team?month=X&year=Y       → full team (Manager/TeamLead)
    // ─────────────────────────────────────────────────────────────────────────
    [ApiController, Route("api/overtime"), Authorize]
    public class OvertimeController : ControllerBase
    {
        private readonly AppDbContext _db;

        public OvertimeController(AppDbContext db) => _db = db;

        // ── GET /api/overtime/my ──────────────────────────────────────────────
        [HttpGet("my")]
        public async Task<IActionResult> GetMyOvertime(
            [FromQuery] int? month, [FromQuery] int? year)
        {
            var now = DateTime.UtcNow;
            var m = month ?? now.Month;
            var y = year ?? now.Year;
            var userId = User.GetUserId();

            var summary = await BuildSummaryAsync(userId, m, y);
            return Ok(summary);
        }

        // ── GET /api/overtime/team ────────────────────────────────────────────
        [HttpGet("team"), Authorize(Roles = "Manager,TeamLead")]
        public async Task<IActionResult> GetTeamOvertime(
            [FromQuery] int? month, [FromQuery] int? year)
        {
            var now = DateTime.UtcNow;
            var m = month ?? now.Month;
            var y = year ?? now.Year;

            var users = await _db.Users
                .Where(u => u.IsActive)
                .OrderBy(u => u.FullName)
                .ToListAsync();

            var members = new List<OvertimeSummaryDto>();
            foreach (var u in users)
                members.Add(await BuildSummaryAsync(u.Id, m, y, u));

            // Most overtime first
            members = members.OrderByDescending(s => s.TotalOvertimeMinutes).ToList();

            var teamTotal = members.Sum(s => s.TotalOvertimeMinutes);
            var monthLabel = new DateTime(y, m, 1).ToString("MMMM yyyy");

            return Ok(new TeamOvertimeDto
            {
                Month = m,
                Year = y,
                MonthLabel = monthLabel,
                TeamTotalOvertimeMinutes = teamTotal,
                TeamTotalOvertimeHours = FormatMinutes(teamTotal),
                TeamMembersWithOvertime = members.Count(s => s.TotalOvertimeMinutes > 0),
                Members = members,
            });
        }

        // ── Core calculation ──────────────────────────────────────────────────
        private async Task<OvertimeSummaryDto> BuildSummaryAsync(
            int userId, int month, int year,
            User? userObj = null)
        {
            userObj ??= await _db.Users.FindAsync(userId);
            if (userObj == null) return new OvertimeSummaryDto();

            var from = new DateTime(year, month, 1);
            var to = from.AddMonths(1).AddDays(-1);

            // All DailyLogs for this user this month (skip Absent — no work minutes)
            var logs = await _db.DailyLogs
                .Where(d => d.UserId == userId
                         && d.LogDate >= from
                         && d.LogDate <= to
                         && d.DayStatus != "Absent")
                .OrderBy(d => d.LogDate)
                .ToListAsync();

            // Per-day goals (if employee set a custom target for any day)
            var goals = await _db.DailyGoals
                .Where(g => g.UserId == userId
                         && g.GoalDate >= from
                         && g.GoalDate <= to)
                .ToListAsync();

            // ── Build per-day list ────────────────────────────────────────────
            var days = new List<OvertimeDayDto>();

            foreach (var log in logs)
            {
                var goal = goals.FirstOrDefault(g => g.GoalDate.Date == log.LogDate.Date);
                var standard = (goal?.TargetWorkMinutes > 0) ? goal.TargetWorkMinutes : 480;
                var overtime = Math.Max(0, log.TotalWorkMinutes - standard);

                days.Add(new OvertimeDayDto
                {
                    Date = log.LogDate,
                    DateLabel = log.LogDate.ToString("ddd, MMM dd"),
                    DayStatus = log.DayStatus,
                    WorkMinutes = log.TotalWorkMinutes,
                    StandardMinutes = standard,
                    OvertimeMinutes = overtime,
                    WorkHours = FormatMinutes(log.TotalWorkMinutes),
                    OvertimeHours = FormatMinutes(overtime),
                    HasOvertime = overtime > 0,
                });
            }

            // ── Weekly breakdown ──────────────────────────────────────────────
            var weeks = BuildWeeks(days, from);

            // ── Aggregates ────────────────────────────────────────────────────
            var totalOT = days.Sum(d => d.OvertimeMinutes);
            var otDays = days.Count(d => d.HasOvertime);
            var peakDay = days.OrderByDescending(d => d.OvertimeMinutes).FirstOrDefault();
            var avgOT = otDays > 0 ? totalOT / otDays : 0;
            var stdAvg = days.Count > 0 ? (int)days.Average(d => d.StandardMinutes) : 480;

            return new OvertimeSummaryDto
            {
                UserId = userId,
                FullName = userObj.FullName,
                Role = userObj.Role,
                Month = month,
                Year = year,
                TotalOvertimeMinutes = totalOT,
                TotalOvertimeHours = FormatMinutes(totalOT),
                DaysWithOvertime = otDays,
                TotalWorkingDays = days.Count,
                AvgOvertimePerDayMinutes = avgOT,
                AvgOvertimePerDayHours = FormatMinutes(avgOT),
                PeakOvertimeDate = (peakDay?.HasOvertime == true) ? peakDay.Date : null,
                PeakOvertimeMinutes = peakDay?.OvertimeMinutes ?? 0,
                PeakOvertimeHours = FormatMinutes(peakDay?.OvertimeMinutes ?? 0),
                StandardMinutesPerDay = stdAvg,
                Days = days,
                Weeks = weeks,
            };
        }

        // ── Weekly grouping ───────────────────────────────────────────────────
        private static List<OvertimeWeekDto> BuildWeeks(
            List<OvertimeDayDto> days, DateTime monthStart)
        {
            if (!days.Any()) return new List<OvertimeWeekDto>();

            // Determine offset so week starts on Monday
            var firstDow = (int)monthStart.DayOfWeek;           // 0=Sun … 6=Sat
            var mondayShift = (firstDow == 0) ? 6 : firstDow - 1;  // days from Mon to first of month

            var grouped = days
                .GroupBy(d => (d.Date.Day + mondayShift - 1) / 7 + 1)
                .OrderBy(g => g.Key);

            var result = new List<OvertimeWeekDto>();
            foreach (var g in grouped)
            {
                var sorted = g.OrderBy(d => d.Date).ToList();
                var wStart = sorted.First().Date;
                var wEnd = sorted.Last().Date;
                var totalOT = g.Sum(d => d.OvertimeMinutes);

                result.Add(new OvertimeWeekDto
                {
                    WeekNumber = g.Key,
                    WeekLabel = $"Week {g.Key} ({wStart:MMM d}–{wEnd:MMM d})",
                    TotalOvertimeMinutes = totalOT,
                    TotalOvertimeHours = FormatMinutes(totalOT),
                    DaysWithOvertime = g.Count(d => d.HasOvertime),
                });
            }

            return result;
        }

        private static string FormatMinutes(int minutes)
        {
            var h = minutes / 60;
            var m = minutes % 60;
            return $"{h}h {m}m";
        }
    }
}
