using DailyTrackerAPI.Data;
using DailyTrackerAPI.DTOs;
using DailyTrackerAPI.Models.Communication;
using Microsoft.EntityFrameworkCore;

namespace DailyTrackerAPI.Services.Communication
{
    // ═══════════════════════════════════════════════════════════════════════════
    //  CHAT SERVICE — Core business logic
    //
    //  Responsibilities:
    //    • Create / fetch direct (1:1) and group conversations
    //    • Send, edit, delete messages
    //    • Mark messages as read, calculate unread counts
    //    • Manage group members (add, remove, promote to admin)
    //    • Emoji reactions (add / toggle)
    //    • Search messages
    // ═══════════════════════════════════════════════════════════════════════════

    public interface IChatService
    {
        // Conversations
        Task<ConversationDto> GetOrCreateDirectConversationAsync(int userId, int otherUserId);
        Task<ConversationDto> CreateGroupConversationAsync(int creatorId, CreateGroupDto dto);
        Task<List<ConversationSummaryDto>> GetMyConversationsAsync(int userId);
        Task<ConversationDetailDto> GetConversationDetailAsync(int conversationId, int userId);

        // Messages
        Task<ChatMessageDto> SendMessageAsync(int senderId, SendMessageDto dto);
        Task<List<ChatMessageDto>> GetMessagesAsync(int conversationId, int userId, int pageSize, int? beforeMessageId);
        Task<ChatMessageDto> EditMessageAsync(int messageId, int userId, string newContent);
        Task DeleteMessageAsync(int messageId, int userId);

        // Read receipts
        Task MarkConversationReadAsync(int conversationId, int userId);
        Task<int> GetUnreadCountAsync(int conversationId, int userId);
        Task<Dictionary<int, int>> GetAllUnreadCountsAsync(int userId);

        // Reactions
        Task<ReactionResult> ToggleReactionAsync(int messageId, int userId, string emoji);

        // Group management
        Task AddMembersToGroupAsync(int conversationId, int requestingUserId, List<int> newMemberIds);
        Task RemoveMemberFromGroupAsync(int conversationId, int requestingUserId, int targetUserId);
        Task LeaveGroupAsync(int conversationId, int userId);
        Task UpdateGroupInfoAsync(int conversationId, int userId, string? name, string? avatar);
        Task PromoteToAdminAsync(int conversationId, int requestingUserId, int targetUserId);

        // Search
        Task<List<ChatMessageDto>> SearchMessagesAsync(int conversationId, int userId, string query);

        // Users list (for starting new chats)
        Task<List<UserChatProfileDto>> GetUsersForChatAsync(int currentUserId);
    }
    public class ChatService : IChatService
    {
        private readonly AppDbContext _db;
        public ChatService(AppDbContext db)
        {
            _db = db;
        }

        // ══════════════════════════════════════════════════════════════════════
        // CONVERSATIONS
        // ══════════════════════════════════════════════════════════════════════

        /// <summary>
        /// For Direct chats: if a conversation between the two users already exists,
        /// return it. Otherwise create a new one. This prevents duplicate DMs.
        /// </summary>
        public async Task<ConversationDto> GetOrCreateDirectConversationAsync(int userId, int otherUserId)
        {
            if (userId == otherUserId)
                throw new InvalidOperationException("You cannot start a conversation with yourself.");

            // Look for an existing Direct conversation that has exactly both users as members
            var existing = await _db.Conversations
                .Where(c => c.Type == "Direct" && c.IsActive)
                .Where(c => c.Members.Any(m => m.UserId == userId && !m.HasLeft)
                         && c.Members.Any(m => m.UserId == otherUserId && !m.HasLeft))
                .Include(c => c.Members).ThenInclude(m => m.User)
                .FirstOrDefaultAsync();

            if (existing != null)
                return await MapToConversationDto(existing, userId);

            // Create new Direct conversation
            var otherUser = await _db.Users.FindAsync(otherUserId)
                ?? throw new KeyNotFoundException("User not found.");

            var conversation = new Conversation
            {
                Type = "Direct",
                CreatedByUserId = userId,
                Members = new List<ConversationMember>
                {
                    new() { UserId = userId, Role = "Member", JoinedAt = DateTime.UtcNow },
                    new() { UserId = otherUserId, Role = "Member", JoinedAt = DateTime.UtcNow }
                }
            };

            _db.Conversations.Add(conversation);
            await _db.SaveChangesAsync();

            await _db.Entry(conversation).Collection(c => c.Members).LoadAsync();
            foreach (var m in conversation.Members)
                await _db.Entry(m).Reference(x => x.User).LoadAsync();

            return await MapToConversationDto(conversation, userId);
        }

        /// <summary>Create a new Group conversation with initial members.</summary>
        public async Task<ConversationDto> CreateGroupConversationAsync(int creatorId, CreateGroupDto dto)
        {
            if (string.IsNullOrWhiteSpace(dto.GroupName))
                throw new InvalidOperationException("Group name is required.");

            // Ensure creator is in the member list
            var memberIds = dto.MemberIds.Distinct().ToList();
            if (!memberIds.Contains(creatorId))
                memberIds.Insert(0, creatorId);

            if (memberIds.Count < 2)
                throw new InvalidOperationException("A group must have at least 2 members.");

            // Validate all users exist
            var users = await _db.Users.Where(u => memberIds.Contains(u.Id)).ToListAsync();
            if (users.Count != memberIds.Count)
                throw new KeyNotFoundException("One or more users not found.");

            var conversation = new Conversation
            {
                Type = "Group",
                GroupName = dto.GroupName.Trim(),
                GroupAvatar = dto.GroupAvatar,
                CreatedByUserId = creatorId,
                Members = memberIds.Select(uid => new ConversationMember
                {
                    UserId = uid,
                    Role = uid == creatorId ? "Admin" : "Member",
                    JoinedAt = DateTime.UtcNow
                }).ToList()
            };

            _db.Conversations.Add(conversation);
            await _db.SaveChangesAsync();

            // Post a system message: "Alice created this group"
            var creator = users.First(u => u.Id == creatorId);
            await PostSystemMessageAsync(conversation.Id, $"{creator.FullName} created this group.");

            await _db.Entry(conversation).Collection(c => c.Members).LoadAsync();
            foreach (var m in conversation.Members)
                await _db.Entry(m).Reference(x => x.User).LoadAsync();

            return await MapToConversationDto(conversation, creatorId);
        }

        /// <summary>Get all conversations for the sidebar, sorted by most recent message.</summary>
        public async Task<List<ConversationSummaryDto>> GetMyConversationsAsync(int userId)
        {
            var conversations = await _db.Conversations
                .Where(c => c.IsActive && c.Members.Any(m => m.UserId == userId && !m.HasLeft))
                .Include(c => c.Members).ThenInclude(m => m.User)
                .OrderByDescending(c => c.LastMessageAt ?? c.CreatedAt)
                .AsNoTracking()
                .ToListAsync();

            var result = new List<ConversationSummaryDto>();

            foreach (var conv in conversations)
            {
                var myMembership = conv.Members.First(m => m.UserId == userId);
                int unread = await GetUnreadCountAsync(conv.Id, userId);

                // For Direct chats, show the other person's name as the conversation title
                string displayName;
                string? avatarUrl = null;

                if (conv.Type == "Direct")
                {
                    var other = conv.Members.FirstOrDefault(m => m.UserId != userId)?.User;
                    displayName = other?.FullName ?? "Unknown";
                }
                else
                {
                    displayName = conv.GroupName ?? "Group Chat";
                    avatarUrl = conv.GroupAvatar;
                }

                result.Add(new ConversationSummaryDto
                {
                    Id = conv.Id,
                    Type = conv.Type,
                    DisplayName = displayName,
                    AvatarUrl = avatarUrl,
                    LastMessagePreview = conv.LastMessagePreview,
                    LastMessageAt = conv.LastMessageAt,
                    UnreadCount = unread,
                    MemberCount = conv.Members.Count(m => !m.HasLeft),
                    IsMuted = myMembership.IsMuted,
                    // For Direct: is the other person online? (could integrate with UserPresence)
                    OtherUserId = conv.Type == "Direct"
                        ? conv.Members.FirstOrDefault(m => m.UserId != userId)?.UserId
                        : null,
                });
            }

            return result;
        }

        /// <summary>Get full conversation detail including member list (for the chat header).</summary>
        public async Task<ConversationDetailDto> GetConversationDetailAsync(int conversationId, int userId)
        {
            var conv = await _db.Conversations
                .Include(c => c.Members.Where(m => !m.HasLeft)).ThenInclude(m => m.User)
                .FirstOrDefaultAsync(c => c.Id == conversationId && c.IsActive)
                ?? throw new KeyNotFoundException("Conversation not found.");

            AssertMembership(conv, userId);

            var myRole = conv.Members.First(m => m.UserId == userId).Role;

            return new ConversationDetailDto
            {
                Id = conv.Id,
                Type = conv.Type,
                GroupName = conv.GroupName,
                GroupAvatar = conv.GroupAvatar,
                CreatedAt = conv.CreatedAt,
                MyRole = myRole,
                Members = conv.Members.Select(m => new MemberDto
                {
                    UserId = m.UserId,
                    FullName = m.User.FullName,
                    Email = m.User.Email,
                    Role = m.Role,
                    JoinedAt = m.JoinedAt
                }).ToList()
            };
        }

        // ══════════════════════════════════════════════════════════════════════
        // MESSAGES
        // ══════════════════════════════════════════════════════════════════════

        public async Task<ChatMessageDto> SendMessageAsync(int senderId, SendMessageDto dto)
        {
            var conv = await _db.Conversations
                .Include(c => c.Members)
                .FirstOrDefaultAsync(c => c.Id == dto.ConversationId && c.IsActive)
                ?? throw new KeyNotFoundException("Conversation not found.");

            AssertMembership(conv, senderId);

            // Validate reply-to message belongs to this conversation
            if (dto.ReplyToMessageId.HasValue)
            {
                var replyMsg = await _db.ChatMessages.FindAsync(dto.ReplyToMessageId.Value);
                if (replyMsg == null || replyMsg.ConversationId != dto.ConversationId)
                    throw new InvalidOperationException("Invalid reply message.");
            }

            var message = new ChatMessage
            {
                ConversationId = dto.ConversationId,
                SenderId = senderId,
                Content = dto.Content.Trim(),
                MessageType = dto.MessageType ?? "Text",
                AttachmentUrl = dto.AttachmentUrl,
                AttachmentName = dto.AttachmentName,
                ReplyToMessageId = dto.ReplyToMessageId,
                SentAt = DateTime.UtcNow
            };

            _db.ChatMessages.Add(message);

            // Update conversation's last message cache
            conv.LastMessageAt = message.SentAt;
            conv.LastMessagePreview = TruncatePreview(dto.Content);

            await _db.SaveChangesAsync();

            // Auto-mark as read for the sender
            await MarkMessageReadAsync(message.Id, senderId);

            // Load sender for the DTO
            await _db.Entry(message).Reference(m => m.Sender).LoadAsync();

            return MapToMessageDto(message);
        }

        /// <summary>
        /// Paginated message history. Pass beforeMessageId to load older messages
        /// (cursor-based pagination, more efficient than offset).
        /// </summary>
        public async Task<List<ChatMessageDto>> GetMessagesAsync(
            int conversationId, int userId, int pageSize = 50, int? beforeMessageId = null)
        {
            var conv = await _db.Conversations.Include(c => c.Members)
                .FirstOrDefaultAsync(c => c.Id == conversationId)
                ?? throw new KeyNotFoundException("Conversation not found.");

            AssertMembership(conv, userId);

            var query = _db.ChatMessages
                .Where(m => m.ConversationId == conversationId);

            if (beforeMessageId.HasValue)
                query = query.Where(m => m.Id < beforeMessageId.Value);

            var messages = await query
                .Include(m => m.Sender)
                .Include(m => m.Reactions).ThenInclude(r => r.User)
                .Include(m => m.ReadReceipts).ThenInclude(r => r.User)
                .Include(m => m.ReplyToMessage).ThenInclude(r => r.Sender)
                .OrderByDescending(m => m.SentAt)
                .Take(pageSize)
                .AsNoTracking()
                .ToListAsync();

            messages.Reverse(); // Oldest first for display
            return messages.Select(MapToMessageDto).ToList();
        }

        public async Task<ChatMessageDto> EditMessageAsync(int messageId, int userId, string newContent)
        {
            var message = await _db.ChatMessages
                .Include(m => m.Sender)
                .FirstOrDefaultAsync(m => m.Id == messageId)
                ?? throw new KeyNotFoundException("Message not found.");

            if (message.SenderId != userId)
                throw new UnauthorizedAccessException("You can only edit your own messages.");

            if (message.IsDeleted)
                throw new InvalidOperationException("Cannot edit a deleted message.");

            message.Content = newContent.Trim();
            message.IsEdited = true;
            message.EditedAt = DateTime.UtcNow;

            await _db.SaveChangesAsync();
            return MapToMessageDto(message);
        }

        public async Task DeleteMessageAsync(int messageId, int userId)
        {
            var message = await _db.ChatMessages.FindAsync(messageId)
                ?? throw new KeyNotFoundException("Message not found.");

            // Managers and admins can delete any message
            var user = await _db.Users.FindAsync(userId)!;
            bool isManager = user?.Role is "Manager" or "Admin";

            if (message.SenderId != userId && !isManager)
                throw new UnauthorizedAccessException("You can only delete your own messages.");

            message.IsDeleted = true;
            message.Content = "This message was deleted.";
            await _db.SaveChangesAsync();
        }

        // ══════════════════════════════════════════════════════════════════════
        // READ RECEIPTS
        // ══════════════════════════════════════════════════════════════════════

        public async Task MarkConversationReadAsync(int conversationId, int userId)
        {
            // Update member's LastReadAt to now
            var member = await _db.ConversationMembers
                .FirstOrDefaultAsync(m => m.ConversationId == conversationId && m.UserId == userId);

            if (member != null)
            {
                member.LastReadAt = DateTime.UtcNow;
                await _db.SaveChangesAsync();
            }

            // Create read receipts for all unread messages
            var lastReadAt = member?.LastReadAt ?? DateTime.MinValue;
            var unreadMessages = await _db.ChatMessages
                .Where(m => m.ConversationId == conversationId
                    && m.SenderId != userId
                    && !_db.MessageReadReceipts.Any(r => r.MessageId == m.Id && r.UserId == userId))
                .Select(m => m.Id)
                .ToListAsync();

            foreach (var msgId in unreadMessages)
            {
                _db.MessageReadReceipts.Add(new MessageReadReceipt
                {
                    MessageId = msgId,
                    UserId = userId,
                    ReadAt = DateTime.UtcNow
                });
            }

            await _db.SaveChangesAsync();
        }

        public async Task<int> GetUnreadCountAsync(int conversationId, int userId)
        {
            var member = await _db.ConversationMembers
                .FirstOrDefaultAsync(m => m.ConversationId == conversationId && m.UserId == userId);

            if (member == null) return 0;

            var lastRead = member.LastReadAt ?? DateTime.MinValue;

            return await _db.ChatMessages
                .CountAsync(m => m.ConversationId == conversationId
                    && m.SenderId != userId
                    && m.SentAt > lastRead
                    && !m.IsDeleted);
        }

        public async Task<Dictionary<int, int>> GetAllUnreadCountsAsync(int userId)
        {
            var members = await _db.ConversationMembers
                .Where(m => m.UserId == userId && !m.HasLeft)
                .ToListAsync();

            var result = new Dictionary<int, int>();
            foreach (var m in members)
                result[m.ConversationId] = await GetUnreadCountAsync(m.ConversationId, userId);

            return result;
        }

        // ══════════════════════════════════════════════════════════════════════
        // REACTIONS
        // ══════════════════════════════════════════════════════════════════════

        /// <summary>
        /// Toggle: if the user already has this emoji on this message, remove it.
        /// Otherwise add it (replacing any existing emoji from this user on this message).
        /// </summary>
        public async Task<ReactionResult> ToggleReactionAsync(int messageId, int userId, string emoji)
        {
            var existingReaction = await _db.MessageReactions
                .FirstOrDefaultAsync(r => r.MessageId == messageId && r.UserId == userId);

            bool added;

            if (existingReaction != null && existingReaction.Emoji == emoji)
            {
                // Same emoji → remove it (toggle off)
                _db.MessageReactions.Remove(existingReaction);
                added = false;
            }
            else if (existingReaction != null)
            {
                // Different emoji → replace it
                existingReaction.Emoji = emoji;
                existingReaction.ReactedAt = DateTime.UtcNow;
                added = true;
            }
            else
            {
                // New reaction
                _db.MessageReactions.Add(new MessageReaction
                {
                    MessageId = messageId,
                    UserId = userId,
                    Emoji = emoji,
                    ReactedAt = DateTime.UtcNow
                });
                added = true;
            }

            await _db.SaveChangesAsync();

            // Return updated reaction counts for this message
            var counts = await _db.MessageReactions
                .Where(r => r.MessageId == messageId)
                .GroupBy(r => r.Emoji)
                .Select(g => new { Emoji = g.Key, Count = g.Count() })
                .ToDictionaryAsync(x => x.Emoji, x => x.Count);

            return new ReactionResult
            {
                MessageId = messageId,
                Emoji = emoji,
                Added = added,
                ReactionCounts = counts
            };
        }

        // ══════════════════════════════════════════════════════════════════════
        // GROUP MANAGEMENT
        // ══════════════════════════════════════════════════════════════════════

        public async Task AddMembersToGroupAsync(int conversationId, int requestingUserId, List<int> newMemberIds)
        {
            var conv = await _db.Conversations.Include(c => c.Members)
                .FirstOrDefaultAsync(c => c.Id == conversationId && c.Type == "Group")
                ?? throw new KeyNotFoundException("Group conversation not found.");

            AssertGroupAdmin(conv, requestingUserId);

            var requester = await _db.Users.FindAsync(requestingUserId);

            foreach (var uid in newMemberIds.Distinct())
            {
                var existing = conv.Members.FirstOrDefault(m => m.UserId == uid);
                if (existing != null && !existing.HasLeft) continue; // Already a member

                if (existing != null && existing.HasLeft)
                {
                    // Re-add
                    existing.HasLeft = false;
                    existing.LeftAt = null;
                    existing.JoinedAt = DateTime.UtcNow;
                }
                else
                {
                    conv.Members.Add(new ConversationMember
                    {
                        UserId = uid,
                        Role = "Member",
                        JoinedAt = DateTime.UtcNow
                    });
                }

                var newUser = await _db.Users.FindAsync(uid);
                if (newUser != null)
                    await PostSystemMessageAsync(conversationId,
                        $"{requester?.FullName} added {newUser.FullName} to the group.");
            }

            await _db.SaveChangesAsync();
        }

        public async Task RemoveMemberFromGroupAsync(int conversationId, int requestingUserId, int targetUserId)
        {
            var conv = await _db.Conversations.Include(c => c.Members)
                .FirstOrDefaultAsync(c => c.Id == conversationId && c.Type == "Group")
                ?? throw new KeyNotFoundException("Group not found.");

            AssertGroupAdmin(conv, requestingUserId);

            var target = conv.Members.FirstOrDefault(m => m.UserId == targetUserId)
                ?? throw new KeyNotFoundException("Member not found in group.");

            target.HasLeft = true;
            target.LeftAt = DateTime.UtcNow;

            var requester = await _db.Users.FindAsync(requestingUserId);
            var removed = await _db.Users.FindAsync(targetUserId);
            await PostSystemMessageAsync(conversationId,
                $"{requester?.FullName} removed {removed?.FullName} from the group.");

            await _db.SaveChangesAsync();
        }

        public async Task LeaveGroupAsync(int conversationId, int userId)
        {
            var conv = await _db.Conversations.Include(c => c.Members)
                .FirstOrDefaultAsync(c => c.Id == conversationId && c.Type == "Group")
                ?? throw new KeyNotFoundException("Group not found.");

            var member = conv.Members.FirstOrDefault(m => m.UserId == userId && !m.HasLeft)
                ?? throw new InvalidOperationException("You are not a member of this group.");

            member.HasLeft = true;
            member.LeftAt = DateTime.UtcNow;

            var user = await _db.Users.FindAsync(userId);
            await PostSystemMessageAsync(conversationId, $"{user?.FullName} left the group.");
            await _db.SaveChangesAsync();
        }

        public async Task UpdateGroupInfoAsync(int conversationId, int userId, string? name, string? avatar)
        {
            var conv = await _db.Conversations.Include(c => c.Members)
                .FirstOrDefaultAsync(c => c.Id == conversationId && c.Type == "Group")
                ?? throw new KeyNotFoundException("Group not found.");

            AssertGroupAdmin(conv, userId);

            if (!string.IsNullOrWhiteSpace(name)) conv.GroupName = name.Trim();
            if (avatar != null) conv.GroupAvatar = avatar;

            await _db.SaveChangesAsync();
        }

        public async Task PromoteToAdminAsync(int conversationId, int requestingUserId, int targetUserId)
        {
            var conv = await _db.Conversations.Include(c => c.Members)
                .FirstOrDefaultAsync(c => c.Id == conversationId && c.Type == "Group")
                ?? throw new KeyNotFoundException("Group not found.");

            AssertGroupAdmin(conv, requestingUserId);

            var target = conv.Members.FirstOrDefault(m => m.UserId == targetUserId)
                ?? throw new KeyNotFoundException("Member not found.");

            target.Role = "Admin";
            await _db.SaveChangesAsync();
        }

        // ══════════════════════════════════════════════════════════════════════
        // SEARCH
        // ══════════════════════════════════════════════════════════════════════

        public async Task<List<ChatMessageDto>> SearchMessagesAsync(int conversationId, int userId, string query)
        {
            var conv = await _db.Conversations.Include(c => c.Members)
                .FirstOrDefaultAsync(c => c.Id == conversationId)
                ?? throw new KeyNotFoundException("Conversation not found.");

            AssertMembership(conv, userId);

            if (string.IsNullOrWhiteSpace(query) || query.Length < 2)
                return new List<ChatMessageDto>();

            var messages = await _db.ChatMessages
                .Where(m => m.ConversationId == conversationId
                    && !m.IsDeleted
                    && m.Content.Contains(query))
                .Include(m => m.Sender)
                .Include(m => m.Reactions)
                .OrderByDescending(m => m.SentAt)
                .Take(50)
                .AsNoTracking()
                .ToListAsync();

            return messages.Select(MapToMessageDto).ToList();
        }

        // ══════════════════════════════════════════════════════════════════════
        // USERS FOR CHAT
        // ══════════════════════════════════════════════════════════════════════

        public async Task<List<UserChatProfileDto>> GetUsersForChatAsync(int currentUserId)
        {
            var users = await _db.Users
                .Where(u => u.Id != currentUserId && u.IsActive)
                .OrderBy(u => u.FullName)
                .AsNoTracking()
                .ToListAsync();

            // Get presence for online status
            var presences = await _db.UserPresences
                .Where(p => users.Select(u => u.Id).Contains(p.UserId))
                .ToDictionaryAsync(p => p.UserId);

            return users.Select(u =>
            {
                presences.TryGetValue(u.Id, out var presence);
                return new UserChatProfileDto
                {
                    Id = u.Id,
                    FullName = u.FullName,
                    Email = u.Email,
                    Role = u.Role,
                    OnlineStatus = presence?.Status ?? "Offline",
                    StatusMessage = presence?.StatusMessage
                };
            }).ToList();
        }

        // ── Private helpers ──────────────────────────────────────────────────

        private static void AssertMembership(Conversation conv, int userId)
        {
            bool isMember = conv.Members.Any(m => m.UserId == userId && !m.HasLeft);
            if (!isMember)
                throw new UnauthorizedAccessException("You are not a member of this conversation.");
        }

        private static void AssertGroupAdmin(Conversation conv, int userId)
        {
            AssertMembership(conv, userId);
            bool isAdmin = conv.Members.Any(m => m.UserId == userId && m.Role == "Admin" && !m.HasLeft);
            if (!isAdmin)
                throw new UnauthorizedAccessException("Only group admins can perform this action.");
        }

        private async Task MarkMessageReadAsync(int messageId, int userId)
        {
            bool alreadyRead = await _db.MessageReadReceipts
                .AnyAsync(r => r.MessageId == messageId && r.UserId == userId);

            if (!alreadyRead)
            {
                _db.MessageReadReceipts.Add(new MessageReadReceipt
                {
                    MessageId = messageId,
                    UserId = userId,
                    ReadAt = DateTime.UtcNow
                });
                await _db.SaveChangesAsync();
            }
        }

        private async Task PostSystemMessageAsync(int conversationId, string text)
        {
            _db.ChatMessages.Add(new ChatMessage
            {
                ConversationId = conversationId,
                SenderId = null, 
                Content = text,
                MessageType = "System",
                SentAt = DateTime.UtcNow
            });

            await _db.SaveChangesAsync();
        }

        private static string TruncatePreview(string content) =>
            content.Length <= 60 ? content : content[..57] + "...";

        private async Task<ConversationDto> MapToConversationDto(Conversation conv, int currentUserId)
        {
            int unread = await GetUnreadCountAsync(conv.Id, currentUserId);

            string displayName;
            int? otherUserId = null;

            if (conv.Type == "Direct")
            {
                var other = conv.Members.FirstOrDefault(m => m.UserId != currentUserId)?.User;
                displayName = other?.FullName ?? "Unknown";
                otherUserId = other?.Id;
            }
            else
            {
                displayName = conv.GroupName ?? "Group Chat";
            }

            return new ConversationDto
            {
                Id = conv.Id,
                Type = conv.Type,
                DisplayName = displayName,
                GroupAvatar = conv.GroupAvatar,
                OtherUserId = otherUserId,
                UnreadCount = unread,
                LastMessageAt = conv.LastMessageAt,
                LastMessagePreview = conv.LastMessagePreview,
                MemberCount = conv.Members.Count(m => !m.HasLeft)
            };
        }

        private static ChatMessageDto MapToMessageDto(ChatMessage m) => new()
        {
            Id = m.Id,
            ConversationId = m.ConversationId,
            SenderId = m.SenderId,
            SenderName = m.MessageType == "System" ? "System" : m.Sender?.FullName ?? "",
            SenderInitial = m.MessageType == "System"
            ? "S"
            : (!string.IsNullOrWhiteSpace(m.Sender?.FullName)
                ? m.Sender.FullName.Substring(0, 1)
                : "?"),
            Content = m.Content,
            MessageType = m.MessageType,
            AttachmentUrl = m.AttachmentUrl,
            AttachmentName = m.AttachmentName,
            IsDeleted = m.IsDeleted,
            IsEdited = m.IsEdited,
            SentAt = m.SentAt,
            EditedAt = m.EditedAt,
            ReplyTo = m.ReplyToMessage == null ? null : new ReplyPreviewDto
            {
                Id = m.ReplyToMessage.Id,
                SenderName = m.ReplyToMessage.Sender?.FullName ?? "",
                ContentPreview = m.ReplyToMessage.IsDeleted
                    ? "This message was deleted."
                    : TruncatePreview(m.ReplyToMessage.Content)
            },
            Reactions = m.Reactions?
                .GroupBy(r => r.Emoji)
                .Select(g => new ReactionDto
                {
                    Emoji = g.Key,
                    Count = g.Count(),
                    UserIds = g.Select(r => r.UserId).ToList()
                }).ToList() ?? new(),
            ReadByUserIds = m.ReadReceipts?.Select(r => r.UserId).ToList() ?? new()
        };


    }
}
