using DailyTrackerAPI.Models.Auth;

namespace DailyTrackerAPI.Models.HR
{
    /// <summary>
    /// A new joiner's first-days checklist. Started automatically when a manager
    /// approves a new account (or by hand from the Onboarding page); finished when
    /// every step is done.
    /// </summary>
    public class OnboardingPlan
    {
        public int Id { get; set; }
        public int UserId { get; set; }                    // the new joiner (one plan each)
        public int? BuddyUserId { get; set; }              // a colleague who helps them settle in
        public int CreatedById { get; set; }
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime? CompletedAt { get; set; }

        public virtual User User { get; set; } = null!;
        public virtual User? Buddy { get; set; }
        public virtual User CreatedBy { get; set; } = null!;
        public virtual ICollection<OnboardingTask> Tasks { get; set; } = new List<OnboardingTask>();
    }

    public class OnboardingTask
    {
        public int Id { get; set; }
        public int PlanId { get; set; }
        public string Title { get; set; } = "";
        /// <summary>"Manual", or a step the app checks itself: Profile, Face, Documents, TwoFactor, FirstCheckIn, Buddy</summary>
        public string Kind { get; set; } = "Manual";
        /// <summary>Who does it: Employee or Manager</summary>
        public string Owner { get; set; } = "Employee";
        public int SortOrder { get; set; }
        public DateTime? DoneAt { get; set; }
        public int? DoneById { get; set; }

        public virtual OnboardingPlan Plan { get; set; } = null!;
    }
}
