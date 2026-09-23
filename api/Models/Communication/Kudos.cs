using DailyTrackerAPI.Models.Auth;

namespace DailyTrackerAPI.Models.Communication
{
    // ─── Feature 9: Kudos / Peer Recognition ──────────────────────────────────
    public class Kudos
    {
        public int Id { get; set; }
        public int FromUserId { get; set; }
        public int ToUserId { get; set; }
        public string Message { get; set; } = string.Empty;
        public string BadgeType { get; set; } = "GreatWork"; // GreatWork, TeamPlayer, ProblemSolver, Mentor, Innovation
        public DateTime GivenAt { get; set; } = DateTime.UtcNow;
        public virtual User FromUser { get; set; } = null!;
        public virtual User ToUser { get; set; } = null!;
    }
}
