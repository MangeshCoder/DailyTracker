using DailyTrackerAPI.Data;
using DailyTrackerAPI.DTOs;
using DailyTrackerAPI.Models.Attendance;
using Microsoft.EntityFrameworkCore;
using DailyTrackerAPI.Helpers;

namespace DailyTrackerAPI.Services.Attendance
{
    // ─── Break Service ─────────────────────────────────────────────────────────

    public interface IBreakService
    {
        Task<BreakLogDto?> StartBreakAsync(int userId, StartBreakDto dto);
        Task<BreakLogDto?> EndBreakAsync(int userId, int breakId);
        Task<List<BreakLogDto>> GetTodayBreaksAsync(int userId);
    }

    public class BreakService : IBreakService
    {
        private readonly AppDbContext _db;
        public BreakService(AppDbContext db) { _db = db; }

        private static readonly string[] BreakTypes = { "Tea", "Lunch", "Other" };

        public async Task<BreakLogDto?> StartBreakAsync(int userId, StartBreakDto dto)
        {
            var log = await _db.DailyLogs
                .Include(d => d.BreakLogs)
                .CurrentForAsync(userId);

            if (log == null || log.CheckInTime == null) return null;
            if (log.CheckOutTime != null)
                throw new Custom.ValidationException("You've already checked out for today.");
            var breakType = BreakTypes.FirstOrDefault(t => t.Equals(dto.BreakType?.Trim(), StringComparison.OrdinalIgnoreCase))
                ?? throw new Custom.ValidationException("Break type must be Tea, Lunch or Other.");
            dto.BreakType = breakType;

            // End any existing active break first
            var activeBreak = log.BreakLogs.FirstOrDefault(b => b.IsActive);
            if (activeBreak != null)
            {
                activeBreak.EndTime = DateTime.UtcNow;
                activeBreak.DurationMinutes = (int)(DateTime.UtcNow - activeBreak.StartTime).TotalMinutes;
                activeBreak.IsActive = false;
            }

            var breakLog = new BreakLog
            {
                DailyLogId = log.Id,
                BreakType = dto.BreakType,
                StartTime = DateTime.UtcNow,
                IsActive = true
            };

            _db.BreakLogs.Add(breakLog);
            await _db.SaveChangesAsync();

            return MapBreakDto(breakLog);
        }

        public async Task<BreakLogDto?> EndBreakAsync(int userId, int breakId)
        {
            var log = await _db.DailyLogs.CurrentForAsync(userId);
            if (log == null) return null;

            var breakLog = await _db.BreakLogs.FirstOrDefaultAsync(b => b.Id == breakId && b.DailyLogId == log.Id);
            if (breakLog == null) return null;
            if (!breakLog.IsActive) return MapBreakDto(breakLog);   // already ended — keep its real end time

            breakLog.EndTime = DateTime.UtcNow;
            breakLog.DurationMinutes = (int)(DateTime.UtcNow - breakLog.StartTime).TotalMinutes;
            breakLog.IsActive = false;

            await _db.SaveChangesAsync();
            return MapBreakDto(breakLog);
        }

        public async Task<List<BreakLogDto>> GetTodayBreaksAsync(int userId)
        {
            var log = await _db.DailyLogs.Include(d => d.BreakLogs)
                .CurrentForAsync(userId);

            return log?.BreakLogs.Select(MapBreakDto).ToList() ?? new List<BreakLogDto>();
        }

        private static BreakLogDto MapBreakDto(BreakLog b) => new()
        {
            Id = b.Id,
            BreakType = b.BreakType,
            StartTime = b.StartTime,
            EndTime = b.EndTime,
            DurationMinutes = b.IsActive
                ? (int)(DateTime.UtcNow - b.StartTime).TotalMinutes
                : b.DurationMinutes,
            IsActive = b.IsActive
        };
    }
}
