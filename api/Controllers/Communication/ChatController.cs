using DailyTrackerAPI.Data;
using DailyTrackerAPI.DTOs;
using DailyTrackerAPI.Helpers;
using DailyTrackerAPI.Hubs;
using DailyTrackerAPI.Services.Communication;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;

namespace DailyTrackerAPI.Controllers.Communication
{
    // ═══════════════════════════════════════════════════════════════════════════
    //  CHAT CONTROLLER
    //
    //  Architecture note:
    //    Messages are sent via HTTP POST (not via SignalR directly).
    //    This means:
    //      • The message is persisted to DB first (reliable)
    //      • Then pushed to all connected clients via SignalR
    //      • If the recipient is offline, they get it when they next load history
    //
    //  ALL write operations (send, edit, delete, react) do TWO things:
    //    1. Persist to database (via ChatService)
    //    2. Broadcast to the SignalR group "conv_{conversationId}"
    // ═══════════════════════════════════════════════════════════════════════════

    [ApiController]
    [Route("api/chat")]
    [Authorize]
    public class ChatController : ControllerBase
    {
        private readonly IChatService _chatService;
        private readonly IHubContext<ChatHub> _hub;
        private readonly AppDbContext _db;

        public ChatController(IChatService chatService, IHubContext<ChatHub> hub, AppDbContext db)
        {
            _chatService = chatService;
            _hub = hub;
            _db = db;
        }

        // ── CONVERSATIONS ─────────────────────────────────────────────────────

        /// <summary>Get all conversations (sidebar list)</summary>
        [HttpGet("conversations")]
        public async Task<IActionResult> GetConversations()
        {
            var userId = User.GetUserId();
            var list = await _chatService.GetMyConversationsAsync(userId);
            return Ok(list);
        }

        /// <summary>Get or create a 1:1 direct conversation with another user</summary>
        [HttpPost("conversations/direct/{otherUserId}")]
        public async Task<IActionResult> OpenDirect(int otherUserId)
        {
            try
            {
                var userId = User.GetUserId();
                var conv = await _chatService.GetOrCreateDirectConversationAsync(userId, otherUserId);

                // Tell the other user to join the SignalR group for this conversation
                await _hub.Clients.Group($"user_{otherUserId}")
                    .SendAsync("JoinConversation", conv.Id);

                return Ok(conv);
            }
            catch (InvalidOperationException ex) { return BadRequest(new { message = ex.Message }); }
        }

        /// <summary>Create a new group conversation</summary>
        [HttpPost("conversations/group")]
        public async Task<IActionResult> CreateGroup([FromBody] CreateGroupDto dto)
        {
            try
            {
                var userId = User.GetUserId();
                var conv = await _chatService.CreateGroupConversationAsync(userId, dto);

                // Notify every member via SignalR so they join the group
                foreach (var memberId in dto.MemberIds)
                {
                    await _hub.Clients.Group($"user_{memberId}")
                        .SendAsync("AddedToGroup", new
                        {
                            ConversationId = conv.Id,
                            GroupName = dto.GroupName,
                            Message = $"You were added to '{dto.GroupName}'"
                        });
                }

                return Ok(conv);
            }
            catch (InvalidOperationException ex) { return BadRequest(new { message = ex.Message }); }
        }

        /// <summary>Get conversation details (members, admin role)</summary>
        [HttpGet("conversations/{conversationId}")]
        public async Task<IActionResult> GetDetail(int conversationId)
        {
            try
            {
                var userId = User.GetUserId();
                var detail = await _chatService.GetConversationDetailAsync(conversationId, userId);
                return Ok(detail);
            }
            catch (UnauthorizedAccessException) { return Forbid(); }
        }

        /// <summary>Get online user IDs from the ChatHub in-memory dictionary</summary>
        [HttpGet("online-users")]
        public IActionResult GetOnlineUsers() =>
            Ok(ChatHub.GetOnlineUserIds());

        /// <summary>Get all users available to chat with (for New Chat modal)</summary>
        [HttpGet("users")]
        public async Task<IActionResult> GetUsers()
        {
            var userId = User.GetUserId();
            var users = await _chatService.GetUsersForChatAsync(userId);
            // Annotate with online status from the hub
            foreach (var u in users)
                if (u.OnlineStatus == "Offline" && ChatHub.IsUserOnline(u.Id))
                    u.OnlineStatus = "Online";
            return Ok(users);
        }

        // ── MESSAGES ──────────────────────────────────────────────────────────

        /// <summary>
        /// Load message history (paginated).
        /// Pass beforeMessageId to load older messages (infinite scroll up).
        /// </summary>
        [HttpGet("conversations/{conversationId}/messages")]
        public async Task<IActionResult> GetMessages(
            int conversationId,
            [FromQuery] int pageSize = 50,
            [FromQuery] int? beforeMessageId = null)
        {
            try
            {
                var userId = User.GetUserId();
                var messages = await _chatService.GetMessagesAsync(conversationId, userId, pageSize, beforeMessageId);
                return Ok(messages);
            }
            catch (UnauthorizedAccessException) { return Forbid(); }
        }

        /// <summary>
        /// Send a message — saves to DB then broadcasts via SignalR.
        /// This is the main send endpoint.
        /// </summary>
        [HttpPost("messages")]
        public async Task<IActionResult> SendMessage([FromBody] SendMessageDto dto)
        {
            try
            {
                var userId = User.GetUserId();
                var message = await _chatService.SendMessageAsync(userId, dto);

                // 🔴 BROADCAST: push to all clients in this conversation in real-time
                await _hub.Clients.Group($"conv_{dto.ConversationId}")
                    .SendAsync("ReceiveMessage", message);

                return Ok(message);
            }
            catch (UnauthorizedAccessException) { return Forbid(); }
            catch (InvalidOperationException ex) { return BadRequest(new { message = ex.Message }); }
        }

        /// <summary>Edit an existing message</summary>
        [HttpPut("messages/{messageId}")]
        public async Task<IActionResult> EditMessage(int messageId, [FromBody] EditMessageDto dto)
        {
            try
            {
                var userId = User.GetUserId();
                var message = await _chatService.EditMessageAsync(messageId, userId, dto.Content);

                await _hub.Clients.Group($"conv_{message.ConversationId}")
                    .SendAsync("MessageEdited", message);

                return Ok(message);
            }
            catch (UnauthorizedAccessException) { return Forbid(); }
            catch (KeyNotFoundException ex) { return NotFound(new { message = ex.Message }); }
        }

        /// <summary>Delete a message (soft delete — content replaced)</summary>
        [HttpDelete("messages/{messageId}")]
        public async Task<IActionResult> DeleteMessage(int messageId)
        {
            try
            {
                var userId = User.GetUserId();

                // Get message first
                var message = await _db.ChatMessages
                    .FirstOrDefaultAsync(m => m.Id == messageId);

                if (message == null)
                    return NotFound(new { message = "Message not found." });

                var conversationId = message.ConversationId;

                await _chatService.DeleteMessageAsync(messageId, userId);

                // 🔥 Broadcast ONLY to that conversation
                await _hub.Clients.Group($"conv_{conversationId}")
                    .SendAsync("MessageDeleted", new
                    {
                        MessageId = messageId
                    });

                return Ok(new { message = "Message deleted." });
            }
            catch (UnauthorizedAccessException)
            {
                return Forbid();
            }
            catch (KeyNotFoundException ex)
            {
                return NotFound(new { message = ex.Message });
            }
        }

        /// <summary>Search messages within a conversation</summary>
        [HttpGet("conversations/{conversationId}/search")]
        public async Task<IActionResult> SearchMessages(int conversationId, [FromQuery] string q)
        {
            try
            {
                var userId = User.GetUserId();
                var results = await _chatService.SearchMessagesAsync(conversationId, userId, q);
                return Ok(results);
            }
            catch (UnauthorizedAccessException) { return Forbid(); }
        }

        // ── READ RECEIPTS ─────────────────────────────────────────────────────

        /// <summary>Mark all messages in conversation as read (also done via SignalR hub)</summary>
        [HttpPost("conversations/{conversationId}/read")]
        public async Task<IActionResult> MarkRead(int conversationId)
        {
            var userId = User.GetUserId();
            await _chatService.MarkConversationReadAsync(conversationId, userId);

            await _hub.Clients.Group($"conv_{conversationId}")
                .SendAsync("ConversationRead", new
                {
                    ConversationId = conversationId,
                    UserId = userId,
                    ReadAt = DateTime.UtcNow
                });

            return Ok();
        }

        /// <summary>Get unread counts for all conversations (for sidebar badges)</summary>
        [HttpGet("unread-counts")]
        public async Task<IActionResult> GetUnreadCounts()
        {
            var userId = User.GetUserId();
            var counts = await _chatService.GetAllUnreadCountsAsync(userId);
            return Ok(counts);
        }

        // ── REACTIONS ─────────────────────────────────────────────────────────

        /// <summary>Add or remove an emoji reaction from a message</summary>
        [HttpPost("messages/{messageId}/react")]
        public async Task<IActionResult> React(int messageId, [FromBody] ReactDto dto)
        {
            try
            {
                var userId = User.GetUserId();
                var result = await _chatService.ToggleReactionAsync(messageId, userId, dto.Emoji);

                // Broadcast updated reaction counts to all members
                await _hub.Clients.All
                    .SendAsync("ReactionUpdated", result);

                return Ok(result);
            }
            catch (Exception ex) { return BadRequest(new { message = ex.Message }); }
        }

        // ── GROUP MANAGEMENT ──────────────────────────────────────────────────

        /// <summary>Add members to a group (admin only)</summary>
        [HttpPost("conversations/{conversationId}/members")]
        public async Task<IActionResult> AddMembers(int conversationId, [FromBody] AddMembersDto dto)
        {
            try
            {
                var userId = User.GetUserId();
                await _chatService.AddMembersToGroupAsync(conversationId, userId, dto.UserIds);

                // Notify new members to join the SignalR group
                foreach (var uid in dto.UserIds)
                {
                    await _hub.Clients.Group($"user_{uid}")
                        .SendAsync("AddedToGroup", new { ConversationId = conversationId });
                }

                // Notify existing members about who was added
                await _hub.Clients.Group($"conv_{conversationId}")
                    .SendAsync("MembersAdded", new { ConversationId = conversationId, AddedUserIds = dto.UserIds });

                return Ok(new { message = "Members added." });
            }
            catch (UnauthorizedAccessException) { return Forbid(); }
            catch (KeyNotFoundException ex) { return NotFound(new { message = ex.Message }); }
        }

        /// <summary>Remove a member from a group (admin only)</summary>
        [HttpDelete("conversations/{conversationId}/members/{targetUserId}")]
        public async Task<IActionResult> RemoveMember(int conversationId, int targetUserId)
        {
            try
            {
                var userId = User.GetUserId();
                await _chatService.RemoveMemberFromGroupAsync(conversationId, userId, targetUserId);

                // Tell the removed user to leave the SignalR group
                await _hub.Clients.Group($"user_{targetUserId}")
                    .SendAsync("RemovedFromGroup", new { ConversationId = conversationId });

                await _hub.Clients.Group($"conv_{conversationId}")
                    .SendAsync("MemberRemoved", new { ConversationId = conversationId, UserId = targetUserId });

                return Ok();
            }
            catch (UnauthorizedAccessException) { return Forbid(); }
        }

        /// <summary>Leave a group yourself</summary>
        [HttpPost("conversations/{conversationId}/leave")]
        public async Task<IActionResult> LeaveGroup(int conversationId)
        {
            try
            {
                var userId = User.GetUserId();
                await _chatService.LeaveGroupAsync(conversationId, userId);

                await _hub.Clients.Group($"conv_{conversationId}")
                    .SendAsync("MemberLeft", new { ConversationId = conversationId, UserId = userId });

                return Ok(new { message = "You left the group." });
            }
            catch (Exception ex) { return BadRequest(new { message = ex.Message }); }
        }

        /// <summary>Update group name / avatar</summary>
        [HttpPut("conversations/{conversationId}/group-info")]
        public async Task<IActionResult> UpdateGroupInfo(int conversationId, [FromBody] UpdateGroupDto dto)
        {
            try
            {
                var userId = User.GetUserId();
                await _chatService.UpdateGroupInfoAsync(conversationId, userId, dto.GroupName, dto.GroupAvatar);

                await _hub.Clients.Group($"conv_{conversationId}")
                    .SendAsync("GroupInfoUpdated", new { ConversationId = conversationId, dto.GroupName, dto.GroupAvatar });

                return Ok();
            }
            catch (UnauthorizedAccessException) { return Forbid(); }
        }

        /// <summary>Promote a member to group admin</summary>
        [HttpPost("conversations/{conversationId}/members/{targetUserId}/promote")]
        public async Task<IActionResult> PromoteAdmin(int conversationId, int targetUserId)
        {
            try
            {
                var userId = User.GetUserId();
                await _chatService.PromoteToAdminAsync(conversationId, userId, targetUserId);

                await _hub.Clients.Group($"conv_{conversationId}")
                    .SendAsync("MemberPromoted", new { ConversationId = conversationId, UserId = targetUserId });

                return Ok(new { message = "Member promoted to admin." });
            }
            catch (UnauthorizedAccessException) { return Forbid(); }
        }
    }
}
