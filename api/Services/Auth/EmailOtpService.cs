using DailyTrackerAPI.Data;
using DailyTrackerAPI.Models;
using DailyTrackerAPI.Models.Auth;
using Microsoft.EntityFrameworkCore;
using System.Security.Cryptography;

namespace DailyTrackerAPI.Services.Auth
{
    public interface IEmailOtpService
    {
        Task SendOtpAsync(string email, string purpose);
        Task<bool> VerifyOtpAsync(string email, string code, string purpose);
    }
    public class EmailOtpService : IEmailOtpService
    {
        private readonly AppDbContext _db;
        private readonly IEmailService _email;

        public EmailOtpService(AppDbContext db, IEmailService email)
        {
            _db = db;
            _email = email;
        }

        public async Task SendOtpAsync(string email, string purpose)
        {
            var code = GenerateOtp();

            _db.EmailOtps.Add(new EmailOtp
            {
                Email = email,
                Code = code,
                Purpose = purpose,
                ExpiresAt = DateTime.UtcNow.AddMinutes(5)
            });

            await _db.SaveChangesAsync();
            await _email.SendOtpEmailAsync(email, code, purpose);
        }

        private static string GenerateOtp()
        {
            var bytes = new byte[4];
            using var rng = RandomNumberGenerator.Create();
            rng.GetBytes(bytes);
            var number = BitConverter.ToUInt32(bytes, 0) % 900000 + 100000;
            return number.ToString();
        }

        public async Task<bool> VerifyOtpAsync(string email, string code, string purpose)
        {
            var otp = await _db.EmailOtps
                .FirstOrDefaultAsync(o =>
                    o.Email == email &&
                    o.Code == code &&
                    o.Purpose == purpose &&
                    !o.IsUsed &&
                    o.ExpiresAt > DateTime.UtcNow);

            if (otp == null) return false;

            otp.IsUsed = true;
            await _db.SaveChangesAsync();
            return true;
        }
    }
}
