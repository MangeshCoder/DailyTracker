using DailyTrackerAPI.DTOs;
using DailyTrackerAPI.Helpers;
using DailyTrackerAPI.Services.Attendance;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace DailyTrackerAPI.Controllers.Attendance
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class BreaksController : ControllerBase
    {
        private readonly IBreakService _breakService;
        public BreaksController(IBreakService breakService) { _breakService = breakService; }

        #region POST StartBreak
        /// <summary>
        /// Start break time 
        /// </summary>
        /// <param name="dto"></param>
        /// <returns></returns>
        [HttpPost("start")]
        public async Task<IActionResult> StartBreak([FromBody] StartBreakDto dto)
        {
            var result = await _breakService.StartBreakAsync(User.GetUserId(), dto);
            if (result == null) return BadRequest(new { message = "Please check in first." });
            return Ok(result);
        } 
        #endregion

        #region PUT EndBreak
        /// <summary>
        /// End break time
        /// </summary>
        /// <param name="breakId"></param>
        /// <returns></returns>
        [HttpPut("end/{breakId}")]
        public async Task<IActionResult> EndBreak(int breakId)
        {
            var result = await _breakService.EndBreakAsync(User.GetUserId(), breakId);
            if (result == null) return NotFound();
            return Ok(result);
        } 
        #endregion

        #region GET GetTodayBreaks
        /// <summary>
        /// Get today all breaks 
        /// </summary>
        /// <returns></returns>
        [HttpGet("today")]
        public async Task<IActionResult> GetTodayBreaks()
        {
            var result = await _breakService.GetTodayBreaksAsync(User.GetUserId());
            return Ok(result);
        } 
        #endregion
    }
}
