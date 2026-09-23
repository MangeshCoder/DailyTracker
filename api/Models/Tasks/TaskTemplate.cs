using DailyTrackerAPI.Models.Auth;

namespace DailyTrackerAPI.Models.Tasks
{
    // ─── Feature 3: Task Templates ───────────────────────────────────────────
    public class TaskTemplate
    {
        public int Id { get; set; }
        public int UserId { get; set; }
        public string Title { get; set; } = string.Empty;
        public string? Description { get; set; }
        public string? ProjectName { get; set; }
        public int DefaultTimeMinutes { get; set; } = 60;
        public string Priority { get; set; } = "Medium";
        public string? Tags { get; set; }
        public bool IsRecurring { get; set; }
        public string? RecurrenceDays { get; set; } // "Mon,Tue,Wed,Thu,Fri"
        public bool IsActive { get; set; } = true;
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public virtual User User { get; set; } = null!;
    }
}
