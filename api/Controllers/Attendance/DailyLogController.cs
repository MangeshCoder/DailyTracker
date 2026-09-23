using DailyTrackerAPI.DTOs;
using DailyTrackerAPI.Helpers;
using DailyTrackerAPI.Services.Attendance;
using DailyTrackerAPI.Services.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace DailyTrackerAPI.Controllers.Attendance
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class DailyLogController : ControllerBase
    {
        private readonly IDailyLogService _logService;
        public DailyLogController(IDailyLogService logService)
        {
            _logService = logService;
        }

        #region POST CheckIn
        [HttpPost("checkin")]
        public async Task<IActionResult> CheckIn([FromBody] CheckInDto dto)
        {
            try
            {
                var result = await _logService.CheckInAsync(User.GetUserId(), dto);
                if (result == null)
                    return BadRequest(new { message = "Already checked in today." });
                return Ok(result);
            }
            catch (LocationException ex)
            {
                return StatusCode(403, new { message = ex.Message });
            }
        }
        #endregion

        #region POST checkout
        [HttpPut("checkout")]
        public async Task<IActionResult> CheckOut([FromBody] CheckOutDto dto)
        {
            try
            {
                var result = await _logService.CheckOutAsync(User.GetUserId(), dto);
                if (result == null)
                    return BadRequest(new { message = "No check-in found for today." });
                return Ok(result);
            }
            catch (LocationException ex)
            {
                return StatusCode(403, new { message = ex.Message });
            }
        }
        #endregion

        #region GET today
        [HttpGet("today")]
        public async Task<IActionResult> GetToday()
        {
            var result = await _logService.GetTodayLogAsync(User.GetUserId());
            return result == null ? NotFound() : Ok(result);
        }
        #endregion

        #region GETBYDATE date
        [HttpGet("date/{date}")]
        public async Task<IActionResult> GetByDate(DateTime date)
        {
            var result = await _logService.GetLogByDateAsync(User.GetUserId(), date);
            return result == null ? NotFound() : Ok(result);
        }
        #endregion

        #region GET history
        [HttpGet("history")]
        public async Task<IActionResult> GetHistory([FromQuery] int days = 30)
        {
            var result = await _logService.GetHistoryAsync(User.GetUserId(), days);
            return Ok(result);
        }
        #endregion
    }
}