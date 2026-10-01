using DailyTrackerAPI.Data;
using DailyTrackerAPI.Helpers;
using DailyTrackerAPI.Models.Communication;
using DailyTrackerAPI.Services.Communication;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace DailyTrackerAPI.Controllers.Communication
{
    // ─── Phone / browser push notifications ──────────────────────────────────
    // GET    /api/push/config        → the server's public key (the browser needs it to subscribe)
    // GET    /api/push/devices       → my devices that get pushes
    // POST   /api/push/subscribe     → this device wants pushes (from PushManager.subscribe)
    // POST   /api/push/unsubscribe   → this device stops
    // POST   /api/push/test          → send myself a test push
    [ApiController, Route("api/push"), Authorize]
    public class PushController : ControllerBase
    {
        private readonly AppDbContext _db;
        public PushController(AppDbContext db) => _db = db;

        public record SubscriptionKeys(string P256dh, string Auth);
        public record SubscribeDto(string Endpoint, SubscriptionKeys Keys, string? Device);
        public record UnsubscribeDto(string Endpoint);

        [HttpGet("config")]
        public async Task<IActionResult> Config([FromServices] VapidKeys keys) =>
            Ok(new { publicKey = (await keys.GetAsync()).Public });

        [HttpGet("devices")]
        public async Task<IActionResult> Devices()
        {
            var me = User.GetUserId();
            return Ok(await _db.PushSubscriptions.Where(s => s.UserId == me).OrderBy(s => s.CreatedAt)
                .Select(s => new { s.Id, s.Device, s.CreatedAt, s.LastSentAt }).ToListAsync());
        }

        [HttpPost("subscribe")]
        public async Task<IActionResult> Subscribe([FromBody] SubscribeDto dto)
        {
            if (!Uri.TryCreate(dto.Endpoint, UriKind.Absolute, out var uri) || uri.Scheme != Uri.UriSchemeHttps || dto.Endpoint.Length > 1000)
                return BadRequest(new { message = "That isn't a valid push address." });
            try
            {
                if (B64.Decode(dto.Keys.P256dh).Length != 65 || B64.Decode(dto.Keys.Auth).Length != 16)
                    return BadRequest(new { message = "The browser's push keys are not valid." });
            }
            catch (FormatException) { return BadRequest(new { message = "The browser's push keys are not valid." }); }

            var me = User.GetUserId();
            // one row per endpoint: if another account used this browser before, it moves to whoever is signed in now
            var sub = await _db.PushSubscriptions.FirstOrDefaultAsync(s => s.Endpoint == dto.Endpoint);
            if (sub == null) _db.PushSubscriptions.Add(sub = new PushSubscription { Endpoint = dto.Endpoint });
            sub.UserId = me;
            sub.P256dh = dto.Keys.P256dh;
            sub.Auth = dto.Keys.Auth;
            sub.Device = string.IsNullOrWhiteSpace(dto.Device) ? null : dto.Device.Trim()[..Math.Min(dto.Device.Trim().Length, 100)];
            await _db.SaveChangesAsync();
            return Ok(new { message = "Push notifications are on for this device." });
        }

        [HttpPost("unsubscribe")]
        public async Task<IActionResult> Unsubscribe([FromBody] UnsubscribeDto dto)
        {
            var me = User.GetUserId();
            await _db.PushSubscriptions.Where(s => s.UserId == me && s.Endpoint == dto.Endpoint).ExecuteDeleteAsync();
            return Ok(new { message = "Push notifications are off for this device." });
        }

        [HttpPost("test")]
        public async Task<IActionResult> Test([FromServices] PushDelivery delivery)
        {
            var me = User.GetUserId();
            if (!await _db.PushSubscriptions.AnyAsync(s => s.UserId == me))
                return BadRequest(new { message = "Turn on push notifications on this device first." });
            var sent = await delivery.DeliverAsync(new[] { me },
                new PushMessage("DailyTracker", "Push notifications work on this device 🎉", "/notifications", "test"));
            return Ok(new { sent, message = sent > 0 ? $"Test sent to {sent} device(s)." : "The push service didn't accept the test — try turning push off and on again." });
        }
    }
}
