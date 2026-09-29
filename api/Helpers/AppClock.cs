namespace DailyTrackerAPI.Helpers
{
    /// <summary>
    /// "Today" for the team (India). The server runs in UTC, so between
    /// 00:00 and 05:30 IST its own date is still yesterday.
    /// </summary>
    public static class AppClock
    {
        private static readonly TimeZoneInfo Ist = TimeZoneInfo.FindSystemTimeZoneById(
            OperatingSystem.IsWindows() ? "India Standard Time" : "Asia/Kolkata");

        public static DateTime NowIst => TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, Ist);
        public static DateTime TodayIst => NowIst.Date;
    }
}
