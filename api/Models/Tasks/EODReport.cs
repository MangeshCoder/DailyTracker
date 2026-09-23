using DailyTrackerAPI.Models.Auth;

namespace DailyTrackerAPI.Models.Tasks
{
    // ─── Feature 6: EOD Report ────────────────────────────────────────────────
    public class EODReport
    {
        public int Id { get; set; }
        public int UserId { get; set; }
        public int DailyLogId { get; set; }
        public DateTime ReportDate { get; set; }
        public string WhatWasDone { get; set; } = string.Empty;
        public string? Blockers { get; set; }
        public string? PlanForTomorrow { get; set; }
        public string? Learnings { get; set; }
        public string MoodRating { get; set; } = "Good"; // Great, Good, Okay, Tired, Stressed
        public DateTime SubmittedAt { get; set; } = DateTime.UtcNow;
        public bool IsReviewedByManager { get; set; }
        public string? ManagerComment { get; set; }
        public virtual User User { get; set; } = null!;
        public virtual DailyLog DailyLog { get; set; } = null!;
    }
}
