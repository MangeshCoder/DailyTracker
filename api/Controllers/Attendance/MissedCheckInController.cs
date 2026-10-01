using DailyTrackerAPI.Helpers;
using DailyTrackerAPI.Services.Attendance;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace DailyTrackerAPI.Controllers.Attendance
{
    // ─── Missed check-in requests ────────────────────────────────────────────
    // POST   /api/missed-checkin              → "I worked that day but forgot to check in"
    // GET    /api/missed-checkin/mine         → my requests
    // DELETE /api/missed-checkin/{id}         → cancel a pending one
    // GET    /api/missed-checkin/pending      → waiting for me (team leads / managers)
    // PUT    /api/missed-checkin/{id}/review  → approve (adds the day) or decline
    [ApiController, Route("api/missed-checkin"), Authorize]
    public class MissedCheckInController : ControllerBase
    {
        private readonly IMissedCheckInService _svc;
        public MissedCheckInController(IMissedCheckInService svc) => _svc = svc;

        [HttpPost]
        public async Task<IActionResult> Create([FromBody] MissedCheckInCreateDto dto) =>
            Ok(await _svc.RequestAsync(User.GetUserId(), dto));

        [HttpGet("mine")]
        public async Task<IActionResult> Mine() => Ok(await _svc.GetMineAsync(User.GetUserId()));

        [HttpDelete("{id:int}")]
        public async Task<IActionResult> Cancel(int id)
        {
            await _svc.CancelAsync(User.GetUserId(), id);
            return Ok(new { message = "Request cancelled." });
        }

        [HttpGet("pending"), Authorize(Roles = "Manager,TeamLead")]
        public async Task<IActionResult> Pending() => Ok(await _svc.GetPendingAsync(User.GetUserId()));

        [HttpPut("{id:int}/review"), Authorize(Roles = "Manager,TeamLead")]
        public async Task<IActionResult> Review(int id, [FromBody] MissedCheckInReviewDto dto) =>
            Ok(await _svc.ReviewAsync(User.GetUserId(), id, dto));
    }
}
