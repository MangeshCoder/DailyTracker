using DailyTrackerAPI.Data;
using DailyTrackerAPI.DTOs;
using DailyTrackerAPI.Models.HR;
using Microsoft.EntityFrameworkCore;
using DailyTrackerAPI.Helpers;

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
            if (string.IsNullOrWhiteSpace(dto.Name))
                throw new Custom.ValidationException("Please enter the holiday name.");
            dto.Type = new[] { "Public", "Optional", "Company" }
                .FirstOrDefault(t => t.Equals(dto.Type?.Trim(), StringComparison.OrdinalIgnoreCase))
                ?? throw new Custom.ValidationException("Type must be Public, Optional or Company.");
            var existing = await _db.Holidays.FirstOrDefaultAsync(h => h.Date == dto.Date.Date);
            if (existing != null)
                throw new Custom.ValidationException($"{dto.Date:dd MMM yyyy} is already a holiday ({existing.Name}).");   // was a database error (500)

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
            var today = AppClock.TodayIst;
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
            await _db.Holidays.AnyAsync(h => h.Date == AppClock.TodayIst);

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
