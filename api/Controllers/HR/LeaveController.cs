using DailyTrackerAPI.Data;
using DailyTrackerAPI.DTOs;
using DailyTrackerAPI.Helpers;
using DailyTrackerAPI.Services.HR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace DailyTrackerAPI.Controllers.HR
{
    // ─── Leave Controller ─────────────────────────────────────────────────────
    //
    //  CHANGE FROM ORIGINAL:
    //    GetBalance now calls GetAnnualBalanceAsync instead of GetMonthlyBalanceAsync.
    //    Everything else is identical.
    // ─────────────────────────────────────────────────────────────────────────
    [ApiController, Route("api/leave"), Authorize]
    public class LeaveController : ControllerBase
    {
        private readonly ILeaveService _leaveSvc;
        private readonly AppDbContext _context;

        public LeaveController(ILeaveService leaveSvc, AppDbContext context)
        {
            _leaveSvc = leaveSvc;
            _context = context;
        }

        [HttpPost]
        public async Task<IActionResult> Apply([FromBody] ApplyLeaveDto dto)
        {
            var leave = await _leaveSvc.ApplyAsync(User.GetUserId(), dto);
            return Ok(leave);
        }

        [HttpGet("my")]
        public async Task<IActionResult> GetMine()
        {
            var leaves = await _leaveSvc.GetMyLeavesAsync(User.GetUserId());
            return Ok(leaves);
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> Cancel(int id)
        {
            try
            {
                await _leaveSvc.CancelAsync(id, User.GetUserId());
                return Ok(new { message = "Leave cancelled." });
            }
            catch (InvalidOperationException ex) { return BadRequest(new { message = ex.Message }); }
        }

        // leave is decided by Managers — and by a team lead while covering for an away Manager
        [HttpGet("all"), Authorize(Roles = "Manager,TeamLead")]
        public async Task<IActionResult> GetAll([FromQuery] string? status,
            [FromServices] DailyTrackerAPI.Services.Auth.ITeamScope scope)
        {
            if (!User.IsInRole("Manager") && !await scope.ActsForManagerAsync(User.GetUserId()))
                return StatusCode(403, new { message = "Leave requests are decided by managers." });
            var leaves = await _leaveSvc.GetAllLeavesAsync(status, User.GetUserId());
            return Ok(leaves);
        }

        [HttpPut("{id}/review"), Authorize(Roles = "Manager,TeamLead")]
        public async Task<IActionResult> Review(int id, [FromBody] ReviewLeaveDto dto)
        {
            await _leaveSvc.ReviewAsync(id, User.GetUserId(), dto);
            return Ok(new { message = "Leave reviewed." });
        }

        [AllowAnonymous]
        [HttpPost("email-review")]
        public async Task<IActionResult> EmailReview([FromBody] EmailReviewDto dto)
        {
            if (string.IsNullOrEmpty(dto.Token) || string.IsNullOrEmpty(dto.Status))
                return BadRequest("Invalid request");

            var action = await _context.LeaveEmailActions
                .FirstOrDefaultAsync(x => x.Token == dto.Token);

            if (action == null) return BadRequest("Invalid token");
            if (action.IsUsed) return BadRequest("This link has already been used");
            if (action.ExpiryDate < DateTime.UtcNow) return BadRequest("This link has expired");

            var leave = await _context.LeaveRequests
                .FirstOrDefaultAsync(x => x.Id == action.LeaveId);

            if (leave == null) return BadRequest("Leave not found");
            if (leave.Status != "Pending") return BadRequest("Leave already processed");

            await _leaveSvc.ReviewAsync(
                action.LeaveId, action.ManagerId,
                new ReviewLeaveDto { Status = dto.Status, ReviewNote = "Reviewed via email" });

            action.IsUsed = true;
            await _context.SaveChangesAsync();

            return Ok(new { message = "Leave updated successfully" });
        }

        /// <summary>
        /// Leave as an Excel file for a year: requests, balances and comp-off.
        /// A manager gets everyone's; everybody else gets their own.
        /// </summary>
        [HttpGet("export")]
        public async Task<IActionResult> Export([FromQuery] int year, [FromServices] ICompOffService compOff)
        {
            if (year < 2000) year = AppClock.TodayIst.Year;
            var userId = User.GetUserId();
            var isManager = User.IsInRole("Manager");
            var from = new DateTime(year, 1, 1);
            var to = new DateTime(year, 12, 31);

            var leaves = (isManager ? await _leaveSvc.GetAllLeavesAsync(null, userId) : await _leaveSvc.GetMyLeavesAsync(userId))
                .Where(l => l.FromDate <= to && l.ToDate >= from)
                .OrderBy(l => l.UserName).ThenBy(l => l.FromDate).ToList();
            var balances = year == AppClock.TodayIst.Year
                ? await _leaveSvc.GetAnnualBalanceAsync(isManager ? null : userId)
                : new List<LeaveBalanceDto>();
            var credits = isManager ? await compOff.GetTeamAsync(userId) : (await compOff.GetMineAsync(userId)).Credits;

            DateTime? Ist(DateTime? utc) => utc is DateTime u ? AppClock.ToIst(u) : null;
            var writer = new XlsxWriter()
                .AddSheet("Leave requests", new[] { "Employee", "Type", "From", "To", "Days", "Status", "Reason", "Applied on (IST)", "Reviewed by", "Review note", "Reviewed on (IST)" },
                    leaves.Select(l => new object?[] { l.UserName, l.LeaveType, l.FromDate.Date, l.ToDate.Date, l.LeaveDays, l.Status, l.Reason,
                        Ist(l.AppliedAt), l.ReviewerName, l.ReviewNote, Ist(l.ReviewedAt) }));
            if (balances.Count > 0)
                writer.AddSheet($"Balance {year}", new[] { "Employee", "Type", "Entitlement", "Used (incl. pending)", "Pending", "Remaining" },
                    balances.SelectMany(b => b.Balances.Select(t => new object?[] { b.UserName, t.LeaveType,
                        t.IsUnlimited ? "No limit" : t.Entitlement, t.Used, t.Pending, t.IsUnlimited ? "No limit" : t.Remaining })));
            writer.AddSheet("Comp-off", new[] { "Employee", "Day worked", "Occasion", "Hours worked", "State", "Use by", "Taken on", "Decided by", "Note" },
                credits.Where(c => c.WorkDate.Year == year || c.ExpiresOn.Year == year).OrderBy(c => c.UserName).ThenBy(c => c.WorkDate)
                    .Select(c => new object?[] { c.UserName, c.WorkDate.Date, c.Occasion, Math.Round(c.WorkMinutes / 60.0, 2), c.State,
                        c.ExpiresOn.Date, c.UsedOn?.Date, c.ReviewerName, c.ReviewNote }));

            return File(writer.ToBytes(), XlsxWriter.ContentType, $"{(isManager ? "Team_Leave" : "My_Leave")}_{year}.xlsx");
        }

        // ── CHANGED: calls GetAnnualBalanceAsync ───────────────────────────────
        [HttpGet("balance")]
        public async Task<IActionResult> GetBalance()
        {
            var userId = User.GetUserId();
            var role = User.FindFirst(System.Security.Claims.ClaimTypes.Role)?.Value;

            // Manager sees all users; employee sees only themselves
            if (role == "Manager")
                return Ok(await _leaveSvc.GetAnnualBalanceAsync());

            return Ok(await _leaveSvc.GetAnnualBalanceAsync(userId));
        }
    }
}