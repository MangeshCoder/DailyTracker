using DailyTrackerAPI.Data;
using DailyTrackerAPI.DTOs;
using DailyTrackerAPI.Models.HR;
using DailyTrackerAPI.Services.Communication;
using Microsoft.EntityFrameworkCore;
namespace DailyTrackerAPI.Services.HR
{
    // ─── Interface ────────────────────────────────────────────────────────────
    public interface IResignationService
    {
        // Employee
        Task<ResignationDto> SubmitAsync(int userId, SubmitResignationDto dto);
        Task<ResignationDto?> GetMyResignationAsync(int userId);
        Task<bool> WithdrawAsync(int userId);

        // Manager
        Task<ResignationSummaryDto> GetSummaryAsync();
        Task<List<ResignationDto>> GetAllAsync(string? status = null);
        Task<ResignationDto?> GetByIdAsync(int id);
        Task<ResignationDto?> ReviewAsync(int managerId, int id, ReviewResignationDto dto);
        Task<ResignationDto?> CompleteExitAsync(int managerId, int id, CompleteExitDto dto);

        // Checklist
        Task<ExitChecklistItemDto?> ToggleChecklistItemAsync(int managerId, int itemId);
        Task<ExitChecklistItemDto?> AddChecklistItemAsync(int managerId, int resignationId, AddChecklistItemDto dto);
        Task<bool> DeleteChecklistItemAsync(int managerId, int itemId);
    }

    // ─── Implementation ───────────────────────────────────────────────────────
    public class ResignationService : IResignationService
    {
        private readonly AppDbContext _db;
        private readonly IAppNotificationService _notify;

        // Default checklist items auto-created when manager accepts a resignation
        private static readonly string[] DefaultChecklistTasks =
        {
            "Return laptop / equipment",
            "Revoke system access & accounts",
            "Knowledge transfer completed",
            "Handover documentation received",
            "Final salary processed",
            "Experience letter issued",
            "Exit interview conducted",
            "Company assets returned",
        };

        public ResignationService(AppDbContext db, IAppNotificationService notify)
        {
            _db = db;
            _notify = notify;
        }

        // ══════════════════════════════════════════════════════════════════════
        //  EMPLOYEE
        // ══════════════════════════════════════════════════════════════════════

        public async Task<ResignationDto> SubmitAsync(int userId, SubmitResignationDto dto)
        {
            // Only one active resignation allowed at a time
            var existing = await _db.Resignations
                .FirstOrDefaultAsync(r => r.UserId == userId
                    && (r.Status == "Pending" || r.Status == "Accepted"));

            if (existing != null)
                throw new InvalidOperationException(
                    $"You already have a {existing.Status.ToLower()} resignation. Withdraw it first.");

            if (dto.RequestedLastDay.Date < DateTime.UtcNow.Date.AddDays(1))
                throw new InvalidOperationException("Requested last day must be at least tomorrow.");

            var resignation = new Resignation
            {
                UserId = userId,
                Reason = dto.Reason.Trim(),
                RequestedLastDay = dto.RequestedLastDay.Date,
                Status = "Pending",
                SubmittedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow,
            };

            _db.Resignations.Add(resignation);
            await _db.SaveChangesAsync();

            // Notify all managers
            var managers = await _db.Users
                .Where(u => u.Role == "Manager" || u.Role == "TeamLead")
                .Select(u => u.Id)
                .ToListAsync();

            var employee = await _db.Users.FindAsync(userId);
            if (managers.Any())
                await _notify.CreateForUsersAsync(
                    managers,
                    "Resignation Submitted",
                    $"{employee?.FullName} has submitted a resignation letter. Last day requested: {dto.RequestedLastDay:MMM d, yyyy}.",
                    "Warning",
                    "/resignation"
                );

            await _db.Entry(resignation).Reference(r => r.User).LoadAsync();
            return MapDto(resignation, userId);
        }

        public async Task<ResignationDto?> GetMyResignationAsync(int userId)
        {
            var r = await ResignationQuery()
                .Where(r => r.UserId == userId)
                .OrderByDescending(r => r.SubmittedAt)
                .FirstOrDefaultAsync();

            return r == null ? null : MapDto(r, userId);
        }

        public async Task<bool> WithdrawAsync(int userId)
        {
            var r = await _db.Resignations
                .FirstOrDefaultAsync(r => r.UserId == userId && r.Status == "Pending");

            if (r == null) return false;

            _db.Resignations.Remove(r);
            await _db.SaveChangesAsync();
            return true;
        }

        // ══════════════════════════════════════════════════════════════════════
        //  MANAGER
        // ══════════════════════════════════════════════════════════════════════

        public async Task<ResignationSummaryDto> GetSummaryAsync()
        {
            var all = await ResignationQuery().ToListAsync();
            return new ResignationSummaryDto
            {
                PendingCount = all.Count(r => r.Status == "Pending"),
                AcceptedCount = all.Count(r => r.Status == "Accepted"),
                CompletedCount = all.Count(r => r.Status == "Completed"),
                RejectedCount = all.Count(r => r.Status == "Rejected"),
                Active = all
                    .Where(r => r.Status == "Pending" || r.Status == "Accepted")
                    .OrderBy(r => r.RequestedLastDay)
                    .Select(r => MapDto(r, 0))
                    .ToList(),
            };
        }

        public async Task<List<ResignationDto>> GetAllAsync(string? status = null)
        {
            var query = ResignationQuery();
            if (!string.IsNullOrEmpty(status))
                query = query.Where(r => r.Status == status);

            var list = await query.OrderByDescending(r => r.SubmittedAt).ToListAsync();
            return list.Select(r => MapDto(r, 0)).ToList();
        }

        public async Task<ResignationDto?> GetByIdAsync(int id)
        {
            var r = await ResignationQuery().FirstOrDefaultAsync(r => r.Id == id);
            return r == null ? null : MapDto(r, 0);
        }

        public async Task<ResignationDto?> ReviewAsync(int managerId, int id, ReviewResignationDto dto)
        {
            var r = await ResignationQuery().FirstOrDefaultAsync(r => r.Id == id);
            if (r == null) return null;
            if (r.Status != "Pending")
                throw new InvalidOperationException($"Resignation is already {r.Status}.");

            if (dto.Decision == "Accepted" && !dto.NoticePeriodEndDate.HasValue)
                throw new InvalidOperationException("NoticePeriodEndDate is required when accepting.");

            r.Status = dto.Decision; // "Accepted" | "Rejected"
            r.ReviewedByUserId = managerId;
            r.ReviewNote = dto.ReviewNote?.Trim();
            r.ReviewedAt = DateTime.UtcNow;
            r.UpdatedAt = DateTime.UtcNow;
            r.NoticePeriodEndDate = dto.Decision == "Accepted" ? dto.NoticePeriodEndDate?.Date : null;

            // Auto-create default exit checklist when accepted
            if (dto.Decision == "Accepted")
            {
                foreach (var task in DefaultChecklistTasks)
                {
                    _db.ExitChecklistItems.Add(new ExitChecklistItem
                    {
                        ResignationId = r.Id,
                        Task = task,
                        IsCompleted = false,
                    });
                }
            }

            await _db.SaveChangesAsync();

            // Notify the employee
            var notifMsg = dto.Decision == "Accepted"
                ? $"Your resignation has been accepted. Official last day: {r.NoticePeriodEndDate:MMM d, yyyy}."
                : $"Your resignation has been rejected. Note: {dto.ReviewNote ?? "No note provided."}";

            await _notify.CreateAsync(
                r.UserId,
                $"Resignation {dto.Decision}",
                notifMsg,
                dto.Decision == "Accepted" ? "Warning" : "Info",
                "/resignation"
            );

            // Reload checklist
            await _db.Entry(r).Collection(x => x.ChecklistItems).LoadAsync();
            return MapDto(r, r.UserId);
        }

        public async Task<ResignationDto?> CompleteExitAsync(int managerId, int id, CompleteExitDto dto)
        {
            var r = await ResignationQuery().FirstOrDefaultAsync(r => r.Id == id);
            if (r == null) return null;
            if (r.Status != "Accepted")
                throw new InvalidOperationException("Only accepted resignations can be completed.");

            r.Status = "Completed";
            r.ExitDate = dto.ExitDate.Date;
            r.UpdatedAt = DateTime.UtcNow;
            if (dto.FinalNote != null) r.ReviewNote = dto.FinalNote.Trim();

            // Deactivate the employee account
            var user = await _db.Users.FindAsync(r.UserId);
            if (user != null) user.IsActive = false;

            await _db.SaveChangesAsync();

            await _notify.CreateAsync(
                r.UserId,
                "Exit Completed",
                $"Your exit has been processed. Last working day: {dto.ExitDate:MMM d, yyyy}. Thank you for your service.",
                "Info"
            );

            return MapDto(r, r.UserId);
        }

        // ══════════════════════════════════════════════════════════════════════
        //  CHECKLIST
        // ══════════════════════════════════════════════════════════════════════

        public async Task<ExitChecklistItemDto?> ToggleChecklistItemAsync(int managerId, int itemId)
        {
            var item = await _db.ExitChecklistItems
                .Include(i => i.CompletedBy)
                .FirstOrDefaultAsync(i => i.Id == itemId);

            if (item == null) return null;

            item.IsCompleted = !item.IsCompleted;
            item.CompletedAt = item.IsCompleted ? DateTime.UtcNow : null;
            item.CompletedByUserId = item.IsCompleted ? managerId : null;

            await _db.SaveChangesAsync();

            if (item.CompletedByUserId.HasValue)
                await _db.Entry(item).Reference(i => i.CompletedBy).LoadAsync();

            return MapChecklistItem(item);
        }

        public async Task<ExitChecklistItemDto?> AddChecklistItemAsync(
            int managerId, int resignationId, AddChecklistItemDto dto)
        {
            var exists = await _db.Resignations.AnyAsync(r => r.Id == resignationId);
            if (!exists) return null;

            var item = new ExitChecklistItem
            {
                ResignationId = resignationId,
                Task = dto.Task.Trim(),
                IsCompleted = false,
            };
            _db.ExitChecklistItems.Add(item);
            await _db.SaveChangesAsync();
            return MapChecklistItem(item);
        }

        public async Task<bool> DeleteChecklistItemAsync(int managerId, int itemId)
        {
            var item = await _db.ExitChecklistItems.FindAsync(itemId);
            if (item == null) return false;
            _db.ExitChecklistItems.Remove(item);
            await _db.SaveChangesAsync();
            return true;
        }

        // ─── Helpers ──────────────────────────────────────────────────────────

        private IQueryable<Resignation> ResignationQuery() =>
            _db.Resignations
                .Include(r => r.User)
                .Include(r => r.ReviewedBy)
                .Include(r => r.ChecklistItems)
                    .ThenInclude(c => c.CompletedBy);

        private static ResignationDto MapDto(Resignation r, int currentUserId)
        {
            int? daysRemaining = null;
            if (r.Status == "Accepted" && r.NoticePeriodEndDate.HasValue)
            {
                daysRemaining = (int)(r.NoticePeriodEndDate.Value.Date - DateTime.UtcNow.Date).TotalDays;
                if (daysRemaining < 0) daysRemaining = 0;
            }

            return new ResignationDto
            {
                Id = r.Id,
                UserId = r.UserId,
                EmployeeName = r.User?.FullName ?? "",
                Department = r.User?.Department,
                Designation = r.User?.Designation,
                Reason = r.Reason,
                RequestedLastDay = r.RequestedLastDay,
                Status = r.Status,
                ReviewNote = r.ReviewNote,
                ReviewedByName = r.ReviewedBy?.FullName,
                ReviewedAt = r.ReviewedAt,
                NoticePeriodEndDate = r.NoticePeriodEndDate,
                ExitDate = r.ExitDate,
                SubmittedAt = r.SubmittedAt,
                NoticeDaysRemaining = daysRemaining,
                IsMyResignation = currentUserId > 0 && r.UserId == currentUserId,
                ChecklistItems = r.ChecklistItems
                    .OrderBy(c => c.Id)
                    .Select(MapChecklistItem)
                    .ToList(),
            };
        }

        private static ExitChecklistItemDto MapChecklistItem(ExitChecklistItem c) => new()
        {
            Id = c.Id,
            Task = c.Task,
            IsCompleted = c.IsCompleted,
            CompletedAt = c.CompletedAt,
            CompletedByName = c.CompletedBy?.FullName,
        };
    }
}
