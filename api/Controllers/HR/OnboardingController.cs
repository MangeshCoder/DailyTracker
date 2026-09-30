using DailyTrackerAPI.DTOs;
using DailyTrackerAPI.Helpers;
using DailyTrackerAPI.Services.HR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace DailyTrackerAPI.Controllers.HR
{
    // ─────────────────────────────────────────────────────────────────────────
    //  Onboarding — a checklist for a new joiner's first days
    //    GET    /api/onboarding/my                → my checklist (204 if none)
    //    GET    /api/onboarding                   → my team's checklists (manager / team lead)
    //    GET    /api/onboarding/candidates        → recent joiners without one
    //    POST   /api/onboarding                   → start one { userId, buddyUserId? }
    //    PUT    /api/onboarding/{id}/buddy        → choose the buddy
    //    POST   /api/onboarding/{id}/tasks        → add a step
    //    DELETE /api/onboarding/{id}              → stop the checklist
    //    PUT    /api/onboarding/tasks/{taskId}    → tick / untick a step { done }
    //    DELETE /api/onboarding/tasks/{taskId}    → remove a step
    // ─────────────────────────────────────────────────────────────────────────
    [ApiController, Route("api/onboarding"), Authorize]
    public class OnboardingController : ControllerBase
    {
        private readonly IOnboardingService _onboarding;
        public OnboardingController(IOnboardingService onboarding) => _onboarding = onboarding;

        [HttpGet("my")]
        public async Task<IActionResult> Mine()
        {
            var plan = await _onboarding.GetMineAsync(User.GetUserId());
            return plan == null ? NoContent() : Ok(plan);
        }

        [HttpGet, Authorize(Roles = "Manager,TeamLead")]
        public async Task<IActionResult> Team() => Ok(await _onboarding.GetTeamAsync(User.GetUserId()));

        [HttpGet("candidates"), Authorize(Roles = "Manager,TeamLead")]
        public async Task<IActionResult> Candidates() => Ok(await _onboarding.GetCandidatesAsync(User.GetUserId()));

        [HttpPost, Authorize(Roles = "Manager,TeamLead")]
        public async Task<IActionResult> Start([FromBody] StartOnboardingDto dto) =>
            Ok(await _onboarding.StartAsync(User.GetUserId(), dto));

        [HttpPut("{id:int}/buddy"), Authorize(Roles = "Manager,TeamLead")]
        public async Task<IActionResult> SetBuddy(int id, [FromBody] SetBuddyDto dto) =>
            Ok(await _onboarding.SetBuddyAsync(User.GetUserId(), id, dto.BuddyUserId));

        [HttpPost("{id:int}/tasks"), Authorize(Roles = "Manager,TeamLead")]
        public async Task<IActionResult> AddTask(int id, [FromBody] AddOnboardingTaskDto dto) =>
            Ok(await _onboarding.AddTaskAsync(User.GetUserId(), id, dto));

        [HttpDelete("{id:int}"), Authorize(Roles = "Manager,TeamLead")]
        public async Task<IActionResult> Cancel(int id)
        {
            await _onboarding.CancelAsync(User.GetUserId(), id);
            return Ok(new { message = "Onboarding checklist removed." });
        }

        [HttpPut("tasks/{taskId:int}")]
        public async Task<IActionResult> Tick(int taskId, [FromBody] TickOnboardingTaskDto dto) =>
            Ok(await _onboarding.TickAsync(User.GetUserId(), taskId, dto.Done));

        [HttpDelete("tasks/{taskId:int}"), Authorize(Roles = "Manager,TeamLead")]
        public async Task<IActionResult> RemoveTask(int taskId) =>
            Ok(await _onboarding.RemoveTaskAsync(User.GetUserId(), taskId));
    }
}
