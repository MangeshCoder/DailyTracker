namespace DailyTrackerAPI.Models.Tasks
{
    // ─── Feature 3: Task Active Timer ────────────────────────────────────────
    public class TaskTimer
    {
        public int Id { get; set; }
        public int TaskLogId { get; set; }
        public DateTime StartedAt { get; set; }
        public DateTime? StoppedAt { get; set; }
        public int DurationMinutes { get; set; }
        public bool IsRunning { get; set; } = true;
        public virtual TaskLog TaskLog { get; set; } = null!;
    }
}
