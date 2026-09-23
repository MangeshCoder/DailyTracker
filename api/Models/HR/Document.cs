// ─────────────────────────────────────────────────────────────────────────────
//  FILE 1:  backend/Models/Document.cs
//  ACTION:  CREATE as a new file
// ─────────────────────────────────────────────────────────────────────────────
//
//  Document Management covers two scenarios:
//
//  A) HR uploads a document FOR an employee  (offer letter, contract, payslip archive)
//     → UploadedByUserId = HR/Manager,  OwnerUserId = employee
//
//  B) Employee uploads their own document  (ID proof, certificate, form submission)
//     → UploadedByUserId = employee,    OwnerUserId = employee
//
//  Visibility:
//    - Employee can only see documents where OwnerUserId == their Id
//    - Manager/TeamLead can see all documents
//
//  Physical storage: wwwroot/uploads/documents/{documentId}/{filename}
//  (Same pattern as support media)
// ─────────────────────────────────────────────────────────────────────────────

using DailyTrackerAPI.Models.Auth;
using System.ComponentModel.DataAnnotations;

namespace DailyTrackerAPI.Models.HR
{
    public class Document
    {
        public int Id { get; set; }

        // ── Who owns this document (the employee it belongs to) ───────────────
        public int OwnerUserId { get; set; }
        public virtual User OwnerUser { get; set; } = null!;

        // ── Who uploaded it (could be HR, manager, or the employee themselves) ─
        public int UploadedByUserId { get; set; }
        public virtual User UploadedBy { get; set; } = null!;

        // ── Document metadata ─────────────────────────────────────────────────
        [Required, MaxLength(200)]
        public string Title { get; set; } = string.Empty;

        [MaxLength(1000)]
        public string? Description { get; set; }

        /// <summary>
        /// Category for grouping in UI.
        /// OfferLetter | Contract | Payslip | IDProof | Certificate |
        /// Policy | Appraisal | Warning | Other
        /// </summary>
        [MaxLength(50)]
        public string Category { get; set; } = "Other";

        // ── File info ─────────────────────────────────────────────────────────
        [Required, MaxLength(260)]
        public string FileName { get; set; } = string.Empty;       // original file name

        [Required, MaxLength(500)]
        public string FilePath { get; set; } = string.Empty;       // relative: uploads/documents/...

        [MaxLength(100)]
        public string MimeType { get; set; } = string.Empty;

        public long FileSizeBytes { get; set; }

        // ── Access control ────────────────────────────────────────────────────
        /// <summary>
        /// If false, only the owner + managers can see it.
        /// If true, all authenticated users can see it (e.g. Company Policies).
        /// </summary>
        public bool IsPublic { get; set; } = false;

        // ── Timestamps ────────────────────────────────────────────────────────
        public DateTime UploadedAt { get; set; } = DateTime.UtcNow;
        public DateTime? ExpiresAt { get; set; }  // optional expiry (e.g. ID proof)
    }
}
