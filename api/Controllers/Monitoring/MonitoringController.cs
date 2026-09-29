using DailyTrackerAPI.Data;
using DailyTrackerAPI.Helpers;
using DailyTrackerAPI.Services.Monitoring;
using DailyTrackerAPI.Services.Storage;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace DailyTrackerAPI.Controllers.Monitoring
{
    // ─────────────────────────────────────────────────────────────────────────
    //  Managers' System page
    //    GET    /api/monitoring/summary                 → counts for the cards
    //    GET    /api/monitoring/errors?kind=&before=     → error log, newest first
    //    DELETE /api/monitoring/errors                  → clear the log
    //    GET    /api/monitoring/backups                 → backup list
    //    POST   /api/monitoring/backups                 → back up now
    //    GET    /api/monitoring/backups/{id}/download   → the .json.gz file
    //    POST   /api/monitoring/backups/{id}/restore    → put a backup back   { confirm: "RESTORE" }
    //    POST   /api/monitoring/restore                 → same, from an uploaded file (form: file, confirm)
    // ─────────────────────────────────────────────────────────────────────────
    [ApiController, Route("api/monitoring"), Authorize(Roles = "Manager,Admin")]
    public class MonitoringController : ControllerBase
    {
        private const int PageSize = 50;
        private readonly AppDbContext _db;

        public MonitoringController(AppDbContext db) => _db = db;

        [HttpGet("summary")]
        public async Task<IActionResult> Summary()
        {
            var since = DateTime.UtcNow.AddHours(-24);
            var counts = await _db.AppErrorLogs
                .Where(e => e.OccurredAt >= since)
                .GroupBy(e => e.Kind)
                .Select(g => new { kind = g.Key, count = g.Count() })
                .ToListAsync();
            var lastBackup = await _db.DatabaseBackups
                .Where(b => b.Status == "Succeeded")
                .OrderByDescending(b => b.StartedAt)
                .Select(b => new { b.Id, b.StartedAt, b.SizeBytes, b.RowCount })
                .FirstOrDefaultAsync();
            return Ok(new
            {
                errors24h = counts.FirstOrDefault(c => c.kind == "Error")?.count ?? 0,
                slow24h = counts.FirstOrDefault(c => c.kind == "Slow")?.count ?? 0,
                lastErrorAt = await _db.AppErrorLogs.Where(e => e.Kind == "Error")
                    .OrderByDescending(e => e.OccurredAt).Select(e => (DateTime?)e.OccurredAt).FirstOrDefaultAsync(),
                lastBackup,
                nextBackupDue = lastBackup == null ? (DateTime?)null : lastBackup.StartedAt + BackupService.Interval,
            });
        }

        [HttpGet("errors")]
        public async Task<IActionResult> Errors([FromQuery] string? kind, [FromQuery] long? before)
        {
            var query = _db.AppErrorLogs.AsQueryable();
            if (kind is "Error" or "Slow") query = query.Where(e => e.Kind == kind);
            if (before.HasValue) query = query.Where(e => e.Id < before.Value);

            var items = await query
                .OrderByDescending(e => e.Id)
                .Take(PageSize + 1)
                .Select(e => new
                {
                    e.Id, e.OccurredAt, e.Kind, e.Method, e.Path, e.StatusCode, e.DurationMs,
                    e.UserId,
                    userName = _db.Users.Where(u => u.Id == e.UserId).Select(u => u.FullName).FirstOrDefault(),
                    e.Message, e.Details, e.TraceId,
                })
                .ToListAsync();
            return Ok(new { items = items.Take(PageSize), hasMore = items.Count > PageSize });
        }

        [HttpDelete("errors")]
        public async Task<IActionResult> ClearErrors()
        {
            var removed = await _db.AppErrorLogs.ExecuteDeleteAsync();
            return Ok(new { removed });
        }

        [HttpGet("backups")]
        public async Task<IActionResult> Backups() =>
            Ok(await _db.DatabaseBackups
                .OrderByDescending(b => b.StartedAt)
                .Select(b => new
                {
                    b.Id, b.StartedAt, b.FinishedAt, b.Trigger, b.Status, b.SizeBytes, b.TableCount, b.RowCount, b.Error,
                    requestedBy = _db.Users.Where(u => u.Id == b.RequestedByUserId).Select(u => u.FullName).FirstOrDefault(),
                    canDownload = b.Status == "Succeeded" && b.FileKey != null,
                })
                .ToListAsync());

        [HttpPost("backups")]
        public async Task<IActionResult> BackupNow([FromServices] IBackupService backups)
        {
            var backup = await backups.RunAsync("Manual", User.GetUserId(), HttpContext.RequestAborted);
            if (backup.Status != "Succeeded")
                return StatusCode(500, new { message = $"Backup failed: {backup.Error}" });
            return Ok(new { backup.Id, backup.SizeBytes, backup.TableCount, backup.RowCount });
        }

        [HttpGet("backups/{id:int}/download")]
        public async Task<IActionResult> Download(int id, [FromServices] IFileStorage files)
        {
            var backup = await _db.DatabaseBackups.FirstOrDefaultAsync(b => b.Id == id && b.Status == "Succeeded");
            if (backup?.FileKey == null) return NotFound(new { message = "Backup not found." });
            return await this.StoredFileAsync(files, backup.FileKey, "application/gzip", Path.GetFileName(backup.FileKey));
        }

        // ── Restore: replaces ALL current data (a safety backup is taken first) ──
        public const string ConfirmWord = "RESTORE";

        public class RestoreRequest { public string? Confirm { get; set; } }

        [HttpPost("backups/{id:int}/restore")]
        public async Task<IActionResult> Restore(int id, [FromBody] RestoreRequest body, [FromServices] IRestoreService restore)
        {
            if (!string.Equals(body.Confirm?.Trim(), ConfirmWord, StringComparison.Ordinal))
                return BadRequest(new { message = $"Type {ConfirmWord} to confirm." });
            return Ok(Result(await restore.RestoreStoredAsync(id, User.GetUserId(), HttpContext.RequestAborted)));
        }

        [HttpPost("restore"), RequestSizeLimit(100 * 1024 * 1024)]
        public async Task<IActionResult> RestoreUpload(IFormFile? file, [FromForm] string? confirm, [FromServices] IRestoreService restore)
        {
            if (!string.Equals(confirm?.Trim(), ConfirmWord, StringComparison.Ordinal))
                return BadRequest(new { message = $"Type {ConfirmWord} to confirm." });
            if (file == null || file.Length == 0)
                return BadRequest(new { message = "Choose the backup file (.json.gz) to restore." });
            await using var stream = file.OpenReadStream();
            return Ok(Result(await restore.RestoreFileAsync(stream, User.GetUserId(), HttpContext.RequestAborted)));
        }

        private static object Result(RestoreResult r) => new
        {
            message = "Restore complete.",
            tables = r.Tables,
            rows = r.Rows,
            safetyBackupId = r.SafetyBackupId,
            backupCreatedAt = r.BackupCreatedAtUtc,
        };
    }
}
