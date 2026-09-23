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
    // POST   /api/consent/location-tracking          — grant consent
    // DELETE /api/consent/location-tracking          — revoke consent
    // GET    /api/consent/location-tracking/status   — check current consent state

    [ApiController, Route("api/consent/location-tracking"), Authorize]
    public class LocationConsentController : ControllerBase
    {
        private readonly AppDbContext _db;

        public LocationConsentController(AppDbContext db) => _db = db;

        [HttpPost]
        public async Task<IActionResult> GrantConsent([FromBody] GrantConsentDto dto)
        {
            var userId = User.GetUserId();

            // Keep an audit trail: close out any prior active consent rather
            // than overwriting it, so history of grants/revokes is preserved.
            var existing = await _db.LocationConsents
                .Where(c => c.UserId == userId && !c.Revoked)
                .ToListAsync();

            foreach (var c in existing)
            {
                c.Revoked = true;
                c.RevokedAt = DateTime.UtcNow;
            }

            var consent = new LocationConsent
            {
                UserId = userId,
                PolicyVersion = dto.PolicyVersion,
                ConsentedAt = DateTime.UtcNow
            };

            _db.LocationConsents.Add(consent);
            await _db.SaveChangesAsync();

            return Ok(new { message = "Consent recorded.", consentedAt = consent.ConsentedAt });
        }

        [HttpDelete]
        public async Task<IActionResult> RevokeConsent()
        {
            var userId = User.GetUserId();

            var active = await _db.LocationConsents
                .Where(c => c.UserId == userId && !c.Revoked)
                .ToListAsync();

            if (active.Count == 0)
                return BadRequest(new { message = "No active consent to revoke." });

            foreach (var c in active)
            {
                c.Revoked = true;
                c.RevokedAt = DateTime.UtcNow;
            }

            await _db.SaveChangesAsync();

            return Ok(new { message = "Consent revoked. Location tracking has been disabled." });
        }

        [HttpGet("status")]
        public async Task<IActionResult> GetStatus()
        {
            var userId = User.GetUserId();

            var active = await _db.LocationConsents
                .Where(c => c.UserId == userId && !c.Revoked)
                .OrderByDescending(c => c.ConsentedAt)
                .FirstOrDefaultAsync();

            return Ok(new ConsentStatusDto
            {
                HasActiveConsent = active != null,
                ConsentedAt = active?.ConsentedAt,
                PolicyVersion = active?.PolicyVersion
            });
        }
    }
}