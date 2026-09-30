using DailyTrackerAPI.Data;
using DailyTrackerAPI.DTOs;
using DailyTrackerAPI.Helpers;
using DailyTrackerAPI.Models.Auth;
using DailyTrackerAPI.Services.Storage;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace DailyTrackerAPI.Controllers.Auth
{
    // ─── Profile & Directory Controller ──────────────────────────────────────
    // GET    /api/profile/me              → current user's full profile
    // PUT    /api/profile/me              → edit own profile
    // POST   /api/profile/me/photo        → upload/replace avatar (multipart)
    // DELETE /api/profile/me/photo        → remove avatar
    // GET    /api/profile/directory       → all active employees
    // GET    /api/profile/{userId}        → single employee profile
    // PUT    /api/profile/{userId}/admin  → manager edits dept/designation/joindate
    [ApiController, Route("api/profile"), Authorize]
    public class ProfileController : ControllerBase
    {
        private readonly AppDbContext _db;
        private readonly IFileStorage _files;

        public ProfileController(AppDbContext db, IFileStorage files)
        {
            _db = db;
            _files = files;
        }

        [HttpGet("me")]
        public async Task<IActionResult> GetMyProfile()
        {
            var userId = User.GetUserId();
            var user = await _db.Users.Include(u => u.Manager)
                                        .FirstOrDefaultAsync(u => u.Id == userId);
            if (user == null) return NotFound();
            return Ok(MapProfile(user));
        }

        // ── Uses UpdateProfileDto (the name already in your AllDtos.cs) ───────
        [HttpPut("me")]
        public async Task<IActionResult> UpdateMyProfile([FromBody] UpdateProfileDto dto)
        {
            var userId = User.GetUserId();
            var user = await _db.Users.FindAsync(userId);
            if (user == null) return NotFound();

            if (!string.IsNullOrWhiteSpace(dto.FullName))
                user.FullName = dto.FullName.Trim();

            // only fields that were sent are changed ("" clears a field; missing = keep)
            if (dto.Phone != null) user.Phone = dto.Phone.Trim();
            if (dto.Bio != null) user.Bio = dto.Bio.Trim();
            if (dto.Designation != null) user.Designation = dto.Designation.Trim();
            if (dto.Department != null) user.Department = dto.Department.Trim();

            if (dto.JoinDate.HasValue)
                user.JoinDate = dto.JoinDate.Value.ToUniversalTime();

            await _db.SaveChangesAsync();
            return Ok(MapProfile(user));
        }

        [HttpPost("me/photo")]
        [RequestSizeLimit(5 * 1024 * 1024)]
        public async Task<IActionResult> UploadPhoto([FromForm] IFormFile photo)
        {
            if (photo == null || photo.Length == 0)
                return BadRequest(new { message = "No file provided." });

            // Judge the file by its contents, not its name or declared type
            var ext = await ImageExtensionAsync(photo);
            if (ext == null)
                return BadRequest(new { message = "Only JPEG, PNG, WEBP or GIF images allowed." });

            var userId = User.GetUserId();
            var user = await _db.Users.FindAsync(userId);
            if (user == null) return NotFound();

            if (!string.IsNullOrEmpty(user.ProfilePhotoUrl))
                await DeleteAvatarFileAsync(user.ProfilePhotoUrl);

            var fileName = $"{Guid.NewGuid():N}{ext}";
            await _files.SaveAsync($"uploads/avatars/{fileName}", photo);

            user.ProfilePhotoUrl = $"/uploads/avatars/{fileName}";
            await _db.SaveChangesAsync();

            return Ok(new { profilePhotoUrl = user.ProfilePhotoUrl });
        }

        [HttpDelete("me/photo")]
        public async Task<IActionResult> DeletePhoto()
        {
            var userId = User.GetUserId();
            var user = await _db.Users.FindAsync(userId);
            if (user == null) return NotFound();

            if (!string.IsNullOrEmpty(user.ProfilePhotoUrl))
            {
                await DeleteAvatarFileAsync(user.ProfilePhotoUrl);
                user.ProfilePhotoUrl = null;
                await _db.SaveChangesAsync();
            }
            return Ok();
        }

        [HttpGet("directory")]
        public async Task<IActionResult> GetDirectory(
            [FromQuery] string? search = null,
            [FromQuery] string? role = null,
            [FromQuery] string? department = null)
        {
            var query = _db.Users
                .Include(u => u.Manager)
                .Where(u => u.IsActive)
                .AsQueryable();

            if (!string.IsNullOrWhiteSpace(search))
            {
                var term = search.Trim().ToLower();
                query = query.Where(u =>
                    u.FullName.ToLower().Contains(term) ||
                    u.Email.ToLower().Contains(term) ||
                    (u.Designation != null && u.Designation.ToLower().Contains(term)));
            }

            if (!string.IsNullOrWhiteSpace(role))
                query = query.Where(u => u.Role == role);

            if (!string.IsNullOrWhiteSpace(department))
                query = query.Where(u => u.Department == department);

            var users = await query.OrderBy(u => u.FullName).ToListAsync();
            return Ok(users.Select(MapProfile));
        }

        [HttpGet("{userId:int}")]
        public async Task<IActionResult> GetUserProfile(int userId)
        {
            var user = await _db.Users
                .Include(u => u.Manager)
                .FirstOrDefaultAsync(u => u.Id == userId && u.IsActive);

            if (user == null) return NotFound();
            return Ok(MapProfile(user));
        }

        // ── Uses UpdateEmployeeProfileDto (added to AllDtos in this feature) ──
        [HttpPut("{userId:int}/admin"), Authorize(Roles = "Manager")]
        public async Task<IActionResult> AdminUpdateProfile(
            int userId, [FromBody] UpdateEmployeeProfileDto dto)
        {
            var user = await _db.Users
                .Include(u => u.Manager)
                .FirstOrDefaultAsync(u => u.Id == userId);

            if (user == null) return NotFound();

            if (dto.Department != null) user.Department = dto.Department.Trim();
            if (dto.Designation != null) user.Designation = dto.Designation.Trim();
            if (dto.JoinDate.HasValue) user.JoinDate = dto.JoinDate.Value.ToUniversalTime();

            if (dto.ManagerId.HasValue)
            {
                if (dto.ManagerId.Value == userId)
                    return BadRequest(new { message = "A user cannot be their own manager." });
                user.ManagerId = dto.ManagerId.Value;
            }

            await _db.SaveChangesAsync();
            return Ok(MapProfile(user));
        }

        // ── Helpers ───────────────────────────────────────────────────────────
        private static UserProfileDto MapProfile(User u) => new()
        {
            Id = u.Id,
            FullName = u.FullName,
            Email = u.Email,
            Role = u.Role,
            IsActive = u.IsActive,
            Department = u.Department,
            Designation = u.Designation,
            Phone = u.Phone,
            Bio = u.Bio,
            ProfilePhotoUrl = u.ProfilePhotoUrl,
            JoinDate = u.JoinDate,
            CreatedAt = u.CreatedAt,
            ManagerId = u.ManagerId,
            ManagerName = u.Manager?.FullName
        };

        private async Task DeleteAvatarFileAsync(string relativeUrl)
        {
            try { await _files.DeleteAsync(relativeUrl.TrimStart('/')); }
            catch { /* an old photo that's already gone is fine */ }
        }
    
        /// <summary>".jpg" / ".png" / ".gif" / ".webp" from the file's first bytes; null if it isn't one</summary>
        private static async Task<string?> ImageExtensionAsync(IFormFile file)
        {
            var head = new byte[12];
            await using var stream = file.OpenReadStream();
            var read = await stream.ReadAtLeastAsync(head, head.Length, throwOnEndOfStream: false);
            if (read >= 3 && head[0] == 0xFF && head[1] == 0xD8 && head[2] == 0xFF) return ".jpg";
            if (read >= 8 && head[0] == 0x89 && head[1] == 0x50 && head[2] == 0x4E && head[3] == 0x47) return ".png";
            if (read >= 6 && head[0] == 'G' && head[1] == 'I' && head[2] == 'F' && head[3] == '8') return ".gif";
            if (read >= 12 && head[0] == 'R' && head[1] == 'I' && head[2] == 'F' && head[3] == 'F'
                && head[8] == 'W' && head[9] == 'E' && head[10] == 'B' && head[11] == 'P') return ".webp";
            return null;
        }
    }

}