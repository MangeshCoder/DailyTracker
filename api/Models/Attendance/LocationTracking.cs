using DailyTrackerAPI.Models.Auth;
using DailyTrackerAPI.Models.Tasks;
using System.ComponentModel.DataAnnotations;

namespace DailyTrackerAPI.Models.Attendance
{
    // ═══════════════════════════════════════════════════════════════════════════
    // LOCATION TRACKING MODELS (Away-From-Office feature)
    // Strictly opt-in — no GeofenceEvent is ever accepted for a user without an
    // active (non-revoked) LocationConsent record. See LocationConsentController.
    // ═══════════════════════════════════════════════════════════════════════════

    public class LocationConsent
    {
        public int Id { get; set; }
        public int UserId { get; set; }
        public virtual User User { get; set; } = null!;
        public DateTime ConsentedAt { get; set; } = DateTime.UtcNow;

        [Required, MaxLength(20)]
        public string PolicyVersion { get; set; } = string.Empty;
        public bool Revoked { get; set; } = false;
        public DateTime? RevokedAt { get; set; }
    }

    public class GeofenceEvent
    {
        public int Id { get; set; }
        public int UserId { get; set; }
        public virtual User User { get; set; } = null!;

        [Required, MaxLength(10)]
        public string EventType { get; set; } = string.Empty; // "Enter" | "Exit"
        public double Latitude { get; set; }
        public double Longitude { get; set; }
        public DateTime OccurredAt { get; set; }              // device-reported time
        public DateTime ReceivedAt { get; set; } = DateTime.UtcNow;
        [Required, MaxLength(64)]
        public string ClientEventId { get; set; } = string.Empty; // dedupe key for retried syncs
    }

    public class AwayLog
    {
        public int Id { get; set; }
        public int UserId { get; set; }
        public virtual User User { get; set; } = null!;
        public int? DailyLogId { get; set; }
        public virtual DailyLog? DailyLog { get; set; }
        public DateTime StartedAt { get; set; }
        public DateTime? EndedAt { get; set; }
        public int? DurationMinutes { get; set; }
    }
}
