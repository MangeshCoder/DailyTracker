using DailyTrackerAPI.Data;
using DailyTrackerAPI.DTOs;
using DailyTrackerAPI.Models.Tasks;
using DailyTrackerAPI.Services.Auth;
using Microsoft.EntityFrameworkCore;

namespace DailyTrackerAPI.Services.Tasks
{
    public interface ISupportAssignmentService
    {
        Task<SupportAssignmentDto> AssignAsync(int managerId, CreateSupportAssignmentDto dto);
        Task<bool> DeactivateAsync(int managerId, int assignmentId);
        Task<List<SupportAssignmentDto>> GetAllAsync(int viewerId);
        Task<List<SupportAssignmentDto>> GetByEngineerAsync(int engineerId);
        Task<List<SupportAssignmentDto>> GetByDeveloperAsync(int developerId);
    }

    public class SupportAssignmentService : ISupportAssignmentService
    {
        private readonly AppDbContext _db;
        private readonly ITeamScope _scope;

        public SupportAssignmentService(AppDbContext db, ITeamScope scope)
        {
            _db = db;
            _scope = scope;
        }

        public async Task<SupportAssignmentDto> AssignAsync(
            int managerId, CreateSupportAssignmentDto dto)
        {
            if (dto.SupportEngineerId == dto.DeveloperId)
                throw new Custom.ValidationException("The support engineer and the developer must be different people.");
            var people = await _db.Users
                .Where(u => (u.Id == dto.SupportEngineerId || u.Id == dto.DeveloperId) && u.IsActive && u.Role != "Pending")
                .CountAsync();
            if (people != 2)
                throw new Custom.ValidationException("Choose two active team members.");
            await _scope.EnsureCanManageAsync(managerId, dto.DeveloperId);

            var assignment = new SupportAssignment
            {
                SupportEngineerId = dto.SupportEngineerId,
                DeveloperId = dto.DeveloperId,
                AssignedByManagerId = managerId,
                Notes = dto.Notes,
                IsActive = true,
                AssignedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow,
            };

            _db.SupportAssignments.Add(assignment);
            await _db.SaveChangesAsync();

            // Reload with navigation properties
            return await LoadDto(assignment.Id);
        }

        public async Task<bool> DeactivateAsync(int managerId, int assignmentId)
        {
            var assignment = await _db.SupportAssignments.FindAsync(assignmentId);
            if (assignment == null) return false;
            await _scope.EnsureCanManageAsync(managerId, assignment.DeveloperId);

            assignment.IsActive = false;
            assignment.UpdatedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync();
            return true;
        }

        public async Task<List<SupportAssignmentDto>> GetAllAsync(int viewerId)
        {
            var team = await _scope.ManagedUserIdsAsync(viewerId);   // null = everyone
            var list = await _db.SupportAssignments
                .Where(a => team == null || team.Contains(a.DeveloperId))
                .Include(a => a.SupportEngineer)
                .Include(a => a.Developer)
                .Include(a => a.AssignedByManager)
                .OrderByDescending(a => a.AssignedAt)
                .ToListAsync();
            return list.Select(MapDto).ToList();
        }

        public async Task<List<SupportAssignmentDto>> GetByEngineerAsync(int engineerId)
        {
            var list = await _db.SupportAssignments
                .Include(a => a.SupportEngineer)
                .Include(a => a.Developer)
                .Include(a => a.AssignedByManager)
                .Where(a => a.SupportEngineerId == engineerId && a.IsActive)
                .ToListAsync();
            return list.Select(MapDto).ToList();
        }

        public async Task<List<SupportAssignmentDto>> GetByDeveloperAsync(int developerId)
        {
            var list = await _db.SupportAssignments
                .Include(a => a.SupportEngineer)
                .Include(a => a.Developer)
                .Include(a => a.AssignedByManager)
                .Where(a => a.DeveloperId == developerId && a.IsActive)
                .ToListAsync();
            return list.Select(MapDto).ToList();
        }

        private async Task<SupportAssignmentDto> LoadDto(int id)
        {
            var a = await _db.SupportAssignments
                .Include(x => x.SupportEngineer)
                .Include(x => x.Developer)
                .Include(x => x.AssignedByManager)
                .FirstAsync(x => x.Id == id);
            return MapDto(a);
        }

        private static SupportAssignmentDto MapDto(SupportAssignment a) => new()
        {
            Id = a.Id,
            SupportEngineerId = a.SupportEngineerId,
            SupportEngineerName = a.SupportEngineer?.FullName ?? "",
            DeveloperId = a.DeveloperId,
            DeveloperName = a.Developer?.FullName ?? "",
            AssignedByManager = a.AssignedByManager?.FullName ?? "",
            IsActive = a.IsActive,
            Notes = a.Notes,
            AssignedAt = a.AssignedAt,
        };
    }
}
