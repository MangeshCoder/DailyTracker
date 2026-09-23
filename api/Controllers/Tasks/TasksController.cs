using DailyTrackerAPI.DTOs;
using DailyTrackerAPI.Helpers;
using DailyTrackerAPI.Services.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace DailyTrackerAPI.Controllers.Tasks
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class TasksController : ControllerBase
    {
        private readonly ITaskService _taskService;
        public TasksController(ITaskService taskService) { _taskService = taskService; }

        [HttpPost]
        public async Task<IActionResult> CreateTask([FromBody] CreateTaskDto dto)
        {
            var result = await _taskService.CreateTaskAsync(User.GetUserId(), dto);
            if (result == null) return BadRequest(new { message = "Please check in first before logging tasks." });
            return Ok(result);
        }

        [HttpPut("{taskId}")]
        public async Task<IActionResult> UpdateTask(int taskId, [FromBody] UpdateTaskDto dto)
        {
            var result = await _taskService.UpdateTaskAsync(User.GetUserId(), taskId, dto);
            if (result == null) return NotFound();
            return Ok(result);
        }

        [HttpDelete("{taskId}")]
        public async Task<IActionResult> DeleteTask(int taskId)
        {
            var success = await _taskService.DeleteTaskAsync(User.GetUserId(), taskId);
            return success ? NoContent() : NotFound();
        }

        [HttpGet("today")]
        public async Task<IActionResult> GetTodayTasks()
        {
            var result = await _taskService.GetTodayTasksAsync(User.GetUserId());
            return Ok(result);
        }

        [HttpGet("date/{date}")]
        public async Task<IActionResult> GetTasksByDate(DateTime date)
        {
            var result = await _taskService.GetTasksByDateAsync(User.GetUserId(), date);
            return Ok(result);
        }
    }
}
