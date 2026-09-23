using DailyTrackerAPI.DTOs;
using DailyTrackerAPI.Helpers;
using DailyTrackerAPI.Services.Communication;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace DailyTrackerAPI.Controllers.Communication
{
    // ─── Announcements Controller ─────────────────────────────────────────────
    // GET    /api/announcements              → all posts with per-user read flags
    // GET    /api/announcements/unread-count → lightweight badge count
    // POST   /api/announcements              → create (Manager only)
    // POST   /api/announcements/{id}/read    → mark one as read
    // POST   /api/announcements/read-all     → mark all as read
    // PATCH  /api/announcements/{id}/pin     → toggle pin (Manager only)
    // DELETE /api/announcements/{id}         → delete (Manager only)
    [ApiController, Route("api/announcements"), Authorize]
    public class AnnouncementsController : ControllerBase
    {
        private readonly IAnnouncementService _svc;
        public AnnouncementsController(IAnnouncementService svc) => _svc = svc;

        [HttpGet]
        public async Task<IActionResult> GetAll()
        {
            var result = await _svc.GetAllAsync(User.GetUserId());
            return Ok(result);
        }

        [HttpGet("unread-count")]
        public async Task<IActionResult> GetUnreadCount()
        {
            var count = await _svc.GetUnreadCountAsync(User.GetUserId());
            return Ok(new { count });
        }

        [HttpPost, Authorize(Roles = "Manager")]
        public async Task<IActionResult> Create([FromBody] CreateAnnouncementDto dto)
        {
            try
            {
                var announcement = await _svc.CreateAsync(User.GetUserId(), dto);
                return Ok(announcement);
            }
            catch (Exception ex) { return BadRequest(new { message = ex.Message }); }
        }

        [HttpPost("{id}/read")]
        public async Task<IActionResult> MarkRead(int id)
        {
            await _svc.MarkReadAsync(User.GetUserId(), id);
            return Ok();
        }

        [HttpPost("read-all")]
        public async Task<IActionResult> MarkAllRead()
        {
            await _svc.MarkAllReadAsync(User.GetUserId());
            return Ok();
        }

        [HttpPatch("{id}/pin"), Authorize(Roles = "Manager")]
        public async Task<IActionResult> TogglePin(int id)
        {
            try
            {
                var updated = await _svc.TogglePinAsync(id);
                return Ok(updated);
            }
            catch (KeyNotFoundException ex) { return NotFound(new { message = ex.Message }); }
        }

        [HttpDelete("{id}"), Authorize(Roles = "Manager")]
        public async Task<IActionResult> Delete(int id)
        {
            try
            {
                await _svc.DeleteAsync(id);
                return Ok();
            }
            catch (KeyNotFoundException ex) { return NotFound(new { message = ex.Message }); }
        }
    }
}
