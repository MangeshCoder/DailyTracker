using DailyTrackerAPI.Models.Auth;
using System.ComponentModel.DataAnnotations;

namespace DailyTrackerAPI.Models.Performance
{
    // ─── Feature 7: Performance Review Cycle ──────────────────────────────────
    //
    // Flow:
    //   Manager creates ReviewCycle  →  assigns employees
    //   Employee submits SelfAssessment
    //   Manager submits ManagerReview with per-competency ratings
    //   Review status moves: Pending → SelfAssessment → ManagerReview → Completed
    //   ReviewCycle status: Active → Closed
    // ──────────────────────────────────────────────────────────────────────────

    /// <summary>
    /// A named period (e.g. "Q1 2025", "Annual 2024") created by a manager.
    /// One cycle contains many individual PerformanceReviews — one per employee.
    /// </summary>
    public class ReviewCycle
    {
        public int Id { get; set; }

        [Required, MaxLength(100)]
        public string Title { get; set; } = string.Empty;      // "Q1 2025 Review"

        [MaxLength(500)]
        public string? Description { get; set; }

        /// <summary>Quarterly | HalfYearly | Annual | Custom</summary>
        [MaxLength(20)]
        public string CycleType { get; set; } = "Quarterly";

        public DateTime StartDate { get; set; }
        public DateTime EndDate { get; set; }

        /// <summary>Deadline for employees to submit their self-assessments</summary>
        public DateTime? SelfAssessmentDueDate { get; set; }

        /// <summary>Active | Closed</summary>
        [MaxLength(20)]
        public string Status { get; set; } = "Active";

        // Who created this cycle (always a Manager/TeamLead)
        public int CreatedByUserId { get; set; }
        public virtual User CreatedBy { get; set; } = null!;

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        // Navigation
        public ICollection<PerformanceReview> Reviews { get; set; } = new List<PerformanceReview>();
    }

    /// <summary>
    /// One employee's review within a cycle.
    /// Contains both the employee's self-assessment and the manager's review.
    /// </summary>
    public class PerformanceReview
    {
        public int Id { get; set; }

        public int ReviewCycleId { get; set; }
        public virtual ReviewCycle ReviewCycle { get; set; } = null!;

        // The employee being reviewed
        public int RevieweeId { get; set; }
        public virtual User Reviewee { get; set; } = null!;

        // The manager conducting the review
        public int ReviewerId { get; set; }
        public virtual User Reviewer { get; set; } = null!;

        // ── Self-Assessment (filled by employee) ──────────────────────────────
        [MaxLength(2000)]
        public string? SelfAssessmentText { get; set; }

        /// <summary>Employee's own rating of their overall performance (1–5)</summary>
        public int? SelfRating { get; set; }

        [MaxLength(1000)]
        public string? Achievements { get; set; }   // What went well

        [MaxLength(1000)]
        public string? Improvements { get; set; }   // Areas to improve

        [MaxLength(1000)]
        public string? Goals { get; set; }           // Goals for next period

        public DateTime? SelfSubmittedAt { get; set; }

        // ── Manager Review (filled by manager) ────────────────────────────────
        [MaxLength(2000)]
        public string? ManagerFeedback { get; set; }

        /// <summary>Overall rating given by manager (1–5)</summary>
        public int? OverallRating { get; set; }

        [MaxLength(1000)]
        public string? StrengthsNote { get; set; }

        [MaxLength(1000)]
        public string? DevelopmentNote { get; set; }

        public DateTime? ManagerSubmittedAt { get; set; }

        // ── Status ────────────────────────────────────────────────────────────
        /// <summary>Pending → SelfAssessment → ManagerReview → Completed</summary>
        [MaxLength(20)]
        public string Status { get; set; } = "Pending";

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

        // Navigation
        public ICollection<ReviewRating> Ratings { get; set; } = new List<ReviewRating>();
    }

    /// <summary>
    /// Per-competency rating given by the manager inside a PerformanceReview.
    /// Fixed competencies: TechnicalSkills, Communication, Teamwork,
    ///   ProblemSolving, DeliveryQuality, Initiative
    /// Scale: 1 (Needs Improvement) → 5 (Outstanding)
    /// </summary>
    public class ReviewRating
    {
        public int Id { get; set; }

        public int PerformanceReviewId { get; set; }
        public virtual PerformanceReview PerformanceReview { get; set; } = null!;

        [Required, MaxLength(50)]
        public string Competency { get; set; } = string.Empty;  // "TechnicalSkills" etc.

        /// <summary>1–5</summary>
        public int Score { get; set; }

        [MaxLength(500)]
        public string? Comment { get; set; }
    }
}
