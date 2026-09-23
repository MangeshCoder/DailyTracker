// ─────────────────────────────────────────────────────────────────────────────
//  FEATURE 1 — FILE 1
//  backend/Services/Dailylogservice.cs
//  ACTION: REPLACE entire file
//
//  Change: CheckInAsync now detects weekend/holiday and sets DayStatus
//  accordingly instead of blocking. Same location logic applies.
//  Weekend  → DayStatus = "Weekend"
//  Holiday  → DayStatus = "Holiday"
//  Normal   → DayStatus = "Present" (or WFH if approved)
// ─────────────────────────────────────────────────────────────────────────────

using DailyTrackerAPI.Data;
using DailyTrackerAPI.DTOs;
using DailyTrackerAPI.Models;
using DailyTrackerAPI.Models.Tasks;
using DailyTrackerAPI.Services.Tasks;
using Microsoft.EntityFrameworkCore;

namespace DailyTrackerAPI.Services.Attendance
{
    public interface IDailyLogService
    {
        Task<DailyLogResponseDto?> CheckInAsync(int userId, CheckInDto dto);
        Task<DailyLogResponseDto?> CheckOutAsync(int userId, CheckOutDto dto);
        Task<DailyLogResponseDto?> GetTodayLogAsync(int userId);
        Task<DailyLogResponseDto?> GetLogByDateAsync(int userId, DateTime date);
        Task<List<DailyLogResponseDto>> GetHistoryAsync(int userId, int days = 30);
    }

    public class DailyLogService : IDailyLogService
    {
        private readonly AppDbContext _db;
        private readonly ILocationService _location;

        public DailyLogService(AppDbContext db, ILocationService location)
        {
            _db = db;
            _location = location;
        }

        public async Task<DailyLogResponseDto?> CheckInAsync(int userId, CheckInDto dto)
        {
            var today = DateTime.UtcNow.Date;

            var existing = await _db.DailyLogs
                .FirstOrDefaultAsync(d => d.UserId == userId && d.LogDate == today);

            // Already checked in today
            if (existing != null && existing.CheckInTime != null)
            {
                return null; // Controller returns 400 "Already checked in today."
            }

            // ── STEP 1: Detect weekend ────────────────────────────────────────
            var isWeekend = today.DayOfWeek is DayOfWeek.Saturday or DayOfWeek.Sunday;

            // ── STEP 2: Detect public holiday ─────────────────────────────────
            var holiday = await _db.Holidays
                .FirstOrDefaultAsync(h => h.Date.Date == today);
            var isHoliday = holiday != null;

            // ── STEP 3: Check for approved WFH ───────────────────────────────
            var approvedWFH = await _db.WFHRequests
                .FirstOrDefaultAsync(r =>
                    r.UserId == userId &&
                    r.RequestDate.Date == today &&
                    r.Status == "Approved" &&
                    r.RequestType == "WFH");
            var isWFH = approvedWFH != null;

            // ── STEP 4: Location check ────────────────────────────────────────
            if (!isWFH && !isWeekend && !isHoliday)
            {
                var distance = _location.GetDistanceFromOffice(dto.Latitude, dto.Longitude);
                if (!_location.IsWithinOffice(dto.Latitude, dto.Longitude))
                {
                    throw new LocationException(
                        $"You are not at the office. " +
                        $"You must be within {_location.RadiusMetres:0}m of {_location.OfficeName} to check in. " +
                        $"Your current distance: {distance:0}m. " +
                        $"If you are working from home, please apply for a WFH request first."
                    );
                }
            }

            // ── STEP 5: Determine DayStatus ───────────────────────────────────
            string dayStatus;
            if (isWFH) dayStatus = "WFH";
            else if (isHoliday) dayStatus = "Holiday";
            else if (isWeekend) dayStatus = "Weekend";
            else dayStatus = "Present";

            // ── STEP 6: Create or Update log ──────────────────────────────────
            DailyLog log;
            if (existing != null)
            {
                existing.CheckInTime = DateTime.UtcNow;
                existing.DayStatus = dayStatus;
                if (!string.IsNullOrWhiteSpace(dto.Notes)) existing.Notes = dto.Notes;
                existing.CheckInLatitude = (isWFH || isWeekend || isHoliday) ? null : dto.Latitude;
                existing.CheckInLongitude = (isWFH || isWeekend || isHoliday) ? null : dto.Longitude;
                log = existing;
            }
            else
            {
                log = new DailyLog
                {
                    UserId = userId,
                    LogDate = today,
                    CheckInTime = DateTime.UtcNow,
                    DayStatus = dayStatus,
                    Notes = dto.Notes,
                    CheckInLatitude = (isWFH || isWeekend || isHoliday) ? null : dto.Latitude,
                    CheckInLongitude = (isWFH || isWeekend || isHoliday) ? null : dto.Longitude,
                };
                _db.DailyLogs.Add(log);
            }

            await _db.SaveChangesAsync();

            if (approvedWFH != null)
            {
                approvedWFH.DailyLogId = log.Id;
                await _db.SaveChangesAsync();
            }

            return await MapToDtoAsync(log.Id);
        }

        public async Task<DailyLogResponseDto?> CheckOutAsync(int userId, CheckOutDto dto)
        {
            var today = DateTime.UtcNow.Date;
            var log = await _db.DailyLogs
                .Include(d => d.BreakLogs)
                .FirstOrDefaultAsync(d => d.UserId == userId && d.LogDate == today);

            if (log == null || log.CheckInTime == null) return null;

            // Skip location check for WFH, Weekend, Holiday
            var skipLocation = log.DayStatus is "WFH" or "Weekend" or "Holiday";

            if (!skipLocation)
            {
                var distance = _location.GetDistanceFromOffice(dto.Latitude, dto.Longitude);
                if (!_location.IsWithinOffice(dto.Latitude, dto.Longitude))
                {
                    throw new LocationException(
                        $"You are not at the office. " +
                        $"You must be within {_location.RadiusMetres:0}m of {_location.OfficeName} to check out. " +
                        $"Your current distance: {distance:0}m."
                    );
                }
                log.CheckOutLatitude = dto.Latitude;
                log.CheckOutLongitude = dto.Longitude;
            }

            var activeBreak = log.BreakLogs.FirstOrDefault(b => b.IsActive);
            if (activeBreak != null)
            {
                activeBreak.EndTime = DateTime.UtcNow;
                activeBreak.DurationMinutes = (int)(DateTime.UtcNow - activeBreak.StartTime).TotalMinutes;
                activeBreak.IsActive = false;
            }

            log.CheckOutTime = DateTime.UtcNow;
            log.TotalBreakMinutes = log.BreakLogs.Sum(b => b.DurationMinutes);
            var totalElapsed = (int)(log.CheckOutTime.Value - log.CheckInTime.Value).TotalMinutes;
            log.TotalWorkMinutes = Math.Max(0, totalElapsed - log.TotalBreakMinutes);

            if (dto.Notes != null) log.Notes = dto.Notes;

            await _db.SaveChangesAsync();
            return await MapToDtoAsync(log.Id);
        }

        public async Task<DailyLogResponseDto?> GetTodayLogAsync(int userId)
        {
            var today = DateTime.UtcNow.Date;
            var log = await _db.DailyLogs.FirstOrDefaultAsync(d => d.UserId == userId && d.LogDate == today);
            if (log == null) return null;
            return await MapToDtoAsync(log.Id);
        }

        public async Task<DailyLogResponseDto?> GetLogByDateAsync(int userId, DateTime date)
        {
            var log = await _db.DailyLogs.FirstOrDefaultAsync(d => d.UserId == userId && d.LogDate == date.Date);
            if (log == null) return null;
            return await MapToDtoAsync(log.Id);
        }

        public async Task<List<DailyLogResponseDto>> GetHistoryAsync(int userId, int days = 30)
        {
            var from = DateTime.UtcNow.Date.AddDays(-days);
            var logs = await _db.DailyLogs
                .Where(d => d.UserId == userId && d.LogDate >= from)
                .OrderByDescending(d => d.LogDate)
                .ToListAsync();

            var result = new List<DailyLogResponseDto>();
            foreach (var log in logs)
                result.Add(await MapToDtoAsync(log.Id));
            return result;
        }

        private async Task<DailyLogResponseDto> MapToDtoAsync(int logId)
        {
            var log = await _db.DailyLogs
                .Include(d => d.BreakLogs)
                .Include(d => d.TaskLogs)
                .Include(d => d.SupportLogs).ThenInclude(s => s.SupportedDeveloper)
                .Include(d => d.SupportLogs).ThenInclude(s => s.SupportEngineer)
                .Include(d => d.SupportLogs).ThenInclude(s => s.MediaEvidences)
                .FirstAsync(d => d.Id == logId);

            var workMins = log.TotalWorkMinutes;
            if (log.CheckInTime != null && log.CheckOutTime == null)
            {
                var elapsed = (int)(DateTime.UtcNow - log.CheckInTime.Value).TotalMinutes;
                var breakMins = log.BreakLogs.Where(b => !b.IsActive).Sum(b => b.DurationMinutes);
                var activeBreak = log.BreakLogs.FirstOrDefault(b => b.IsActive);
                if (activeBreak != null)
                    breakMins += (int)(DateTime.UtcNow - activeBreak.StartTime).TotalMinutes;
                workMins = Math.Max(0, elapsed - breakMins);
            }

            return new DailyLogResponseDto
            {
                Id = log.Id,
                LogDate = log.LogDate,
                CheckInTime = log.CheckInTime,
                CheckOutTime = log.CheckOutTime,
                TotalWorkMinutes = workMins,
                TotalBreakMinutes = log.BreakLogs.Sum(b => b.DurationMinutes),
                DayStatus = log.DayStatus,
                Notes = log.Notes,
                WorkHours = FormatMinutes(workMins),
                Breaks = log.BreakLogs.Select(b => new BreakLogDto
                {
                    Id = b.Id,
                    BreakType = b.BreakType,
                    StartTime = b.StartTime,
                    EndTime = b.EndTime,
                    DurationMinutes = b.IsActive
                        ? (int)(DateTime.UtcNow - b.StartTime).TotalMinutes
                        : b.DurationMinutes,
                    IsActive = b.IsActive
                }).ToList(),
                Tasks = log.TaskLogs.Select(t => new TaskLogDto
                {
                    Id = t.Id,
                    TaskTitle = t.TaskTitle,
                    Description = t.Description,
                    ProjectName = t.ProjectName,
                    Status = t.Status,
                    TimeSpentMinutes = t.TimeSpentMinutes,
                    Priority = t.Priority,
                    Tags = t.Tags,
                    CompletedAt = t.CompletedAt,
                    CreatedAt = t.CreatedAt
                }).ToList(),
                SupportLogs = log.SupportLogs.Select(s => new SupportLogResponseDto
                {
                    Id = s.Id,
                    SupportEngineerName = s.SupportEngineer?.FullName ?? "",
                    SupportedDeveloperName = s.SupportedDeveloper.FullName,
                    IssueDescription = s.IssueDescription,
                    Resolution = s.Resolution,
                    TimeSpentMinutes = s.TimeSpentMinutes,
                    SupportType = s.SupportType,
                    SupportedAt = s.SupportedAt,
                    Media = s.MediaEvidences.Select(m => new MediaEvidenceDto
                    {
                        Id = m.Id,
                        MediaType = m.MediaType,
                        FileName = m.FileName,
                        Url = $"/api/support/media/{m.Id}",
                        FileSizeBytes = m.FileSizeBytes,
                        MimeType = m.MimeType
                    }).ToList()
                }).ToList()
            };
        }

        private static string FormatMinutes(int minutes)
        {
            var h = minutes / 60;
            var m = minutes % 60;
            return $"{h}h {m}m";
        }
    }
}