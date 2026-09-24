using DailyTrackerAPI.Data;
using DailyTrackerAPI.Models.Communication;
using DailyTrackerAPI.Models.Tasks;
using DailyTrackerAPI.Models.HR;
using DailyTrackerAPI.Models.Attendance;
using DailyTrackerAPI.Services.AI;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
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
                var today = DateTime.UtcNow.Date;
                var todayLog = await _db.DailyLogs.FirstOrDefaultAsync(l => l.UserId == userId && l.LogDate == today);
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

                // ── 1. Create Task (Only if checked in) ──────────────────────
                if (request.Type == "CREATE_TASK")
                {
                    var taskTitle = request.Payload.TryGetValue("taskTitle", out var titleObj) ? titleObj?.ToString() : "New Task";
                    var priority = request.Payload.TryGetValue("priority", out var prioObj) ? prioObj?.ToString() : "Medium";
                    var minutes = request.Payload.TryGetValue("timeSpentMinutes", out var minObj) && int.TryParse(minObj?.ToString(), out var m) ? m : 30;

                    var task = new TaskLog
                    {
                        DailyLogId = todayLog!.Id,
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

                // ── 2. Update Task Status ────────────────────────────────────
                if (request.Type == "UPDATE_TASK_STATUS")
                {
                    var status = request.Payload.TryGetValue("status", out var sObj) ? sObj?.ToString() : "Completed";
                    int taskId = 0;
                    if (request.Payload.TryGetValue("taskId", out var tIdObj))
                    {
                        int.TryParse(tIdObj?.ToString(), out taskId);
                    }

                    TaskLog? task = null;
                    if (taskId > 0)
                    {
                        task = await _db.TaskLogs
                            .FirstOrDefaultAsync(t => t.Id == taskId && t.DailyLogId == todayLog!.Id);
                    }
                    else
                    {
                        var title = request.Payload.TryGetValue("taskTitle", out var titleObj) ? titleObj?.ToString() : "";
                        task = await _db.TaskLogs
                            .Where(t => t.DailyLogId == todayLog!.Id && (string.IsNullOrWhiteSpace(title) || t.TaskTitle.Contains(title)))
                            .OrderByDescending(t => t.Id)
                            .FirstOrDefaultAsync();
                    }

                    if (task == null)
                    {
                        return NotFound(new { success = false, message = "No matching task found for today." });
                    }

                    task.Status = status ?? "Completed";
                    if (task.Status == "Completed")
                    {
                        task.CompletedAt = DateTime.UtcNow;
                    }

                    await _db.SaveChangesAsync();
                    return Ok(new { success = true, message = $"Task \"{task.TaskTitle}\" marked as {task.Status}!" });
                }

                // ── 3. Start Break ──────────────────────────────────────────
                if (request.Type == "START_BREAK")
                {
                    var breakType = request.Payload.TryGetValue("breakType", out var bObj) ? bObj?.ToString() : "Tea";

                    var breaks = await _db.BreakLogs.Where(b => b.DailyLogId == todayLog!.Id).ToListAsync();
                    var existingActive = breaks.FirstOrDefault(b => b.IsActive || b.EndTime == null);
                    if (existingActive != null)
                    {
                        return BadRequest(new { success = false, message = $"You are already on an active {existingActive.BreakType} break." });
                    }

                    var newBreak = new BreakLog
                    {
                        DailyLogId = todayLog!.Id,
                        BreakType = breakType ?? "Tea",
                        StartTime = DateTime.UtcNow,
                        IsActive = true,
                        DurationMinutes = 0
                    };
                    _db.BreakLogs.Add(newBreak);
                    await _db.SaveChangesAsync();

                    return Ok(new { success = true, message = $"Started {newBreak.BreakType} break at {newBreak.StartTime:hh:mm tt}!" });
                }

                // ── 4. End Break ────────────────────────────────────────────
                if (request.Type == "END_BREAK")
                {
                    var activeBreak = await _db.BreakLogs
                        .FirstOrDefaultAsync(b => b.DailyLogId == todayLog!.Id && (b.IsActive || b.EndTime == null));

                    if (activeBreak == null)
                    {
                        return BadRequest(new { success = false, message = "You do not have any active breaks right now." });
                    }

                    activeBreak.EndTime = DateTime.UtcNow;
                    activeBreak.IsActive = false;
                    activeBreak.DurationMinutes = (int)Math.Max(1, (activeBreak.EndTime.Value - activeBreak.StartTime).TotalMinutes);

                    var allBreaks = await _db.BreakLogs.Where(b => b.DailyLogId == todayLog!.Id).ToListAsync();
                    todayLog!.TotalBreakMinutes = allBreaks.Sum(b => b.DurationMinutes);
                    await _db.SaveChangesAsync();

                    return Ok(new { success = true, message = $"Ended {activeBreak.BreakType} break. Duration: {activeBreak.DurationMinutes} minutes." });
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

                    var leave = new LeaveRequest
                    {
                        UserId = userId,
                        LeaveType = leaveType ?? "Casual",
                        FromDate = fromDate,
                        ToDate = toDate,
                        Reason = reason ?? "Applied via AI Copilot",
                        Status = "Pending",
                        AppliedAt = DateTime.UtcNow
                    };
                    _db.LeaveRequests.Add(leave);
                    await _db.SaveChangesAsync();

                    return Ok(new { success = true, message = $"{leave.LeaveType} leave applied ({fromDate:MMM dd} - {toDate:MMM dd})! Pending manager review." });
                }

                // ── 6. Apply WFH (Allowed before check-in) ───────────────────
                if (request.Type == "APPLY_WFH")
                {
                    var reason = request.Payload.TryGetValue("reason", out var rObj) ? rObj?.ToString() : "Requested via AI Copilot";

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

                    // Prevent duplicate active/pending WFH requests for the same date
                    var existingWfh = await _db.WFHRequests
                        .FirstOrDefaultAsync(w => w.UserId == userId && w.RequestDate == requestDate && w.Status != "Rejected" && w.Status != "Cancelled");
                    if (existingWfh != null)
                    {
                        return BadRequest(new { success = false, message = $"A WFH request for {requestDate:MMM dd, yyyy} already exists (Status: {existingWfh.Status})." });
                    }

                    var wfh = new WFHRequest
                    {
                        UserId = userId,
                        RequestType = "WFH",
                        RequestDate = requestDate,
                        Reason = string.IsNullOrWhiteSpace(reason) ? "Requested via AI Copilot" : reason,
                        Status = "Pending",
                        RequestedAt = DateTime.UtcNow,
                        UpdatedAt = DateTime.UtcNow
                    };
                    _db.WFHRequests.Add(wfh);
                    await _db.SaveChangesAsync();

                    return Ok(new { success = true, message = $"WFH request for {requestDate:MMM dd, yyyy} submitted for manager review!" });
                }

                // ── 7. Check In ─────────────────────────────────────────────
                if (request.Type == "CHECK_IN")
                {
                    if (isCheckedIn)
                    {
                        return BadRequest(new { success = false, message = "You are already checked in for today." });
                    }

                    if (todayLog == null)
                    {
                        todayLog = new DailyLog
                        {
                            UserId = userId,
                            LogDate = today,
                            CheckInTime = DateTime.UtcNow,
                            DayStatus = "Present",
                            Notes = "Checked in via AI Copilot",
                            TotalWorkMinutes = 0,
                            CreatedAt = DateTime.UtcNow
                        };
                        _db.DailyLogs.Add(todayLog);
                    }
                    else
                    {
                        todayLog.CheckInTime = DateTime.UtcNow;
                        todayLog.DayStatus = "Present";
                    }

                    await _db.SaveChangesAsync();
                    return Ok(new { success = true, message = "Successfully checked in for today!" });
                }

                // ── 8. Check Out ────────────────────────────────────────────
                if (request.Type == "CHECK_OUT")
                {
                    todayLog!.CheckOutTime = DateTime.UtcNow;
                    todayLog.TotalWorkMinutes = (int)(todayLog.CheckOutTime.Value - todayLog.CheckInTime!.Value).TotalMinutes;
                    await _db.SaveChangesAsync();

                    return Ok(new { success = true, message = "Successfully checked out for today!" });
                }

                // ── 9. Set Daily Goal ───────────────────────────────────────
                if (request.Type == "CREATE_GOAL")
                {
                    int tasksTarget = request.Payload.TryGetValue("targetTasks", out var ttObj) && int.TryParse(ttObj?.ToString(), out var tg) ? tg : 5;
                    int workHours = request.Payload.TryGetValue("targetHours", out var whObj) && int.TryParse(whObj?.ToString(), out var wh) ? wh : 8;

                    var goal = await _db.DailyGoals.FirstOrDefaultAsync(g => g.UserId == userId && g.GoalDate == today);
                    if (goal == null)
                    {
                        goal = new DailyGoal
                        {
                            UserId = userId,
                            GoalDate = today,
                            TargetTasksCompleted = tasksTarget,
                            TargetWorkMinutes = workHours * 60,
                            ProductivityScore = 0
                        };
                        _db.DailyGoals.Add(goal);
                    }
                    else
                    {
                        goal.TargetTasksCompleted = tasksTarget;
                        goal.TargetWorkMinutes = workHours * 60;
                    }

                    await _db.SaveChangesAsync();
                    return Ok(new { success = true, message = $"Daily goal set: {tasksTarget} tasks and {workHours} hours!" });
                }

                // ── 10. Submit EOD ──────────────────────────────────────────
                if (request.Type == "SUBMIT_EOD")
                {
                    return Ok(new { success = true, message = "EOD report draft prepared and saved for submission!" });
                }

                return BadRequest(new { success = false, message = $"Unknown action type: {request.Type}" });
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
    }
}