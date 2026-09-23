using DailyTrackerAPI.Data;
using DailyTrackerAPI.DTOs;
using DailyTrackerAPI.Models;
using DailyTrackerAPI.Models.Auth;
using Microsoft.EntityFrameworkCore;
using OtpNet;
using QRCoder;
using System.Security.Cryptography;

namespace DailyTrackerAPI.Services.Auth
{
    /// <summary>
    /// Two-Factor Authentication service using TOTP (Time-based One-Time Password).
    /// Compatible with Google Authenticator, Microsoft Authenticator, Authy, etc.
    /// </summary>
    public interface ITwoFactorService
    {
        /// <summary>Generates a TOTP secret and QR code for the user to scan. Does NOT enable 2FA until verified.</summary>
        Task<Setup2FAResponseDto> SetupTotpAsync(int userId, string email);
        /// <summary>Verifies the TOTP code and enables 2FA for the user.</summary>
        Task EnableTotpAsync(int userId, string code);
        /// <summary>Verifies TOTP code during login. Returns true if valid.</summary>
        Task<bool> VerifyTotpAsync(int userId, string code);
        /// <summary>Disables 2FA after verifying the current code.</summary>
        Task DisableTotpAsync(int userId, string code);
        /// <summary>Checks if user has TOTP 2FA enabled.</summary>
        Task<bool> IsTwoFactorEnabledAsync(int userId);
        /// <summary>Creates a pending login session and returns temp token when 2FA is required.</summary>
        Task<string> CreatePendingLoginAsync(User user, string? ipAddress);
        /// <summary>Validates temp token and returns user if valid and not expired.</summary>
        Task<User?> ValidatePendingLoginAsync(string tempToken);
        /// <summary>Invalidates the pending login after successful 2FA verification.</summary>
        Task ConsumePendingLoginAsync(string tempToken);
        /// <summary>Optional: Trust this device to skip 2FA for 30 days.</summary>
        Task TrustDeviceAsync(int userId, string deviceToken, string deviceName, string? ipAddress);
        /// <summary>Check if device is trusted.</summary>
        Task<bool> IsDeviceTrustedAsync(int userId, string deviceToken);
    }

    public class TwoFactorService : ITwoFactorService
    {
        private readonly AppDbContext _db;
        private readonly IConfiguration _config;

        public TwoFactorService(AppDbContext db, IConfiguration config)
        {
            _db = db;
            _config = config;
        }

        public async Task<Setup2FAResponseDto> SetupTotpAsync(int userId, string email)
        {
            var secret = new byte[20];
            using (var rng = RandomNumberGenerator.Create())
                rng.GetBytes(secret);

            var base32Secret = OtpNet.Base32Encoding.ToString(secret);

            var twoFactor = await _db.UserTwoFactors.FirstOrDefaultAsync(t => t.UserId == userId);
            if (twoFactor == null)
            {
                twoFactor = new UserTwoFactor { UserId = userId };
                _db.UserTwoFactors.Add(twoFactor);
            }

            twoFactor.TotpSecretKey = base32Secret;
            twoFactor.TotpEnabled = false; // Not enabled until verified
            twoFactor.UpdatedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync();

            var appName = _config["Jwt:Issuer"] ?? "DailyTracker";
            var totpUri = $"otpauth://totp/{Uri.EscapeDataString(appName)}:{Uri.EscapeDataString(email)}?secret={base32Secret}&issuer={Uri.EscapeDataString(appName)}";

            var qrGenerator = new QRCodeGenerator();
            var qrCodeData = qrGenerator.CreateQrCode(totpUri, QRCodeGenerator.ECCLevel.Q);
            var qrCode = new PngByteQRCode(qrCodeData);
            var qrBytes = qrCode.GetGraphic(20);

            return new Setup2FAResponseDto
            {
                ManualEntryKey = base32Secret,
                QrCodeBase64 = Convert.ToBase64String(qrBytes),
                Message = "Scan the QR code with Google Authenticator or any TOTP app, then call verify-2fa-setup with the 6-digit code."
            };
        }

        public async Task EnableTotpAsync(int userId, string code)
        {
            var twoFactor = await _db.UserTwoFactors.FirstOrDefaultAsync(t => t.UserId == userId)
                ?? throw new InvalidOperationException("2FA setup not initiated. Call setup-2fa first.");

            if (string.IsNullOrEmpty(twoFactor.TotpSecretKey))
                throw new InvalidOperationException("2FA setup not initiated. Call setup-2fa first.");

            if (!VerifyCode(twoFactor.TotpSecretKey, code))
                throw new UnauthorizedAccessException("Invalid verification code. Please try again.");

            twoFactor.TotpEnabled = true;
            twoFactor.LastVerifiedAt = DateTime.UtcNow;
            twoFactor.UpdatedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync();
        }

        public async Task<bool> VerifyTotpAsync(int userId, string code)
        {
            var twoFactor = await _db.UserTwoFactors
                .FirstOrDefaultAsync(t => t.UserId == userId && t.TotpEnabled);

            if (twoFactor == null || string.IsNullOrEmpty(twoFactor.TotpSecretKey))
                return false;

            return VerifyCode(twoFactor.TotpSecretKey, code);
        }

        public async Task DisableTotpAsync(int userId, string code)
        {
            var twoFactor = await _db.UserTwoFactors.FirstOrDefaultAsync(t => t.UserId == userId)
                ?? throw new InvalidOperationException("2FA is not enabled.");

            if (!twoFactor.TotpEnabled)
                throw new InvalidOperationException("2FA is not enabled.");

            if (!VerifyCode(twoFactor.TotpSecretKey!, code))
                throw new UnauthorizedAccessException("Invalid code. 2FA was not disabled.");

            twoFactor.TotpEnabled = false;
            twoFactor.TotpSecretKey = null;
            twoFactor.TotpBackupCodes = null;
            twoFactor.UpdatedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync();
        }

        public async Task<bool> IsTwoFactorEnabledAsync(int userId)
        {
            return await _db.UserTwoFactors
                .AnyAsync(t => t.UserId == userId && t.TotpEnabled);
        }

        public async Task<string> CreatePendingLoginAsync(User user, string? ipAddress)
        {
            var tempToken = GenerateSecureToken();
            var pending = new PendingLogin
            {
                UserId = user.Id,
                TempToken = tempToken,
                IpAddress = ipAddress,
                ExpiresAt = DateTime.UtcNow.AddMinutes(5)
            };
            _db.PendingLogins.Add(pending);
            await _db.SaveChangesAsync();
            return tempToken;
        }

        public async Task<User?> ValidatePendingLoginAsync(string tempToken)
        {
            var pending = await _db.PendingLogins
                .Include(p => p.User)
                .FirstOrDefaultAsync(p => p.TempToken == tempToken && !p.IsUsed);

            if (pending == null || pending.ExpiresAt < DateTime.UtcNow)
                return null;

            return pending.User;
        }

        public async Task ConsumePendingLoginAsync(string tempToken)
        {
            var pending = await _db.PendingLogins.FirstOrDefaultAsync(p => p.TempToken == tempToken);
            if (pending != null)
            {
                pending.IsUsed = true;
                await _db.SaveChangesAsync();
            }
        }

        public async Task TrustDeviceAsync(int userId, string deviceToken, string deviceName, string? ipAddress)
        {
            _db.TrustedDevices.Add(new TrustedDevice
            {
                UserId = userId,
                DeviceToken = deviceToken,
                DeviceName = deviceName,
                IpAddress = ipAddress ?? "",
                ExpiresAt = DateTime.UtcNow.AddDays(30)
            });
            await _db.SaveChangesAsync();
        }

        public async Task<bool> IsDeviceTrustedAsync(int userId, string deviceToken)
        {
            return await _db.TrustedDevices
                .AnyAsync(t => t.UserId == userId && t.DeviceToken == deviceToken
                    && !t.IsRevoked && t.ExpiresAt > DateTime.UtcNow);
        }

        private static bool VerifyCode(string base32Secret, string code)
        {
            if (string.IsNullOrWhiteSpace(code) || code.Length != 6)
                return false;

            try
            {
                var secretBytes = Base32Encoding.ToBytes(base32Secret);
                var totp = new Totp(secretBytes, step: 30); // 30-second window
                return totp.VerifyTotp(code, out _, new VerificationWindow(1, 1)); // Allow 1 step before/after for clock drift
            }
            catch
            {
                return false;
            }
        }

        private static string GenerateSecureToken()
        {
            var bytes = new byte[48];
            using var rng = RandomNumberGenerator.Create();
            rng.GetBytes(bytes);
            return Convert.ToBase64String(bytes).Replace("+", "-").Replace("/", "_").TrimEnd('=');
        }
    }
}
