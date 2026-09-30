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
        private readonly IAutoCheckoutService _autoCheckout;
        public DailyLogController(IDailyLogService logService, IAutoCheckoutService autoCheckout)
        {
            _logService = logService;
            _autoCheckout = autoCheckout;
        }

        #region POST CheckIn
        [HttpPost("checkin")]
        public async Task<IActionResult> CheckIn([FromBody] CheckInDto dto)
        {
            try
            {
                // a shift left open from an earlier day is closed first (forgotten check-out)
                await _autoCheckout.CloseForgottenShiftsAsync(User.GetUserId());
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
            await _autoCheckout.CloseForgottenShiftsAsync(User.GetUserId());
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
            await _autoCheckout.CloseForgottenShiftsAsync(User.GetUserId());
            var result = await _logService.GetHistoryAsync(User.GetUserId(), days);
            return Ok(result);
        }
        #endregion

        #region Forgotten check-out
        /// <summary>The latest day the app closed for me that I haven't answered yet (204 if none)</summary>
        [HttpGet("auto-checkout")]
        public async Task<IActionResult> GetAutoCheckout()
        {
            await _autoCheckout.CloseForgottenShiftsAsync(User.GetUserId());
            var result = await _autoCheckout.GetUnansweredAsync(User.GetUserId());
            return result == null ? NoContent() : Ok(result);
        }

        /// <summary>"That's right" — the saved finish time is correct</summary>
        [HttpPost("{id:int}/auto-checkout/confirm")]
        public async Task<IActionResult> ConfirmAutoCheckout(int id)
        {
            await _autoCheckout.ConfirmAsync(User.GetUserId(), id);
            return Ok(new { message = "Thanks — your hours stay as they are." });
        }

        /// <summary>"I finished at …" — sent to the manager / team lead</summary>
        [HttpPost("{id:int}/checkout-correction")]
        public async Task<IActionResult> RequestCorrection(int id, [FromBody] CheckoutCorrectionRequestDto dto)
        {
            await _autoCheckout.RequestCorrectionAsync(User.GetUserId(), id, dto);
            return Ok(new { message = "Sent to your manager for approval." });
        }

        [HttpGet("checkout-corrections/pending"), Authorize(Roles = "Manager,TeamLead")]
        public async Task<IActionResult> PendingCorrections() =>
            Ok(await _autoCheckout.GetPendingCorrectionsAsync(User.GetUserId()));

        [HttpPut("{id:int}/checkout-correction/review"), Authorize(Roles = "Manager,TeamLead")]
        public async Task<IActionResult> ReviewCorrection(int id, [FromBody] ReviewCheckoutCorrectionDto dto)
        {
            await _autoCheckout.ReviewCorrectionAsync(User.GetUserId(), id, dto);
            return Ok(new { message = dto.Status == "Approved" ? "Check-out corrected." : "Correction declined." });
        }
        #endregion
    }
}