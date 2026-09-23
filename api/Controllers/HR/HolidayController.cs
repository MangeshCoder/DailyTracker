using DailyTrackerAPI.DTOs;
using DailyTrackerAPI.Services.HR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace DailyTrackerAPI.Controllers.HR
{
    // ─── Holiday Controller ───────────────────────────────────────────────────
    [ApiController, Route("api/holidays"), Authorize]
    public class HolidayController : ControllerBase
    {
        private readonly IHolidayService _holidaySvc;
        public HolidayController(IHolidayService holidaySvc) => _holidaySvc = holidaySvc;

        [HttpGet]
        public async Task<IActionResult> Get([FromQuery] int year = 0)
        {
            if (year == 0) year = DateTime.UtcNow.Year;
            var list = await _holidaySvc.GetByYearAsync(year);
            return Ok(list);
        }

        [HttpGet("today")]
        public async Task<IActionResult> IsToday()
        {
            var isHoliday = await _holidaySvc.IsTodayHolidayAsync();
            return Ok(new { isHoliday });
        }

        [HttpPost, Authorize(Roles = "Manager")]
        public async Task<IActionResult> Create([FromBody] CreateHolidayDto dto)
        {
            var h = await _holidaySvc.AddAsync(dto);
            return Ok(h);
        }

        [HttpDelete("{id}"), Authorize(Roles = "Manager")]
        public async Task<IActionResult> Delete(int id)
        {
            await _holidaySvc.DeleteAsync(id);
            return Ok(new { message = "Holiday deleted." });
        }
    }
}
