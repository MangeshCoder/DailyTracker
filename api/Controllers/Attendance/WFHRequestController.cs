using DailyTrackerAPI.DTOs;
using DailyTrackerAPI.Helpers;
using DailyTrackerAPI.Services.Attendance;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Text;

namespace DailyTrackerAPI.Controllers.Attendance
{
    // ═══════════════════════════════════════════════════════════════════════════
    // WFH / HALF-DAY CONTROLLER
    //
    // Employee routes:
    //   POST   /api/wfh-requests              → Submit request
    //   GET    /api/wfh-requests/my           → My requests
    //   DELETE /api/wfh-requests/{id}/cancel  → Cancel pending request
    //
    // Manager routes:
    //   GET    /api/wfh-requests/pending       → All pending for my team
    //   GET    /api/wfh-requests/all           → All requests for a month
    //   POST   /api/wfh-requests/{id}/approve  → Approve
    //   POST   /api/wfh-requests/{id}/reject   → Reject
    //   GET    /api/wfh-requests/team-status   → Today's team attendance dashboard
    //   GET    /api/wfh-requests/team-monthly  → Monthly summary
    // ═══════════════════════════════════════════════════════════════════════════

    [ApiController]
    [Route("api/wfh-requests")]
    [Authorize]
    public class WFHRequestController : ControllerBase
    {
        private readonly IWFHRequestService _wfhService;

        public WFHRequestController(IWFHRequestService wfhService)
        {
            _wfhService = wfhService;
        }

        // ── EMPLOYEE: Submit WFH or HalfDay request ──────────────────────────

        /// <summary>Submit a new WFH or HalfDay request</summary>
        [HttpPost]
        public async Task<IActionResult> Submit([FromBody] CreateWFHRequestDto dto)
        {
            try
            {
                var userId = User.GetUserId();
                var request = await _wfhService.SubmitRequestAsync(userId, dto);
                return Ok(new
                {
                    request.Id,
                    request.RequestType,
                    RequestDate = request.RequestDate.ToString("yyyy-MM-dd"),
                    request.HalfDaySlot,
                    request.Reason,
                    request.Status,
                    message = $"Your {request.RequestType} request for {request.RequestDate:MMMM d} has been submitted. Awaiting manager approval."
                });
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }

        /// <summary>Get my WFH/HalfDay requests</summary>
        [HttpGet("my")]
        public async Task<IActionResult> GetMy([FromQuery] int pageSize = 30)
        {
            var userId = User.GetUserId();
            var requests = await _wfhService.GetMyRequestsAsync(userId, pageSize);
            return Ok(requests);
        }

        /// <summary>Cancel a pending request</summary>
        [HttpDelete("{id}/cancel")]
        public async Task<IActionResult> Cancel(int id)
        {
            try
            {
                var userId = User.GetUserId();
                await _wfhService.CancelRequestAsync(userId, id);
                return Ok(new { message = "Request cancelled successfully." });
            }
            catch (KeyNotFoundException)
            {
                return NotFound(new { message = "Request not found." });
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }

        // ── MANAGER: View requests ────────────────────────────────────────────

        /// <summary>Get all pending requests for my team</summary>
        [HttpGet("pending")]
        [Authorize(Roles = "Manager,TeamLead,Admin")]
        public async Task<IActionResult> GetPending()
        {
            var managerId = User.GetUserId();
            var requests = await _wfhService.GetPendingRequestsAsync(managerId);
            return Ok(requests);
        }

        /// <summary>Get all requests for a specific month</summary>
        [HttpGet("all")]
        [Authorize(Roles = "Manager,TeamLead,Admin")]
        public async Task<IActionResult> GetAll(
            [FromQuery] int month = 0,
            [FromQuery] int year = 0)
        {
            var now = DateTime.UtcNow;
            month = month > 0 ? month : now.Month;
            year = year > 0 ? year : now.Year;

            var managerId = User.GetUserId();
            var requests = await _wfhService.GetAllRequestsAsync(managerId, month, year);
            return Ok(requests);
        }

        // ── MANAGER: Approve / Reject ─────────────────────────────────────────

        /// <summary>Approve a WFH/HalfDay request</summary>
        [HttpPost("{id}/approve")]
        [Authorize(Roles = "Manager,TeamLead,Admin")]
        public async Task<IActionResult> Approve(int id, [FromBody] ReviewWFHRequestDto dto)
        {
            try
            {
                var managerId = User.GetUserId();
                var request = await _wfhService.ApproveAsync(managerId, id, dto.Note);
                return Ok(new
                {
                    request.Id,
                    request.Status,
                    message = $"{request.RequestType} approved for {request.RequestDate:MMMM d}. The employee's attendance has been updated."
                });
            }
            catch (KeyNotFoundException) { return NotFound(new { message = "Request not found." }); }
            catch (UnauthorizedAccessException ex) { return Forbid(ex.Message); }
            catch (InvalidOperationException ex) { return BadRequest(new { message = ex.Message }); }
        }

        /// <summary>Reject a WFH/HalfDay request</summary>
        [HttpPost("{id}/reject")]
        [Authorize(Roles = "Manager,TeamLead,Admin")]
        public async Task<IActionResult> Reject(int id, [FromBody] ReviewWFHRequestDto dto)
        {
            try
            {
                var managerId = User.GetUserId();
                var request = await _wfhService.RejectAsync(managerId, id, dto.Note);
                return Ok(new
                {
                    request.Id,
                    request.Status,
                    message = "Request has been rejected."
                });
            }
            catch (KeyNotFoundException) { return NotFound(new { message = "Request not found." }); }
            catch (UnauthorizedAccessException ex) { return Forbid(ex.Message); }
            catch (InvalidOperationException ex) { return BadRequest(new { message = ex.Message }); }
        }

        // ── MANAGER DASHBOARD ─────────────────────────────────────────────────

        /// <summary>Get today's team attendance status — who is WFH, present, half-day, absent</summary>
        [HttpGet("team-status")]
        [Authorize(Roles = "Manager,TeamLead,Admin")]
        public async Task<IActionResult> GetTeamStatus([FromQuery] string? date = null)
        {
            var managerId = User.GetUserId();
            var targetDate = date != null ? DateTime.Parse(date) : (DateTime?)null;
            var result = await _wfhService.GetTeamDailyStatusAsync(managerId, targetDate);
            return Ok(result);
        }

        /// <summary>Get monthly team attendance summary with WFH/HalfDay breakdown</summary>
        [HttpGet("team-monthly")]
        [Authorize(Roles = "Manager,TeamLead,Admin")]
        public async Task<IActionResult> GetTeamMonthly(
            [FromQuery] int month = 0,
            [FromQuery] int year = 0)
        {
            var now = DateTime.UtcNow;
            month = month > 0 ? month : now.Month;
            year = year > 0 ? year : now.Year;

            var managerId = User.GetUserId();
            var result = await _wfhService.GetTeamMonthlyAttendanceAsync(managerId, month, year);
            return Ok(result);
        }

        [AllowAnonymous]
        [HttpPost("review")]
        public async Task<IActionResult> ReviewFromEmail(string token, string status)
        {
            var decoded = Encoding.UTF8.GetString(Convert.FromBase64String(token));
            var parts = decoded.Split('|');

            var requestId = int.Parse(parts[0]);
            var managerId = int.Parse(parts[1]);
            var expiry = DateTime.Parse(parts[2]);

            if (DateTime.UtcNow > expiry)
                return BadRequest("Link expired.");

            if (status == "Approved")
                await _wfhService.ApproveAsync(managerId, requestId, "Approved via Email");
            else
                await _wfhService.RejectAsync(managerId, requestId, "Rejected via Email");

            return Ok("Request processed successfully.");
        }
    }
}