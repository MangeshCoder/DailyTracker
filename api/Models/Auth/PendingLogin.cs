namespace DailyTrackerAPI.Models.Auth
{
    /// <summary>
    /// Temporary session for users who have validated email/password but need to complete 2FA.
    /// Holds pending login state until TOTP code is verified. Expires in 5 minutes.
    /// </summary>
    public class PendingLogin
    {
        public int Id { get; set; }
        public int UserId { get; set; }
        public User User { get; set; } = null!;

        public string TempToken { get; set; } = string.Empty;  // Unique token sent to client
        public string? IpAddress { get; set; }
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime ExpiresAt { get; set; }  // Typically 5 minutes
        public bool IsUsed { get; set; } = false;
    }
}
