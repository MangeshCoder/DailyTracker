using DailyTrackerAPI.Models.Auth;

namespace DailyTrackerAPI.Models.HR
{
    /// <summary>
    /// "I'm away — X decides my team's requests from … to …". While it runs, the
    /// delegate approves leave, WFH, comp-off, expenses and check-out corrections
    /// for the away manager's / team lead's people, and gets their notifications.
    /// </summary>
    public class ApprovalDelegation
    {
        public int Id { get; set; }
        public int FromUserId { get; set; }                 // the one who is away
        public int ToUserId { get; set; }                   // who decides meanwhile
        public DateTime StartDate { get; set; }             // India dates, both days included
        public DateTime EndDate { get; set; }
        public string? Note { get; set; }
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime? CancelledAt { get; set; }

        public virtual User From { get; set; } = null!;
        public virtual User To { get; set; } = null!;
    }
}
