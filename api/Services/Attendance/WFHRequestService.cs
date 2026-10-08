using DailyTrackerAPI.Data;
using DailyTrackerAPI.DTOs;
using DailyTrackerAPI.Helpers;
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
        private readonly IConfiguration _config;

        private readonly DailyTrackerAPI.Services.Auth.ITeamScope _scope;

        public WFHRequestService(AppDbContext db, ILogger<WFHRequestService> logger, IEmailService emailService, IConfiguration config,
            DailyTrackerAPI.Services.Auth.ITeamScope scope)
        {
            _scope = scope;
            _config = config;
            _db = db;
            _logger = logger;
            _emailService = emailService;
        }

        // ══════════════════════════════════════════════════════════════════════
        // EMPLOYEE — Submit a WFH or HalfDay request
        // ══════════════════════════════════════════════════════════════════════
        public async Task<WFHRequest> SubmitRequestAsync(int userId, CreateWFHRequestDto dto)
        {
            // ── Every check runs BEFORE anything is saved ─────────────────────
            if (dto.RequestType is not ("WFH" or "HalfDay"))
                throw new InvalidOperationException("Request type must be WFH or HalfDay.");
            if (dto.RequestDate == default)
                throw new InvalidOperationException("Please choose a date.");

            var requestDate = dto.RequestDate.Date;

            // Past dates are not allowed ("today" is the Indian date, not the server's UTC date)
            if (requestDate < AppClock.TodayIst)
                throw new InvalidOperationException("Cannot submit a request for past dates.");
            if (requestDate.DayOfWeek is DayOfWeek.Saturday or DayOfWeek.Sunday)
                throw new InvalidOperationException($"{requestDate:dddd, MMMM d} is a weekend — no request is needed.");
            if (await _db.Holidays.AnyAsync(h => h.Date.Date == requestDate && h.Type == "Public"))
                throw new InvalidOperationException($"{requestDate:MMMM d} is a public holiday — no request is needed.");

            if (dto.RequestType == "HalfDay" && dto.HalfDaySlot is not ("Morning" or "Afternoon"))
                throw new InvalidOperationException("Please specify Morning or Afternoon for Half Day requests.");
            if (string.IsNullOrWhiteSpace(dto.Reason))
                throw new InvalidOperationException("Please give a reason.");

            // No duplicate pending/approved request for the same date
            var existing = await _db.WFHRequests
                .FirstOrDefaultAsync(r => r.UserId == userId
                    && r.RequestDate.Date == requestDate
                    && (r.Status == "Pending" || r.Status == "Approved"));
            if (existing != null)
                throw new InvalidOperationException(
                    $"You already have a {existing.Status.ToLower()} {existing.RequestType} request for {requestDate:MMMM d, yyyy}.");

            // Already on leave that day?
            var leave = await _db.LeaveRequests.FirstOrDefaultAsync(l => l.UserId == userId
                && (l.Status == "Pending" || l.Status == "Approved")
                && l.FromDate <= requestDate && l.ToDate >= requestDate);
            if (leave != null)
                throw new InvalidOperationException(
                    $"You have a {leave.Status.ToLower()} {leave.LeaveType} leave on {requestDate:MMMM d} — cancel it first to request {dto.RequestType}.");

            var employee = await _db.Users.FirstOrDefaultAsync(u => u.Id == userId)
                ?? throw new InvalidOperationException("Employee not found.");

            // Who reviews it: the assigned manager, or else every manager
            var approvers = await GetApproversAsync(employee);

            // ── Save ───────────────────────────────────────────────────────────
            var dailyLog = await _db.DailyLogs
                .FirstOrDefaultAsync(d => d.UserId == userId && d.LogDate.Date == requestDate);

            var request = new WFHRequest
            {
                UserId = userId,
                RequestType = dto.RequestType,
                RequestDate = requestDate,
                HalfDaySlot = dto.RequestType == "HalfDay" ? dto.HalfDaySlot : null,
                Reason = dto.Reason.Trim(),
                Status = "Pending",
                DailyLogId = dailyLog?.Id
            };

            _db.WFHRequests.Add(request);
            await _db.SaveChangesAsync();

            // ── Tell the approvers (best effort: the request is already saved) ─
            foreach (var manager in approvers)
            {
                var token = CreateEmailToken(request.Id, manager.Id);
                await BestEffortAsync($"email to manager {manager.Id}", () => _emailService.SendWFHAppliedEmailAsync(
                    manager.Email!, manager.FullName, employee.FullName, request, token));
            }

            _logger.LogInformation("User {UserId} submitted {Type} request for {Date}",
                userId, dto.RequestType, requestDate.ToString("yyyy-MM-dd"));

            return request;
        }

        /// <summary>Assigned manager if valid, otherwise all active managers (never the requester)</summary>
        private async Task<List<Models.Auth.User>> GetApproversAsync(Models.Auth.User employee)
        {
            // the shared rule (own manager / team lead, else every manager; someone away → their delegate)
            var ids = await _scope.ApproversAsync(employee.Id);
            return await _db.Users.Where(u => ids.Contains(u.Id)).ToListAsync();
        }

        /// <summary>
        /// A manager / team lead reviews their own request only when nobody else can
        /// (no other active manager and no active manager assigned to them).
        /// </summary>
        private async Task<bool> CanReviewOwnAsync(Models.Auth.User user) =>
            user.Role is "Manager" or "TeamLead" or "Admin" && user.IsActive
            && (await GetApproversAsync(user)).Count == 0;

        private async Task BestEffortAsync(string what, Func<Task> action)
        {
            try { await action(); }
            catch (Exception ex) { _logger.LogWarning(ex, "WFH: {What} failed (the request itself was saved)", what); }
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
            var reviewer = await _db.Users.FindAsync(managerId);

            request.Status = "Approved";
            request.ReviewedByUserId = managerId;
            request.ReviewNote = note;
            request.ReviewedAt = DateTime.UtcNow;
            request.UpdatedAt = DateTime.UtcNow;

            // ── Update or create DailyLog with correct DayStatus ──────────────
            await ApplyStatusToDailyLog(request);

            await _db.SaveChangesAsync();
            await BestEffortAsync("approval email", () => _emailService.SendWFHReviewedEmailAsync(
                request.User.Email!,
                request.User.FullName,
                reviewer?.FullName ?? "Manager",
                request,
                "Approved",
                note));

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
            var reviewer = await _db.Users.FindAsync(managerId);

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
            await BestEffortAsync("rejection email", () => _emailService.SendWFHReviewedEmailAsync(
                request.User.Email!,
                request.User.FullName,
                reviewer?.FullName ?? "Manager",
                request,
                "Rejected",
                note));
            return request;
        }

        // ══════════════════════════════════════════════════════════════════════
        // MANAGER — Get all pending requests for their team
        // ══════════════════════════════════════════════════════════════════════
        public async Task<List<WFHRequestDto>> GetPendingRequestsAsync(int managerId)
        {
            var teamUserIds = await GetTeamUserIds(managerId);   // includes anyone covered for while they're away

            // Own requests only when nobody else can review them
            var manager = await _db.Users.FindAsync(managerId);
            var includeOwn = manager != null && await CanReviewOwnAsync(manager);

            var requests = await _db.WFHRequests
                .Where(r => teamUserIds.Contains(r.UserId) && (includeOwn || r.UserId != managerId) && r.Status == "Pending")
                .Include(r => r.User)
                .Include(r => r.ReviewedBy)
                .OrderBy(r => r.RequestDate)
                .ToListAsync();

            return requests.Select(r => { var d = MapToDto(r); d.IsOwn = r.UserId == managerId; return d; }).ToList();
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
            var targetDate = (date ?? AppClock.TodayIst).Date;
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

            // Approved leave covering this date → "On Leave"
            var onLeaveUserIds = (await _db.LeaveRequests
                .Where(l => teamUserIds.Contains(l.UserId) && l.Status == "Approved"
                    && l.FromDate <= targetDate && l.ToDate >= targetDate)
                .Select(l => l.UserId)
                .ToListAsync()).ToHashSet();

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
                else if (onLeaveUserIds.Contains(user.Id))
                    effectiveStatus = "On Leave";
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
                OnLeaveCount = members.Count(m => m.EffectiveStatus == "On Leave"),
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

            // Approved leave in this month (working days only) — not "absent"
            var monthEnd = to.AddDays(-1);
            var approvedLeaves = await _db.LeaveRequests
                .Where(l => teamUserIds.Contains(l.UserId) && l.Status == "Approved"
                    && l.FromDate <= monthEnd && l.ToDate >= from)
                .ToListAsync();
            var publicHolidays = (await _db.Holidays
                .Where(h => h.Type == "Public" && h.Date >= from && h.Date <= monthEnd)
                .Select(h => h.Date).ToListAsync()).Select(d => d.Date).ToHashSet();

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
                int daysOnLeave = approvedLeaves.Where(l => l.UserId == user.Id).Sum(l =>
                    CountWorkingDays(l.FromDate < from ? from : l.FromDate, l.ToDate > monthEnd ? monthEnd : l.ToDate));

                // Absent = working days from joining up to yesterday (today once checked in) that
                // have no attendance, approved leave or public holiday — same rule as payroll
                var leaveDates = new HashSet<DateTime>();
                foreach (var l in approvedLeaves.Where(l => l.UserId == user.Id))
                    for (var d = l.FromDate.Date < from ? from : l.FromDate.Date; d <= l.ToDate.Date && d <= monthEnd; d = d.AddDays(1))
                        leaveDates.Add(d);
                var workedDates = userLogs.Where(l => l.DayStatus is "Present" or "WFH" or "HalfDay").Select(l => l.LogDate.Date)
                    .Concat(userWFH.Select(r => r.RequestDate.Date)).ToHashSet();
                var (countFrom, countTo) = AttendanceDays.CountableRange(user, from, monthEnd,
                    userLogs.Any(l => l.LogDate.Date == AppClock.TodayIst),
                    userLogs.Select(l => (DateTime?)l.LogDate.Date).Min());
                int expected = 0, daysAbsent = 0;
                for (var d = countFrom; d <= countTo; d = d.AddDays(1))
                {
                    if (!AttendanceDays.IsWorkingDay(d, publicHolidays)) continue;
                    if (leaveDates.Contains(d) && !workedDates.Contains(d)) continue;   // on leave
                    expected++;
                    if (!workedDates.Contains(d)) daysAbsent++;
                }

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
                    DaysOnLeave = daysOnLeave,
                    DaysWeekend = daysWeekend,  // ← NEW
                    DaysHoliday = daysHoliday,  // ← NEW
                    // days they came in out of the days they were expected (same rule as Team Dashboard)
                    AttendancePercentage = expected > 0
                        ? Math.Round((expected - daysAbsent) / (double)expected * 100, 1) : 0,
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
            if (managerId == employeeUserId)
            {
                var self = await _db.Users.FindAsync(managerId);
                if (self == null || !await CanReviewOwnAsync(self))
                    throw new UnauthorizedAccessException("You can't review your own request — another manager needs to review it.");
                return;
            }

            // a Manager decides for anyone, a team lead for their own team (plus anyone they cover for)
            if (!await _scope.CanManageAsync(managerId, employeeUserId))
                throw new UnauthorizedAccessException("You do not have permission to review this request.");
        }

        /// <summary>
        /// The people this manager / team lead sees here, plus themselves — the same team rule as every
        /// other page (ITeamScope): a Manager sees everyone, a Team Lead their own people and anyone they
        /// cover for while that person is away.
        /// </summary>
        private async Task<List<int>> GetTeamUserIds(int managerId)
        {
            var managerUser = await _db.Users.FindAsync(managerId);
            if (managerUser?.Role == "Admin")
                return await _db.Users.Select(u => u.Id).ToListAsync();
            if (managerUser?.Role is not ("Manager" or "TeamLead"))
                return new List<int> { managerId };

            var managed = await _scope.ManagedUserIdsAsync(managerId);
            var teamIds = managed == null
                ? await _db.Users.Where(u => u.Role != "Pending").Select(u => u.Id).ToListAsync()
                : managed.ToList();
            if (!teamIds.Contains(managerId)) teamIds.Add(managerId);
            return teamIds;
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

        private string CreateEmailToken(int requestId, int managerId) =>
            SignedActionToken.Create("wfh-review", requestId, managerId, DateTime.UtcNow.AddHours(48),
                _config["Jwt:Key"] ?? throw new InvalidOperationException("Jwt:Key is not set."));
    }
}
