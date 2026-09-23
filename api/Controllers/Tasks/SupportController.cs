// ─────────────────────────────────────────────────────────────────────────────
//  FILE 6:  backend/Controllers/SupportController.cs
//  ACTION:  REPLACE entire file
//
//  Changes from original:
//  1. Both endpoints now accept latitude + longitude from the form
//  2. Both catch LocationException → return 403 with the exact error message
//     (403 Forbidden is the correct HTTP status — user is authenticated but
//      not permitted to submit from their current location)
//  3. The [FromForm] parameter list in CreateSupportWithMedia now includes
//     latitude and longitude
// ─────────────────────────────────────────────────────────────────────────────

using DailyTrackerAPI.Data;
using DailyTrackerAPI.DTOs;
using DailyTrackerAPI.Helpers;
using DailyTrackerAPI.Services.Tasks;
using DailyTrackerAPI.Services.Team;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace DailyTrackerAPI.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class SupportController : ControllerBase
    {
        private readonly ISupportService _supportService;
        private readonly ISupportAssignmentService _assignmentService;
        private readonly IMediaStorageService _mediaStorage;
        private readonly AppDbContext _db;

        public SupportController(
            ISupportService supportService,
            ISupportAssignmentService assignmentService,
            IMediaStorageService mediaStorage,
            AppDbContext db)
        {
            _supportService = supportService;
            _assignmentService = assignmentService;
            _mediaStorage = mediaStorage;
            _db = db;
        }

        // ── POST /api/support ─────────────────────────────────────────────────
        [HttpPost]
        public async Task<IActionResult> CreateSupport([FromBody] CreateSupportDto dto)
        {
            try
            {
                var result = await _supportService.CreateSupportAsync(User.GetUserId(), dto);
                if (result == null)
                    return BadRequest(new { message = "Check in first or user not found." });
                return Ok(result);
            }
            catch (LocationException ex)
            {
                return StatusCode(403, new { message = ex.Message });
            }
        }

        // ── POST /api/support/with-media ──────────────────────────────────────
        [HttpPost("with-media")]
        public async Task<IActionResult> CreateSupportWithMedia(
            [FromForm] int supportEngineerId,     // ← NEW (Feature 2)
            [FromForm] int supportedDeveloperId,
            [FromForm] string issueDescription,
            [FromForm] string? resolution,
            [FromForm] int timeSpentMinutes,
            [FromForm] string supportType,
            [FromForm] double latitude,
            [FromForm] double longitude,
            [FromForm] int? supportAssignmentId,   // ← NEW (Feature 3)
            [FromForm] IFormFileCollection? files)
        {
            var dto = new CreateSupportDto
            {
                SupportEngineerId = supportEngineerId,
                SupportedDeveloperId = supportedDeveloperId,
                IssueDescription = issueDescription,
                Resolution = resolution,
                TimeSpentMinutes = timeSpentMinutes,
                SupportType = supportType ?? "Technical",
                Latitude = latitude,
                Longitude = longitude,
                SupportAssignmentId = supportAssignmentId,
            };

            IFormFileCollection? fileCollection = null;
            if (Request.Form.Files is { Count: > 0 })
                fileCollection = Request.Form.Files;

            try
            {
                var result = await _supportService.CreateSupportWithMediaAsync(
                    User.GetUserId(), dto, fileCollection);
                if (result == null)
                    return BadRequest(new { message = "Check in first or user not found." });
                return Ok(result);
            }
            catch (LocationException ex)
            {
                return StatusCode(403, new { message = ex.Message });
            }
        }

        // ── GET /api/support/today ────────────────────────────────────────────
        [HttpGet("today")]
        public async Task<IActionResult> GetTodaySupport()
        {
            var result = await _supportService.GetTodaySupportAsync(User.GetUserId());
            return Ok(result);
        }

        // ── DELETE /api/support/{id} ──────────────────────────────────────────
        [HttpDelete("{supportId}")]
        public async Task<IActionResult> DeleteSupport(int supportId)
        {
            var success = await _supportService.DeleteSupportAsync(User.GetUserId(), supportId);
            return success ? NoContent() : NotFound();
        }

        // ── GET /api/support/my-assignment (Feature 3) ────────────────────────
        // Employee calls this when opening the support log form.
        // Returns their assigned engineer (if any) so the form can pre-fill it.
        [HttpGet("my-assignment")]
        public async Task<IActionResult> GetMyAssignment()
        {
            var result = await _supportService.GetMyAssignmentAsync(User.GetUserId());
            return Ok(result);
        }

        // ═══════════════════════════════════════════════════════════════════════
        // ASSIGNMENT MANAGEMENT (Feature 3) — Manager only
        // ═══════════════════════════════════════════════════════════════════════

        // ── GET /api/support/assignments ──────────────────────────────────────
        [HttpGet("assignments"), Authorize(Roles = "Manager,TeamLead")]
        public async Task<IActionResult> GetAllAssignments()
        {
            var result = await _assignmentService.GetAllAsync();
            return Ok(result);
        }

        // ── POST /api/support/assignments ─────────────────────────────────────
        [HttpPost("assignments"), Authorize(Roles = "Manager,TeamLead")]
        public async Task<IActionResult> CreateAssignment([FromBody] CreateSupportAssignmentDto dto)
        {
            var result = await _assignmentService.AssignAsync(User.GetUserId(), dto);
            return Ok(result);
        }

        // ── DELETE /api/support/assignments/{id} ──────────────────────────────
        [HttpDelete("assignments/{id:int}"), Authorize(Roles = "Manager,TeamLead")]
        public async Task<IActionResult> DeactivateAssignment(int id)
        {
            var success = await _assignmentService.DeactivateAsync(User.GetUserId(), id);
            return success ? NoContent() : NotFound();
        }

        // ── GET /api/support/media/{id} (unchanged) ───────────────────────────
        [HttpGet("media/{mediaId:int}")]
        public async Task<IActionResult> GetMedia(int mediaId)
        {
            var userId = User.GetUserId();
            var isManager = User.IsInRole("Manager");

            var evidence = await _db.MediaEvidences
                .Include(m => m.SupportLog)
                .ThenInclude(s => s!.DailyLog)
                .FirstOrDefaultAsync(m => m.Id == mediaId);

            if (evidence?.SupportLog?.DailyLog == null) return NotFound();

            var ownerId = evidence.SupportLog!.DailyLog!.UserId;
            if (!isManager && userId != ownerId) return Forbid();

            var fileInfo = await _mediaStorage.GetMediaFileInfoAsync(mediaId);
            if (fileInfo == null) return NotFound();

            var (fullPath, mimeType, fileName) = fileInfo.Value;
            return PhysicalFile(fullPath, mimeType, fileName, enableRangeProcessing: true);
        }
    }
}