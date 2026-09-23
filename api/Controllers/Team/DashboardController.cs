using DailyTrackerAPI.Helpers;
using DailyTrackerAPI.Services.Team;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace DailyTrackerAPI.Controllers.Team
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class DashboardController : ControllerBase
    {
        private readonly IDashboardService _dashboardService;
        public DashboardController(IDashboardService dashboardService) { _dashboardService = dashboardService; }

        /// <summary>
        /// Get today user summary 
        /// </summary>
        /// <returns></returns>
        [HttpGet("today")]
        public async Task<IActionResult> GetTodaySummary()
        {
            var result = await _dashboardService.GetTodaySummaryAsync(User.GetUserId());
            return Ok(result);
        }

        /// <summary>
        /// Get user weekly summary
        /// </summary>
        /// <returns></returns>
        [HttpGet("weekly")]
        public async Task<IActionResult> GetWeeklyReport()
        {
            var result = await _dashboardService.GetWeeklyReportAsync(User.GetUserId());
            return Ok(result);
        }

        /// <summary>
        /// Get team activity
        /// </summary>
        /// <returns></returns>
        [HttpGet("team")]
        [Authorize(Roles = "TeamLead,Manager")]
        public async Task<IActionResult> GetTeamActivity()
        {
            var result = await _dashboardService.GetTeamActivityAsync();
            return Ok(result);
        }
    }
}
