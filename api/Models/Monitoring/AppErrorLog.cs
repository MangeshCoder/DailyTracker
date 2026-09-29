namespace DailyTrackerAPI.Models.Monitoring
{
    // ─── Server errors and slow requests, for the managers' System page ──────
    // Written by the request monitor in Program.cs; older than 30 days is removed.
    public class AppErrorLog
    {
        public long Id { get; set; }
        public DateTime OccurredAt { get; set; } = DateTime.UtcNow;
        public string Kind { get; set; } = "Error";          // Error | Slow
        public string Method { get; set; } = string.Empty;
        public string Path { get; set; } = string.Empty;     // query values of tokens/codes are hidden
        public int StatusCode { get; set; }
        public int DurationMs { get; set; }
        public int? UserId { get; set; }                     // who hit it (null = not signed in)
        public string Message { get; set; } = string.Empty;
        public string? Details { get; set; }                 // exception type + stack trace
        public string? TraceId { get; set; }
    }
}
