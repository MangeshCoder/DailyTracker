// ─────────────────────────────────────────────────────────────────────────────
//  FILE: api/Services/HR/OnboardingService.cs
//  Onboarding: a checklist for a new joiner's first days.
//
//  • Starts when a manager approves a new account (Pending → a role), or by hand
//    from the Onboarding page for anyone who joined in the last 90 days.
//  • Some steps the app ticks by itself as they happen (profile filled in, face
//    check-in set up, a document uploaded, two-step sign-in on, first check-in,
//    a buddy chosen); the rest are ticked by the employee or their manager.
//  • When every step is done the plan is finished and both are told.
// ─────────────────────────────────────────────────────────────────────────────

using DailyTrackerAPI.Data;
using DailyTrackerAPI.DTOs;
using DailyTrackerAPI.Models.HR;
using DailyTrackerAPI.Services.Auth;
using DailyTrackerAPI.Services.Communication;
using Microsoft.EntityFrameworkCore;

namespace DailyTrackerAPI.Services.HR
{
    public interface IOnboardingService
    {
        Task<OnboardingPlanDto> StartAsync(int actorId, StartOnboardingDto dto);
        /// <summary>A new account was approved: start their checklist (no-op if they have one)</summary>
        Task StartForNewJoinerAsync(int managerId, int userId);
        Task<OnboardingPlanDto?> GetMineAsync(int userId);
        Task<List<OnboardingPlanDto>> GetTeamAsync(int actorId);
        Task<List<OnboardingCandidateDto>> GetCandidatesAsync(int actorId);
        Task<OnboardingPlanDto> SetBuddyAsync(int actorId, int planId, int? buddyUserId);
        Task<OnboardingPlanDto> AddTaskAsync(int actorId, int planId, AddOnboardingTaskDto dto);
        Task<OnboardingPlanDto> TickAsync(int actorId, int taskId, bool done);
        Task<OnboardingPlanDto> RemoveTaskAsync(int actorId, int taskId);
        Task CancelAsync(int actorId, int planId);
    }

    public class OnboardingService : IOnboardingService
    {
        private const int CandidateDays = 90;

        /// <summary>The standard checklist: (kind, owner, title)</summary>
        private static readonly (string Kind, string Owner, string Title)[] Template =
        {
            ("Profile",      "Employee", "Complete your profile — phone, department and designation"),
            ("Face",         "Employee", "Set up face check-in"),
            ("TwoFactor",    "Employee", "Turn on two-step sign-in"),
            ("Documents",    "Employee", "Upload your ID proof and joining documents"),
            ("FirstCheckIn", "Employee", "Check in for your first day"),
            ("Manual",       "Employee", "Read the feature guide and company policies"),
            ("Manual",       "Employee", "Meet your buddy"),
            ("Buddy",        "Manager",  "Choose a buddy"),
            ("Manual",       "Manager",  "Laptop, email and accounts ready"),
            ("Manual",       "Manager",  "Welcome meeting with the team"),
        };

        private static readonly Dictionary<string, string> Links = new()
        {
            ["Profile"] = "/profile",
            ["Face"] = "/face-setup",
            ["TwoFactor"] = "/security",
            ["Documents"] = "/documents",
            ["FirstCheckIn"] = "/",
        };

        private readonly AppDbContext _db;
        private readonly ITeamScope _scope;
        private readonly IAppNotificationService _notify;
        private readonly ILogger<OnboardingService> _logger;

        public OnboardingService(AppDbContext db, ITeamScope scope, IAppNotificationService notify, ILogger<OnboardingService> logger)
        {
            _db = db;
            _scope = scope;
            _notify = notify;
            _logger = logger;
        }

        // ── Starting ─────────────────────────────────────────────────────────

        public async Task<OnboardingPlanDto> StartAsync(int actorId, StartOnboardingDto dto)
        {
            if (dto.UserId == actorId) throw new InvalidOperationException("You can't start onboarding for yourself.");
            await _scope.EnsureCanManageAsync(actorId, dto.UserId);
            var user = await _db.Users.FindAsync(dto.UserId) ?? throw new KeyNotFoundException("That person was not found.");
            if (!user.IsActive || user.Role == "Pending")
                throw new InvalidOperationException("Approve the account first — onboarding starts once they have a role.");
            if (await _db.OnboardingPlans.AnyAsync(p => p.UserId == dto.UserId))
                throw new InvalidOperationException($"{user.FullName} already has an onboarding checklist.");

            var plan = Create(actorId, dto.UserId);
            await _db.SaveChangesAsync();
            await NotifyStartAsync(plan);
            if (dto.BuddyUserId != null)
            {
                await ApplyBuddyAsync(plan, dto.BuddyUserId);
                await _db.SaveChangesAsync();
            }
            return await LoadDtoAsync(plan.Id, actorId);
        }

        public async Task StartForNewJoinerAsync(int managerId, int userId)
        {
            if (await _db.OnboardingPlans.AnyAsync(p => p.UserId == userId)) return;
            var plan = Create(managerId, userId);
            await _db.SaveChangesAsync();
            await NotifyStartAsync(plan);
        }

        private OnboardingPlan Create(int actorId, int userId)
        {
            var plan = new OnboardingPlan { UserId = userId, CreatedById = actorId };
            var order = 0;
            foreach (var (kind, owner, title) in Template)
                plan.Tasks.Add(new OnboardingTask { Kind = kind, Owner = owner, Title = title, SortOrder = order++ });
            _db.OnboardingPlans.Add(plan);
            return plan;
        }

        private async Task NotifyStartAsync(OnboardingPlan plan) =>
            await BestEffortAsync("welcome notice", () => _notify.CreateAsync(plan.UserId,
                "👋 Welcome aboard!",
                "Your getting-started checklist is on the dashboard — a few quick steps for your first days.",
                "Info", "/"));

        // ── Reading ──────────────────────────────────────────────────────────

        public async Task<OnboardingPlanDto?> GetMineAsync(int userId)
        {
            var id = await _db.OnboardingPlans.Where(p => p.UserId == userId).Select(p => (int?)p.Id).FirstOrDefaultAsync();
            return id == null ? null : await LoadDtoAsync(id.Value, userId);
        }

        public async Task<List<OnboardingPlanDto>> GetTeamAsync(int actorId)
        {
            var team = await _scope.ManagedUserIdsAsync(actorId);
            var ids = await _db.OnboardingPlans
                .Where(p => p.UserId != actorId && (team == null || team.Contains(p.UserId)))
                .OrderBy(p => p.CompletedAt != null).ThenByDescending(p => p.CreatedAt)
                .Select(p => p.Id).ToListAsync();
            var result = new List<OnboardingPlanDto>();
            foreach (var id in ids) result.Add(await LoadDtoAsync(id, actorId));
            return result;
        }

        public async Task<List<OnboardingCandidateDto>> GetCandidatesAsync(int actorId)
        {
            var team = await _scope.ManagedUserIdsAsync(actorId);
            var since = DateTime.UtcNow.AddDays(-CandidateDays);
            var withPlan = _db.OnboardingPlans.Select(p => p.UserId);
            var people = await _db.Users
                .Where(u => u.IsActive && u.Role != "Pending" && u.Id != actorId
                            && (team == null || team.Contains(u.Id))
                            && !withPlan.Contains(u.Id)
                            && (u.JoinDate ?? u.CreatedAt) >= since)
                .OrderBy(u => u.FullName)
                .ToListAsync();
            return people.Select(u => new OnboardingCandidateDto
            {
                UserId = u.Id, FullName = u.FullName, Role = u.Role, JoinedOn = (u.JoinDate ?? u.CreatedAt).Date,
            }).ToList();
        }

        // ── Changing ─────────────────────────────────────────────────────────

        public async Task<OnboardingPlanDto> SetBuddyAsync(int actorId, int planId, int? buddyUserId)
        {
            var plan = await ManagedPlanAsync(actorId, planId);
            await ApplyBuddyAsync(plan, buddyUserId);
            await _db.SaveChangesAsync();
            return await LoadDtoAsync(plan.Id, actorId);
        }

        private async Task ApplyBuddyAsync(OnboardingPlan plan, int? buddyUserId)
        {
            if (buddyUserId == null) { plan.BuddyUserId = null; return; }
            if (buddyUserId == plan.UserId) throw new InvalidOperationException("Choose someone else as the buddy.");
            var buddy = await _db.Users.FindAsync(buddyUserId.Value);
            if (buddy == null || !buddy.IsActive || buddy.Role == "Pending")
                throw new InvalidOperationException("Choose an active team member as the buddy.");
            if (plan.BuddyUserId == buddy.Id) return;
            plan.BuddyUserId = buddy.Id;

            var joiner = await _db.Users.FindAsync(plan.UserId);
            await BestEffortAsync("buddy notice", () => _notify.CreateAsync(buddy.Id,
                "🤝 You're a buddy",
                $"You'll help {joiner?.FullName} settle in — say hello and show them around.",
                "Info", "/team/directory"));
            await BestEffortAsync("joiner buddy notice", () => _notify.CreateAsync(plan.UserId,
                "🤝 Meet your buddy",
                $"{buddy.FullName} is your buddy — ask them anything while you settle in.",
                "Info", "/"));
        }

        public async Task<OnboardingPlanDto> AddTaskAsync(int actorId, int planId, AddOnboardingTaskDto dto)
        {
            var plan = await ManagedPlanAsync(actorId, planId);
            var title = dto.Title?.Trim() ?? "";
            if (title.Length == 0) throw new InvalidOperationException("Please write the step.");
            if (title.Length > 200) throw new InvalidOperationException("Please keep the step under 200 characters.");
            if (dto.Owner is not ("Employee" or "Manager")) throw new InvalidOperationException("Who does it: Employee or Manager.");
            var order = await _db.OnboardingTasks.Where(t => t.PlanId == plan.Id).MaxAsync(t => (int?)t.SortOrder) ?? 0;
            _db.OnboardingTasks.Add(new OnboardingTask { PlanId = plan.Id, Title = title, Owner = dto.Owner, SortOrder = order + 1 });
            plan.CompletedAt = null;   // a new step re-opens a finished list
            await _db.SaveChangesAsync();
            return await LoadDtoAsync(plan.Id, actorId);
        }

        public async Task<OnboardingPlanDto> TickAsync(int actorId, int taskId, bool done)
        {
            var task = await _db.OnboardingTasks.Include(t => t.Plan).FirstOrDefaultAsync(t => t.Id == taskId)
                ?? throw new KeyNotFoundException("That step was not found.");
            if (task.Kind != "Manual")
                throw new InvalidOperationException("This step ticks itself when it's done in the app.");
            if (!await MayTickAsync(actorId, task))
                throw new UnauthorizedAccessException(task.Owner == "Manager"
                    ? "Your manager ticks this step."
                    : "You can only tick steps on your own checklist or your team's.");

            task.DoneAt = done ? DateTime.UtcNow : null;
            task.DoneById = done ? actorId : null;
            await _db.SaveChangesAsync();
            return await LoadDtoAsync(task.PlanId, actorId);
        }

        public async Task<OnboardingPlanDto> RemoveTaskAsync(int actorId, int taskId)
        {
            var task = await _db.OnboardingTasks.FirstOrDefaultAsync(t => t.Id == taskId)
                ?? throw new KeyNotFoundException("That step was not found.");
            await ManagedPlanAsync(actorId, task.PlanId);
            _db.OnboardingTasks.Remove(task);
            await _db.SaveChangesAsync();
            return await LoadDtoAsync(task.PlanId, actorId);
        }

        public async Task CancelAsync(int actorId, int planId)
        {
            var plan = await ManagedPlanAsync(actorId, planId);
            _db.OnboardingPlans.Remove(plan);
            await _db.SaveChangesAsync();
        }

        // ── Rules ────────────────────────────────────────────────────────────

        private async Task<OnboardingPlan> ManagedPlanAsync(int actorId, int planId)
        {
            var plan = await _db.OnboardingPlans.FirstOrDefaultAsync(p => p.Id == planId)
                ?? throw new KeyNotFoundException("That onboarding checklist was not found.");
            if (plan.UserId == actorId) throw new UnauthorizedAccessException("Your manager looks after your checklist.");
            await _scope.EnsureCanManageAsync(actorId, plan.UserId);
            return plan;
        }

        private async Task<bool> CanManagePlanAsync(int actorId, int userId) =>
            actorId != userId
            && await _db.Users.AnyAsync(u => u.Id == actorId && u.IsActive && (u.Role == "Manager" || u.Role == "TeamLead"))
            && await _scope.CanManageAsync(actorId, userId);

        private async Task<bool> MayTickAsync(int actorId, OnboardingTask task) =>
            (task.Owner == "Employee" && task.Plan.UserId == actorId) || await CanManagePlanAsync(actorId, task.Plan.UserId);

        // ── Loading (ticks the app-checked steps first) ──────────────────────

        private async Task<OnboardingPlanDto> LoadDtoAsync(int planId, int viewerId)
        {
            var plan = await _db.OnboardingPlans
                .Include(p => p.User).Include(p => p.Buddy).Include(p => p.Tasks)
                .FirstAsync(p => p.Id == planId);

            await RefreshAutoStepsAsync(plan);

            var manages = await CanManagePlanAsync(viewerId, plan.UserId);
            var tasks = plan.Tasks.OrderBy(t => t.Owner == "Manager").ThenBy(t => t.SortOrder).Select(t => new OnboardingTaskDto
            {
                Id = t.Id,
                Title = t.Title,
                Kind = t.Kind,
                Owner = t.Owner,
                Done = t.DoneAt != null,
                DoneAt = t.DoneAt,
                Link = Links.GetValueOrDefault(t.Kind),
                CanTick = t.Kind == "Manual" && ((t.Owner == "Employee" && plan.UserId == viewerId) || manages),
            }).ToList();

            return new OnboardingPlanDto
            {
                Id = plan.Id,
                UserId = plan.UserId,
                UserName = plan.User.FullName,
                Role = plan.User.Role,
                JoinDate = plan.User.JoinDate,
                BuddyUserId = plan.BuddyUserId,
                BuddyName = plan.Buddy?.FullName,
                CreatedAt = plan.CreatedAt,
                CompletedAt = plan.CompletedAt,
                DoneCount = tasks.Count(t => t.Done),
                TotalCount = tasks.Count,
                Tasks = tasks,
            };
        }

        private async Task RefreshAutoStepsAsync(OnboardingPlan plan)
        {
            var changed = false;
            var open = plan.Tasks.Where(t => t.Kind != "Manual" && t.DoneAt == null).ToList();
            foreach (var t in open)
            {
                if (!await IsDoneAsync(t.Kind, plan)) continue;
                t.DoneAt = DateTime.UtcNow;
                changed = true;
            }
            // choosing "no buddy" again re-opens the buddy step
            foreach (var t in plan.Tasks.Where(t => t.Kind == "Buddy" && t.DoneAt != null && plan.BuddyUserId == null))
            {
                t.DoneAt = null;
                changed = true;
            }

            var allDone = plan.Tasks.Count > 0 && plan.Tasks.All(t => t.DoneAt != null);
            if (allDone && plan.CompletedAt == null)
            {
                plan.CompletedAt = DateTime.UtcNow;
                changed = true;
                var approvers = await _scope.ApproversAsync(plan.UserId);
                await BestEffortAsync("finished notice", () => _notify.CreateAsync(plan.UserId,
                    "🎉 Onboarding complete", "You've finished your getting-started checklist. Welcome to the team!", "Success", "/"));
                if (approvers.Count > 0)
                    await BestEffortAsync("finished notice (manager)", () => _notify.CreateForUsersAsync(approvers,
                        "🎉 Onboarding complete", $"{plan.User.FullName} finished their getting-started checklist.", "Success", "/manager/onboarding"));
            }
            else if (!allDone && plan.CompletedAt != null)
            {
                plan.CompletedAt = null;
                changed = true;
            }
            if (changed) await _db.SaveChangesAsync();
        }

        private async Task<bool> IsDoneAsync(string kind, OnboardingPlan plan)
        {
            var u = plan.User;
            return kind switch
            {
                "Profile" => !string.IsNullOrWhiteSpace(u.Phone) && !string.IsNullOrWhiteSpace(u.Department) && !string.IsNullOrWhiteSpace(u.Designation),
                "Face" => u.FaceRegistered,
                "TwoFactor" => await _db.UserTwoFactors.AnyAsync(t => t.UserId == u.Id && (t.TotpEnabled || t.EmailOtpEnabled)),
                "Documents" => await _db.Documents.AnyAsync(d => d.OwnerUserId == u.Id),
                "FirstCheckIn" => await _db.DailyLogs.AnyAsync(d => d.UserId == u.Id && d.CheckInTime != null),
                "Buddy" => plan.BuddyUserId != null,
                _ => false,
            };
        }

        private async Task BestEffortAsync(string what, Func<Task> action)
        {
            try { await action(); }
            catch (Exception ex) { _logger.LogWarning(ex, "Onboarding: {What} failed (the change itself was saved)", what); }
        }
    }
}
