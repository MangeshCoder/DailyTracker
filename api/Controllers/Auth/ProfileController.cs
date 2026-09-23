using DailyTrackerAPI.Data;
using DailyTrackerAPI.DTOs;
using DailyTrackerAPI.Helpers;
using DailyTrackerAPI.Models.Auth;
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
        private readonly IWebHostEnvironment _env;

        public ProfileController(AppDbContext db, IWebHostEnvironment env)
        {
            _db = db;
            _env = env;
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

            user.Phone = dto.Phone?.Trim();
            user.Bio = dto.Bio?.Trim();
            user.Designation = dto.Designation?.Trim();
            user.Department = dto.Department?.Trim();

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

            var allowed = new[] { "image/jpeg", "image/png", "image/webp", "image/gif" };
            if (!allowed.Contains(photo.ContentType))
                return BadRequest(new { message = "Only JPEG, PNG, WEBP or GIF images allowed." });

            var userId = User.GetUserId();
            var user = await _db.Users.FindAsync(userId);
            if (user == null) return NotFound();

            if (!string.IsNullOrEmpty(user.ProfilePhotoUrl))
                DeleteAvatarFile(user.ProfilePhotoUrl);

            var ext = Path.GetExtension(photo.FileName).ToLowerInvariant();
            if (string.IsNullOrEmpty(ext)) ext = ".jpg";
            var fileName = $"{Guid.NewGuid():N}{ext}";
            var uploadDir = Path.Combine(GetWebRoot(), "uploads", "avatars");
            Directory.CreateDirectory(uploadDir);

            await using (var stream = new FileStream(Path.Combine(uploadDir, fileName), FileMode.Create))
                await photo.CopyToAsync(stream);

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
                DeleteAvatarFile(user.ProfilePhotoUrl);
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

        private string GetWebRoot() =>
            _env.WebRootPath ?? Path.Combine(_env.ContentRootPath, "wwwroot");

        private void DeleteAvatarFile(string relativeUrl)
        {
            var relativePath = relativeUrl.TrimStart('/').Replace('/', Path.DirectorySeparatorChar);
            var fullPath = Path.Combine(GetWebRoot(), relativePath);
            if (System.IO.File.Exists(fullPath))
                System.IO.File.Delete(fullPath);
        }
    }
}