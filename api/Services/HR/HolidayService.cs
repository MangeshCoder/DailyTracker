using DailyTrackerAPI.Data;
using DailyTrackerAPI.DTOs;
using DailyTrackerAPI.Models.HR;
using Microsoft.EntityFrameworkCore;

namespace DailyTrackerAPI.Services.HR
{
    // ─────────────────────────────────────────────────────────────────────────
    //  Feature 10: Holiday + Late Arrival Services
    // ─────────────────────────────────────────────────────────────────────────
    public interface IHolidayService
    {
        Task<HolidayDto> AddAsync(CreateHolidayDto dto);
        Task<List<HolidayDto>> GetByYearAsync(int year);
        Task DeleteAsync(int id);
        Task<bool> IsTodayHolidayAsync();
    }

    public class HolidayService : IHolidayService
    {
        private readonly AppDbContext _db;

        public HolidayService(AppDbContext db) { _db = db; }

        public async Task<HolidayDto> AddAsync(CreateHolidayDto dto)
        {
            var holiday = new Holiday
            {
                Date = dto.Date.Date,
                Name = dto.Name,
                Type = dto.Type,
                Year = dto.Date.Year
            };
            _db.Holidays.Add(holiday);
            await _db.SaveChangesAsync();
            return Map(holiday);
        }

        public async Task<List<HolidayDto>> GetByYearAsync(int year)
        {
            var today = DateTime.UtcNow.Date;
            return await _db.Holidays
                .Where(h => h.Year == year)
                .OrderBy(h => h.Date)
                .Select(h => new HolidayDto
                {
                    Id = h.Id,
                    Date = h.Date,
                    Name = h.Name,
                    Type = h.Type,
                    Year = h.Year,
                    IsToday = h.Date == today
                }).ToListAsync();
        }

        public async Task DeleteAsync(int id)
        {
            var h = await _db.Holidays.FindAsync(id)
                ?? throw new KeyNotFoundException();
            _db.Holidays.Remove(h);
            await _db.SaveChangesAsync();
        }

        public async Task<bool> IsTodayHolidayAsync() =>
            await _db.Holidays.AnyAsync(h => h.Date == DateTime.UtcNow.Date);

        private static HolidayDto Map(Holiday h) => new()
        {
            Id = h.Id,
            Date = h.Date,
            Name = h.Name,
            Type = h.Type,
            Year = h.Year
        };
    }
}
