using DailyTrackerAPI.Helpers;
using DailyTrackerAPI.Services.Team;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace DailyTrackerAPI.Controllers.Team
{
    [ApiController, Route("api/analytics"), Authorize]
    public class AnalyticsController : ControllerBase
    {
        private readonly IAnalyticsService _analyticsSvc;
        public AnalyticsController(IAnalyticsService analyticsSvc) => _analyticsSvc = analyticsSvc;

        /// <summary>
        /// Get user advance analytics 
        /// </summary>
        /// <param name="days"></param>
        /// <returns></returns>
        [HttpGet]
        public async Task<IActionResult> GetAdvanced([FromQuery] int days = 90)
        {
            var data = await _analyticsSvc.GetAdvancedAnalyticsAsync(User.GetUserId(), days);
            return Ok(data);
        }

        /// <summary>
        /// Get Heat map
        /// </summary>
        /// <param name="days"></param>
        /// <returns></returns>
        [HttpGet("heatmap")]
        public async Task<IActionResult> GetHeatmap([FromQuery] int days = 365)
        {
            var data = await _analyticsSvc.GetHeatmapAsync(User.GetUserId(), days);
            return Ok(data);
        }

        /// <summary>
        /// Get project breakdown 
        /// </summary>
        /// <param name="days"></param>
        /// <returns></returns>
        [HttpGet("projects")]
        public async Task<IActionResult> GetProjects([FromQuery] int days = 30)
        {
            var data = await _analyticsSvc.GetProjectBreakdownAsync(User.GetUserId(), days);
            return Ok(data);
        }

        /// <summary>
        /// Get daily peak hours total work time
        /// </summary>
        /// <param name="days"></param>
        /// <returns></returns>
        [HttpGet("peak-hours")]
        public async Task<IActionResult> GetPeakHours([FromQuery] int days = 30)
        {
            var data = await _analyticsSvc.GetPeakHoursAsync(User.GetUserId(), days);
            return Ok(data);
        }

        /// <summary>
        /// Manager get all users analytics
        /// </summary>
        /// <param name="userId"></param>
        /// <param name="days"></param>
        /// <returns></returns>
        [HttpGet("user/{userId}"), Authorize(Roles = "Manager")]
        public async Task<IActionResult> GetUserAnalytics(int userId, [FromQuery] int days = 90)
        {
            var data = await _analyticsSvc.GetAdvancedAnalyticsAsync(userId, days);
            return Ok(data);
        }
    }
}
