namespace DailyTrackerAPI.DTOs
{
    public class OnboardingTaskDto
    {
        public int Id { get; set; }
        public string Title { get; set; } = "";
        public string Kind { get; set; } = "Manual";
        public string Owner { get; set; } = "Employee";
        public bool Done { get; set; }
        public DateTime? DoneAt { get; set; }
        /// <summary>The page where the step is done (app-checked steps)</summary>
        public string? Link { get; set; }
        /// <summary>Whether the person looking may tick it</summary>
        public bool CanTick { get; set; }
    }

    public class OnboardingPlanDto
    {
        public int Id { get; set; }
        public int UserId { get; set; }
        public string UserName { get; set; } = "";
        public string Role { get; set; } = "";
        public DateTime? JoinDate { get; set; }
        public int? BuddyUserId { get; set; }
        public string? BuddyName { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime? CompletedAt { get; set; }
        public int DoneCount { get; set; }
        public int TotalCount { get; set; }
        public List<OnboardingTaskDto> Tasks { get; set; } = new();
    }

    public class OnboardingCandidateDto
    {
        public int UserId { get; set; }
        public string FullName { get; set; } = "";
        public string Role { get; set; } = "";
        public DateTime JoinedOn { get; set; }
    }

    public class StartOnboardingDto
    {
        public int UserId { get; set; }
        public int? BuddyUserId { get; set; }
    }

    public class SetBuddyDto
    {
        public int? BuddyUserId { get; set; }
    }

    public class AddOnboardingTaskDto
    {
        public string Title { get; set; } = "";
        public string Owner { get; set; } = "Employee";
    }

    public class TickOnboardingTaskDto
    {
        public bool Done { get; set; }
    }
}
