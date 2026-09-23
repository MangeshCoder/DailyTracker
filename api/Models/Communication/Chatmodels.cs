using DailyTrackerAPI.Models.Auth;
using System.ComponentModel.DataAnnotations;

namespace DailyTrackerAPI.Models.Communication
{
    // ─── 1. Conversation ──────────────────────────────────────────────────────
    public class Conversation
    {
        public int Id { get; set; }
        [Required, MaxLength(20)]
        public string Type { get; set; } = "Direct";
        [MaxLength(100)]
        public string? GroupName { get; set; }
        [MaxLength(500)]
        public string? GroupAvatar { get; set; }
        public int CreatedByUserId { get; set; }
        public virtual User CreatedBy { get; set; } = null!;
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime? LastMessageAt { get; set; }
        [MaxLength(500)]
        public string? LastMessagePreview { get; set; }
        public bool IsActive { get; set; } = true;

        public virtual ICollection<ConversationMember> Members { get; set; } = new List<ConversationMember>();
        public virtual ICollection<ChatMessage> Messages { get; set; } = new List<ChatMessage>();
    }

    // ─── 2. ConversationMember ────────────────────────────────────────────────
    public class ConversationMember
    {
        public int Id { get; set; }
        public int ConversationId { get; set; }
        public virtual Conversation Conversation { get; set; } = null!;
        public int UserId { get; set; }
        public virtual User User { get; set; } = null!;
        [MaxLength(20)]
        public string Role { get; set; } = "Member";
        public DateTime JoinedAt { get; set; } = DateTime.UtcNow;
        public bool HasLeft { get; set; } = false;
        public DateTime? LeftAt { get; set; }
        public DateTime? LastReadAt { get; set; }
        public bool IsMuted { get; set; } = false;
    }

    // ─── 3. ChatMessage ───────────────────────────────────────────────────────
    public class ChatMessage
    {
        public int Id { get; set; }
        public int ConversationId { get; set; }
        public virtual Conversation Conversation { get; set; } = null!;
        public int? SenderId { get; set; }
        public virtual User? Sender { get; set; } = null!;
        [Required, MaxLength(4000)]
        public string Content { get; set; } = string.Empty;
        [MaxLength(20)]
        public string MessageType { get; set; } = "Text";
        [MaxLength(1000)]
        public string? AttachmentUrl { get; set; }
        [MaxLength(200)]
        public string? AttachmentName { get; set; }
        public int? ReplyToMessageId { get; set; }
        public virtual ChatMessage? ReplyToMessage { get; set; }
        public bool IsDeleted { get; set; } = false;
        public bool IsEdited { get; set; } = false;
        public DateTime SentAt { get; set; } = DateTime.UtcNow;
        public DateTime? EditedAt { get; set; }

        public virtual ICollection<MessageReaction> Reactions { get; set; } = new List<MessageReaction>();
        public virtual ICollection<MessageReadReceipt> ReadReceipts { get; set; } = new List<MessageReadReceipt>();
    }

    // ─── 4. MessageReadReceipt ────────────────────────────────────────────────
    public class MessageReadReceipt
    {
        public int Id { get; set; }
        public int MessageId { get; set; }
        public virtual ChatMessage Message { get; set; } = null!;
        public int UserId { get; set; }
        public virtual User User { get; set; } = null!;
        public DateTime ReadAt { get; set; } = DateTime.UtcNow;
    }

    // ─── 5. MessageReaction ───────────────────────────────────────────────────
    public class MessageReaction
    {
        public int Id { get; set; }
        public int MessageId { get; set; }
        public virtual ChatMessage Message { get; set; } = null!;
        public int UserId { get; set; }
        public virtual User User { get; set; } = null!;
        [Required, MaxLength(10)]
        public string Emoji { get; set; } = string.Empty;
        public DateTime ReactedAt { get; set; } = DateTime.UtcNow;
    }

    // ─── AI COPILOT MODELS ───────────────────────────────────────────────────
    public class SuggestedAction
    {
        public string Id { get; set; } = "act_" + Guid.NewGuid().ToString("N");
        public string Type { get; set; } = string.Empty; // "CREATE_TASK" | "CHECK_IN" | "CHECK_OUT" | "APPLY_WFH" | "SUBMIT_EOD"
        public string Title { get; set; } = string.Empty;
        public Dictionary<string, object> Payload { get; set; } = new();
    }

    public class ChatRequest
    {
        public string Message { get; set; } = string.Empty;
        public List<MessageHistory> History { get; set; } = new();
    }

    public class MessageHistory
    {
        public string Role { get; set; } = string.Empty; // "user" or "assistant"
        public string Content { get; set; } = string.Empty;
    }

    public class ChatResponse
    {
        public string Reply { get; set; } = string.Empty;
        public List<SuggestedAction>? Actions { get; set; } = new();
        public bool Success { get; set; }
        public string? Error { get; set; }
    }

    public class ExecuteActionRequest
    {
        public string Type { get; set; } = string.Empty;
        public Dictionary<string, object> Payload { get; set; } = new();
    }
}