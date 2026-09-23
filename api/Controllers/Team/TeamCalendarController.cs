using DailyTrackerAPI.Data;
using DailyTrackerAPI.DTOs;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace DailyTrackerAPI.Controllers.Team
{
    // ─── Team Availability Calendar ──────────────────────────────────────────
    // GET /api/team-calendar?month=6&year=2025
    //
    // STATUS PRIORITY for each (user, day) pair:
    //   Leave         → approved LeaveRequest spanning that date
    //   WFH / HalfDay → approved WFHRequest
    //   DailyLog      → use log.DayStatus ("Present","WFH","Weekend","Holiday")
    //   Past weekday  → Absent
    //   Future/today  → Unknown
    //
    // KEY FIX: Removed "if (!isWeekend)" guard.
    // Weekend days are now processed the same as weekdays.
    // If an employee checked in on Saturday/Sunday, their log exists and they
    // appear in the calendar cell with status "Weekend" (orange dot).
    // If no one checked in on a weekend, no member rows are added for that day
    // (so the cell stays empty — not showing everyone as "Absent").

    [ApiController, Route("api/team-calendar"), Authorize]
    public class TeamCalendarController : ControllerBase
    {
        private readonly AppDbContext _db;

        public TeamCalendarController(AppDbContext db) => _db = db;

        [HttpGet]
        public async Task<IActionResult> GetCalendar(
            [FromQuery] int? month = null,
            [FromQuery] int? year = null)
        {
            var today = DateTime.UtcNow.Date;
            var m = month ?? today.Month;
            var y = year ?? today.Year;

            var from = new DateTime(y, m, 1);
            var to = from.AddMonths(1);          // exclusive upper bound
            var daysInMonth = DateTime.DaysInMonth(y, m);

            // ── 1. Active users ───────────────────────────────────────────────
            var users = await _db.Users
                .Where(u => u.IsActive)
                .Select(u => new { u.Id, u.FullName, u.Role, u.ProfilePhotoUrl })
                .OrderBy(u => u.FullName)
                .ToListAsync();

            // ── 2. DailyLogs ──────────────────────────────────────────────────
            var logs = await _db.DailyLogs
                .Where(d => d.LogDate >= from && d.LogDate < to)
                .Select(d => new { d.UserId, Date = d.LogDate.Date, d.CheckInTime, d.DayStatus })
                .ToListAsync();

            // ── 3. Approved WFH / HalfDay requests ───────────────────────────
            var wfhRequests = await _db.WFHRequests
                .Where(r => r.RequestDate >= from && r.RequestDate < to && r.Status == "Approved")
                .Select(r => new { r.UserId, Date = r.RequestDate.Date, r.RequestType })
                .ToListAsync();

            // ── 4. Approved Leave requests ────────────────────────────────────
            var leaveRequests = await _db.LeaveRequests
                .Where(l => l.Status == "Approved" && l.FromDate < to && l.ToDate >= from)
                .Select(l => new { l.UserId, l.FromDate, l.ToDate, l.LeaveType })
                .ToListAsync();

            // ── 5. Holidays ───────────────────────────────────────────────────
            var holidays = await _db.Holidays
                .Where(h => h.Year == y)
                .Select(h => new { Date = h.Date.Date, h.Name })
                .ToDictionaryAsync(h => h.Date);

            // ── 6. Pre-index for fast lookup ──────────────────────────────────
            var logIndex = logs.ToLookup(l => (l.UserId, l.Date));
            var wfhIndex = wfhRequests.ToLookup(r => (r.UserId, r.Date));

            // ── 7. Build day-by-day grid ──────────────────────────────────────
            var days = new List<CalendarDayDto>(daysInMonth);

            for (int d = 1; d <= daysInMonth; d++)
            {
                var date = new DateTime(y, m, d);
                var isWeekend = date.DayOfWeek is DayOfWeek.Saturday or DayOfWeek.Sunday;
                holidays.TryGetValue(date, out var holiday);

                var day = new CalendarDayDto
                {
                    Date = date.ToString("yyyy-MM-dd"),
                    Weekday = date.ToString("ddd"),
                    IsWeekend = isWeekend,
                    IsHoliday = holiday != null,
                    HolidayName = holiday?.Name,
                    IsToday = date == today,
                };

                // ── Process members for ALL days including weekends ────────────
                // (employees can and do check in on Saturday/Sunday)
                foreach (var user in users)
                {
                    var status = "Unknown";
                    string? leaveType = null;

                    // Priority 1 — approved leave spanning this date
                    var onLeave = leaveRequests.FirstOrDefault(l =>
                        l.UserId == user.Id &&
                        l.FromDate.Date <= date &&
                        l.ToDate.Date >= date);

                    if (onLeave != null)
                    {
                        status = "Leave";
                        leaveType = onLeave.LeaveType;
                    }
                    else
                    {
                        // Priority 2 — approved WFH / HalfDay (relevant on working days)
                        var wfh = wfhIndex[(user.Id, date)].FirstOrDefault();
                        if (wfh != null)
                        {
                            status = wfh.RequestType; // "WFH" or "HalfDay"
                        }
                        else
                        {
                            // Priority 3 — actual DailyLog (covers Weekend, Holiday, Present, WFH)
                            var log = logIndex[(user.Id, date)].FirstOrDefault();
                            if (log != null)
                            {
                                // Use the real DayStatus from the log.
                                // On Saturdays/Sundays this will be "Weekend".
                                // On public holidays this will be "Holiday".
                                status = log.DayStatus;
                            }
                            else if (isWeekend || holiday != null)
                            {
                                // Weekend or holiday with no check-in:
                                // Skip this user — don't show them as Absent on off-days
                                continue;
                            }
                            else if (date < today)
                            {
                                // Past working day, no log → Absent
                                status = "Absent";
                            }
                            // Future or today with no log → stays "Unknown"
                        }
                    }

                    day.Members.Add(new CalendarMemberDayDto
                    {
                        UserId = user.Id,
                        FullName = user.FullName,
                        ProfilePhotoUrl = user.ProfilePhotoUrl,
                        Role = user.Role,
                        Status = status,
                        LeaveType = leaveType,
                    });
                }

                days.Add(day);
            }

            return Ok(new TeamCalendarResponseDto
            {
                Month = m,
                Year = y,
                Label = from.ToString("MMMM yyyy"),
                Days = days,
            });
        }
    }
}
