using DailyTrackerAPI.Models.Tasks;
using Microsoft.EntityFrameworkCore;

namespace DailyTrackerAPI.Helpers
{
    public static class DailyLogQueries
    {
        /// <summary>
        /// The log someone is working in right now: today's (India date), or —
        /// for a shift that runs past midnight — yesterday's log that is checked
        /// in and not yet checked out.
        /// </summary>
        public static async Task<DailyLog?> CurrentForAsync(this IQueryable<DailyLog> logs, int userId)
        {
            var today = AppClock.TodayIst;
            var yesterday = today.AddDays(-1);
            var candidates = await logs
                .Where(d => d.UserId == userId
                    && (d.LogDate == today
                        || (d.LogDate == yesterday && d.CheckInTime != null && d.CheckOutTime == null)))
                .ToListAsync();
            return candidates.FirstOrDefault(d => d.LogDate == today) ?? candidates.FirstOrDefault();
        }
    }
}
