using DailyTrackerAPI.DTOs;
using DailyTrackerAPI.Helpers;
using DailyTrackerAPI.Services.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace DailyTrackerAPI.Controllers.Tasks
{
    [ApiController, Route("api/goals"), Authorize]
    public class GoalsController : ControllerBase
    {
        private readonly IGoalService _goalSvc;
        public GoalsController(IGoalService goalSvc) => _goalSvc = goalSvc;

        // ── UNCHANGED ─────────────────────────────────────────────────────────
        [HttpPost]
        public async Task<IActionResult> SetGoal([FromBody] SetGoalDto dto)
        {
            var goal = await _goalSvc.SetOrUpdateGoalAsync(User.GetUserId(), dto);
            return Ok(goal);
        }

        [HttpGet("today")]
        public async Task<IActionResult> GetProgress()
        {
            var progress = await _goalSvc.GetTodayProgressAsync(User.GetUserId());
            return Ok(progress);
        }

        [HttpGet("trend")]
        public async Task<IActionResult> GetTrend([FromQuery] int days = 14)
        {
            var trend = await _goalSvc.GetProductivityTrendAsync(User.GetUserId(), days);
            return Ok(trend);
        }

        // ── ADDED: history endpoint ───────────────────────────────────────────
        //
        //  GET /api/goals/history?from=2025-01-01&to=2025-01-31
        //
        //  Returns one entry per day where the user had a DailyLog.
        //  Used by the GoalHistoryPage for week/month views.
        //
        //  Shortcuts:
        //    GET /api/goals/history?preset=week   → last 7 days
        //    GET /api/goals/history?preset=month  → last 30 days
        //
        //  Range capped at 90 days to prevent accidental large queries.
        [HttpGet("history")]
        public async Task<IActionResult> GetHistory(
            [FromQuery] string? preset,
            [FromQuery] DateTime? from,
            [FromQuery] DateTime? to)
        {
            var toDate = DateTime.UtcNow.Date;
            var fromDate = preset switch
            {
                "week" => toDate.AddDays(-6),   // last 7 days including today
                "month" => toDate.AddDays(-29),  // last 30 days including today
                _ => from?.Date ?? toDate.AddDays(-6)
            };

            if (to.HasValue) toDate = to.Value.Date;

            // Hard cap: max 90 days per request
            if ((toDate - fromDate).TotalDays > 90)
                fromDate = toDate.AddDays(-90);

            var history = await _goalSvc.GetHistoryAsync(User.GetUserId(), fromDate, toDate);
            return Ok(history);
        }
    }
}