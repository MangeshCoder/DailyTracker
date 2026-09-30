// ─────────────────────────────────────────────────────────────────────────────
//  FILE: api/Services/Attendance/AutoCheckoutService.cs
//  Forgotten check-outs.
//
//  1. Closing: a shift still open after the overnight cut-off (05:00 India time
//     the next morning) is closed at the LAST PROOF OF WORK — a task logged or
//     completed, support logged, a break, a chat message — or after a normal day
//     (8 h of work + the breaks taken) if that is later. So late work keeps its
//     overtime, and nobody gets a 24-hour day. The day is marked AutoCheckedOut.
//  2. The next morning the employee confirms the time in one click, or sends the
//     real end time; a manager / team lead approves it on Employee Requests and
//     the hours (and overtime) are recalculated.
// ─────────────────────────────────────────────────────────────────────────────

using DailyTrackerAPI.Data;
using DailyTrackerAPI.DTOs;
using DailyTrackerAPI.Helpers;
using DailyTrackerAPI.Models.Tasks;
using DailyTrackerAPI.Services.Auth;
using DailyTrackerAPI.Services.Communication;
using Microsoft.EntityFrameworkCore;

namespace DailyTrackerAPI.Services.Attendance
{
    public interface IAutoCheckoutService
    {
        /// <summary>Close forgotten shifts (one person, or everyone when userId is null)</summary>
        Task<int> CloseForgottenShiftsAsync(int? userId = null, CancellationToken ct = default);
        Task<AutoCheckoutDto?> GetUnansweredAsync(int userId);
        Task ConfirmAsync(int userId, int logId);
        Task RequestCorrectionAsync(int userId, int logId, CheckoutCorrectionRequestDto dto);
        Task<List<CheckoutCorrectionDto>> GetPendingCorrectionsAsync(int reviewerId);
        Task ReviewCorrectionAsync(int reviewerId, int logId, ReviewCheckoutCorrectionDto dto);
    }

    public class AutoCheckoutService : IAutoCheckoutService
    {
        /// <summary>A normal working day, before breaks</summary>
        public const int NormalWorkMinutes = 8 * 60;

        private readonly AppDbContext _db;
        private readonly ITeamScope _scope;
        private readonly IAppNotificationService _notify;
        private readonly ILogger<AutoCheckoutService> _logger;

        public AutoCheckoutService(AppDbContext db, ITeamScope scope, IAppNotificationService notify, ILogger<AutoCheckoutService> logger)
        {
            _db = db;
            _scope = scope;
            _notify = notify;
            _logger = logger;
        }

        /// <summary>The moment a shift of this day can no longer be running (05:00 India time next morning)</summary>
        public static DateTime CutoffUtc(DateTime logDate) =>
            AppClock.FromIst(logDate.Date.AddDays(1).AddHours(DailyLogQueries.ShiftCutoffHour));

        private static string Time(DateTime utc) => AppClock.ToIst(utc).ToString("hh:mm tt");
        private static string Day(DateTime date) => date.ToString("ddd d MMM");

        // ── 1. Closing ───────────────────────────────────────────────────────

        public async Task<int> CloseForgottenShiftsAsync(int? userId = null, CancellationToken ct = default)
        {
            var now = DateTime.UtcNow;
            // every day whose cut-off has passed: before yesterday always, yesterday after 05:00
            var lastClosableDay = DailyLogQueries.LastClosableDay(AppClock.NowIst);

            var open = await _db.DailyLogs
                .Include(d => d.BreakLogs)
                .Where(d => d.CheckInTime != null && d.CheckOutTime == null && d.LogDate <= lastClosableDay
                            && (userId == null || d.UserId == userId))
                .ToListAsync(ct);
            if (open.Count == 0) return 0;

            foreach (var log in open)
            {
                var checkIn = log.CheckInTime!.Value;
                var windowEnd = CutoffUtc(log.LogDate) < now ? CutoffUtc(log.LogDate) : now;

                // a break never ended: they left during it — it ends where it started
                foreach (var b in log.BreakLogs.Where(b => b.IsActive))
                {
                    b.EndTime = b.StartTime;
                    b.DurationMinutes = 0;
                    b.IsActive = false;
                }
                var breakMinutes = log.BreakLogs.Sum(b => b.DurationMinutes);

                var lastProof = await LastProofOfWorkAsync(log, checkIn, windowEnd, ct);
                var normalEnd = checkIn.AddMinutes(NormalWorkMinutes + breakMinutes);

                var (closeAt, basis) = lastProof is DateTime p && p > normalEnd
                    ? (p, "LastActivity")
                    : (normalEnd, "NormalDay");
                if (closeAt > windowEnd) closeAt = windowEnd;

                log.CheckOutTime = closeAt;
                log.TotalBreakMinutes = breakMinutes;
                log.TotalWorkMinutes = Math.Max(0, (int)(closeAt - checkIn).TotalMinutes - breakMinutes);
                log.AutoCheckedOut = true;
                log.AutoCheckOutBasis = basis;
            }
            await _db.SaveChangesAsync(ct);

            foreach (var log in open)
            {
                var how = log.AutoCheckOutBasis == "LastActivity" ? "at your last activity" : "after a normal working day";
                await BestEffortAsync("auto check-out notice", () => _notify.CreateAsync(log.UserId,
                    "⏰ You didn't check out",
                    $"We closed {Day(log.LogDate)} at {Time(log.CheckOutTime!.Value)} ({how}). Finished at a different time? Tell us on your dashboard.",
                    "Warning", "/"));
            }
            _logger.LogInformation("Auto check-out: closed {N} forgotten shift(s)", open.Count);
            return open.Count;
        }

        /// <summary>The latest thing the person did during the shift</summary>
        private async Task<DateTime?> LastProofOfWorkAsync(DailyLog log, DateTime from, DateTime to, CancellationToken ct)
        {
            var times = new List<DateTime>();
            times.AddRange(await _db.TaskLogs.Where(t => t.DailyLogId == log.Id).Select(t => t.CreatedAt).ToListAsync(ct));
            times.AddRange((await _db.TaskLogs.Where(t => t.DailyLogId == log.Id && t.CompletedAt != null)
                .Select(t => t.CompletedAt).ToListAsync(ct)).Select(t => t!.Value));
            times.AddRange(await _db.SupportLogs.Where(s => s.DailyLogId == log.Id).Select(s => s.SupportedAt).ToListAsync(ct));
            times.AddRange(log.BreakLogs.Select(b => b.StartTime));
            times.AddRange(log.BreakLogs.Where(b => b.EndTime != null).Select(b => b.EndTime!.Value));
            times.AddRange(await _db.ChatMessages
                .Where(m => m.SenderId == log.UserId && m.SentAt >= from && m.SentAt <= to)
                .Select(m => m.SentAt).ToListAsync(ct));

            var inShift = times.Where(t => t > from && t <= to).ToList();
            return inShift.Count == 0 ? null : inShift.Max();
        }

        // ── 2. The employee's answer ─────────────────────────────────────────

        public async Task<AutoCheckoutDto?> GetUnansweredAsync(int userId)
        {
            var since = AppClock.TodayIst.AddDays(-14);
            var log = await _db.DailyLogs
                .Where(d => d.UserId == userId && d.AutoCheckedOut && d.CorrectionStatus == null && d.LogDate >= since)
                .OrderByDescending(d => d.LogDate)
                .FirstOrDefaultAsync();
            return log == null ? null : new AutoCheckoutDto
            {
                LogId = log.Id,
                LogDate = log.LogDate,
                CheckInTime = log.CheckInTime!.Value,
                CheckOutTime = log.CheckOutTime!.Value,
                Basis = log.AutoCheckOutBasis ?? "NormalDay",
                WorkMinutes = log.TotalWorkMinutes,
                LatestAllowed = CutoffUtc(log.LogDate) < DateTime.UtcNow ? CutoffUtc(log.LogDate) : DateTime.UtcNow,
            };
        }

        private async Task<DailyLog> OwnAutoClosedAsync(int userId, int logId)
        {
            var log = await _db.DailyLogs.FirstOrDefaultAsync(d => d.Id == logId && d.UserId == userId)
                ?? throw new KeyNotFoundException("That day was not found.");
            if (!log.AutoCheckedOut)
                throw new InvalidOperationException("You checked out yourself that day — there is nothing to correct.");
            if (log.CorrectionStatus != null)
                throw new InvalidOperationException("You already answered for that day.");
            return log;
        }

        public async Task ConfirmAsync(int userId, int logId)
        {
            var log = await OwnAutoClosedAsync(userId, logId);
            log.CorrectionStatus = "Confirmed";
            await _db.SaveChangesAsync();
        }

        public async Task RequestCorrectionAsync(int userId, int logId, CheckoutCorrectionRequestDto dto)
        {
            var log = await OwnAutoClosedAsync(userId, logId);
            var reason = dto.Reason?.Trim() ?? "";
            if (reason.Length == 0)
                throw new InvalidOperationException("Please say briefly why the time is different (e.g. \"worked late on the release\").");
            if (reason.Length > 300) throw new InvalidOperationException("Please keep the reason under 300 characters.");

            var when = DateTime.SpecifyKind(dto.CheckOutTime, DateTimeKind.Utc);
            if (dto.CheckOutTime.Kind == DateTimeKind.Local) when = dto.CheckOutTime.ToUniversalTime();
            var latest = CutoffUtc(log.LogDate) < DateTime.UtcNow ? CutoffUtc(log.LogDate) : DateTime.UtcNow;
            if (when <= log.CheckInTime!.Value)
                throw new InvalidOperationException($"The finish time must be after your check-in ({Time(log.CheckInTime.Value)}).");
            if (when > latest)
                throw new InvalidOperationException($"The finish time can be at most {Time(latest)} the next morning.");
            if (Math.Abs((when - log.CheckOutTime!.Value).TotalMinutes) < 1)
                throw new InvalidOperationException("That is the time already saved — use \"That's right\" instead.");

            log.CorrectionCheckOut = when;
            log.CorrectionReason = reason;
            log.CorrectionStatus = "Pending";
            await _db.SaveChangesAsync();

            var employee = await _db.Users.FindAsync(userId);
            var approvers = await _scope.ApproversAsync(userId);
            if (approvers.Count > 0)
                await BestEffortAsync("correction notice", () => _notify.CreateForUsersAsync(approvers,
                    "🕒 Check-out correction",
                    $"{employee?.FullName} says they finished {Day(log.LogDate)} at {Time(when)}, not {Time(log.CheckOutTime.Value)}.",
                    "Info", "/manager/wfh-dashboard"));
        }

        // ── 3. The manager's decision ────────────────────────────────────────

        public async Task<List<CheckoutCorrectionDto>> GetPendingCorrectionsAsync(int reviewerId)
        {
            var team = await _scope.ManagedUserIdsAsync(reviewerId);   // null = everyone (Manager)
            var rows = await _db.DailyLogs
                .Include(d => d.User)
                .Where(d => d.CorrectionStatus == "Pending" && (team == null || team.Contains(d.UserId) || d.UserId == reviewerId))
                .OrderBy(d => d.LogDate)
                .ToListAsync();

            var result = new List<CheckoutCorrectionDto>();
            foreach (var d in rows)
            {
                var own = d.UserId == reviewerId;
                if (own && !await _scope.MayReviewOwnAsync(reviewerId)) continue;
                result.Add(new CheckoutCorrectionDto
                {
                    LogId = d.Id,
                    UserId = d.UserId,
                    UserName = d.User.FullName,
                    LogDate = d.LogDate,
                    CheckInTime = d.CheckInTime!.Value,
                    AutoCheckOutTime = d.CheckOutTime!.Value,
                    RequestedCheckOut = d.CorrectionCheckOut!.Value,
                    Basis = d.AutoCheckOutBasis ?? "NormalDay",
                    Reason = d.CorrectionReason ?? "",
                    IsOwn = own,
                });
            }
            return result;
        }

        public async Task ReviewCorrectionAsync(int reviewerId, int logId, ReviewCheckoutCorrectionDto dto)
        {
            if (dto.Status is not ("Approved" or "Rejected"))
                throw new InvalidOperationException("The decision must be Approved or Rejected.");
            var log = await _db.DailyLogs.Include(d => d.BreakLogs).FirstOrDefaultAsync(d => d.Id == logId)
                ?? throw new KeyNotFoundException("That correction was not found.");
            if (log.CorrectionStatus != "Pending")
                throw new InvalidOperationException("This correction was already decided.");
            if (log.UserId == reviewerId)
            {
                if (!await _scope.MayReviewOwnAsync(reviewerId))
                    throw new UnauthorizedAccessException("You can't approve your own correction — your manager decides it.");
            }
            else await _scope.EnsureCanManageAsync(reviewerId, log.UserId);

            if (dto.Status == "Approved")
            {
                var end = log.CorrectionCheckOut!.Value;
                var start = log.CheckInTime!.Value;
                // breaks count only for the part inside the corrected shift
                var breakMinutes = log.BreakLogs.Where(b => b.EndTime != null).Sum(b =>
                {
                    var s = b.StartTime < start ? start : b.StartTime;
                    var e = b.EndTime!.Value > end ? end : b.EndTime.Value;
                    return e > s ? (int)(e - s).TotalMinutes : 0;
                });
                log.CheckOutTime = end;
                log.TotalBreakMinutes = breakMinutes;
                log.TotalWorkMinutes = Math.Max(0, (int)(end - start).TotalMinutes - breakMinutes);
            }
            log.CorrectionStatus = dto.Status;
            log.CorrectionReviewedById = reviewerId;
            log.CorrectionReviewNote = string.IsNullOrWhiteSpace(dto.Note) ? null : dto.Note.Trim()[..Math.Min(dto.Note.Trim().Length, 300)];
            log.CorrectionReviewedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync();

            var msg = dto.Status == "Approved"
                ? $"Your check-out for {Day(log.LogDate)} is now {Time(log.CheckOutTime!.Value)} — your hours were updated."
                : $"Your check-out correction for {Day(log.LogDate)} was not approved; it stays {Time(log.CheckOutTime!.Value)}.";
            if (log.CorrectionReviewNote != null) msg += $" Note: \"{log.CorrectionReviewNote}\"";
            await BestEffortAsync("correction decision notice", () => _notify.CreateAsync(log.UserId,
                dto.Status == "Approved" ? "✅ Check-out corrected" : "Check-out correction declined", msg,
                dto.Status == "Approved" ? "Success" : "Warning", "/history"));
        }

        private async Task BestEffortAsync(string what, Func<Task> action)
        {
            try { await action(); }
            catch (Exception ex) { _logger.LogWarning(ex, "Auto check-out: {What} failed (the change itself was saved)", what); }
        }
    }
}
