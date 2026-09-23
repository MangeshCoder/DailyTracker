using DailyTrackerAPI.Helpers;
using DailyTrackerAPI.Services.Communication;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace DailyTrackerAPI.Controllers.Communication
{
    // ─── Notifications Controller ─────────────────────────────────────────────
    [ApiController, Route("api/notifications"), Authorize]
    public class NotificationsController : ControllerBase
    {
        private readonly IAppNotificationService _notifSvc;
        public NotificationsController(IAppNotificationService notifSvc) => _notifSvc = notifSvc;

        [HttpGet]
        public async Task<IActionResult> GetAll([FromQuery] bool unreadOnly = false)
        {
            var list = await _notifSvc.GetMyNotificationsAsync(User.GetUserId(), unreadOnly);
            return Ok(list);
        }

        [HttpGet("count")]
        public async Task<IActionResult> GetCount()
        {
            var count = await _notifSvc.GetUnreadCountAsync(User.GetUserId());
            return Ok(new { count });
        }

        [HttpPut("{id}/read")]
        public async Task<IActionResult> MarkRead(int id)
        {
            await _notifSvc.MarkReadAsync(id, User.GetUserId());
            return Ok();
        }

        [HttpPut("read-all")]
        public async Task<IActionResult> MarkAllRead()
        {
            await _notifSvc.MarkAllReadAsync(User.GetUserId());
            return Ok();
        }

        /// <summary>
        /// Full paged inbox — skip/take with no hard limit.
        /// Used by the dedicated Notifications inbox page.
        /// The bell popup continues using the existing GET /api/notifications
        /// (which keeps Take(50) — fast and sufficient for the popup).
        /// </summary>
        [HttpGet("paged")]
        public async Task<IActionResult> GetPaged(
            [FromQuery] int skip = 0,
            [FromQuery] int take = 30,
            [FromQuery] bool unreadOnly = false)
        {
            // Cap take at 100 to prevent abuse
            take = Math.Min(take, 100);
            var list = await _notifSvc.GetPagedAsync(User.GetUserId(), skip, take, unreadOnly);
            return Ok(list);
        }

        // ── Delete a single notification ──────────────────────────────────────
        [HttpDelete("{id:int}")]
        public async Task<IActionResult> Delete(int id)
        {
            var deleted = await _notifSvc.DeleteAsync(id, User.GetUserId());
            return deleted ? NoContent() : NotFound(new { message = "Notification not found." });
        }

        // ── Delete all read notifications (inbox clear-up) ────────────────────
        [HttpDelete("clear-read")]
        public async Task<IActionResult> ClearRead()
        {
            var count = await _notifSvc.DeleteAllReadAsync(User.GetUserId());
            return Ok(new { deleted = count, message = $"{count} read notification{(count == 1 ? "" : "s")} cleared." });
        }
    }
}
