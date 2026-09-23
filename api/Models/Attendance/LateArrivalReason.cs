using DailyTrackerAPI.Models.Auth;
using DailyTrackerAPI.Models.Tasks;

namespace DailyTrackerAPI.Models.Attendance
{
    // ─── Feature 10: Late Arrival Reason ──────────────────────────────────────
    public class LateArrivalReason
    {
        public int Id { get; set; }
        public int DailyLogId { get; set; }
        public int UserId { get; set; }
        public string Reason { get; set; } = string.Empty;
        public DateTime CheckInTime { get; set; }
        public int LateByMinutes { get; set; }
        public virtual DailyLog DailyLog { get; set; } = null!;
        public virtual User User { get; set; } = null!;
    }
}
