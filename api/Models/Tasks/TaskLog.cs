using System.ComponentModel.DataAnnotations;

namespace DailyTrackerAPI.Models.Tasks
{
    public class TaskLog
    {
        public int Id { get; set; }

        public int DailyLogId { get; set; }
        public DailyLog DailyLog { get; set; } = null!;

        [Required, MaxLength(200)]
        public string TaskTitle { get; set; } = string.Empty;

        [MaxLength(1000)]
        public string? Description { get; set; }

        [MaxLength(100)]
        public string? ProjectName { get; set; }

        public string Status { get; set; } = "InProgress"; // InProgress, Completed, Blocked, OnHold

        public int TimeSpentMinutes { get; set; } = 0;

        public string Priority { get; set; } = "Medium"; // Low, Medium, High

        public string? Tags { get; set; } // comma-separated

        public DateTime? CompletedAt { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}
