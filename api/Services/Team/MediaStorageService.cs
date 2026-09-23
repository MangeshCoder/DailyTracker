using DailyTrackerAPI.Data;
using DailyTrackerAPI.DTOs;
using DailyTrackerAPI.Models;
using DailyTrackerAPI.Models.Tasks;
using Microsoft.EntityFrameworkCore;

namespace DailyTrackerAPI.Services.Team
{
    /// <summary>
    /// Handles file storage for support log media (screenshots, screen recordings).
    /// Files stored under wwwroot/uploads/support/
    /// </summary>
    public interface IMediaStorageService
    {
        Task<List<MediaEvidenceDto>> SaveSupportMediaAsync(int userId, int supportLogId, IFormFileCollection files);
        string GetMediaUrl(string relativePath);
        string GetSecuredMediaUrl(int mediaId);
        Task<(string FullPath, string MimeType, string FileName)?> GetMediaFileInfoAsync(int mediaId);
    }

    public class MediaStorageService : IMediaStorageService
    {
        private readonly IWebHostEnvironment _env;
        private readonly AppDbContext _db;
        private const string UploadSubdir = "uploads/support";
        private static readonly string[] AllowedImageTypes = { "image/jpeg", "image/png", "image/gif", "image/webp" };
        private static readonly string[] AllowedVideoTypes = { "video/mp4", "video/webm", "video/quicktime", "video/x-msvideo" };
        private const long MaxFileBytes = 100 * 1024 * 1024; // 100 MB per file

        public MediaStorageService(IWebHostEnvironment env, AppDbContext db)
        {
            _env = env;
            _db = db;
        }

        public async Task<List<MediaEvidenceDto>> SaveSupportMediaAsync(int userId, int supportLogId, IFormFileCollection files)
        {
            if (files == null || files.Count == 0)
                return new List<MediaEvidenceDto>();

            var webRoot = _env.WebRootPath ?? Path.Combine(_env.ContentRootPath, "wwwroot");
            var uploadDir = Path.Combine(webRoot, UploadSubdir, supportLogId.ToString());
            Directory.CreateDirectory(uploadDir);

            var results = new List<MediaEvidenceDto>();

            foreach (var file in files)
            {
                if (file.Length == 0) continue;
                if (file.Length > MaxFileBytes)
                    throw new InvalidOperationException($"File {file.FileName} exceeds 100MB limit.");

                var mime = file.ContentType ?? "application/octet-stream";
                if (!IsAllowedMime(mime))
                    throw new InvalidOperationException($"File type {mime} not allowed. Use images (jpg, png, gif, webp) or videos (mp4, webm, mov).");

                var ext = Path.GetExtension(file.FileName);
                if (string.IsNullOrEmpty(ext)) ext = GetExtensionFromMime(mime);
                var safeName = $"{Guid.NewGuid():N}{ext}";
                var fullPath = Path.Combine(uploadDir, safeName);
                var relativePath = $"{UploadSubdir}/{supportLogId}/{safeName}";

                await using (var stream = new FileStream(fullPath, FileMode.Create))
                    await file.CopyToAsync(stream);

                var mediaType = mime.StartsWith("video/") ? "Recording" : (mime.StartsWith("image/") ? "Screenshot" : "File");

                var evidence = new MediaEvidence
                {
                    UserId = userId,
                    SupportLogId = supportLogId,
                    MediaType = mediaType,
                    FileName = file.FileName,
                    FilePath = relativePath,
                    FileSizeBytes = file.Length,
                    MimeType = mime
                };
                _db.MediaEvidences.Add(evidence);
                await _db.SaveChangesAsync();

                results.Add(new MediaEvidenceDto
                {
                    Id = evidence.Id,
                    MediaType = evidence.MediaType,
                    FileName = evidence.FileName,
                    Url = GetSecuredMediaUrl(evidence.Id),
                    FileSizeBytes = evidence.FileSizeBytes,
                    MimeType = evidence.MimeType
                });
            }

            return results;
        }

        public string GetMediaUrl(string relativePath)
        {
            return $"/{relativePath.Replace("\\", "/")}";
        }

        /// <summary>Returns API URL for secured access - requires auth.</summary>
        public string GetSecuredMediaUrl(int mediaId) => $"/api/support/media/{mediaId}";

        public async Task<(string FullPath, string MimeType, string FileName)?> GetMediaFileInfoAsync(int mediaId)
        {
            var evidence = await _db.MediaEvidences.FindAsync(mediaId);
            if (evidence == null) return null;

            var webRoot = _env.WebRootPath ?? Path.Combine(_env.ContentRootPath, "wwwroot");
            var fullPath = Path.Combine(webRoot, evidence.FilePath.Replace("/", Path.DirectorySeparatorChar.ToString()));
            if (!System.IO.File.Exists(fullPath)) return null;

            return (fullPath, evidence.MimeType, evidence.FileName);
        }

        private static bool IsAllowedMime(string mime) =>
            AllowedImageTypes.Contains(mime) || AllowedVideoTypes.Contains(mime);

        private static string GetExtensionFromMime(string mime) => mime switch
        {
            "image/jpeg" => ".jpg",
            "image/png" => ".png",
            "image/gif" => ".gif",
            "image/webp" => ".webp",
            "video/mp4" => ".mp4",
            "video/webm" => ".webm",
            "video/quicktime" => ".mov",
            _ => ".bin"
        };
    }
}
