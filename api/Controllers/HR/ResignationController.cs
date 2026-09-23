using DailyTrackerAPI.DTOs;
using DailyTrackerAPI.Helpers;
using DailyTrackerAPI.Services.HR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace DailyTrackerAPI.Controllers.HR
{
    [ApiController, Route("api/resignation"), Authorize]
    public class ResignationController : ControllerBase
    {
        private readonly IResignationService _svc;
        public ResignationController(IResignationService svc) => _svc = svc;

        private string Role => User.FindFirstValue(ClaimTypes.Role) ?? "Developer";

        // ── EMPLOYEE ──────────────────────────────────────────────────────────

        [HttpPost]
        public async Task<IActionResult> Submit([FromBody] SubmitResignationDto dto)
        {
            try
            {
                var result = await _svc.SubmitAsync(User.GetUserId(), dto);
                return Ok(result);
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }

        [HttpGet("my")]
        public async Task<IActionResult> GetMy()
        {
            var result = await _svc.GetMyResignationAsync(User.GetUserId());
            return result == null ? NotFound(new { message = "No active resignation found." }) : Ok(result);
        }

        [HttpDelete("withdraw")]
        public async Task<IActionResult> Withdraw()
        {
            var ok = await _svc.WithdrawAsync(User.GetUserId());
            return ok ? Ok(new { message = "Resignation withdrawn successfully." })
                      : BadRequest(new { message = "No pending resignation to withdraw." });
        }

        // ── MANAGER ───────────────────────────────────────────────────────────

        [HttpGet, Authorize(Roles = "Manager,TeamLead")]
        public async Task<IActionResult> GetAll([FromQuery] string? status = null)
        {
            var result = await _svc.GetAllAsync(status);
            return Ok(result);
        }

        [HttpGet("summary"), Authorize(Roles = "Manager,TeamLead")]
        public async Task<IActionResult> GetSummary()
        {
            var result = await _svc.GetSummaryAsync();
            return Ok(result);
        }

        [HttpGet("{id:int}"), Authorize(Roles = "Manager,TeamLead")]
        public async Task<IActionResult> GetById(int id)
        {
            var result = await _svc.GetByIdAsync(id);
            return result == null ? NotFound() : Ok(result);
        }

        [HttpPut("{id:int}/review"), Authorize(Roles = "Manager,TeamLead")]
        public async Task<IActionResult> Review(int id, [FromBody] ReviewResignationDto dto)
        {
            try
            {
                var result = await _svc.ReviewAsync(User.GetUserId(), id, dto);
                return result == null ? NotFound() : Ok(result);
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }

        [HttpPut("{id:int}/complete"), Authorize(Roles = "Manager,TeamLead")]
        public async Task<IActionResult> Complete(int id, [FromBody] CompleteExitDto dto)
        {
            try
            {
                var result = await _svc.CompleteExitAsync(User.GetUserId(), id, dto);
                return result == null ? NotFound() : Ok(result);
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }

        // ── CHECKLIST ────────────────────────────────────────────────────────

        [HttpPost("{id:int}/checklist"), Authorize(Roles = "Manager,TeamLead")]
        public async Task<IActionResult> AddChecklistItem(int id, [FromBody] AddChecklistItemDto dto)
        {
            var result = await _svc.AddChecklistItemAsync(User.GetUserId(), id, dto);
            return result == null ? NotFound() : Ok(result);
        }

        [HttpPut("checklist/{itemId:int}/toggle"), Authorize(Roles = "Manager,TeamLead")]
        public async Task<IActionResult> ToggleItem(int itemId)
        {
            var result = await _svc.ToggleChecklistItemAsync(User.GetUserId(), itemId);
            return result == null ? NotFound() : Ok(result);
        }

        [HttpDelete("checklist/{itemId:int}"), Authorize(Roles = "Manager,TeamLead")]
        public async Task<IActionResult> DeleteItem(int itemId)
        {
            var ok = await _svc.DeleteChecklistItemAsync(User.GetUserId(), itemId);
            return ok ? NoContent() : NotFound();
        }
    }
}
