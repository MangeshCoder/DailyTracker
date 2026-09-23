using DailyTrackerAPI.Models.Auth;
using System.ComponentModel.DataAnnotations;

namespace DailyTrackerAPI.Models.Tasks
{
    public class SupportLog
    {
        public int Id { get; set; }

        public int DailyLogId { get; set; }
        public DailyLog DailyLog { get; set; } = null!;

        // ── Who gave the support (Feature 2) ─────────────────────────────────
        public int SupportEngineerId { get; set; }
        public User SupportEngineer { get; set; } = null!;

        // ── Who received the support ──────────────────────────────────────────
        public int SupportedDeveloperId { get; set; }
        public User SupportedDeveloper { get; set; } = null!;

        [Required, MaxLength(500)]
        public string IssueDescription { get; set; } = string.Empty;

        [MaxLength(500)]
        public string? Resolution { get; set; }

        public int TimeSpentMinutes { get; set; } = 0;

        public string SupportType { get; set; } = "Technical";

        public DateTime SupportedAt { get; set; } = DateTime.UtcNow;

        // ── Linked assignment (Feature 3 — nullable, set when created under assignment) ──
        public int? SupportAssignmentId { get; set; }
        public SupportAssignment? SupportAssignment { get; set; }

        // ── Location (existing) ───────────────────────────────────────────────
        public double? Latitude { get; set; }
        public double? Longitude { get; set; }
        public double? DistanceFromOfficeMetres { get; set; }

        public ICollection<MediaEvidence> MediaEvidences { get; set; } = new List<MediaEvidence>();
    }
}
