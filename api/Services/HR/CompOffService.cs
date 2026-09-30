// ─────────────────────────────────────────────────────────────────────────────
//  FILE: api/Services/HR/CompOffService.cs
//  Comp-off: a day off earned by working on a weekend or a public holiday.
//
//  1. Earning: a checked-out weekend / holiday day with at least MinHours of work
//     becomes one comp-off day, waiting for the manager / team lead.
//  2. The manager approves it on Employee Requests (or declines with a note).
//  3. Approved days are spent on a "CompOff" leave — each leave day takes the day
//     that runs out first. A rejected or cancelled leave gives them back.
//  4. A day is valid for ValidDays after the day worked; a reminder goes out a
//     week before it runs out.
// ─────────────────────────────────────────────────────────────────────────────

using DailyTrackerAPI.Custom;
using DailyTrackerAPI.Data;
using DailyTrackerAPI.DTOs;
using DailyTrackerAPI.Helpers;
using DailyTrackerAPI.Models.HR;
using DailyTrackerAPI.Services.Auth;
using DailyTrackerAPI.Services.Communication;
using Microsoft.EntityFrameworkCore;

namespace DailyTrackerAPI.Services.HR
{
    public interface ICompOffService
    {
        /// <summary>Turn weekend / holiday work of the last weeks into comp-off days (one person, or everyone)</summary>
        Task<int> SyncAsync(int? userId = null, CancellationToken ct = default);
        Task<MyCompOffDto> GetMineAsync(int userId);
        Task<List<CompOffCreditDto>> GetPendingAsync(int reviewerId);
        Task<List<CompOffCreditDto>> GetTeamAsync(int reviewerId);
        Task ReviewAsync(int reviewerId, int creditId, ReviewCompOffDto dto);
        /// <summary>Reserve one available day for each leave day (throws when there aren't enough)</summary>
        Task ReserveForLeaveAsync(LeaveRequest leave, IReadOnlyList<DateTime> leaveDays);
        /// <summary>A CompOff leave was rejected or cancelled: its days can be used again</summary>
        Task ReleaseForLeaveAsync(int leaveId);
        Task<int> SendExpiryRemindersAsync(CancellationToken ct = default);
    }

    public class CompOffService : ICompOffService
    {
        public const int MinHours = 4;          // less than this on a weekend earns nothing
        public const int ValidDays = 60;        // days after the day worked
        private const int LookBackDays = 30;    // how far back work is turned into comp-off
        private const int ReminderDays = 7;

        private readonly AppDbContext _db;
        private readonly ITeamScope _scope;
        private readonly IAppNotificationService _notify;
        private readonly ILogger<CompOffService> _logger;

        public CompOffService(AppDbContext db, ITeamScope scope, IAppNotificationService notify, ILogger<CompOffService> logger)
        {
            _db = db;
            _scope = scope;
            _notify = notify;
            _logger = logger;
        }

        private static string Day(DateTime d) => d.ToString("ddd d MMM");

        /// <summary>What a credit is right now</summary>
        public static string StateOf(CompOffCredit c, DateTime today) =>
            c.Status == "Pending" ? "Pending"
            : c.Status == "Rejected" ? "Rejected"
            : c.UsedByLeaveId != null ? "Used"
            : c.ExpiresOn < today ? "Expired"
            : "Available";

        // ── 1. Earning ───────────────────────────────────────────────────────

        public async Task<int> SyncAsync(int? userId = null, CancellationToken ct = default)
        {
            var since = AppClock.TodayIst.AddDays(-LookBackDays);
            var minMinutes = MinHours * 60;

            var days = await _db.DailyLogs
                .Where(d => (d.DayStatus == "Weekend" || d.DayStatus == "Holiday")
                            && d.CheckOutTime != null && d.LogDate >= since
                            && (userId == null || d.UserId == userId))
                .Select(d => new { d.Id, d.UserId, d.LogDate, d.DayStatus, d.TotalWorkMinutes })
                .ToListAsync(ct);
            if (days.Count == 0) return 0;

            var ids = days.Select(d => d.Id).ToList();
            var existing = await _db.CompOffCredits.Where(c => ids.Contains(c.DailyLogId)).ToDictionaryAsync(c => c.DailyLogId, ct);
            var holidayNames = await _db.Holidays.Where(h => h.Date >= since)
                .Select(h => new { h.Date, h.Name }).ToListAsync(ct);

            var created = new List<CompOffCredit>();
            foreach (var d in days)
            {
                if (existing.TryGetValue(d.Id, out var credit))
                {
                    // hours changed later (e.g. a check-out correction) while still waiting
                    if (credit.Status != "Pending" || credit.WorkMinutes == d.TotalWorkMinutes) continue;
                    if (d.TotalWorkMinutes < minMinutes) _db.CompOffCredits.Remove(credit);
                    else credit.WorkMinutes = d.TotalWorkMinutes;
                    continue;
                }
                if (d.TotalWorkMinutes < minMinutes) continue;

                var occasion = d.DayStatus == "Holiday"
                    ? holidayNames.FirstOrDefault(h => h.Date.Date == d.LogDate.Date)?.Name ?? "Holiday"
                    : d.LogDate.DayOfWeek.ToString();
                var c = new CompOffCredit
                {
                    UserId = d.UserId,
                    DailyLogId = d.Id,
                    WorkDate = d.LogDate.Date,
                    Occasion = occasion,
                    WorkMinutes = d.TotalWorkMinutes,
                    ExpiresOn = d.LogDate.Date.AddDays(ValidDays),
                };
                _db.CompOffCredits.Add(c);
                created.Add(c);
            }
            await _db.SaveChangesAsync(ct);

            foreach (var c in created)
            {
                var employee = await _db.Users.FindAsync(new object[] { c.UserId }, ct);
                var approvers = await _scope.ApproversAsync(c.UserId);
                await BestEffortAsync("employee notice", () => _notify.CreateAsync(c.UserId,
                    "🌴 Comp-off earned",
                    $"You worked on {Day(c.WorkDate)} ({c.Occasion}) — one comp-off day is waiting for your manager's approval.",
                    "Info", "/leave"));
                if (approvers.Count > 0)
                    await BestEffortAsync("approver notice", () => _notify.CreateForUsersAsync(approvers,
                        "🌴 Comp-off to approve",
                        $"{employee?.FullName} worked {c.WorkMinutes / 60}h {c.WorkMinutes % 60}m on {Day(c.WorkDate)} ({c.Occasion}).",
                        "Info", "/manager/wfh-dashboard"));
            }
            if (created.Count > 0) _logger.LogInformation("Comp-off: {N} new day(s) earned", created.Count);
            return created.Count;
        }

        // ── 2. Lists ─────────────────────────────────────────────────────────

        public async Task<MyCompOffDto> GetMineAsync(int userId)
        {
            await SyncAsync(userId);
            var today = AppClock.TodayIst;
            var credits = await _db.CompOffCredits
                .Include(c => c.User).Include(c => c.ReviewedBy).Include(c => c.UsedByLeave)
                .Where(c => c.UserId == userId)
                .OrderByDescending(c => c.WorkDate)
                .ToListAsync();
            var rows = credits.Select(c => Map(c, today, userId)).ToList();
            return new MyCompOffDto
            {
                Available = rows.Count(r => r.State == "Available"),
                Pending = rows.Count(r => r.State == "Pending"),
                Used = rows.Count(r => r.State == "Used"),
                Expired = rows.Count(r => r.State == "Expired"),
                NextExpiry = rows.Where(r => r.State == "Available").Select(r => (DateTime?)r.ExpiresOn).Min(),
                MinHours = MinHours,
                ValidDays = ValidDays,
                Credits = rows,
            };
        }

        public async Task<List<CompOffCreditDto>> GetPendingAsync(int reviewerId)
        {
            await SyncAsync();
            var team = await _scope.ManagedUserIdsAsync(reviewerId);   // null = everyone (Manager)
            var today = AppClock.TodayIst;
            var rows = await _db.CompOffCredits
                .Include(c => c.User)
                .Where(c => c.Status == "Pending" && (team == null || team.Contains(c.UserId) || c.UserId == reviewerId))
                .OrderBy(c => c.WorkDate)
                .ToListAsync();

            var result = new List<CompOffCreditDto>();
            var mayReviewOwn = await _scope.MayReviewOwnAsync(reviewerId);
            foreach (var c in rows)
            {
                if (c.UserId == reviewerId && !mayReviewOwn) continue;
                result.Add(Map(c, today, reviewerId));
            }
            return result;
        }

        public async Task<List<CompOffCreditDto>> GetTeamAsync(int reviewerId)
        {
            var team = await _scope.ManagedUserIdsAsync(reviewerId);
            var today = AppClock.TodayIst;
            var since = today.AddDays(-ValidDays - LookBackDays);
            var rows = await _db.CompOffCredits
                .Include(c => c.User).Include(c => c.ReviewedBy).Include(c => c.UsedByLeave)
                .Where(c => c.WorkDate >= since && (team == null || team.Contains(c.UserId)))
                .OrderByDescending(c => c.WorkDate)
                .ToListAsync();
            return rows.Select(c => Map(c, today, reviewerId)).ToList();
        }

        private static CompOffCreditDto Map(CompOffCredit c, DateTime today, int viewerId) => new()
        {
            Id = c.Id,
            UserId = c.UserId,
            UserName = c.User?.FullName ?? "",
            WorkDate = c.WorkDate,
            Occasion = c.Occasion,
            WorkMinutes = c.WorkMinutes,
            State = StateOf(c, today),
            ExpiresOn = c.ExpiresOn,
            UsedOn = c.UsedByLeave?.FromDate,
            ReviewerName = c.ReviewedBy?.FullName,
            ReviewNote = c.ReviewNote,
            IsOwn = c.UserId == viewerId,
        };

        // ── 3. The manager's decision ────────────────────────────────────────

        public async Task ReviewAsync(int reviewerId, int creditId, ReviewCompOffDto dto)
        {
            if (dto.Status is not ("Approved" or "Rejected"))
                throw new InvalidOperationException("The decision must be Approved or Rejected.");
            var credit = await _db.CompOffCredits.FirstOrDefaultAsync(c => c.Id == creditId)
                ?? throw new KeyNotFoundException("That comp-off day was not found.");
            if (credit.Status != "Pending")
                throw new InvalidOperationException("This comp-off day was already decided.");
            if (credit.UserId == reviewerId)
            {
                if (!await _scope.MayReviewOwnAsync(reviewerId))
                    throw new UnauthorizedAccessException("You can't approve your own comp-off — your manager decides it.");
            }
            else await _scope.EnsureCanManageAsync(reviewerId, credit.UserId);

            var note = dto.Note?.Trim();
            credit.Status = dto.Status;
            credit.ReviewedById = reviewerId;
            credit.ReviewNote = string.IsNullOrEmpty(note) ? null : note[..Math.Min(note.Length, 300)];
            credit.ReviewedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync();

            var msg = dto.Status == "Approved"
                ? $"Your comp-off for working on {Day(credit.WorkDate)} was approved. Use it by {credit.ExpiresOn:d MMM yyyy} (apply for a Comp-off leave)."
                : $"Your comp-off for {Day(credit.WorkDate)} was not approved.";
            if (credit.ReviewNote != null) msg += $" Note: \"{credit.ReviewNote}\"";
            await BestEffortAsync("decision notice", () => _notify.CreateAsync(credit.UserId,
                dto.Status == "Approved" ? "✅ Comp-off approved" : "Comp-off declined", msg,
                dto.Status == "Approved" ? "Success" : "Warning", "/leave"));
        }

        // ── 4. Spending ──────────────────────────────────────────────────────

        public async Task ReserveForLeaveAsync(LeaveRequest leave, IReadOnlyList<DateTime> leaveDays)
        {
            var today = AppClock.TodayIst;
            var available = await _db.CompOffCredits
                .Where(c => c.UserId == leave.UserId && c.Status == "Approved" && c.UsedByLeaveId == null && c.ExpiresOn >= today)
                .OrderBy(c => c.ExpiresOn).ThenBy(c => c.Id)
                .ToListAsync();

            // each leave day takes the day that runs out first and is still valid on it
            var picked = new List<CompOffCredit>();
            foreach (var day in leaveDays.OrderBy(d => d))
            {
                var credit = available.FirstOrDefault(c => !picked.Contains(c) && c.ExpiresOn >= day.Date);
                if (credit == null)
                {
                    var usable = available.Count;
                    throw new ValidationException(usable == 0
                        ? "You have no approved comp-off days to use. Comp-off is earned by working on a weekend or holiday."
                        : available.Count >= leaveDays.Count
                            ? $"Some of your comp-off days run out before {day:d MMM} — the first expires on {available[0].ExpiresOn:d MMM yyyy}."
                            : $"You have {usable} comp-off day{(usable == 1 ? "" : "s")} available but asked for {leaveDays.Count}.");
                }
                picked.Add(credit);
            }
            foreach (var c in picked) c.UsedByLeave = leave;
        }

        public async Task ReleaseForLeaveAsync(int leaveId)
        {
            var used = await _db.CompOffCredits.Where(c => c.UsedByLeaveId == leaveId).ToListAsync();
            foreach (var c in used) c.UsedByLeaveId = null;
        }

        // ── 5. Running out ───────────────────────────────────────────────────

        public async Task<int> SendExpiryRemindersAsync(CancellationToken ct = default)
        {
            var today = AppClock.TodayIst;
            var soon = today.AddDays(ReminderDays);
            var expiring = await _db.CompOffCredits
                .Where(c => c.Status == "Approved" && c.UsedByLeaveId == null && !c.ExpiryReminderSent
                            && c.ExpiresOn >= today && c.ExpiresOn <= soon)
                .ToListAsync(ct);
            foreach (var group in expiring.GroupBy(c => c.UserId))
            {
                var first = group.Min(c => c.ExpiresOn);
                var n = group.Count();
                await BestEffortAsync("expiry reminder", () => _notify.CreateAsync(group.Key,
                    "⏳ Comp-off running out",
                    $"{n} comp-off day{(n == 1 ? "" : "s")} expire{(n == 1 ? "s" : "")} on {first:d MMM}. Apply for a Comp-off leave before then.",
                    "Warning", "/leave"));
                foreach (var c in group) c.ExpiryReminderSent = true;
            }
            await _db.SaveChangesAsync(ct);
            return expiring.Count;
        }

        private async Task BestEffortAsync(string what, Func<Task> action)
        {
            try { await action(); }
            catch (Exception ex) { _logger.LogWarning(ex, "Comp-off: {What} failed (the change itself was saved)", what); }
        }
    }
}
