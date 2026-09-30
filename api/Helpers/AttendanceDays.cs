using DailyTrackerAPI.Models.Auth;

namespace DailyTrackerAPI.Helpers
{
    /// <summary>
    /// Which days someone can be "absent" on: working days (Mon–Fri, not a public holiday)
    /// from the day they joined up to yesterday — today isn't over yet, so it only counts
    /// once they have checked in. Used by every attendance summary so they all agree.
    /// </summary>
    public static class AttendanceDays
    {
        private static readonly TimeZoneInfo Ist = TimeZoneInfo.FindSystemTimeZoneById(
            OperatingSystem.IsWindows() ? "India Standard Time" : "Asia/Kolkata");

        /// <summary>The India date the person started (join date if set, else when the account was made)</summary>
        public static DateTime JoinedOn(User user)
        {
            var utc = user.JoinDate ?? user.CreatedAt;
            if (utc.Kind == DateTimeKind.Local) utc = utc.ToUniversalTime();
            return TimeZoneInfo.ConvertTimeFromUtc(DateTime.SpecifyKind(utc, DateTimeKind.Utc), Ist).Date;
        }

        /// <summary>Last day that can count as absent: yesterday, or today once there's a log for it</summary>
        public static DateTime LastCountable(bool loggedToday) =>
            loggedToday ? AppClock.TodayIst : AppClock.TodayIst.AddDays(-1);

        public static bool IsWorkingDay(DateTime day, ISet<DateTime> publicHolidays) =>
            day.DayOfWeek is not DayOfWeek.Saturday and not DayOfWeek.Sunday && !publicHolidays.Contains(day.Date);

        /// <summary>Working days in [from, to] (inclusive) — 0 when from is after to</summary>
        public static int WorkingDays(DateTime from, DateTime to, ISet<DateTime> publicHolidays)
        {
            int n = 0;
            for (var d = from.Date; d <= to.Date; d = d.AddDays(1))
                if (IsWorkingDay(d, publicHolidays)) n++;
            return n;
        }

        /// <summary>The part of [from, to] this person could have been absent in (may be empty: From &gt; To)</summary>
        public static (DateTime From, DateTime To) CountableRange(User user, DateTime from, DateTime to, bool loggedToday)
        {
            var joined = JoinedOn(user);
            var last = LastCountable(loggedToday);
            return (joined > from.Date ? joined : from.Date, last < to.Date ? last : to.Date);
        }
    }
}
