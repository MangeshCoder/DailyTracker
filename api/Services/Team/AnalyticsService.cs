using DailyTrackerAPI.Data;
using DailyTrackerAPI.DTOs;
using Microsoft.EntityFrameworkCore;

namespace DailyTrackerAPI.Services.Team
{
    public interface IAnalyticsService
    {
        Task<AdvancedAnalyticsDto> GetAdvancedAnalyticsAsync(int userId, int days = 90);
        Task<List<HeatmapDataDto>> GetHeatmapAsync(int userId, int days = 365);
        Task<List<ProjectTimeDto>> GetProjectBreakdownAsync(int userId, int days = 30);
        Task<List<PeakHourDto>> GetPeakHoursAsync(int userId, int days = 30);
    }

    public class AnalyticsService : IAnalyticsService
    {
        private readonly AppDbContext _db;

        public AnalyticsService(AppDbContext db) { _db = db; }

        public async Task<AdvancedAnalyticsDto> GetAdvancedAnalyticsAsync(int userId, int days = 90)
        {
            var heatmap = await GetHeatmapAsync(userId, days);
            var projects = await GetProjectBreakdownAsync(userId, days);
            var peak = await GetPeakHoursAsync(userId, days);
            var trend = await GetProductivityTrendInternalAsync(userId, Math.Min(days, 30));

            var totalWork = heatmap.Sum(h => h.WorkMinutes);
            var totalTasks = heatmap.Sum(h => h.TasksCompleted);

            // Find most productive day of week
            var from = DateTime.UtcNow.Date.AddDays(-days);
            var logs = await _db.DailyLogs
                .Include(d => d.TaskLogs)
                .Where(d => d.UserId == userId && d.LogDate >= from)
                .ToListAsync();

            var byDay = logs.GroupBy(l => l.LogDate.DayOfWeek)
                .Select(g => new { Day = g.Key, Avg = g.Average(l => l.TotalWorkMinutes) })
                .OrderByDescending(x => x.Avg)
                .FirstOrDefault();

            var overallScore = heatmap.Count > 0
                ? Math.Round(heatmap.Average(h => Math.Min(100.0, h.WorkMinutes / 480.0 * 100)), 1) : 0;

            // Support logs count
            var supportCount = await _db.SupportLogs
                .Where(s => s.DailyLog.UserId == userId && s.DailyLog.LogDate >= from)
                .CountAsync();

            return new AdvancedAnalyticsDto
            {
                Heatmap = heatmap,
                ProjectBreakdown = projects,
                ProductivityTrend = trend,
                PeakHours = peak,
                OverallProductivityScore = overallScore,
                MostProductiveDay = byDay?.Day.ToString() ?? "N/A",
                MostWorkedProject = projects.FirstOrDefault()?.ProjectName ?? "N/A",
                TotalTasksCompleted = totalTasks,
                TotalWorkMinutes = totalWork,
                TotalSupportGiven = supportCount
            };
        }

        public async Task<List<HeatmapDataDto>> GetHeatmapAsync(int userId, int days = 365)
        {
            var from = DateTime.UtcNow.Date.AddDays(-days);
            var logs = await _db.DailyLogs
                .Include(d => d.TaskLogs)
                .Where(d => d.UserId == userId && d.LogDate >= from)
                .OrderBy(d => d.LogDate)
                .ToListAsync();

            return logs.Select(log =>
            {
                var tasks = log.TaskLogs.Count(t => t.Status == "Completed");
                // Level 0=none, 1=light, 2=moderate, 3=good, 4=excellent
                int level = log.TotalWorkMinutes switch
                {
                    0 => 0,
                    < 180 => 1,
                    < 360 => 2,
                    < 480 => 3,
                    _ => 4
                };
                return new HeatmapDataDto
                {
                    Date = log.LogDate,
                    WorkMinutes = log.TotalWorkMinutes,
                    TasksCompleted = tasks,
                    Level = level
                };
            }).ToList();
        }

        public async Task<List<ProjectTimeDto>> GetProjectBreakdownAsync(int userId, int days = 30)
        {
            var from = DateTime.UtcNow.Date.AddDays(-days);
            var tasks = await _db.TaskLogs
                .Where(t => t.DailyLog.UserId == userId
                    && t.DailyLog.LogDate >= from
                    && t.ProjectName != null)
                .GroupBy(t => t.ProjectName!)
                .Select(g => new
                {
                    ProjectName = g.Key,
                    TotalMinutes = g.Sum(t => t.TimeSpentMinutes),
                    TaskCount = g.Count()
                })
                .OrderByDescending(x => x.TotalMinutes)
                .ToListAsync();

            var totalMinutes = tasks.Sum(t => t.TotalMinutes);

            // Also include tasks without project name
            var noProject = await _db.TaskLogs
                .Where(t => t.DailyLog.UserId == userId
                    && t.DailyLog.LogDate >= from
                    && t.ProjectName == null)
                .GroupBy(_ => 1)
                .Select(g => new
                {
                    TotalMinutes = g.Sum(t => t.TimeSpentMinutes),
                    TaskCount = g.Count()
                })
                .FirstOrDefaultAsync();

            var result = tasks.Select(t => new ProjectTimeDto
            {
                ProjectName = t.ProjectName,
                TotalMinutes = t.TotalMinutes,
                TaskCount = t.TaskCount,
                Percentage = totalMinutes > 0 ? Math.Round((double)t.TotalMinutes / totalMinutes * 100, 1) : 0
            }).ToList();

            if (noProject != null && noProject.TotalMinutes > 0)
            {
                result.Add(new ProjectTimeDto
                {
                    ProjectName = "Unassigned",
                    TotalMinutes = noProject.TotalMinutes,
                    TaskCount = noProject.TaskCount,
                    Percentage = totalMinutes > 0 ? Math.Round((double)noProject.TotalMinutes / totalMinutes * 100, 1) : 0
                });
            }

            return result;
        }

        public async Task<List<PeakHourDto>> GetPeakHoursAsync(int userId, int days = 30)
        {
            var from = DateTime.UtcNow.Date.AddDays(-days);

            // Get tasks with their completion times to determine peak hours
            var completedTasks = await _db.TaskLogs
                .Where(t => t.DailyLog.UserId == userId
                    && t.DailyLog.LogDate >= from
                    && t.CompletedAt != null)
                .Select(t => t.CompletedAt!.Value)
                .ToListAsync();

            return completedTasks
                .GroupBy(dt => dt.ToLocalTime().Hour)
                .Select(g => new PeakHourDto
                {
                    Hour = g.Key,
                    HourLabel = new DateTime(2000, 1, 1, g.Key, 0, 0).ToString("hh:mm tt"),
                    TasksCompleted = g.Count()
                })
                .OrderBy(h => h.Hour)
                .ToList();
        }

        private async Task<List<ProductivityTrendDto>> GetProductivityTrendInternalAsync(int userId, int days)
        {
            var from = DateTime.UtcNow.Date.AddDays(-days);
            var logs = await _db.DailyLogs
                .Include(d => d.TaskLogs)
                .Where(d => d.UserId == userId && d.LogDate >= from)
                .OrderBy(d => d.LogDate)
                .ToListAsync();

            return logs.Select(log =>
            {
                var tasks = log.TaskLogs.Count(t => t.Status == "Completed");
                var workPct = Math.Min(100.0, log.TotalWorkMinutes / 480.0 * 100);
                var taskPct = Math.Min(100.0, tasks / 5.0 * 100);
                return new ProductivityTrendDto
                {
                    Date = log.LogDate,
                    Score = Math.Round(workPct * 0.5 + taskPct * 0.5, 1),
                    WorkMinutes = log.TotalWorkMinutes,
                    TasksCompleted = tasks,
                    DayName = log.LogDate.ToString("ddd")
                };
            }).ToList();
        }
    }
}
