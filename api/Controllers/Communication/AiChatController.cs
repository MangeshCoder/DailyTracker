using DailyTrackerAPI.Custom;
using DailyTrackerAPI.Data;
using DailyTrackerAPI.DTOs;
using DailyTrackerAPI.Models.Attendance;
using DailyTrackerAPI.Models.Communication;
using DailyTrackerAPI.Models.HR;
using DailyTrackerAPI.Models.Tasks;
using DailyTrackerAPI.Services.AI;
using DailyTrackerAPI.Services.Attendance;
using DailyTrackerAPI.Services.HR;
using DailyTrackerAPI.Services.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using DailyTrackerAPI.Helpers;

namespace DailyTrackerAPI.Controllers.Communication
{
    [ApiController]
    [Route("api/[controller]")]
    public class AiChatController : ControllerBase
    {
        private readonly IAiService _aiService;
        private readonly AppDbContext _db;
        private readonly ILeaveService _leaveService;
        private readonly IWFHRequestService _wfhService;
        private readonly ILogger<AiChatController> _logger;
        private readonly ITaskService _tasks;
        private readonly IBreakService _breaks;
        private readonly IGoalService _goals;

        public AiChatController(IAiService aiService, AppDbContext db, ILeaveService leaveService, IWFHRequestService wfhService, ILogger<AiChatController> logger,
            ITaskService tasks, IBreakService breaks, IGoalService goals)
        {
            _tasks = tasks;
            _breaks = breaks;
            _goals = goals;
            _aiService = aiService;
            _db = db;
            _leaveService = leaveService;
            _wfhService = wfhService;
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
        [HttpGet("context-summary")]
        public async Task<IActionResult> GetContextSummary()
        {
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (!int.TryParse(userIdClaim, out var userId))
                return Unauthorized(new { success = false, message = "Invalid user token." });

            try
            {
                var summary = await _aiService.GetUserContextSummaryAsync(userId);
                return Ok(new { success = true, summary });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to get AI user context summary");
                return StatusCode(500, new { success = false, message = "Failed to fetch context summary." });
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
                var today = AppClock.TodayIst;
                var todayLog = await _db.DailyLogs.CurrentForAsync(userId);
                bool isCheckedIn = todayLog != null && todayLog.CheckInTime != null;

                // ── STRICT ENFORCEMENT: Block work actions if not checked in ──
                var workActions = new HashSet<string>
                {
                    "CREATE_TASK",
                    "UPDATE_TASK_STATUS",
                    "START_BREAK",
                    "END_BREAK",
                    "CHECK_OUT",
                    "SUBMIT_EOD"
                };

                if (workActions.Contains(request.Type) && !isCheckedIn)
                {
                    return BadRequest(new
                    {
                        success = false,
                        message = "Please check in first! You must check in before logging tasks, taking breaks, or checking out."
                    });
                }

                // ── 1–4. Tasks and breaks: the same services (and rules) as the normal screens ──
                string Text(string key, string fallback) =>
                    request.Payload.TryGetValue(key, out var v) && !string.IsNullOrWhiteSpace(v?.ToString()) ? v!.ToString()! : fallback;
                int Number(string key, int fallback) =>
                    request.Payload.TryGetValue(key, out var v) && int.TryParse(v?.ToString(), out var n) ? n : fallback;

                if (request.Type == "CREATE_TASK")
                {
                    var created = await _tasks.CreateTaskAsync(userId, new CreateTaskDto
                    {
                        TaskTitle = Text("taskTitle", "New Task"),
                        Priority = Text("priority", "Medium"),
                        Status = "InProgress",
                        TimeSpentMinutes = Number("timeSpentMinutes", 30),
                    });
                    return created == null
                        ? BadRequest(new { success = false, message = "Please check in first before logging tasks." })
                        : Ok(new { success = true, message = $"Task \"{created.TaskTitle}\" created successfully!" });
                }

                if (request.Type == "UPDATE_TASK_STATUS")
                {
                    var taskId = Number("taskId", 0);
                    if (taskId <= 0)
                    {
                        var title = Text("taskTitle", "");
                        taskId = await _db.TaskLogs
                            .Where(t => t.DailyLogId == todayLog!.Id && (title == "" || t.TaskTitle.Contains(title)))
                            .OrderByDescending(t => t.Id)
                            .Select(t => t.Id)
                            .FirstOrDefaultAsync();
                    }
                    var updated = taskId > 0
                        ? await _tasks.UpdateTaskAsync(userId, taskId, new UpdateTaskDto { Status = Text("status", "Completed") })
                        : null;
                    return updated == null
                        ? NotFound(new { success = false, message = "No matching task found for today." })
                        : Ok(new { success = true, message = $"Task \"{updated.TaskTitle}\" marked as {updated.Status}!" });
                }

                if (request.Type == "START_BREAK")
                {
                    var started = await _breaks.StartBreakAsync(userId, new StartBreakDto { BreakType = Text("breakType", "Tea") });
                    return started == null
                        ? BadRequest(new { success = false, message = "Please check in first before taking a break." })
                        : Ok(new { success = true, message = $"Started {started.BreakType} break!" });
                }

                if (request.Type == "END_BREAK")
                {
                    var activeId = await _db.BreakLogs
                        .Where(b => b.DailyLogId == todayLog!.Id && b.IsActive)
                        .Select(b => b.Id)
                        .FirstOrDefaultAsync();
                    var ended = activeId > 0 ? await _breaks.EndBreakAsync(userId, activeId) : null;
                    return ended == null
                        ? BadRequest(new { success = false, message = "You do not have any active breaks right now." })
                        : Ok(new { success = true, message = $"Ended {ended.BreakType} break. Duration: {ended.DurationMinutes} minutes." });
                }
                // ── 5. Apply Leave (Allowed before check-in) ─────────────────
                if (request.Type == "APPLY_LEAVE")
                {
                    var leaveType = request.Payload.TryGetValue("leaveType", out var ltObj) ? ltObj?.ToString() : "Casual";
                    var reason = request.Payload.TryGetValue("reason", out var rObj) ? rObj?.ToString() : "Applied via AI Copilot";

                    DateTime fromDate = today;
                    if (request.Payload.TryGetValue("fromDate", out var fObj) && DateTime.TryParse(fObj?.ToString(), out var parsedFrom))
                    {
                        fromDate = parsedFrom.Date;
                    }

                    DateTime toDate = fromDate;
                    if (request.Payload.TryGetValue("toDate", out var tObj) && DateTime.TryParse(tObj?.ToString(), out var parsedTo))
                    {
                        toDate = parsedTo.Date;
                    }

                    if (fromDate > toDate)
                    {
                        return BadRequest(new { success = false, message = "From date cannot be after To date." });
                    }

                    try
                    {
                        var dto = new ApplyLeaveDto
                        {
                            FromDate = fromDate,
                            ToDate = toDate,
                            LeaveType = leaveType ?? "Casual",
                            Reason = string.IsNullOrWhiteSpace(reason) ? "Applied via AI Copilot" : reason
                        };

                        var createdLeave = await _leaveService.ApplyAsync(userId, dto);

                        return Ok(new
                        {
                            success = true,
                            message = $"{createdLeave.LeaveType} leave request submitted ({fromDate:MMM dd} - {toDate:MMM dd})! {createdLeave.LeaveDays} working day(s). Manager notified.",
                            leave = createdLeave
                        });
                    }
                    catch (ValidationException vex)
                    {
                        return BadRequest(new { success = false, message = vex.Message });
                    }
                    catch (Exception ex)
                    {
                        return BadRequest(new { success = false, message = ex.Message });
                    }
                }

                // ── 6. Apply WFH (Allowed before check-in) ───────────────────
                if (request.Type == "APPLY_WFH")
                {
                    var reason = request.Payload.TryGetValue("reason", out var rObj) ? rObj?.ToString() : "Requested via AI Copilot";
                    var requestType = request.Payload.TryGetValue("requestType", out var rtObj) ? rtObj?.ToString() : "WFH";
                    var halfDaySlot = request.Payload.TryGetValue("halfDaySlot", out var slotObj) ? slotObj?.ToString() : null;

                    // Parse user-selected or AI-provided date, fallback to today
                    DateTime requestDate = today;
                    if (request.Payload.TryGetValue("requestDate", out var dObj) && DateTime.TryParse(dObj?.ToString(), out var parsedDate))
                    {
                        requestDate = parsedDate.Date;
                    }
                    else if (request.Payload.TryGetValue("date", out var altObj) && DateTime.TryParse(altObj?.ToString(), out var parsedAlt))
                    {
                        requestDate = parsedAlt.Date;
                    }

                    try
                    {
                        var dto = new CreateWFHRequestDto
                        {
                            RequestType = string.IsNullOrWhiteSpace(requestType) ? "WFH" : requestType,
                            RequestDate = requestDate,
                            HalfDaySlot = halfDaySlot,
                            Reason = string.IsNullOrWhiteSpace(reason) ? "Requested via AI Copilot" : reason
                        };

                        var createdWfh = await _wfhService.SubmitRequestAsync(userId, dto);

                        return Ok(new
                        {
                            success = true,
                            message = $"{createdWfh.RequestType} request for {requestDate:MMM dd, yyyy} submitted! Email notification sent to your manager.",
                            wfh = createdWfh
                        });
                    }
                    catch (InvalidOperationException ioEx)
                    {
                        return BadRequest(new { success = false, message = ioEx.Message });
                    }
                    catch (Exception ex)
                    {
                        return BadRequest(new { success = false, message = ex.Message });
                    }
                }

                // ── 7–8. Check in / out: only from the dashboard (face + office location are checked there)
                if (request.Type is "CHECK_IN" or "CHECK_OUT")
                    return BadRequest(new { success = false, message = "Please use the Check In / Check Out button — your face and location are verified there." });

                // ── 9. Set Daily Goal ───────────────────────────────────────
                if (request.Type == "CREATE_GOAL")
                {
                    int tasksTarget = Number("targetTasks", 5);
                    int workHours = Number("targetHours", 8);
                    await _goals.SetOrUpdateGoalAsync(userId, new SetGoalDto
                    {
                        TargetTasksCompleted = tasksTarget,
                        TargetWorkMinutes = workHours * 60,
                        TargetBreakMinutes = 60,
                    });
                    return Ok(new { success = true, message = $"Daily goal set: {tasksTarget} tasks and {workHours} hours!" });
                }
                // ── 10. Submit EOD ──────────────────────────────────────────
                if (request.Type == "SUBMIT_EOD")
                {
                    return BadRequest(new { success = false, message = "Please submit your EOD report from the EOD Reports page (AI Help can draft it for you there)." });   // used to say "saved" without saving anything
                }

                return BadRequest(new { success = false, message = $"Unknown action type: {request.Type}" });
            }
            catch (Exception ex) when (ex is Custom.ValidationException or InvalidOperationException)
            {
                // a rule of the normal screen said no (e.g. already checked out) — show why
                return BadRequest(new { success = false, message = ex.Message });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error executing action for userId={UserId}", userId);
                return StatusCode(500, new { success = false, message = $"Action execution failed: {ex.Message}" });
            }
        }

        [Authorize]
        [HttpGet("eod-draft")]
        public async Task<IActionResult> GetEodDraft()
        {
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (!int.TryParse(userIdClaim, out var userId))
                return Unauthorized(new { success = false, message = "Invalid user token." });

            try
            {
                var result = await _aiService.GenerateEodDraftAsync(userId);
                return Ok(result);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to generate AI EOD draft");
                return StatusCode(500, new { success = false, message = "Failed to generate EOD draft." });
            }
        }

        /// <summary>
        /// AI summary of the caller's team for the last <paramref name="days"/> days (Manager: everyone,
        /// team lead: their own people). The numbers are counted from the database; Gemini writes the text.
        /// </summary>
        [Authorize]
        [HttpGet("team-summary")]
        public async Task<IActionResult> GetTeamSummary([FromQuery] int days = 7)
        {
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (!int.TryParse(userIdClaim, out var userId))
                return Unauthorized(new { success = false, message = "Invalid user token." });

            var summary = await _aiService.GenerateTeamSummaryAsync(userId, days);
            return summary == null
                ? StatusCode(403, new { message = "The team summary is for managers and team leads." })
                : Ok(summary);
        }
    }
}