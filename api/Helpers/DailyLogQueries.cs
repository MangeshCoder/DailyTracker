using DailyTrackerAPI.Models.Tasks;
using Microsoft.EntityFrameworkCore;

namespace DailyTrackerAPI.Helpers
{
    public static class DailyLogQueries
    {
        /// <summary>
        /// India hour (next morning) until which a shift that started the day before
        /// may still be running; after it, a shift nobody checked out of is closed.
        /// </summary>
        public const int ShiftCutoffHour = 5;

        /// <summary>Can a shift that started yesterday still be running at this India time?</summary>
        public static bool YesterdaysShiftMayRun(DateTime nowIst) => nowIst.Hour < ShiftCutoffHour;

        /// <summary>The latest day whose forgotten shifts may be closed at this India time</summary>
        public static DateTime LastClosableDay(DateTime nowIst) =>
            nowIst.Date.AddDays(YesterdaysShiftMayRun(nowIst) ? -2 : -1);

        /// <summary>
        /// The log someone is working in right now: today's (India date), or —
        /// for a shift that runs past midnight — yesterday's log that is checked
        /// in and not yet checked out.
        /// </summary>
        public static async Task<DailyLog?> CurrentForAsync(this IQueryable<DailyLog> logs, int userId)
        {
            var today = AppClock.TodayIst;
            var yesterday = today.AddDays(-1);
            // after the overnight cut-off a still-open shift from yesterday is a forgotten
            // check-out (closed automatically) — the morning always starts a new day
            var nightShiftStillRunning = YesterdaysShiftMayRun(AppClock.NowIst);
            var candidates = await logs
                .Where(d => d.UserId == userId
                    && (d.LogDate == today
                        || (nightShiftStillRunning && d.LogDate == yesterday && d.CheckInTime != null && d.CheckOutTime == null)))
                .ToListAsync();
            return candidates.FirstOrDefault(d => d.LogDate == today) ?? candidates.FirstOrDefault();
        }
    }
}
