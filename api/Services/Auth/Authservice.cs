using DailyTrackerAPI.Data;
using DailyTrackerAPI.DTOs;
using DailyTrackerAPI.Helpers;
using DailyTrackerAPI.Models.Auth;
using Microsoft.EntityFrameworkCore;

namespace DailyTrackerAPI.Services.Auth
{
    public interface IAuthService
    {
        Task<AuthResponseDto?> RegisterAsync(RegisterDto dto);
        Task<AuthResponseDto?> LoginAsync(LoginDto dto);
        Task<List<UserDto>> GetAllUsersAsync();
    }

    public class AuthService : IAuthService
    {
        private readonly AppDbContext _db;
        private readonly JwtHelper _jwt;

        public AuthService(AppDbContext db, JwtHelper jwt)
        {
            _db = db;
            _jwt = jwt;
        }

        public async Task<AuthResponseDto?> RegisterAsync(RegisterDto dto)
        {
            if (await _db.Users.AnyAsync(u => u.Email == dto.Email))
                return null;

            var user = new User
            {
                FullName = dto.FullName,
                Email = dto.Email,
               // Role = dto.Role,
                PasswordHash = BCrypt.Net.BCrypt.HashPassword(dto.Password)
            };

            _db.Users.Add(user);
            await _db.SaveChangesAsync();

            var (token, expiry) = _jwt.GenerateAccessToken(user);

            return new AuthResponseDto
            {
                Token = token,
                Expiry = expiry, // if your DTO has this
                User = MapUserDto(user)
            };
        }

        public async Task<AuthResponseDto?> LoginAsync(LoginDto dto)
        {
            var user = await _db.Users
                .FirstOrDefaultAsync(u => u.Email == dto.Email && u.IsActive);

            if (user == null || !BCrypt.Net.BCrypt.Verify(dto.Password, user.PasswordHash))
                return null;

            var (token, expiry) = _jwt.GenerateAccessToken(user);

            return new AuthResponseDto
            {
                Token = token,
                Expiry = expiry, // if DTO supports it
                User = MapUserDto(user)
            };
        }

        public async Task<List<UserDto>> GetAllUsersAsync()
        {
            return await _db.Users
                .Where(u => u.IsActive)
                .Select(u => MapUserDto(u))
                .ToListAsync();
        }

        private static UserDto MapUserDto(User u) => new()
        {
            Id = u.Id,
            FullName = u.FullName,
            Email = u.Email,
            Role = u.Role,
            IsActive = u.IsActive,
            Department = u.Department,
            Designation = u.Designation,
            ProfilePhotoUrl = u.ProfilePhotoUrl
        };
    }
}
