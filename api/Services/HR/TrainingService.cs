using DailyTrackerAPI.Data;
using DailyTrackerAPI.DTOs;
using DailyTrackerAPI.Models.HR;
using Microsoft.EntityFrameworkCore;

namespace DailyTrackerAPI.Services.HR
{
    // ─── Interface ────────────────────────────────────────────────────────────
    public interface ITrainingService
    {
        // ── Training CRUD ────────────────────────────────────────────────────
        Task<List<TrainingDto>> GetMyTrainingsAsync(int userId);
        Task<List<TrainingDto>> GetAllTrainingsAsync();
        Task<List<TrainingDto>> GetTrainingsForUserAsync(int targetUserId);
        Task<TrainingDto> CreateTrainingAsync(int userId, CreateTrainingDto dto);
        Task<TrainingDto?> UpdateTrainingAsync(int id, int userId, string role, UpdateTrainingDto dto);
        Task<bool> DeleteTrainingAsync(int id, int userId, string role);

        // ── Certification CRUD ───────────────────────────────────────────────
        Task<List<CertificationDto>> GetMyCertificationsAsync(int userId);
        Task<List<CertificationDto>> GetAllCertificationsAsync();
        Task<List<CertificationDto>> GetCertificationsForUserAsync(int targetUserId);
        Task<List<CertificationDto>> GetExpiringCertificationsAsync();
        Task<CertificationDto> CreateCertificationAsync(int userId, CreateCertificationDto dto, IFormFile? file);
        Task<CertificationDto?> UpdateCertificationAsync(int id, int userId, string role, UpdateCertificationDto dto);
        Task<bool> DeleteCertificationAsync(int id, int userId, string role);

        // ── Stats ────────────────────────────────────────────────────────────
        Task<TrainingStatsDto> GetMyStatsAsync(int userId);
        Task<TeamTrainingStatsDto> GetTeamStatsAsync();

        // ── File ─────────────────────────────────────────────────────────────
        Task<(string FullPath, string MimeType, string FileName)?> GetCertFileInfoAsync(int certId, int requesterId, string role);
    }

    // ─── Implementation ───────────────────────────────────────────────────────
    public class TrainingService : ITrainingService
    {
        private readonly AppDbContext _db;
        private readonly IWebHostEnvironment _env;

        private const string UploadSubdir = "uploads/certifications";

        private static readonly string[] AllowedMimeTypes =
        {
            "application/pdf",
            "application/msword",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "image/jpeg",
            "image/png",
            "image/webp",
        };

        private const long MaxFileSizeBytes = 10 * 1024 * 1024; // 10 MB

        public TrainingService(AppDbContext db, IWebHostEnvironment env)
        {
            _db = db;
            _env = env;
        }

        // ══════════════════════════════════════════════════════════════════════
        //  TRAINING
        // ══════════════════════════════════════════════════════════════════════

        public async Task<List<TrainingDto>> GetMyTrainingsAsync(int userId)
        {
            var list = await _db.Trainings
                .Include(t => t.User)
                .Where(t => t.UserId == userId)
                .OrderByDescending(t => t.StartDate)
                .ToListAsync();
            return list.Select(MapTraining).ToList();
        }

        public async Task<List<TrainingDto>> GetAllTrainingsAsync()
        {
            var list = await _db.Trainings
                .Include(t => t.User)
                .OrderByDescending(t => t.StartDate)
                .ToListAsync();
            return list.Select(MapTraining).ToList();
        }

        public async Task<List<TrainingDto>> GetTrainingsForUserAsync(int targetUserId)
        {
            var list = await _db.Trainings
                .Include(t => t.User)
                .Where(t => t.UserId == targetUserId)
                .OrderByDescending(t => t.StartDate)
                .ToListAsync();
            return list.Select(MapTraining).ToList();
        }

        public async Task<TrainingDto> CreateTrainingAsync(int userId, CreateTrainingDto dto)
        {
            var t = new Training
            {
                UserId = userId,
                Title = dto.Title.Trim(),
                Provider = dto.Provider?.Trim(),
                TrainingType = dto.TrainingType,
                Description = dto.Description?.Trim(),
                StartDate = dto.StartDate,
                EndDate = dto.EndDate,
                DurationHours = dto.DurationHours,
                Status = dto.Status,
                Notes = dto.Notes?.Trim(),
                CourseUrl = dto.CourseUrl?.Trim(),
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow,
            };

            _db.Trainings.Add(t);
            await _db.SaveChangesAsync();

            await _db.Entry(t).Reference(x => x.User).LoadAsync();
            return MapTraining(t);
        }

        public async Task<TrainingDto?> UpdateTrainingAsync(
            int id, int userId, string role, UpdateTrainingDto dto)
        {
            var t = await _db.Trainings
                .Include(x => x.User)
                .FirstOrDefaultAsync(x => x.Id == id);

            if (t == null) return null;
            if (!CanManage(t.UserId, userId, role)) return null;

            if (dto.Title != null) t.Title = dto.Title.Trim();
            if (dto.Provider != null) t.Provider = dto.Provider.Trim();
            if (dto.TrainingType != null) t.TrainingType = dto.TrainingType;
            if (dto.Description != null) t.Description = dto.Description.Trim();
            if (dto.StartDate.HasValue) t.StartDate = dto.StartDate.Value;
            if (dto.EndDate.HasValue) t.EndDate = dto.EndDate.Value;
            if (dto.DurationHours.HasValue) t.DurationHours = dto.DurationHours.Value;
            if (dto.Status != null) t.Status = dto.Status;
            if (dto.Notes != null) t.Notes = dto.Notes.Trim();
            if (dto.CourseUrl != null) t.CourseUrl = dto.CourseUrl.Trim();

            t.UpdatedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync();
            return MapTraining(t);
        }

        public async Task<bool> DeleteTrainingAsync(int id, int userId, string role)
        {
            var t = await _db.Trainings.FindAsync(id);
            if (t == null) return false;
            if (!CanManage(t.UserId, userId, role)) return false;

            _db.Trainings.Remove(t);
            await _db.SaveChangesAsync();
            return true;
        }

        // ══════════════════════════════════════════════════════════════════════
        //  CERTIFICATION
        // ══════════════════════════════════════════════════════════════════════

        public async Task<List<CertificationDto>> GetMyCertificationsAsync(int userId)
        {
            var list = await _db.Certifications
                .Include(c => c.User)
                .Where(c => c.UserId == userId)
                .OrderByDescending(c => c.IssueDate)
                .ToListAsync();
            return list.Select(MapCert).ToList();
        }

        public async Task<List<CertificationDto>> GetAllCertificationsAsync()
        {
            var list = await _db.Certifications
                .Include(c => c.User)
                .OrderByDescending(c => c.IssueDate)
                .ToListAsync();
            return list.Select(MapCert).ToList();
        }

        public async Task<List<CertificationDto>> GetCertificationsForUserAsync(int targetUserId)
        {
            var list = await _db.Certifications
                .Include(c => c.User)
                .Where(c => c.UserId == targetUserId)
                .OrderByDescending(c => c.IssueDate)
                .ToListAsync();
            return list.Select(MapCert).ToList();
        }

        public async Task<List<CertificationDto>> GetExpiringCertificationsAsync()
        {
            var cutoff = DateTime.UtcNow.AddDays(30);
            var list = await _db.Certifications
                .Include(c => c.User)
                .Where(c =>
                    c.ExpiryDate.HasValue &&
                    c.ExpiryDate > DateTime.UtcNow &&
                    c.ExpiryDate <= cutoff &&
                    c.Status == "Active")
                .OrderBy(c => c.ExpiryDate)
                .ToListAsync();
            return list.Select(MapCert).ToList();
        }

        public async Task<CertificationDto> CreateCertificationAsync(
            int userId, CreateCertificationDto dto, IFormFile? file)
        {
            // Validate and save file if provided
            string? fileName = null;
            string? filePath = null;
            string? mimeType = null;
            long? fileSize = null;

            if (file != null && file.Length > 0)
            {
                if (file.Length > MaxFileSizeBytes)
                    throw new InvalidOperationException("File exceeds the 10 MB limit.");

                var mime = file.ContentType ?? "application/octet-stream";
                if (!AllowedMimeTypes.Contains(mime))
                    throw new InvalidOperationException("File type not allowed. Use PDF, Word, or Images.");

                // Save to temp dir first
                var webRoot = _env.WebRootPath ?? Path.Combine(_env.ContentRootPath, "wwwroot");
                var tempDir = Path.Combine(webRoot, UploadSubdir, "temp_" + Guid.NewGuid().ToString("N"));
                Directory.CreateDirectory(tempDir);

                var ext = Path.GetExtension(file.FileName);
                var safeName = $"{Guid.NewGuid():N}{ext}";
                var fullPath = Path.Combine(tempDir, safeName);
                await using (var stream = new FileStream(fullPath, FileMode.Create))
                    await file.CopyToAsync(stream);

                // We'll rename after we have the Id
                fileName = file.FileName;
                filePath = $"__temp__{tempDir}||{safeName}";  // placeholder
                mimeType = mime;
                fileSize = file.Length;
            }

            // Auto-compute status based on expiry
            var status = "Active";
            if (dto.ExpiryDate.HasValue && dto.ExpiryDate < DateTime.UtcNow)
                status = "Expired";

            var cert = new Certification
            {
                UserId = userId,
                Name = dto.Name.Trim(),
                IssuingOrganization = dto.IssuingOrganization.Trim(),
                IssueDate = dto.IssueDate,
                ExpiryDate = dto.ExpiryDate,
                CredentialId = dto.CredentialId?.Trim(),
                CredentialUrl = dto.CredentialUrl?.Trim(),
                Status = status,
                FileName = fileName,
                FilePath = null,  // set after we have the Id
                MimeType = mimeType,
                FileSizeBytes = fileSize,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow,
            };

            _db.Certifications.Add(cert);
            await _db.SaveChangesAsync();

            // Rename temp directory to certId if a file was provided
            if (filePath != null && filePath.StartsWith("__temp__"))
            {
                var parts = filePath.Replace("__temp__", "").Split("||");
                var tempDir2 = parts[0];
                var safeName2 = parts[1];

                var webRoot = _env.WebRootPath ?? Path.Combine(_env.ContentRootPath, "wwwroot");
                var finalDir = Path.Combine(webRoot, UploadSubdir, cert.Id.ToString());
                Directory.Move(tempDir2, finalDir);

                cert.FilePath = $"{UploadSubdir}/{cert.Id}/{safeName2}";
                await _db.SaveChangesAsync();
            }

            await _db.Entry(cert).Reference(c => c.User).LoadAsync();
            return MapCert(cert);
        }

        public async Task<CertificationDto?> UpdateCertificationAsync(
            int id, int userId, string role, UpdateCertificationDto dto)
        {
            var c = await _db.Certifications
                .Include(x => x.User)
                .FirstOrDefaultAsync(x => x.Id == id);

            if (c == null) return null;
            if (!CanManage(c.UserId, userId, role)) return null;

            if (dto.Name != null) c.Name = dto.Name.Trim();
            if (dto.IssuingOrganization != null) c.IssuingOrganization = dto.IssuingOrganization.Trim();
            if (dto.IssueDate.HasValue) c.IssueDate = dto.IssueDate.Value;
            if (dto.ExpiryDate.HasValue) c.ExpiryDate = dto.ExpiryDate.Value;
            if (dto.CredentialId != null) c.CredentialId = dto.CredentialId.Trim();
            if (dto.CredentialUrl != null) c.CredentialUrl = dto.CredentialUrl.Trim();
            if (dto.Status != null) c.Status = dto.Status;

            c.UpdatedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync();
            return MapCert(c);
        }

        public async Task<bool> DeleteCertificationAsync(int id, int userId, string role)
        {
            var c = await _db.Certifications.FindAsync(id);
            if (c == null) return false;
            if (!CanManage(c.UserId, userId, role)) return false;

            // Delete physical file
            if (!string.IsNullOrEmpty(c.FilePath))
            {
                var webRoot = _env.WebRootPath ?? Path.Combine(_env.ContentRootPath, "wwwroot");
                var fullPath = Path.Combine(webRoot, c.FilePath.Replace("/", Path.DirectorySeparatorChar.ToString()));
                if (File.Exists(fullPath)) File.Delete(fullPath);

                var dir = Path.GetDirectoryName(fullPath);
                if (dir != null && Directory.Exists(dir) && !Directory.EnumerateFiles(dir).Any())
                    Directory.Delete(dir);
            }

            _db.Certifications.Remove(c);
            await _db.SaveChangesAsync();
            return true;
        }

        // ══════════════════════════════════════════════════════════════════════
        //  STATS
        // ══════════════════════════════════════════════════════════════════════

        public async Task<TrainingStatsDto> GetMyStatsAsync(int userId)
        {
            var trainings = await _db.Trainings.Where(t => t.UserId == userId).ToListAsync();
            var certs = await _db.Certifications.Where(c => c.UserId == userId).ToListAsync();
            var now = DateTime.UtcNow;

            return new TrainingStatsDto
            {
                TotalTrainings = trainings.Count,
                CompletedTrainings = trainings.Count(t => t.Status == "Completed"),
                PlannedTrainings = trainings.Count(t => t.Status == "Planned"),
                InProgressTrainings = trainings.Count(t => t.Status == "InProgress"),
                TotalHours = trainings.Where(t => t.Status == "Completed").Sum(t => t.DurationHours),
                TotalCertifications = certs.Count,
                ActiveCertifications = certs.Count(c => c.Status == "Active"),
                ExpiredCertifications = certs.Count(c => c.Status == "Expired" || (c.ExpiryDate.HasValue && c.ExpiryDate < now)),
                ExpiringWithin30Days = certs.Count(c =>
                    c.ExpiryDate.HasValue && c.ExpiryDate > now && c.ExpiryDate <= now.AddDays(30)),
                ByTrainingType = trainings
                    .GroupBy(t => t.TrainingType)
                    .ToDictionary(g => g.Key, g => g.Count()),
            };
        }

        public async Task<TeamTrainingStatsDto> GetTeamStatsAsync()
        {
            var users = await _db.Users.Where(u => u.IsActive).ToListAsync();
            var trainings = await _db.Trainings.Include(t => t.User).ToListAsync();
            var certs = await _db.Certifications.ToListAsync();
            var now = DateTime.UtcNow;

            var members = users.Select(u =>
            {
                var uTrainings = trainings.Where(t => t.UserId == u.Id).ToList();
                var uCerts = certs.Where(c => c.UserId == u.Id).ToList();
                return new MemberTrainingSummaryDto
                {
                    UserId = u.Id,
                    FullName = u.FullName,
                    Role = u.Role,
                    TrainingCount = uTrainings.Count,
                    CompletedCount = uTrainings.Count(t => t.Status == "Completed"),
                    HoursCompleted = uTrainings.Where(t => t.Status == "Completed").Sum(t => t.DurationHours),
                    CertificationCount = uCerts.Count,
                    ExpiringCertCount = uCerts.Count(c =>
                        c.ExpiryDate.HasValue && c.ExpiryDate > now && c.ExpiryDate <= now.AddDays(30)),
                };
            }).OrderByDescending(m => m.HoursCompleted).ToList();

            return new TeamTrainingStatsDto
            {
                TotalMembers = users.Count,
                TotalTrainings = trainings.Count,
                TotalCertifications = certs.Count,
                ExpiringCerts = certs.Count(c =>
                    c.ExpiryDate.HasValue && c.ExpiryDate > now && c.ExpiryDate <= now.AddDays(30)),
                TotalHours = trainings.Where(t => t.Status == "Completed").Sum(t => t.DurationHours),
                Members = members,
            };
        }

        // ══════════════════════════════════════════════════════════════════════
        //  FILE
        // ══════════════════════════════════════════════════════════════════════

        public async Task<(string FullPath, string MimeType, string FileName)?> GetCertFileInfoAsync(
            int certId, int requesterId, string role)
        {
            var cert = await _db.Certifications.FindAsync(certId);
            if (cert == null || string.IsNullOrEmpty(cert.FilePath)) return null;
            if (!CanAccess(cert.UserId, requesterId, role)) return null;

            var webRoot = _env.WebRootPath ?? Path.Combine(_env.ContentRootPath, "wwwroot");
            var fullPath = Path.Combine(webRoot, cert.FilePath.Replace("/", Path.DirectorySeparatorChar.ToString()));
            if (!File.Exists(fullPath)) return null;

            return (fullPath, cert.MimeType ?? "application/octet-stream", cert.FileName ?? "certificate");
        }

        // ─── Helpers ──────────────────────────────────────────────────────────

        private static bool CanManage(int ownerId, int userId, string role) =>
            role == "Manager" || role == "TeamLead" || ownerId == userId;

        private static bool CanAccess(int ownerId, int userId, string role) =>
            role == "Manager" || role == "TeamLead" || ownerId == userId;

        private static TrainingDto MapTraining(Training t) => new()
        {
            Id = t.Id,
            UserId = t.UserId,
            UserName = t.User?.FullName ?? "",
            Title = t.Title,
            Provider = t.Provider,
            TrainingType = t.TrainingType,
            Description = t.Description,
            StartDate = t.StartDate,
            EndDate = t.EndDate,
            DurationHours = t.DurationHours,
            Status = t.Status,
            Notes = t.Notes,
            CourseUrl = t.CourseUrl,
            CreatedAt = t.CreatedAt,
        };

        private static CertificationDto MapCert(Certification c)
        {
            var now = DateTime.UtcNow;
            int? daysUntil = c.ExpiryDate.HasValue
                ? (int?)(c.ExpiryDate.Value - now).TotalDays
                : null;

            return new CertificationDto
            {
                Id = c.Id,
                UserId = c.UserId,
                UserName = c.User?.FullName ?? "",
                Name = c.Name,
                IssuingOrganization = c.IssuingOrganization,
                IssueDate = c.IssueDate,
                ExpiryDate = c.ExpiryDate,
                CredentialId = c.CredentialId,
                CredentialUrl = c.CredentialUrl,
                Status = c.Status,
                HasFile = !string.IsNullOrEmpty(c.FilePath),
                FileName = c.FileName,
                FileSizeLabel = c.FileSizeBytes.HasValue ? FormatSize(c.FileSizeBytes.Value) : null,
                DownloadUrl = !string.IsNullOrEmpty(c.FilePath)
                    ? $"/api/training/certifications/{c.Id}/download"
                    : null,
                IsExpired = c.ExpiryDate.HasValue && c.ExpiryDate < now,
                ExpiresWithin30Days = c.ExpiryDate.HasValue && c.ExpiryDate > now && c.ExpiryDate <= now.AddDays(30),
                DaysUntilExpiry = daysUntil,
                CreatedAt = c.CreatedAt,
            };
        }

        private static string FormatSize(long bytes)
        {
            if (bytes >= 1_048_576) return $"{bytes / 1_048_576.0:F1} MB";
            if (bytes >= 1_024) return $"{bytes / 1_024.0:F1} KB";
            return $"{bytes} B";
        }
    }
}