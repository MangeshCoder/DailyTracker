using DailyTrackerAPI.Data;
using DailyTrackerAPI.DTOs;
using DailyTrackerAPI.Models;
using DailyTrackerAPI.Models.Communication;
using Microsoft.EntityFrameworkCore;

namespace DailyTrackerAPI.Services.Communication
{
    public interface IKudosService
    {
        Task<KudosDto> GiveKudosAsync(int fromUserId, GiveKudosDto dto);
        Task<List<KudosDto>> GetRecentKudosAsync(int limit = 20);
        Task<KudosSummaryDto> GetUserKudosSummaryAsync(int userId);
        Task<KudosLeaderboardDto> GetLeaderboardAsync(int year, int? month);
    }

    public class KudosService : IKudosService
    {
        private readonly AppDbContext _db;
        private readonly INotificationSender _notif;

        public KudosService(AppDbContext db, INotificationSender notif)
        {
            _db = db;
            _notif = notif;
        }

        public async Task<KudosDto> GiveKudosAsync(int fromUserId, GiveKudosDto dto)
        {
            if (fromUserId == dto.ToUserId)
                throw new InvalidOperationException("You cannot give kudos to yourself.");

            var toUser = await _db.Users.FindAsync(dto.ToUserId)
                           ?? throw new KeyNotFoundException("User not found.");
            var fromUser = await _db.Users.FindAsync(fromUserId)!;

            var kudos = new Kudos
            {
                FromUserId = fromUserId,
                ToUserId = dto.ToUserId,
                Message = dto.Message,
                BadgeType = dto.BadgeType
            };

            _db.Kudos.Add(kudos);
            await _db.SaveChangesAsync();

            _db.Notifications.Add(new AppNotification
            {
                UserId = dto.ToUserId,
                Title = "You got Kudos! 🎉",
                Message = $"{fromUser!.FullName} gave you a '{dto.BadgeType}' badge: {dto.Message}",
                Type = "Success"
            });
            await _db.SaveChangesAsync();

            await _notif.SendToUser(dto.ToUserId, "ReceiveNotification", new
            {
                Title = "You got Kudos! 🎉",
                Message = $"{fromUser.FullName}: {dto.Message}",
                Type = "Success",
                BadgeType = dto.BadgeType
            });

            return new KudosDto
            {
                Id = kudos.Id,
                FromUserName = fromUser.FullName,
                ToUserName = toUser.FullName,
                Message = kudos.Message,
                BadgeType = kudos.BadgeType,
                GivenAt = kudos.GivenAt
            };
        }

        public async Task<List<KudosDto>> GetRecentKudosAsync(int limit = 20)
        {
            return await _db.Kudos
                .Include(k => k.FromUser)
                .Include(k => k.ToUser)
                .OrderByDescending(k => k.GivenAt)
                .Take(limit)
                .Select(k => new KudosDto
                {
                    Id = k.Id,
                    FromUserName = k.FromUser.FullName,
                    ToUserName = k.ToUser.FullName,
                    Message = k.Message,
                    BadgeType = k.BadgeType,
                    GivenAt = k.GivenAt
                }).ToListAsync();
        }

        public async Task<KudosSummaryDto> GetUserKudosSummaryAsync(int userId)
        {
            var user = await _db.Users.FindAsync(userId)
                       ?? throw new KeyNotFoundException("User not found.");

            var received = await _db.Kudos
                .Include(k => k.FromUser)
                .Where(k => k.ToUserId == userId)
                .ToListAsync();

            var given = await _db.Kudos.CountAsync(k => k.FromUserId == userId);

            return new KudosSummaryDto
            {
                User = new UserDto { Id = user.Id, FullName = user.FullName, Email = user.Email, Role = user.Role },
                TotalReceived = received.Count,
                TotalGiven = given,
                BadgeCounts = received
                    .GroupBy(k => k.BadgeType)
                    .ToDictionary(g => g.Key, g => g.Count()),
                RecentKudos = received
                    .OrderByDescending(k => k.GivenAt)
                    .Take(5)
                    .Select(k => new KudosDto
                    {
                        Id = k.Id,
                        FromUserName = k.FromUser.FullName,
                        ToUserName = user.FullName,
                        Message = k.Message,
                        BadgeType = k.BadgeType,
                        GivenAt = k.GivenAt
                    }).ToList()
            };
        }

        // month = null  → full calendar year
        // month = 1-12  → that specific month only
        public async Task<KudosLeaderboardDto> GetLeaderboardAsync(int year, int? month)
        {
            DateTime from = month.HasValue
                ? new DateTime(year, month.Value, 1)
                : new DateTime(year, 1, 1);

            DateTime to = month.HasValue
                ? from.AddMonths(1)
                : new DateTime(year + 1, 1, 1);

            // Single query — load all kudos in window with recipient navigation
            var kudosInPeriod = await _db.Kudos
                .Include(k => k.ToUser)
                .Where(k => k.GivenAt >= from && k.GivenAt < to)
                .ToListAsync();

            // Count how many kudos each person GAVE (for TotalGiven column)
            var givenCounts = kudosInPeriod
                .GroupBy(k => k.FromUserId)
                .ToDictionary(g => g.Key, g => g.Count());

            // Group by recipient, compute badge breakdown and top badge
            var entries = kudosInPeriod
                .GroupBy(k => k.ToUserId)
                .Select(g =>
                {
                    var badgeCounts = g
                        .GroupBy(k => k.BadgeType)
                        .ToDictionary(bg => bg.Key, bg => bg.Count());

                    var topBadge = badgeCounts.Count > 0
                        ? badgeCounts.OrderByDescending(kv => kv.Value).First().Key
                        : string.Empty;

                    return new KudosLeaderboardEntryDto
                    {
                        UserId = g.Key,
                        UserName = g.First().ToUser.FullName,
                        TotalReceived = g.Count(),
                        TotalGiven = givenCounts.TryGetValue(g.Key, out var gv) ? gv : 0,
                        BadgeCounts = badgeCounts,
                        TopBadge = topBadge
                    };
                })
                .OrderByDescending(e => e.TotalReceived)
                .ToList();

            // Assign rank after ordering
            for (int i = 0; i < entries.Count; i++)
                entries[i].Rank = i + 1;

            string periodLabel = month.HasValue
                ? $"{new DateTime(year, month.Value, 1):MMMM yyyy}"
                : $"Full Year {year}";

            return new KudosLeaderboardDto
            {
                Year = year,
                Month = month,
                PeriodLabel = periodLabel,
                Entries = entries
            };
        }
    }
}