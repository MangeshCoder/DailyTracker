using DailyTrackerAPI.Data;
using DailyTrackerAPI.DTOs;
using DailyTrackerAPI.Models;
using DailyTrackerAPI.Models.Attendance;
using Microsoft.EntityFrameworkCore;

namespace DailyTrackerAPI.Services.Attendance
{
    // ─────────────────────────────────────────────────────────────────────────
    //  Feature 9: Presence Service
    // ─────────────────────────────────────────────────────────────────────────
    public interface IPresenceService
    {
        Task UpdateAsync(int userId, UpdatePresenceDto dto);
        Task<List<UserPresenceDto>> GetTeamPresenceAsync();
    }

    public class PresenceService : IPresenceService
    {
        private readonly AppDbContext _db;

        public PresenceService(AppDbContext db) { _db = db; }

        public async Task UpdateAsync(int userId, UpdatePresenceDto dto)
        {
            var presence = await _db.UserPresences.FirstOrDefaultAsync(p => p.UserId == userId);

            if (presence == null)
            {
                _db.UserPresences.Add(new UserPresence
                {
                    UserId = userId,
                    IsAvailableForHelp = dto.IsAvailableForHelp,
                    Status = dto.Status,
                    StatusMessage = dto.StatusMessage
                });
            }
            else
            {
                presence.IsAvailableForHelp = dto.IsAvailableForHelp;
                presence.Status = dto.Status;
                presence.StatusMessage = dto.StatusMessage;
                presence.UpdatedAt = DateTime.UtcNow;
            }

            await _db.SaveChangesAsync();
        }

        public async Task<List<UserPresenceDto>> GetTeamPresenceAsync()
        {
            var today = DateTime.UtcNow.Date;
            var users = await _db.Users.Where(u => u.IsActive).ToListAsync();

            var presences = await _db.UserPresences.ToDictionaryAsync(p => p.UserId);
            var todayLogs = await _db.DailyLogs
                .Where(d => d.LogDate == today)
                .ToDictionaryAsync(d => d.UserId);

            return users.Select(u =>
            {
                presences.TryGetValue(u.Id, out var p);
                todayLogs.TryGetValue(u.Id, out var log);

                return new UserPresenceDto
                {
                    User = new UserDto { Id = u.Id, FullName = u.FullName, Email = u.Email, Role = u.Role },
                    IsAvailableForHelp = p?.IsAvailableForHelp ?? false,
                    Status = p?.Status ?? "Offline",
                    StatusMessage = p?.StatusMessage,
                    UpdatedAt = p?.UpdatedAt ?? DateTime.MinValue,
                    IsCheckedInToday = log != null,
                    CheckInTime = log?.CheckInTime?.ToLocalTime().ToString("hh:mm tt")
                };
            }).ToList();
        }
    }
}
