using DailyTrackerAPI.Data;
using DailyTrackerAPI.DTOs;
using DailyTrackerAPI.Models.Tasks;
using DailyTrackerAPI.Services.Communication;
using Microsoft.EntityFrameworkCore;
using DailyTrackerAPI.Helpers;

namespace DailyTrackerAPI.Services.Tasks
{
    // ─────────────────────────────────────────────────────────────────────────
    //  Feature 6: EOD Report Service
    // ─────────────────────────────────────────────────────────────────────────
    public interface IEODService
    {
        Task<EODReportResponseDto> SubmitReportAsync(int userId, CreateEODReportDto dto);
        Task<EODReportResponseDto?> GetTodayReportAsync(int userId);
        Task<List<EODReportResponseDto>> GetUserReportsAsync(int userId, int days = 14);
        Task<List<EODReportResponseDto>> GetAllPendingReviewsAsync();  // Manager
        Task ReviewReportAsync(int reportId, int managerId, ManagerReviewEODDto dto);
    }

    public class EODService : IEODService
    {
        private readonly AppDbContext _db;
        private readonly IAppNotificationService _notif;
        public EODService(AppDbContext db, IAppNotificationService notif) { _db = db; _notif = notif; }

        public async Task<EODReportResponseDto> SubmitReportAsync(int userId, CreateEODReportDto dto)
        {
            var log = await _db.DailyLogs.CurrentForAsync(userId)
                ?? throw new InvalidOperationException("You must check in before submitting EOD report.");
            var today = log.LogDate;   // the work day, even when submitted after midnight

            // Update or create
            var existing = await _db.EODReports.FirstOrDefaultAsync(r => r.UserId == userId && r.ReportDate == today);

            if (existing != null)
            {
                // ❌ BLOCK UPDATE IF ALREADY REVIEWED
                if (existing.IsReviewedByManager)
                {
                    throw new InvalidOperationException(
                        "Manager already reviewed this EOD report. You cannot modify it."
                    );
                }

                // ✅ Allow update only if NOT reviewed
                existing.WhatWasDone = dto.WhatWasDone;
                existing.Blockers = dto.Blockers;
                existing.PlanForTomorrow = dto.PlanForTomorrow;
                existing.Learnings = dto.Learnings;
                existing.MoodRating = dto.MoodRating;
                existing.SubmittedAt = DateTime.UtcNow;
            }
            else
            {
                existing = new EODReport
                {
                    UserId = userId,
                    DailyLogId = log.Id,
                    ReportDate = today,
                    WhatWasDone = dto.WhatWasDone,
                    Blockers = dto.Blockers,
                    PlanForTomorrow = dto.PlanForTomorrow,
                    Learnings = dto.Learnings,
                    MoodRating = dto.MoodRating
                };
                _db.EODReports.Add(existing);
            }

            await _db.SaveChangesAsync();
            return await MapReport(existing);
        }

        public async Task<EODReportResponseDto?> GetTodayReportAsync(int userId)
        {
            var today = (await _db.DailyLogs.CurrentForAsync(userId))?.LogDate ?? AppClock.TodayIst;
            var report = await _db.EODReports
                .Include(r => r.User)
                .FirstOrDefaultAsync(r => r.UserId == userId && r.ReportDate == today);

            return report == null ? null : await MapReport(report);
        }

        public async Task<List<EODReportResponseDto>> GetUserReportsAsync(int userId, int days = 14)
        {
            var from = AppClock.TodayIst.AddDays(-days);
            var reports = await _db.EODReports
                .Include(r => r.User)
                .Where(r => r.UserId == userId && r.ReportDate >= from)
                .OrderByDescending(r => r.ReportDate)
                .ToListAsync();

            var result = new List<EODReportResponseDto>();
            foreach (var r in reports) result.Add(await MapReport(r));
            return result;
        }

        public async Task<List<EODReportResponseDto>> GetAllPendingReviewsAsync()
        {
            var reports = await _db.EODReports
                .Include(r => r.User)
                .Where(r => !r.IsReviewedByManager)
                .OrderByDescending(r => r.ReportDate)
                .ToListAsync();

            var result = new List<EODReportResponseDto>();
            foreach (var r in reports) result.Add(await MapReport(r));
            return result;
        }

        public async Task ReviewReportAsync(int reportId, int managerId, ManagerReviewEODDto dto)
        {
            var report = await _db.EODReports.FindAsync(reportId)
                ?? throw new KeyNotFoundException("Report not found.");

            // Get manager details
            var manager = await _db.Users.FindAsync(managerId);

            report.IsReviewedByManager = true;
            report.ManagerComment = dto.ManagerComment;
            await _db.SaveChangesAsync();

            // ✅ SEND NOTIFICATION TO DEVELOPER
            await _notif.CreateAsync(
                userId: report.UserId,
                title: "📝 EOD Report Reviewed",
                message: $"{manager?.FullName ?? "Manager"} reviewed your EOD report for {report.ReportDate:MMM dd}" +
                    (string.IsNullOrEmpty(dto.ManagerComment) ? "" : $": \"{dto.ManagerComment}\""),
                type: "Info",
                actionUrl: "/eod-reports"  // Navigate to EOD page when clicked
            );
        }

        private static Task<EODReportResponseDto> MapReport(EODReport r) =>
            Task.FromResult(new EODReportResponseDto
            {
                Id = r.Id,
                UserName = r.User?.FullName ?? "Unknown",
                ReportDate = r.ReportDate,
                WhatWasDone = r.WhatWasDone,
                Blockers = r.Blockers,
                PlanForTomorrow = r.PlanForTomorrow,
                Learnings = r.Learnings,
                MoodRating = r.MoodRating,
                SubmittedAt = r.SubmittedAt,
                IsReviewedByManager = r.IsReviewedByManager,
                ManagerComment = r.ManagerComment
            });
    }
}
