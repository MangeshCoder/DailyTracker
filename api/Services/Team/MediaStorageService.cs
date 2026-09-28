using DailyTrackerAPI.Data;
using DailyTrackerAPI.DTOs;
using DailyTrackerAPI.Models;
using DailyTrackerAPI.Models.Tasks;
using DailyTrackerAPI.Services.Storage;
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
        /// <summary>Storage key, type and original name of a media file (null if unknown)</summary>
        Task<(string Key, string MimeType, string FileName)?> GetMediaFileInfoAsync(int mediaId);
    }

    public class MediaStorageService : IMediaStorageService
    {
        private readonly IFileStorage _files;
        private readonly AppDbContext _db;
        private const string UploadSubdir = "uploads/support";
        private static readonly string[] AllowedImageTypes = { "image/jpeg", "image/png", "image/gif", "image/webp" };
        private static readonly string[] AllowedVideoTypes = { "video/mp4", "video/webm", "video/quicktime", "video/x-msvideo" };
        private const long MaxFileBytes = 100 * 1024 * 1024; // 100 MB per file

        public MediaStorageService(IFileStorage files, AppDbContext db)
        {
            _files = files;
            _db = db;
        }

        public async Task<List<MediaEvidenceDto>> SaveSupportMediaAsync(int userId, int supportLogId, IFormFileCollection files)
        {
            if (files == null || files.Count == 0)
                return new List<MediaEvidenceDto>();

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
                var relativePath = $"{UploadSubdir}/{supportLogId}/{safeName}";
                await _files.SaveAsync(relativePath, file);

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

        public async Task<(string Key, string MimeType, string FileName)?> GetMediaFileInfoAsync(int mediaId)
        {
            var evidence = await _db.MediaEvidences.FindAsync(mediaId);
            if (evidence == null) return null;
            return (evidence.FilePath.Replace('\\', '/'), evidence.MimeType, evidence.FileName);
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
