using DailyTrackerAPI.Models.Auth;

namespace DailyTrackerAPI.Models.Performance
{
    // ─── Feature 11: Audit Log ────────────────────────────────────────────────
    public class AuditLog
    {
        public int Id { get; set; }
        public int? UserId { get; set; }
        public string Action { get; set; } = string.Empty;   // "CheckIn", "AddTask", etc.
        public string Entity { get; set; } = string.Empty;   // "DailyLog", "TaskLog"
        public int? EntityId { get; set; }
        public string? OldValues { get; set; }               // JSON snapshot before
        public string? NewValues { get; set; }               // JSON snapshot after
        public string? IpAddress { get; set; }
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public virtual User? User { get; set; }
    }
}
