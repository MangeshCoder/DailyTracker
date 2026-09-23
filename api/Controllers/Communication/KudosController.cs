using DailyTrackerAPI.DTOs;
using DailyTrackerAPI.Helpers;
using DailyTrackerAPI.Services.Communication;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace DailyTrackerAPI.Controllers.Communication
{
    [ApiController, Route("api/kudos"), Authorize]
    public class KudosController : ControllerBase
    {
        private readonly IKudosService _kudosSvc;
        public KudosController(IKudosService kudosSvc) => _kudosSvc = kudosSvc;

        [HttpPost]
        public async Task<IActionResult> Give([FromBody] GiveKudosDto dto)
        {
            try
            {
                var kudos = await _kudosSvc.GiveKudosAsync(User.GetUserId(), dto);
                return Ok(kudos);
            }
            catch (InvalidOperationException ex) { return BadRequest(new { message = ex.Message }); }
        }

        [HttpGet("recent")]
        public async Task<IActionResult> GetRecent([FromQuery] int limit = 20)
        {
            var list = await _kudosSvc.GetRecentKudosAsync(limit);
            return Ok(list);
        }

        [HttpGet("my")]
        public async Task<IActionResult> GetMySummary()
        {
            var summary = await _kudosSvc.GetUserKudosSummaryAsync(User.GetUserId());
            return Ok(summary);
        }

        [HttpGet("user/{userId}"), Authorize(Roles = "Manager")]
        public async Task<IActionResult> GetUserSummary(int userId)
        {
            var summary = await _kudosSvc.GetUserKudosSummaryAsync(userId);
            return Ok(summary);
        }

        // GET /api/kudos/leaderboard?period=week|month|alltime
        [HttpGet("leaderboard")]
        public async Task<IActionResult> GetLeaderboard([FromQuery] string period = "alltime")
        {
            var validPeriods = new[] { "week", "month", "alltime" };
            if (!validPeriods.Contains(period))
                return BadRequest(new { message = "period must be week, month, or alltime" });

            var now = DateTime.UtcNow;
            int year = now.Year;
            int? month = period switch
            {
                "week" => now.Month,   // current month (closest backend equivalent)
                "month" => now.Month,
                _ => null         // alltime = full year, no month filter
            };

            var leaderboard = await _kudosSvc.GetLeaderboardAsync(year, month);
            return Ok(leaderboard);
        }
    }
}