using DailyTrackerAPI.DTOs;
using DailyTrackerAPI.Helpers;
using DailyTrackerAPI.Services.Team;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace DailyTrackerAPI.Controllers.Team
{
    // ─── Performance Review Controller ───────────────────────────────────────
    //
    // SHARED (all roles):
    //   GET  /api/reviews/cycles              → all cycles I'm involved in
    //   GET  /api/reviews/cycles/{id}         → single cycle detail
    //   GET  /api/reviews/my                  → my reviews as an employee
    //   GET  /api/reviews/{id}                → single review detail
    //   PUT  /api/reviews/{id}/self-assessment → submit my self-assessment
    //
    // MANAGER ONLY:
    //   POST /api/reviews/cycles              → create new cycle
    //   PUT  /api/reviews/cycles/{id}/close   → close cycle
    //   GET  /api/reviews/team                → all team reviews (optionally filter by cycle)
    //   PUT  /api/reviews/{id}/manager-review → submit manager review + ratings
    // ─────────────────────────────────────────────────────────────────────────
    [ApiController, Route("api/reviews"), Authorize]
    public class PerformanceReviewController : ControllerBase
    {
        private readonly IPerformanceReviewService _svc;
        public PerformanceReviewController(IPerformanceReviewService svc) => _svc = svc;

        // ── SHARED ────────────────────────────────────────────────────────────

        [HttpGet("cycles")]
        public async Task<IActionResult> GetCycles()
        {
            var cycles = await _svc.GetCyclesAsync(User.GetUserId());
            return Ok(cycles);
        }

        [HttpGet("cycles/{id:int}")]
        public async Task<IActionResult> GetCycle(int id)
        {
            var cycle = await _svc.GetCycleByIdAsync(id, User.GetUserId());
            return cycle == null ? NotFound() : Ok(cycle);
        }

        [HttpGet("my")]
        public async Task<IActionResult> GetMyReviews()
        {
            var reviews = await _svc.GetMyReviewsAsync(User.GetUserId());
            return Ok(reviews);
        }

        [HttpGet("{id:int}")]
        public async Task<IActionResult> GetReview(int id)
        {
            var review = await _svc.GetMyReviewAsync(id, User.GetUserId());
            return review == null ? NotFound() : Ok(review);
        }

        [HttpPut("{id:int}/self-assessment")]
        public async Task<IActionResult> SubmitSelfAssessment(
            int id, [FromBody] SubmitSelfAssessmentDto dto)
        {
            var review = await _svc.SubmitSelfAssessmentAsync(id, User.GetUserId(), dto);
            if (review == null)
                return BadRequest(new { message = "Review not found, already reviewed, or cycle is closed." });
            return Ok(review);
        }

        // ── MANAGER ONLY ──────────────────────────────────────────────────────

        [HttpPost("cycles"), Authorize(Roles = "Manager,TeamLead")]
        public async Task<IActionResult> CreateCycle([FromBody] CreateReviewCycleDto dto)
        {
            var cycle = await _svc.CreateCycleAsync(User.GetUserId(), dto);
            return CreatedAtAction(nameof(GetCycle), new { id = cycle.Id }, cycle);
        }

        [HttpPut("cycles/{id:int}/close"), Authorize(Roles = "Manager,TeamLead")]
        public async Task<IActionResult> CloseCycle(int id)
        {
            var cycle = await _svc.CloseCycleAsync(id, User.GetUserId());
            return cycle == null ? Forbid() : Ok(cycle);
        }

        [HttpGet("team"), Authorize(Roles = "Manager,TeamLead")]
        public async Task<IActionResult> GetTeamReviews([FromQuery] int? cycleId = null)
        {
            var reviews = await _svc.GetTeamReviewsAsync(User.GetUserId(), cycleId);
            return Ok(reviews);
        }

        [HttpPut("{id:int}/manager-review"), Authorize(Roles = "Manager,TeamLead")]
        public async Task<IActionResult> SubmitManagerReview(
            int id, [FromBody] SubmitManagerReviewDto dto)
        {
            var review = await _svc.SubmitManagerReviewAsync(id, User.GetUserId(), dto);
            if (review == null)
                return BadRequest(new { message = "Review not found, pending self-assessment, or cycle is closed." });
            return Ok(review);
        }
    }
}
