using DailyTrackerAPI.Helpers;
using DailyTrackerAPI.Services.Communication;
using DocumentFormat.OpenXml.InkML;
using DocumentFormat.OpenXml.Spreadsheet;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;

namespace DailyTrackerAPI.Hubs
{
    // ═══════════════════════════════════════════════════════════════════════════
    //  CHAT HUB  —  SignalR real-time messaging
    //
    //  HOW IT WORKS:
    //    1. User connects → joins their personal group (user_{id}) and all their
    //       conversation groups (conv_{conversationId}).
    //    2. When user sends a message via HTTP POST, the controller calls
    //       _hub.Clients.Group("conv_{id}").SendAsync("ReceiveMessage", ...) 
    //       which broadcasts to every connected member.
    //    3. The hub also handles typing indicators and online presence — 
    //       these are fire-and-forget (no persistence needed).
    //
    //  SignalR Groups used:
    //    user_{userId}       → personal events (kicked from group, etc.)
    //    conv_{convId}       → all messages and events in one conversation
    //    online_users        → broadcast typing/presence to everyone
    //
    //  Frontend connects via:
    //    const conn = new HubConnectionBuilder()
    //      .withUrl("/hubs/chat", { accessTokenFactory: () => token })
    //      .withAutomaticReconnect()
    //      .build();
    // ═══════════════════════════════════════════════════════════════════════════

    [Authorize]
    public class ChatHub : Hub
    {
        private readonly IChatService _chatService;

        // Static dictionary to track userId → connectionId(s)
        // (a user can have multiple browser tabs open)
        private static readonly Dictionary<int, HashSet<string>> _userConnections = new();
        private static readonly object _lock = new();

        public ChatHub(IChatService chatService)
        {
            _chatService = chatService;
        }

        // ── Connection lifecycle ──────────────────────────────────────────────

        public override async Task OnConnectedAsync()
        {
            var userId = Context.User!.GetUserId();

            // Register connection
            lock (_lock)
            {
                if (!_userConnections.ContainsKey(userId))
                    _userConnections[userId] = new HashSet<string>();
                _userConnections[userId].Add(Context.ConnectionId);
            }

            // Join personal group
            await Groups.AddToGroupAsync(Context.ConnectionId, $"user_{userId}");

            // Join all conversation groups for this user
            var conversations = await _chatService.GetMyConversationsAsync(userId);
            foreach (var conv in conversations)
                await Groups.AddToGroupAsync(Context.ConnectionId, $"conv_{conv.Id}");

            // Notify others that this user is online
            await Clients.Others.SendAsync("UserOnline", new { UserId = userId });

            await base.OnConnectedAsync();
        }

        public override async Task OnDisconnectedAsync(Exception? exception)
        {
            var userId = Context.User!.GetUserId();

            lock (_lock)
            {
                if (_userConnections.ContainsKey(userId))
                {
                    _userConnections[userId].Remove(Context.ConnectionId);
                    if (_userConnections[userId].Count == 0)
                        _userConnections.Remove(userId);
                }
            }

            // Only announce offline if all connections are gone
            bool stillOnline;
            lock (_lock) { stillOnline = _userConnections.ContainsKey(userId); }

            if (!stillOnline)
                await Clients.Others.SendAsync("UserOffline", new { UserId = userId });

            await base.OnDisconnectedAsync(exception);
        }

        // ── Typing indicators ─────────────────────────────────────────────────
        // These are fire-and-forget — no DB storage needed.
        // The client sends "StartTyping" and the hub broadcasts to other members.

        public async Task StartTyping(int conversationId)
        {
            var userId = Context.User!.GetUserId();
            // Send to everyone in the conversation EXCEPT the caller
            await Clients.OthersInGroup($"conv_{conversationId}")
                .SendAsync("UserTyping", new
                {
                    ConversationId = conversationId,
                    UserId = userId
                });
        }

        public async Task StopTyping(int conversationId)
        {
            var userId = Context.User!.GetUserId();
            await Clients.OthersInGroup($"conv_{conversationId}")
                .SendAsync("UserStoppedTyping", new
                {
                    ConversationId = conversationId,
                    UserId = userId
                });
        }

        // ── Mark as read (real-time) ──────────────────────────────────────────
        // When a user opens a conversation and marks it read, notify others
        // so they see the "read" checkmarks update live.

        public async Task MarkRead(int conversationId)
        {
            var userId = Context.User!.GetUserId();

            await _chatService.MarkConversationReadAsync(conversationId, userId);

            // Notify sender(s) in the conversation that this user has read it
            await Clients.OthersInGroup($"conv_{conversationId}")
                .SendAsync("ConversationRead", new
                {
                    ConversationId = conversationId,
                    UserId = userId,
                    ReadAt = DateTime.UtcNow
                });
        }

        // ── Join a new conversation group ─────────────────────────────────────
        // Called when a new conversation is created (e.g. user accepted a group invite)

        public async Task JoinConversation(int conversationId)
        {
            await Groups.AddToGroupAsync(Context.ConnectionId, $"conv_{conversationId}");
        }
        public async Task LeaveConversation(int conversationId)
        {
            await Groups.RemoveFromGroupAsync(
                Context.ConnectionId,
                $"conv_{conversationId}"
            );
        }

        // ── Static helper: get online user IDs ───────────────────────────────
        public static List<int> GetOnlineUserIds()
        {
            lock (_lock) { return _userConnections.Keys.ToList(); }
        }

        public static bool IsUserOnline(int userId)
        {
            lock (_lock) { return _userConnections.ContainsKey(userId); }
        }
    }
}
