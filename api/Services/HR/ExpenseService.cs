// ─────────────────────────────────────────────────────────────────────────────
//  FILE: api/Services/HR/ExpenseService.cs
//  Expense claims: an employee sends a bill (travel, food, internet …); their
//  manager / team lead approves it; the amount is paid back with that month's
//  salary (a "Reimbursements" line on the payslip).
//  Bills are kept in private storage — only the employee and the people who
//  can decide their claims can open them.
// ─────────────────────────────────────────────────────────────────────────────

using DailyTrackerAPI.Data;
using DailyTrackerAPI.DTOs;
using DailyTrackerAPI.Helpers;
using DailyTrackerAPI.Models.HR;
using DailyTrackerAPI.Services.Auth;
using DailyTrackerAPI.Services.Communication;
using DailyTrackerAPI.Services.Storage;
using Microsoft.EntityFrameworkCore;

namespace DailyTrackerAPI.Services.HR
{
    public interface IExpenseService
    {
        Task<ExpenseClaimDto> SubmitAsync(int userId, SubmitExpenseDto dto, IFormFile? receipt);
        Task<List<ExpenseClaimDto>> GetMineAsync(int userId);
        Task<List<ExpenseClaimDto>> GetPendingAsync(int reviewerId);
        Task<List<ExpenseClaimDto>> GetTeamAsync(int reviewerId, int? year);
        Task ReviewAsync(int reviewerId, int claimId, ReviewExpenseDto dto);
        Task CancelAsync(int userId, int claimId);
        /// <summary>The bill — for the employee or someone who can decide their claims</summary>
        Task<(string Key, string MimeType, string FileName)> GetReceiptAsync(int viewerId, int claimId);
        /// <summary>Approved claims paid with this month's salary</summary>
        Task<decimal> ReimbursementForAsync(int userId, int month, int year);
    }

    public class ExpenseService : IExpenseService
    {
        public static readonly string[] Categories = { "Travel", "Food", "Internet", "Office", "Other" };
        public const decimal MaxAmount = 100_000m;
        public const int MaxAgeDays = 90;
        private const long MaxReceiptBytes = 5 * 1024 * 1024;

        private readonly AppDbContext _db;
        private readonly ITeamScope _scope;
        private readonly IFileStorage _files;
        private readonly IAppNotificationService _notify;
        private readonly ILogger<ExpenseService> _logger;

        public ExpenseService(AppDbContext db, ITeamScope scope, IFileStorage files, IAppNotificationService notify, ILogger<ExpenseService> logger)
        {
            _db = db;
            _scope = scope;
            _files = files;
            _notify = notify;
            _logger = logger;
        }

        private static string Money(decimal a) => $"₹{a:N2}";

        // ── Sending a claim ──────────────────────────────────────────────────

        public async Task<ExpenseClaimDto> SubmitAsync(int userId, SubmitExpenseDto dto, IFormFile? receipt)
        {
            var today = AppClock.TodayIst;
            var category = Categories.FirstOrDefault(c => c.Equals(dto.Category?.Trim(), StringComparison.OrdinalIgnoreCase))
                ?? throw new InvalidOperationException("Please choose a category: Travel, Food, Internet, Office or Other.");
            if (dto.Amount <= 0) throw new InvalidOperationException("Please enter the amount on the bill.");
            if (dto.Amount > MaxAmount) throw new InvalidOperationException($"A single claim can be at most {Money(MaxAmount)} — split it or talk to your manager.");
            if (decimal.Round(dto.Amount, 2) != dto.Amount) throw new InvalidOperationException("The amount can have at most 2 decimals (paise).");
            var description = dto.Description?.Trim() ?? "";
            if (description.Length == 0) throw new InvalidOperationException("Please say what it was for (e.g. \"Cab to client office\").");
            if (description.Length > 500) throw new InvalidOperationException("Please keep the description under 500 characters.");
            if (dto.ExpenseDate == default) throw new InvalidOperationException("Please choose the date on the bill.");
            var date = dto.ExpenseDate.Date;
            if (date > today) throw new InvalidOperationException("The bill date can't be in the future.");
            if (date < today.AddDays(-MaxAgeDays)) throw new InvalidOperationException($"Bills older than {MaxAgeDays} days can't be claimed.");

            var (mime, ext) = await CheckReceiptAsync(receipt);
            var key = $"expenses/{userId}/{Guid.NewGuid():N}{ext}";
            await _files.SaveAsync(key, receipt!);

            var claim = new ExpenseClaim
            {
                UserId = userId,
                ExpenseDate = date,
                Category = category,
                Amount = dto.Amount,
                Description = description,
                ReceiptKey = key,
                ReceiptFileName = Path.GetFileName(receipt!.FileName),
                ReceiptMimeType = mime,
            };
            _db.ExpenseClaims.Add(claim);
            try { await _db.SaveChangesAsync(); }
            catch
            {
                await _files.DeleteAsync(key);   // no orphan bills
                throw;
            }

            var employee = await _db.Users.FindAsync(userId);
            var approvers = await _scope.ApproversAsync(userId);
            if (approvers.Count > 0)
                await BestEffortAsync("approver notice", () => _notify.CreateForUsersAsync(approvers,
                    "🧾 Expense claim to approve",
                    $"{employee?.FullName} claimed {Money(claim.Amount)} for {category.ToLower()} ({description}).",
                    "Info", "/manager/wfh-dashboard"));

            claim.User = employee!;
            return Map(claim, userId);
        }

        /// <summary>PDF or a photo, up to 5 MB — checked by the file's content, not just its name</summary>
        private static async Task<(string Mime, string Ext)> CheckReceiptAsync(IFormFile? file)
        {
            if (file == null || file.Length == 0) throw new InvalidOperationException("Please attach the bill (PDF or a photo).");
            if (file.Length > MaxReceiptBytes) throw new InvalidOperationException("The bill must be 5 MB or smaller.");
            var head = new byte[12];
            await using (var s = file.OpenReadStream())
                _ = await s.ReadAsync(head.AsMemory(0, head.Length));
            if (head[0] == 0x25 && head[1] == 0x50 && head[2] == 0x44 && head[3] == 0x46) return ("application/pdf", ".pdf");
            if (head[0] == 0xFF && head[1] == 0xD8 && head[2] == 0xFF) return ("image/jpeg", ".jpg");
            if (head[0] == 0x89 && head[1] == 0x50 && head[2] == 0x4E && head[3] == 0x47) return ("image/png", ".png");
            if (head[0] == 0x52 && head[1] == 0x49 && head[2] == 0x46 && head[3] == 0x46
                && head[8] == 0x57 && head[9] == 0x45 && head[10] == 0x42 && head[11] == 0x50) return ("image/webp", ".webp");
            throw new InvalidOperationException("The bill must be a PDF, JPG, PNG or WEBP file.");
        }

        public async Task CancelAsync(int userId, int claimId)
        {
            var claim = await _db.ExpenseClaims.FirstOrDefaultAsync(c => c.Id == claimId && c.UserId == userId)
                ?? throw new KeyNotFoundException("That claim was not found.");
            if (claim.Status != "Pending") throw new InvalidOperationException("Only a claim that is still waiting can be withdrawn.");
            _db.ExpenseClaims.Remove(claim);
            await _db.SaveChangesAsync();
            await BestEffortAsync("delete bill", () => _files.DeleteAsync(claim.ReceiptKey));
        }

        // ── Lists ────────────────────────────────────────────────────────────

        public async Task<List<ExpenseClaimDto>> GetMineAsync(int userId) =>
            (await _db.ExpenseClaims.Include(c => c.User).Include(c => c.ReviewedBy)
                .Where(c => c.UserId == userId)
                .OrderByDescending(c => c.CreatedAt).ToListAsync())
            .Select(c => Map(c, userId)).ToList();

        public async Task<List<ExpenseClaimDto>> GetPendingAsync(int reviewerId)
        {
            var team = await _scope.ManagedUserIdsAsync(reviewerId);
            var rows = await _db.ExpenseClaims.Include(c => c.User)
                .Where(c => c.Status == "Pending" && (team == null || team.Contains(c.UserId) || c.UserId == reviewerId))
                .OrderBy(c => c.CreatedAt).ToListAsync();
            var mayReviewOwn = await _scope.MayReviewOwnAsync(reviewerId);
            return rows.Where(c => c.UserId != reviewerId || mayReviewOwn).Select(c => Map(c, reviewerId)).ToList();
        }

        public async Task<List<ExpenseClaimDto>> GetTeamAsync(int reviewerId, int? year)
        {
            var team = await _scope.ManagedUserIdsAsync(reviewerId);
            var y = year ?? AppClock.TodayIst.Year;
            var from = new DateTime(y, 1, 1);
            var to = from.AddYears(1);
            return (await _db.ExpenseClaims.Include(c => c.User).Include(c => c.ReviewedBy)
                    .Where(c => c.ExpenseDate >= from && c.ExpenseDate < to && (team == null || team.Contains(c.UserId)))
                    .OrderByDescending(c => c.ExpenseDate).ToListAsync())
                .Select(c => Map(c, reviewerId)).ToList();
        }

        private static ExpenseClaimDto Map(ExpenseClaim c, int viewerId) => new()
        {
            Id = c.Id,
            UserId = c.UserId,
            UserName = c.User?.FullName ?? "",
            ExpenseDate = c.ExpenseDate,
            Category = c.Category,
            Amount = c.Amount,
            Description = c.Description,
            ReceiptFileName = c.ReceiptFileName,
            Status = c.Status,
            ReviewerName = c.ReviewedBy?.FullName,
            ReviewNote = c.ReviewNote,
            ReviewedAt = c.ReviewedAt,
            PaidWith = c.PayMonth is int m && c.PayYear is int y ? new DateTime(y, m, 1).ToString("MMMM yyyy") : null,
            CreatedAt = c.CreatedAt,
            IsOwn = c.UserId == viewerId,
        };

        // ── The manager's decision ───────────────────────────────────────────

        public async Task ReviewAsync(int reviewerId, int claimId, ReviewExpenseDto dto)
        {
            if (dto.Status is not ("Approved" or "Rejected"))
                throw new InvalidOperationException("The decision must be Approved or Rejected.");
            var claim = await _db.ExpenseClaims.FirstOrDefaultAsync(c => c.Id == claimId)
                ?? throw new KeyNotFoundException("That claim was not found.");
            if (claim.Status != "Pending") throw new InvalidOperationException("This claim was already decided.");
            if (claim.UserId == reviewerId)
            {
                if (!await _scope.MayReviewOwnAsync(reviewerId))
                    throw new UnauthorizedAccessException("You can't approve your own claim — your manager decides it.");
            }
            else await _scope.EnsureCanManageAsync(reviewerId, claim.UserId);

            var note = dto.Note?.Trim();
            if (dto.Status == "Rejected" && string.IsNullOrEmpty(note))
                throw new InvalidOperationException("Please say why the claim is declined, so the employee knows.");

            var today = AppClock.TodayIst;
            claim.Status = dto.Status;
            claim.ReviewedById = reviewerId;
            claim.ReviewNote = string.IsNullOrEmpty(note) ? null : note[..Math.Min(note.Length, 300)];
            claim.ReviewedAt = DateTime.UtcNow;
            if (dto.Status == "Approved") { claim.PayMonth = today.Month; claim.PayYear = today.Year; }
            await _db.SaveChangesAsync();

            var msg = dto.Status == "Approved"
                ? $"Your claim of {Money(claim.Amount)} ({claim.Description}) was approved — it will be paid with your {today:MMMM} salary."
                : $"Your claim of {Money(claim.Amount)} ({claim.Description}) was declined: \"{claim.ReviewNote}\"";
            await BestEffortAsync("decision notice", () => _notify.CreateAsync(claim.UserId,
                dto.Status == "Approved" ? "✅ Expense approved" : "Expense declined", msg,
                dto.Status == "Approved" ? "Success" : "Warning", "/expenses"));
        }

        // ── Bills and pay ────────────────────────────────────────────────────

        public async Task<(string Key, string MimeType, string FileName)> GetReceiptAsync(int viewerId, int claimId)
        {
            var claim = await _db.ExpenseClaims.FirstOrDefaultAsync(c => c.Id == claimId)
                ?? throw new KeyNotFoundException("That claim was not found.");
            if (claim.UserId != viewerId && !await _scope.CanManageAsync(viewerId, claim.UserId))
                throw new KeyNotFoundException("That claim was not found.");   // don't reveal others' claims
            return (claim.ReceiptKey, claim.ReceiptMimeType, claim.ReceiptFileName);
        }

        public async Task<decimal> ReimbursementForAsync(int userId, int month, int year) =>
            (await _db.ExpenseClaims
                .Where(c => c.UserId == userId && c.Status == "Approved" && c.PayMonth == month && c.PayYear == year)
                .Select(c => c.Amount).ToListAsync()).Sum();

        private async Task BestEffortAsync(string what, Func<Task> action)
        {
            try { await action(); }
            catch (Exception ex) { _logger.LogWarning(ex, "Expenses: {What} failed (the change itself was saved)", what); }
        }
    }
}
