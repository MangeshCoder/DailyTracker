using DailyTrackerAPI.Data;
using DailyTrackerAPI.DTOs;
using DailyTrackerAPI.Services.Attendance;
using Microsoft.EntityFrameworkCore;
namespace DailyTrackerAPI.Services.Team
{
    // ─── Dashboard Service ─────────────────────────────────────────────────────

    public interface IDashboardService
    {
        Task<DashboardSummaryDto> GetTodaySummaryAsync(int userId);
        Task<WeeklyReportDto> GetWeeklyReportAsync(int userId);
        Task<List<TeamMemberActivityDto>> GetTeamActivityAsync();
    }

    public class DashboardService : IDashboardService
    {
        private readonly AppDbContext _db;
        private readonly IDailyLogService _dailyLogService;

        public DashboardService(AppDbContext db, IDailyLogService dailyLogService)
        {
            _db = db;
            _dailyLogService = dailyLogService;
        }

        public async Task<DashboardSummaryDto> GetTodaySummaryAsync(int userId)
        {
            var todayLog = await _dailyLogService.GetTodayLogAsync(userId);
            var activeBreak = todayLog?.Breaks.FirstOrDefault(b => b.IsActive);

            return new DashboardSummaryDto
            {
                TodayLog = todayLog,
                TasksCompleted = todayLog?.Tasks.Count(t => t.Status == "Completed") ?? 0,
                TasksInProgress = todayLog?.Tasks.Count(t => t.Status == "InProgress") ?? 0,
                TotalSupportGiven = todayLog?.SupportLogs.Count ?? 0,
                NetWorkMinutes = todayLog?.TotalWorkMinutes ?? 0,
                NetWorkHours = FormatMinutes(todayLog?.TotalWorkMinutes ?? 0),
                IsCheckedIn = todayLog?.CheckInTime != null,
                HasActiveBreak = activeBreak != null,
                ActiveBreak = activeBreak
            };
        }

        public async Task<WeeklyReportDto> GetWeeklyReportAsync(int userId)
        {
            var history = await _dailyLogService.GetHistoryAsync(userId, 7);

            return new WeeklyReportDto
            {
                Days = history,
                TotalWorkMinutes = history.Sum(d => d.TotalWorkMinutes),
                TotalTasksCompleted = history.Sum(d => d.Tasks.Count(t => t.Status == "Completed")),
                TotalSupportGiven = history.Sum(d => d.SupportLogs.Count),
                AverageDailyHours = history.Count > 0
                    ? Math.Round(history.Average(d => d.TotalWorkMinutes) / 60.0, 1)
                    : 0
            };
        }

        public async Task<List<TeamMemberActivityDto>> GetTeamActivityAsync()
        {
            var today = DateTime.UtcNow.Date;
            var users = await _db.Users.Where(u => u.IsActive).ToListAsync();
            var todayLogs = await _db.DailyLogs
                .Include(d => d.TaskLogs)
                .Where(d => d.LogDate == today)
                .ToListAsync();

            return users.Select(u =>
            {
                var log = todayLogs.FirstOrDefault(l => l.UserId == u.Id);
                return new TeamMemberActivityDto
                {
                    User = new UserDto { Id = u.Id, FullName = u.FullName, Email = u.Email, Role = u.Role },
                    IsCheckedIn = log?.CheckInTime != null,
                    CheckInTime = log?.CheckInTime,
                    TasksDoneToday = log?.TaskLogs.Count(t => t.Status == "Completed") ?? 0,
                    DayStatus = log?.DayStatus ?? "Absent"
                };
            }).ToList();
        }

        private static string FormatMinutes(int minutes)
        {
            var h = minutes / 60;
            var m = minutes % 60;
            return $"{h}h {m}m";
        }
    }
}
