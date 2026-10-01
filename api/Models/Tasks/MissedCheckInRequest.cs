using DailyTrackerAPI.Models.Auth;

namespace DailyTrackerAPI.Models.Tasks
{
    /// <summary>
    /// "I worked on … but forgot to check in." The employee gives the times; when a
    /// team lead / manager approves, the day is added as a normal attendance record
    /// (DailyLog), so attendance %, absences and payroll pick it up.
    /// </summary>
    public class MissedCheckInRequest
    {
        public int Id { get; set; }
        public int UserId { get; set; }
        public DateTime Date { get; set; }                 // India date of the missed day
        public DateTime CheckIn { get; set; }              // UTC
        public DateTime CheckOut { get; set; }             // UTC
        public string WorkMode { get; set; } = "Office";   // Office | WFH
        public string Reason { get; set; } = string.Empty;
        public string Status { get; set; } = "Pending";    // Pending | Approved | Rejected | Cancelled
        public int? ReviewedById { get; set; }
        public string? ReviewNote { get; set; }
        public DateTime? ReviewedAt { get; set; }
        public int? DailyLogId { get; set; }               // the day added on approval
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        public virtual User User { get; set; } = null!;
        public virtual User? ReviewedBy { get; set; }
    }
}
