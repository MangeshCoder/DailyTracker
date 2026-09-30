using DailyTrackerAPI.Models.Attendance;
using DailyTrackerAPI.Models.Auth;
using System.ComponentModel.DataAnnotations;
using DailyTrackerAPI.Helpers;

namespace DailyTrackerAPI.Models.Tasks
{
    public class DailyLog
    {
        public int Id { get; set; }

        public int UserId { get; set; }
        public User User { get; set; } = null!;

        public DateTime LogDate { get; set; } = AppClock.TodayIst;

        public DateTime? CheckInTime { get; set; }

        public DateTime? CheckOutTime { get; set; }

        public int TotalWorkMinutes { get; set; } = 0;

        public int TotalBreakMinutes { get; set; } = 0;

        public string DayStatus { get; set; } = "Present"; // Present, WFH, HalfDay, Absent

        [MaxLength(500)]
        public string? Notes { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        // ── Check-in location (nullable — old records won't have these) ───────
        public double? CheckInLatitude { get; set; }
        public double? CheckInLongitude { get; set; }

        // ── Check-out location (nullable) ─────────────────────────────────────
        public double? CheckOutLatitude { get; set; }
        public double? CheckOutLongitude { get; set; }

        // ── Forgotten check-out ───────────────────────────────────────────────
        // The app closed the day because nobody checked out: at the last proof of
        // work ("LastActivity") or after a normal day ("NormalDay").
        public bool AutoCheckedOut { get; set; }
        [MaxLength(20)]
        public string? AutoCheckOutBasis { get; set; }

        // The employee's answer: null = not answered yet, "Confirmed" = the time is
        // right, "Pending" / "Approved" / "Rejected" = a correction for the manager
        [MaxLength(20)]
        public string? CorrectionStatus { get; set; }
        public DateTime? CorrectionCheckOut { get; set; }
        [MaxLength(300)]
        public string? CorrectionReason { get; set; }
        public int? CorrectionReviewedById { get; set; }
        [MaxLength(300)]
        public string? CorrectionReviewNote { get; set; }
        public DateTime? CorrectionReviewedAt { get; set; }

        // Navigation
        public ICollection<BreakLog> BreakLogs { get; set; } = new List<BreakLog>();
        public ICollection<TaskLog> TaskLogs { get; set; } = new List<TaskLog>();
        public ICollection<SupportLog> SupportLogs { get; set; } = new List<SupportLog>();
    }
}
