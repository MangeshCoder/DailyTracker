//  All routes under: /api/training
//
//  TRAINING:
//    GET    /api/training/my                            → own trainings
//    GET    /api/training/all                           → all (Manager/TeamLead)
//    GET    /api/training/user/{userId}                 → specific user (Manager/TL)
//    GET    /api/training/stats                         → own stats
//    GET    /api/training/stats/team                    → team stats (Manager/TL)
//    POST   /api/training                               → create training
//    PUT    /api/training/{id}                          → update training
//    DELETE /api/training/{id}                          → delete training
//
//  CERTIFICATIONS:
//    GET    /api/training/certifications/my             → own certs
//    GET    /api/training/certifications/all            → all (Manager/TeamLead)
//    GET    /api/training/certifications/user/{userId}  → specific user
//    GET    /api/training/certifications/expiring       → expiring within 30 days
//    POST   /api/training/certifications                → create cert (multipart)
//    PUT    /api/training/certifications/{id}           → update cert metadata
//    DELETE /api/training/certifications/{id}           → delete cert + file
//    GET    /api/training/certifications/{id}/download  → stream file download
// ─────────────────────────────────────────────────────────────────────────────

using DailyTrackerAPI.DTOs;
using DailyTrackerAPI.Helpers;
using DailyTrackerAPI.Services.HR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace DailyTrackerAPI.Controllers.Tasks
{
    [ApiController, Route("api/training"), Authorize]
    public class TrainingController : ControllerBase
    {
        private readonly ITrainingService _svc;

        public TrainingController(ITrainingService svc) => _svc = svc;

        private string Role => User.FindFirstValue(ClaimTypes.Role) ?? "Developer";

        // ══════════════════════════════════════════════════════════════════════
        //  TRAINING ENDPOINTS
        // ══════════════════════════════════════════════════════════════════════

        [HttpGet("my")]
        public async Task<IActionResult> GetMyTrainings() =>
            Ok(await _svc.GetMyTrainingsAsync(User.GetUserId()));

        [HttpGet("all"), Authorize(Roles = "Manager,TeamLead")]
        public async Task<IActionResult> GetAllTrainings() =>
            Ok(await _svc.GetAllTrainingsAsync());

        [HttpGet("user/{userId:int}"), Authorize(Roles = "Manager,TeamLead")]
        public async Task<IActionResult> GetTrainingsForUser(int userId) =>
            Ok(await _svc.GetTrainingsForUserAsync(userId));

        [HttpGet("stats")]
        public async Task<IActionResult> GetMyStats() =>
            Ok(await _svc.GetMyStatsAsync(User.GetUserId()));

        [HttpGet("stats/team"), Authorize(Roles = "Manager,TeamLead")]
        public async Task<IActionResult> GetTeamStats() =>
            Ok(await _svc.GetTeamStatsAsync());

        [HttpPost]
        public async Task<IActionResult> Create([FromBody] CreateTrainingDto dto)
        {
            var result = await _svc.CreateTrainingAsync(User.GetUserId(), dto);
            return Ok(result);
        }

        [HttpPut("{id:int}")]
        public async Task<IActionResult> Update(int id, [FromBody] UpdateTrainingDto dto)
        {
            var result = await _svc.UpdateTrainingAsync(id, User.GetUserId(), Role, dto);
            return result == null ? NotFound() : Ok(result);
        }

        [HttpDelete("{id:int}")]
        public async Task<IActionResult> Delete(int id)
        {
            var ok = await _svc.DeleteTrainingAsync(id, User.GetUserId(), Role);
            return ok ? NoContent() : NotFound();
        }

        // ══════════════════════════════════════════════════════════════════════
        //  CERTIFICATION ENDPOINTS
        // ══════════════════════════════════════════════════════════════════════

        [HttpGet("certifications/my")]
        public async Task<IActionResult> GetMyCerts() =>
            Ok(await _svc.GetMyCertificationsAsync(User.GetUserId()));

        [HttpGet("certifications/all"), Authorize(Roles = "Manager,TeamLead")]
        public async Task<IActionResult> GetAllCerts() =>
            Ok(await _svc.GetAllCertificationsAsync());

        [HttpGet("certifications/user/{userId:int}"), Authorize(Roles = "Manager,TeamLead")]
        public async Task<IActionResult> GetCertsForUser(int userId) =>
            Ok(await _svc.GetCertificationsForUserAsync(userId));

        [HttpGet("certifications/expiring"), Authorize(Roles = "Manager,TeamLead")]
        public async Task<IActionResult> GetExpiring() =>
            Ok(await _svc.GetExpiringCertificationsAsync());

        /// <summary>
        /// Create certification with optional file. Use multipart/form-data.
        /// Fields: Name*, IssuingOrganization*, IssueDate*, ExpiryDate,
        ///         CredentialId, CredentialUrl, file (optional)
        /// </summary>
        [HttpPost("certifications")]
        [RequestSizeLimit(15 * 1024 * 1024)]
        [Consumes("multipart/form-data")]
        public async Task<IActionResult> CreateCert([FromForm] CreateCertFormRequest form)
        {
            var dto = new CreateCertificationDto
            {
                Name = form.Name,
                IssuingOrganization = form.IssuingOrganization,
                IssueDate = form.IssueDate,
                ExpiryDate = form.ExpiryDate,
                CredentialId = form.CredentialId,
                CredentialUrl = form.CredentialUrl,
            };

            try
            {
                var result = await _svc.CreateCertificationAsync(User.GetUserId(), dto, form.File);
                return Ok(result);
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }

        [HttpPut("certifications/{id:int}")]
        public async Task<IActionResult> UpdateCert(int id, [FromBody] UpdateCertificationDto dto)
        {
            var result = await _svc.UpdateCertificationAsync(id, User.GetUserId(), Role, dto);
            return result == null ? NotFound() : Ok(result);
        }

        [HttpDelete("certifications/{id:int}")]
        public async Task<IActionResult> DeleteCert(int id)
        {
            var ok = await _svc.DeleteCertificationAsync(id, User.GetUserId(), Role);
            return ok ? NoContent() : NotFound();
        }

        [HttpGet("certifications/{id:int}/download")]
        public async Task<IActionResult> DownloadCert(int id)
        {
            var info = await _svc.GetCertFileInfoAsync(id, User.GetUserId(), Role);
            if (info == null) return NotFound();

            var (fullPath, mimeType, fileName) = info.Value;
            var stream = new FileStream(fullPath, FileMode.Open, FileAccess.Read, FileShare.Read);
            return File(stream, mimeType, fileName);
        }
    }
}