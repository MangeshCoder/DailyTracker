using DailyTrackerAPI.Data;
using DailyTrackerAPI.Helpers;
using Microsoft.EntityFrameworkCore;

namespace DailyTrackerAPI.Services.Auth
{
    /// <summary>
    /// Who may manage whom — one rule for every "team" feature:
    ///   Manager  → everyone
    ///   TeamLead → only their direct reports (people whose manager is set to them)
    ///   others   → nobody (their own data is handled by each feature)
    /// Plus approval delegation: while a manager / team lead is away, the person they
    /// handed over to also covers their people and receives their requests.
    /// </summary>
    public interface ITeamScope
    {
        /// <summary>null = everyone (a Manager); otherwise exactly these user ids</summary>
        Task<HashSet<int>?> ManagedUserIdsAsync(int actorId);

        Task<bool> CanManageAsync(int actorId, int targetUserId);

        /// <summary>Throws UnauthorizedAccessException (→ 403) when the actor can't manage the target</summary>
        Task EnsureCanManageAsync(int actorId, int targetUserId);

        Task<bool> IsManagerAsync(int actorId);

        /// <summary>Who decides this person's requests: their own manager / team lead, else every active manager (never themselves); anyone away is replaced by their delegate</summary>
        Task<List<int>> ApproversAsync(int userId);

        /// <summary>A manager / team lead may decide their own request only when nobody else could</summary>
        Task<bool> MayReviewOwnAsync(int userId);

        /// <summary>The people who handed their approvals to this person today</summary>
        Task<List<int>> ActingForAsync(int actorId);

        /// <summary>Today this person decides for a Manager who is away (e.g. a team lead covering leave)</summary>
        Task<bool> ActsForManagerAsync(int actorId);

        /// <summary>Who decides for this person today, if they handed over (null = they're not away)</summary>
        Task<int?> DelegateOfAsync(int userId);

        /// <summary>Why <paramref name="userId"/> can't report to <paramref name="managerId"/> (null = fine):
        /// it must be an active Manager or Team Lead, not themselves, and not someone who already reports to them</summary>
        Task<string?> ReportsToProblemAsync(int userId, int managerId);
    }

    public class TeamScope : ITeamScope
    {
        private readonly AppDbContext _db;
        public TeamScope(AppDbContext db) => _db = db;

        public async Task<bool> IsManagerAsync(int actorId) =>
            await _db.Users.AnyAsync(u => u.Id == actorId && u.IsActive && u.Role == "Manager");

        /// <summary>The actor's own people, without delegation</summary>
        private async Task<HashSet<int>?> OwnManagedAsync(int actorId)
        {
            var actor = await _db.Users.AsNoTracking()
                .Where(u => u.Id == actorId && u.IsActive)
                .Select(u => new { u.Role })
                .FirstOrDefaultAsync();
            if (actor?.Role == "Manager") return null;
            if (actor?.Role != "TeamLead") return new HashSet<int>();
            return (await _db.Users
                .Where(u => u.ManagerId == actorId && u.Id != actorId && u.Role != "Pending")
                .Select(u => u.Id)
                .ToListAsync()).ToHashSet();
        }

        public async Task<HashSet<int>?> ManagedUserIdsAsync(int actorId)
        {
            var ids = await OwnManagedAsync(actorId);
            if (ids == null) return null;
            foreach (var from in await ActingForAsync(actorId))
            {
                var theirs = await OwnManagedAsync(from);
                if (theirs == null) return null;          // covering for a Manager: everyone
                ids.UnionWith(theirs);
            }
            ids.Remove(actorId);                          // never your own requests this way
            return ids;
        }

        public async Task<bool> CanManageAsync(int actorId, int targetUserId)
        {
            var ids = await ManagedUserIdsAsync(actorId);
            return ids == null || ids.Contains(targetUserId);
        }

        public async Task<List<int>> ApproversAsync(int userId)
        {
            var user = await _db.Users.FindAsync(userId);
            List<int> approvers;
            if (user?.ManagerId is int mid && mid != userId
                && await _db.Users.AnyAsync(u => u.Id == mid && u.IsActive && (u.Role == "Manager" || u.Role == "TeamLead")))
                approvers = new() { mid };
            else
                approvers = await _db.Users.Where(u => u.Role == "Manager" && u.IsActive && u.Id != userId).Select(u => u.Id).ToListAsync();

            // someone away → the person they handed over to
            var result = new List<int>();
            foreach (var a in approvers)
            {
                var decider = await DelegateOfAsync(a) ?? a;
                if (decider != userId && !result.Contains(decider)) result.Add(decider);
            }
            return result;
        }

        public async Task<bool> MayReviewOwnAsync(int userId) =>
            await _db.Users.AnyAsync(u => u.Id == userId && u.IsActive && (u.Role == "Manager" || u.Role == "TeamLead"))
            && (await ApproversAsync(userId)).Count == 0;

        public async Task EnsureCanManageAsync(int actorId, int targetUserId)
        {
            if (!await CanManageAsync(actorId, targetUserId))
                throw new UnauthorizedAccessException("You can only manage people in your own team.");
        }

        // ── Delegation ───────────────────────────────────────────────────────

        private IQueryable<Models.HR.ApprovalDelegation> ActiveToday()
        {
            var today = AppClock.TodayIst;
            return _db.ApprovalDelegations.Where(d => d.CancelledAt == null && d.StartDate <= today && d.EndDate >= today
                                                      && d.To.IsActive && (d.To.Role == "Manager" || d.To.Role == "TeamLead"));
        }

        public async Task<List<int>> ActingForAsync(int actorId) =>
            await ActiveToday().Where(d => d.ToUserId == actorId).Select(d => d.FromUserId).Distinct().ToListAsync();

        public async Task<bool> ActsForManagerAsync(int actorId) =>
            await ActiveToday().AnyAsync(d => d.ToUserId == actorId && d.From.Role == "Manager" && d.From.IsActive);

        public async Task<string?> ReportsToProblemAsync(int userId, int managerId)
        {
            if (managerId == userId) return "Someone can't report to themselves.";
            var boss = await _db.Users.AsNoTracking().Where(u => u.Id == managerId)
                .Select(u => new { u.IsActive, u.Role, u.ManagerId }).FirstOrDefaultAsync();
            if (boss == null || !boss.IsActive) return "That person isn't an active user.";
            if (boss.Role != "Manager" && boss.Role != "TeamLead") return "People can only report to a Manager or a Team Lead.";
            // no loops: walk up from the new boss; we must not reach the person themselves
            var next = boss.ManagerId;
            for (var hops = 0; next != null && hops < 50; hops++)
            {
                if (next == userId) return "That would make a loop — this person already manages them.";
                next = await _db.Users.AsNoTracking().Where(u => u.Id == next).Select(u => u.ManagerId).FirstOrDefaultAsync();
            }
            return null;
        }

        public async Task<int?> DelegateOfAsync(int userId) =>
            await ActiveToday().Where(d => d.FromUserId == userId).OrderBy(d => d.Id).Select(d => (int?)d.ToUserId).FirstOrDefaultAsync();
    }
}
