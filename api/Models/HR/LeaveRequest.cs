using DailyTrackerAPI.Models.Auth;

namespace DailyTrackerAPI.Models.HR
{
    // ─── Feature 9: Leave Management ─────────────────────────────────────────
    public class LeaveRequest
    {
        public int Id { get; set; }
        public int UserId { get; set; }
        public DateTime FromDate { get; set; }
        public DateTime ToDate { get; set; }
        public string LeaveType { get; set; } = "Casual"; // Casual, Sick, Earned, CompOff, Unpaid
        public string Reason { get; set; } = string.Empty;
        public string Status { get; set; } = "Pending"; // Pending, Approved, Rejected
        public int? ReviewedByUserId { get; set; }
        public string? ReviewNote { get; set; }
        public DateTime? ReviewedAt { get; set; }
        public DateTime AppliedAt { get; set; } = DateTime.UtcNow;
        public virtual User User { get; set; } = null!;
        public virtual User? ReviewedBy { get; set; }
    }
}
