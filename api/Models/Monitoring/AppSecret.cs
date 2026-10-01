namespace DailyTrackerAPI.Models.Monitoring
{
    /// <summary>
    /// Server-made secrets that must stay the same across restarts, e.g. the push
    /// notification (VAPID) key pair — created on first use so nothing has to be set
    /// up by hand. A value set in configuration always wins over the stored one.
    /// </summary>
    public class AppSecret
    {
        public string Key { get; set; } = string.Empty;
        public string Value { get; set; } = string.Empty;
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}
