using DailyTrackerAPI.Data;
using Microsoft.EntityFrameworkCore;

namespace DailyTrackerAPI.Services.Communication
{
    // ─────────────────────────────────────────────────────────────────────────
    //  NotificationSchedulerService  —  BackgroundService (runs on app startup)
    //
    //  Checks the clock every 60 seconds and fires 4 jobs once per day at
    //  scheduled IST times. Each job queries the DB and calls
    //  IAppNotificationService.CreateForUsersAsync() to persist + push via SignalR.
    //
    //  ┌──────────────────────────────────────────────────────────────────────┐
    //  │  JOB                 │ IST   │ WHO            │ TRIGGER CONDITION    │
    //  ├──────────────────────────────────────────────────────────────────────┤
    //  │ GoalReminder         │ 09:00 │ All users      │ No DailyGoal today   │
    //  │ PendingApproval      │ 09:30 │ Managers only  │ Leave/WFH Pending>2d │
    //  │ EodReminder          │ 17:00 │ Logged-in users│ DailyLog ✓, EOD ✗   │
    //  │ DailyLogReminder     │ 18:00 │ Non-managers   │ No DailyLog today    │
    //  └──────────────────────────────────────────────────────────────────────┘
    //
    //  KEY DECISIONS:
    //
    //  Interface used: IAppNotificationService  (your existing interface name)
    //
    //  Property names used — verified against your actual model files:
    //    LeaveRequest  → .AppliedAt  (NOT CreatedAt — confirmed from NewModels.cs)
    //    WFHRequest    → .RequestedAt (NOT CreatedAt — confirmed from WFHRequest.cs)
    //    DailyGoal     → .GoalDate   (confirmed from HasIndex UserId+GoalDate)
    //    DailyLog      → .LogDate    (confirmed from HasIndex UserId+LogDate)
    //    EODReport     → .ReportDate (confirmed from HasIndex UserId+ReportDate)
    //    User          → .Role       (confirmed from User model)
    //
    //  Why IServiceScope per job?
    //    BackgroundService is a Singleton. AppDbContext and IAppNotificationService
    //    are Scoped. Scoped services can't be injected into Singletons directly.
    //    We create a new scope for each job run and dispose it when done.
    //    This is the standard .NET pattern — see Microsoft docs "Consuming a
    //    scoped service in a background task".
    //
    //  Why not Hangfire?
    //    No extra NuGet dependency needed. The built-in PeriodicTimer +
    //    BackgroundService is sufficient for 4 daily jobs. Use Hangfire only
    //    if you need a web dashboard or job-history persistence across restarts.
    //
    //  Double-fire prevention:
    //    _firedToday stores "JOBKEY_yyyy-MM-dd" strings. Even if the timer ticks
    //    multiple times within the same minute, each job runs at most once per day.
    //    The set clears automatically at midnight IST.
    // ─────────────────────────────────────────────────────────────────────────

    public class NotificationSchedulerService : BackgroundService
    {
        private readonly IServiceProvider _services;
        private readonly ILogger<NotificationSchedulerService> _logger;

        // Guards against double-firing: stores "JOBKEY_2025-01-15" etc.
        private readonly HashSet<string> _firedToday = new();
        private DateTime _lastResetDate = DateTime.UtcNow.Date;

        // IST timezone — OperatingSystem check makes it work on both Windows + Linux Docker
        private static readonly TimeZoneInfo IST =
            TimeZoneInfo.FindSystemTimeZoneById(
                OperatingSystem.IsWindows() ? "India Standard Time" : "Asia/Kolkata");

        // Job keys used as prefixes in _firedToday
        private const string JOB_GOAL = "GOAL_REMINDER";
        private const string JOB_PENDING = "PENDING_APPROVAL";
        private const string JOB_EOD = "EOD_REMINDER";
        private const string JOB_LOG = "LOG_REMINDER";

        // (IST hour, IST minute, job key)
        private static readonly (int Hour, int Min, string Key)[] _schedule =
        {
            (9,  0,  JOB_GOAL),
            (9,  30, JOB_PENDING),
            (17, 0,  JOB_EOD),
            (18, 0,  JOB_LOG),
        };

        public NotificationSchedulerService(
            IServiceProvider services,
            ILogger<NotificationSchedulerService> logger)
        {
            _services = services;
            _logger = logger;
        }

        // ── Main loop ─────────────────────────────────────────────────────────
        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            _logger.LogInformation("[Scheduler] Started.");

            using var timer = new PeriodicTimer(TimeSpan.FromSeconds(60));

            while (!stoppingToken.IsCancellationRequested
                   && await timer.WaitForNextTickAsync(stoppingToken))
            {
                var nowIst = TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, IST);
                var todayKey = nowIst.ToString("yyyy-MM-dd");

                // Midnight reset
                if (nowIst.Date > _lastResetDate)
                {
                    _firedToday.Clear();
                    _lastResetDate = nowIst.Date;
                    _logger.LogInformation("[Scheduler] Daily reset for {Date}", todayKey);
                }

                foreach (var (hour, min, key) in _schedule)
                {
                    var fireKey = $"{key}_{todayKey}";
                    if (_firedToday.Contains(fireKey)) continue;

                    // Fire once the clock has reached or passed the scheduled time
                    bool due = nowIst.Hour > hour || (nowIst.Hour == hour && nowIst.Minute >= min);
                    if (!due) continue;

                    _firedToday.Add(fireKey);   // mark before running to block re-entry
                    _ = Task.Run(() => RunJobAsync(key, stoppingToken), stoppingToken);
                }
            }

            _logger.LogInformation("[Scheduler] Stopped.");
        }

        // ── Job dispatcher ────────────────────────────────────────────────────
        private async Task RunJobAsync(string jobKey, CancellationToken ct)
        {
            try
            {
                // Fresh scope so we get a clean DbContext and notification service
                using var scope = _services.CreateScope();
                var svc = scope.ServiceProvider.GetRequiredService<IAppNotificationService>();
                var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

                _logger.LogInformation("[Scheduler] Running: {Job}", jobKey);

                switch (jobKey)
                {
                    case JOB_GOAL: await RunGoalReminderAsync(db, svc, ct); break;
                    case JOB_PENDING: await RunPendingApprovalAsync(db, svc, ct); break;
                    case JOB_EOD: await RunEodReminderAsync(db, svc, ct); break;
                    case JOB_LOG: await RunDailyLogReminderAsync(db, svc, ct); break;
                }

                _logger.LogInformation("[Scheduler] Done: {Job}", jobKey);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[Scheduler] Failed: {Job}", jobKey);

                // On failure, remove from firedToday so the job retries on the next tick
                var todayKey = TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, IST).ToString("yyyy-MM-dd");
                _firedToday.Remove($"{jobKey}_{todayKey}");
            }
        }

        // ─────────────────────────────────────────────────────────────────────
        //  JOB 1 — GOAL REMINDER  (09:00 IST)
        //
        //  Who gets it: every user who has NOT set a DailyGoal for today.
        //
        //  DailyGoal.GoalDate — confirmed from AppDbContext:
        //    HasIndex(g => new { g.UserId, g.GoalDate }).IsUnique()
        // ─────────────────────────────────────────────────────────────────────
        private async Task RunGoalReminderAsync(
            AppDbContext db, IAppNotificationService svc, CancellationToken ct)
        {
            var today = DateTime.UtcNow.Date;

            var usersWithGoal = await db.DailyGoals
                .Where(g => g.GoalDate == today)
                .Select(g => g.UserId)
                .ToListAsync(ct);

            var usersToRemind = await db.Users
                .Where(u => !usersWithGoal.Contains(u.Id))
                .Select(u => u.Id)
                .ToListAsync(ct);

            if (usersToRemind.Count == 0) return;

            await svc.CreateForUsersAsync(
                userIds: usersToRemind,
                title: "🎯 Set Your Daily Goal",
                message: "You haven't set a goal for today yet. Start your day with a clear focus!",
                type: "Reminder",
                actionUrl: "/"
            );

            _logger.LogInformation("[Scheduler] Goal reminders → {N} users", usersToRemind.Count);
        }

        // ─────────────────────────────────────────────────────────────────────
        //  JOB 2 — PENDING APPROVAL ALERT  (09:30 IST)
        //
        //  Who gets it: all Manager users.
        //  When: there are LeaveRequests or WFHRequests in "Pending" status
        //        that were submitted more than 2 days ago.
        //
        //  LeaveRequest.AppliedAt — confirmed from NewModels.cs:
        //    public DateTime AppliedAt { get; set; } = DateTime.UtcNow;
        //
        //  WFHRequest.RequestedAt — confirmed from WFHRequest.cs:
        //    public DateTime RequestedAt { get; set; } = DateTime.UtcNow;
        // ─────────────────────────────────────────────────────────────────────
        private async Task RunPendingApprovalAsync(
            AppDbContext db, IAppNotificationService svc, CancellationToken ct)
        {
            var twoDaysAgo = DateTime.UtcNow.AddDays(-2);

            // Use the correct timestamp property from your LeaveRequest model
            var pendingLeave = await db.LeaveRequests
                .CountAsync(l => l.Status == "Pending" && l.AppliedAt <= twoDaysAgo, ct);

            // Use the correct timestamp property from your WFHRequest model
            var pendingWfh = await db.WFHRequests
                .CountAsync(w => w.Status == "Pending" && w.RequestedAt <= twoDaysAgo, ct);

            if (pendingLeave == 0 && pendingWfh == 0) return;

            var parts = new List<string>();
            if (pendingLeave > 0) parts.Add($"{pendingLeave} leave request{(pendingLeave > 1 ? "s" : "")}");
            if (pendingWfh > 0) parts.Add($"{pendingWfh} WFH request{(pendingWfh > 1 ? "s" : "")}");
            var message = $"{string.Join(" and ", parts)} pending for over 2 days without action.";

            var managerIds = await db.Users
                .Where(u => u.Role == "Manager")
                .Select(u => u.Id)
                .ToListAsync(ct);

            if (managerIds.Count == 0) return;

            await svc.CreateForUsersAsync(
                userIds: managerIds,
                title: "⏳ Approvals Awaiting Action",
                message: message,
                type: "Warning",
                actionUrl: "/manager/wfh-dashboard"
            );

            _logger.LogInformation("[Scheduler] Pending approval alerts → {N} managers", managerIds.Count);
        }

        // ─────────────────────────────────────────────────────────────────────
        //  JOB 3 — EOD REMINDER  (17:00 IST)
        //
        //  Who gets it: users who HAVE a DailyLog today but do NOT have an
        //  EODReport today.
        //
        //  This is intentionally targeted — only reminds people who actually
        //  worked today. Users on leave or absent get no reminder here
        //  (they may get Job 4 instead at 18:00).
        //
        //  DailyLog.LogDate  — confirmed: HasIndex(d => new { d.UserId, d.LogDate })
        //  EODReport.ReportDate — confirmed: HasIndex(r => new { r.UserId, r.ReportDate })
        // ─────────────────────────────────────────────────────────────────────
        private async Task RunEodReminderAsync(
            AppDbContext db, IAppNotificationService svc, CancellationToken ct)
        {
            var today = DateTime.UtcNow.Date;

            var usersWithLog = await db.DailyLogs
                .Where(d => d.LogDate == today)
                .Select(d => d.UserId)
                .ToListAsync(ct);

            var usersWithEod = await db.EODReports
                .Where(r => r.ReportDate == today)
                .Select(r => r.UserId)
                .ToListAsync(ct);

            // Remind only those who logged in but haven't filed EOD
            var usersToRemind = usersWithLog.Except(usersWithEod).ToList();
            if (usersToRemind.Count == 0) return;

            await svc.CreateForUsersAsync(
                userIds: usersToRemind,
                title: "📝 Submit Your EOD Report",
                message: "It's 5 PM — please file your end-of-day report before wrapping up!",
                type: "Reminder",
                actionUrl: "/eod-reports"
            );

            _logger.LogInformation("[Scheduler] EOD reminders → {N} users", usersToRemind.Count);
        }

        // ─────────────────────────────────────────────────────────────────────
        //  JOB 4 — DAILY LOG REMINDER  (18:00 IST)
        //
        //  Who gets it: all non-manager users who have NO DailyLog for today.
        //  Managers are excluded because they typically don't log daily work
        //  in the same way developers and team leads do.
        // ─────────────────────────────────────────────────────────────────────
        private async Task RunDailyLogReminderAsync(
            AppDbContext db, IAppNotificationService svc, CancellationToken ct)
        {
            var today = DateTime.UtcNow.Date;

            var usersWithLog = await db.DailyLogs
                .Where(d => d.LogDate == today)
                .Select(d => d.UserId)
                .ToListAsync(ct);

            var usersToRemind = await db.Users
                .Where(u => u.Role != "Manager" && !usersWithLog.Contains(u.Id))
                .Select(u => u.Id)
                .ToListAsync(ct);

            if (usersToRemind.Count == 0) return;

            await svc.CreateForUsersAsync(
                userIds: usersToRemind,
                title: "⚠️ Daily Log Missing",
                message: "You haven't submitted a work log today. Please log your activities before the day ends.",
                type: "Warning",
                actionUrl: "/"
            );

            _logger.LogInformation("[Scheduler] Log reminders → {N} users", usersToRemind.Count);
        }
    }
}