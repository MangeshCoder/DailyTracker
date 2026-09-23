using DailyTrackerAPI.Models.Auth;
using System.ComponentModel.DataAnnotations;

namespace DailyTrackerAPI.Models.Communication
{
    // ─── Feature: Meeting Log ─────────────────────────────────────────────────
    // A meeting is created by one user (organiser) and has N attendees.
    // Attendees are stored as a child table MeetingAttendee (userId + response).
    // Action items are stored as a child table MeetingActionItem.

    public class Meeting
    {
        public int Id { get; set; }

        [Required, MaxLength(200)]
        public string Title { get; set; } = string.Empty;

        [MaxLength(2000)]
        public string? Agenda { get; set; }

        [MaxLength(2000)]
        public string? Notes { get; set; }           // minutes recorded during/after

        [MaxLength(100)]
        public string? Location { get; set; }        // Room / Zoom link / Teams etc.

        /// <summary>StandUp | Planning | Review | Retrospective | OneOnOne | Other</summary>
        [MaxLength(30)]
        public string MeetingType { get; set; } = "Other";

        public DateTime ScheduledAt { get; set; }    // start time (UTC)
        public int DurationMinutes { get; set; } = 30;

        /// <summary>Scheduled | InProgress | Completed | Cancelled</summary>
        [MaxLength(20)]
        public string Status { get; set; } = "Scheduled";

        public bool IsRecurring { get; set; } = false;

        /// <summary>Daily | Weekly | BiWeekly | Monthly — null when not recurring</summary>
        [MaxLength(20)]
        public string? RecurrencePattern { get; set; }

        // Organiser
        public int OrganisedByUserId { get; set; }
        public virtual User OrganisedBy { get; set; } = null!;

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

        // Navigation
        public ICollection<MeetingAttendee> Attendees { get; set; } = new List<MeetingAttendee>();
        public ICollection<MeetingActionItem> ActionItems { get; set; } = new List<MeetingActionItem>();
    }

    /// <summary>Join table: which users are invited and their RSVP</summary>
    public class MeetingAttendee
    {
        public int Id { get; set; }

        public int MeetingId { get; set; }
        public virtual Meeting Meeting { get; set; } = null!;

        public int UserId { get; set; }
        public virtual User User { get; set; } = null!;

        /// <summary>Pending | Accepted | Declined | Maybe</summary>
        [MaxLength(20)]
        public string Response { get; set; } = "Pending";

        public bool Attended { get; set; } = false;   // marked after meeting ends
    }

    /// <summary>Action items / follow-ups captured during the meeting</summary>
    public class MeetingActionItem
    {
        public int Id { get; set; }

        public int MeetingId { get; set; }
        public virtual Meeting Meeting { get; set; } = null!;

        [Required, MaxLength(500)]
        public string Description { get; set; } = string.Empty;

        /// <summary>User responsible for this action item (optional)</summary>
        public int? AssignedToUserId { get; set; }
        public virtual User? AssignedTo { get; set; }

        /// <summary>Open | InProgress | Done</summary>
        [MaxLength(20)]
        public string Status { get; set; } = "Open";

        public DateTime? DueDate { get; set; }
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}
