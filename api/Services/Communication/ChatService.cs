using DailyTrackerAPI.Data;
using DailyTrackerAPI.DTOs;
using DailyTrackerAPI.Models.Communication;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
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
        Task<List<int>> GetMyConversationIdsAsync(int userId);
        Task<ConversationDetailDto> GetConversationDetailAsync(int conversationId, int userId);

        // Messages
        Task<ChatMessageDto> SendMessageAsync(int senderId, SendMessageDto dto);
        Task<List<ChatMessageDto>> GetMessagesAsync(int conversationId, int userId, int pageSize, int? beforeMessageId);
        Task<ChatMessageDto> EditMessageAsync(int messageId, int userId, string newContent);
        Task DeleteMessageAsync(int messageId, int userId);

        // Attachments (images / files)
        Task<ChatMessageDto> SendAttachmentAsync(int senderId, int conversationId, IFormFile file, string? caption, int? replyToMessageId);
        Task<ChatAttachmentFile> GetAttachmentAsync(int messageId, int userId);

        // Pinned messages
        Task<ChatMessageDto> SetPinnedAsync(int messageId, int userId, bool pinned);
        Task<List<ChatMessageDto>> GetPinnedMessagesAsync(int conversationId, int userId);

        // Polls
        Task<ChatMessageDto> CreatePollAsync(int userId, int conversationId, CreatePollDto dto);
        Task<ChatMessageDto> VotePollAsync(int userId, int pollId, List<int> optionIds);
        Task<ChatMessageDto> ClosePollAsync(int userId, int pollId);

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
        private readonly IWebHostEnvironment _env;
        public ChatService(AppDbContext db, IWebHostEnvironment env)
        {
            _db = db;
            _env = env;
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
            // One round trip: membership + members + unread count + @mention flag are
            // computed by the database (was 2 queries per conversation).
            var rows = await _db.ConversationMembers
                .Where(me => me.UserId == userId && !me.HasLeft && me.Conversation.IsActive)
                .Select(me => new
                {
                    me.Conversation.Id,
                    me.Conversation.Type,
                    me.Conversation.GroupName,
                    me.Conversation.GroupAvatar,
                    me.Conversation.CreatedAt,
                    me.Conversation.LastMessageAt,
                    me.Conversation.LastMessagePreview,
                    me.IsMuted,
                    MemberCount = me.Conversation.Members.Count(m => !m.HasLeft),
                    Other = me.Conversation.Members
                        .Where(m => m.UserId != userId)
                        .Select(m => new { m.UserId, m.User.FullName })
                        .FirstOrDefault(),
                    Unread = me.Conversation.Messages.Count(m =>
                        m.SenderId != userId && !m.IsDeleted
                        && m.SentAt > (me.LastReadAt ?? DateTime.MinValue)),
                    UnreadMention = me.Conversation.Messages.Any(m =>
                        m.SenderId != userId && !m.IsDeleted
                        && m.SentAt > (me.LastReadAt ?? DateTime.MinValue)
                        && m.Mentions.Any(x => x.UserId == userId)),
                })
                .AsNoTracking()
                .ToListAsync();

            return rows
                .OrderByDescending(r => r.LastMessageAt ?? r.CreatedAt)
                .Select(r => new ConversationSummaryDto
                {
                    Id = r.Id,
                    Type = r.Type,
                    // Direct chats are titled with the other person's name
                    DisplayName = r.Type == "Direct" ? r.Other?.FullName ?? "Unknown" : r.GroupName ?? "Group Chat",
                    AvatarUrl = r.Type == "Direct" ? null : r.GroupAvatar,
                    LastMessagePreview = r.LastMessagePreview,
                    LastMessageAt = r.LastMessageAt,
                    UnreadCount = r.Unread,
                    HasUnreadMention = r.UnreadMention,
                    MemberCount = r.MemberCount,
                    IsMuted = r.IsMuted,
                    OtherUserId = r.Type == "Direct" ? r.Other?.UserId : null,
                })
                .ToList();
        }

        /// <summary>Ids of my active conversations (for joining SignalR groups)</summary>
        public Task<List<int>> GetMyConversationIdsAsync(int userId) =>
            _db.ConversationMembers
                .Where(m => m.UserId == userId && !m.HasLeft && m.Conversation.IsActive)
                .Select(m => m.ConversationId)
                .ToListAsync();

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

            var content = (dto.Content ?? "").Trim();
            if (content.Length == 0)
                throw new InvalidOperationException("Message cannot be empty.");
            if (content.Length > 4000)
                throw new InvalidOperationException("Message is too long (max 4000 characters).");

            await ValidateReplyAsync(dto.ConversationId, dto.ReplyToMessageId);

            // Text only. Client-supplied MessageType / AttachmentUrl are ignored so
            // nobody can post fake "System" messages or arbitrary links as files —
            // images/files go through SendAttachmentAsync, polls through CreatePollAsync.
            var message = new ChatMessage
            {
                ConversationId = dto.ConversationId,
                SenderId = senderId,
                Content = content,
                MessageType = "Text",
                ReplyToMessageId = dto.ReplyToMessageId,
                SentAt = DateTime.UtcNow
            };

            // @mentions: only current members, never yourself (unknown ids are ignored)
            var memberIds = conv.Members.Where(m => !m.HasLeft).Select(m => m.UserId).ToHashSet();
            foreach (var uid in (dto.MentionedUserIds ?? new()).Distinct().Where(id => id != senderId && memberIds.Contains(id)).Take(50))
                message.Mentions.Add(new ChatMessageMention { UserId = uid });

            return await SaveNewMessageAsync(conv, message);
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
                .Include(m => m.Reactions)          // only UserId/Emoji are used —
                .Include(m => m.ReadReceipts)       // no need to load whole users
                .Include(m => m.ReplyToMessage).ThenInclude(r => r!.Sender)
                .Include(m => m.Poll).ThenInclude(p => p!.Options).ThenInclude(o => o.Votes)
                .Include(m => m.Mentions)
                .OrderByDescending(m => m.SentAt)
                .Take(pageSize)
                .AsSplitQuery()
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
            if (message.MessageType is not ("Text" or "Image" or "File"))
                throw new InvalidOperationException("This message can't be edited.");

            var content = (newContent ?? "").Trim();
            if (content.Length == 0 && message.MessageType == "Text")
                throw new InvalidOperationException("Message cannot be empty.");
            if (content.Length > 4000)
                throw new InvalidOperationException("Message is too long (max 4000 characters).");

            message.Content = content;
            message.IsEdited = true;
            message.EditedAt = DateTime.UtcNow;

            await _db.SaveChangesAsync();
            return await LoadMessageDtoAsync(message.Id);
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
            message.IsPinned = false;
            message.PinnedAt = null;
            message.PinnedByUserId = null;

            // Deleted attachments are removed from disk, not just hidden
            if (!string.IsNullOrEmpty(message.AttachmentUrl))
            {
                TryDeleteStoredFile(message.AttachmentUrl);
                message.AttachmentUrl = null;
            }
            await _db.SaveChangesAsync();
        }

        // ══════════════════════════════════════════════════════════════════════
        // ATTACHMENTS
        //   Stored in <ContentRoot>/App_Data/chat/{conversationId}/ — outside
        //   wwwroot, so the only way to fetch one is GetAttachmentAsync, which
        //   checks conversation membership.
        // ══════════════════════════════════════════════════════════════════════

        public const long MaxAttachmentBytes = 25 * 1024 * 1024;   // 25 MB

        // extension → content type we serve it with (never the client's claim)
        private static readonly Dictionary<string, string> ImageTypes = new(StringComparer.OrdinalIgnoreCase)
        {
            [".jpg"] = "image/jpeg", [".jpeg"] = "image/jpeg", [".png"] = "image/png",
            [".gif"] = "image/gif",  [".webp"] = "image/webp", [".bmp"] = "image/bmp",
        };
        private static readonly Dictionary<string, string> FileTypes = new(StringComparer.OrdinalIgnoreCase)
        {
            [".pdf"] = "application/pdf",
            [".doc"] = "application/msword",
            [".docx"] = "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            [".xls"] = "application/vnd.ms-excel",
            [".xlsx"] = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            [".ppt"] = "application/vnd.ms-powerpoint",
            [".pptx"] = "application/vnd.openxmlformats-officedocument.presentationml.presentation",
            [".odt"] = "application/vnd.oasis.opendocument.text",
            [".ods"] = "application/vnd.oasis.opendocument.spreadsheet",
            [".rtf"] = "application/rtf",
            [".txt"] = "text/plain", [".csv"] = "text/csv", [".md"] = "text/markdown",
            [".json"] = "application/json", [".log"] = "text/plain",
            [".zip"] = "application/zip", [".rar"] = "application/vnd.rar", [".7z"] = "application/x-7z-compressed",
            [".mp4"] = "video/mp4", [".webm"] = "video/webm", [".mov"] = "video/quicktime",
            [".mp3"] = "audio/mpeg", [".wav"] = "audio/wav", [".m4a"] = "audio/mp4",
        };

        public async Task<ChatMessageDto> SendAttachmentAsync(
            int senderId, int conversationId, IFormFile file, string? caption, int? replyToMessageId)
        {
            var conv = await _db.Conversations
                .Include(c => c.Members)
                .FirstOrDefaultAsync(c => c.Id == conversationId && c.IsActive)
                ?? throw new KeyNotFoundException("Conversation not found.");
            AssertMembership(conv, senderId);

            if (file == null || file.Length == 0)
                throw new InvalidOperationException("The file is empty.");
            if (file.Length > MaxAttachmentBytes)
                throw new InvalidOperationException("Files can be up to 25 MB.");

            var ext = Path.GetExtension(file.FileName ?? "");
            var isImage = ImageTypes.TryGetValue(ext, out var contentType);
            if (!isImage && !FileTypes.TryGetValue(ext, out contentType))
                throw new InvalidOperationException($"'{(string.IsNullOrEmpty(ext) ? "This" : ext)}' files can't be shared in chat.");

            // Images must really be images (checked by their first bytes)
            if (isImage && !await LooksLikeImageAsync(file))
                throw new InvalidOperationException("That file isn't a valid image.");

            var text = (caption ?? "").Trim();
            if (text.Length > 4000)
                throw new InvalidOperationException("Caption is too long (max 4000 characters).");

            await ValidateReplyAsync(conversationId, replyToMessageId);

            var key = $"chat/{conversationId}/{Guid.NewGuid():N}{ext.ToLowerInvariant()}";
            var fullPath = ResolveStoragePath(key);
            Directory.CreateDirectory(Path.GetDirectoryName(fullPath)!);
            await using (var stream = new FileStream(fullPath, FileMode.CreateNew))
                await file.CopyToAsync(stream);

            var message = new ChatMessage
            {
                ConversationId = conversationId,
                SenderId = senderId,
                Content = text,
                MessageType = isImage ? "Image" : "File",
                AttachmentUrl = key,
                AttachmentName = SafeFileName(file.FileName),
                AttachmentSize = file.Length,
                AttachmentContentType = contentType,
                ReplyToMessageId = replyToMessageId,
                SentAt = DateTime.UtcNow
            };

            try
            {
                return await SaveNewMessageAsync(conv, message);
            }
            catch
            {
                TryDeleteStoredFile(key);   // don't leave orphan files behind
                throw;
            }
        }

        public async Task<ChatAttachmentFile> GetAttachmentAsync(int messageId, int userId)
        {
            var message = await _db.ChatMessages
                .Include(m => m.Conversation).ThenInclude(c => c.Members)
                .AsNoTracking()
                .FirstOrDefaultAsync(m => m.Id == messageId)
                ?? throw new KeyNotFoundException("Attachment not found.");

            AssertMembership(message.Conversation, userId);

            if (message.IsDeleted || string.IsNullOrEmpty(message.AttachmentUrl))
                throw new KeyNotFoundException("Attachment not found.");

            var fullPath = ResolveStoragePath(message.AttachmentUrl);
            if (!File.Exists(fullPath))
                throw new KeyNotFoundException("Attachment file is missing.");

            return new ChatAttachmentFile(
                fullPath,
                message.AttachmentContentType ?? "application/octet-stream",
                message.AttachmentName ?? Path.GetFileName(fullPath));
        }

        // ══════════════════════════════════════════════════════════════════════
        // PINNED MESSAGES — any member can pin; at most MaxPinned per chat
        // ══════════════════════════════════════════════════════════════════════

        public const int MaxPinned = 10;

        public async Task<ChatMessageDto> SetPinnedAsync(int messageId, int userId, bool pinned)
        {
            var message = await _db.ChatMessages
                .Include(m => m.Conversation).ThenInclude(c => c.Members)
                .FirstOrDefaultAsync(m => m.Id == messageId)
                ?? throw new KeyNotFoundException("Message not found.");

            AssertMembership(message.Conversation, userId);
            if (message.IsDeleted) throw new InvalidOperationException("Deleted messages can't be pinned.");
            if (message.MessageType == "System") throw new InvalidOperationException("System messages can't be pinned.");

            if (pinned && !message.IsPinned)
            {
                var count = await _db.ChatMessages.CountAsync(m => m.ConversationId == message.ConversationId && m.IsPinned);
                if (count >= MaxPinned)
                    throw new InvalidOperationException($"A chat can have at most {MaxPinned} pinned messages. Unpin one first.");
                message.IsPinned = true;
                message.PinnedAt = DateTime.UtcNow;
                message.PinnedByUserId = userId;
            }
            else if (!pinned && message.IsPinned)
            {
                message.IsPinned = false;
                message.PinnedAt = null;
                message.PinnedByUserId = null;
            }

            await _db.SaveChangesAsync();
            return await LoadMessageDtoAsync(message.Id);
        }

        public async Task<List<ChatMessageDto>> GetPinnedMessagesAsync(int conversationId, int userId)
        {
            var conv = await _db.Conversations.Include(c => c.Members)
                .FirstOrDefaultAsync(c => c.Id == conversationId)
                ?? throw new KeyNotFoundException("Conversation not found.");
            AssertMembership(conv, userId);

            var pinned = await _db.ChatMessages
                .Where(m => m.ConversationId == conversationId && m.IsPinned && !m.IsDeleted)
                .Include(m => m.Sender)
                .Include(m => m.Reactions)
                .Include(m => m.ReadReceipts)
                .Include(m => m.ReplyToMessage).ThenInclude(r => r!.Sender)
                .Include(m => m.Poll).ThenInclude(p => p!.Options).ThenInclude(o => o.Votes)
                .Include(m => m.Mentions)
                .OrderByDescending(m => m.PinnedAt)
                .AsSplitQuery()
                .AsNoTracking()
                .ToListAsync();
            return pinned.Select(MapToMessageDto).ToList();
        }

        // ══════════════════════════════════════════════════════════════════════
        // POLLS
        // ══════════════════════════════════════════════════════════════════════

        public async Task<ChatMessageDto> CreatePollAsync(int userId, int conversationId, CreatePollDto dto)
        {
            var conv = await _db.Conversations
                .Include(c => c.Members)
                .FirstOrDefaultAsync(c => c.Id == conversationId && c.IsActive)
                ?? throw new KeyNotFoundException("Conversation not found.");
            AssertMembership(conv, userId);

            var question = (dto.Question ?? "").Trim();
            if (question.Length == 0) throw new InvalidOperationException("Add a question for your poll.");
            if (question.Length > 300) throw new InvalidOperationException("Poll question is too long (max 300 characters).");

            var options = (dto.Options ?? new())
                .Select(o => (o ?? "").Trim())
                .Where(o => o.Length > 0)
                .ToList();
            if (options.Count < 2) throw new InvalidOperationException("A poll needs at least 2 options.");
            if (options.Count > 10) throw new InvalidOperationException("A poll can have at most 10 options.");
            if (options.Any(o => o.Length > 100)) throw new InvalidOperationException("Options can be up to 100 characters.");
            if (options.Distinct(StringComparer.OrdinalIgnoreCase).Count() != options.Count)
                throw new InvalidOperationException("Poll options must be different from each other.");

            var message = new ChatMessage
            {
                ConversationId = conversationId,
                SenderId = userId,
                Content = question,
                MessageType = "Poll",
                SentAt = DateTime.UtcNow,
                Poll = new ChatPoll
                {
                    Question = question,
                    AllowMultiple = dto.AllowMultiple,
                    CreatedByUserId = userId,
                    Options = options.Select((text, i) => new ChatPollOption { Text = text, SortOrder = i }).ToList()
                }
            };

            return await SaveNewMessageAsync(conv, message);
        }

        public async Task<ChatMessageDto> VotePollAsync(int userId, int pollId, List<int> optionIds)
        {
            var poll = await LoadPollForMemberAsync(pollId, userId);
            if (poll.IsClosed) throw new InvalidOperationException("This poll is closed.");

            var chosen = (optionIds ?? new()).Distinct().ToList();
            if (!poll.AllowMultiple && chosen.Count > 1)
                throw new InvalidOperationException("This poll allows only one answer.");
            if (chosen.Any(id => poll.Options.All(o => o.Id != id)))
                throw new InvalidOperationException("Invalid poll option.");

            // Replace this user's votes with exactly the chosen set
            foreach (var option in poll.Options)
            {
                var mine = option.Votes.FirstOrDefault(v => v.UserId == userId);
                var wanted = chosen.Contains(option.Id);
                if (mine != null && !wanted) _db.ChatPollVotes.Remove(mine);
                if (mine == null && wanted) _db.ChatPollVotes.Add(new ChatPollVote { OptionId = option.Id, UserId = userId });
            }

            try { await _db.SaveChangesAsync(); }
            catch (DbUpdateException) { /* double-click race: the unique index kept one vote */ }

            return await LoadMessageDtoAsync(poll.MessageId);
        }

        public async Task<ChatMessageDto> ClosePollAsync(int userId, int pollId)
        {
            var poll = await LoadPollForMemberAsync(pollId, userId);
            var conv = poll.Message.Conversation;
            var isGroupAdmin = conv.Members.Any(m => m.UserId == userId && m.Role == "Admin" && !m.HasLeft);
            if (poll.CreatedByUserId != userId && !isGroupAdmin)
                throw new UnauthorizedAccessException("Only the poll creator or a group admin can close this poll.");

            if (!poll.IsClosed)
            {
                poll.IsClosed = true;
                poll.ClosedAt = DateTime.UtcNow;
                await _db.SaveChangesAsync();
            }
            return await LoadMessageDtoAsync(poll.MessageId);
        }

        private async Task<ChatPoll> LoadPollForMemberAsync(int pollId, int userId)
        {
            var poll = await _db.ChatPolls
                .Include(p => p.Options).ThenInclude(o => o.Votes)
                .Include(p => p.Message).ThenInclude(m => m.Conversation).ThenInclude(c => c.Members)
                .AsSplitQuery()
                .FirstOrDefaultAsync(p => p.Id == pollId)
                ?? throw new KeyNotFoundException("Poll not found.");

            AssertMembership(poll.Message.Conversation, userId);
            if (poll.Message.IsDeleted) throw new KeyNotFoundException("Poll not found.");
            return poll;
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
            // One round trip (was 2 queries per conversation)
            return await _db.ConversationMembers
                .Where(me => me.UserId == userId && !me.HasLeft)
                .Select(me => new
                {
                    me.ConversationId,
                    Unread = me.Conversation.Messages.Count(m =>
                        m.SenderId != userId && !m.IsDeleted
                        && m.SentAt > (me.LastReadAt ?? DateTime.MinValue)),
                })
                .ToDictionaryAsync(x => x.ConversationId, x => x.Unread);
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
                    && (m.Content.Contains(query) || (m.AttachmentName != null && m.AttachmentName.Contains(query))))
                .Include(m => m.Sender)
                .Include(m => m.Reactions)
                .Include(m => m.Poll).ThenInclude(p => p!.Options).ThenInclude(o => o.Votes)
                .Include(m => m.Mentions)
                .Include(m => m.ReplyToMessage).ThenInclude(r => r!.Sender)
                .OrderByDescending(m => m.SentAt)
                .Take(50)
                .AsSplitQuery()
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

        /// <summary>One-line summary used for the conversation list and reply quotes</summary>
        private static string PreviewFor(ChatMessage m) => m.IsDeleted
            ? "This message was deleted."
            : m.MessageType switch
            {
                "Image" => TruncatePreview(string.IsNullOrWhiteSpace(m.Content) ? "📷 Photo" : "📷 " + m.Content),
                "File" => TruncatePreview("📎 " + (m.AttachmentName ?? "File")),
                "Poll" => TruncatePreview("📊 " + (m.Poll?.Question ?? m.Content)),
                _ => TruncatePreview(m.Content),
            };

        private async Task ValidateReplyAsync(int conversationId, int? replyToMessageId)
        {
            if (!replyToMessageId.HasValue) return;
            var replyMsg = await _db.ChatMessages.FindAsync(replyToMessageId.Value);
            if (replyMsg == null || replyMsg.ConversationId != conversationId)
                throw new InvalidOperationException("Invalid reply message.");
        }

        /// <summary>Persist a new message, update the conversation preview, return the full DTO</summary>
        private async Task<ChatMessageDto> SaveNewMessageAsync(Conversation conv, ChatMessage message)
        {
            _db.ChatMessages.Add(message);
            conv.LastMessageAt = message.SentAt;
            conv.LastMessagePreview = PreviewFor(message);
            await _db.SaveChangesAsync();

            await MarkMessageReadAsync(message.Id, message.SenderId!.Value);   // sender has read it
            return await LoadMessageDtoAsync(message.Id);
        }

        /// <summary>Load one message with everything the client renders (reply, reactions, poll)</summary>
        private async Task<ChatMessageDto> LoadMessageDtoAsync(int messageId)
        {
            var m = await _db.ChatMessages
                .Include(x => x.Sender)
                .Include(x => x.Reactions)
                .Include(x => x.ReadReceipts)
                .Include(x => x.ReplyToMessage).ThenInclude(r => r!.Sender)
                .Include(x => x.Poll).ThenInclude(p => p!.Options).ThenInclude(o => o.Votes)
                .Include(x => x.Mentions)
                .AsSplitQuery()
                .AsNoTracking()
                .FirstAsync(x => x.Id == messageId);
            return MapToMessageDto(m);
        }

        private string StorageRoot => Path.GetFullPath(Path.Combine(_env.ContentRootPath, "App_Data"));

        private string ResolveStoragePath(string key)
        {
            var full = Path.GetFullPath(Path.Combine(StorageRoot, key));
            if (!full.StartsWith(StorageRoot + Path.DirectorySeparatorChar, StringComparison.Ordinal))
                throw new UnauthorizedAccessException("Invalid attachment path.");
            return full;
        }

        private void TryDeleteStoredFile(string key)
        {
            try { var path = ResolveStoragePath(key); if (File.Exists(path)) File.Delete(path); }
            catch { /* best effort */ }
        }

        private static string SafeFileName(string? name)
        {
            var clean = Path.GetFileName(name ?? "file");
            clean = new string(clean.Where(c => !char.IsControl(c) && c != '"').ToArray()).Trim();
            if (clean.Length == 0) clean = "file";
            if (clean.Length > 200)
            {
                var ext = Path.GetExtension(clean);
                clean = clean[..(200 - ext.Length)] + ext;
            }
            return clean;
        }

        private static async Task<bool> LooksLikeImageAsync(IFormFile file)
        {
            var head = new byte[12];
            await using var s = file.OpenReadStream();
            var n = await s.ReadAsync(head.AsMemory(0, head.Length));
            if (n < 4) return false;
            bool Starts(params byte[] sig) => n >= sig.Length && head.Take(sig.Length).SequenceEqual(sig);
            return Starts(0xFF, 0xD8, 0xFF)                                   // jpg
                || Starts(0x89, 0x50, 0x4E, 0x47)                             // png
                || Starts(0x47, 0x49, 0x46, 0x38)                             // gif
                || Starts(0x42, 0x4D)                                         // bmp
                || (Starts(0x52, 0x49, 0x46, 0x46) && n >= 12
                    && head[8] == 0x57 && head[9] == 0x45 && head[10] == 0x42 && head[11] == 0x50); // webp
        }

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
            // Never expose the storage key — clients use the member-only endpoint
            AttachmentUrl = !m.IsDeleted && !string.IsNullOrEmpty(m.AttachmentUrl)
                ? $"/api/chat/messages/{m.Id}/attachment"
                : null,
            AttachmentName = m.IsDeleted ? null : m.AttachmentName,
            AttachmentSize = m.IsDeleted ? null : m.AttachmentSize,
            AttachmentContentType = m.IsDeleted ? null : m.AttachmentContentType,
            Poll = m.IsDeleted || m.Poll == null ? null : new ChatPollDto
            {
                Id = m.Poll.Id,
                Question = m.Poll.Question,
                AllowMultiple = m.Poll.AllowMultiple,
                IsClosed = m.Poll.IsClosed,
                CreatedByUserId = m.Poll.CreatedByUserId,
                TotalVoters = m.Poll.Options.SelectMany(o => o.Votes).Select(v => v.UserId).Distinct().Count(),
                Options = m.Poll.Options.OrderBy(o => o.SortOrder).Select(o => new ChatPollOptionDto
                {
                    Id = o.Id,
                    Text = o.Text,
                    VoterIds = o.Votes.Select(v => v.UserId).ToList()
                }).ToList()
            },
            MentionedUserIds = m.IsDeleted ? new() : m.Mentions?.Select(x => x.UserId).ToList() ?? new(),
            IsPinned = m.IsPinned && !m.IsDeleted,
            PinnedAt = m.IsPinned ? m.PinnedAt : null,
            PinnedByUserId = m.IsPinned ? m.PinnedByUserId : null,
            IsDeleted = m.IsDeleted,
            IsEdited = m.IsEdited,
            SentAt = m.SentAt,
            EditedAt = m.EditedAt,
            ReplyTo = m.ReplyToMessage == null ? null : new ReplyPreviewDto
            {
                Id = m.ReplyToMessage.Id,
                SenderName = m.ReplyToMessage.Sender?.FullName ?? "",
                ContentPreview = PreviewFor(m.ReplyToMessage)
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

    public record ChatAttachmentFile(string FullPath, string ContentType, string FileName);
}
