using DailyTrackerAPI.Models.Auth;
using System.ComponentModel.DataAnnotations;

namespace DailyTrackerAPI.Models.Tasks
{
    public class SupportAssignment
    {
        public int Id { get; set; }

        // ── The engineer being assigned ───────────────────────────────────────
        public int SupportEngineerId { get; set; }
        public User SupportEngineer { get; set; } = null!;

        // ── The developer being assigned to ──────────────────────────────────
        public int DeveloperId { get; set; }
        public User Developer { get; set; } = null!;

        // ── Who created this assignment ───────────────────────────────────────
        public int AssignedByManagerId { get; set; }
        public User AssignedByManager { get; set; } = null!;

        // ── Status ────────────────────────────────────────────────────────────
        public bool IsActive { get; set; } = true;

        [MaxLength(500)]
        public string? Notes { get; set; }

        public DateTime AssignedAt { get; set; } = DateTime.UtcNow;
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

        // ── Support logs created under this assignment ────────────────────────
        public ICollection<SupportLog> SupportLogs { get; set; } = new List<SupportLog>();
    }
}
