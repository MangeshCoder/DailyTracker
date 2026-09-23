using DailyTrackerAPI.Data;
using DailyTrackerAPI.DTOs;
using DailyTrackerAPI.Models.Communication;
using Microsoft.EntityFrameworkCore;

namespace DailyTrackerAPI.Services.Communication
{
    // ─────────────────────────────────────────────────────────────────────────
    //  Feature 10: Announcement Service
    // ─────────────────────────────────────────────────────────────────────────
    public interface IAnnouncementService
    {
        Task<AnnouncementsResponseDto> GetAllAsync(int requestingUserId);
        Task<int> GetUnreadCountAsync(int userId);
        Task<AnnouncementDto> CreateAsync(int createdByUserId, CreateAnnouncementDto dto);
        Task MarkReadAsync(int userId, int announcementId);
        Task MarkAllReadAsync(int userId);
        Task DeleteAsync(int id);
        Task<AnnouncementDto> TogglePinAsync(int id);
    }

    public class AnnouncementService : IAnnouncementService
    {
        private readonly AppDbContext _db;
        private readonly INotificationSender _notif;

        public AnnouncementService(AppDbContext db, INotificationSender notif)
        {
            _db = db;
            _notif = notif;
        }

        // ── Get All (with per-user read flags) ────────────────────────────────
        public async Task<AnnouncementsResponseDto> GetAllAsync(int requestingUserId)
        {
            var now = DateTime.UtcNow;

            // Load non-expired announcements + this user's reads in two queries
            var announcements = await _db.Announcements
                .Include(a => a.CreatedBy)
                .Where(a => a.ExpiresAt == null || a.ExpiresAt > now)
                .OrderByDescending(a => a.IsPinned)
                .ThenByDescending(a => a.CreatedAt)
                .ToListAsync();

            // Which ones has this user already read?
            var readIds = await _db.AnnouncementReads
                .Where(r => r.UserId == requestingUserId)
                .Select(r => r.AnnouncementId)
                .ToHashSetAsync();

            AnnouncementDto Map(Announcement a) => new AnnouncementDto
            {
                Id = a.Id,
                Title = a.Title,
                Content = a.Content,
                Category = a.Category,
                IsPinned = a.IsPinned,
                ExpiresAt = a.ExpiresAt,
                CreatedAt = a.CreatedAt,
                CreatedByName = a.CreatedBy.FullName,
                IsRead = readIds.Contains(a.Id)
            };

            var all = announcements.Select(Map).ToList();
            var pinned = all.Where(a => a.IsPinned).ToList();
            var regular = all.Where(a => !a.IsPinned).ToList();
            int unread = all.Count(a => !a.IsRead);

            return new AnnouncementsResponseDto
            {
                Pinned = pinned,
                Regular = regular,
                UnreadCount = unread
            };
        }

        // ── Unread Count (for nav badge — lightweight query) ──────────────────
        public async Task<int> GetUnreadCountAsync(int userId)
        {
            var now = DateTime.UtcNow;

            var totalActive = await _db.Announcements
                .CountAsync(a => a.ExpiresAt == null || a.ExpiresAt > now);

            var readCount = await _db.AnnouncementReads
                .CountAsync(r => r.UserId == userId);

            // "unread" = active announcements the user hasn't marked read yet
            // (Simpler than a NOT IN subquery; works because reads are only for active posts)
            return Math.Max(0, totalActive - readCount);
        }

        // ── Create ────────────────────────────────────────────────────────────
        public async Task<AnnouncementDto> CreateAsync(int createdByUserId, CreateAnnouncementDto dto)
        {
            var creator = await _db.Users.FindAsync(createdByUserId)
                          ?? throw new KeyNotFoundException("User not found.");

            var announcement = new Announcement
            {
                Title = dto.Title,
                Content = dto.Content,
                Category = dto.Category,
                IsPinned = dto.IsPinned,
                ExpiresAt = dto.ExpiresAt,
                CreatedByUserId = createdByUserId
            };

            _db.Announcements.Add(announcement);
            await _db.SaveChangesAsync();

            // Mark as read immediately for the creator
            _db.AnnouncementReads.Add(new AnnouncementRead
            {
                AnnouncementId = announcement.Id,
                UserId = createdByUserId
            });
            await _db.SaveChangesAsync();

            var resultDto = new AnnouncementDto
            {
                Id = announcement.Id,
                Title = announcement.Title,
                Content = announcement.Content,
                Category = announcement.Category,
                IsPinned = announcement.IsPinned,
                ExpiresAt = announcement.ExpiresAt,
                CreatedAt = announcement.CreatedAt,
                CreatedByName = creator.FullName,
                IsRead = true   // creator has read it
            };

            // ── Real-time push to ALL users via existing SignalR "all_users" group
            await _notif.SendToAll("NewAnnouncement", new
            {
                Id = resultDto.Id,
                Title = resultDto.Title,
                Category = resultDto.Category,
                CreatedByName = resultDto.CreatedByName,
                IsPinned = resultDto.IsPinned,
                CreatedAt = resultDto.CreatedAt
            });

            return resultDto;
        }

        // ── Mark Single Read ──────────────────────────────────────────────────
        public async Task MarkReadAsync(int userId, int announcementId)
        {
            bool alreadyRead = await _db.AnnouncementReads
                .AnyAsync(r => r.UserId == userId && r.AnnouncementId == announcementId);

            if (!alreadyRead)
            {
                _db.AnnouncementReads.Add(new AnnouncementRead
                {
                    AnnouncementId = announcementId,
                    UserId = userId
                });
                await _db.SaveChangesAsync();
            }
        }

        // ── Mark ALL Read (for "mark all as read" button) ─────────────────────
        public async Task MarkAllReadAsync(int userId)
        {
            var now = DateTime.UtcNow;

            // Get IDs of active announcements this user hasn't read yet
            var readIds = await _db.AnnouncementReads
                .Where(r => r.UserId == userId)
                .Select(r => r.AnnouncementId)
                .ToListAsync();

            var unreadIds = await _db.Announcements
                .Where(a => (a.ExpiresAt == null || a.ExpiresAt > now) && !readIds.Contains(a.Id))
                .Select(a => a.Id)
                .ToListAsync();

            foreach (var id in unreadIds)
            {
                _db.AnnouncementReads.Add(new AnnouncementRead
                {
                    AnnouncementId = id,
                    UserId = userId
                });
            }

            if (unreadIds.Count > 0)
                await _db.SaveChangesAsync();
        }

        // ── Delete ────────────────────────────────────────────────────────────
        public async Task DeleteAsync(int id)
        {
            var announcement = await _db.Announcements.FindAsync(id)
                               ?? throw new KeyNotFoundException("Announcement not found.");
            _db.Announcements.Remove(announcement);
            await _db.SaveChangesAsync();
        }

        // ── Toggle Pin ────────────────────────────────────────────────────────
        public async Task<AnnouncementDto> TogglePinAsync(int id)
        {
            var a = await _db.Announcements
                        .Include(x => x.CreatedBy)
                        .FirstOrDefaultAsync(x => x.Id == id)
                    ?? throw new KeyNotFoundException("Announcement not found.");

            a.IsPinned = !a.IsPinned;
            await _db.SaveChangesAsync();

            return new AnnouncementDto
            {
                Id = a.Id,
                Title = a.Title,
                Content = a.Content,
                Category = a.Category,
                IsPinned = a.IsPinned,
                ExpiresAt = a.ExpiresAt,
                CreatedAt = a.CreatedAt,
                CreatedByName = a.CreatedBy.FullName,
                IsRead = true
            };
        }
    }
}
