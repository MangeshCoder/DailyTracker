using DailyTrackerAPI.Custom;
using DailyTrackerAPI.Data;
using DailyTrackerAPI.DTOs;
using DailyTrackerAPI.Models.Auth;
using DailyTrackerAPI.Models.HR;
using DailyTrackerAPI.Services.Auth;
using DailyTrackerAPI.Services.Communication;
using Microsoft.EntityFrameworkCore;

namespace DailyTrackerAPI.Services.HR
{
    // ─────────────────────────────────────────────────────────────────────────
    //  Feature 9: Leave Service
    //
    //  CHANGES FROM ORIGINAL:
    //
    //  1. CountWorkingDays  → now async, accepts a HashSet<DateTime> of holidays
    //     so it skips both weekends AND public holidays.
    //
    //  2. GetHolidayDatesAsync  → new private helper, loads Holiday dates from
    //     DB once per call, passed down to all CountWorkingDays calls.
    //
    //  3. ApplyAsync  → validation changed from "max 2 days per month" to
    //     "annual entitlement per leave type". Casual=12, Sick=7, Earned=15;
    //     CompOff and Unpaid are unlimited (no cap enforced).
    //
    //  4. GetMonthlyBalanceAsync renamed to GetAnnualBalanceAsync, now returns
    //     per-type breakdown with entitlement / used / remaining for the year.
    //
    //  Everything else (ApplyAsync email/notification flow, ReviewAsync,
    //  CancelAsync, GetMyLeavesAsync, GetAllLeavesAsync) is UNCHANGED.
    // ─────────────────────────────────────────────────────────────────────────

    public interface ILeaveService
    {
        Task<LeaveResponseDto> ApplyAsync(int userId, ApplyLeaveDto dto);
        Task<List<LeaveResponseDto>> GetMyLeavesAsync(int userId);
        Task<List<LeaveResponseDto>> GetAllLeavesAsync(string? status = null);
        Task ReviewAsync(int leaveId, int managerId, ReviewLeaveDto dto);
        Task CancelAsync(int leaveId, int userId);

        // ── CHANGED: was GetMonthlyBalanceAsync, now annual + per-type ────────
        Task<List<LeaveBalanceDto>> GetAnnualBalanceAsync(int? userId = null);
    }

    public class LeaveService : ILeaveService
    {
        private readonly AppDbContext _db;
        private readonly INotificationSender _notif;
        private readonly IEmailService _email;
        private readonly IEmailActionService _emailAction;

        // ── Annual entitlements per leave type ────────────────────────────────
        // 0 = unlimited (CompOff, Unpaid — don't enforce a cap)
        private static readonly Dictionary<string, int> Entitlements = new()
        {
            { "Casual",  12 },
            { "Sick",     7 },
            { "Earned",  15 },
            { "CompOff",  0 },  // unlimited
            { "Unpaid",   0 },  // unlimited
        };

        public LeaveService(
            AppDbContext db,
            INotificationSender notif,
            IEmailService email,
            IEmailActionService emailAction)
        {
            _db = db;
            _notif = notif;
            _email = email;
            _emailAction = emailAction;
        }

        // ── CHANGED: uses annual entitlement instead of monthly 2-day cap ─────
        public async Task<LeaveResponseDto> ApplyAsync(int userId, ApplyLeaveDto dto)
        {
            if (dto.FromDate.Date > dto.ToDate.Date)
                throw new Exception("From date cannot be after To date.");

            var user = await _db.Users.FindAsync(userId)
                ?? throw new Exception("User not found");

            // Load public holidays covering the requested date range
            var holidays = await GetHolidayDatesAsync(dto.FromDate.Year, dto.ToDate.Year);

            int requestedDays = CountWorkingDays(dto.FromDate, dto.ToDate, holidays);
            if (requestedDays <= 0)
                throw new Exception("Selected dates contain only weekends or public holidays.");

            // ── Annual entitlement check (skip for unlimited types) ───────────
            var entitlement = Entitlements.GetValueOrDefault(dto.LeaveType, 12);
            if (entitlement > 0)
            {
                var yearStart = new DateTime(dto.FromDate.Year, 1, 1);
                var yearEnd = new DateTime(dto.FromDate.Year, 12, 31);

                // Count all Approved + Pending of this type this year
                var existing = await _db.LeaveRequests
                    .Where(l =>
                        l.UserId == userId &&
                        l.LeaveType == dto.LeaveType &&
                        (l.Status == "Approved" || l.Status == "Pending") &&
                        l.FromDate <= yearEnd &&
                        l.ToDate >= yearStart)
                    .ToListAsync();

                int usedDays = 0;
                foreach (var e in existing)
                {
                    var s = e.FromDate < yearStart ? yearStart : e.FromDate;
                    var en = e.ToDate > yearEnd ? yearEnd : e.ToDate;
                    usedDays += CountWorkingDays(s, en, holidays);
                }

                if (usedDays + requestedDays > entitlement)
                    throw new ValidationException(
                        $"{dto.LeaveType} leave annual limit exceeded. " +
                        $"Entitlement: {entitlement} days, " +
                        $"Already used/pending: {usedDays} days, " +
                        $"Requested: {requestedDays} days.");
            }

            // ── Create leave (UNCHANGED) ──────────────────────────────────────
            var leave = new LeaveRequest
            {
                UserId = userId,
                FromDate = dto.FromDate.Date,
                ToDate = dto.ToDate.Date,
                LeaveType = dto.LeaveType,
                Reason = dto.Reason,
                Status = "Pending"
            };

            _db.LeaveRequests.Add(leave);
            await _db.SaveChangesAsync();

            // 🔔 Notification (UNCHANGED)
            await _notif.SendToManagers("LeaveApplied", new
            {
                UserId = userId,
                LeaveId = leave.Id,
                Message = "New leave request pending review"
            });

            // 📧 Email to managers (UNCHANGED)
            var managers = await _db.Users
                .Where(u => u.Role == "Manager")
                .ToListAsync();

            foreach (var manager in managers)
            {
                var token = await _emailAction.CreateTokenAsync(leave.Id, manager.Id);
                await _email.SendLeaveAppliedEmailAsync(
                    manager.Email, manager.FullName, user.FullName, leave, token);
            }

            return await MapLeave(leave);
        }

        // ── UNCHANGED ─────────────────────────────────────────────────────────
        public async Task<List<LeaveResponseDto>> GetMyLeavesAsync(int userId)
        {
            var leaves = await _db.LeaveRequests
                .Include(l => l.User)
                .Include(l => l.ReviewedBy)
                .Where(l => l.UserId == userId)
                .OrderByDescending(l => l.AppliedAt)
                .ToListAsync();

            var result = new List<LeaveResponseDto>();
            foreach (var l in leaves) result.Add(await MapLeave(l));
            return result;
        }

        // ── UNCHANGED ─────────────────────────────────────────────────────────
        public async Task<List<LeaveResponseDto>> GetAllLeavesAsync(string? status = null)
        {
            var query = _db.LeaveRequests
                .Include(l => l.User)
                .Include(l => l.ReviewedBy)
                .AsQueryable();

            if (!string.IsNullOrEmpty(status))
                query = query.Where(l => l.Status == status);

            var leaves = await query.OrderByDescending(l => l.AppliedAt).ToListAsync();
            var result = new List<LeaveResponseDto>();
            foreach (var l in leaves) result.Add(await MapLeave(l));
            return result;
        }

        // ── UNCHANGED ─────────────────────────────────────────────────────────
        public async Task ReviewAsync(int leaveId, int managerId, ReviewLeaveDto dto)
        {
            var leave = await _db.LeaveRequests
                .Include(l => l.User)
                .FirstOrDefaultAsync(l => l.Id == leaveId)
                ?? throw new ValidationException("Leave request not found.");

            var manager = await _db.Users.FindAsync(managerId)
                ?? throw new ValidationException("Manager not found");

            leave.Status = dto.Status;
            leave.ReviewedByUserId = managerId;
            leave.ReviewNote = dto.ReviewNote;
            leave.ReviewedAt = DateTime.UtcNow;

            await _db.SaveChangesAsync();

            await _notif.SendToUser(leave.UserId, "ReceiveNotification", new
            {
                Title = $"Leave {dto.Status}",
                Message = $"Your leave request has been {dto.Status.ToLower()}",
                Type = dto.Status == "Approved" ? "Success" : "Warning"
            });

            await _email.SendLeaveReviewedEmailAsync(
                leave.User.Email, leave.User.FullName,
                manager.FullName, leave, dto.Status, dto.ReviewNote);
        }

        // ── UNCHANGED ─────────────────────────────────────────────────────────
        public async Task CancelAsync(int leaveId, int userId)
        {
            var leave = await _db.LeaveRequests
                .FirstOrDefaultAsync(l => l.Id == leaveId && l.UserId == userId && l.Status == "Pending")
                ?? throw new ValidationException("Leave request not found or cannot be cancelled.");

            _db.LeaveRequests.Remove(leave);
            await _db.SaveChangesAsync();
        }

        // ── CHANGED: was GetMonthlyBalanceAsync — now returns annual per-type ─
        //
        //  For each user, returns one LeaveBalanceDto with a Balances list —
        //  one row per leave type showing: Entitlement / Used / Pending / Remaining.
        //  Unlimited types (CompOff, Unpaid) show Used with IsUnlimited = true.
        //
        //  userId = null → all users (manager view)
        //  userId = N    → that user only
        public async Task<List<LeaveBalanceDto>> GetAnnualBalanceAsync(int? userId = null)
        {
            var year = DateTime.UtcNow.Year;
            var yearStart = new DateTime(year, 1, 1);
            var yearEnd = new DateTime(year, 12, 31);

            // Load all public holidays for this year once
            var holidays = await GetHolidayDatesAsync(year);

            // Load all non-rejected leaves for the year (+ user info)
            var query = _db.LeaveRequests
                .Include(l => l.User)
                .Where(l =>
                    l.Status != "Rejected" &&
                    l.FromDate <= yearEnd &&
                    l.ToDate >= yearStart);

            if (userId.HasValue)
                query = query.Where(l => l.UserId == userId.Value);

            var leaves = await query.ToListAsync();

            // If a user exists but has no leaves this year we still want to
            // show them (with all zeros). Load user list separately.
            List<User> users;
            if (userId.HasValue)
            {
                var u = await _db.Users.FindAsync(userId.Value);
                users = u is null ? new() : new() { u };
            }
            else
            {
                users = await _db.Users
                    .Where(u => u.IsActive)
                    .OrderBy(u => u.FullName)
                    .ToListAsync();
            }

            // Index leaves by userId for O(1) lookup
            var leavesByUser = leaves.GroupBy(l => l.UserId)
                               .ToDictionary(g => g.Key, g => g.ToList());

            var result = new List<LeaveBalanceDto>();

            foreach (var user in users)
            {
                var userLeaves = leavesByUser.GetValueOrDefault(user.Id, new());

                var balances = new List<LeaveTypeBalanceItem>();

                foreach (var (leaveType, entitlement) in Entitlements)
                {
                    var typeLeaves = userLeaves.Where(l => l.LeaveType == leaveType).ToList();

                    int used = 0;
                    int pending = 0;

                    foreach (var l in typeLeaves)
                    {
                        var s = l.FromDate < yearStart ? yearStart : l.FromDate;
                        var en = l.ToDate > yearEnd ? yearEnd : l.ToDate;
                        var days = CountWorkingDays(s, en, holidays);

                        used += days;
                        if (l.Status == "Pending") pending += days;
                    }

                    bool isUnlimited = entitlement == 0;
                    int remaining = isUnlimited ? 0 : Math.Max(0, entitlement - used);

                    balances.Add(new LeaveTypeBalanceItem
                    {
                        LeaveType = leaveType,
                        Entitlement = entitlement,
                        Used = used,
                        Pending = pending,
                        Remaining = remaining,
                        IsUnlimited = isUnlimited
                    });
                }

                result.Add(new LeaveBalanceDto
                {
                    UserId = user.Id,
                    UserName = user.FullName,
                    Year = year,
                    Balances = balances
                });
            }

            return result;
        }

        // ── Private: load public holiday dates for a year range ───────────────
        private async Task<HashSet<DateTime>> GetHolidayDatesAsync(int fromYear, int toYear = -1)
        {
            if (toYear < fromYear) toYear = fromYear;

            var holidays = await _db.Holidays
                .Where(h => h.Year >= fromYear && h.Year <= toYear && h.Type == "Public")
                .Select(h => h.Date.Date)
                .ToListAsync();

            return holidays.ToHashSet();
        }

        // ── CHANGED: skips public holidays in addition to weekends ───────────
        //
        // BEFORE: only skipped Saturday + Sunday
        // AFTER:  skips Saturday + Sunday + any date in the holidays HashSet
        private static int CountWorkingDays(DateTime from, DateTime to, HashSet<DateTime> holidays)
        {
            int count = 0;
            for (var date = from.Date; date <= to.Date; date = date.AddDays(1))
            {
                if (date.DayOfWeek != DayOfWeek.Saturday &&
                    date.DayOfWeek != DayOfWeek.Sunday &&
                    !holidays.Contains(date))
                {
                    count++;
                }
            }
            return count;
        }

        // ── UNCHANGED ─────────────────────────────────────────────────────────
        private static Task<LeaveResponseDto> MapLeave(LeaveRequest l) =>
            Task.FromResult(new LeaveResponseDto
            {
                Id = l.Id,
                UserName = l.User?.FullName ?? "Unknown",
                FromDate = l.FromDate,
                ToDate = l.ToDate,
                LeaveDays = CountDaysSimple(l.FromDate, l.ToDate),
                LeaveType = l.LeaveType,
                Reason = l.Reason,
                Status = l.Status,
                ReviewerName = l.ReviewedBy?.FullName,
                ReviewNote = l.ReviewNote,
                ReviewedAt = l.ReviewedAt,
                AppliedAt = l.AppliedAt
            });

        private static int CountDaysSimple(DateTime from, DateTime to)
        {
            int days = 0;
            for (var d = from; d <= to; d = d.AddDays(1))
                if (d.DayOfWeek is not DayOfWeek.Saturday and not DayOfWeek.Sunday)
                    days++;
            return Math.Max(1, days);
        }
    }
}