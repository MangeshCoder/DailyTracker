using System.Text.RegularExpressions;
using DailyTrackerAPI.Data;
using DailyTrackerAPI.Helpers;
using DailyTrackerAPI.Models.Monitoring;

namespace DailyTrackerAPI.Services.Monitoring
{
    /// <summary>
    /// Saves server errors and slow requests for the managers' System page.
    /// Never throws: if the database itself is the problem, it only logs.
    /// </summary>
    public class ErrorLogWriter
    {
        public const int SlowRequestMs = 2000;
        private const int MaxSlowPerMinute = 30;      // a slow database shouldn't flood the table

        private readonly IServiceScopeFactory _scopes;
        private readonly ILogger<ErrorLogWriter> _logger;
        private readonly object _gate = new();
        private DateTime _slowWindow = DateTime.MinValue;
        private int _slowInWindow;

        public ErrorLogWriter(IServiceScopeFactory scopes, ILogger<ErrorLogWriter> logger)
        {
            _scopes = scopes;
            _logger = logger;
        }

        /// <summary>Called after every request (see Program.cs)</summary>
        public async Task RecordAsync(HttpContext context, long elapsedMs, Exception? error)
        {
            var status = context.Response.StatusCode;
            string kind;
            if (status >= 500) kind = "Error";
            else if (elapsedMs >= SlowRequestMs && IsTimedPath(context.Request.Path) && TakeSlowSlot()) kind = "Slow";
            else return;

            var entry = new AppErrorLog
            {
                OccurredAt = DateTime.UtcNow,
                Kind = kind,
                Method = context.Request.Method,
                Path = Truncate(context.Request.Path + HideSecrets(context.Request.QueryString.Value), 500),
                StatusCode = status,
                DurationMs = (int)Math.Min(elapsedMs, int.MaxValue),
                UserId = context.User.GetUserId() is > 0 and var id ? id : null,
                Message = Truncate(kind == "Slow"
                    ? $"Took {elapsedMs / 1000.0:0.0} s"
                    : error?.Message ?? $"HTTP {status}", 1000),
                Details = error == null ? null : Truncate(error.ToString(), 8000),
                TraceId = context.TraceIdentifier,
            };

            try
            {
                using var scope = _scopes.CreateScope();
                var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
                db.AppErrorLogs.Add(entry);
                await db.SaveChangesAsync();
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Could not save the error log entry for {Method} {Path}", entry.Method, entry.Path);
            }
        }

        /// <summary>Only API calls; chat/notification hubs and file transfers are long by nature</summary>
        private static bool IsTimedPath(PathString path) =>
            path.StartsWithSegments("/api")
            && !path.Value!.Contains("/upload", StringComparison.OrdinalIgnoreCase)
            && !path.Value!.Contains("/download", StringComparison.OrdinalIgnoreCase)
            && !path.StartsWithSegments("/api/monitoring/backups")
            && !path.StartsWithSegments("/api/monitoring/restore");

        private bool TakeSlowSlot()
        {
            lock (_gate)
            {
                var now = DateTime.UtcNow;
                if (now - _slowWindow > TimeSpan.FromMinutes(1)) { _slowWindow = now; _slowInWindow = 0; }
                return ++_slowInWindow <= MaxSlowPerMinute;
            }
        }

        private static readonly Regex SecretParam = new(
            @"(?<=[?&](?:[^=&]*(?:token|password|code|otp|key|secret)[^=&]*)=)[^&]*",
            RegexOptions.IgnoreCase | RegexOptions.Compiled);

        /// <summary>?access_token=abc&amp;page=2 → ?access_token=***&amp;page=2</summary>
        public static string HideSecrets(string? query) =>
            string.IsNullOrEmpty(query) ? "" : SecretParam.Replace(query, "***");

        private static string Truncate(string s, int max) => s.Length <= max ? s : s[..max];
    }
}
