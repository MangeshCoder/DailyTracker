namespace DailyTrackerAPI.Models.Auth
{
    // ─────────────────────────────────────────────────────────────────────────────
    // FEATURE 3: Two-Factor Authentication (2FA)
    // ─────────────────────────────────────────────────────────────────────────────

    public class UserTwoFactor
    {
        public int Id { get; set; }
        public int UserId { get; set; }
        public User User { get; set; } = null!;

        // TOTP (Google Authenticator)
        public bool TotpEnabled { get; set; } = false;
        public string? TotpSecretKey { get; set; }           // Encrypted base32 secret
        public string? TotpBackupCodes { get; set; }         // JSON array of hashed backup codes

        // Email OTP
        public bool EmailOtpEnabled { get; set; } = false;

        // Active OTP session (email code)
        public string? PendingOtpCode { get; set; }          // Hashed OTP
        public DateTime? OtpExpiresAt { get; set; }
        public int OtpAttempts { get; set; } = 0;
        public string? OtpPurpose { get; set; }              // Login | Register | Disable2FA

        public DateTime? LastVerifiedAt { get; set; }
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    }
}
