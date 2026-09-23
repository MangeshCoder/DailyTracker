using DailyTrackerAPI.Data;
using DailyTrackerAPI.DTOs;
using DailyTrackerAPI.Models.Tasks;
using DailyTrackerAPI.Services.Team;
using Microsoft.EntityFrameworkCore;

namespace DailyTrackerAPI.Services.Tasks
{
    // ── Custom exception for location failures ────────────────────────────────
    public class LocationException : Exception
    {
        public LocationException(string message) : base(message) { }
    }

    public interface ISupportService
    {
        Task<SupportLogResponseDto?> CreateSupportAsync(int userId, CreateSupportDto dto);
        Task<SupportLogResponseDto?> CreateSupportWithMediaAsync(int userId, CreateSupportDto dto, IFormFileCollection? files);
        Task<bool> DeleteSupportAsync(int userId, int supportId);
        Task<List<SupportLogResponseDto>> GetTodaySupportAsync(int userId);
        Task<MyAssignmentDto> GetMyAssignmentAsync(int userId);  // Feature 3
    }

    public class SupportService : ISupportService
    {
        private readonly AppDbContext _db;
        private readonly IMediaStorageService _mediaStorage;
        private readonly ILocationService _location;

        public SupportService(
            AppDbContext db,
            IMediaStorageService mediaStorage,
            ILocationService location)
        {
            _db = db;
            _mediaStorage = mediaStorage;
            _location = location;
        }

        public async Task<SupportLogResponseDto?> CreateSupportAsync(
            int userId, CreateSupportDto dto)
        {
            // ── Location check ────────────────────────────────────────────────
            var distance = _location.GetDistanceFromOffice(dto.Latitude, dto.Longitude);
            if (!_location.IsWithinOffice(dto.Latitude, dto.Longitude))
            {
                throw new LocationException(
                    $"You are not at your company location. " +
                    $"You must be within {_location.RadiusMetres:0}m of {_location.OfficeName}. " +
                    $"Your current distance: {distance:0}m."
                );
            }

            // ── Validate daily log ────────────────────────────────────────────
            var today = DateTime.UtcNow.Date;
            var log = await _db.DailyLogs
                .FirstOrDefaultAsync(d => d.UserId == userId && d.LogDate == today);
            if (log == null) return null;

            // ── Validate engineer and developer ───────────────────────────────
            var engineer = await _db.Users.FindAsync(dto.SupportEngineerId);
            var developer = await _db.Users.FindAsync(dto.SupportedDeveloperId);
            if (engineer == null || developer == null) return null;

            // ── Save support log ──────────────────────────────────────────────
            var support = new SupportLog
            {
                DailyLogId = log.Id,
                SupportEngineerId = dto.SupportEngineerId,
                SupportedDeveloperId = dto.SupportedDeveloperId,
                IssueDescription = dto.IssueDescription,
                Resolution = dto.Resolution,
                TimeSpentMinutes = dto.TimeSpentMinutes,
                SupportType = dto.SupportType,
                SupportedAt = DateTime.UtcNow,
                Latitude = dto.Latitude,
                Longitude = dto.Longitude,
                DistanceFromOfficeMetres = distance,
                SupportAssignmentId = dto.SupportAssignmentId,  // Feature 3
            };

            _db.SupportLogs.Add(support);
            await _db.SaveChangesAsync();

            return MapToDto(support, engineer.FullName, developer.FullName,
                new List<MediaEvidenceDto>(), dto.SupportAssignmentId.HasValue);
        }

        public async Task<SupportLogResponseDto?> CreateSupportWithMediaAsync(
            int userId, CreateSupportDto dto, IFormFileCollection? files)
        {
            var result = await CreateSupportAsync(userId, dto);
            if (result == null || files == null || files.Count == 0)
                return result;

            var mediaList = await _mediaStorage.SaveSupportMediaAsync(userId, result.Id, files);
            result.Media = mediaList;
            return result;
        }

        public async Task<bool> DeleteSupportAsync(int userId, int supportId)
        {
            var support = await _db.SupportLogs
                .Include(s => s.DailyLog)
                .FirstOrDefaultAsync(s => s.Id == supportId && s.DailyLog.UserId == userId);
            if (support == null) return false;
            _db.SupportLogs.Remove(support);
            await _db.SaveChangesAsync();
            return true;
        }

        public async Task<List<SupportLogResponseDto>> GetTodaySupportAsync(int userId)
        {
            var today = DateTime.UtcNow.Date;
            var list = await _db.SupportLogs
                .Include(s => s.DailyLog)
                .Include(s => s.SupportEngineer)
                .Include(s => s.SupportedDeveloper)
                .Include(s => s.MediaEvidences)
                .Where(s => s.DailyLog.UserId == userId && s.DailyLog.LogDate == today)
                .ToListAsync();

            return list.Select(s => MapToDto(
                s,
                s.SupportEngineer?.FullName ?? "",
                s.SupportedDeveloper.FullName,
                s.MediaEvidences.Select(m => new MediaEvidenceDto
                {
                    Id = m.Id,
                    MediaType = m.MediaType,
                    FileName = m.FileName,
                    Url = _mediaStorage.GetSecuredMediaUrl(m.Id),
                    FileSizeBytes = m.FileSizeBytes,
                    MimeType = m.MimeType
                }).ToList(),
                s.SupportAssignmentId.HasValue
            )).ToList();
        }

        /// <summary>
        /// Feature 3: Returns the active assignment for a developer.
        /// If a manager assigned an engineer to this developer, return that info.
        /// The frontend uses this to pre-fill the engineer dropdown.
        /// </summary>
        public async Task<MyAssignmentDto> GetMyAssignmentAsync(int userId)
        {
            // Look for ANY active assignment where this user is the developer
            var assignment = await _db.SupportAssignments
                .Include(a => a.SupportEngineer)
                .Where(a => a.DeveloperId == userId && a.IsActive)
                .OrderByDescending(a => a.AssignedAt)
                .FirstOrDefaultAsync();

            if (assignment == null)
                return new MyAssignmentDto { HasAssignment = false };

            return new MyAssignmentDto
            {
                HasAssignment = true,
                AssignmentId = assignment.Id,
                SupportEngineerId = assignment.SupportEngineerId,
                SupportEngineerName = assignment.SupportEngineer.FullName,
                Notes = assignment.Notes,
                AssignedAt = assignment.AssignedAt,
            };
        }

        private static SupportLogResponseDto MapToDto(
            SupportLog s,
            string engineerName,
            string developerName,
            List<MediaEvidenceDto> media,
            bool wasAssigned) =>
            new()
            {
                Id = s.Id,
                SupportEngineerName = engineerName,
                SupportedDeveloperName = developerName,
                IssueDescription = s.IssueDescription,
                Resolution = s.Resolution,
                TimeSpentMinutes = s.TimeSpentMinutes,
                SupportType = s.SupportType,
                SupportedAt = s.SupportedAt,
                Media = media,
                Latitude = s.Latitude,
                Longitude = s.Longitude,
                DistanceFromOfficeMetres = s.DistanceFromOfficeMetres,
                WasAssigned = wasAssigned,
            };
    }
}
