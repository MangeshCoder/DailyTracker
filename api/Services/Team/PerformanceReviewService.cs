using DailyTrackerAPI.Data;
using DailyTrackerAPI.DTOs;
using DailyTrackerAPI.Models.Performance;
using DailyTrackerAPI.Services.Communication;
using Microsoft.EntityFrameworkCore;

namespace DailyTrackerAPI.Services.Team
{
    public interface IPerformanceReviewService
    {
        // Cycles (manager)
        Task<ReviewCycleDto> CreateCycleAsync(int managerId, CreateReviewCycleDto dto);
        Task<List<ReviewCycleDto>> GetCyclesAsync(int userId);
        Task<ReviewCycleDto?> GetCycleByIdAsync(int cycleId, int userId);
        Task<ReviewCycleDto?> CloseCycleAsync(int cycleId, int managerId);

        // Reviews (employee — self-assessment)
        Task<PerformanceReviewDto?> GetMyReviewAsync(int reviewId, int userId);
        Task<List<PerformanceReviewDto>> GetMyReviewsAsync(int userId);
        Task<PerformanceReviewDto?> SubmitSelfAssessmentAsync(int reviewId, int userId, SubmitSelfAssessmentDto dto);

        // Reviews (manager — manager review)
        Task<List<PerformanceReviewDto>> GetTeamReviewsAsync(int managerId, int? cycleId);
        Task<PerformanceReviewDto?> SubmitManagerReviewAsync(int reviewId, int managerId, SubmitManagerReviewDto dto);
    }

    public class PerformanceReviewService : IPerformanceReviewService
    {
        private readonly AppDbContext _db;
        private readonly IAppNotificationService _notify;

        public PerformanceReviewService(AppDbContext db, IAppNotificationService notify)
        {
            _db = db;
            _notify = notify;
        }

        // ── CYCLES ────────────────────────────────────────────────────────────

        public async Task<ReviewCycleDto> CreateCycleAsync(int managerId, CreateReviewCycleDto dto)
        {
            var cycle = new ReviewCycle
            {
                Title = dto.Title.Trim(),
                Description = dto.Description?.Trim(),
                CycleType = dto.CycleType,
                StartDate = dto.StartDate.ToUniversalTime(),
                EndDate = dto.EndDate.ToUniversalTime(),
                SelfAssessmentDueDate = dto.SelfAssessmentDueDate?.ToUniversalTime(),
                Status = "Active",
                CreatedByUserId = managerId,
            };

            _db.ReviewCycles.Add(cycle);
            await _db.SaveChangesAsync();

            // Create one PerformanceReview per included employee
            foreach (var revieweeId in dto.RevieweeIds.Distinct())
            {
                _db.PerformanceReviews.Add(new PerformanceReview
                {
                    ReviewCycleId = cycle.Id,
                    RevieweeId = revieweeId,
                    ReviewerId = managerId,
                    Status = "Pending",
                });
            }

            await _db.SaveChangesAsync();

            // Notify each employee
            foreach (var revieweeId in dto.RevieweeIds.Distinct())
            {
                await _notify.CreateAsync(
                    revieweeId,
                    "📋 Performance Review Started",
                    $"A new review cycle \"{cycle.Title}\" has been created. Please complete your self-assessment.",
                    "Info"
                );
            }

            return await GetCycleByIdAsync(cycle.Id, managerId) ?? throw new Exception("Cycle not found after creation");
        }

        public async Task<List<ReviewCycleDto>> GetCyclesAsync(int userId)
        {
            // Manager sees cycles they created; employee sees cycles where they have a review
            var asManager = await _db.ReviewCycles
                .Include(rc => rc.CreatedBy)
                .Include(rc => rc.Reviews).ThenInclude(r => r.Reviewee)
                .Where(rc => rc.CreatedByUserId == userId)
                .OrderByDescending(rc => rc.CreatedAt)
                .ToListAsync();

            var asEmployee = await _db.ReviewCycles
                .Include(rc => rc.CreatedBy)
                .Include(rc => rc.Reviews).ThenInclude(r => r.Reviewee)
                .Where(rc => rc.Reviews.Any(r => r.RevieweeId == userId))
                .OrderByDescending(rc => rc.CreatedAt)
                .ToListAsync();

            // Union, dedup
            var all = asManager.Concat(asEmployee)
                .GroupBy(rc => rc.Id)
                .Select(g => g.First())
                .OrderByDescending(rc => rc.CreatedAt)
                .ToList();

            return all.Select(rc => MapCycleDto(rc, userId)).ToList();
        }

        public async Task<ReviewCycleDto?> GetCycleByIdAsync(int cycleId, int userId)
        {
            var cycle = await _db.ReviewCycles
                .Include(rc => rc.CreatedBy)
                .Include(rc => rc.Reviews).ThenInclude(r => r.Reviewee)
                .FirstOrDefaultAsync(rc => rc.Id == cycleId);

            if (cycle == null) return null;

            bool canView = cycle.CreatedByUserId == userId ||
                           cycle.Reviews.Any(r => r.RevieweeId == userId);

            return canView ? MapCycleDto(cycle, userId) : null;
        }

        public async Task<ReviewCycleDto?> CloseCycleAsync(int cycleId, int managerId)
        {
            var cycle = await _db.ReviewCycles
                .Include(rc => rc.CreatedBy)
                .Include(rc => rc.Reviews).ThenInclude(r => r.Reviewee)
                .FirstOrDefaultAsync(rc => rc.Id == cycleId && rc.CreatedByUserId == managerId);

            if (cycle == null) return null;

            cycle.Status = "Closed";

            // Mark all manager-reviewed reviews as Completed
            foreach (var review in cycle.Reviews.Where(r => r.Status == "ManagerReview"))
            {
                review.Status = "Completed";
                review.UpdatedAt = DateTime.UtcNow;
            }

            await _db.SaveChangesAsync();

            // Notify each completed employee
            foreach (var review in cycle.Reviews.Where(r => r.Status == "Completed"))
            {
                await _notify.CreateAsync(
                    review.RevieweeId,
                    "✅ Performance Review Completed",
                    $"Your review for \"{cycle.Title}\" has been finalised.",
                    "Success"
                );
            }

            return MapCycleDto(cycle, managerId);
        }

        // ── EMPLOYEE — SELF ASSESSMENT ────────────────────────────────────────

        public async Task<List<PerformanceReviewDto>> GetMyReviewsAsync(int userId)
        {
            var reviews = await LoadReviewsQuery()
                .Where(r => r.RevieweeId == userId)
                .OrderByDescending(r => r.ReviewCycle.StartDate)
                .ToListAsync();

            return reviews.Select(MapReviewDto).ToList();
        }

        public async Task<PerformanceReviewDto?> GetMyReviewAsync(int reviewId, int userId)
        {
            var review = await LoadReviewsQuery()
                .FirstOrDefaultAsync(r => r.Id == reviewId);

            if (review == null) return null;

            bool canView = review.RevieweeId == userId || review.ReviewerId == userId;
            return canView ? MapReviewDto(review) : null;
        }

        public async Task<PerformanceReviewDto?> SubmitSelfAssessmentAsync(
            int reviewId, int userId, SubmitSelfAssessmentDto dto)
        {
            var review = await LoadReviewsQuery()
                .FirstOrDefaultAsync(r => r.Id == reviewId && r.RevieweeId == userId);

            if (review == null) return null;

            // Can only submit if cycle is Active and review hasn't been manager-reviewed yet
            if (review.ReviewCycle.Status != "Active") return null;
            if (review.Status == "ManagerReview" || review.Status == "Completed") return null;

            review.SelfAssessmentText = dto.SelfAssessmentText.Trim();
            review.SelfRating = Math.Clamp(dto.SelfRating, 1, 5);
            review.Achievements = dto.Achievements?.Trim();
            review.Improvements = dto.Improvements?.Trim();
            review.Goals = dto.Goals?.Trim();
            review.SelfSubmittedAt = DateTime.UtcNow;
            review.Status = "SelfAssessment";
            review.UpdatedAt = DateTime.UtcNow;

            await _db.SaveChangesAsync();

            // Notify the reviewer (manager)
            await _notify.CreateAsync(
                review.ReviewerId,
                "📝 Self-Assessment Submitted",
                $"{review.Reviewee.FullName} has submitted their self-assessment for \"{review.ReviewCycle.Title}\".",
                "Info"
            );

            return MapReviewDto(review);
        }

        // ── MANAGER — MANAGER REVIEW ──────────────────────────────────────────

        public async Task<List<PerformanceReviewDto>> GetTeamReviewsAsync(int managerId, int? cycleId)
        {
            var query = LoadReviewsQuery()
                .Where(r => r.ReviewerId == managerId);

            if (cycleId.HasValue)
                query = query.Where(r => r.ReviewCycleId == cycleId.Value);

            var reviews = await query
                .OrderByDescending(r => r.ReviewCycle.StartDate)
                .ThenBy(r => r.Reviewee.FullName)
                .ToListAsync();

            return reviews.Select(MapReviewDto).ToList();
        }

        public async Task<PerformanceReviewDto?> SubmitManagerReviewAsync(
            int reviewId, int managerId, SubmitManagerReviewDto dto)
        {
            var review = await LoadReviewsQuery()
                .FirstOrDefaultAsync(r => r.Id == reviewId && r.ReviewerId == managerId);

            if (review == null) return null;
            if (review.ReviewCycle.Status != "Active") return null;
            // Employee must have submitted self-assessment first
            if (review.Status == "Pending") return null;
            if (review.Status == "Completed") return null;

            review.ManagerFeedback = dto.ManagerFeedback.Trim();
            review.OverallRating = Math.Clamp(dto.OverallRating, 1, 5);
            review.StrengthsNote = dto.StrengthsNote?.Trim();
            review.DevelopmentNote = dto.DevelopmentNote?.Trim();
            review.ManagerSubmittedAt = DateTime.UtcNow;
            review.Status = "ManagerReview";
            review.UpdatedAt = DateTime.UtcNow;

            // Upsert competency ratings
            foreach (var input in dto.Ratings)
            {
                var existing = review.Ratings.FirstOrDefault(r => r.Competency == input.Competency);
                if (existing != null)
                {
                    existing.Score = Math.Clamp(input.Score, 1, 5);
                    existing.Comment = input.Comment?.Trim();
                }
                else
                {
                    _db.ReviewRatings.Add(new ReviewRating
                    {
                        PerformanceReviewId = review.Id,
                        Competency = input.Competency,
                        Score = Math.Clamp(input.Score, 1, 5),
                        Comment = input.Comment?.Trim(),
                    });
                }
            }

            await _db.SaveChangesAsync();

            // Notify employee their review is ready
            await _notify.CreateAsync(
                review.RevieweeId,
                "🎯 Your Performance Review is Ready",
                $"Your manager has submitted feedback for \"{review.ReviewCycle.Title}\". You can now view your review.",
                "Success"
            );

            // Reload to get updated ratings
            review = await LoadReviewsQuery()
                .FirstAsync(r => r.Id == reviewId);

            return MapReviewDto(review);
        }

        // ── Helpers ───────────────────────────────────────────────────────────

        private IQueryable<PerformanceReview> LoadReviewsQuery() =>
            _db.PerformanceReviews
               .Include(r => r.ReviewCycle).ThenInclude(rc => rc.CreatedBy)
               .Include(r => r.Reviewee)
               .Include(r => r.Reviewer)
               .Include(r => r.Ratings);

        private static ReviewCycleDto MapCycleDto(ReviewCycle rc, int currentUserId)
        {
            var myReview = rc.Reviews.FirstOrDefault(r => r.RevieweeId == currentUserId);
            return new ReviewCycleDto
            {
                Id = rc.Id,
                Title = rc.Title,
                Description = rc.Description,
                CycleType = rc.CycleType,
                StartDate = rc.StartDate,
                EndDate = rc.EndDate,
                SelfAssessmentDueDate = rc.SelfAssessmentDueDate,
                Status = rc.Status,
                CreatedByName = rc.CreatedBy?.FullName ?? "",
                CreatedAt = rc.CreatedAt,
                TotalReviews = rc.Reviews.Count,
                PendingCount = rc.Reviews.Count(r => r.Status == "Pending"),
                SelfSubmittedCount = rc.Reviews.Count(r => r.Status == "SelfAssessment"),
                CompletedCount = rc.Reviews.Count(r => r.Status is "ManagerReview" or "Completed"),
                MyReview = myReview == null ? null : new PerformanceReviewSummaryDto
                {
                    Id = myReview.Id,
                    RevieweeName = myReview.Reviewee?.FullName ?? "",
                    ProfilePhotoUrl = myReview.Reviewee?.ProfilePhotoUrl,
                    ReviewerName = rc.CreatedBy?.FullName ?? "",
                    Status = myReview.Status,
                    SelfRating = myReview.SelfRating,
                    OverallRating = myReview.OverallRating,
                },
            };
        }

        private static PerformanceReviewDto MapReviewDto(PerformanceReview r) =>
            new()
            {
                Id = r.Id,
                ReviewCycleId = r.ReviewCycleId,
                CycleTitle = r.ReviewCycle?.Title ?? "",
                CycleType = r.ReviewCycle?.CycleType ?? "",
                CycleStart = r.ReviewCycle?.StartDate ?? default,
                CycleEnd = r.ReviewCycle?.EndDate ?? default,
                RevieweeId = r.RevieweeId,
                RevieweeName = r.Reviewee?.FullName ?? "",
                RevieweePhoto = r.Reviewee?.ProfilePhotoUrl,
                RevieweeRole = r.Reviewee?.Role ?? "",
                ReviewerId = r.ReviewerId,
                ReviewerName = r.Reviewer?.FullName ?? "",
                SelfAssessmentText = r.SelfAssessmentText,
                SelfRating = r.SelfRating,
                Achievements = r.Achievements,
                Improvements = r.Improvements,
                Goals = r.Goals,
                SelfSubmittedAt = r.SelfSubmittedAt,
                ManagerFeedback = r.ManagerFeedback,
                OverallRating = r.OverallRating,
                StrengthsNote = r.StrengthsNote,
                DevelopmentNote = r.DevelopmentNote,
                ManagerSubmittedAt = r.ManagerSubmittedAt,
                Ratings = r.Ratings.Select(rt => new ReviewRatingDto
                {
                    Id = rt.Id,
                    Competency = rt.Competency,
                    Score = rt.Score,
                    Comment = rt.Comment,
                }).ToList(),
                Status = r.Status,
                CreatedAt = r.CreatedAt,
                UpdatedAt = r.UpdatedAt,
            };
    }
}
