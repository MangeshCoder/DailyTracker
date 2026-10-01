using DailyTrackerAPI.Models.Auth;

namespace DailyTrackerAPI.Models.Communication
{
    /// <summary>
    /// One phone / browser that asked for push notifications (Web Push). The browser
    /// gives us an endpoint URL on its push service plus two keys to encrypt with.
    /// A person can have several (phone + laptop); a dead endpoint is removed when the
    /// push service answers 404 / 410.
    /// </summary>
    public class PushSubscription
    {
        public int Id { get; set; }
        public int UserId { get; set; }
        public string Endpoint { get; set; } = string.Empty;
        public string P256dh { get; set; } = string.Empty;   // browser's public key (base64url)
        public string Auth { get; set; } = string.Empty;     // browser's auth secret (base64url)
        public string? Device { get; set; }                   // e.g. "Android · Chrome", shown in settings
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime? LastSentAt { get; set; }

        public virtual User User { get; set; } = null!;
    }
}
