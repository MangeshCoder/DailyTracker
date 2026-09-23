using DailyTrackerAPI.Data;
using DailyTrackerAPI.DTOs;
using DailyTrackerAPI.Helpers;
using DailyTrackerAPI.Models.Face_Lock;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace DailyTrackerAPI.Controllers.Auth
{
    // ── Endpoints ──────────────────────────────────────────────────────────────
    // POST   /api/face/register          — employee registers their own face
    // POST   /api/face/register/{userId} — manager registers on behalf of employee
    // GET    /api/face/descriptor        — employee fetches their own descriptor
    // GET    /api/face/descriptor/{userId} — for another user (manager or self)
    // POST   /api/face/log-attempt       — frontend logs result after comparison
    // GET    /api/face/attempts          — employee sees their own attempt history
    // GET    /api/face/attempts/{userId} — manager sees one employee's attempts
    // GET    /api/face/attempts/team     — manager sees all team failed attempts today

    [ApiController, Route("api/face"), Authorize]
    public class FaceController : ControllerBase
    {
        private readonly AppDbContext _db;

        public FaceController(AppDbContext db) => _db = db;

        // ── Register own face ─────────────────────────────────────────────────
        [HttpPost("register")]
        public async Task<IActionResult> RegisterFace([FromBody] RegisterFaceDto dto)
        {
            var callerId = User.GetUserId();

            // Determine who is being registered
            int targetId = dto.TargetUserId.HasValue
                ? dto.TargetUserId.Value   // manager registering on behalf
                : callerId;                // self-registration

            // Only managers can register other users
            if (targetId != callerId)
            {
                var caller = await _db.Users.FindAsync(callerId);
                if (caller?.Role != "Manager")
                    return Forbid();
            }

            var user = await _db.Users.FindAsync(targetId);
            if (user == null) return NotFound(new { message = "User not found." });

            // Validate descriptor is a JSON float array with exactly 128 values
            try
            {
                var values = System.Text.Json.JsonSerializer
                    .Deserialize<float[]>(dto.Descriptor);

                if (values == null || values.Length != 128)
                    return BadRequest(new { message = "Descriptor must be an array of exactly 128 floats." });
            }
            catch
            {
                return BadRequest(new { message = "Invalid descriptor format. Expected JSON float array." });
            }

            user.FaceDescriptor = dto.Descriptor;
            user.FaceRegistered = true;
            await _db.SaveChangesAsync();

            return Ok(new
            {
                message = $"Face registered successfully for {user.FullName}.",
                faceRegistered = true,
                userId = user.Id
            });
        }

        // ── Get descriptor for face comparison ────────────────────────────────
        // Employee gets their own; manager can get any team member's
        [HttpGet("descriptor")]
        public async Task<IActionResult> GetMyDescriptor()
        {
            var userId = User.GetUserId();
            return await GetDescriptorForUser(userId);
        }

        [HttpGet("descriptor/{userId:int}")]
        public async Task<IActionResult> GetDescriptor(int userId)
        {
            var callerId = User.GetUserId();

            // Allow self-fetch OR manager fetch
            if (callerId != userId)
            {
                var caller = await _db.Users.FindAsync(callerId);
                if (caller?.Role != "Manager")
                    return Forbid();
            }

            return await GetDescriptorForUser(userId);
        }

        private async Task<IActionResult> GetDescriptorForUser(int userId)
        {
            var user = await _db.Users
                .Select(u => new { u.Id, u.FullName, u.FaceRegistered, u.FaceDescriptor })
                .FirstOrDefaultAsync(u => u.Id == userId);

            if (user == null) return NotFound();

            return Ok(new FaceDescriptorResponseDto
            {
                UserId = user.Id,
                FullName = user.FullName,
                FaceRegistered = user.FaceRegistered,
                Descriptor = user.FaceDescriptor // null if not yet registered
            });
        }

        // ── Log attempt (called by frontend after face-api.js comparison) ──────
        // The actual face comparison runs 100% on the device.
        // This endpoint just persists the result for manager visibility.
        [HttpPost("log-attempt")]
        public async Task<IActionResult> LogAttempt([FromBody] FaceAttemptDto dto)
        {
            var userId = User.GetUserId();

            var log = new FaceAttemptLog
            {
                UserId = userId,
                Action = dto.Action,
                Success = dto.Success,
                Distance = dto.Distance,
                Result = dto.Result,
                AttemptedAt = DateTime.UtcNow
            };

            _db.FaceAttemptLogs.Add(log);
            await _db.SaveChangesAsync();

            return Ok(new { message = "Attempt logged.", success = dto.Success });
        }

        // ── Employee: own attempt history ─────────────────────────────────────
        [HttpGet("attempts")]
        public async Task<IActionResult> GetMyAttempts([FromQuery] int days = 7)
        {
            var userId = User.GetUserId();
            var from = DateTime.UtcNow.AddDays(-days);

            var attempts = await _db.FaceAttemptLogs
                .Where(f => f.UserId == userId && f.AttemptedAt >= from)
                .OrderByDescending(f => f.AttemptedAt)
                .Select(f => new FaceAttemptLogDto
                {
                    Id = f.Id,
                    UserId = f.UserId,
                    FullName = f.User.FullName,
                    Action = f.Action,
                    Success = f.Success,
                    Distance = f.Distance,
                    Result = f.Result,
                    AttemptedAt = f.AttemptedAt
                })
                .ToListAsync();

            return Ok(attempts);
        }

        // ── Manager: one employee's attempt history ───────────────────────────
        [HttpGet("attempts/{userId:int}")]
        public async Task<IActionResult> GetUserAttempts(int userId, [FromQuery] int days = 30)
        {
            var callerId = User.GetUserId();
            var caller = await _db.Users.FindAsync(callerId);
            if (caller?.Role != "Manager") return Forbid();

            var from = DateTime.UtcNow.AddDays(-days);

            var attempts = await _db.FaceAttemptLogs
                .Where(f => f.UserId == userId && f.AttemptedAt >= from)
                .OrderByDescending(f => f.AttemptedAt)
                .Select(f => new FaceAttemptLogDto
                {
                    Id = f.Id,
                    UserId = f.UserId,
                    FullName = f.User.FullName,
                    Action = f.Action,
                    Success = f.Success,
                    Distance = f.Distance,
                    Result = f.Result,
                    AttemptedAt = f.AttemptedAt
                })
                .ToListAsync();

            return Ok(attempts);
        }

        // ── Manager: all FAILED face attempts across team today ───────────────
        [HttpGet("attempts/team/failed-today")]
        public async Task<IActionResult> GetTeamFailedToday()
        {
            var callerId = User.GetUserId();
            var caller = await _db.Users.FindAsync(callerId);
            if (caller?.Role != "Manager") return Forbid();

            var todayStart = DateTime.UtcNow.Date;

            var attempts = await _db.FaceAttemptLogs
                .Where(f => !f.Success && f.AttemptedAt >= todayStart)
                .OrderByDescending(f => f.AttemptedAt)
                .Select(f => new FaceAttemptLogDto
                {
                    Id = f.Id,
                    UserId = f.UserId,
                    FullName = f.User.FullName,
                    Action = f.Action,
                    Success = f.Success,
                    Distance = f.Distance,
                    Result = f.Result,
                    AttemptedAt = f.AttemptedAt
                })
                .ToListAsync();

            return Ok(attempts);
        }
    }
}
