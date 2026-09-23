//  Flow:
//    Employee submits resignation (Status = Pending)
//    Manager acknowledges / accepts (Status = Accepted, NoticePeriodEndDate set)
//    Manager marks exit complete (Status = Completed, User.IsActive = false)
//    At any point Manager can reject it (Status = Rejected)
//
//  ExitChecklist tracks individual handover tasks:
//    e.g. "Return Laptop", "Revoke Access", "Final Salary Processed", etc.
//    Each item can be ticked off independently by the manager.
//
// ─────────────────────────────────────────────────────────────────────────────

using DailyTrackerAPI.Models.Auth;
using System.ComponentModel.DataAnnotations;

namespace DailyTrackerAPI.Models.HR
{
    public class Resignation
    {
        public int Id { get; set; }

        // Employee who is resigning
        public int UserId { get; set; }
        public virtual User User { get; set; } = null!;

        [Required, MaxLength(1000)]
        public string Reason { get; set; } = string.Empty;

        /// <summary>Employee's requested last working day</summary>
        public DateTime RequestedLastDay { get; set; }

        /// <summary>Pending | Accepted | Rejected | Completed</summary>
        [MaxLength(20)]
        public string Status { get; set; } = "Pending";

        // ── Manager review ────────────────────────────────────────────────────
        public int? ReviewedByUserId { get; set; }
        public virtual User? ReviewedBy { get; set; }

        [MaxLength(1000)]
        public string? ReviewNote { get; set; }

        public DateTime? ReviewedAt { get; set; }

        /// <summary>
        /// Official last working day set by manager (may differ from RequestedLastDay).
        /// Null until manager accepts.
        /// </summary>
        public DateTime? NoticePeriodEndDate { get; set; }

        /// <summary>Set when Status = Completed — the employee is deactivated on this date</summary>
        public DateTime? ExitDate { get; set; }

        // ── Timestamps ────────────────────────────────────────────────────────
        public DateTime SubmittedAt { get; set; } = DateTime.UtcNow;
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

        // Navigation
        public ICollection<ExitChecklistItem> ChecklistItems { get; set; } = new List<ExitChecklistItem>();
    }

    /// <summary>
    /// Individual handover / offboarding task attached to a Resignation.
    /// Created automatically when manager accepts the resignation.
    /// Manager can tick each one off from the UI.
    /// </summary>
    public class ExitChecklistItem
    {
        public int Id { get; set; }

        public int ResignationId { get; set; }
        public virtual Resignation Resignation { get; set; } = null!;

        [Required, MaxLength(200)]
        public string Task { get; set; } = string.Empty;   // "Return Laptop", "Revoke VPN", etc.

        public bool IsCompleted { get; set; } = false;

        public DateTime? CompletedAt { get; set; }

        public int? CompletedByUserId { get; set; }
        public virtual User? CompletedBy { get; set; }
    }
}
