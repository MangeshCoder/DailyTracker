using DailyTrackerAPI.DTOs;
using DailyTrackerAPI.Helpers;
using DailyTrackerAPI.Services.Communication;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace DailyTrackerAPI.Controllers.Communication
{
    // ─── Meeting Log Controller ───────────────────────────────────────────────
    // GET    /api/meetings                      → my meetings (as organiser or attendee)
    // GET    /api/meetings?month=6&year=2025    → filter by month
    // GET    /api/meetings/{id}                 → single meeting detail
    // POST   /api/meetings                      → create meeting
    // PUT    /api/meetings/{id}                 → update (organiser only)
    // DELETE /api/meetings/{id}                 → delete (organiser only)
    // POST   /api/meetings/{id}/rsvp            → respond to invite
    // POST   /api/meetings/{id}/action-items    → add action item
    // PUT    /api/meetings/action-items/{itemId}→ update action item
    // DELETE /api/meetings/action-items/{itemId}→ delete action item
    [ApiController, Route("api/meetings"), Authorize]
    public class MeetingController : ControllerBase
    {
        private readonly IMeetingService _svc;
        public MeetingController(IMeetingService svc) => _svc = svc;

        [HttpGet]
        public async Task<IActionResult> GetMyMeetings(
            [FromQuery] int? month = null,
            [FromQuery] int? year = null)
        {
            var userId = User.GetUserId();
            var meetings = await _svc.GetMyMeetingsAsync(userId, month, year);
            return Ok(meetings);
        }

        [HttpGet("{id:int}")]
        public async Task<IActionResult> GetById(int id)
        {
            var userId = User.GetUserId();
            var meeting = await _svc.GetByIdAsync(id, userId);
            return meeting == null ? NotFound() : Ok(meeting);
        }

        [HttpPost]
        public async Task<IActionResult> Create([FromBody] CreateMeetingDto dto)
        {
            var userId = User.GetUserId();
            var meeting = await _svc.CreateAsync(userId, dto);
            return CreatedAtAction(nameof(GetById), new { id = meeting.Id }, meeting);
        }

        [HttpPut("{id:int}")]
        public async Task<IActionResult> Update(int id, [FromBody] UpdateMeetingDto dto)
        {
            var userId = User.GetUserId();
            var meeting = await _svc.UpdateAsync(id, userId, dto);
            return meeting == null ? Forbid() : Ok(meeting);
        }

        [HttpDelete("{id:int}")]
        public async Task<IActionResult> Delete(int id)
        {
            var userId = User.GetUserId();
            var deleted = await _svc.DeleteAsync(id, userId);
            return deleted ? Ok(new { message = "Meeting deleted." }) : Forbid();
        }

        [HttpPost("{id:int}/rsvp")]
        public async Task<IActionResult> Rsvp(int id, [FromBody] MeetingRsvpDto dto)
        {
            var userId = User.GetUserId();
            var meeting = await _svc.RsvpAsync(id, userId, dto);
            return meeting == null ? NotFound() : Ok(meeting);
        }

        [HttpPost("{id:int}/action-items")]
        public async Task<IActionResult> AddActionItem(int id, [FromBody] CreateActionItemDto dto)
        {
            try
            {
                var userId = User.GetUserId();
                var item = await _svc.AddActionItemAsync(id, userId, dto);
                return Ok(item);
            }
            catch (KeyNotFoundException ex) { return NotFound(new { message = ex.Message }); }
            catch (UnauthorizedAccessException) { return Forbid(); }
        }

        [HttpPut("action-items/{itemId:int}")]
        public async Task<IActionResult> UpdateActionItem(int itemId, [FromBody] UpdateActionItemDto dto)
        {
            var userId = User.GetUserId();
            var item = await _svc.UpdateActionItemAsync(itemId, userId, dto);
            return item == null ? Forbid() : Ok(item);
        }

        [HttpDelete("action-items/{itemId:int}")]
        public async Task<IActionResult> DeleteActionItem(int itemId)
        {
            var userId = User.GetUserId();
            var deleted = await _svc.DeleteActionItemAsync(itemId, userId);
            return deleted ? Ok(new { message = "Action item deleted." }) : Forbid();
        }
    }
}
