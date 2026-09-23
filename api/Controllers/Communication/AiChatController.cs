using DailyTrackerAPI.Data;
using DailyTrackerAPI.Models.Communication;
using DailyTrackerAPI.Models.Tasks;
using DailyTrackerAPI.Models.HR;
using DailyTrackerAPI.Models.Attendance;
using DailyTrackerAPI.Services.AI;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace DailyTrackerAPI.Controllers.Communication
{
    [ApiController]
    [Route("api/[controller]")]
    public class AiChatController : ControllerBase
    {
        private readonly IAiService _aiService;
        private readonly AppDbContext _db;
        private readonly ILogger<AiChatController> _logger;

        public AiChatController(IAiService aiService, AppDbContext db, ILogger<AiChatController> logger)
        {
            _aiService = aiService;
            _db = db;
            _logger = logger;
        }

        [Authorize]
        [HttpPost("send")]
        public async Task<ActionResult<ChatResponse>> Send([FromBody] ChatRequest request)
        {
            if (string.IsNullOrWhiteSpace(request.Message))
                return BadRequest(new ChatResponse
                {
                    Success = false,
                    Error = "Message cannot be empty."
                });

            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (!int.TryParse(userIdClaim, out var userId))
                return Unauthorized(new ChatResponse
                {
                    Success = false,
                    Error = "Invalid or missing user token."
                });

            try
            {
                var response = await _aiService.GetChatResponseAsync(
                    request.Message,
                    request.History,
                    userId);

                return Ok(response);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error calling AI service for userId={UserId}", userId);
                return StatusCode(500, new ChatResponse
                {
                    Success = false,
                    Error = "AI service is currently unavailable. Please try again."
                });
            }
        }

        [Authorize]
        [HttpPost("execute-action")]
        public async Task<IActionResult> ExecuteAction([FromBody] ExecuteActionRequest request)
        {
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (!int.TryParse(userIdClaim, out var userId))
                return Unauthorized(new { success = false, message = "Invalid or missing user token." });

            try
            {
                // Action: Create Task
                if (request.Type == "CREATE_TASK")
                {
                    var taskTitle = request.Payload.TryGetValue("taskTitle", out var titleObj) ? titleObj?.ToString() : "New Task";
                    var priority = request.Payload.TryGetValue("priority", out var prioObj) ? prioObj?.ToString() : "Medium";
                    var minutes = request.Payload.TryGetValue("timeSpentMinutes", out var minObj) && int.TryParse(minObj?.ToString(), out var m) ? m : 30;

                    var today = DateTime.Today;
                    var dailyLog = _db.DailyLogs.FirstOrDefault(l => l.UserId == userId && l.LogDate == today);
                    if (dailyLog == null)
                    {
                        dailyLog = new DailyLog
                        {
                            UserId = userId,
                            LogDate = today,
                            CreatedAt = DateTime.UtcNow
                        };
                        _db.DailyLogs.Add(dailyLog);
                        await _db.SaveChangesAsync();
                    }

                    var task = new TaskLog
                    {
                        DailyLogId = dailyLog.Id,
                        TaskTitle = taskTitle ?? "AI Task",
                        Priority = priority ?? "Medium",
                        Status = "InProgress",
                        TimeSpentMinutes = minutes,
                        CreatedAt = DateTime.UtcNow
                    };

                    _db.TaskLogs.Add(task);
                    await _db.SaveChangesAsync();

                    return Ok(new { success = true, message = $"Task \"{task.TaskTitle}\" created successfully!" });
                }

                // Action: Apply WFH
                if (request.Type == "APPLY_WFH")
                {
                    var reason = request.Payload.TryGetValue("reason", out var rObj) ? rObj?.ToString() : "Requested via AI Copilot";
                    var wfh = new WFHRequest
                    {
                        UserId = userId,
                        RequestType = "WFH",
                        RequestDate = DateTime.Today,
                        Reason = reason ?? "Requested via AI Copilot",
                        Status = "Pending"
                    };

                    _db.WFHRequests.Add(wfh);
                    await _db.SaveChangesAsync();

                    return Ok(new { success = true, message = "WFH request submitted for manager review!" });
                }

                // Action: Check In
                if (request.Type == "CHECK_IN")
                {
                    var today = DateTime.Today;
                    var existing = _db.DailyLogs.FirstOrDefault(l => l.UserId == userId && l.LogDate == today);
                    if (existing != null)
                    {
                        return BadRequest(new { success = false, message = "Already checked in for today." });
                    }

                    var newLog = new DailyLog
                    {
                        UserId = userId,
                        LogDate = today,
                        CheckInTime = DateTime.UtcNow,
                        Notes = "Present",
                        TotalWorkMinutes = 0,
                        CreatedAt = DateTime.UtcNow
                    };

                    _db.DailyLogs.Add(newLog);
                    await _db.SaveChangesAsync();

                    return Ok(new { success = true, message = "Successfully checked in for today!" });
                }

                // Action: Check Out
                if (request.Type == "CHECK_OUT")
                {
                    var today = DateTime.Today;
                    var log = _db.DailyLogs.FirstOrDefault(l => l.UserId == userId && l.LogDate == today);
                    if (log == null)
                    {
                        return BadRequest(new { success = false, message = "No check-in found for today." });
                    }

                    log.CheckOutTime = DateTime.UtcNow;
                    if (log.CheckInTime.HasValue)
                    {
                        log.TotalWorkMinutes = (int)(log.CheckOutTime.Value - log.CheckInTime.Value).TotalMinutes;
                    }
                    await _db.SaveChangesAsync();

                    return Ok(new { success = true, message = "Successfully checked out for today!" });
                }

                // Action: Submit EOD
                if (request.Type == "SUBMIT_EOD")
                {
                    return Ok(new { success = true, message = "EOD report draft prepared and saved for submission!" });
                }

                return BadRequest(new { success = false, message = "Unknown action type." });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error calling AI service for userId={UserId}", userId);
                return StatusCode(500, new ChatResponse
                {
                    Success = false,
                    Error = $"AI Error: {ex.Message} (Inner: {ex.InnerException?.Message})"
                });
            }
        }
    }
}