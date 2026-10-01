using System.Globalization;
using DailyTrackerAPI.Data;
using DailyTrackerAPI.Helpers;
using DailyTrackerAPI.Models.Tasks;
using DailyTrackerAPI.Services.Auth;
using DailyTrackerAPI.Services.Communication;
using Microsoft.EntityFrameworkCore;

namespace DailyTrackerAPI.Services.Attendance
{
    // ─────────────────────────────────────────────────────────────────────────
    //  Missed check-in: "I worked on Tue 29 Sep, 9:30–18:30, but forgot to check in."
    //  The employee's team lead / manager (or whoever covers for them) decides on
    //  Employee Requests. Approving adds the day as a normal attendance record, so
    //  attendance %, absences and payroll count it like any other day.
    //
    //  Rules: a working day (Mon–Fri, not a public holiday) in the last 30 days,
    //  not before joining (or the first check-in, if earlier — as the calendar counts), not today (just check in), no check-in already that day,
    //  no approved leave that day, one open request per day.
    // ─────────────────────────────────────────────────────────────────────────

    public record MissedCheckInCreateDto(DateTime Date, string CheckIn, string CheckOut, string? WorkMode, string Reason);
    public record MissedCheckInReviewDto(string Status, string? Note);
    public record MissedCheckInDto(
        int Id, int UserId, string UserName, DateTime Date, DateTime CheckIn, DateTime CheckOut, string WorkMode,
        string Reason, string Status, string? ReviewedBy, string? ReviewNote, DateTime? ReviewedAt, DateTime CreatedAt, bool IsOwn);

    public interface IMissedCheckInService
    {
        Task<MissedCheckInDto> RequestAsync(int userId, MissedCheckInCreateDto dto);
        Task<List<MissedCheckInDto>> GetMineAsync(int userId);
        Task CancelAsync(int userId, int id);
        Task<List<MissedCheckInDto>> GetPendingAsync(int reviewerId);
        Task<MissedCheckInDto> ReviewAsync(int reviewerId, int id, MissedCheckInReviewDto dto);
    }

    public class MissedCheckInService : IMissedCheckInService
    {
        public const int MaxDaysBack = 30;
        private readonly AppDbContext _db;
        private readonly ITeamScope _scope;
        private readonly IAppNotificationService _notify;
        private readonly ILogger<MissedCheckInService> _log;

        public MissedCheckInService(AppDbContext db, ITeamScope scope, IAppNotificationService notify, ILogger<MissedCheckInService> log)
        { _db = db; _scope = scope; _notify = notify; _log = log; }

        private static string Day(DateTime d) => d.ToString("ddd d MMM", CultureInfo.InvariantCulture);
        private static string Time(DateTime utc) => utc.ToIstTime().ToString("hh:mm tt", CultureInfo.InvariantCulture);

        private static DateTime ParseTime(DateTime day, string hhmm, string which)
        {
            if (!TimeSpan.TryParseExact(hhmm?.Trim() ?? "", new[] { @"hh\:mm", @"h\:mm" }, CultureInfo.InvariantCulture, out var t) || t >= TimeSpan.FromDays(1))
                throw new InvalidOperationException($"Please give the {which} time as hours:minutes, e.g. 09:30.");
            return AppClock.FromIst(day.Date + t);
        }

        // ── 1. The employee asks ─────────────────────────────────────────────

        public async Task<MissedCheckInDto> RequestAsync(int userId, MissedCheckInCreateDto dto)
        {
            var user = await _db.Users.FindAsync(userId) ?? throw new KeyNotFoundException("User not found.");
            var day = dto.Date.Date;
            var today = AppClock.TodayIst;

            if (day >= today)
                throw new InvalidOperationException(day == today
                    ? "For today, just check in on the dashboard."
                    : "You can only add a day that has already passed.");
            if (day < today.AddDays(-MaxDaysBack))
                throw new InvalidOperationException($"Only the last {MaxDaysBack} days can be added — ask your manager about older days.");
            // same start as the attendance calendar: the joining date, or the first check-in if earlier
            var firstLog = await _db.DailyLogs.Where(l => l.UserId == userId).MinAsync(l => (DateTime?)l.LogDate);
            if (day < AttendanceDays.StartedOn(user, firstLog))
                throw new InvalidOperationException("That day is before you joined.");
            var holidays = await _db.Holidays.Where(h => h.Type == "Public" && h.Date >= day && h.Date < day.AddDays(1))
                .Select(h => h.Date).ToListAsync();
            if (!AttendanceDays.IsWorkingDay(day, holidays.Select(h => h.Date).ToHashSet()))
                throw new InvalidOperationException("That day is a weekend or public holiday — work on those days is handled as comp-off.");

            if (await _db.DailyLogs.AnyAsync(l => l.UserId == userId && l.LogDate == day))
                throw new InvalidOperationException("You already have a check-in that day. If the check-out time is wrong, correct that instead.");
            if (await _db.LeaveRequests.AnyAsync(l => l.UserId == userId && l.Status == "Approved" && l.FromDate <= day && l.ToDate >= day))
                throw new InvalidOperationException("You were on approved leave that day. Cancel the leave first if you actually worked.");
            if (await _db.MissedCheckInRequests.AnyAsync(r => r.UserId == userId && r.Date == day && (r.Status == "Pending" || r.Status == "Approved")))
                throw new InvalidOperationException("You already asked for that day.");

            var checkIn = ParseTime(day, dto.CheckIn, "check-in");
            var checkOut = ParseTime(day, dto.CheckOut, "check-out");
            if (checkOut <= checkIn)
                throw new InvalidOperationException("The check-out time must be after the check-in time.");
            if ((checkOut - checkIn).TotalMinutes < 15)
                throw new InvalidOperationException("That's less than 15 minutes — please check the times.");

            var mode = string.IsNullOrWhiteSpace(dto.WorkMode) ? "Office" : dto.WorkMode.Trim();
            if (mode is not ("Office" or "WFH"))
                throw new InvalidOperationException("Choose Office or WFH.");
            var reason = dto.Reason?.Trim() ?? "";
            if (reason.Length < 3)
                throw new InvalidOperationException("Please say briefly why you couldn't check in (e.g. \"phone battery died\").");
            if (reason.Length > 300) throw new InvalidOperationException("Please keep the reason under 300 characters.");

            var req = new MissedCheckInRequest
            {
                UserId = userId, Date = day, CheckIn = checkIn, CheckOut = checkOut, WorkMode = mode, Reason = reason,
            };
            _db.MissedCheckInRequests.Add(req);
            await _db.SaveChangesAsync();

            var approvers = await _scope.ApproversAsync(userId);
            if (approvers.Count > 0)
                await BestEffortAsync("request notice", () => _notify.CreateForUsersAsync(approvers,
                    "🕘 Missed check-in",
                    $"{user.FullName} forgot to check in on {Day(day)} — says {Time(checkIn)}–{Time(checkOut)}{(mode == "WFH" ? " (WFH)" : "")}.",
                    "Info", "/manager/wfh-dashboard"));

            return Map(req, user.FullName, null, userId);
        }

        public async Task<List<MissedCheckInDto>> GetMineAsync(int userId) =>
            (await _db.MissedCheckInRequests.Include(r => r.User).Include(r => r.ReviewedBy)
                .Where(r => r.UserId == userId && r.Status != "Cancelled")
                .OrderByDescending(r => r.Date).Take(50).ToListAsync())
            .Select(r => Map(r, r.User.FullName, r.ReviewedBy?.FullName, userId)).ToList();

        public async Task CancelAsync(int userId, int id)
        {
            var r = await _db.MissedCheckInRequests.FirstOrDefaultAsync(x => x.Id == id && x.UserId == userId)
                ?? throw new KeyNotFoundException("That request was not found.");
            if (r.Status != "Pending") throw new InvalidOperationException($"This request is already {r.Status.ToLowerInvariant()}.");
            r.Status = "Cancelled";
            await _db.SaveChangesAsync();
        }

        // ── 2. The team lead / manager decides ───────────────────────────────

        public async Task<List<MissedCheckInDto>> GetPendingAsync(int reviewerId)
        {
            var team = await _scope.ManagedUserIdsAsync(reviewerId);   // null = everyone (Manager)
            var rows = await _db.MissedCheckInRequests.Include(r => r.User)
                .Where(r => r.Status == "Pending" && (team == null || team.Contains(r.UserId) || r.UserId == reviewerId))
                .OrderBy(r => r.Date).ToListAsync();
            var mayOwn = rows.Any(r => r.UserId == reviewerId) && await _scope.MayReviewOwnAsync(reviewerId);
            return rows.Where(r => r.UserId != reviewerId || mayOwn)
                .Select(r => Map(r, r.User.FullName, null, reviewerId)).ToList();
        }

        public async Task<MissedCheckInDto> ReviewAsync(int reviewerId, int id, MissedCheckInReviewDto dto)
        {
            if (dto.Status is not ("Approved" or "Rejected"))
                throw new InvalidOperationException("The decision must be Approved or Rejected.");
            var r = await _db.MissedCheckInRequests.Include(x => x.User).FirstOrDefaultAsync(x => x.Id == id)
                ?? throw new KeyNotFoundException("That request was not found.");
            if (r.Status != "Pending")
                throw new InvalidOperationException($"This request was already {r.Status.ToLowerInvariant()}.");
            if (r.UserId == reviewerId)
            {
                if (!await _scope.MayReviewOwnAsync(reviewerId))
                    throw new UnauthorizedAccessException("You can't approve your own request — your manager decides it.");
            }
            else await _scope.EnsureCanManageAsync(reviewerId, r.UserId);

            var note = string.IsNullOrWhiteSpace(dto.Note) ? null : dto.Note.Trim()[..Math.Min(dto.Note.Trim().Length, 300)];
            if (dto.Status == "Rejected" && note == null)
                throw new InvalidOperationException("Please give a short reason for declining.");

            if (dto.Status == "Approved")
            {
                if (await _db.DailyLogs.AnyAsync(l => l.UserId == r.UserId && l.LogDate == r.Date))
                    throw new InvalidOperationException("There is already a check-in for that day — this request is no longer needed.");
                var reviewer = await _db.Users.FindAsync(reviewerId);
                var log = new DailyLog
                {
                    UserId = r.UserId,
                    LogDate = r.Date,
                    CheckInTime = r.CheckIn,
                    CheckOutTime = r.CheckOut,
                    TotalWorkMinutes = (int)(r.CheckOut - r.CheckIn).TotalMinutes,
                    DayStatus = r.WorkMode == "WFH" ? "WFH" : "Present",
                    Notes = $"Missed check-in added after approval by {reviewer?.FullName ?? "manager"}: {r.Reason}",
                };
                _db.DailyLogs.Add(log);
                await _db.SaveChangesAsync();
                r.DailyLogId = log.Id;
            }
            r.Status = dto.Status;
            r.ReviewedById = reviewerId;
            r.ReviewNote = note;
            r.ReviewedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync();

            var msg = dto.Status == "Approved"
                ? $"{Day(r.Date)} ({Time(r.CheckIn)}–{Time(r.CheckOut)}) was added to your attendance."
                : $"Your missed check-in for {Day(r.Date)} was not approved.";
            if (note != null) msg += $" Note: \"{note}\"";
            await BestEffortAsync("decision notice", () => _notify.CreateAsync(r.UserId,
                dto.Status == "Approved" ? "✅ Missed check-in added" : "Missed check-in declined", msg,
                dto.Status == "Approved" ? "Success" : "Warning", "/my-report"));

            var reviewerName = (await _db.Users.FindAsync(reviewerId))?.FullName;
            return Map(r, r.User.FullName, reviewerName, reviewerId);
        }

        private static MissedCheckInDto Map(MissedCheckInRequest r, string userName, string? reviewer, int viewerId) =>
            new(r.Id, r.UserId, userName, r.Date, r.CheckIn, r.CheckOut, r.WorkMode, r.Reason, r.Status,
                reviewer, r.ReviewNote, r.ReviewedAt, r.CreatedAt, r.UserId == viewerId);

        private async Task BestEffortAsync(string what, Func<Task> action)
        {
            try { await action(); }
            catch (Exception ex) { _log.LogWarning(ex, "Missed check-in: {What} failed (the change itself was saved)", what); }
        }
    }
}
