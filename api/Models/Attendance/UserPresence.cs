using DailyTrackerAPI.Models.Auth;

namespace DailyTrackerAPI.Models.Attendance
{
    // ─── Feature 9: Team Presence / Availability ──────────────────────────────
    public class UserPresence
    {
        public int Id { get; set; }
        public int UserId { get; set; }
        public bool IsAvailableForHelp { get; set; }
        public string Status { get; set; } = "Online"; // Online, Busy, InMeeting, Away
        public string? StatusMessage { get; set; }
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
        public virtual User User { get; set; } = null!;
    }
}
