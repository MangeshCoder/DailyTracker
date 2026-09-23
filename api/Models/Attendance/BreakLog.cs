using DailyTrackerAPI.Models.Tasks;

namespace DailyTrackerAPI.Models.Attendance
{
    public class BreakLog
    {
        public int Id { get; set; }

        public int DailyLogId { get; set; }
        public DailyLog DailyLog { get; set; } = null!;

        public string BreakType { get; set; } = "Tea"; // Lunch, Tea, Other

        public DateTime StartTime { get; set; }

        public DateTime? EndTime { get; set; }

        public int DurationMinutes { get; set; } = 0;

        public bool IsActive { get; set; } = true;
    }
}
