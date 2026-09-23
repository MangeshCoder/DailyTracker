using DailyTrackerAPI.Data;
using DailyTrackerAPI.DTOs;
using DailyTrackerAPI.Models.Tasks;
using Microsoft.EntityFrameworkCore;

namespace DailyTrackerAPI.Services.Tasks
{
    // ─── Task Service ──────────────────────────────────────────────────────────

    public interface ITaskService
    {
        Task<TaskLogDto?> CreateTaskAsync(int userId, CreateTaskDto dto);
        Task<TaskLogDto?> UpdateTaskAsync(int userId, int taskId, UpdateTaskDto dto);
        Task<bool> DeleteTaskAsync(int userId, int taskId);
        Task<List<TaskLogDto>> GetTodayTasksAsync(int userId);
        Task<List<TaskLogDto>> GetTasksByDateAsync(int userId, DateTime date);
    }

    public class TaskService : ITaskService
    {
        private readonly AppDbContext _db;
        public TaskService(AppDbContext db) { _db = db; }

        private async Task<DailyLog?> GetOrCreateTodayLogAsync(int userId)
        {
            var today = DateTime.UtcNow.Date;
            var log = await _db.DailyLogs.FirstOrDefaultAsync(d => d.UserId == userId && d.LogDate == today);
            return log;
        }

        public async Task<TaskLogDto?> CreateTaskAsync(int userId, CreateTaskDto dto)
        {
            var log = await GetOrCreateTodayLogAsync(userId);
            if (log == null) return null; // Must check in first

            var task = new TaskLog
            {
                DailyLogId = log.Id,
                TaskTitle = dto.TaskTitle,
                Description = dto.Description,
                ProjectName = dto.ProjectName,
                Status = dto.Status,
                TimeSpentMinutes = dto.TimeSpentMinutes,
                Priority = dto.Priority,
                Tags = dto.Tags,
                CompletedAt = dto.Status == "Completed" ? DateTime.UtcNow : null
            };

            _db.TaskLogs.Add(task);
            await _db.SaveChangesAsync();
            return MapTaskDto(task);
        }

        public async Task<TaskLogDto?> UpdateTaskAsync(int userId, int taskId, UpdateTaskDto dto)
        {
            var today = DateTime.UtcNow.Date;
            var task = await _db.TaskLogs
                .Include(t => t.DailyLog)
                .FirstOrDefaultAsync(t => t.Id == taskId && t.DailyLog.UserId == userId);

            if (task == null) return null;

            if (dto.TaskTitle != null) task.TaskTitle = dto.TaskTitle;
            if (dto.Description != null) task.Description = dto.Description;
            if (dto.ProjectName != null) task.ProjectName = dto.ProjectName;
            if (dto.Priority != null) task.Priority = dto.Priority;
            if (dto.Tags != null) task.Tags = dto.Tags;
            if (dto.TimeSpentMinutes.HasValue) task.TimeSpentMinutes = dto.TimeSpentMinutes.Value;

            if (dto.Status != null)
            {
                task.Status = dto.Status;
                if (dto.Status == "Completed" && task.CompletedAt == null)
                    task.CompletedAt = DateTime.UtcNow;
            }

            await _db.SaveChangesAsync();
            return MapTaskDto(task);
        }

        public async Task<bool> DeleteTaskAsync(int userId, int taskId)
        {
            var task = await _db.TaskLogs
                .Include(t => t.DailyLog)
                .FirstOrDefaultAsync(t => t.Id == taskId && t.DailyLog.UserId == userId);

            if (task == null) return false;

            _db.TaskLogs.Remove(task);
            await _db.SaveChangesAsync();
            return true;
        }

        public async Task<List<TaskLogDto>> GetTodayTasksAsync(int userId)
        {
            var today = DateTime.UtcNow.Date;
            return await _db.TaskLogs
                .Include(t => t.DailyLog)
                .Where(t => t.DailyLog.UserId == userId && t.DailyLog.LogDate == today)
                .Select(t => MapTaskDto(t))
                .ToListAsync();
        }

        public async Task<List<TaskLogDto>> GetTasksByDateAsync(int userId, DateTime date)
        {
            return await _db.TaskLogs
                .Include(t => t.DailyLog)
                .Where(t => t.DailyLog.UserId == userId && t.DailyLog.LogDate == date.Date)
                .Select(t => MapTaskDto(t))
                .ToListAsync();
        }

        private static TaskLogDto MapTaskDto(TaskLog t) => new()
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
        };
    }
}
