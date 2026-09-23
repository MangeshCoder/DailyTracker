using DailyTrackerAPI.Data;
using DailyTrackerAPI.DTOs;
using DailyTrackerAPI.Models;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using DailyTrackerAPI.Models.Performance;


namespace DailyTrackerAPI.Services.Team
{
    // ─────────────────────────────────────────────────────────────────────────
    //  Feature 11: Audit Log Service
    // ─────────────────────────────────────────────────────────────────────────
    public interface IAuditService
    {
        Task LogAsync(int? userId, string action, string entity, int? entityId = null,
            object? oldValues = null, object? newValues = null, string? ipAddress = null);
        Task<List<AuditLogDto>> GetLogsAsync(int? userId = null, string? entity = null, int take = 50);
    }

    public class AuditService : IAuditService
    {
        private readonly AppDbContext _db;

        public AuditService(AppDbContext db) { _db = db; }

        public async Task LogAsync(int? userId, string action, string entity, int? entityId = null,
            object? oldValues = null, object? newValues = null, string? ipAddress = null)
        {
            _db.AuditLogs.Add(new AuditLog
            {
                UserId = userId,
                Action = action,
                Entity = entity,
                EntityId = entityId,
                OldValues = oldValues != null ? JsonSerializer.Serialize(oldValues) : null,
                NewValues = newValues != null ? JsonSerializer.Serialize(newValues) : null,
                IpAddress = ipAddress
            });

            await _db.SaveChangesAsync();
        }

        public async Task<List<AuditLogDto>> GetLogsAsync(int? userId = null, string? entity = null, int take = 50)
        {
            var query = _db.AuditLogs
                .Include(a => a.User)
                .AsQueryable();

            if (userId.HasValue) query = query.Where(a => a.UserId == userId);
            if (!string.IsNullOrEmpty(entity)) query = query.Where(a => a.Entity == entity);

            return await query
                .OrderByDescending(a => a.CreatedAt)
                .Take(take)
                .Select(a => new AuditLogDto
                {
                    Id = a.Id,
                    UserName = a.User != null ? a.User.FullName : "System",
                    Action = a.Action,
                    Entity = a.Entity,
                    EntityId = a.EntityId,
                    OldValues = a.OldValues,
                    NewValues = a.NewValues,
                    IpAddress = a.IpAddress,
                    CreatedAt = a.CreatedAt
                })
                .ToListAsync();
        }
    }
}
