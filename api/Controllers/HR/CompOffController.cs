using DailyTrackerAPI.DTOs;
using DailyTrackerAPI.Helpers;
using DailyTrackerAPI.Services.HR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace DailyTrackerAPI.Controllers.HR
{
    // ─────────────────────────────────────────────────────────────────────────
    //  Comp-off — days off earned by working on weekends / public holidays
    //    GET  /api/compoff/my                → my days (available, waiting, used, expired)
    //    GET  /api/compoff/pending           → waiting for my decision (manager / team lead)
    //    GET  /api/compoff/team              → my team's comp-off of the last months
    //    PUT  /api/compoff/{id}/review       → approve / decline
    //  Spending: apply for a leave of type "CompOff" (api/leave).
    // ─────────────────────────────────────────────────────────────────────────
    [ApiController, Route("api/compoff"), Authorize]
    public class CompOffController : ControllerBase
    {
        private readonly ICompOffService _compOff;
        public CompOffController(ICompOffService compOff) => _compOff = compOff;

        [HttpGet("my")]
        public async Task<IActionResult> Mine() => Ok(await _compOff.GetMineAsync(User.GetUserId()));

        [HttpGet("pending"), Authorize(Roles = "Manager,TeamLead")]
        public async Task<IActionResult> Pending() => Ok(await _compOff.GetPendingAsync(User.GetUserId()));

        [HttpGet("team"), Authorize(Roles = "Manager,TeamLead")]
        public async Task<IActionResult> Team() => Ok(await _compOff.GetTeamAsync(User.GetUserId()));

        [HttpPut("{id:int}/review"), Authorize(Roles = "Manager,TeamLead")]
        public async Task<IActionResult> Review(int id, [FromBody] ReviewCompOffDto dto)
        {
            await _compOff.ReviewAsync(User.GetUserId(), id, dto);
            return Ok(new { message = dto.Status == "Approved" ? "Comp-off approved." : "Comp-off declined." });
        }
    }
}
