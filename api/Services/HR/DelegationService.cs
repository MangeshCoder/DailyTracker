// ─────────────────────────────────────────────────────────────────────────────
//  FILE: api/Services/HR/DelegationService.cs
//  Approval delegation: a manager / team lead going on leave hands their
//  approvals to a colleague for some days, so nothing waits for them.
//  The rules of who may decide what live in TeamScope; this file only keeps
//  the hand-overs themselves.
// ─────────────────────────────────────────────────────────────────────────────

using DailyTrackerAPI.Data;
using DailyTrackerAPI.Helpers;
using DailyTrackerAPI.Models.HR;
using DailyTrackerAPI.Services.Communication;
using Microsoft.EntityFrameworkCore;

namespace DailyTrackerAPI.Services.HR
{
    public class DelegationDto
    {
        public int Id { get; set; }
        public int FromUserId { get; set; }
        public string FromName { get; set; } = "";
        public string FromRole { get; set; } = "";
        public int ToUserId { get; set; }
        public string ToName { get; set; } = "";
        public DateTime StartDate { get; set; }
        public DateTime EndDate { get; set; }
        public string? Note { get; set; }
        /// <summary>Upcoming, Active or Ended</summary>
        public string State { get; set; } = "";
    }

    public class MyDelegationsDto
    {
        /// <summary>My hand-overs (not cancelled, not ended)</summary>
        public List<DelegationDto> Outgoing { get; set; } = new();
        /// <summary>People I decide for today</summary>
        public List<DelegationDto> ActingFor { get; set; } = new();
        /// <summary>Hand-overs to me that start later</summary>
        public List<DelegationDto> Upcoming { get; set; } = new();
    }

    public class CreateDelegationDto
    {
        public int ToUserId { get; set; }
        public DateTime StartDate { get; set; }
        public DateTime EndDate { get; set; }
        public string? Note { get; set; }
    }

    public interface IDelegationService
    {
        Task<DelegationDto> CreateAsync(int fromUserId, CreateDelegationDto dto);
        Task CancelAsync(int userId, int delegationId);
        Task<MyDelegationsDto> GetMineAsync(int userId);
    }

    public class DelegationService : IDelegationService
    {
        public const int MaxDays = 90;

        private readonly AppDbContext _db;
        private readonly IAppNotificationService _notify;
        private readonly ILogger<DelegationService> _logger;

        public DelegationService(AppDbContext db, IAppNotificationService notify, ILogger<DelegationService> logger)
        {
            _db = db;
            _notify = notify;
            _logger = logger;
        }

        private static string Day(DateTime d) => d.ToString("ddd d MMM");

        public async Task<DelegationDto> CreateAsync(int fromUserId, CreateDelegationDto dto)
        {
            var today = AppClock.TodayIst;
            var from = await _db.Users.FindAsync(fromUserId) ?? throw new KeyNotFoundException("User not found.");
            if (from.Role is not ("Manager" or "TeamLead"))
                throw new UnauthorizedAccessException("Only managers and team leads hand over approvals.");
            if (dto.ToUserId == fromUserId) throw new InvalidOperationException("Choose someone else to decide while you're away.");
            var to = await _db.Users.FindAsync(dto.ToUserId);
            if (to == null || !to.IsActive || to.Role is not ("Manager" or "TeamLead"))
                throw new InvalidOperationException("Choose an active manager or team lead.");

            if (dto.StartDate == default || dto.EndDate == default) throw new InvalidOperationException("Please choose the From and To dates.");
            var start = dto.StartDate.Date;
            var end = dto.EndDate.Date;
            if (start < today) throw new InvalidOperationException("The hand-over can't start in the past.");
            if (end < start) throw new InvalidOperationException("The To date must be on or after the From date.");
            if ((end - start).TotalDays + 1 > MaxDays) throw new InvalidOperationException($"A hand-over can be at most {MaxDays} days.");

            var mine = _db.ApprovalDelegations.Where(d => d.CancelledAt == null && d.StartDate <= end && d.EndDate >= start);
            if (await mine.AnyAsync(d => d.FromUserId == fromUserId))
                throw new InvalidOperationException("You already handed over your approvals for some of these days.");
            if (await mine.AnyAsync(d => d.FromUserId == to.Id))
                throw new InvalidOperationException($"{to.FullName} is away for some of these days — choose someone else.");
            if (await mine.AnyAsync(d => d.ToUserId == fromUserId))
                throw new InvalidOperationException("You are deciding for someone else on some of these days — hand that back first.");

            var note = dto.Note?.Trim();
            var d = new ApprovalDelegation
            {
                FromUserId = fromUserId, ToUserId = to.Id, StartDate = start, EndDate = end,
                Note = string.IsNullOrEmpty(note) ? null : note[..Math.Min(note.Length, 300)],
            };
            _db.ApprovalDelegations.Add(d);
            await _db.SaveChangesAsync();

            await BestEffortAsync("delegate notice", () => _notify.CreateAsync(to.Id,
                "🤝 You're covering approvals",
                $"{from.FullName} is away {Day(start)} – {Day(end)}. You'll decide their team's leave, WFH, comp-off, expenses and check-out corrections.",
                "Info", "/manager/wfh-dashboard"));
            d.From = from; d.To = to;
            return Map(d, today);
        }

        public async Task CancelAsync(int userId, int delegationId)
        {
            var d = await _db.ApprovalDelegations.Include(x => x.From).FirstOrDefaultAsync(x => x.Id == delegationId && x.FromUserId == userId)
                ?? throw new KeyNotFoundException("That hand-over was not found.");
            if (d.CancelledAt != null) return;
            var today = AppClock.TodayIst;
            if (d.EndDate < today) throw new InvalidOperationException("That hand-over has already ended.");
            d.CancelledAt = DateTime.UtcNow;
            await _db.SaveChangesAsync();
            await BestEffortAsync("delegate cancel notice", () => _notify.CreateAsync(d.ToUserId,
                "Approvals handed back", $"{d.From.FullName} is deciding their own team's requests again.", "Info", "/manager/wfh-dashboard"));
        }

        public async Task<MyDelegationsDto> GetMineAsync(int userId)
        {
            var today = AppClock.TodayIst;
            var rows = await _db.ApprovalDelegations.Include(d => d.From).Include(d => d.To)
                .Where(d => d.CancelledAt == null && d.EndDate >= today && (d.FromUserId == userId || d.ToUserId == userId))
                .OrderBy(d => d.StartDate).ToListAsync();
            return new MyDelegationsDto
            {
                Outgoing = rows.Where(d => d.FromUserId == userId).Select(d => Map(d, today)).ToList(),
                ActingFor = rows.Where(d => d.ToUserId == userId && d.StartDate <= today && d.From.IsActive).Select(d => Map(d, today)).ToList(),
                Upcoming = rows.Where(d => d.ToUserId == userId && d.StartDate > today).Select(d => Map(d, today)).ToList(),
            };
        }

        private static DelegationDto Map(ApprovalDelegation d, DateTime today) => new()
        {
            Id = d.Id,
            FromUserId = d.FromUserId,
            FromName = d.From?.FullName ?? "",
            FromRole = d.From?.Role ?? "",
            ToUserId = d.ToUserId,
            ToName = d.To?.FullName ?? "",
            StartDate = d.StartDate,
            EndDate = d.EndDate,
            Note = d.Note,
            State = d.StartDate > today ? "Upcoming" : d.EndDate < today ? "Ended" : "Active",
        };

        private async Task BestEffortAsync(string what, Func<Task> action)
        {
            try { await action(); }
            catch (Exception ex) { _logger.LogWarning(ex, "Delegation: {What} failed (the change itself was saved)", what); }
        }
    }
}
