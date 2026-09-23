using DailyTrackerAPI.Data;
using DailyTrackerAPI.DTOs;
using DailyTrackerAPI.Models.Tasks;
using Microsoft.EntityFrameworkCore;

namespace DailyTrackerAPI.Services.Tasks
{
    // ─────────────────────────────────────────────────────────────────────────
    //  Feature 3: Task Template Service
    // ─────────────────────────────────────────────────────────────────────────
    public interface ITaskTemplateService
    {
        Task<TaskTemplateDto> CreateAsync(int userId, CreateTemplateDto dto);
        Task<List<TaskTemplateDto>> GetMyTemplatesAsync(int userId);
        Task DeleteAsync(int templateId, int userId);
        Task<TaskLogDto> CreateFromTemplateAsync(int userId, int templateId, int dailyLogId);
        Task<List<TaskTemplateDto>> GetTodaysRecurringAsync(int userId);
    }

    public class TaskTemplateService : ITaskTemplateService
    {
        private readonly AppDbContext _db;

        public TaskTemplateService(AppDbContext db) { _db = db; }

        public async Task<TaskTemplateDto> CreateAsync(int userId, CreateTemplateDto dto)
        {
            var template = new TaskTemplate
            {
                UserId = userId,
                Title = dto.Title,
                Description = dto.Description,
                ProjectName = dto.ProjectName,
                DefaultTimeMinutes = dto.DefaultTimeMinutes,
                Priority = dto.Priority,
                Tags = dto.Tags,
                IsRecurring = dto.IsRecurring,
                RecurrenceDays = dto.RecurrenceDays
            };

            _db.TaskTemplates.Add(template);
            await _db.SaveChangesAsync();
            return MapTemplate(template);
        }

        public async Task<List<TaskTemplateDto>> GetMyTemplatesAsync(int userId) =>
            await _db.TaskTemplates
                .Where(t => t.UserId == userId && t.IsActive)
                .OrderBy(t => t.Title)
                .Select(t => new TaskTemplateDto
                {
                    Id = t.Id,
                    Title = t.Title,
                    Description = t.Description,
                    ProjectName = t.ProjectName,
                    DefaultTimeMinutes = t.DefaultTimeMinutes,
                    Priority = t.Priority,
                    Tags = t.Tags,
                    IsRecurring = t.IsRecurring,
                    RecurrenceDays = t.RecurrenceDays,
                    CreatedAt = t.CreatedAt
                }).ToListAsync();

        public async Task DeleteAsync(int templateId, int userId)
        {
            var t = await _db.TaskTemplates
                .FirstOrDefaultAsync(t => t.Id == templateId && t.UserId == userId)
                ?? throw new KeyNotFoundException();
            t.IsActive = false;
            await _db.SaveChangesAsync();
        }

        public async Task<TaskLogDto> CreateFromTemplateAsync(int userId, int templateId, int dailyLogId)
        {
            var template = await _db.TaskTemplates
                .FirstOrDefaultAsync(t => t.Id == templateId && t.UserId == userId)
                ?? throw new KeyNotFoundException("Template not found.");

            var task = new TaskLog
            {
                DailyLogId = dailyLogId,
                TaskTitle = template.Title,
                Description = template.Description,
                ProjectName = template.ProjectName,
                Status = "InProgress",
                TimeSpentMinutes = template.DefaultTimeMinutes,
                Priority = template.Priority,
                Tags = template.Tags
            };

            _db.TaskLogs.Add(task);
            await _db.SaveChangesAsync();

            return new TaskLogDto
            {
                Id = task.Id,
                TaskTitle = task.TaskTitle,
                Description = task.Description,
                ProjectName = task.ProjectName,
                Status = task.Status,
                TimeSpentMinutes = task.TimeSpentMinutes,
                Priority = task.Priority,
                Tags = task.Tags,
                CreatedAt = task.CreatedAt
            };
        }

        public async Task<List<TaskTemplateDto>> GetTodaysRecurringAsync(int userId)
        {
            var todayName = DateTime.UtcNow.DayOfWeek.ToString()[..3]; // "Mon", "Tue" etc.

            return await _db.TaskTemplates
                .Where(t => t.UserId == userId && t.IsActive && t.IsRecurring &&
                            (t.RecurrenceDays == null || t.RecurrenceDays.Contains(todayName)))
                .Select(t => new TaskTemplateDto
                {
                    Id = t.Id,
                    Title = t.Title,
                    Description = t.Description,
                    ProjectName = t.ProjectName,
                    DefaultTimeMinutes = t.DefaultTimeMinutes,
                    Priority = t.Priority,
                    Tags = t.Tags,
                    IsRecurring = t.IsRecurring,
                    RecurrenceDays = t.RecurrenceDays,
                    CreatedAt = t.CreatedAt
                }).ToListAsync();
        }

        private static TaskTemplateDto MapTemplate(TaskTemplate t) => new()
        {
            Id = t.Id,
            Title = t.Title,
            Description = t.Description,
            ProjectName = t.ProjectName,
            DefaultTimeMinutes = t.DefaultTimeMinutes,
            Priority = t.Priority,
            Tags = t.Tags,
            IsRecurring = t.IsRecurring,
            RecurrenceDays = t.RecurrenceDays,
            CreatedAt = t.CreatedAt
        };
    }
}
