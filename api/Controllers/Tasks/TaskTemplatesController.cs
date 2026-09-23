using DailyTrackerAPI.DTOs;
using DailyTrackerAPI.Helpers;
using DailyTrackerAPI.Services.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace DailyTrackerAPI.Controllers.Tasks
{
    // ─── Task Templates Controller ────────────────────────────────────────────
    [ApiController, Route("api/task-templates"), Authorize]
    public class TaskTemplatesController : ControllerBase
    {
        private readonly ITaskTemplateService _templateSvc;
        public TaskTemplatesController(ITaskTemplateService templateSvc) => _templateSvc = templateSvc;

        [HttpGet]
        public async Task<IActionResult> GetAll()
        {
            var list = await _templateSvc.GetMyTemplatesAsync(User.GetUserId());
            return Ok(list);
        }

        [HttpGet("recurring")]
        public async Task<IActionResult> GetTodaysRecurring()
        {
            var list = await _templateSvc.GetTodaysRecurringAsync(User.GetUserId());
            return Ok(list);
        }

        [HttpPost]
        public async Task<IActionResult> Create([FromBody] CreateTemplateDto dto)
        {
            var template = await _templateSvc.CreateAsync(User.GetUserId(), dto);
            return Ok(template);
        }

        [HttpPost("{templateId}/use/{dailyLogId}")]
        public async Task<IActionResult> UseTemplate(int templateId, int dailyLogId)
        {
            try
            {
                var task = await _templateSvc.CreateFromTemplateAsync(User.GetUserId(), templateId, dailyLogId);
                return Ok(task);
            }
            catch (KeyNotFoundException ex) { return NotFound(new { message = ex.Message }); }
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> Delete(int id)
        {
            await _templateSvc.DeleteAsync(id, User.GetUserId());
            return Ok(new { message = "Template deleted." });
        }
    }
}
