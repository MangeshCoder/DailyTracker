using DailyTrackerAPI.Data;
using DailyTrackerAPI.DTOs;
using DailyTrackerAPI.Helpers;
using DailyTrackerAPI.Services.Auth;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace DailyTrackerAPI.Controllers.Auth
{
    [ApiController]
    [Route("api/[controller]")]
    public class AuthController : ControllerBase
    {
        private readonly IAuthService _authService;
        private readonly IRefreshTokenService _authSvc;
        private readonly IEmailOtpService _emailOtp;
        private readonly IEmailService _emailService;
        private readonly AppDbContext _db;

        public AuthController(IAuthService authService, IRefreshTokenService authSvc, IEmailOtpService emailOtp, IEmailService emailService, AppDbContext db)
        {
            _authService = authService;
            _authSvc = authSvc;
            _emailOtp = emailOtp;
            _emailService = emailService;
            _db = db;
        }

        /// <summary>
        /// Register new user
        /// </summary>
        /// <param name="dto"></param>
        /// <returns></returns>
        [HttpPost("register")]
        public async Task<IActionResult> Register([FromBody] RegisterDto dto)
        {
            try
            {
                var ip = HttpContext.Connection.RemoteIpAddress?.ToString();
                var result = await _authSvc.RegisterAsync(dto, ip);
                return Ok(result);
            }
            catch (Exception ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }

        /// <summary>
        /// Get all users data
        /// </summary>
        /// <returns></returns>
        [Authorize]
        [HttpGet("users")]
        public async Task<IActionResult> GetAllUsers()
        {
            var users = await _authService.GetAllUsersAsync();
            return Ok(users);
        }

        /// <summary>
        /// Login user 
        /// </summary>
        /// <param name="dto"></param>
        /// <param name="deviceToken"></param>
        /// <returns></returns>
        [HttpPost("login")]
        public async Task<IActionResult> Login([FromBody] LoginDto dto, [FromHeader(Name = "X-Device-Token")] string? deviceToken = null)
        {
            try
            {
                var ip = HttpContext.Connection.RemoteIpAddress?.ToString();
                var result = await _authSvc.LoginAsync(dto.Email, dto.Password, ip, deviceToken);
                if (!result.RequiresTwoFactor)
                {
                    SetAuthCookies(result.Tokens);
                }
                return Ok(result);
            }
            catch (UnauthorizedAccessException ex) { return Unauthorized(new { message = ex.Message }); }
        }

        /// <summary>
        /// Complete login when 2FA is required. Send the TempToken from login + the 6-digit code.
        /// </summary>
        /// <param name="dto"></param>
        /// <returns></returns>
        [HttpPost("verify-2fa-login")]
        public async Task<IActionResult> Verify2FALogin([FromBody] Verify2FALoginDto dto)
        {
            try
            {
                var ip = HttpContext.Connection.RemoteIpAddress?.ToString();
                var result = await _authSvc.Verify2FAAndLoginAsync(dto.TempToken, dto.Code, ip);
                SetAuthCookies(result);
                return Ok(result);
            }
            catch (UnauthorizedAccessException ex) { return Unauthorized(new { message = ex.Message }); }
        }

        /// <summary>
        /// Get QR code to set up 2FA. Requires Bearer token. Call verify-2fa-setup to enable.
        /// </summary>
        /// <returns></returns>
        [Authorize]
        [HttpPost("setup-2fa")]
        public async Task<IActionResult> Setup2FA()
        {
            try
            {
                var userId = User.GetUserId();
                if (userId <= 0) return Unauthorized();

                var email = User.FindFirst(System.Security.Claims.ClaimTypes.Email)?.Value ?? "";
                var result = await _authSvc.SetupTotpAsync(userId, email);
                return Ok(result);
            }
            catch (Exception ex) { return BadRequest(new { message = ex.Message }); }
        }

        /// <summary>
        /// Verify the 6-digit code from authenticator app to enable 2FA.
        /// </summary>
        /// <param name="dto"></param>
        /// <returns></returns>
        [Authorize]
        [HttpPost("verify-2fa-setup")]
        public async Task<IActionResult> Verify2FASetup([FromBody] Verify2FASetupDto dto)
        {
            try
            {
                var userId = User.GetUserId();
                if (userId <= 0) return Unauthorized();

                await _authSvc.EnableTotpAsync(userId, dto.Code);
                return Ok(new { message = "Two-factor authentication has been enabled." });
            }
            catch (UnauthorizedAccessException ex) { return Unauthorized(new { message = ex.Message }); }
            catch (Exception ex) { return BadRequest(new { message = ex.Message }); }
        }

        /// <summary>
        /// Disable 2FA. Requires current 6-digit code to verify identity
        /// </summary>
        /// <param name="dto"></param>
        /// <returns></returns>
        [Authorize]
        [HttpPost("disable-2fa")]
        public async Task<IActionResult> Disable2FA([FromBody] Disable2FADto dto)
        {
            try
            {
                var userId = User.GetUserId();
                if (userId <= 0) return Unauthorized();

                await _authSvc.DisableTotpAsync(userId, dto.Code);
                return Ok(new { message = "Two-factor authentication has been disabled." });
            }
            catch (UnauthorizedAccessException ex) { return Unauthorized(new { message = ex.Message }); }
            catch (Exception ex) { return BadRequest(new { message = ex.Message }); }
        }

        /// <summary>
        /// Check if current user has 2FA enabled.
        /// </summary>
        /// <returns></returns>
        [Authorize]
        [HttpGet("2fa-status")]
        public async Task<IActionResult> Get2FAStatus()
        {
            var userId = User.GetUserId();
            if (userId <= 0) return Unauthorized();
            var enabled = await _authSvc.IsTwoFactorEnabledAsync(userId);
            return Ok(new { twoFactorEnabled = enabled });
        }

        /// <summary>
        /// Trust this device to skip 2FA for 30 days. Requires Bearer token. Pass deviceToken in body.
        /// </summary>
        /// <param name="dto"></param>
        /// <returns></returns>
        [Authorize]
        [HttpPost("trust-device")]
        public async Task<IActionResult> TrustDevice([FromBody] TrustDeviceRequest dto)
        {
            try
            {
                var userId = User.GetUserId();
                if (userId <= 0) return Unauthorized();

                var deviceToken = !string.IsNullOrEmpty(dto.DeviceToken) ? dto.DeviceToken : Guid.NewGuid().ToString();
                var ip = HttpContext.Connection.RemoteIpAddress?.ToString();
                await _authSvc.TrustDeviceAsync(userId, deviceToken, dto.DeviceName ?? "Unknown", ip);
                return Ok(new { message = "Device trusted for 30 days. 2FA will be skipped on this device." });
            }
            catch (Exception ex) { return BadRequest(new { message = ex.Message }); }
        }

        /// <summary>
        /// Get refresh token
        /// </summary>
        /// <param name="dto"></param>
        /// <returns></returns>
        [HttpPost("refresh")]
        public async Task<IActionResult> Refresh()
        {
            try
            {
                var refreshToken = Request.Cookies["refreshToken"];
                if (string.IsNullOrEmpty(refreshToken))
                    return Unauthorized();

                var ip = HttpContext.Connection.RemoteIpAddress?.ToString();
                var result = await _authSvc.RefreshAsync(refreshToken, ip);

                SetAuthCookies(result);

                return Ok(new { user = result.User });
            }
            catch (UnauthorizedAccessException ex)
            {
                return Unauthorized(new { message = ex.Message });
            }
        }

        /// <summary>
        /// Revoke token
        /// </summary>
        /// <param name="dto"></param>
        /// <returns></returns>
        [HttpPost("revoke"), Authorize]
        public async Task<IActionResult> Revoke([FromBody] RefreshTokenRequestDto dto)
        {
            await _authSvc.RevokeAsync(dto.RefreshToken);
            return Ok(new { message = "Token revoked." });
        }

        /// <summary>
        /// Logou user 
        /// </summary>
        /// <returns></returns>
        [HttpPost("logout"), Authorize]
        public async Task<IActionResult> Logout()
        {
            await _authSvc.RevokeAllForUserAsync(User.GetUserId());
            Response.Cookies.Delete("accessToken");
            Response.Cookies.Delete("refreshToken");
            return Ok(new { message = "Logged out from all sessions." });
        }

        /// <summary>
        /// Send register user email otp 
        /// </summary>
        /// <param name="dto"></param>
        /// <returns></returns>
        [HttpPost("send-register-otp")]
        public async Task<IActionResult> SendRegisterOtp([FromBody] EmailRequestDto dto)
        {
            await _emailOtp.SendOtpAsync(dto.Email, "Register");
            return Ok(new { message = "OTP sent to email." });
        }

        /// <summary>
        /// Verify register user email otp
        /// </summary>
        /// <param name="dto"></param>
        /// <returns></returns>
        [HttpPost("verify-register-otp")]
        public async Task<IActionResult> VerifyRegisterOtp([FromBody] RegisterWithOtpDto dto)
        {
            var valid = await _emailOtp.VerifyOtpAsync(dto.Email, dto.Code, "Register");
            if (!valid)
                return BadRequest(new { message = "Invalid or expired OTP." });

            var registerDto = new RegisterDto
            {
                FullName = dto.FullName,
                Email = dto.Email,
                Password = dto.Password,
                //Role = dto.Role
            };

            var result = await _authSvc.RegisterAsync(registerDto,
                HttpContext.Connection.RemoteIpAddress?.ToString());

            await _emailService.SendWelcomeEmailAsync(dto.Email, dto.FullName);

            return Ok(result);
        }

        /// <summary>
        /// Verify login user email otp
        /// </summary>
        /// <param name="dto"></param>
        /// <returns></returns>
        [HttpPost("verify-login-otp")]
        public async Task<IActionResult> VerifyLoginOtp([FromBody] VerifyLoginOtpDto dto)
        {
            try
            {
                var valid = await _emailOtp.VerifyOtpAsync(dto.Email, dto.Code, "Login");
                if (!valid)
                    return BadRequest(new { message = "Invalid or expired OTP." });

                var result = await _authSvc.LoginWithEmailAsync(
                    dto.Email,
                    HttpContext.Connection.RemoteIpAddress?.ToString()
                );

                if (!result.RequiresTwoFactor)
                {
                    Response.Cookies.Delete("accessToken");
                    Response.Cookies.Delete("refreshToken");
                    SetAuthCookies(result.Tokens);
                    return Ok(new { user = result.Tokens.User });
                }

                return Ok(result);
            }
            catch (UnauthorizedAccessException ex)
            {
                return Unauthorized(new { message = ex.Message });
            }
        }

        /// <summary>
        /// Send email otp for forgot password
        /// </summary>
        /// <param name="dto"></param>
        /// <returns></returns>
        [HttpPost("send-forgot-password-otp")]
        public async Task<IActionResult> SendForgotPasswordOtp([FromBody] EmailRequestDto dto)
        {
            var userExists = await _db.Users.AnyAsync(u => u.Email == dto.Email);
            if (!userExists)
                return BadRequest(new { message = "User not found." });

            await _emailOtp.SendOtpAsync(dto.Email, "ForgotPassword");
            return Ok(new { message = "OTP sent to email." });
        }

        /// <summary>
        /// Send login otp to user mail address
        /// </summary>
        /// <param name="dto"></param>
        /// <returns></returns>
        [HttpPost("send-login-otp")]
        public async Task<IActionResult> SendLoginOtp([FromBody] EmailRequestDto dto)
        {
            var userExists = await _db.Users.AnyAsync(u => u.Email == dto.Email);
            if (!userExists)
                return BadRequest(new { message = "User not found." });

            await _emailOtp.SendOtpAsync(dto.Email, "Login");
            return Ok(new { message = "OTP sent to email." });
        }


        /// <summary>
        /// Reset password
        /// </summary>
        /// <param name="dto"></param>
        /// <returns></returns>
        [HttpPost("reset-password")]
        public async Task<IActionResult> ResetPassword(ResetPasswordDto dto)
        {
            var valid = await _emailOtp.VerifyOtpAsync(dto.Email, dto.Code, "ForgotPassword");
            if (!valid) return BadRequest(new { message = "Invalid OTP" });

            var user = await _db.Users.FirstAsync(u => u.Email == dto.Email);
            user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(dto.NewPassword);
            await _db.SaveChangesAsync();

            return Ok(new { message = "Password reset successful." });
        }

        [Authorize]
        [HttpGet("me")]
        public async Task<IActionResult> Me()
        {
            var userId = User.GetUserId();

            var user = await _db.Users
                .Where(u => u.Id == userId)
                .Select(u => new
                {
                    u.Id,
                    u.FullName,
                    u.Email,
                    u.Role,
                    u.IsActive,
                    u.Department,
                    u.Designation,
                    u.ProfilePhotoUrl,
                    u.Phone,
                    u.Bio,
                    u.JoinDate
                })
                .FirstOrDefaultAsync();

            if (user == null) return NotFound();
            return Ok(user);
        }

        [Authorize(Roles = "Manager")]
        [HttpPost("assign-role")]
        public async Task<IActionResult> AssignRole(AssignRoleDto dto)
        {
            var user = await _db.Users.FindAsync(dto.UserId);
            if (user == null)
                return NotFound("User not found");

            var currentManagerId = User.GetUserId();

            if (dto.Role == "Manager")
            {
                user.Role = "Manager";
                user.ManagerId = null;
            }
            else if (dto.Role == "Developer" || dto.Role == "TeamLead")
            {
                user.Role = dto.Role;
                user.ManagerId = currentManagerId;
            }
            else
            {
                return BadRequest("Invalid role.");
            }

            await _db.SaveChangesAsync();

            return Ok("Role assigned successfully");
        }

        [Authorize(Roles = "Manager")]
        [HttpGet("pending-users")]
        public async Task<IActionResult> GetPendingUsers()
        {
            var users = await _db.Users
                .Where(u => u.Role == "Pending")
                .ToListAsync();

            return Ok(users);
        }

        //private void SetAuthCookies(AuthResponseV2Dto tokens)
        //{
        //    var accessOptions = new CookieOptions
        //    {
        //        HttpOnly = true,
        //        Secure = HttpContext.Request.IsHttps, // auto detect
        //        SameSite = SameSiteMode.None, // ⭐ required for localhost cross-origin
        //        Expires = DateTime.UtcNow.AddMinutes(15)
        //    };

        //    var refreshOptions = new CookieOptions
        //    {
        //        HttpOnly = true,
        //        Secure = HttpContext.Request.IsHttps,
        //        SameSite = SameSiteMode.None,
        //        Expires = DateTime.UtcNow.AddDays(7)
        //    };

        //    Response.Cookies.Append("accessToken", tokens.AccessToken, accessOptions);
        //    Response.Cookies.Append("refreshToken", tokens.RefreshToken, refreshOptions);
        //}

        private void SetAuthCookies(AuthResponseV2Dto tokens)
        {
            var isHttps = HttpContext.Request.IsHttps;

            // SameSite=None REQUIRES Secure=true (browser spec)
            // Over HTTP (mobile local testing): use SameSite=Lax instead
            // 192.168.1.244:5053 → 192.168.1.244:3000 = same host = Lax works fine
            var sameSite = isHttps ? SameSiteMode.None : SameSiteMode.Lax;

            var accessOptions = new CookieOptions
            {
                HttpOnly = true,
                Secure = isHttps,
                SameSite = sameSite,
                Expires = DateTime.UtcNow.AddMinutes(15)
            };

            var refreshOptions = new CookieOptions
            {
                HttpOnly = true,
                Secure = isHttps,
                SameSite = sameSite,
                Expires = DateTime.UtcNow.AddDays(7)
            };

            Response.Cookies.Append("accessToken", tokens.AccessToken, accessOptions);
            Response.Cookies.Append("refreshToken", tokens.RefreshToken, refreshOptions);
        }
    }
}