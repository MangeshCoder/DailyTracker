namespace DailyTrackerAPI.Models.Monitoring
{
    // ─── A copy of the whole database, saved to file storage ─────────────────
    // Weekly automatically (and on demand); the newest 8 are kept.
    public class DatabaseBackup
    {
        public int Id { get; set; }
        public DateTime StartedAt { get; set; } = DateTime.UtcNow;
        public DateTime? FinishedAt { get; set; }
        public string Trigger { get; set; } = "Weekly";       // Weekly | Manual
        public string Status { get; set; } = "Running";       // Running | Succeeded | Failed
        public string? FileKey { get; set; }                  // backups/db-2026-10-04-0930.json.gz
        public long SizeBytes { get; set; }
        public int TableCount { get; set; }
        public long RowCount { get; set; }
        public string? Error { get; set; }
        public int? RequestedByUserId { get; set; }
    }
}
