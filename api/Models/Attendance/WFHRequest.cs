using DailyTrackerAPI.Models.Auth;
using DailyTrackerAPI.Models.Tasks;
using System.ComponentModel.DataAnnotations;

namespace DailyTrackerAPI.Models.Attendance
{
    // ═══════════════════════════════════════════════════════════════════════════
    // WFH / HALF-DAY REQUEST MODEL
    // Allows developers to request Work-From-Home or Half-Day attendance status.
    // Manager approves/rejects. On approval, the related DailyLog.DayStatus
    // is updated automatically.
    // ═══════════════════════════════════════════════════════════════════════════

    public class WFHRequest
    {
        public int Id { get; set; }

        // ── Who requested ─────────────────────────────────────────────────────
        public int UserId { get; set; }
        public virtual User User { get; set; } = null!;

        // ── What is requested ─────────────────────────────────────────────────
        /// <summary>WFH or HalfDay</summary>
        [Required, MaxLength(20)]
        public string RequestType { get; set; } = "WFH"; // "WFH" | "HalfDay"

        /// <summary>Which date the WFH/HalfDay applies to</summary>
        public DateTime RequestDate { get; set; }

        /// <summary>Only applies when RequestType = HalfDay (Morning or Afternoon)</summary>
        [MaxLength(20)]
        public string? HalfDaySlot { get; set; } // "Morning" | "Afternoon"

        /// <summary>Reason provided by the employee</summary>
        [Required, MaxLength(500)]
        public string Reason { get; set; } = string.Empty;

        // ── Request status ────────────────────────────────────────────────────
        /// <summary>Pending → Approved | Rejected | Cancelled</summary>
        [MaxLength(20)]
        public string Status { get; set; } = "Pending";

        // ── Manager review ────────────────────────────────────────────────────
        public int? ReviewedByUserId { get; set; }
        public virtual User? ReviewedBy { get; set; }

        [MaxLength(500)]
        public string? ReviewNote { get; set; }

        public DateTime? ReviewedAt { get; set; }

        // ── Linked DailyLog (set after approval when log exists) ──────────────
        public int? DailyLogId { get; set; }
        public virtual DailyLog? DailyLog { get; set; }

        // ── Timestamps ───────────────────────────────────────────────────────
        public DateTime RequestedAt { get; set; } = DateTime.UtcNow;
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    }
}
