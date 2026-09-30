using DailyTrackerAPI.Models.Auth;
using DailyTrackerAPI.Models.Tasks;

namespace DailyTrackerAPI.Models.HR
{
    /// <summary>
    /// One comp-off day earned by working on a weekend or a public holiday.
    /// Created automatically from the day's log, approved by the manager / team
    /// lead, then spent on a "CompOff" leave before it expires.
    /// </summary>
    public class CompOffCredit
    {
        public int Id { get; set; }
        public int UserId { get; set; }
        public int DailyLogId { get; set; }                 // the day worked (one credit per day)
        public DateTime WorkDate { get; set; }              // India date
        public string Occasion { get; set; } = "";          // "Sunday", "Diwali" …
        public int WorkMinutes { get; set; }
        public string Status { get; set; } = "Pending";     // Pending, Approved, Rejected
        public DateTime ExpiresOn { get; set; }             // last day it can be used
        public int? UsedByLeaveId { get; set; }             // the CompOff leave it pays for
        public int? ReviewedById { get; set; }
        public string? ReviewNote { get; set; }
        public DateTime? ReviewedAt { get; set; }
        public bool ExpiryReminderSent { get; set; }
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        public virtual User User { get; set; } = null!;
        public virtual DailyLog DailyLog { get; set; } = null!;
        public virtual LeaveRequest? UsedByLeave { get; set; }
        public virtual User? ReviewedBy { get; set; }
    }
}
