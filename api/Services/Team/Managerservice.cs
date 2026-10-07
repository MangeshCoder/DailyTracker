using DailyTrackerAPI.Data;
using DailyTrackerAPI.DTOs;
using DailyTrackerAPI.Models.Auth;
using DailyTrackerAPI.Models.HR;
using DailyTrackerAPI.Models.Tasks;
using Microsoft.EntityFrameworkCore;
using DailyTrackerAPI.Helpers;

namespace DailyTrackerAPI.Services.Team
{
    public interface IManagerService
    {
        Task<ManagerTeamDailyDto> GetTeamDailyActivityAsync(DateTime date, HashSet<int>? onlyUserIds = null);
        Task<UserAttendanceSummaryDto> GetUserMonthlyAttendanceAsync(int userId, int month, int year);
        Task<TeamMonthlyStatsDto> GetTeamMonthlyStatsAsync(int month, int year, HashSet<int>? onlyUserIds = null);
        Task<UserFullReportDto> GetUserFullReportAsync(int userId, DateTime from, DateTime to);
        Task<List<AttendanceDayDto>> GetUserAttendanceCalendarAsync(int userId, int month, int year);
        Task<object> ToggleUserStatusAsync(int userId);
        Task<List<UserDto>> GetAllUsersForManagerAsync(HashSet<int>? onlyUserIds = null);
    }

    public class ManagerService : IManagerService
    {
        private readonly AppDbContext _db;

        public ManagerService(AppDbContext db)
        {
            _db = db;
        }

        // ─── Team Daily Activity ──────────────────────────────────────────────

        public async Task<ManagerTeamDailyDto> GetTeamDailyActivityAsync(DateTime date, HashSet<int>? onlyUserIds = null)
        {
            var targetDate = date.Date;
            var users = await TeamMembers(onlyUserIds).ToListAsync();

            var logs = await _db.DailyLogs
                .Include(d => d.BreakLogs)
                .Include(d => d.TaskLogs)
                .Include(d => d.SupportLogs).ThenInclude(s => s.SupportedDeveloper)
                .Include(d => d.SupportLogs).ThenInclude(s => s.MediaEvidences)
                .Where(d => d.LogDate == targetDate)
                .ToListAsync();

            var members = users.Select(u =>
            {
                var log = logs.FirstOrDefault(l => l.UserId == u.Id);
                return BuildUserDailyActivity(u, log);
            }).ToList();

            return new ManagerTeamDailyDto
            {
                Date = targetDate,
                TotalMembers = users.Count,
                CheckedIn = members.Count(m => m.CheckInTime != null),
                NotCheckedIn = members.Count(m => m.CheckInTime == null),
                Members = members
            };
        }

        // ─── User Monthly Attendance ──────────────────────────────────────────
        // FIX: now counts Weekend and Holiday logs separately

        public async Task<UserAttendanceSummaryDto> GetUserMonthlyAttendanceAsync(int userId, int month, int year)
        {
            var user = await _db.Users.FindAsync(userId)
                ?? throw new KeyNotFoundException("User not found");

            var from = new DateTime(year, month, 1);
            var to = from.AddMonths(1).AddDays(-1);

            var logs = await _db.DailyLogs
                .Include(d => d.TaskLogs)
                .Include(d => d.SupportLogs)
                .Where(d => d.UserId == userId && d.LogDate >= from && d.LogDate <= to)
                .ToListAsync();

            int workingDays = CountWorkingDays(from, to);
            int present = logs.Count(l => l.DayStatus == "Present");
            var publicHolidays = await PublicHolidaysAsync(from, to);
            var leaveDays = await ApprovedLeaveDaysAsync(userId, from, to);
            int wfh = logs.Count(l => l.DayStatus == "WFH");
            int halfDay = logs.Count(l => l.DayStatus == "HalfDay");
            int weekend = logs.Count(l => l.DayStatus == "Weekend");  // ← FIX
            int holiday = logs.Count(l => l.DayStatus == "Holiday");  // ← FIX

            // totalLogged = regular working days only (for attendance % calculation)
            int totalLogged = present + wfh + halfDay;
            // absent = working days from joining up to yesterday not covered by attendance,
            // approved leave or a public holiday (same rule as payroll)
            var (countFrom, countTo) = AttendanceDays.CountableRange(user, from, to,
                logs.Any(l => l.LogDate.Date == AppClock.TodayIst), FirstLogDate(logs));
            var covered = logs.Where(l => l.DayStatus is "Present" or "WFH" or "HalfDay")
                .Select(l => l.LogDate.Date).Concat(leaveDays).ToHashSet();
            int expected = 0, absent = 0;
            for (var d = countFrom; d <= countTo; d = d.AddDays(1))
            {
                if (!AttendanceDays.IsWorkingDay(d, publicHolidays)) continue;
                if (leaveDays.Contains(d) && !logs.Any(l => l.LogDate.Date == d)) continue;   // on leave: not expected
                expected++;
                if (!covered.Contains(d)) absent++;
            }
            // attended = the expected days they did come in; % and the "x of y" figure both use
            // these two numbers, so a day outside the range can't push someone to 100%
            int attended = expected - absent;

            int totalWork = logs.Sum(l => l.TotalWorkMinutes);
            int totalTasks = logs.SelectMany(l => l.TaskLogs).Count(t => t.Status == "Completed");
            int totalSupport = logs.SelectMany(l => l.SupportLogs).Count();

            return new UserAttendanceSummaryDto
            {
                User = MapUserDto(user),
                Month = month,
                Year = year,
                WorkingDaysInMonth = workingDays,
                DaysExpected = expected,
                DaysAttended = attended,
                DaysPresent = present,
                DaysWFH = wfh,
                DaysHalfDay = halfDay,
                DaysAbsent = absent,
                DaysWeekend = weekend,  // ← FIX
                DaysHoliday = holiday,  // ← FIX
                // share of the days they could have worked (joined → today) that they did work
                AttendancePercentage = expected > 0
                    ? Math.Round((double)attended / expected * 100, 1) : 0,
                TotalWorkMinutes = totalWork,
                TotalWorkHours = FormatMinutes(totalWork),
                AverageDailyHours = totalLogged > 0
                    ? Math.Round((double)totalWork / totalLogged / 60, 1) : 0,
                TotalTasksCompleted = totalTasks,
                TotalSupportGiven = totalSupport
            };
        }

        // ─── Team Monthly Stats ───────────────────────────────────────────────

        public async Task<TeamMonthlyStatsDto> GetTeamMonthlyStatsAsync(int month, int year, HashSet<int>? onlyUserIds = null)
        {
            var users = await TeamMembers(onlyUserIds).ToListAsync();
            var summaries = new List<UserAttendanceSummaryDto>();

            foreach (var user in users)
                summaries.Add(await GetUserMonthlyAttendanceAsync(user.Id, month, year));

            return new TeamMonthlyStatsDto
            {
                Month = month,
                Year = year,
                Members = summaries,
                TeamAverageAttendance = summaries.Count > 0
                    ? Math.Round(summaries.Average(s => s.AttendancePercentage), 1) : 0,
                TeamTotalTasksCompleted = summaries.Sum(s => s.TotalTasksCompleted),
                TeamTotalSupportLogs = summaries.Sum(s => s.TotalSupportGiven)
            };
        }

        // ─── User Full Report ─────────────────────────────────────────────────

        public async Task<UserFullReportDto> GetUserFullReportAsync(int userId, DateTime from, DateTime to)
        {
            var user = await _db.Users.FindAsync(userId)
                ?? throw new KeyNotFoundException("User not found");

            var logs = await _db.DailyLogs
                .Include(d => d.BreakLogs)
                .Include(d => d.TaskLogs)
                .Include(d => d.SupportLogs).ThenInclude(s => s.SupportedDeveloper)
                .Include(d => d.SupportLogs).ThenInclude(s => s.MediaEvidences)
                .Where(d => d.UserId == userId && d.LogDate >= from.Date && d.LogDate <= to.Date)
                .OrderBy(d => d.LogDate)
                .ToListAsync();

            int workingDays = CountWorkingDays(from.Date, to.Date);
            int daysPresent = logs.Count(l => l.DayStatus is "Present" or "WFH" or "HalfDay");
            // attendance % over the days they could have worked: joined → today, minus holidays and leave
            var publicHolidays = await PublicHolidaysAsync(from.Date, to.Date);
            var leaveDays = await ApprovedLeaveDaysAsync(userId, from.Date, to.Date);
            var (countFrom, countTo) = AttendanceDays.CountableRange(user, from, to,
                logs.Any(l => l.LogDate.Date == AppClock.TodayIst), FirstLogDate(logs));
            var workedDays = logs.Where(l => l.DayStatus is "Present" or "WFH" or "HalfDay")
                .Select(l => l.LogDate.Date).ToHashSet();
            int expected = 0, attended = 0;
            for (var d = countFrom; d <= countTo; d = d.AddDays(1))
                if (AttendanceDays.IsWorkingDay(d, publicHolidays)
                    && !(leaveDays.Contains(d) && !logs.Any(l => l.LogDate.Date == d)))
                {
                    expected++;
                    if (workedDays.Contains(d) || leaveDays.Contains(d)) attended++;
                }
            int totalWork = logs.Sum(l => l.TotalWorkMinutes);
            int totalTasks = logs.SelectMany(l => l.TaskLogs).Count(t => t.Status == "Completed");
            int totalLogged = logs.SelectMany(l => l.TaskLogs).Count();
            int totalSupport = logs.SelectMany(l => l.SupportLogs).Count();

            var entries = logs.Select(log => new DailyReportEntryDto
            {
                Date = log.LogDate,
                DayStatus = log.DayStatus,
                CheckIn = log.CheckInTime.HasValue
                    ? log.CheckInTime.Value.ToIstTime().ToString("hh:mm tt") : "--",
                CheckOut = log.CheckOutTime.HasValue
                    ? log.CheckOutTime.Value.ToIstTime().ToString("hh:mm tt") : "--",
                WorkHours = FormatMinutes(log.TotalWorkMinutes),
                BreakMinutes = log.TotalBreakMinutes,
                TasksSummary = log.TaskLogs
                    .Select(t => $"[{t.Status}] {t.TaskTitle} ({t.TimeSpentMinutes}m){(t.ProjectName != null ? $" - {t.ProjectName}" : "")}")
                    .ToList(),
                SupportSummary = log.SupportLogs
                    .Select(s => $"{s.SupportedDeveloper.FullName}: {s.IssueDescription} ({s.TimeSpentMinutes}m)")
                    .ToList(),
                Notes = log.Notes
            }).ToList();

            return new UserFullReportDto
            {
                User = MapUserDto(user),
                FromDate = from.Date,
                ToDate = to.Date,
                TotalWorkingDays = workingDays,
                DaysPresent = daysPresent,
                AttendancePercentage = expected > 0
                    ? Math.Round((double)attended / expected * 100, 1) : 0,
                TotalWorkMinutes = totalWork,
                TotalWorkHours = FormatMinutes(totalWork),
                AverageDailyHours = daysPresent > 0
                    ? Math.Round((double)totalWork / daysPresent / 60, 1) : 0,
                TotalTasksCompleted = totalTasks,
                TotalTasksLogged = totalLogged,
                TotalSupportGiven = totalSupport,
                DailyEntries = entries
            };
        }

        // ─── Attendance Calendar ──────────────────────────────────────────────
        // FIX: Removed the `continue` that skipped log lookup for weekend days.
        // Now checks for an actual DailyLog FIRST for every day including weekends.
        // If a log exists → show its real DayStatus + CheckIn/Out data.
        // If no log on weekend → show "Weekend" (no check-in).
        // If no log on holiday → show "Holiday" (holiday name in CheckIn for tooltip).

        public async Task<List<AttendanceDayDto>> GetUserAttendanceCalendarAsync(int userId, int month, int year)
        {
            var from = new DateTime(year, month, 1);
            var to = from.AddMonths(1).AddDays(-1);
            var user = await _db.Users.FindAsync(userId)
                ?? throw new KeyNotFoundException("User not found");
            var leaveDays = await ApprovedLeaveDaysAsync(userId, from, to);

            // Load all logs for the month into a fast dictionary
            var logs = await _db.DailyLogs
                .Include(d => d.TaskLogs)
                .Where(d => d.UserId == userId && d.LogDate >= from && d.LogDate <= to)
                .ToDictionaryAsync(d => d.LogDate.Date);
            var joined = AttendanceDays.StartedOn(user, FirstLogDate(logs.Values));

            // Load holidays for the month for tooltip labels
            var holidays = await _db.Holidays
                .Where(h => h.Date >= from && h.Date <= to)
                .ToDictionaryAsync(h => h.Date.Date);

            var result = new List<AttendanceDayDto>();

            for (var day = from; day <= to; day = day.AddDays(1))
            {
                bool isWeekend = day.DayOfWeek is DayOfWeek.Saturday or DayOfWeek.Sunday;
                holidays.TryGetValue(day.Date, out var holiday);

                if (logs.TryGetValue(day.Date, out var log))
                {
                    // Employee checked in — use their real DayStatus regardless of day type
                    // DayStatus will be "Weekend", "Holiday", "Present", "WFH", etc.
                    result.Add(new AttendanceDayDto
                    {
                        Date = day,
                        Status = log.DayStatus,
                        CheckIn = log.CheckInTime?.ToIstTime().ToString("hh:mm tt"),
                        CheckOut = log.CheckOutTime?.ToIstTime().ToString("hh:mm tt"),
                        WorkHours = FormatMinutes(log.TotalWorkMinutes),
                        TasksCompleted = log.TaskLogs.Count(t => t.Status == "Completed")
                    });
                }
                else if (isWeekend)
                {
                    // Saturday or Sunday, no check-in
                    result.Add(new AttendanceDayDto { Date = day, Status = "Weekend" });
                }
                else if (holiday != null)
                {
                    // Public holiday, no check-in — store holiday name for tooltip
                    result.Add(new AttendanceDayDto
                    {
                        Date = day,
                        Status = "Holiday",
                        CheckIn = holiday.Name   // used as tooltip label in frontend
                    });
                }
                else
                {
                    // Normal working day, no log: before joining / not over yet / on leave / absent
                    result.Add(new AttendanceDayDto
                    {
                        Date = day,
                        Status = day.Date < joined ? "NotJoined"
                            : day.Date >= AppClock.TodayIst ? "Future"
                            : leaveDays.Contains(day.Date) ? "Leave"
                            : "Absent"
                    });
                }
            }

            return result;
        }

        public async Task<object> ToggleUserStatusAsync(int userId)
        {
            var user = await _db.Users.FindAsync(userId)
                ?? throw new KeyNotFoundException("User not found");

            if (user.Role == "Manager")
                throw new Custom.ValidationException("Managers cannot be deactivated.");

            user.IsActive = !user.IsActive;
            await _db.SaveChangesAsync();

            return new
            {
                user.Id,
                user.FullName,
                user.Email,
                user.Role,
                user.IsActive,
                message = user.IsActive ? "User activated successfully." : "User deactivated successfully."
            };
        }

        public async Task<List<UserDto>> GetAllUsersForManagerAsync(HashSet<int>? onlyUserIds = null)
        {
            return await _db.Users
                .Where(u => u.Role != "Pending" && (onlyUserIds == null || onlyUserIds.Contains(u.Id)))   // sign-ups waiting for a role aren't team members
                .Select(u => new UserDto
                {
                    Id = u.Id,
                    FullName = u.FullName,
                    Email = u.Email,
                    Role = u.Role,
                    IsActive = u.IsActive,
                    FaceRegistered = u.FaceRegistered,
                    ManagerId = u.ManagerId
                })
                .ToListAsync();
        }

        // ─── Helpers ──────────────────────────────────────────────────────────

        /// <summary>Active, approved people (not "Pending"); a Team Lead's list is limited to their reports</summary>
        private IQueryable<Models.Auth.User> TeamMembers(HashSet<int>? onlyUserIds) =>
            _db.Users.Where(u => u.IsActive && u.Role != "Pending"
                && (onlyUserIds == null || onlyUserIds.Contains(u.Id)));

        private static UserDailyActivityDto BuildUserDailyActivity(User user, DailyLog? log)
        {
            if (log == null)
                return new UserDailyActivityDto { User = MapUserDto(user), DayStatus = "Absent" };

            var activeBreak = log.BreakLogs.FirstOrDefault(b => b.IsActive);
            int workMins = log.TotalWorkMinutes;
            if (log.CheckInTime != null && log.CheckOutTime == null)
            {
                var elapsed = (int)(DateTime.UtcNow - log.CheckInTime.Value).TotalMinutes;
                var breakMins = log.BreakLogs.Where(b => !b.IsActive).Sum(b => b.DurationMinutes);
                if (activeBreak != null)
                    breakMins += (int)(DateTime.UtcNow - activeBreak.StartTime).TotalMinutes;
                workMins = Math.Max(0, elapsed - breakMins);
            }

            return new UserDailyActivityDto
            {
                User = MapUserDto(user),
                DayStatus = log.DayStatus,
                CheckInTime = log.CheckInTime?.ToIstTime().ToString("hh:mm tt"),
                CheckOutTime = log.CheckOutTime?.ToIstTime().ToString("hh:mm tt"),
                WorkHours = FormatMinutes(workMins),
                TotalBreakMinutes = log.BreakLogs.Where(b => !b.IsActive).Sum(b => b.DurationMinutes),
                TasksTotal = log.TaskLogs.Count,
                TasksCompleted = log.TaskLogs.Count(t => t.Status == "Completed"),
                TasksInProgress = log.TaskLogs.Count(t => t.Status == "InProgress"),
                SupportGiven = log.SupportLogs.Count,
                IsOnBreak = activeBreak != null,
                ActiveBreakType = activeBreak?.BreakType,
                Tasks = log.TaskLogs.Select(t => new TaskLogDto
                {
                    Id = t.Id,
                    TaskTitle = t.TaskTitle,
                    Description = t.Description,
                    ProjectName = t.ProjectName,
                    Status = t.Status,
                    TimeSpentMinutes = t.TimeSpentMinutes,
                    Priority = t.Priority,
                    Tags = t.Tags,
                    CompletedAt = t.CompletedAt,
                    CreatedAt = t.CreatedAt
                }).ToList(),
                SupportLogs = log.SupportLogs.Select(s => new SupportLogResponseDto
                {
                    Id = s.Id,
                    SupportedDeveloperName = s.SupportedDeveloper.FullName,
                    IssueDescription = s.IssueDescription,
                    Resolution = s.Resolution,
                    TimeSpentMinutes = s.TimeSpentMinutes,
                    SupportType = s.SupportType,
                    SupportedAt = s.SupportedAt,
                    Media = s.MediaEvidences.Select(m => new MediaEvidenceDto
                    {
                        Id = m.Id,
                        MediaType = m.MediaType,
                        FileName = m.FileName,
                        Url = $"/api/support/media/{m.Id}",
                        FileSizeBytes = m.FileSizeBytes,
                        MimeType = m.MimeType
                    }).ToList()
                }).ToList()
            };
        }

        private async Task<HashSet<DateTime>> PublicHolidaysAsync(DateTime from, DateTime to) =>
            (await _db.Holidays.Where(h => h.Type == "Public" && h.Date >= from && h.Date <= to)
                .Select(h => h.Date).ToListAsync()).Select(d => d.Date).ToHashSet();

        /// <summary>Every date in [from, to] covered by this person's approved leave</summary>
        private async Task<HashSet<DateTime>> ApprovedLeaveDaysAsync(int userId, DateTime from, DateTime to)
        {
            var leaves = await _db.LeaveRequests
                .Where(l => l.UserId == userId && l.Status == "Approved" && l.FromDate <= to && l.ToDate >= from)
                .Select(l => new { l.FromDate, l.ToDate }).ToListAsync();
            var days = new HashSet<DateTime>();
            foreach (var l in leaves)
                for (var d = l.FromDate.Date < from ? from : l.FromDate.Date; d <= l.ToDate.Date && d <= to; d = d.AddDays(1))
                    days.Add(d);
            return days;
        }

        /// <summary>The first day in these logs someone checked in (null when there are none)</summary>
        private static DateTime? FirstLogDate(IEnumerable<DailyLog> logs) =>
            logs.Select(l => (DateTime?)l.LogDate.Date).Min();

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

        private static UserDto MapUserDto(User u) => new()
        {
            Id = u.Id,
            FullName = u.FullName,
            Email = u.Email,
            Role = u.Role
        };
    }
}
