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
    }

    public class GeminiService : IAiService
    {
        private readonly HttpClient _httpClient;
        private readonly IConfiguration _configuration;
        private readonly AppDbContext _db;
        private readonly ILogger<GeminiService> _logger;
        private const string MODEL = "gemini-2.5-flash"; // Fast & accurate model

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

        public async Task<ChatResponse> GetChatResponseAsync(
            string userMessage,
            List<MessageHistory> history,
            int userId)
        {
            var actions = DetectClientActions(userMessage, userId);
            var apiKey = _configuration["Gemini:ApiKey"] ?? _configuration["GeminiApiKey"];

            if (string.IsNullOrWhiteSpace(apiKey))
            {
                return new ChatResponse
                {
                    Reply = GenerateSmartFallback(userMessage, actions),
                    Actions = actions,
                    Success = true
                };
            }

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
                _logger.LogWarning(ex, "Failed to build user context, proceeding with basic context.");
            }

            try
            {
                var url = $"https://generativelanguage.googleapis.com/v1beta/models/{MODEL}:generateContent?key={apiKey}";
                var recentHistory = history.TakeLast(8).ToList();
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
                    You are a smart, professional AI Copilot built into the Daily Tracker EMS application.
                    You help employees manage and understand their work day with real-time operational accuracy.

                    RULES:
                    - Be concise, structured, and helpful. Use bullet points when listing items.
                    - Format dates as "Mon DD" and times as "hh:mm AM/PM".
                    - ALWAYS refer to the live user context below when answering questions about tasks, work hours, check-in status, leaves, or meetings.
                    - NEVER invent or guess data — only use what is in the live context below. If data is not recorded, clearly state that.
                    - If asked to create a task, check in/out, or apply for WFH, acknowledge that an action card is prepared for them to confirm.
                    - Today is {DateTime.Now:dddd, MMMM dd yyyy}. Current server time: {DateTime.Now:hh:mm tt}.

                    ══════════════════════════════════════════════════════════
                      LIVE USER CONTEXT & RECENT ACTIVITY
                    ══════════════════════════════════════════════════════════
                    {userContext}
                    ══════════════════════════════════════════════════════════
                    """;

                var requestBody = new
                {
                    system_instruction = new { parts = new[] { new { text = systemPrompt } } },
                    contents,
                    generationConfig = new { maxOutputTokens = 1000, temperature = 0.5 }
                };

                var json = JsonSerializer.Serialize(requestBody);
                var httpContent = new StringContent(json, Encoding.UTF8, "application/json");

                var response = await _httpClient.PostAsync(url, httpContent);
                var body = await response.Content.ReadAsStringAsync();

                if (!response.IsSuccessStatusCode)
                {
                    _logger.LogError("Gemini API error {Status}: {Body}", response.StatusCode, body);
                    return new ChatResponse
                    {
                        Reply = GenerateSmartFallback(userMessage, actions),
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
                        var replyText = resContent.GetProperty("parts")[0].GetProperty("text").GetString()
                                        ?? "I couldn't generate a response.";
                        return new ChatResponse
                        {
                            Reply = replyText,
                            Actions = actions,
                            Success = true
                        };
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Gemini call failed with exception");
            }

            return new ChatResponse
            {
                Reply = GenerateSmartFallback(userMessage, actions),
                Actions = actions,
                Success = true
            };
        }

        private List<SuggestedAction> DetectClientActions(string text, int userId)
        {
            var actions = new List<SuggestedAction>();
            var lower = text.ToLowerInvariant();

            // 1. Create Task
            if (lower.Contains("create task") || lower.Contains("log task") || lower.Contains("add task"))
            {
                var match = Regex.Match(text, @"(?:task|log|add)\s+[""']?([^""'\n]+?)[""']?(?:\s+(?:for|in|with|priority|minutes|hours)|$)", RegexOptions.IgnoreCase);
                var title = match.Success ? match.Groups[1].Value.Trim() : "New Task from AI Copilot";
                var priority = lower.Contains("high") ? "High" : lower.Contains("low") ? "Low" : "Medium";
                var minutes = lower.Contains("2 hour") ? 120 : lower.Contains("1 hour") ? 60 : 30;

                actions.Add(new SuggestedAction
                {
                    Type = "CREATE_TASK",
                    Title = $"Create Task: \"{title}\"",
                    Payload = new Dictionary<string, object>
                    {
                        { "taskTitle", title },
                        { "priority", priority },
                        { "timeSpentMinutes", minutes }
                    }
                });
            }

            // 2. Check In
            if (lower.Contains("check in") || lower.Contains("clock in"))
            {
                actions.Add(new SuggestedAction
                {
                    Type = "CHECK_IN",
                    Title = "Check In for Today",
                    Payload = new Dictionary<string, object> { { "dayStatus", "Present" } }
                });
            }

            // 3. Check Out
            if (lower.Contains("check out") || lower.Contains("clock out"))
            {
                actions.Add(new SuggestedAction
                {
                    Type = "CHECK_OUT",
                    Title = "Check Out for Today",
                    Payload = new Dictionary<string, object>()
                });
            }

            // 4. Apply WFH
            if (lower.Contains("wfh") && (lower.Contains("apply") || lower.Contains("request")))
            {
                actions.Add(new SuggestedAction
                {
                    Type = "APPLY_WFH",
                    Title = "Apply for Work From Home (Today)",
                    Payload = new Dictionary<string, object>
                    {
                        { "requestType", "WFH" },
                        { "reason", "Requested via AI Copilot" }
                    }
                });
            }

            // 5. Submit EOD
            if (lower.Contains("draft eod") || lower.Contains("submit eod") || lower.Contains("eod report"))
            {
                actions.Add(new SuggestedAction
                {
                    Type = "SUBMIT_EOD",
                    Title = "Submit EOD Report for Today",
                    Payload = new Dictionary<string, object>()
                });
            }

            return actions;
        }

        private string GenerateSmartFallback(string message, List<SuggestedAction> actions)
        {
            if (actions.Count > 0)
            {
                var actionTitles = string.Join(" and ", actions.Select(a => $"**{a.Title}**"));
                return $"I have prepared the action for you: {actionTitles}.\n\nClick **Confirm** on the action card below to execute it immediately!";
            }
            return "I am your Daily Tracker AI Copilot. You can ask me about today's tasks, your check-in time, leave balance, or tell me to create tasks for you!";
        }

        private async Task<string> BuildUserContextAsync(int userId)
        {
            var sb = new StringBuilder();
            var today = DateTime.UtcNow.Date;

            // 1. User Profile
            var user = await _db.Users
                .Where(u => u.Id == userId)
                .Select(u => new { u.FullName, u.Email, u.Role, u.Department })
                .FirstOrDefaultAsync();

            if (user != null)
            {
                sb.AppendLine($"EMPLOYEE PROFILE: {user.FullName} | Role: {user.Role} | Dept: {user.Department} | Email: {user.Email}");
            }

            // 2. Today's Attendance & Presence
            var dailyLog = await _db.DailyLogs
                .Include(d => d.TaskLogs)
                .Include(d => d.BreakLogs)
                .FirstOrDefaultAsync(l => l.UserId == userId && l.LogDate == today);

            if (dailyLog != null)
            {
                var checkIn = dailyLog.CheckInTime.HasValue ? dailyLog.CheckInTime.Value.ToString("hh:mm tt") : "Not Checked In";
                var checkOut = dailyLog.CheckOutTime.HasValue ? dailyLog.CheckOutTime.Value.ToString("hh:mm tt") : "Not Checked Out";
                sb.AppendLine($"TODAY'S ATTENDANCE: CheckIn: {checkIn} | CheckOut: {checkOut} | WorkMinutes: {dailyLog.TotalWorkMinutes} min | Status: {dailyLog.DayStatus}");

                // Active & Past Breaks
                var activeBreak = dailyLog.BreakLogs.FirstOrDefault(b => b.IsActive || b.EndTime == null);
                if (activeBreak != null)
                {
                    sb.AppendLine($"CURRENT BREAK: Active ({activeBreak.BreakType}) since {activeBreak.StartTime:hh:mm tt}");
                }
                else
                {
                    var totalBreak = dailyLog.BreakLogs.Sum(b => b.DurationMinutes);
                    sb.AppendLine($"BREAKS: No active break. Total breaks today: {dailyLog.BreakLogs.Count} ({totalBreak} min total)");
                }

                // Today's Tasks
                if (dailyLog.TaskLogs.Any())
                {
                    sb.AppendLine($"TODAY'S LOGGED TASKS ({dailyLog.TaskLogs.Count}):");
                    foreach (var t in dailyLog.TaskLogs)
                    {
                        sb.AppendLine($" - [Task #{t.Id}] \"{t.TaskTitle}\" | Status: {t.Status} | Priority: {t.Priority} | TimeSpent: {t.TimeSpentMinutes} min");
                    }
                }
                else
                {
                    sb.AppendLine("TODAY'S TASKS: No tasks logged yet today.");
                }
            }
            else
            {
                sb.AppendLine("TODAY'S ATTENDANCE: No attendance record for today (Employee hasn't checked in yet).");
            }

            // 3. Today's Scheduled Meetings (uses OrganisedByUserId from Meeting.cs)
            var todayStart = today;
            var todayEnd = today.AddDays(1);
            var meetings = await _db.Meetings
                .Include(m => m.Attendees)
                .Where(m => (m.OrganisedByUserId == userId || m.Attendees.Any(a => a.UserId == userId))
                         && m.ScheduledAt >= todayStart && m.ScheduledAt < todayEnd)
                .OrderBy(m => m.ScheduledAt)
                .Select(m => new { m.Title, m.ScheduledAt, m.DurationMinutes, m.MeetingType, m.Location })
                .ToListAsync();

            if (meetings.Any())
            {
                sb.AppendLine($"TODAY'S MEETINGS ({meetings.Count}):");
                foreach (var m in meetings)
                {
                    sb.AppendLine($" - \"{m.Title}\" at {m.ScheduledAt:hh:mm tt} ({m.DurationMinutes} min) [{m.MeetingType}] @ {m.Location ?? "Online"}");
                }
            }
            else
            {
                sb.AppendLine("TODAY'S MEETINGS: None scheduled for today.");
            }

            // 4. Recent Leave Status
            var recentLeaves = await _db.LeaveRequests
                .Where(l => l.UserId == userId)
                .OrderByDescending(l => l.AppliedAt)
                .Take(2)
                .Select(l => new { l.LeaveType, l.FromDate, l.ToDate, l.Status, l.Reason })
                .ToListAsync();

            if (recentLeaves.Any())
            {
                sb.AppendLine("RECENT LEAVE REQUESTS:");
                foreach (var l in recentLeaves)
                {
                    sb.AppendLine($" - {l.LeaveType} ({l.FromDate:MMM dd} to {l.ToDate:MMM dd}) - Status: {l.Status}");
                }
            }

            // 5. Manager Snapshot (if user has Manager or Admin role)
            if (user != null && (user.Role == "Admin" || user.Role == "Manager"))
            {
                var teamPresent = await _db.DailyLogs.CountAsync(l => l.LogDate == today && l.CheckInTime != null);
                var pendingLeaves = await _db.LeaveRequests.CountAsync(l => l.Status == "Pending");
                var pendingWFH = await _db.WFHRequests.CountAsync(w => w.Status == "Pending");

                sb.AppendLine($"MANAGER/ADMIN SUMMARY: Total employees checked in today: {teamPresent} | Pending Leave Requests: {pendingLeaves} | Pending WFH Requests: {pendingWFH}");
            }

            return sb.ToString();
        }
    }
}