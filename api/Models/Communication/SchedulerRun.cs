namespace DailyTrackerAPI.Models.Communication
{
    // ─── Daily reminder jobs that already ran ────────────────────────────────
    // One row per job per day (IST). The scheduler checks this before sending,
    // so a restart (every deploy on the hosted server) never sends a reminder twice.
    public class SchedulerRun
    {
        public int Id { get; set; }
        public string JobKey { get; set; } = string.Empty;   // GOAL_REMINDER, EOD_REMINDER …
        public DateOnly RunDate { get; set; }                // the IST day it ran for
        public DateTime RanAt { get; set; } = DateTime.UtcNow;
    }
}
