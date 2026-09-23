using DailyTrackerAPI.Data;
using DailyTrackerAPI.DTOs;
using DailyTrackerAPI.Models;
using DailyTrackerAPI.Models.Communication;
using Microsoft.EntityFrameworkCore;

namespace DailyTrackerAPI.Services.Communication
{
    // ─────────────────────────────────────────────────────────────────────────
    //  Feature 1: Notification Service
    //
    //  ONLY CHANGE from your original:
    //    1. Added CreateForUsersAsync to the interface  (line 16)
    //    2. Added CreateForUsersAsync implementation    (below CreateAsync)
    //
    //  Every other line is identical to your original code.
    // ─────────────────────────────────────────────────────────────────────────
    public interface IAppNotificationService
    {
        Task<List<NotificationDto>> GetMyNotificationsAsync(int userId, bool unreadOnly = false);
        Task MarkReadAsync(int notifId, int userId);
        Task MarkAllReadAsync(int userId);
        Task<int> GetUnreadCountAsync(int userId);
        Task CreateAsync(int userId, string title, string message, string type = "Info", string? actionUrl = null);

        // ── ADDED for NotificationSchedulerService ────────────────────────────
        // Scheduler needs to notify a LIST of users with one call.
        // Calling CreateAsync in a loop = N separate DB round-trips.
        // This method does one AddRange + one SaveChangesAsync for all users.
        Task CreateForUsersAsync(IEnumerable<int> userIds, string title, string message, string type = "Reminder", string? actionUrl = null);
        Task<List<NotificationDto>> GetPagedAsync(int userId, int skip, int take, bool unreadOnly = false);
        Task<bool> DeleteAsync(int notifId, int userId);
        Task<int> DeleteAllReadAsync(int userId);
    }

    public class AppNotificationService : IAppNotificationService
    {
        private readonly AppDbContext _db;
        private readonly INotificationSender _sender;

        public AppNotificationService(AppDbContext db, INotificationSender sender)
        {
            _db = db;
            _sender = sender;
        }

        // ── ALL METHODS BELOW ARE IDENTICAL TO YOUR ORIGINAL ─────────────────

        public async Task<List<NotificationDto>> GetMyNotificationsAsync(int userId, bool unreadOnly = false)
        {
            var query = _db.Notifications.Where(n => n.UserId == userId);
            if (unreadOnly) query = query.Where(n => !n.IsRead);

            return await query
                .OrderByDescending(n => n.CreatedAt)
                .Take(50)
                .Select(n => new NotificationDto
                {
                    Id = n.Id,
                    Title = n.Title,
                    Message = n.Message,
                    Type = n.Type,
                    ActionUrl = n.ActionUrl,
                    IsRead = n.IsRead,
                    CreatedAt = n.CreatedAt
                }).ToListAsync();
        }

        public async Task MarkReadAsync(int notifId, int userId)
        {
            var n = await _db.Notifications.FirstOrDefaultAsync(n => n.Id == notifId && n.UserId == userId);
            if (n != null) { n.IsRead = true; await _db.SaveChangesAsync(); }
        }

        public async Task MarkAllReadAsync(int userId)
        {
            await _db.Notifications
                .Where(n => n.UserId == userId && !n.IsRead)
                .ExecuteUpdateAsync(s => s.SetProperty(n => n.IsRead, true));
        }

        public async Task<List<NotificationDto>> GetPagedAsync(
            int userId, int skip, int take, bool unreadOnly = false)
        {
            var query = _db.Notifications.Where(n => n.UserId == userId);
            if (unreadOnly) query = query.Where(n => !n.IsRead);

            return await query
                .OrderByDescending(n => n.CreatedAt)
                .Skip(skip)
                .Take(take)
                .Select(n => new NotificationDto
                {
                    Id = n.Id,
                    Title = n.Title,
                    Message = n.Message,
                    Type = n.Type,
                    ActionUrl = n.ActionUrl,
                    IsRead = n.IsRead,
                    CreatedAt = n.CreatedAt,
                })
                .ToListAsync();
        }

        public async Task<bool> DeleteAsync(int notifId, int userId)
        {
            var n = await _db.Notifications
                .FirstOrDefaultAsync(n => n.Id == notifId && n.UserId == userId);
            if (n == null) return false;
            _db.Notifications.Remove(n);
            await _db.SaveChangesAsync();
            return true;
        }

        // Single SQL  DELETE WHERE IsRead = 1 AND UserId = @userId
        // ExecuteDeleteAsync = no entity load, no loop, one round-trip
        public async Task<int> DeleteAllReadAsync(int userId) =>
            await _db.Notifications
                .Where(n => n.UserId == userId && n.IsRead)
                .ExecuteDeleteAsync();

        public Task<int> GetUnreadCountAsync(int userId) =>
            _db.Notifications.CountAsync(n => n.UserId == userId && !n.IsRead);

        public async Task CreateAsync(int userId, string title, string message,
            string type = "Info", string? actionUrl = null)
        {
            _db.Notifications.Add(new AppNotification
            {
                UserId = userId,
                Title = title,
                Message = message,
                Type = type,
                ActionUrl = actionUrl
            });
            await _db.SaveChangesAsync();

            // Push real-time
            await _sender.SendToUser(userId, "ReceiveNotification", new
            {
                Title = title,
                Message = message,
                Type = type,
                ActionUrl = actionUrl
            });
        }

        // ── ADDED: bulk create for NotificationSchedulerService ───────────────
        //
        // Called by the scheduler's 4 jobs, e.g.:
        //   await svc.CreateForUsersAsync(userIds, "📝 EOD Reminder", "...", "Reminder");
        //
        // Flow:
        //   1. Deduplicate the userIds list
        //   2. Build one AppNotification row per user (same title/message/type for all)
        //   3. AddRange → ONE SaveChangesAsync (single DB round-trip regardless of count)
        //   4. Loop and SendToUser per user via SignalR
        //      → each lands in that user's personal "user_{id}" SignalR group
        //      → if user is offline, push silently no-ops; notification is already in DB
        //        and will appear in the bell when they next open the app
        public async Task CreateForUsersAsync(
            IEnumerable<int> userIds,
            string title,
            string message,
            string type = "Reminder",
            string? actionUrl = null)
        {
            var list = userIds.Distinct().ToList();
            if (list.Count == 0) return;

            var notifications = list.Select(uid => new AppNotification
            {
                UserId = uid,
                Title = title,
                Message = message,
                Type = type,
                ActionUrl = actionUrl,
                IsRead = false,
                CreatedAt = DateTime.UtcNow
            }).ToList();

            _db.Notifications.AddRange(notifications);
            await _db.SaveChangesAsync();

            // Push to each user's personal SignalR group
            // Shape matches what your existing ReceiveNotification handler expects:
            //   const n = data as { title: string; message: string; type: string };
            foreach (var n in notifications)
            {
                await _sender.SendToUser(n.UserId, "ReceiveNotification", new
                {
                    n.Title,
                    n.Message,
                    n.Type,
                    n.ActionUrl
                });
            }
        }
    }
}