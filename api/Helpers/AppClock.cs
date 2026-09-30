namespace DailyTrackerAPI.Helpers
{
    /// <summary>
    /// "Today" for the team (India). The server runs in UTC, so between
    /// 00:00 and 05:30 IST its own date is still yesterday.
    ///   Day-only fields (LogDate, ReportDate, GoalDate …) → TodayIst
    ///   Timestamps saved as UTC (CreatedAt, ScheduledAt …) → TodayStartUtc
    /// </summary>
    public static class AppClock
    {
        private static readonly TimeZoneInfo Ist = TimeZoneInfo.FindSystemTimeZoneById(
            OperatingSystem.IsWindows() ? "India Standard Time" : "Asia/Kolkata");

        public static DateTime NowIst => TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, Ist);
        public static DateTime TodayIst => NowIst.Date;

        /// <summary>A UTC moment as India time</summary>
        public static DateTime ToIst(DateTime utc) =>
            TimeZoneInfo.ConvertTimeFromUtc(DateTime.SpecifyKind(utc, DateTimeKind.Utc), Ist);

        /// <summary>A stored (UTC) time as India time — use before showing it as text: t.ToIstTime().ToString("hh:mm tt")</summary>
        public static DateTime ToIstTime(this DateTime utc) => ToIst(utc);

        /// <summary>
        /// A date-time sent by the app: with a zone ("…Z") it's already exact; without one it is
        /// what the person typed on an India clock
        /// </summary>
        public static DateTime FromClient(DateTime value) => value.Kind switch
        {
            DateTimeKind.Utc => value,
            DateTimeKind.Local => value.ToUniversalTime(),
            _ => FromIst(value),
        };

        /// <summary>An India wall-clock time (e.g. 30 Sep 07:00) as the UTC moment</summary>
        public static DateTime FromIst(DateTime ist) =>
            TimeZoneInfo.ConvertTimeToUtc(DateTime.SpecifyKind(ist, DateTimeKind.Unspecified), Ist);

        /// <summary>The moment today (India) began, in UTC — for comparing with UTC timestamps</summary>
        public static DateTime TodayStartUtc =>
            TimeZoneInfo.ConvertTimeToUtc(DateTime.SpecifyKind(TodayIst, DateTimeKind.Unspecified), Ist);
    }
}
