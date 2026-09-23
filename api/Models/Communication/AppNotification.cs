using DailyTrackerAPI.Models.Auth;

namespace DailyTrackerAPI.Models.Communication
{
    // ─── Feature 1: In-App Notifications ──────────────────────────────────────
    public class AppNotification
    {
        public int Id { get; set; }
        public int UserId { get; set; }
        public string Title { get; set; } = string.Empty;
        public string Message { get; set; } = string.Empty;
        public string Type { get; set; } = "Info"; // Info, Warning, Success, Reminder
        public string? ActionUrl { get; set; }
        public bool IsRead { get; set; }
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public virtual User User { get; set; } = null!;
    }
}
