namespace DailyTrackerAPI.Models.Auth
{
    public class EmailOtp
    {
        public int Id { get; set; }
        public string Email { get; set; } = string.Empty;
        public string Code { get; set; } = string.Empty;
        public DateTime ExpiresAt { get; set; }
        public bool IsUsed { get; set; } = false;
        public string Purpose { get; set; } = string.Empty;
        // Register | Login | ForgotPassword
    }
}
