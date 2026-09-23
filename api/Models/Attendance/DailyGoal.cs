using DailyTrackerAPI.Models.Auth;

namespace DailyTrackerAPI.Models.Attendance
{
    // ─── Feature 4: Daily Goals ───────────────────────────────────────────────
    public class DailyGoal
    {
        public int Id { get; set; }
        public int UserId { get; set; }
        public DateTime GoalDate { get; set; }
        public int TargetWorkMinutes { get; set; } = 480;  // 8 hours default
        public int TargetTasksCompleted { get; set; } = 5;
        public int TargetSupportGiven { get; set; } = 5;
        public int TargetBreakMinutes { get; set; } = 60;
        public double ProductivityScore { get; set; }       // 0–100
        public string? ManagerSetNote { get; set; }
        public virtual User User { get; set; } = null!;
    }
}
