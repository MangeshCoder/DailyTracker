using DailyTrackerAPI.DTOs;
using DailyTrackerAPI.Helpers;
using DailyTrackerAPI.Services.Attendance;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace DailyTrackerAPI.Controllers.Attendance
{
    // ─── Presence Controller ──────────────────────────────────────────────────
    [ApiController, Route("api/presence"), Authorize]
    public class PresenceController : ControllerBase
    {
        private readonly IPresenceService _presenceSvc;
        public PresenceController(IPresenceService presenceSvc) => _presenceSvc = presenceSvc;

        [HttpPut]
        public async Task<IActionResult> Update([FromBody] UpdatePresenceDto dto)
        {
            await _presenceSvc.UpdateAsync(User.GetUserId(), dto);
            return Ok(new { message = "Presence updated." });
        }

        [HttpGet("team")]
        public async Task<IActionResult> GetTeam()
        {
            var team = await _presenceSvc.GetTeamPresenceAsync();
            return Ok(team);
        }
    }
}
