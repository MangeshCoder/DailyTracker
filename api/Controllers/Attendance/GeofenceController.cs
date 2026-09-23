using DailyTrackerAPI.Data;
using DailyTrackerAPI.DTOs;
using DailyTrackerAPI.Helpers;
using DailyTrackerAPI.Models.Attendance;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace DailyTrackerAPI.Controllers.Attendance
{
    // ── Endpoints ──────────────────────────────────────────────────────────────
    // POST /api/geofence/events — batch-ingest Enter/Exit geofence events.
    // Requires an active LocationConsent for the caller; otherwise rejected.

    [ApiController, Route("api/geofence"), Authorize]
    public class GeofenceController : ControllerBase
    {
        private static readonly string[] ValidEventTypes = { "Enter", "Exit" };

        private readonly AppDbContext _db;

        public GeofenceController(AppDbContext db) => _db = db;

        [HttpPost("events")]
        public async Task<IActionResult> IngestEvents([FromBody] GeofenceEventBatchDto dto)
        {
            var userId = User.GetUserId();

            var hasConsent = await _db.LocationConsents
                .AnyAsync(c => c.UserId == userId && !c.Revoked);

            if (!hasConsent)
                return Forbid();

            if (dto.Events == null || dto.Events.Count == 0)
                return Ok(new GeofenceEventBatchResultDto());

            // De-dupe against already-ingested events (idempotent on retried syncs)
            var incomingIds = dto.Events.Select(e => e.ClientEventId).ToList();
            var alreadySeen = (await _db.GeofenceEvents
                .Where(g => incomingIds.Contains(g.ClientEventId))
                .Select(g => g.ClientEventId)
                .ToListAsync())
                .ToHashSet();

            // Currently-open away period for this user, if any
            var openAway = await _db.AwayLogs
                .Where(a => a.UserId == userId && a.EndedAt == null)
                .OrderByDescending(a => a.StartedAt)
                .FirstOrDefaultAsync();

            int processed = 0, skipped = 0, rejected = 0;

            // Chronological order — a batch can hold several buffered events
            // synced together after being offline.
            foreach (var ev in dto.Events.OrderBy(e => e.OccurredAt))
            {
                if (alreadySeen.Contains(ev.ClientEventId)) { skipped++; continue; }
                if (!ValidEventTypes.Contains(ev.EventType)) { rejected++; continue; }

                _db.GeofenceEvents.Add(new GeofenceEvent
                {
                    UserId = userId,
                    EventType = ev.EventType,
                    Latitude = ev.Latitude,
                    Longitude = ev.Longitude,
                    OccurredAt = ev.OccurredAt,
                    ClientEventId = ev.ClientEventId
                });

                if (ev.EventType == "Exit" && openAway == null)
                {
                    var dailyLog = await _db.DailyLogs
                        .FirstOrDefaultAsync(l => l.UserId == userId && l.LogDate == ev.OccurredAt.Date);

                    openAway = new AwayLog
                    {
                        UserId = userId,
                        DailyLogId = dailyLog?.Id,
                        StartedAt = ev.OccurredAt
                    };
                    _db.AwayLogs.Add(openAway);
                }
                else if (ev.EventType == "Enter" && openAway != null)
                {
                    openAway.EndedAt = ev.OccurredAt;
                    openAway.DurationMinutes = (int)(openAway.EndedAt.Value - openAway.StartedAt).TotalMinutes;
                    openAway = null;
                }
                // Exit while already away, or Enter with nothing open — already
                // consistent, ignore rather than error.

                alreadySeen.Add(ev.ClientEventId);
                processed++;
            }

            await _db.SaveChangesAsync();

            return Ok(new GeofenceEventBatchResultDto
            {
                Processed = processed,
                Skipped = skipped,
                Rejected = rejected
            });
        }
    }
}