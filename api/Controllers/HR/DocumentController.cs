// ─────────────────────────────────────────────────────────────────────────────
//
//  Endpoints:
//    POST   /api/documents                      → upload document (multipart/form-data)
//    GET    /api/documents/my                   → own + public documents
//    GET    /api/documents/all                  → all documents (Manager/TeamLead)
//    GET    /api/documents/user/{userId}         → documents for specific user (Manager/TL)
//    GET    /api/documents/summary              → stats summary
//    GET    /api/documents/{id}                 → single document metadata
//    PUT    /api/documents/{id}                 → update metadata
//    DELETE /api/documents/{id}                 → delete document + file
//    GET    /api/documents/{id}/download        → stream file download (auth required)
// ─────────────────────────────────────────────────────────────────────────────

using DailyTrackerAPI.DTOs;
using DailyTrackerAPI.Helpers;
using DailyTrackerAPI.Services.HR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace DailyTrackerAPI.Controllers.HR
{
    [ApiController, Route("api/documents"), Authorize]
    public class DocumentController : ControllerBase
    {
        private readonly IDocumentService _svc;

        public DocumentController(IDocumentService svc) => _svc = svc;

        // ── POST /api/documents ───────────────────────────────────────────────
        /// <summary>
        /// Upload a document. Use multipart/form-data.
        /// Fields: Title*, Description, Category, OwnerUserId (0 = self),
        ///         IsPublic, ExpiresAt, file* (the actual file)
        /// </summary>
        [HttpPost]
        [RequestSizeLimit(25 * 1024 * 1024)] // 25 MB max per request
        [Consumes("multipart/form-data")]
        public async Task<IActionResult> Upload(
            [FromForm] UploadDocumentDto dto,
            [FromForm] IFormFile? file)
        {
            if (file == null)
                return BadRequest(new { message = "No file attached." });

            try
            {
                var result = await _svc.UploadAsync(
                    User.GetUserId(),
                    User.FindFirst(System.Security.Claims.ClaimTypes.Role)?.Value ?? "Developer",
                    dto,
                    file);

                return Ok(result);
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }

        // ── GET /api/documents/my ─────────────────────────────────────────────
        [HttpGet("my")]
        public async Task<IActionResult> GetMy()
        {
            var docs = await _svc.GetMyDocumentsAsync(User.GetUserId());
            return Ok(docs);
        }

        // ── GET /api/documents/all ────────────────────────────────────────────
        [HttpGet("all"), Authorize(Roles = "Manager,TeamLead")]
        public async Task<IActionResult> GetAll()
        {
            var docs = await _svc.GetAllDocumentsAsync();
            return Ok(docs);
        }

        // ── GET /api/documents/user/{userId} ──────────────────────────────────
        [HttpGet("user/{userId:int}"), Authorize(Roles = "Manager,TeamLead")]
        public async Task<IActionResult> GetForUser(int userId)
        {
            var docs = await _svc.GetDocumentsForUserAsync(userId);
            return Ok(docs);
        }

        // ── GET /api/documents/summary ────────────────────────────────────────
        [HttpGet("summary")]
        public async Task<IActionResult> GetSummary()
        {
            var role = User.FindFirst(System.Security.Claims.ClaimTypes.Role)?.Value ?? "Developer";
            var summary = await _svc.GetSummaryAsync(User.GetUserId(), role);
            return Ok(summary);
        }

        // ── GET /api/documents/{id} ───────────────────────────────────────────
        [HttpGet("{id:int}")]
        public async Task<IActionResult> GetOne(int id)
        {
            var role = User.FindFirst(System.Security.Claims.ClaimTypes.Role)?.Value ?? "Developer";
            var doc = await _svc.GetDocumentAsync(id, User.GetUserId(), role);
            return doc == null ? NotFound() : Ok(doc);
        }

        // ── PUT /api/documents/{id} ───────────────────────────────────────────
        [HttpPut("{id:int}")]
        public async Task<IActionResult> Update(int id, [FromBody] UpdateDocumentDto dto)
        {
            var role = User.FindFirst(System.Security.Claims.ClaimTypes.Role)?.Value ?? "Developer";
            var result = await _svc.UpdateAsync(id, User.GetUserId(), role, dto);
            return result == null ? NotFound() : Ok(result);
        }

        // ── DELETE /api/documents/{id} ────────────────────────────────────────
        [HttpDelete("{id:int}")]
        public async Task<IActionResult> Delete(int id)
        {
            var role = User.FindFirst(System.Security.Claims.ClaimTypes.Role)?.Value ?? "Developer";
            var ok = await _svc.DeleteAsync(id, User.GetUserId(), role);
            return ok ? NoContent() : NotFound();
        }

        // ── GET /api/documents/{id}/download ──────────────────────────────────
        /// <summary>
        /// Streams the file to the client.
        /// Auth required — employees can only download their own / public docs.
        /// Content-Disposition: attachment forces browser save-as dialog.
        /// </summary>
        [HttpGet("{id:int}/download")]
        public async Task<IActionResult> Download(int id)
        {
            var role = User.FindFirst(System.Security.Claims.ClaimTypes.Role)?.Value ?? "Developer";
            var info = await _svc.GetFileInfoAsync(id, User.GetUserId(), role);

            if (info == null) return NotFound();

            var (fullPath, mimeType, fileName) = info.Value;

            var stream = new FileStream(fullPath, FileMode.Open, FileAccess.Read, FileShare.Read);
            return File(stream, mimeType, fileName);
        }
    }
}