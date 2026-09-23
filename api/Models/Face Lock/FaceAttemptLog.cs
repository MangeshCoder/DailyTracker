using DailyTrackerAPI.Models.Auth;

namespace DailyTrackerAPI.Models.Face_Lock
{
    public class FaceAttemptLog
    {
        public int Id { get; set; }

        public int UserId { get; set; }
        public User User { get; set; } = null!;

        // "CheckIn" or "CheckOut"
        public string Action { get; set; } = "CheckIn";

        // true = face matched, false = face did not match
        public bool Success { get; set; }

        // Euclidean distance score returned by face-api.js (lower = better match)
        // 0.0 = perfect match, > 0.5 = likely mismatch
        public float Distance { get; set; }

        // "NoFaceDetected" | "Mismatch" | "NotRegistered" | "Matched"
        public string Result { get; set; } = string.Empty;

        public DateTime AttemptedAt { get; set; } = DateTime.UtcNow;
    }
}
