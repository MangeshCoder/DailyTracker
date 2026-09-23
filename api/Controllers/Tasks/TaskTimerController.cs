using DailyTrackerAPI.Helpers;
using DailyTrackerAPI.Services.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace DailyTrackerAPI.Controllers.Tasks
{
    // ─── Task Timer Controller ────────────────────────────────────────────────
    [ApiController, Route("api/task-timer"), Authorize]
    public class TaskTimerController : ControllerBase
    {
        private readonly ITaskTimerService _timerSvc;
        public TaskTimerController(ITaskTimerService timerSvc) => _timerSvc = timerSvc;

        [HttpPost("{taskId}/start")]
        public async Task<IActionResult> Start(int taskId)
        {
            try
            {
                var timer = await _timerSvc.StartTimerAsync(taskId, User.GetUserId());
                return Ok(timer);
            }
            catch (KeyNotFoundException ex) { return NotFound(new { message = ex.Message }); }
        }

        [HttpPost("{taskId}/stop")]
        public async Task<IActionResult> Stop(int taskId)
        {
            try
            {
                var timer = await _timerSvc.StopTimerAsync(taskId, User.GetUserId());
                return Ok(timer);
            }
            catch (InvalidOperationException ex) { return BadRequest(new { message = ex.Message }); }
        }

        [HttpGet("active")]
        public async Task<IActionResult> GetActive()
        {
            var timer = await _timerSvc.GetActiveTimerAsync(User.GetUserId());
            return Ok(timer);
        }
    }
}
