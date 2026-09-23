using DailyTrackerAPI.Data;
using DailyTrackerAPI.Models.Communication;
using Microsoft.EntityFrameworkCore;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;

namespace DailyTrackerAPI.Services.AI
{
    public interface IAiService
    {
        Task<ChatResponse> GetChatResponseAsync(string userMessage, List<MessageHistory> history, int userId);
    }

    public class GeminiService : IAiService
    {
        private readonly HttpClient _httpClient;
        private readonly IConfiguration _configuration;
        private readonly AppDbContext _db;
        private readonly ILogger<GeminiService> _logger;
        private const string MODEL = "gemini-3.6-flash"; // or "gemini-2.5-flash" / "gemini-3.6-flash"

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

        public async Task<ChatResponse> GetChatResponseAsync(
            string userMessage,
            List<MessageHistory> history,
            int userId)
        {
            // 1. Always detect client actions first (Never fails)
            var actions = DetectClientActions(userMessage, userId);

            // 2. Fetch API Key
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

            // 3. Build live user context safely
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
                _logger.LogWarning(ex, "Failed to build user context, proceeding without it.");
            }

            // 4. Call Gemini API
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
                    You help employees manage and understand their work day.
                    
                    RULES:
                    - Be concise, structured, and helpful. Use bullet points when listing items.
                    - Format dates as "Mon DD" and times as "hh:mm AM/PM".
                    - NEVER invent or guess data — only use what is in the live context below.
                    - If asked to create a task, check in/out, or apply for WFH, acknowledge that an action card is prepared for them to confirm.
                    - Today is {DateTime.Now:dddd, MMMM dd yyyy}. Current time: {DateTime.Now:hh:mm tt}.
                    
                    ══════════════════════════════════════════════════════════
                      LIVE USER DATA
                    ══════════════════════════════════════════════════════════
                    {userContext}
                    ══════════════════════════════════════════════════════════
                    """;

                var requestBody = new
                {
                    system_instruction = new { parts = new[] { new { text = systemPrompt } } },
                    contents,
                    generationConfig = new { maxOutputTokens = 800, temperature = 0.7 }
                };

                var json = JsonSerializer.Serialize(requestBody);
                var httpContent = new StringContent(json, Encoding.UTF8, "application/json");

                var response = await _httpClient.PostAsync(url, httpContent);
                var body = await response.Content.ReadAsStringAsync();

                if (!response.IsSuccessStatusCode)
                {
                    _logger.LogError("Gemini API error {Status}: {Body}", response.StatusCode, body);
                    // Graceful fallback if Google returns 400/403/404/429
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

            // Fallback if network or Gemini API fails
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
            var today = DateTime.Today;

            var user = await _db.Users
                .Where(u => u.Id == userId)
                .Select(u => new { u.FullName, u.Email, u.Role, u.Department })
                .FirstOrDefaultAsync();

            if (user != null)
            {
                sb.AppendLine($"USER: {user.FullName} | Role: {user.Role} | Dept: {user.Department} | Email: {user.Email}");
            }

            return sb.ToString();
        }
    }
}