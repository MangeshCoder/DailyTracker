using DailyTrackerAPI.Data;
using DailyTrackerAPI.Models;
using DailyTrackerAPI.Models.HR;

namespace DailyTrackerAPI.Services.Auth
{
    public interface IEmailActionService
    {
        Task<string> CreateTokenAsync(int leaveId, int managerId);
    }
    public class EmailActionService : IEmailActionService
    {
        private readonly AppDbContext _context;

        public EmailActionService(AppDbContext context)
        {
            _context = context;
        }

        public async Task<string> CreateTokenAsync(int leaveId, int managerId)
        {
            var token = Guid.NewGuid().ToString("N");

            var action = new LeaveEmailAction
            {
                LeaveId = leaveId,
                ManagerId = managerId,
                Token = token,
                ExpiryDate = DateTime.UtcNow.AddHours(24)
            };

            _context.LeaveEmailActions.Add(action);
            await _context.SaveChangesAsync();

            return token;
        }
    }
}
