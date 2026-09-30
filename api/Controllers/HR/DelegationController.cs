using DailyTrackerAPI.Helpers;
using DailyTrackerAPI.Services.HR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace DailyTrackerAPI.Controllers.HR
{
    // ─────────────────────────────────────────────────────────────────────────
    //  Approval delegation — "while I'm away, X decides my team's requests"
    //    GET    /api/delegations/my     → my hand-overs, and whom I decide for
    //    POST   /api/delegations        → hand over { toUserId, startDate, endDate, note }
    //    DELETE /api/delegations/{id}   → take my approvals back
    // ─────────────────────────────────────────────────────────────────────────
    [ApiController, Route("api/delegations"), Authorize(Roles = "Manager,TeamLead")]
    public class DelegationController : ControllerBase
    {
        private readonly IDelegationService _delegations;
        public DelegationController(IDelegationService delegations) => _delegations = delegations;

        [HttpGet("my")]
        public async Task<IActionResult> Mine() => Ok(await _delegations.GetMineAsync(User.GetUserId()));

        [HttpPost]
        public async Task<IActionResult> Create([FromBody] CreateDelegationDto dto) =>
            Ok(await _delegations.CreateAsync(User.GetUserId(), dto));

        [HttpDelete("{id:int}")]
        public async Task<IActionResult> Cancel(int id)
        {
            await _delegations.CancelAsync(User.GetUserId(), id);
            return Ok(new { message = "Your approvals are back with you." });
        }
    }
}
