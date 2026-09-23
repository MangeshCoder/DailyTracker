using DailyTrackerAPI.Data;
using DailyTrackerAPI.Models.Communication;
using DailyTrackerAPI.Models.Tasks;
using DailyTrackerAPI.Models.Attendance;
using DailyTrackerAPI.Models.HR;
using Microsoft.EntityFrameworkCore;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;

namespace DailyTrackerAPI.Services.AI
{
    public interface IAiService
    {
        Task<ChatResponse> GetChatResponseAsync(string userMessage, List<MessageHistory> history, int userId);
        Task<object> GetUserContextSummaryAsync(int userId);
        Task<object> GenerateEodDraftAsync(int userId);
    }

    public class GeminiService : IAiService
    {
        private readonly HttpClient _httpClient;
        private readonly IConfiguration _configuration;
        private readonly AppDbContext _db;
        private readonly ILogger<GeminiService> _logger;
        private const string MODEL = "gemini-2.0-flash";

        public GeminiService(
            HttpClient httpClient,
            IConfiguration configuration,
            AppDbContext db,
            ILogger<GeminiService> logger)
        {
            _httpClient = httpClient;
            _configuration = configuration;
            _db = db;
            _logger = logger;
        }

        public async Task<object> GetUserContextSummaryAsync(int userId)
        {
            var today = DateTime.UtcNow.Date;
            var dailyLog = await _db.DailyLogs
                .Include(d => d.TaskLogs)
                .Include(d => d.BreakLogs)
                .FirstOrDefaultAsync(l => l.UserId == userId && l.LogDate == today);

            var activeBreak = dailyLog?.BreakLogs.FirstOrDefault(b => b.IsActive || b.EndTime == null);

            return new
            {
                isCheckedIn = dailyLog?.CheckInTime != null,
                checkInTime = dailyLog?.CheckInTime?.ToString("hh:mm tt"),
                isCheckedOut = dailyLog?.CheckOutTime != null,
                checkOutTime = dailyLog?.CheckOutTime?.ToString("hh:mm tt"),
                totalWorkMinutes = dailyLog?.TotalWorkMinutes ?? 0,
                tasksCount = dailyLog?.TaskLogs.Count ?? 0,
                completedTasksCount = dailyLog?.TaskLogs.Count(t => t.Status == "Completed") ?? 0,
                isOnBreak = activeBreak != null,
                activeBreakType = activeBreak?.BreakType,
                dayStatus = dailyLog?.DayStatus ?? "Not Started"
            };
        }

        public async Task<object> GenerateEodDraftAsync(int userId)
        {
            var today = DateTime.UtcNow.Date;
            var dailyLog = await _db.DailyLogs
                .Include(d => d.TaskLogs)
                .Include(d => d.BreakLogs)
                .Include(d => d.SupportLogs).ThenInclude(s => s.SupportedDeveloper)
                .FirstOrDefaultAsync(l => l.UserId == userId && l.LogDate == today);

            if (dailyLog == null || dailyLog.CheckInTime == null)
            {
                return new
                {
                    success = false,
                    message = "You have not checked in for today yet."
                };
            }

            var elapsed = (int)(DateTime.UtcNow - dailyLog.CheckInTime.Value).TotalMinutes;
            var breakMins = dailyLog.BreakLogs.Where(b => !b.IsActive && b.EndTime != null).Sum(b => b.DurationMinutes);
            var netMins = Math.Max(0, elapsed - breakMins);
            var hours = netMins / 60;
            var mins = netMins % 60;

            var completedTasks = dailyLog.TaskLogs.Where(t => t.Status == "Completed").ToList();
            var inProgressTasks = dailyLog.TaskLogs.Where(t => t.Status != "Completed").ToList();

            // Build Accomplishments
            var accomplishedSb = new StringBuilder();
            accomplishedSb.AppendLine($"• Total Work Hours: {hours}h {mins}m (Checked in at {dailyLog.CheckInTime.Value:hh:mm tt})");
            if (completedTasks.Any())
            {
                foreach (var t in completedTasks)
                {
                    accomplishedSb.AppendLine($"• Completed: {t.TaskTitle} ({t.TimeSpentMinutes}m)");
                }
            }
            else
            {
                accomplishedSb.AppendLine("• Worked on today's scheduled operational items.");
            }

            if (dailyLog.SupportLogs.Any())
            {
                foreach (var s in dailyLog.SupportLogs)
                {
                    accomplishedSb.AppendLine($"• Assisted {s.SupportedDeveloper?.FullName ?? "team member"} ({s.TimeSpentMinutes}m)");
                }
            }

            // Build Tomorrow's Plan from in-progress tasks
            var planSb = new StringBuilder();
            if (inProgressTasks.Any())
            {
                foreach (var t in inProgressTasks)
                {
                    planSb.AppendLine($"• Continue working on: {t.TaskTitle}");
                }
            }
            else
            {
                planSb.AppendLine("• Review sprint backlog and pick up upcoming milestone tickets.");
            }

            // Determine suggested mood rating
            var mood = "Good";
            if (completedTasks.Count >= 3 || (dailyLog.TaskLogs.Any() && completedTasks.Count == dailyLog.TaskLogs.Count))
            {
                mood = "Great";
            }
            else if (netMins >= 480 && completedTasks.Count == 0)
            {
                mood = "Tired";
            }

            return new
            {
                success = true,
                draft = new
                {
                    whatWasDone = accomplishedSb.ToString().TrimEnd(),
                    blockers = "",
                    planForTomorrow = planSb.ToString().TrimEnd(),
                    learnings = completedTasks.Any() ? "Made good progress on sprint milestones." : "",
                    moodRating = mood
                }
            };
        }

        public async Task<ChatResponse> GetChatResponseAsync(
            string userMessage,
            List<MessageHistory> history,
            int userId)
        {
            var today = DateTime.UtcNow.Date;
            var todayLog = await _db.DailyLogs
                .Include(d => d.TaskLogs)
                .Include(d => d.BreakLogs)
                .FirstOrDefaultAsync(l => l.UserId == userId && l.LogDate == today);
            bool isCheckedIn = todayLog != null && todayLog.CheckInTime != null;

            var actions = DetectClientActions(userMessage, userId, isCheckedIn);
            var apiKey = _configuration["Gemini:ApiKey"] ?? _configuration["GeminiApiKey"];

            string userContext = "User context unavailable.";
            try
            {
                if (userId > 0)
                {
                    userContext = await BuildUserContextAsync(userId);
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to build user context.");
            }

            // If API key is missing or blank, use smart local engine
            if (string.IsNullOrWhiteSpace(apiKey))
            {
                return new ChatResponse
                {
                    Reply = await GenerateSmartFallbackAsync(userMessage, actions, userId, isCheckedIn, todayLog),
                    Actions = actions,
                    Success = true
                };
            }

            try
            {
                var url = $"https://generativelanguage.googleapis.com/v1beta/models/{MODEL}:generateContent?key={apiKey}";
                var recentHistory = history.TakeLast(6).ToList();
                var contents = new List<object>();

                foreach (var msg in recentHistory)
                {
                    contents.Add(new
                    {
                        role = msg.Role.ToLower() == "assistant" ? "model" : "user",
                        parts = new[] { new { text = msg.Content } }
                    });
                }

                contents.Add(new
                {
                    role = "user",
                    parts = new[] { new { text = userMessage } }
                });

                var systemPrompt = $"""
                    You are the AI Copilot for Daily Tracker EMS.
                    Current date: {DateTime.Now:dddd, MMMM dd, yyyy}. Server time: {DateTime.Now:hh:mm tt}.

                    IMPORTANT GUIDELINES:
                    - Be direct, structured, and helpful. Format work hours as 'Xh Ym'.
                    - ALWAYS refer to the LIVE USER CONTEXT below for hours, tasks, attendance, leaves, and breaks.
                    - If the user is NOT checked in (CheckIn is 'Not Checked In') and tries to log tasks or breaks, tell them to check in first.
                    - For task creation, acknowledge that an action button to open the Add Task form has been provided.
                    - For EOD reports, provide a complete, clean bullet summary of today's achievements and hours.

                    LIVE USER CONTEXT:
                    {userContext}
                    """;

                var requestBody = new
                {
                    system_instruction = new { parts = new[] { new { text = systemPrompt } } },
                    contents,
                    generationConfig = new { maxOutputTokens = 800, temperature = 0.4 }
                };

                var json = JsonSerializer.Serialize(requestBody);
                var httpContent = new StringContent(json, Encoding.UTF8, "application/json");

                var response = await _httpClient.PostAsync(url, httpContent);
                var body = await response.Content.ReadAsStringAsync();

                if (!response.IsSuccessStatusCode)
                {
                    _logger.LogWarning("Gemini API error ({StatusCode}): {Body}", response.StatusCode, body);
                    return new ChatResponse
                    {
                        Reply = await GenerateSmartFallbackAsync(userMessage, actions, userId, isCheckedIn, todayLog),
                        Actions = actions,
                        Success = true
                    };
                }

                using var doc = JsonDocument.Parse(body);
                if (doc.RootElement.TryGetProperty("candidates", out var candidates) && candidates.GetArrayLength() > 0)
                {
                    var first = candidates[0];
                    if (first.TryGetProperty("content", out var resContent))
                    {
                        var replyText = resContent.GetProperty("parts")[0].GetProperty("text").GetString();
                        if (!string.IsNullOrWhiteSpace(replyText))
                        {
                            return new ChatResponse
                            {
                                Reply = replyText,
                                Actions = actions,
                                Success = true
                            };
                        }
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Gemini call exception.");
            }

            return new ChatResponse
            {
                Reply = await GenerateSmartFallbackAsync(userMessage, actions, userId, isCheckedIn, todayLog),
                Actions = actions,
                Success = true
            };
        }

        private List<SuggestedAction> DetectClientActions(string text, int userId, bool isCheckedIn)
        {
            var actions = new List<SuggestedAction>();
            var lower = text.ToLowerInvariant();

            // 1. Check In
            if ((lower.Contains("check in") || lower.Contains("clock in")) && !isCheckedIn)
            {
                actions.Add(new SuggestedAction
                {
                    Type = "CHECK_IN",
                    Title = "Check In for Today",
                    Payload = new Dictionary<string, object> { { "dayStatus", "Present" } }
                });
            }

            // 2. Apply WFH (with date selector payload)
            if (lower.Contains("wfh") && (lower.Contains("apply") || lower.Contains("request") || lower.Contains("want")))
            {
                actions.Add(new SuggestedAction
                {
                    Type = "APPLY_WFH",
                    Title = "Apply for Work From Home",
                    Payload = new Dictionary<string, object>
                    {
                        { "requestDate", DateTime.UtcNow.ToString("yyyy-MM-dd") },
                        { "reason", "Requested via AI Copilot" }
                    }
                });
            }

            // 3. Apply Leave (with date selector payload)
            if (lower.Contains("apply leave") || lower.Contains("take leave") || lower.Contains("want leave") || lower.Contains("sick leave") || lower.Contains("casual leave"))
            {
                var leaveType = lower.Contains("sick") ? "Sick" : lower.Contains("earned") ? "Earned" : "Casual";
                var defaultDate = DateTime.UtcNow.AddDays(1).ToString("yyyy-MM-dd");

                actions.Add(new SuggestedAction
                {
                    Type = "APPLY_LEAVE",
                    Title = $"Apply for {leaveType} Leave",
                    Payload = new Dictionary<string, object>
                    {
                        { "leaveType", leaveType },
                        { "fromDate", defaultDate },
                        { "toDate", defaultDate },
                        { "reason", "Requested via AI Copilot" }
                    }
                });
            }

            // Work actions allowed only when checked in
            if (isCheckedIn)
            {
                // Point 1: Create Task -> Redirect to Add Task Form
                if (lower.Contains("create task") || lower.Contains("log task") || lower.Contains("add task") || lower.Contains("new task"))
                {
                    actions.Add(new SuggestedAction
                    {
                        Type = "NAVIGATE",
                        Title = "Open Add Task Form",
                        Payload = new Dictionary<string, object>
                        {
                            { "path", "/tasks" },
                            { "action", "open_add_modal" }
                        }
                    });
                }

                // Point 4: Start Break -> Offer BOTH Tea and Lunch Breaks!
                if (lower.Contains("start break") || lower.Contains("take a break") || lower.Contains("tea break") || lower.Contains("lunch break"))
                {
                    if (lower.Contains("lunch"))
                    {
                        actions.Add(new SuggestedAction
                        {
                            Type = "START_BREAK",
                            Title = "Start Lunch Break",
                            Payload = new Dictionary<string, object> { { "breakType", "Lunch" } }
                        });
                    }
                    else if (lower.Contains("tea"))
                    {
                        actions.Add(new SuggestedAction
                        {
                            Type = "START_BREAK",
                            Title = "Start Tea Break",
                            Payload = new Dictionary<string, object> { { "breakType", "Tea" } }
                        });
                    }
                    else
                    {
                        // Show both options
                        actions.Add(new SuggestedAction
                        {
                            Type = "START_BREAK",
                            Title = "Start Tea Break",
                            Payload = new Dictionary<string, object> { { "breakType", "Tea" } }
                        });
                        actions.Add(new SuggestedAction
                        {
                            Type = "START_BREAK",
                            Title = "Start Lunch Break",
                            Payload = new Dictionary<string, object> { { "breakType", "Lunch" } }
                        });
                    }
                }

                // End Break
                if (lower.Contains("end break") || lower.Contains("finish break") || lower.Contains("resume work") || lower.Contains("back to work"))
                {
                    actions.Add(new SuggestedAction
                    {
                        Type = "END_BREAK",
                        Title = "End Active Break & Resume Work",
                        Payload = new Dictionary<string, object>()
                    });
                }

                // Point 2: Draft EOD -> Navigate to EOD Report Page
                if (lower.Contains("draft eod") || lower.Contains("submit eod") || lower.Contains("eod report"))
                {
                    actions.Add(new SuggestedAction
                    {
                        Type = "NAVIGATE",
                        Title = "Review & Submit EOD Report",
                        Payload = new Dictionary<string, object>
                        {
                            { "path", "/eod-reports" }
                        }
                    });
                }

                // Check Out
                if (lower.Contains("check out") || lower.Contains("clock out"))
                {
                    actions.Add(new SuggestedAction
                    {
                        Type = "CHECK_OUT",
                        Title = "Check Out for Today",
                        Payload = new Dictionary<string, object>()
                    });
                }
            }

            return actions;
        }

        private async Task<string> GenerateSmartFallbackAsync(
            string message,
            List<SuggestedAction> actions,
            int userId,
            bool isCheckedIn,
            DailyLog? todayLog)
        {
            var lower = message.ToLowerInvariant();

            // Point 5: Leave inquiries & history
            if (lower.Contains("leave") || lower.Contains("holiday"))
            {
                var userLeaves = await _db.LeaveRequests
                    .Where(l => l.UserId == userId)
                    .OrderByDescending(l => l.FromDate)
                    .Take(5)
                    .ToListAsync();

                if (!userLeaves.Any())
                {
                    return "You have no leave records in the system. You can request a leave by saying: *\"Apply for casual leave\"* or clicking the button below.";
                }

                var sb = new StringBuilder("Here is your recent and upcoming leave history:\n\n");
                foreach (var l in userLeaves)
                {
                    var statusBadge = l.Status switch
                    {
                        "Approved" => "🟢 **Approved**",
                        "Rejected" => "🔴 **Rejected**",
                        _ => "⏳ **Pending Review**"
                    };

                    sb.AppendLine($"• **{l.LeaveType} Leave**: {l.FromDate:dd MMM yyyy} to {l.ToDate:dd MMM yyyy} — {statusBadge}");
                    if (!string.IsNullOrWhiteSpace(l.Reason))
                    {
                        sb.AppendLine($"  *Reason:* \"{l.Reason}\"");
                    }
                }
                return sb.ToString();
            }

            // Work hours question
            if (lower.Contains("how many hours") || lower.Contains("work hours") || lower.Contains("how long have i worked"))
            {
                if (!isCheckedIn || todayLog?.CheckInTime == null)
                {
                    return "You have not checked in for today yet. Please check in first to begin tracking work hours!";
                }

                var elapsed = (int)(DateTime.UtcNow - todayLog.CheckInTime.Value).TotalMinutes;
                var breakMins = todayLog.BreakLogs.Where(b => !b.IsActive && b.EndTime != null).Sum(b => b.DurationMinutes);
                var activeBreak = todayLog.BreakLogs.FirstOrDefault(b => b.IsActive || b.EndTime == null);
                if (activeBreak != null)
                {
                    breakMins += (int)(DateTime.UtcNow - activeBreak.StartTime).TotalMinutes;
                }

                var netMinutes = Math.Max(0, elapsed - breakMins);
                var hours = netMinutes / 60;
                var mins = netMinutes % 60;

                var reply = $"You checked in at **{todayLog.CheckInTime.Value:hh:mm tt}** and have worked **{hours}h {mins}m** so far today (net of breaks).";
                if (activeBreak != null)
                {
                    reply += $"\n\n☕ You are currently on an active **{activeBreak.BreakType}** break since {activeBreak.StartTime:hh:mm tt}.";
                }
                return reply;
            }

            // Tasks question
            if (lower.Contains("what task") || lower.Contains("tasks") || lower.Contains("logged"))
            {
                if (!isCheckedIn || todayLog == null || !todayLog.TaskLogs.Any())
                {
                    return "You haven't logged any tasks for today yet. Click **Open Add Task Form** below to create one!";
                }

                var sb = new StringBuilder($"Here are your logged tasks for today ({todayLog.TaskLogs.Count} total):\n\n");
                foreach (var t in todayLog.TaskLogs)
                {
                    var statusIcon = t.Status == "Completed" ? "✅" : "⏳";
                    sb.AppendLine($"{statusIcon} **{t.TaskTitle}** ({t.TimeSpentMinutes}m) — *{t.Status}* [Priority: {t.Priority}]");
                }
                return sb.ToString();
            }

            // Point 2: Draft EOD Report Text
            if (lower.Contains("eod") || lower.Contains("end of day"))
            {
                if (!isCheckedIn || todayLog == null)
                {
                    return "You must check in first before generating an EOD report.";
                }

                var elapsed = (int)(DateTime.UtcNow - (todayLog.CheckInTime ?? DateTime.UtcNow)).TotalMinutes;
                var netMinutes = Math.Max(0, elapsed - todayLog.TotalBreakMinutes);
                var hours = netMinutes / 60;
                var mins = netMinutes % 60;

                var sb = new StringBuilder("📝 **Today's EOD Report Draft**:\n\n");
                sb.AppendLine($"• **Check-In Time:** {todayLog.CheckInTime:hh:mm tt}");
                sb.AppendLine($"• **Total Net Work Time:** {hours}h {mins}m");
                sb.AppendLine($"• **Tasks Completed ({todayLog.TaskLogs.Count(t => t.Status == "Completed")}):**");
                foreach (var t in todayLog.TaskLogs.Where(t => t.Status == "Completed"))
                {
                    sb.AppendLine($"  - {t.TaskTitle} ({t.TimeSpentMinutes}m)");
                }
                if (!todayLog.TaskLogs.Any(t => t.Status == "Completed"))
                {
                    sb.AppendLine("  - No tasks completed yet.");
                }

                sb.AppendLine("\nClick **Review & Submit EOD Report** below to open the submission form!");
                return sb.ToString();
            }

            // Meetings question
            if (lower.Contains("meeting") || lower.Contains("1-on-1") || lower.Contains("schedule"))
            {
                var today = DateTime.UtcNow.Date;
                var meetings = await _db.Meetings
                    .Include(m => m.Attendees)
                    .Where(m => (m.OrganisedByUserId == userId || m.Attendees.Any(a => a.UserId == userId))
                             && m.ScheduledAt >= today && m.ScheduledAt < today.AddDays(1))
                    .OrderBy(m => m.ScheduledAt)
                    .ToListAsync();

                if (!meetings.Any())
                {
                    return "You have no meetings scheduled for today! Enjoy your uninterrupted focus time. 🚀";
                }

                var sb = new StringBuilder($"You have **{meetings.Count}** meeting(s) scheduled today:\n\n");
                foreach (var m in meetings)
                {
                    sb.AppendLine($"📅 **{m.Title}** at {m.ScheduledAt:hh:mm tt} ({m.DurationMinutes}m) — Location: {m.Location ?? "Online"}");
                }
                return sb.ToString();
            }

            if (actions.Count > 0)
            {
                return "I've prepared the appropriate action card(s) for you below. Please select or confirm to proceed:";
            }

            return "I am your Daily Tracker AI Copilot. You can ask me:\n- *\"How many hours have I worked today so far?\"*\n- *\"What tasks did I log today?\"*\n- *\"Show my recent leaves\"*\n- *\"Draft my EOD report\"*\n- Or tell me to start a break!";
        }

        private async Task<string> BuildUserContextAsync(int userId)
        {
            var sb = new StringBuilder();
            var today = DateTime.UtcNow.Date;

            var user = await _db.Users
                .Where(u => u.Id == userId)
                .Select(u => new { u.FullName, u.Email, u.Role, u.Department })
                .FirstOrDefaultAsync();

            if (user != null)
            {
                sb.AppendLine($"EMPLOYEE PROFILE: {user.FullName} | Role: {user.Role} | Dept: {user.Department}");
            }

            var dailyLog = await _db.DailyLogs
                .Include(d => d.TaskLogs)
                .Include(d => d.BreakLogs)
                .FirstOrDefaultAsync(l => l.UserId == userId && l.LogDate == today);

            if (dailyLog != null)
            {
                var checkIn = dailyLog.CheckInTime.HasValue ? dailyLog.CheckInTime.Value.ToString("hh:mm tt") : "Not Checked In";
                var checkOut = dailyLog.CheckOutTime.HasValue ? dailyLog.CheckOutTime.Value.ToString("hh:mm tt") : "Not Checked Out";
                sb.AppendLine($"TODAY'S ATTENDANCE: CheckIn: {checkIn} | CheckOut: {checkOut} | WorkMinutes: {dailyLog.TotalWorkMinutes} min | Status: {dailyLog.DayStatus}");

                var activeBreak = dailyLog.BreakLogs.FirstOrDefault(b => b.IsActive || b.EndTime == null);
                if (activeBreak != null)
                {
                    sb.AppendLine($"CURRENT BREAK: Active ({activeBreak.BreakType}) since {activeBreak.StartTime:hh:mm tt}");
                }

                if (dailyLog.TaskLogs.Any())
                {
                    sb.AppendLine($"TODAY'S LOGGED TASKS ({dailyLog.TaskLogs.Count}):");
                    foreach (var t in dailyLog.TaskLogs)
                    {
                        sb.AppendLine($" - \"{t.TaskTitle}\" | Status: {t.Status} | Priority: {t.Priority} | {t.TimeSpentMinutes}m");
                    }
                }
            }
            else
            {
                sb.AppendLine("TODAY'S ATTENDANCE: Not checked in yet.");
            }

            var recentLeaves = await _db.LeaveRequests
                .Where(l => l.UserId == userId)
                .OrderByDescending(l => l.FromDate)
                .Take(4)
                .ToListAsync();

            if (recentLeaves.Any())
            {
                sb.AppendLine("LEAVE HISTORY:");
                foreach (var l in recentLeaves)
                {
                    sb.AppendLine($" - {l.LeaveType} ({l.FromDate:MMM dd} - {l.ToDate:MMM dd}) Status: {l.Status}");
                }
            }

            return sb.ToString();
        }
    }
}