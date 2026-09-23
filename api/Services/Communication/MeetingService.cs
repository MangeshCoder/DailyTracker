using DailyTrackerAPI.Data;
using DailyTrackerAPI.DTOs;
using DailyTrackerAPI.Models.Communication;
using Microsoft.EntityFrameworkCore;

namespace DailyTrackerAPI.Services.Communication
{
    public interface IMeetingService
    {
        Task<List<MeetingDto>> GetMyMeetingsAsync(int userId, int? month, int? year);
        Task<MeetingDto?> GetByIdAsync(int meetingId, int userId);
        Task<MeetingDto> CreateAsync(int userId, CreateMeetingDto dto);
        Task<MeetingDto?> UpdateAsync(int meetingId, int userId, UpdateMeetingDto dto);
        Task<bool> DeleteAsync(int meetingId, int userId);
        Task<MeetingDto?> RsvpAsync(int meetingId, int userId, MeetingRsvpDto dto);
        Task<MeetingActionItemDto> AddActionItemAsync(int meetingId, int userId, CreateActionItemDto dto);
        Task<MeetingActionItemDto?> UpdateActionItemAsync(int itemId, int userId, UpdateActionItemDto dto);
        Task<bool> DeleteActionItemAsync(int itemId, int userId);
    }

    public class MeetingService : IMeetingService
    {
        private readonly AppDbContext _db;
        public MeetingService(AppDbContext db) => _db = db;

        // ── Get all meetings the user is involved in (as organiser or attendee) ─
        public async Task<List<MeetingDto>> GetMyMeetingsAsync(int userId, int? month, int? year)
        {
            var query = _db.Meetings
                .Include(m => m.OrganisedBy)
                .Include(m => m.Attendees).ThenInclude(a => a.User)
                .Include(m => m.ActionItems).ThenInclude(ai => ai.AssignedTo)
                .Where(m =>
                    m.OrganisedByUserId == userId ||
                    m.Attendees.Any(a => a.UserId == userId))
                .AsQueryable();

            if (month.HasValue && year.HasValue)
            {
                var from = new DateTime(year.Value, month.Value, 1);
                var to = from.AddMonths(1);
                query = query.Where(m => m.ScheduledAt >= from && m.ScheduledAt < to);
            }

            var meetings = await query
                .OrderBy(m => m.ScheduledAt)
                .ToListAsync();

            return meetings.Select(m => MapDto(m, userId)).ToList();
        }

        // ── Get single meeting ────────────────────────────────────────────────
        public async Task<MeetingDto?> GetByIdAsync(int meetingId, int userId)
        {
            var meeting = await LoadMeeting(meetingId);
            if (meeting == null) return null;

            // Only organiser or attendees can view
            bool canView = meeting.OrganisedByUserId == userId ||
                           meeting.Attendees.Any(a => a.UserId == userId);
            return canView ? MapDto(meeting, userId) : null;
        }

        // ── Create meeting ────────────────────────────────────────────────────
        public async Task<MeetingDto> CreateAsync(int userId, CreateMeetingDto dto)
        {
            var meeting = new Meeting
            {
                Title = dto.Title.Trim(),
                Agenda = dto.Agenda?.Trim(),
                Location = dto.Location?.Trim(),
                MeetingType = dto.MeetingType,
                ScheduledAt = dto.ScheduledAt.ToUniversalTime(),
                DurationMinutes = dto.DurationMinutes,
                IsRecurring = dto.IsRecurring,
                RecurrencePattern = dto.RecurrencePattern,
                OrganisedByUserId = userId,
                Status = "Scheduled",
            };

            _db.Meetings.Add(meeting);
            await _db.SaveChangesAsync();

            // Auto-add organiser as Accepted attendee
            var organiserAttendee = new MeetingAttendee
            {
                MeetingId = meeting.Id,
                UserId = userId,
                Response = "Accepted",
                Attended = false,
            };
            _db.MeetingAttendees.Add(organiserAttendee);

            // Add invited attendees (skip organiser if included)
            foreach (var attendeeId in dto.AttendeeIds.Distinct().Where(id => id != userId))
            {
                _db.MeetingAttendees.Add(new MeetingAttendee
                {
                    MeetingId = meeting.Id,
                    UserId = attendeeId,
                    Response = "Pending",
                });
            }

            await _db.SaveChangesAsync();

            // Reload with navigation props for mapping
            var created = await LoadMeeting(meeting.Id);
            return MapDto(created!, userId);
        }

        // ── Update meeting (organiser only) ───────────────────────────────────
        public async Task<MeetingDto?> UpdateAsync(int meetingId, int userId, UpdateMeetingDto dto)
        {
            var meeting = await LoadMeeting(meetingId);
            if (meeting == null || meeting.OrganisedByUserId != userId) return null;

            if (dto.Title != null) meeting.Title = dto.Title.Trim();
            if (dto.Agenda != null) meeting.Agenda = dto.Agenda.Trim();
            if (dto.Notes != null) meeting.Notes = dto.Notes.Trim();
            if (dto.Location != null) meeting.Location = dto.Location.Trim();
            if (dto.MeetingType != null) meeting.MeetingType = dto.MeetingType;
            if (dto.ScheduledAt.HasValue) meeting.ScheduledAt = dto.ScheduledAt.Value.ToUniversalTime();
            if (dto.DurationMinutes.HasValue) meeting.DurationMinutes = dto.DurationMinutes.Value;
            if (dto.Status != null) meeting.Status = dto.Status;
            if (dto.RecurrencePattern != null) meeting.RecurrencePattern = dto.RecurrencePattern;

            meeting.UpdatedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync();

            return MapDto(meeting, userId);
        }

        // ── Delete meeting (organiser only) ───────────────────────────────────
        public async Task<bool> DeleteAsync(int meetingId, int userId)
        {
            var meeting = await _db.Meetings.FindAsync(meetingId);
            if (meeting == null || meeting.OrganisedByUserId != userId) return false;

            _db.Meetings.Remove(meeting);
            await _db.SaveChangesAsync();
            return true;
        }

        // ── RSVP (attendee responds to invite) ───────────────────────────────
        public async Task<MeetingDto?> RsvpAsync(int meetingId, int userId, MeetingRsvpDto dto)
        {
            var attendee = await _db.MeetingAttendees
                .FirstOrDefaultAsync(a => a.MeetingId == meetingId && a.UserId == userId);

            if (attendee == null) return null;

            attendee.Response = dto.Response;
            await _db.SaveChangesAsync();

            var meeting = await LoadMeeting(meetingId);
            return MapDto(meeting!, userId);
        }

        // ── Action items ──────────────────────────────────────────────────────
        public async Task<MeetingActionItemDto> AddActionItemAsync(
            int meetingId, int userId, CreateActionItemDto dto)
        {
            var meeting = await _db.Meetings
                .Include(m => m.Attendees)
                .FirstOrDefaultAsync(m => m.Id == meetingId);

            if (meeting == null) throw new KeyNotFoundException("Meeting not found.");

            bool canAdd = meeting.OrganisedByUserId == userId ||
                          meeting.Attendees.Any(a => a.UserId == userId);
            if (!canAdd) throw new UnauthorizedAccessException("Not a meeting participant.");

            var item = new MeetingActionItem
            {
                MeetingId = meetingId,
                Description = dto.Description.Trim(),
                AssignedToUserId = dto.AssignedToUserId,
                DueDate = dto.DueDate?.ToUniversalTime(),
                Status = "Open",
            };

            _db.MeetingActionItems.Add(item);
            await _db.SaveChangesAsync();

            // Load assigned user name
            string? assignedName = null;
            if (item.AssignedToUserId.HasValue)
            {
                var assignedUser = await _db.Users.FindAsync(item.AssignedToUserId.Value);
                assignedName = assignedUser?.FullName;
            }

            return MapActionItem(item, assignedName);
        }

        public async Task<MeetingActionItemDto?> UpdateActionItemAsync(
            int itemId, int userId, UpdateActionItemDto dto)
        {
            var item = await _db.MeetingActionItems
                .Include(ai => ai.Meeting)
                .Include(ai => ai.AssignedTo)
                .FirstOrDefaultAsync(ai => ai.Id == itemId);

            if (item == null) return null;

            bool canEdit = item.Meeting.OrganisedByUserId == userId ||
                           item.AssignedToUserId == userId;
            if (!canEdit) return null;

            if (dto.Description != null) item.Description = dto.Description.Trim();
            if (dto.AssignedToUserId != null) item.AssignedToUserId = dto.AssignedToUserId;
            if (dto.Status != null) item.Status = dto.Status;
            if (dto.DueDate.HasValue) item.DueDate = dto.DueDate.Value.ToUniversalTime();

            await _db.SaveChangesAsync();

            string? assignedName = item.AssignedTo?.FullName;
            if (item.AssignedToUserId.HasValue && item.AssignedTo == null)
            {
                var u = await _db.Users.FindAsync(item.AssignedToUserId.Value);
                assignedName = u?.FullName;
            }

            return MapActionItem(item, assignedName);
        }

        public async Task<bool> DeleteActionItemAsync(int itemId, int userId)
        {
            var item = await _db.MeetingActionItems
                .Include(ai => ai.Meeting)
                .FirstOrDefaultAsync(ai => ai.Id == itemId);

            if (item == null) return false;
            if (item.Meeting.OrganisedByUserId != userId) return false;

            _db.MeetingActionItems.Remove(item);
            await _db.SaveChangesAsync();
            return true;
        }

        // ── Private helpers ───────────────────────────────────────────────────
        private Task<Meeting?> LoadMeeting(int meetingId) =>
            _db.Meetings
               .Include(m => m.OrganisedBy)
               .Include(m => m.Attendees).ThenInclude(a => a.User)
               .Include(m => m.ActionItems).ThenInclude(ai => ai.AssignedTo)
               .FirstOrDefaultAsync(m => m.Id == meetingId);

        private static MeetingDto MapDto(Meeting m, int currentUserId)
        {
            var myAttendee = m.Attendees.FirstOrDefault(a => a.UserId == currentUserId);
            return new MeetingDto
            {
                Id = m.Id,
                Title = m.Title,
                Agenda = m.Agenda,
                Notes = m.Notes,
                Location = m.Location,
                MeetingType = m.MeetingType,
                ScheduledAt = m.ScheduledAt,
                DurationMinutes = m.DurationMinutes,
                Status = m.Status,
                IsRecurring = m.IsRecurring,
                RecurrencePattern = m.RecurrencePattern,
                OrganisedByUserId = m.OrganisedByUserId,
                OrganisedByName = m.OrganisedBy?.FullName ?? "",
                CreatedAt = m.CreatedAt,
                MyResponse = myAttendee?.Response,
                IsOrganiser = m.OrganisedByUserId == currentUserId,
                Attendees = m.Attendees.Select(a => new MeetingAttendeeDto
                {
                    UserId = a.UserId,
                    FullName = a.User?.FullName ?? "",
                    ProfilePhotoUrl = a.User?.ProfilePhotoUrl,
                    Role = a.User?.Role ?? "",
                    Response = a.Response,
                    Attended = a.Attended,
                }).ToList(),
                ActionItems = m.ActionItems
                    .OrderBy(ai => ai.CreatedAt)
                    .Select(ai => MapActionItem(ai, ai.AssignedTo?.FullName))
                    .ToList(),
            };
        }

        private static MeetingActionItemDto MapActionItem(MeetingActionItem ai, string? assignedName) =>
            new()
            {
                Id = ai.Id,
                Description = ai.Description,
                AssignedToUserId = ai.AssignedToUserId,
                AssignedToUserName = assignedName,
                Status = ai.Status,
                DueDate = ai.DueDate,
                CreatedAt = ai.CreatedAt,
            };
    }
}
