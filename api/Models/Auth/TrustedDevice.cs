namespace DailyTrackerAPI.Models.Auth
{
    // Trusted device — skip 2FA for 30 days
    public class TrustedDevice
    {
        public int Id { get; set; }
        public int UserId { get; set; }
        public User User { get; set; } = null!;

        public string DeviceToken { get; set; } = "";        // UUID stored in cookie
        public string DeviceName { get; set; } = "";         // Browser + OS
        public string IpAddress { get; set; } = "";
        public DateTime TrustedAt { get; set; } = DateTime.UtcNow;
        public DateTime ExpiresAt { get; set; }
        public bool IsRevoked { get; set; } = false;
    }
}
