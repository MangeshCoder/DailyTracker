using DailyTrackerAPI.Data;
using DailyTrackerAPI.DTOs;
using DailyTrackerAPI.Helpers;
using System.Security.Cryptography;
using Microsoft.EntityFrameworkCore;
using DailyTrackerAPI.Models.Auth;

namespace DailyTrackerAPI.Services.Auth
{
    // ─────────────────────────────────────────────────────────────────────────
    //  Feature 11: Refresh Token Service + 2FA
    // ─────────────────────────────────────────────────────────────────────────
    public interface IRefreshTokenService
    {
        Task<AuthResponseV2Dto> RegisterAsync(RegisterDto dto, string? ipAddress);
        Task<LoginResponseDto> LoginAsync(string email, string password, string? ipAddress, string? deviceToken = null);
        Task<AuthResponseV2Dto> Verify2FAAndLoginAsync(string tempToken, string code, string? ipAddress);
        Task<AuthResponseV2Dto> RefreshAsync(string refreshToken, string? ipAddress);
        Task<LoginResponseDto> LoginWithEmailAsync(string email, string? ipAddress);
        Task RevokeAsync(string refreshToken);
        Task RevokeAllForUserAsync(int userId);
        // 2FA setup/management (delegates to TwoFactorService)
        Task<Setup2FAResponseDto> SetupTotpAsync(int userId, string email);
        Task EnableTotpAsync(int userId, string code);
        Task DisableTotpAsync(int userId, string code);
        Task TrustDeviceAsync(int userId, string deviceToken, string deviceName, string? ipAddress);
        Task<bool> IsTwoFactorEnabledAsync(int userId);
    }

    public class RefreshTokenService : IRefreshTokenService
    {
        private readonly AppDbContext _db;
        private readonly JwtHelper _jwt;
        private readonly ITwoFactorService _twoFactor;

        public RefreshTokenService(AppDbContext db, JwtHelper jwt, ITwoFactorService twoFactor)
        {
            _db = db;
            _jwt = jwt;
            _twoFactor = twoFactor;
        }

        //public async Task<AuthResponseV2Dto> RegisterAsync(RegisterDto dto, string? ipAddress)
        //{
        //    if (await _db.Users.AnyAsync(u => u.Email == dto.Email))
        //        throw new Exception("Email already exists.");

        //    int? managerId = null;

        //    // Auto-assign default manager for Developer / TeamLead
        //    if (dto.Role == "Developer" || dto.Role == "TeamLead")
        //    {
        //        var defaultManager = await _db.Users
        //            .Where(u => u.Role == "Manager")
        //            .OrderBy(u => u.Id) // first manager
        //            .FirstOrDefaultAsync();

        //        if (defaultManager == null)
        //            throw new Exception("No manager available. Please create a manager first.");

        //        managerId = defaultManager.Id;
        //    }

        //    var user = new User
        //    {
        //        FullName = dto.FullName,
        //        Email = dto.Email,
        //        Role = dto.Role,
        //        ManagerId = managerId,
        //        PasswordHash = BCrypt.Net.BCrypt.HashPassword(dto.Password),
        //        IsActive = true
        //    };

        //    _db.Users.Add(user);
        //    await _db.SaveChangesAsync();

        //    return await GenerateTokensAsync(user, ipAddress);
        //}

        public async Task<AuthResponseV2Dto> RegisterAsync(RegisterDto dto, string? ipAddress)
        {
            if (await _db.Users.AnyAsync(u => u.Email == dto.Email))
                throw new Exception("Email already exists.");

            var anyUserExists = await _db.Users.AnyAsync();

            string role = "Pending";   // Default role
            int? managerId = null;

            // ✅ First user becomes Manager automatically
            if (!anyUserExists)
            {
                role = "Manager";
            }

            var user = new User
            {
                FullName = dto.FullName,
                Email = dto.Email,
                Role = role,
                ManagerId = managerId,
                PasswordHash = BCrypt.Net.BCrypt.HashPassword(dto.Password),
                IsActive = true,
                CreatedAt = DateTime.UtcNow
            };

            _db.Users.Add(user);
            await _db.SaveChangesAsync();

            return await GenerateTokensAsync(user, ipAddress);
        }

        public async Task<LoginResponseDto> LoginAsync(string email, string password, string? ipAddress, string? deviceToken = null)
        {
            var user = await _db.Users.FirstOrDefaultAsync(u => u.Email == email && u.IsActive)
                ?? throw new UnauthorizedAccessException("Invalid email or password.");

            if (!BCrypt.Net.BCrypt.Verify(password, user.PasswordHash))
                throw new UnauthorizedAccessException("Invalid email or password.");

            if (user == null)
                throw new UnauthorizedAccessException("Invalid credentials.");

            if (!user.IsActive)
                throw new UnauthorizedAccessException("Your account is deactivated. Contact manager.");

            // Check if 2FA is enabled
            var twoFactorEnabled = await _twoFactor.IsTwoFactorEnabledAsync(user.Id);
            await RevokeAllForUserAsync(user.Id);

            if (twoFactorEnabled)
            {
                // Check trusted device - skip 2FA if device was previously trusted
                if (!string.IsNullOrEmpty(deviceToken) && await _twoFactor.IsDeviceTrustedAsync(user.Id, deviceToken))
                {
                    return new LoginResponseDto
                    {
                        RequiresTwoFactor = false,

                        Tokens = await GenerateTokensAsync(user, ipAddress)
                    };
                }

                // Require 2FA: create pending login, return temp token
                var tempToken = await _twoFactor.CreatePendingLoginAsync(user, ipAddress);
                return new LoginResponseDto
                {
                    RequiresTwoFactor = true,
                    TempToken = tempToken,
                    Message = "Enter the 6-digit code from your authenticator app."
                };
            }

            return new LoginResponseDto
            {
                RequiresTwoFactor = false,
                Tokens = await GenerateTokensAsync(user, ipAddress)
            };
        }

        public async Task<AuthResponseV2Dto> Verify2FAAndLoginAsync(string tempToken, string code, string? ipAddress)
        {
            var user = await _twoFactor.ValidatePendingLoginAsync(tempToken)
                ?? throw new UnauthorizedAccessException("Invalid or expired verification session. Please login again.");

            if (!await _twoFactor.VerifyTotpAsync(user.Id, code))
                throw new UnauthorizedAccessException("Invalid verification code.");

            await _twoFactor.ConsumePendingLoginAsync(tempToken);

            return await GenerateTokensAsync(user, ipAddress);
        }

        public async Task<AuthResponseV2Dto> RefreshAsync(string refreshToken, string? ipAddress)
        {
            var token = await _db.RefreshTokens
                .Include(r => r.User)
                .FirstOrDefaultAsync(r => r.Token == refreshToken)
                ?? throw new UnauthorizedAccessException("Invalid refresh token.");

            if (token.IsRevoked)
                throw new UnauthorizedAccessException("Refresh token has been revoked.");

            if (token.ExpiresAt < DateTime.UtcNow)
                throw new UnauthorizedAccessException("Refresh token has expired.");

            // Rotate: revoke old, issue new
            token.IsRevoked = true;
            _db.RefreshTokens.Update(token);
            await _db.SaveChangesAsync();

            return await GenerateTokensAsync(token.User, ipAddress);
        }

        public async Task<LoginResponseDto> LoginWithEmailAsync(string email, string? ipAddress)
        {
            var user = await _db.Users
                .FirstOrDefaultAsync(u => u.Email == email);

            if (user == null)
                throw new UnauthorizedAccessException("Invalid credentials.");

            if (!user.IsActive)
                throw new UnauthorizedAccessException("Your account is deactivated. Contact manager.");

            // 🔥 ADD THIS
            await RevokeAllForUserAsync(user.Id);

            var twoFactorEnabled = await _twoFactor.IsTwoFactorEnabledAsync(user.Id);

            if (twoFactorEnabled)
            {
                var tempToken = await _twoFactor.CreatePendingLoginAsync(user, ipAddress);

                return new LoginResponseDto
                {
                    RequiresTwoFactor = true,
                    TempToken = tempToken,
                    Message = "Enter the 6-digit code from your authenticator app."
                };
            }

            return new LoginResponseDto
            {
                RequiresTwoFactor = false,
                Tokens = await GenerateTokensAsync(user, ipAddress)
            };
        }

        public async Task RevokeAsync(string refreshToken)
        {
            var token = await _db.RefreshTokens.FirstOrDefaultAsync(r => r.Token == refreshToken);
            if (token != null)
            {
                token.IsRevoked = true;
                await _db.SaveChangesAsync();
            }
        }

        public async Task RevokeAllForUserAsync(int userId)
        {
            var tokens = await _db.RefreshTokens
                .Where(r => r.UserId == userId && !r.IsRevoked)
                .ToListAsync();

            foreach (var t in tokens) t.IsRevoked = true;
            await _db.SaveChangesAsync();
        }

        private async Task<AuthResponseV2Dto> GenerateTokensAsync(User user, string? ipAddress)
        {
            var (accessToken, expiry) = _jwt.GenerateAccessToken(user);
            var refreshToken = GenerateSecureToken();

            _db.RefreshTokens.Add(new RefreshToken
            {
                UserId = user.Id,
                Token = refreshToken,
                ExpiresAt = DateTime.UtcNow.AddDays(30),
                CreatedByIp = ipAddress
            });

            await _db.SaveChangesAsync();

            return new AuthResponseV2Dto
            {
                AccessToken = accessToken,
                RefreshToken = refreshToken,
                AccessTokenExpiry = expiry,
                User = new UserDto { Id = user.Id, FullName = user.FullName, Email = user.Email, Role = user.Role }
            };
        }

        private static string GenerateSecureToken()
        {
            var bytes = new byte[64];
            using var rng = RandomNumberGenerator.Create();
            rng.GetBytes(bytes);
            return Convert.ToBase64String(bytes);
        }

        public Task<Setup2FAResponseDto> SetupTotpAsync(int userId, string email) => _twoFactor.SetupTotpAsync(userId, email);
        public Task EnableTotpAsync(int userId, string code) => _twoFactor.EnableTotpAsync(userId, code);
        public Task DisableTotpAsync(int userId, string code) => _twoFactor.DisableTotpAsync(userId, code);
        public Task TrustDeviceAsync(int userId, string deviceToken, string deviceName, string? ipAddress) => _twoFactor.TrustDeviceAsync(userId, deviceToken, deviceName, ipAddress);
        public Task<bool> IsTwoFactorEnabledAsync(int userId) => _twoFactor.IsTwoFactorEnabledAsync(userId);
    }
}
