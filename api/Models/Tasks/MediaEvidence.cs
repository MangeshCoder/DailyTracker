using DailyTrackerAPI.Models.Auth;

namespace DailyTrackerAPI.Models.Tasks
{
    // ─────────────────────────────────────────────────────────────────────────────
    // Support Log Media Evidence: screenshots, screen recordings as proof
    // ─────────────────────────────────────────────────────────────────────────────

    public class MediaEvidence
    {
        public int Id { get; set; }
        public int UserId { get; set; }
        public User User { get; set; } = null!;

        public string MediaType { get; set; } = "Screenshot"; // Screenshot | Recording | File
        public string FileName { get; set; } = "";
        public string FilePath { get; set; } = "";            // Relative path: uploads/support/...
        public string? ThumbnailPath { get; set; }
        public long FileSizeBytes { get; set; }
        public string MimeType { get; set; } = "";

        public int? SupportLogId { get; set; }
        public SupportLog? SupportLog { get; set; }

        public DateTime UploadedAt { get; set; } = DateTime.UtcNow;
    }
}
