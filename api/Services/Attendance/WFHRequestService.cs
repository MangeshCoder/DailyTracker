using DailyTrackerAPI.Data;
using DailyTrackerAPI.DTOs;
using DailyTrackerAPI.Models.Attendance;
using DailyTrackerAPI.Services.Auth;
using Microsoft.EntityFrameworkCore;
using System.Text;

namespace DailyTrackerAPI.Services.Attendance
{
    // ═══════════════════════════════════════════════════════════════════════════
    // WFH / HALF-DAY SERVICE
    // All business logic for request submission, approval, rejection, and
    // manager dashboard aggregation.
    // ═══════════════════════════════════════════════════════════════════════════

    public interface IWFHRequestService
    {
        // Employee actions
        Task<WFHRequest> SubmitRequestAsync(int userId, CreateWFHRequestDto dto);
        Task<WFHRequest> CancelRequestAsync(int userId, int requestId);
        Task<List<WFHRequestDto>> GetMyRequestsAsync(int userId, int pageSize = 30);
        Task<WFHRequestDto?> GetMyRequestForDateAsync(int userId, DateTime date);

        // Manager actions
        Task<WFHRequest> ApproveAsync(int managerId, int requestId, string? note);
        Task<WFHRequest> RejectAsync(int managerId, int requestId, string? note);
        Task<List<WFHRequestDto>> GetPendingRequestsAsync(int managerId);
        Task<List<WFHRequestDto>> GetAllRequestsAsync(int managerId, int month, int year);

        // Manager dashboard
        Task<ManagerDailyStatusDto> GetTeamDailyStatusAsync(int managerId, DateTime? date = null);
        Task<List<TeamAttendanceMonthDto>> GetTeamMonthlyAttendanceAsync(int managerId, int month, int year);
    }

    public class WFHRequestService : IWFHRequestService
    {
        private readonly AppDbContext _db;
        private readonly ILogger<WFHRequestService> _logger;
        private readonly IEmailService _emailService;

        public WFHRequestService(AppDbContext db, ILogger<WFHRequestService> logger, IEmailService emailService)
        {
            _db = db;
            _logger = logger;
            _emailService = emailService;
        }

        // ══════════════════════════════════════════════════════════════════════
        // EMPLOYEE — Submit a WFH or HalfDay request
        // ══════════════════════════════════════════════════════════════════════
        public async Task<WFHRequest> SubmitRequestAsync(int userId, CreateWFHRequestDto dto)
        {
            var requestDate = dto.RequestDate.Date;

            // Validate: cannot request for past dates (allow today and future)
            if (requestDate < DateTime.UtcNow.Date)
                throw new InvalidOperationException("Cannot submit a request for past dates.");

            // Validate: no duplicate pending/approved request for same date
            var existing = await _db.WFHRequests
                .FirstOrDefaultAsync(r => r.UserId == userId
                    && r.RequestDate.Date == requestDate
                    && (r.Status == "Pending" || r.Status == "Approved"));

            if (existing != null)
                throw new InvalidOperationException(
                    $"You already have a {existing.Status.ToLower()} {existing.RequestType} request for {requestDate:MMMM d, yyyy}.");

            // Validate HalfDaySlot is provided for HalfDay requests
            if (dto.RequestType == "HalfDay" && string.IsNullOrEmpty(dto.HalfDaySlot))
                throw new InvalidOperationException("Please specify Morning or Afternoon for Half Day requests.");

            // Check if a DailyLog already exists for that date and link it
            var dailyLog = await _db.DailyLogs
                .FirstOrDefaultAsync(d => d.UserId == userId && d.LogDate.Date == requestDate);

            var request = new WFHRequest
            {
                UserId = userId,
                RequestType = dto.RequestType,
                RequestDate = requestDate,
                HalfDaySlot = dto.RequestType == "HalfDay" ? dto.HalfDaySlot : null,
                Reason = dto.Reason,
                Status = "Pending",
                DailyLogId = dailyLog?.Id
            };

            _db.WFHRequests.Add(request);
            await _db.SaveChangesAsync();

            // Get employee
            var employee = await _db.Users
                .FirstOrDefaultAsync(u => u.Id == userId);

            if (employee == null)
                throw new Exception("Employee not found.");

            // Ensure employee has manager assigned
            if (employee.ManagerId == null)
                throw new Exception("No manager assigned to this employee.");

            // Get manager
            var manager = await _db.Users
                .FirstOrDefaultAsync(u => u.Id == employee.ManagerId);

            if (manager == null)
                throw new Exception("Assigned manager not found.");

            // Optional safety: Ensure manager role is valid
            if (manager.Role is not ("Manager" or "TeamLead" or "Admin"))
                throw new Exception("Assigned user is not authorized as a manager.");

            // Generate email token
            var token = GenerateWFHEmailToken(request.Id, manager.Id);

            // Send email
            await _emailService.SendWFHAppliedEmailAsync(
                manager.Email!,
                manager.FullName,
                employee.FullName,
                request,
                token
            );

            _logger.LogInformation("User {UserId} submitted {Type} request for {Date}",
                userId, dto.RequestType, requestDate.ToString("yyyy-MM-dd"));

            return request;
        }

        // ══════════════════════════════════════════════════════════════════════
        // EMPLOYEE — Cancel own pending request
        // ══════════════════════════════════════════════════════════════════════
        public async Task<WFHRequest> CancelRequestAsync(int userId, int requestId)
        {
            var request = await _db.WFHRequests
                .FirstOrDefaultAsync(r => r.Id == requestId && r.UserId == userId)
                ?? throw new KeyNotFoundException("Request not found.");

            if (request.Status != "Pending")
                throw new InvalidOperationException($"Cannot cancel a request that is already {request.Status}.");

            request.Status = "Cancelled";
            request.UpdatedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync();
            return request;
        }

        // ══════════════════════════════════════════════════════════════════════
        // EMPLOYEE — View own requests
        // ══════════════════════════════════════════════════════════════════════
        public async Task<List<WFHRequestDto>> GetMyRequestsAsync(int userId, int pageSize = 30)
        {
            var requests = await _db.WFHRequests
                .Where(r => r.UserId == userId)
                .Include(r => r.ReviewedBy)
                .OrderByDescending(r => r.RequestedAt)
                .Take(pageSize)
                .ToListAsync();

            return requests.Select(MapToDto).ToList();
        }

        public async Task<WFHRequestDto?> GetMyRequestForDateAsync(int userId, DateTime date) =>
            await _db.WFHRequests
                .Include(r => r.ReviewedBy)
                .Where(r => r.UserId == userId && r.RequestDate.Date == date.Date)
                .OrderByDescending(r => r.RequestedAt)
                .Select(r => MapToDto(r))
                .FirstOrDefaultAsync();

        // ══════════════════════════════════════════════════════════════════════
        // MANAGER — Approve request
        // ══════════════════════════════════════════════════════════════════════
        public async Task<WFHRequest> ApproveAsync(int managerId, int requestId, string? note)
        {
            var request = await _db.WFHRequests
                .Include(r => r.User)
                .FirstOrDefaultAsync(r => r.Id == requestId)
                ?? throw new KeyNotFoundException("Request not found.");

            if (request.Status != "Pending")
                throw new InvalidOperationException($"Request is already {request.Status}.");

            // Verify manager owns this user's team
            await VerifyManagerAccess(managerId, request.UserId);

            request.Status = "Approved";
            request.ReviewedByUserId = managerId;
            request.ReviewNote = note;
            request.ReviewedAt = DateTime.UtcNow;
            request.UpdatedAt = DateTime.UtcNow;

            // ── Update or create DailyLog with correct DayStatus ──────────────
            await ApplyStatusToDailyLog(request);

            await _db.SaveChangesAsync();
            await _emailService.SendWFHReviewedEmailAsync(
                request.User.Email!,
                request.User.FullName,
                request.ReviewedBy?.FullName ?? "Manager",
                request,
                "Approved",
                note
            );

            _logger.LogInformation("Manager {ManagerId} approved {Type} request {RequestId} for user {UserId}",
                managerId, request.RequestType, requestId, request.UserId);

            return request;
        }

        // ══════════════════════════════════════════════════════════════════════
        // MANAGER — Reject request
        // ══════════════════════════════════════════════════════════════════════
        public async Task<WFHRequest> RejectAsync(int managerId, int requestId, string? note)
        {
            var request = await _db.WFHRequests
                .Include(r => r.User)
                .FirstOrDefaultAsync(r => r.Id == requestId)
                ?? throw new KeyNotFoundException("Request not found.");

            if (request.Status != "Pending")
                throw new InvalidOperationException($"Request is already {request.Status}.");

            await VerifyManagerAccess(managerId, request.UserId);

            request.Status = "Rejected";
            request.ReviewedByUserId = managerId;
            request.ReviewNote = note;
            request.ReviewedAt = DateTime.UtcNow;
            request.UpdatedAt = DateTime.UtcNow;

            // If the DailyLog was already updated (edge case: pre-approved),
            // revert it back to Present
            if (request.DailyLogId.HasValue)
            {
                var log = await _db.DailyLogs.FindAsync(request.DailyLogId.Value);
                if (log != null && (log.DayStatus == "WFH" || log.DayStatus == "HalfDay"))
                    log.DayStatus = "Present";
            }

            await _db.SaveChangesAsync();
            await _emailService.SendWFHReviewedEmailAsync(
                request.User.Email!,
                request.User.FullName,
                request.ReviewedBy?.FullName ?? "Manager",
                request,
                "Rejected",
                note
            );
            return request;
        }

        // ══════════════════════════════════════════════════════════════════════
        // MANAGER — Get all pending requests for their team
        // ══════════════════════════════════════════════════════════════════════
        public async Task<List<WFHRequestDto>> GetPendingRequestsAsync(int managerId)
        {
            var teamUserIds = await GetTeamUserIds(managerId);

            var requests = await _db.WFHRequests
                .Where(r => teamUserIds.Contains(r.UserId) && r.Status == "Pending")
                .Include(r => r.User)
                .Include(r => r.ReviewedBy)
                .OrderBy(r => r.RequestDate)
                .ToListAsync();

            return requests.Select(MapToDto).ToList();
        }

        // ══════════════════════════════════════════════════════════════════════
        // MANAGER — Get all requests for a month
        // ══════════════════════════════════════════════════════════════════════
        public async Task<List<WFHRequestDto>> GetAllRequestsAsync(int managerId, int month, int year)
        {
            var teamUserIds = await GetTeamUserIds(managerId);
            var from = new DateTime(year, month, 1);
            var to = from.AddMonths(1);

            var requests = await _db.WFHRequests
                .Where(r => teamUserIds.Contains(r.UserId)
                    && r.RequestDate >= from && r.RequestDate < to)
                .Include(r => r.User)
                .Include(r => r.ReviewedBy)
                .OrderByDescending(r => r.RequestedAt)
                .ToListAsync();

            return requests.Select(MapToDto).ToList();
        }

        // ══════════════════════════════════════════════════════════════════════
        // MANAGER DASHBOARD — Today's full team status snapshot
        // Shows every team member's attendance status for a given day
        // ══════════════════════════════════════════════════════════════════════
        public async Task<ManagerDailyStatusDto> GetTeamDailyStatusAsync(int managerId, DateTime? date = null)
        {
            var targetDate = (date ?? DateTime.UtcNow).Date;
            var teamUserIds = await GetTeamUserIds(managerId);

            var teamUsers = await _db.Users
                .Where(u => teamUserIds.Contains(u.Id))
                .ToListAsync();

            // Fetch all DailyLogs for this date
            var dailyLogs = await _db.DailyLogs
                .Include(d => d.BreakLogs)
                .Include(d => d.TaskLogs)
                .Where(d => teamUserIds.Contains(d.UserId) && d.LogDate.Date == targetDate)
                .ToListAsync();

            // Fetch all WFH/HalfDay requests for this date (approved)
            var approvedRequests = await _db.WFHRequests
                .Where(r => teamUserIds.Contains(r.UserId)
                    && r.RequestDate.Date == targetDate
                    && r.Status == "Approved")
                .ToListAsync();

            // Fetch pending requests (so manager can take action)
            var pendingRequests = await _db.WFHRequests
                .Where(r => teamUserIds.Contains(r.UserId)
                    && r.RequestDate.Date == targetDate
                    && r.Status == "Pending")
                .ToListAsync();

            // Build per-member status
            var members = teamUsers.Select(user =>
            {
                var log = dailyLogs.FirstOrDefault(d => d.UserId == user.Id);
                var approvedReq = approvedRequests.FirstOrDefault(r => r.UserId == user.Id);
                var pendingReq = pendingRequests.FirstOrDefault(r => r.UserId == user.Id);

                // Determine effective status
                string effectiveStatus;
                if (log != null)
                    effectiveStatus = log.DayStatus ?? "Present";
                else if (approvedReq != null)
                    effectiveStatus = approvedReq.RequestType; // WFH or HalfDay
                else
                    effectiveStatus = "Not Checked In";

                var workMinutes = 0;
                if (log?.CheckInTime != null)
                {
                    if (log.CheckOutTime.HasValue)
                    {
                        workMinutes = (int)(log.CheckOutTime.Value - log.CheckInTime.Value).TotalMinutes;
                    }
                    else
                    {
                        workMinutes = (int)(DateTime.UtcNow - log.CheckInTime.Value).TotalMinutes;
                    }
                }

                var breakMinutes = log?.BreakLogs?.Sum(b =>
                    b.EndTime.HasValue
                        ? (int)(b.EndTime.Value - b.StartTime).TotalMinutes
                        : 0) ?? 0;

                return new TeamMemberStatusDto
                {
                    UserId = user.Id,
                    FullName = user.FullName,
                    Email = user.Email ?? "",
                    Role = user.Role ?? "Developer",
                    EffectiveStatus = effectiveStatus,
                    CheckInTime = log?.CheckInTime,
                    CheckOutTime = log?.CheckOutTime,
                    WorkMinutes = Math.Max(0, workMinutes - breakMinutes),
                    WorkHours = FormatHours(Math.Max(0, workMinutes - breakMinutes)),
                    BreakMinutes = breakMinutes,
                    IsOnBreak = log?.BreakLogs?.Any(b => !b.EndTime.HasValue) ?? false,
                    TasksCompleted = log?.TaskLogs?.Count(t => t.Status == "Completed") ?? 0,
                    TasksTotal = log?.TaskLogs?.Count ?? 0,
                    HasApprovedWFH = approvedReq?.RequestType == "WFH",
                    HasApprovedHalfDay = approvedReq?.RequestType == "HalfDay",
                    HalfDaySlot = approvedReq?.HalfDaySlot,
                    HasPendingRequest = pendingReq != null,
                    PendingRequestType = pendingReq?.RequestType,
                    PendingRequestId = pendingReq?.Id
                };
            }).ToList();

            // Summary counts
            return new ManagerDailyStatusDto
            {
                Date = targetDate,
                DateLabel = targetDate.ToString("dddd, MMMM d, yyyy"),
                TotalMembers = members.Count,
                PresentCount = members.Count(m => m.EffectiveStatus == "Present"),
                WFHCount = members.Count(m => m.EffectiveStatus == "WFH"),
                HalfDayCount = members.Count(m => m.EffectiveStatus == "HalfDay"),
                NotCheckedInCount = members.Count(m => m.EffectiveStatus == "Not Checked In"),
                PendingRequestsCount = members.Count(m => m.HasPendingRequest),
                Members = members.OrderBy(m => m.FullName).ToList()
            };
        }

        // ══════════════════════════════════════════════════════════════════════
        // MANAGER — Monthly attendance summary with WFH/HalfDay counts
        // ══════════════════════════════════════════════════════════════════════
        public async Task<List<TeamAttendanceMonthDto>> GetTeamMonthlyAttendanceAsync(int managerId, int month, int year)
        {
            var teamUserIds = await GetTeamUserIds(managerId);
            var from = new DateTime(year, month, 1);
            var to = from.AddMonths(1);
            int workingDays = CountWorkingDays(from, to.AddDays(-1));

            var dailyLogs = await _db.DailyLogs
                .Where(d => teamUserIds.Contains(d.UserId)
                    && d.LogDate >= from && d.LogDate < to)
                .Include(d => d.TaskLogs)
                .ToListAsync();

            var wfhRequests = await _db.WFHRequests
                .Where(r => teamUserIds.Contains(r.UserId)
                    && r.RequestDate >= from && r.RequestDate < to
                    && r.Status == "Approved")
                .ToListAsync();

            var teamUsers = await _db.Users
                .Where(u => teamUserIds.Contains(u.Id))
                .ToListAsync();

            return teamUsers.Select(user =>
            {
                var userLogs = dailyLogs.Where(d => d.UserId == user.Id).ToList();
                var userWFH = wfhRequests.Where(r => r.UserId == user.Id).ToList();

                int daysPresent = userLogs.Count(l => l.DayStatus == "Present");
                int daysWFH = userLogs.Count(l => l.DayStatus == "WFH")
                    + userWFH.Count(r => r.RequestType == "WFH"
                        && !userLogs.Any(l => l.LogDate.Date == r.RequestDate.Date));
                int daysHalfDay = userLogs.Count(l => l.DayStatus == "HalfDay")
                    + userWFH.Count(r => r.RequestType == "HalfDay"
                        && !userLogs.Any(l => l.LogDate.Date == r.RequestDate.Date));
                int daysWeekend = userLogs.Count(l => l.DayStatus == "Weekend"); // ← NEW
                int daysHoliday = userLogs.Count(l => l.DayStatus == "Holiday"); // ← NEW

                int daysWorked = daysPresent + daysWFH + daysHalfDay;
                // Weekend/Holiday are bonus days — don't reduce the absent count
                int daysAbsent = Math.Max(0, workingDays - daysWorked);

                var totalWorkMinutes = userLogs.Sum(l =>
                    l.CheckInTime.HasValue && l.CheckOutTime.HasValue
                        ? (int)(l.CheckOutTime.Value - l.CheckInTime.Value).TotalMinutes
                        : 0);

                return new TeamAttendanceMonthDto
                {
                    UserId = user.Id,
                    FullName = user.FullName,
                    Role = user.Role ?? "Developer",
                    Month = month,
                    Year = year,
                    WorkingDaysInMonth = workingDays,
                    DaysPresent = daysPresent,
                    DaysWFH = daysWFH,
                    DaysHalfDay = daysHalfDay,
                    DaysAbsent = daysAbsent,
                    DaysWeekend = daysWeekend,  // ← NEW
                    DaysHoliday = daysHoliday,  // ← NEW
                    AttendancePercentage = workingDays > 0
                        ? Math.Round(daysWorked / (double)workingDays * 100, 1) : 0,
                    TotalWorkMinutes = totalWorkMinutes,
                    TotalWorkHours = FormatHours(totalWorkMinutes),
                    AverageDailyHours = daysWorked > 0
                        ? Math.Round(totalWorkMinutes / 60.0 / daysWorked, 1) : 0,
                    TotalTasksCompleted = userLogs.Sum(l =>
                        l.TaskLogs?.Count(t => t.Status == "Completed") ?? 0),
                    WFHDates = userWFH.Where(r => r.RequestType == "WFH")
                        .Select(r => r.RequestDate.ToString("yyyy-MM-dd")).ToList(),
                    HalfDayDates = userWFH.Where(r => r.RequestType == "HalfDay")
                        .Select(r => r.RequestDate.ToString("yyyy-MM-dd")).ToList(),
                    WeekendDates = userLogs.Where(l => l.DayStatus == "Weekend") // ← NEW
                        .Select(l => l.LogDate.ToString("yyyy-MM-dd")).ToList(),
                    HolidayDates = userLogs.Where(l => l.DayStatus == "Holiday") // ← NEW
                        .Select(l => l.LogDate.ToString("yyyy-MM-dd")).ToList(),
                };
            }).OrderBy(m => m.FullName).ToList();
        }

        // ── Private helpers ──────────────────────────────────────────────────

        /// <summary>When a WFH request is approved, update the DailyLog.DayStatus.
        /// If no log exists yet (future date), we skip — the DayStatus will be set
        /// automatically when the user checks in.</summary>
        private async Task ApplyStatusToDailyLog(WFHRequest request)
        {
            if (!request.DailyLogId.HasValue)
            {
                // Try to find the log now (it may have been created after the request)
                var log = await _db.DailyLogs.FirstOrDefaultAsync(d =>
                    d.UserId == request.UserId && d.LogDate.Date == request.RequestDate.Date);

                if (log != null)
                {
                    log.DayStatus = request.RequestType; // "WFH" or "HalfDay"
                    request.DailyLogId = log.Id;
                }
                // If no log exists (future date), status will be applied on check-in
            }
            else
            {
                var log = await _db.DailyLogs.FindAsync(request.DailyLogId.Value);
                if (log != null) log.DayStatus = request.RequestType;
            }
        }

        private async Task VerifyManagerAccess(int managerId, int employeeUserId)
        {
            var isManager = await _db.Users
                .AnyAsync(u => u.Id == employeeUserId
                    && (u.ManagerId == managerId || managerId == employeeUserId));

            // Also allow if manager has Manager/TeamLead role 
            var managerUser = await _db.Users.FindAsync(managerId);
            bool isManagerRole = managerUser?.Role is "Manager" or "TeamLead" or "Admin";

            if (!isManager && !isManagerRole)
                throw new UnauthorizedAccessException("You do not have permission to review this request.");
        }

        private async Task<List<int>> GetTeamUserIds(int managerId)
        {
            var managerUser = await _db.Users.FindAsync(managerId);
            bool isManagerRole = managerUser?.Role is "Manager" or "TeamLead" or "Admin";

            if (isManagerRole)
            {
                // Get all direct reports
                var teamIds = await _db.Users
                    .Where(u => u.ManagerId == managerId || u.Id == managerId)
                    .Select(u => u.Id)
                    .ToListAsync();

                // If Admin, return all users
                if (managerUser?.Role == "Admin")
                    return await _db.Users.Select(u => u.Id).ToListAsync();

                return teamIds;
            }

            return new List<int> { managerId };
        }

        private static string FormatHours(int minutes)
        {
            var h = minutes / 60;
            var m = minutes % 60;
            return $"{h}h {m}m";
        }

        private static int CountWorkingDays(DateTime from, DateTime to)
        {
            int count = 0;
            for (var d = from.Date; d <= to.Date; d = d.AddDays(1))
            {
                if (d.DayOfWeek != DayOfWeek.Saturday && d.DayOfWeek != DayOfWeek.Sunday)
                    count++;
            }
            return count;
        }

        private static WFHRequestDto MapToDto(WFHRequest r) => new()
        {
            Id = r.Id,
            UserId = r.UserId,
            EmployeeName = r.User?.FullName ?? "",
            RequestType = r.RequestType,
            RequestDate = r.RequestDate,
            RequestDateLabel = r.RequestDate.ToString("EEEE, MMMM d, yyyy"),
            HalfDaySlot = r.HalfDaySlot,
            Reason = r.Reason,
            Status = r.Status,
            ReviewedByName = r.ReviewedBy?.FullName,
            ReviewNote = r.ReviewNote,
            ReviewedAt = r.ReviewedAt,
            RequestedAt = r.RequestedAt,
        };

        private string GenerateWFHEmailToken(int requestId, int managerId)
        {
            var expiry = DateTime.UtcNow.AddHours(24);

            var payload = $"{requestId}|{managerId}|{expiry:O}";
            return Convert.ToBase64String(Encoding.UTF8.GetBytes(payload));
        }
    }
}
