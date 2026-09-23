using DailyTrackerAPI.Models.Auth;

namespace DailyTrackerAPI.Models.Tasks
{
    // ─────────────────────────────────────────────────────────────────────────────
    // FEATURE 1: AI-Powered Daily Summary
    // ─────────────────────────────────────────────────────────────────────────────

    public class AISummary
    {
        public int Id { get; set; }
        public int UserId { get; set; }
        public User User { get; set; } = null!;

        public DateTime SummaryDate { get; set; }         // The date this summary covers
        public string SummaryType { get; set; } = "Daily"; // Daily | WeeklyTeam | MonthlyTeam
        public string Content { get; set; } = "";          // Full AI-generated text
        public string? KeyHighlights { get; set; }         // JSON array of bullet points
        public string? Suggestions { get; set; }           // AI productivity suggestions

        // Stats snapshot when summary was generated
        public int TasksCompleted { get; set; }
        public int SupportGiven { get; set; }
        public int WorkMinutes { get; set; }
        public double ProductivityScore { get; set; }

        public DateTime GeneratedAt { get; set; } = DateTime.UtcNow;
        public string Model { get; set; } = "claude-sonnet-4-6";
        public int TokensUsed { get; set; }
    }
}
