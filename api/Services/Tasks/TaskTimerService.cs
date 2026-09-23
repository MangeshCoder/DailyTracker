using DailyTrackerAPI.Data;
using DailyTrackerAPI.DTOs;
using DailyTrackerAPI.Models.Tasks;
using Microsoft.EntityFrameworkCore;

namespace DailyTrackerAPI.Services.Tasks
{
    // ─────────────────────────────────────────────────────────────────────────
    //  Feature 3: Task Timer Service (start/stop per-task timer)
    // ─────────────────────────────────────────────────────────────────────────
    public interface ITaskTimerService
    {
        Task<TaskTimerDto> StartTimerAsync(int taskId, int userId);
        Task<TaskTimerDto> StopTimerAsync(int taskId, int userId);
        Task<TaskTimerDto?> GetActiveTimerAsync(int userId);
    }

    public class TaskTimerService : ITaskTimerService
    {
        private readonly AppDbContext _db;

        public TaskTimerService(AppDbContext db) { _db = db; }

        public async Task<TaskTimerDto> StartTimerAsync(int taskId, int userId)
        {
            // Verify task belongs to user
            var task = await _db.TaskLogs
                .Include(t => t.DailyLog)
                .FirstOrDefaultAsync(t => t.Id == taskId && t.DailyLog.UserId == userId)
                ?? throw new KeyNotFoundException("Task not found.");

            // Stop any running timer for this user
            var running = await _db.TaskTimers
                .Include(t => t.TaskLog).ThenInclude(t => t.DailyLog)
                .FirstOrDefaultAsync(t => t.IsRunning && t.TaskLog.DailyLog.UserId == userId);

            if (running != null)
            {
                running.IsRunning = false;
                running.StoppedAt = DateTime.UtcNow;
                running.DurationMinutes = (int)(DateTime.UtcNow - running.StartedAt).TotalMinutes;
            }

            // Start new timer
            var timer = new TaskTimer { TaskLogId = taskId, StartedAt = DateTime.UtcNow };
            _db.TaskTimers.Add(timer);
            await _db.SaveChangesAsync();

            return await BuildTimerDto(timer, taskId);
        }

        public async Task<TaskTimerDto> StopTimerAsync(int taskId, int userId)
        {
            var timer = await _db.TaskTimers
                .Include(t => t.TaskLog).ThenInclude(t => t.DailyLog)
                .FirstOrDefaultAsync(t => t.TaskLogId == taskId
                    && t.IsRunning && t.TaskLog.DailyLog.UserId == userId)
                ?? throw new InvalidOperationException("No running timer for this task.");

            timer.IsRunning = false;
            timer.StoppedAt = DateTime.UtcNow;
            timer.DurationMinutes = (int)(DateTime.UtcNow - timer.StartedAt).TotalMinutes;

            // Update task's time spent with elapsed timer minutes
            var task = timer.TaskLog;
            task.TimeSpentMinutes += timer.DurationMinutes;

            await _db.SaveChangesAsync();

            return await BuildTimerDto(timer, taskId);
        }

        public async Task<TaskTimerDto?> GetActiveTimerAsync(int userId)
        {
            var timer = await _db.TaskTimers
                .Include(t => t.TaskLog).ThenInclude(t => t.DailyLog)
                .FirstOrDefaultAsync(t => t.IsRunning && t.TaskLog.DailyLog.UserId == userId);

            return timer == null ? null : await BuildTimerDto(timer, timer.TaskLogId);
        }

        private async Task<TaskTimerDto> BuildTimerDto(TaskTimer timer, int taskId)
        {
            var totalSessions = await _db.TaskTimers
                .Where(t => t.TaskLogId == taskId && !t.IsRunning)
                .SumAsync(t => t.DurationMinutes);

            return new TaskTimerDto
            {
                Id = timer.Id,
                TaskLogId = taskId,
                StartedAt = timer.StartedAt,
                StoppedAt = timer.StoppedAt,
                DurationMinutes = timer.DurationMinutes,
                IsRunning = timer.IsRunning,
                TotalSessionMinutes = totalSessions
            };
        }
    }
}
