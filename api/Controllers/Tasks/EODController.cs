using DailyTrackerAPI.DTOs;
using DailyTrackerAPI.Helpers;
using DailyTrackerAPI.Services.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace DailyTrackerAPI.Controllers.Tasks
{
    [ApiController, Route("api/eod"), Authorize]
    public class EODController : ControllerBase
    {
        private readonly IEODService _eodSvc;
        public EODController(IEODService eodSvc) => _eodSvc = eodSvc;

        /// <summary>
        /// Submit daily End Of the Day report
        /// </summary>
        /// <param name="dto"></param>
        /// <returns></returns>
        [HttpPost]
        public async Task<IActionResult> Submit([FromBody] CreateEODReportDto dto)
        {
            try
            {
                var report = await _eodSvc.SubmitReportAsync(User.GetUserId(), dto);
                return Ok(report);
            }
            catch (InvalidOperationException ex) { return BadRequest(new { message = ex.Message }); }
        }

        /// <summary>
        /// Get today End of the report
        /// </summary>
        /// <returns></returns>
        [HttpGet("today")]
        public async Task<IActionResult> GetToday()
        {
            var report = await _eodSvc.GetTodayReportAsync(User.GetUserId());
            return Ok(report);
        }

        /// <summary>
        /// Get user EOD history
        /// </summary>
        /// <param name="days"></param>
        /// <returns></returns>
        [HttpGet("history")]
        public async Task<IActionResult> GetHistory([FromQuery] int days = 14)
        {
            var reports = await _eodSvc.GetUserReportsAsync(User.GetUserId(), days);
            return Ok(reports);
        }

        /// <summary>
        /// Get all pending EOD report review
        /// </summary>
        /// <returns></returns>
        [HttpGet("pending"), Authorize(Roles = "Manager")]
        public async Task<IActionResult> GetPending()
        {
            var reports = await _eodSvc.GetAllPendingReviewsAsync();
            return Ok(reports);
        }

        /// <summary>
        /// Review EOD report 
        /// </summary>
        /// <param name="id"></param>
        /// <param name="dto"></param>
        /// <returns></returns>
        [HttpPut("{id}/review"), Authorize(Roles = "Manager")]
        public async Task<IActionResult> Review(int id, [FromBody] ManagerReviewEODDto dto)
        {
            await _eodSvc.ReviewReportAsync(id, User.GetUserId(), dto);
            return Ok(new { message = "Review submitted." });
        }
    }
}
