using DailyTrackerAPI.Services.Team;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace DailyTrackerAPI.Controllers.Team
{
    [ApiController, Route("api/audit"), Authorize(Roles = "Manager")]
    public class AuditController : ControllerBase
    {
        private readonly IAuditService _auditSvc;
        public AuditController(IAuditService auditSvc) => _auditSvc = auditSvc;

        /// <summary>
        /// Get audit logs
        /// </summary>
        /// <param name="userId"></param>
        /// <param name="entity"></param>
        /// <param name="take"></param>
        /// <returns></returns>
        [HttpGet]
        public async Task<IActionResult> GetLogs(
            [FromQuery] int? userId, [FromQuery] string? entity, [FromQuery] int take = 50)
        {
            var logs = await _auditSvc.GetLogsAsync(userId, entity, take);
            return Ok(logs);
        }
    }
}
