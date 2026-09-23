// ─────────────────────────────────────────────────────────────────────────────
//  FILE 1:  backend/Models/TrainingModels.cs
//  ACTION:  CREATE as a new file
// ─────────────────────────────────────────────────────────────────────────────
//
//  Two separate models:
//
//  Training  — a course / workshop / session the employee attended or plans to attend
//              (not file-based, just structured metadata + status)
//
//  Certification — a formal credential earned (with optional document upload)
//                  has an expiry date → drives the "Expiring Soon" alerts
//
// ─────────────────────────────────────────────────────────────────────────────

using DailyTrackerAPI.Models.Auth;
using System.ComponentModel.DataAnnotations;

namespace DailyTrackerAPI.Models.HR
{
    // ─── Training ─────────────────────────────────────────────────────────────
    public class Training
    {
        public int Id { get; set; }

        public int UserId { get; set; }
        public virtual User User { get; set; } = null!;

        [Required, MaxLength(200)]
        public string Title { get; set; } = string.Empty;

        [MaxLength(150)]
        public string? Provider { get; set; }           // "Udemy", "Coursera", "Internal HR", etc.

        /// <summary>Online | Internal | External | Conference | Workshop | Certification</summary>
        [MaxLength(30)]
        public string TrainingType { get; set; } = "Online";

        [MaxLength(1000)]
        public string? Description { get; set; }

        public DateTime StartDate { get; set; }
        public DateTime? EndDate { get; set; }

        /// <summary>Duration in hours (e.g. 8.5 for a full-day workshop)</summary>
        public decimal DurationHours { get; set; } = 0;

        /// <summary>Planned | InProgress | Completed | Cancelled</summary>
        [MaxLength(20)]
        public string Status { get; set; } = "Planned";

        [MaxLength(1000)]
        public string? Notes { get; set; }

        /// <summary>
        /// Optional link to course/certificate URL
        /// </summary>
        [MaxLength(500)]
        public string? CourseUrl { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    }

    // ─── Certification ────────────────────────────────────────────────────────
    public class Certification
    {
        public int Id { get; set; }

        public int UserId { get; set; }
        public virtual User User { get; set; } = null!;

        [Required, MaxLength(200)]
        public string Name { get; set; } = string.Empty;       // "AWS Solutions Architect"

        [Required, MaxLength(150)]
        public string IssuingOrganization { get; set; } = string.Empty;   // "Amazon Web Services"

        public DateTime IssueDate { get; set; }

        /// <summary>Null means the cert never expires</summary>
        public DateTime? ExpiryDate { get; set; }

        [MaxLength(100)]
        public string? CredentialId { get; set; }             // Certificate number / ID

        [MaxLength(500)]
        public string? CredentialUrl { get; set; }            // Verify link

        /// <summary>Active | Expired | Revoked</summary>
        [MaxLength(20)]
        public string Status { get; set; } = "Active";

        // ── Optional uploaded certificate file ────────────────────────────────
        [MaxLength(260)]
        public string? FileName { get; set; }
        [MaxLength(500)]
        public string? FilePath { get; set; }
        [MaxLength(100)]
        public string? MimeType { get; set; }
        public long? FileSizeBytes { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    }
}