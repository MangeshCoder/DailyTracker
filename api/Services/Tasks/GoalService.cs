using DailyTrackerAPI.Data;
using DailyTrackerAPI.DTOs;
using DailyTrackerAPI.Models.Attendance;
using Microsoft.EntityFrameworkCore;

namespace DailyTrackerAPI.Services.Tasks
{
    // ─────────────────────────────────────────────────────────────────────────
    //  Feature 4: Goal Service
    //
    //  CHANGE FROM PREVIOUS VERSION:
    //    Added GetHistoryAsync(userId, from, to) to interface and class.
    //    Everything else is identical.
    // ─────────────────────────────────────────────────────────────────────────
    public interface IGoalService
    {
        Task<DailyGoal> SetOrUpdateGoalAsync(int userId, SetGoalDto dto);
        Task<GoalProgressDto> GetTodayProgressAsync(int userId);
        Task<List<ProductivityTrendDto>> GetProductivityTrendAsync(int userId, int days = 14);

        // ── ADDED ─────────────────────────────────────────────────────────────
        Task<List<GoalHistoryDto>> GetHistoryAsync(int userId, DateTime from, DateTime to);
    }

    public class GoalService : IGoalService
    {
        private readonly AppDbContext _db;
        public GoalService(AppDbContext db) { _db = db; }

        // ── UNCHANGED ─────────────────────────────────────────────────────────
        public async Task<DailyGoal> SetOrUpdateGoalAsync(int userId, SetGoalDto dto)
        {
            var today = DateTime.UtcNow.Date;
            var goal = await _db.DailyGoals
                .FirstOrDefaultAsync(g => g.UserId == userId && g.GoalDate == today);

            if (goal == null)
            {
                goal = new DailyGoal { UserId = userId, GoalDate = today };
                _db.DailyGoals.Add(goal);
            }

            goal.TargetWorkMinutes = dto.TargetWorkMinutes;
            goal.TargetTasksCompleted = dto.TargetTasksCompleted;
            goal.TargetBreakMinutes = dto.TargetBreakMinutes;
            goal.TargetSupportGiven = dto.TargetSupportGiven;
            goal.ManagerSetNote = dto.ManagerSetNote;

            await _db.SaveChangesAsync();
            return goal;
        }

        // ── UNCHANGED ─────────────────────────────────────────────────────────
        public async Task<GoalProgressDto> GetTodayProgressAsync(int userId)
        {
            var today = DateTime.UtcNow.Date;

            var goal = await _db.DailyGoals
                .FirstOrDefaultAsync(g => g.UserId == userId && g.GoalDate == today)
                ?? new DailyGoal
                {
                    TargetWorkMinutes = 480,
                    TargetTasksCompleted = 5,
                    TargetBreakMinutes = 60,
                    TargetSupportGiven = 5
                };

            if (goal.TargetSupportGiven <= 0) goal.TargetSupportGiven = 5;

            var log = await _db.DailyLogs
                .Include(d => d.TaskLogs)
                .Include(d => d.BreakLogs)
                .Include(d => d.SupportLogs)
                .FirstOrDefaultAsync(d => d.UserId == userId && d.LogDate == today);

            int actualWork = 0, actualBreak = 0, actualTasks = 0, actualSupport = 0;

            if (log != null)
            {
                actualWork = log.TotalWorkMinutes;
                if (log.CheckInTime != null && log.CheckOutTime == null)
                {
                    var elapsed = (int)(DateTime.UtcNow - log.CheckInTime.Value).TotalMinutes;
                    var breaks = log.BreakLogs.Where(b => !b.IsActive).Sum(b => b.DurationMinutes);
                    var active = log.BreakLogs.FirstOrDefault(b => b.IsActive);
                    if (active != null) breaks += (int)(DateTime.UtcNow - active.StartTime).TotalMinutes;
                    actualWork = Math.Max(0, elapsed - breaks);
                }
                actualBreak = log.BreakLogs.Where(b => !b.IsActive).Sum(b => b.DurationMinutes);
                actualTasks = log.TaskLogs.Count(t => t.Status == "Completed");
                actualSupport = log.SupportLogs.Count;
            }

            double workPct = Pct(actualWork, goal.TargetWorkMinutes);
            double taskPct = Pct(actualTasks, goal.TargetTasksCompleted);
            double breakPct = Pct(actualBreak, goal.TargetBreakMinutes);
            double supportPct = Pct(actualSupport, goal.TargetSupportGiven);

            double score = Math.Round(workPct * 0.45 + taskPct * 0.35 + supportPct * 0.10 + breakPct * 0.10, 1);
            string grade = Grade(score);

            var insights = new List<string>();
            if (workPct >= 100) insights.Add("🎯 Work hours target achieved!");
            else if (workPct >= 50) insights.Add($"⏱️ {100 - workPct:F0}% more to hit your work target");
            else insights.Add("🚀 Keep going — you're getting there!");

            if (taskPct >= 100) insights.Add("✅ All tasks done for today!");
            else if (actualTasks > 0) insights.Add($"📋 {goal.TargetTasksCompleted - actualTasks} more tasks to complete");

            if (supportPct >= 100) insights.Add("🤝 Support target hit!");
            else if (goal.TargetSupportGiven > 0 && actualSupport > 0)
            {
                var remaining = goal.TargetSupportGiven - actualSupport;
                if (remaining > 0) insights.Add($"🤝 {remaining} more support log{(remaining > 1 ? "s" : "")} to go");
            }

            if (actualBreak == 0 && actualWork > 120) insights.Add("☕ Don't forget to take a break!");
            if (score >= 80) insights.Add("🌟 Excellent productivity today!");

            return new GoalProgressDto
            {
                Goal = new SetGoalDto
                {
                    TargetWorkMinutes = goal.TargetWorkMinutes,
                    TargetTasksCompleted = goal.TargetTasksCompleted,
                    TargetBreakMinutes = goal.TargetBreakMinutes,
                    TargetSupportGiven = goal.TargetSupportGiven
                },
                ActualWorkMinutes = actualWork,
                ActualTasksCompleted = actualTasks,
                ActualBreakMinutes = actualBreak,
                ActualSupportGiven = actualSupport,
                WorkProgress = workPct,
                TaskProgress = taskPct,
                BreakProgress = breakPct,
                SupportProgress = supportPct,
                ProductivityScore = score,
                ScoreGrade = grade,
                Insights = insights
            };
        }

        // ── UNCHANGED ─────────────────────────────────────────────────────────
        public async Task<List<ProductivityTrendDto>> GetProductivityTrendAsync(int userId, int days = 14)
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

        // ── ADDED: GetHistoryAsync ─────────────────────────────────────────────
        //
        //  Returns one GoalHistoryDto per day where the user has a DailyLog.
        //  Days with no DailyLog are skipped (user didn't work / was on leave).
        //  Days with a DailyLog but no DailyGoal still appear — GoalWasSet = false.
        //
        //  QUERY STRATEGY:
        //    Load all DailyLogs in range with their related collections in ONE query.
        //    Load all DailyGoals in range in ONE query.
        //    Join them in memory — avoids N+1 queries.
        //
        //  MAX RANGE: enforced at controller level (max 90 days).
        public async Task<List<GoalHistoryDto>> GetHistoryAsync(
            int userId, DateTime from, DateTime to)
        {
            var fromDate = from.Date;
            var toDate = to.Date;

            // Single query for all logs in range with all needed navigation props
            var logs = await _db.DailyLogs
                .Include(d => d.TaskLogs)
                .Include(d => d.BreakLogs)
                .Include(d => d.SupportLogs)
                .Where(d => d.UserId == userId && d.LogDate >= fromDate && d.LogDate <= toDate)
                .OrderBy(d => d.LogDate)
                .ToListAsync();

            if (logs.Count == 0) return new List<GoalHistoryDto>();

            // Single query for all goals in range
            var goals = await _db.DailyGoals
                .Where(g => g.UserId == userId && g.GoalDate >= fromDate && g.GoalDate <= toDate)
                .ToListAsync();

            // Index goals by date for O(1) lookup
            var goalByDate = goals.ToDictionary(g => g.GoalDate.Date);

            var result = new List<GoalHistoryDto>();

            foreach (var log in logs)
            {
                var logDate = log.LogDate.Date;

                // Actuals from the log and its related collections
                var actualWork = log.TotalWorkMinutes;
                var actualBreak = log.BreakLogs.Where(b => !b.IsActive).Sum(b => b.DurationMinutes);
                var actualTasks = log.TaskLogs.Count(t => t.Status == "Completed");
                var actualSupport = log.SupportLogs.Count;

                // Goals for this day (null if user didn't set one)
                goalByDate.TryGetValue(logDate, out var goal);
                var goalWasSet = goal != null;

                // Use sensible defaults if no goal was set so progress bars still render
                var targetWork = goal?.TargetWorkMinutes > 0 ? goal.TargetWorkMinutes : 480;
                var targetTasks = goal?.TargetTasksCompleted > 0 ? goal.TargetTasksCompleted : 5;
                var targetSupport = goal?.TargetSupportGiven > 0 ? goal.TargetSupportGiven : 5;
                var targetBreak = goal?.TargetBreakMinutes > 0 ? goal.TargetBreakMinutes : 60;

                double workPct = Pct(actualWork, targetWork);
                double taskPct = Pct(actualTasks, targetTasks);
                double supportPct = Pct(actualSupport, targetSupport);
                double breakPct = Pct(actualBreak, targetBreak);

                double score = Math.Round(
                    workPct * 0.45 +
                    taskPct * 0.35 +
                    supportPct * 0.10 +
                    breakPct * 0.10, 1);

                result.Add(new GoalHistoryDto
                {
                    Date = logDate,
                    DayName = logDate.ToString("ddd"),   // "Mon"
                    DateLabel = logDate.ToString("MMM d"), // "Jan 15"
                    TargetWorkMinutes = targetWork,
                    TargetTasksCompleted = targetTasks,
                    TargetSupportGiven = targetSupport,
                    TargetBreakMinutes = targetBreak,
                    ActualWorkMinutes = actualWork,
                    ActualTasksCompleted = actualTasks,
                    ActualSupportGiven = actualSupport,
                    ActualBreakMinutes = actualBreak,
                    WorkProgress = workPct,
                    TaskProgress = taskPct,
                    SupportProgress = supportPct,
                    BreakProgress = breakPct,
                    ProductivityScore = score,
                    ScoreGrade = Grade(score),
                    GoalWasSet = goalWasSet
                });
            }

            return result;
        }

        // ── Private helpers ───────────────────────────────────────────────────
        private static double Pct(double actual, double target) =>
            target > 0 ? Math.Min(100, Math.Round(actual / target * 100, 1)) : 0;

        private static string Grade(double score) =>
            score >= 90 ? "A" : score >= 75 ? "B" : score >= 60 ? "C" : "D";
    }
}