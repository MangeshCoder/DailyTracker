using DailyTrackerAPI.Models.Auth;

namespace DailyTrackerAPI.Models.Communication
{
    // ─── Feature 10: Announcement Board ──────────────────────────────────────
    // Managers post company-wide announcements; all users see them in real time
    // via the SendToAll SignalR group ("all_users") already wired in the hub.
    // Reads are tracked per-user so the nav badge shows correct unread count.
    public class Announcement
    {
        public int Id { get; set; }
        public string Title { get; set; } = string.Empty;
        public string Content { get; set; } = string.Empty;
        public string Category { get; set; } = "General"; // General | Policy | Event | Urgent
        public bool IsPinned { get; set; } = false;
        public DateTime? ExpiresAt { get; set; }              // null = never expires
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public int CreatedByUserId { get; set; }

        // Navigation
        public virtual User CreatedBy { get; set; } = null!;
        public ICollection<AnnouncementRead> Reads { get; set; } = new List<AnnouncementRead>();
    }

    // Tracks which user has read which announcement (used for unread badge count)
    public class AnnouncementRead
    {
        public int AnnouncementId { get; set; }
        public int UserId { get; set; }
        public DateTime ReadAt { get; set; } = DateTime.UtcNow;

        // Navigation
        public virtual Announcement Announcement { get; set; } = null!;
        public virtual User User { get; set; } = null!;
    }
}
