using DailyTrackerAPI.Data;
using Microsoft.EntityFrameworkCore;

namespace DailyTrackerAPI.Services.Auth
{
    /// <summary>
    /// Who may manage whom — one rule for every "team" feature:
    ///   Manager  → everyone
    ///   TeamLead → only their direct reports (people whose manager is set to them)
    ///   others   → nobody (their own data is handled by each feature)
    /// </summary>
    public interface ITeamScope
    {
        /// <summary>null = everyone (a Manager); otherwise exactly these user ids</summary>
        Task<HashSet<int>?> ManagedUserIdsAsync(int actorId);

        Task<bool> CanManageAsync(int actorId, int targetUserId);

        /// <summary>Throws UnauthorizedAccessException (→ 403) when the actor can't manage the target</summary>
        Task EnsureCanManageAsync(int actorId, int targetUserId);

        Task<bool> IsManagerAsync(int actorId);

        /// <summary>Who decides this person's requests: their own manager / team lead, else every active manager (never themselves)</summary>
        Task<List<int>> ApproversAsync(int userId);

        /// <summary>A manager / team lead may decide their own request only when nobody else could</summary>
        Task<bool> MayReviewOwnAsync(int userId);
    }

    public class TeamScope : ITeamScope
    {
        private readonly AppDbContext _db;
        public TeamScope(AppDbContext db) => _db = db;

        public async Task<bool> IsManagerAsync(int actorId) =>
            await _db.Users.AnyAsync(u => u.Id == actorId && u.IsActive && u.Role == "Manager");

        public async Task<HashSet<int>?> ManagedUserIdsAsync(int actorId)
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

        public async Task<bool> CanManageAsync(int actorId, int targetUserId)
        {
            var ids = await ManagedUserIdsAsync(actorId);
            return ids == null || ids.Contains(targetUserId);
        }

        public async Task<List<int>> ApproversAsync(int userId)
        {
            var user = await _db.Users.FindAsync(userId);
            if (user?.ManagerId is int mid && mid != userId
                && await _db.Users.AnyAsync(u => u.Id == mid && u.IsActive && (u.Role == "Manager" || u.Role == "TeamLead")))
                return new() { mid };
            return await _db.Users.Where(u => u.Role == "Manager" && u.IsActive && u.Id != userId).Select(u => u.Id).ToListAsync();
        }

        public async Task<bool> MayReviewOwnAsync(int userId) =>
            await _db.Users.AnyAsync(u => u.Id == userId && u.IsActive && (u.Role == "Manager" || u.Role == "TeamLead"))
            && (await ApproversAsync(userId)).Count == 0;

        public async Task EnsureCanManageAsync(int actorId, int targetUserId)
        {
            if (!await CanManageAsync(actorId, targetUserId))
                throw new UnauthorizedAccessException("You can only manage people in your own team.");
        }
    }
}
