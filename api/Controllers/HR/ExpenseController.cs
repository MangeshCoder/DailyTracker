using DailyTrackerAPI.DTOs;
using DailyTrackerAPI.Helpers;
using DailyTrackerAPI.Services.HR;
using DailyTrackerAPI.Services.Storage;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace DailyTrackerAPI.Controllers.HR
{
    // ─────────────────────────────────────────────────────────────────────────
    //  Expense claims — bills paid back with the salary
    //    POST   /api/expenses                  → send a claim (multipart: fields + receipt)
    //    GET    /api/expenses/my               → my claims
    //    DELETE /api/expenses/{id}             → withdraw a claim still waiting
    //    GET    /api/expenses/{id}/receipt     → the bill (owner or their approver)
    //    GET    /api/expenses/pending          → waiting for my decision (manager / team lead)
    //    GET    /api/expenses/team?year=       → my team's claims
    //    PUT    /api/expenses/{id}/review      → approve / decline
    //    GET    /api/expenses/export?year=     → Excel (my own, or my team's)
    // ─────────────────────────────────────────────────────────────────────────
    [ApiController, Route("api/expenses"), Authorize]
    public class ExpenseController : ControllerBase
    {
        private readonly IExpenseService _expenses;
        private readonly IFileStorage _files;
        public ExpenseController(IExpenseService expenses, IFileStorage files)
        {
            _expenses = expenses;
            _files = files;
        }

        [HttpPost, RequestSizeLimit(6 * 1024 * 1024)]
        public async Task<IActionResult> Submit([FromForm] SubmitExpenseDto dto, IFormFile? receipt) =>
            Ok(await _expenses.SubmitAsync(User.GetUserId(), dto, receipt));

        [HttpGet("my")]
        public async Task<IActionResult> Mine() => Ok(await _expenses.GetMineAsync(User.GetUserId()));

        [HttpDelete("{id:int}")]
        public async Task<IActionResult> Cancel(int id)
        {
            await _expenses.CancelAsync(User.GetUserId(), id);
            return Ok(new { message = "Claim withdrawn." });
        }

        [HttpGet("{id:int}/receipt")]
        public async Task<IActionResult> Receipt(int id)
        {
            var (key, mime, name) = await _expenses.GetReceiptAsync(User.GetUserId(), id);
            return await this.StoredFileAsync(_files, key, mime, name);
        }

        [HttpGet("pending"), Authorize(Roles = "Manager,TeamLead")]
        public async Task<IActionResult> Pending() => Ok(await _expenses.GetPendingAsync(User.GetUserId()));

        [HttpGet("team"), Authorize(Roles = "Manager,TeamLead")]
        public async Task<IActionResult> Team([FromQuery] int? year) => Ok(await _expenses.GetTeamAsync(User.GetUserId(), year));

        [HttpPut("{id:int}/review"), Authorize(Roles = "Manager,TeamLead")]
        public async Task<IActionResult> Review(int id, [FromBody] ReviewExpenseDto dto)
        {
            await _expenses.ReviewAsync(User.GetUserId(), id, dto);
            return Ok(new { message = dto.Status == "Approved" ? "Claim approved." : "Claim declined." });
        }

        [HttpGet("export")]
        public async Task<IActionResult> Export([FromQuery] int? year)
        {
            var y = year is > 2000 ? year.Value : AppClock.TodayIst.Year;
            var team = User.IsInRole("Manager") || User.IsInRole("TeamLead");
            var rows = team ? await _expenses.GetTeamAsync(User.GetUserId(), y)
                            : (await _expenses.GetMineAsync(User.GetUserId())).Where(c => c.ExpenseDate.Year == y).ToList();
            var bytes = new XlsxWriter()
                .AddSheet($"Expenses {y}", new[] { "Employee", "Bill date", "Category", "Amount", "What for", "Status", "Paid with salary of", "Decided by", "Note" },
                    rows.OrderBy(c => c.UserName).ThenBy(c => c.ExpenseDate).Select(c => new object?[] { c.UserName, c.ExpenseDate.Date, c.Category,
                        c.Amount, c.Description, c.Status, c.PaidWith, c.ReviewerName, c.ReviewNote }))
                .ToBytes();
            return File(bytes, XlsxWriter.ContentType, $"{(team ? "Team" : "My")}_Expenses_{y}.xlsx");
        }
    }
}
