using DailyTrackerAPI.Data;
using DailyTrackerAPI.DTOs;
using DailyTrackerAPI.Models.HR;
using DailyTrackerAPI.Services.Communication;
using Microsoft.EntityFrameworkCore;

namespace DailyTrackerAPI.Services.HR
{
    // ─── Interface ────────────────────────────────────────────────────────────
    public interface IDocumentService
    {
        Task<DocumentDto> UploadAsync(int uploaderId, string uploaderRole, UploadDocumentDto dto, IFormFile file);
        Task<List<DocumentDto>> GetMyDocumentsAsync(int userId);
        Task<List<DocumentDto>> GetAllDocumentsAsync();
        Task<List<DocumentDto>> GetDocumentsForUserAsync(int targetUserId);
        Task<DocumentDto?> GetDocumentAsync(int documentId, int requesterId, string requesterRole);
        Task<DocumentDto?> UpdateAsync(int documentId, int requesterId, string requesterRole, UpdateDocumentDto dto);
        Task<bool> DeleteAsync(int documentId, int requesterId, string requesterRole);
        Task<DocumentSummaryDto> GetSummaryAsync(int userId, string role);
        Task<(string FullPath, string MimeType, string FileName)?> GetFileInfoAsync(int documentId, int requesterId, string requesterRole);
    }

    // ─── Implementation ───────────────────────────────────────────────────────
    public class DocumentService : IDocumentService
    {
        private readonly AppDbContext _db;
        private readonly IWebHostEnvironment _env;
        private readonly IAppNotificationService _notif;

        private const string UploadSubdir = "uploads/documents";

        // Allowed file types for document upload
        private static readonly string[] AllowedMimeTypes =
        {
            "application/pdf",
            "application/msword",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "application/vnd.ms-excel",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "image/jpeg",
            "image/png",
            "image/webp",
            "text/plain",
        };

        private const long MaxFileSizeBytes = 20 * 1024 * 1024; // 20 MB

        public DocumentService(
            AppDbContext db,
            IWebHostEnvironment env,
            IAppNotificationService notif)
        {
            _db = db;
            _env = env;
            _notif = notif;
        }

        // ── Upload ────────────────────────────────────────────────────────────
        public async Task<DocumentDto> UploadAsync(
            int uploaderId, string uploaderRole,
            UploadDocumentDto dto, IFormFile file)
        {
            // Validate file
            if (file == null || file.Length == 0)
                throw new InvalidOperationException("No file provided.");

            if (file.Length > MaxFileSizeBytes)
                throw new InvalidOperationException("File size exceeds the 20 MB limit.");

            var mime = file.ContentType ?? "application/octet-stream";
            if (!AllowedMimeTypes.Contains(mime))
                throw new InvalidOperationException(
                    "File type not allowed. Accepted: PDF, Word, Excel, Images, Text.");

            // Determine owner
            var isManager = uploaderRole == "Manager" || uploaderRole == "TeamLead";
            var ownerUserId = (dto.OwnerUserId > 0 && isManager)
                ? dto.OwnerUserId
                : uploaderId;

            // Save file to wwwroot/uploads/documents/{tempId}/filename
            var webRoot = _env.WebRootPath ?? Path.Combine(_env.ContentRootPath, "wwwroot");
            var tempDir = Path.Combine(webRoot, UploadSubdir, "temp_" + Guid.NewGuid().ToString("N"));
            Directory.CreateDirectory(tempDir);

            var ext = Path.GetExtension(file.FileName);
            var safeName = $"{Guid.NewGuid():N}{ext}";
            var fullPath = Path.Combine(tempDir, safeName);

            await using (var stream = new FileStream(fullPath, FileMode.Create))
                await file.CopyToAsync(stream);

            // Save to DB to get the Id
            var document = new Document
            {
                OwnerUserId = ownerUserId,
                UploadedByUserId = uploaderId,
                Title = dto.Title.Trim(),
                Description = dto.Description?.Trim(),
                Category = dto.Category,
                FileName = file.FileName,
                FilePath = "",  // filled after we get the Id
                MimeType = mime,
                FileSizeBytes = file.Length,
                IsPublic = dto.IsPublic,
                UploadedAt = DateTime.UtcNow,
                ExpiresAt = dto.ExpiresAt,
            };

            _db.Documents.Add(document);
            await _db.SaveChangesAsync();

            // Rename the temp directory to the real document Id
            var finalDir = Path.Combine(webRoot, UploadSubdir, document.Id.ToString());
            Directory.Move(tempDir, finalDir);

            var relativePath = $"{UploadSubdir}/{document.Id}/{safeName}";
            document.FilePath = relativePath;
            await _db.SaveChangesAsync();

            // Notify employee if a manager uploaded a doc for them
            if (uploaderId != ownerUserId)
            {
                await _notif.CreateAsync(
                    ownerUserId,
                    "New Document Uploaded",
                    $"A new document '{dto.Title}' has been uploaded to your profile.",
                    "Info",
                    "/documents"
                );
            }

            return await MapAsync(document);
        }

        // ── My Documents (own docs + public docs) ─────────────────────────────
        public async Task<List<DocumentDto>> GetMyDocumentsAsync(int userId)
        {
            var docs = await _db.Documents
                .Include(d => d.OwnerUser)
                .Include(d => d.UploadedBy)
                .Where(d => d.OwnerUserId == userId || d.IsPublic)
                .OrderByDescending(d => d.UploadedAt)
                .ToListAsync();

            return await MapListAsync(docs);
        }

        // ── All Documents (Manager/TeamLead) ──────────────────────────────────
        public async Task<List<DocumentDto>> GetAllDocumentsAsync()
        {
            var docs = await _db.Documents
                .Include(d => d.OwnerUser)
                .Include(d => d.UploadedBy)
                .OrderByDescending(d => d.UploadedAt)
                .ToListAsync();

            return await MapListAsync(docs);
        }

        // ── Documents for a specific employee (Manager view) ─────────────────
        public async Task<List<DocumentDto>> GetDocumentsForUserAsync(int targetUserId)
        {
            var docs = await _db.Documents
                .Include(d => d.OwnerUser)
                .Include(d => d.UploadedBy)
                .Where(d => d.OwnerUserId == targetUserId)
                .OrderByDescending(d => d.UploadedAt)
                .ToListAsync();

            return await MapListAsync(docs);
        }

        // ── Single document ───────────────────────────────────────────────────
        public async Task<DocumentDto?> GetDocumentAsync(
            int documentId, int requesterId, string requesterRole)
        {
            var doc = await _db.Documents
                .Include(d => d.OwnerUser)
                .Include(d => d.UploadedBy)
                .FirstOrDefaultAsync(d => d.Id == documentId);

            if (doc == null) return null;
            if (!CanAccess(doc, requesterId, requesterRole)) return null;

            return await MapAsync(doc);
        }

        // ── Update metadata ───────────────────────────────────────────────────
        public async Task<DocumentDto?> UpdateAsync(
            int documentId, int requesterId, string requesterRole, UpdateDocumentDto dto)
        {
            var doc = await _db.Documents
                .Include(d => d.OwnerUser)
                .Include(d => d.UploadedBy)
                .FirstOrDefaultAsync(d => d.Id == documentId);

            if (doc == null) return null;
            if (!CanManage(doc, requesterId, requesterRole)) return null;

            if (dto.Title != null) doc.Title = dto.Title.Trim();
            if (dto.Description != null) doc.Description = dto.Description.Trim();
            if (dto.Category != null) doc.Category = dto.Category;
            if (dto.IsPublic.HasValue) doc.IsPublic = dto.IsPublic.Value;
            if (dto.ExpiresAt.HasValue) doc.ExpiresAt = dto.ExpiresAt;

            await _db.SaveChangesAsync();
            return await MapAsync(doc);
        }

        // ── Delete ────────────────────────────────────────────────────────────
        public async Task<bool> DeleteAsync(
            int documentId, int requesterId, string requesterRole)
        {
            var doc = await _db.Documents
                .FirstOrDefaultAsync(d => d.Id == documentId);

            if (doc == null) return false;
            if (!CanManage(doc, requesterId, requesterRole)) return false;

            // Delete physical file
            var webRoot = _env.WebRootPath ?? Path.Combine(_env.ContentRootPath, "wwwroot");
            var fullPath = Path.Combine(webRoot, doc.FilePath.Replace("/", Path.DirectorySeparatorChar.ToString()));
            if (File.Exists(fullPath)) File.Delete(fullPath);

            // Clean up directory if empty
            var dir = Path.GetDirectoryName(fullPath);
            if (dir != null && Directory.Exists(dir) && !Directory.EnumerateFiles(dir).Any())
                Directory.Delete(dir);

            _db.Documents.Remove(doc);
            await _db.SaveChangesAsync();
            return true;
        }

        // ── Summary stats ─────────────────────────────────────────────────────
        public async Task<DocumentSummaryDto> GetSummaryAsync(int userId, string role)
        {
            var isManager = role == "Manager" || role == "TeamLead";
            var now = DateTime.UtcNow;

            var query = isManager
                ? _db.Documents
                : _db.Documents.Where(d => d.OwnerUserId == userId || d.IsPublic);

            var docs = await query.ToListAsync();

            return new DocumentSummaryDto
            {
                TotalDocuments = docs.Count,
                MyDocuments = docs.Count(d => d.OwnerUserId == userId),
                PublicDocuments = docs.Count(d => d.IsPublic),
                ExpiringDocuments = docs.Count(d =>
                    d.ExpiresAt.HasValue &&
                    d.ExpiresAt > now &&
                    d.ExpiresAt <= now.AddDays(30)),
                ExpiredDocuments = docs.Count(d =>
                    d.ExpiresAt.HasValue && d.ExpiresAt < now),
                ByCategory = docs
                    .GroupBy(d => d.Category)
                    .ToDictionary(g => g.Key, g => g.Count()),
            };
        }

        // ── File download info (for stream response) ──────────────────────────
        public async Task<(string FullPath, string MimeType, string FileName)?> GetFileInfoAsync(
            int documentId, int requesterId, string requesterRole)
        {
            var doc = await _db.Documents.FindAsync(documentId);
            if (doc == null) return null;
            if (!CanAccess(doc, requesterId, requesterRole)) return null;

            var webRoot = _env.WebRootPath ?? Path.Combine(_env.ContentRootPath, "wwwroot");
            var fullPath = Path.Combine(webRoot, doc.FilePath.Replace("/", Path.DirectorySeparatorChar.ToString()));

            if (!File.Exists(fullPath)) return null;

            return (fullPath, doc.MimeType, doc.FileName);
        }

        // ─── Access helpers ───────────────────────────────────────────────────

        /// <summary>Can this user read/download this document?</summary>
        private static bool CanAccess(Document doc, int userId, string role)
        {
            if (role == "Manager" || role == "TeamLead") return true;
            if (doc.IsPublic) return true;
            return doc.OwnerUserId == userId;
        }

        /// <summary>Can this user edit/delete this document?</summary>
        private static bool CanManage(Document doc, int userId, string role)
        {
            if (role == "Manager" || role == "TeamLead") return true;
            return doc.OwnerUserId == userId && doc.UploadedByUserId == userId;
        }

        // ─── Mapping helpers ──────────────────────────────────────────────────
        private static Task<DocumentDto> MapAsync(Document d)
        {
            var now = DateTime.UtcNow;
            return Task.FromResult(new DocumentDto
            {
                Id = d.Id,
                Title = d.Title,
                Description = d.Description,
                Category = d.Category,
                FileName = d.FileName,
                MimeType = d.MimeType,
                FileSizeBytes = d.FileSizeBytes,
                FileSizeLabel = FormatFileSize(d.FileSizeBytes),
                IsPublic = d.IsPublic,
                UploadedAt = d.UploadedAt,
                ExpiresAt = d.ExpiresAt,
                IsExpired = d.ExpiresAt.HasValue && d.ExpiresAt < now,
                ExpiresWithin30Days = d.ExpiresAt.HasValue
                                      && d.ExpiresAt > now
                                      && d.ExpiresAt <= now.AddDays(30),
                OwnerUserId = d.OwnerUserId,
                OwnerName = d.OwnerUser?.FullName ?? "",
                UploadedByUserId = d.UploadedByUserId,
                UploadedByName = d.UploadedBy?.FullName ?? "",
                DownloadUrl = $"/api/documents/{d.Id}/download",
            });
        }

        private static async Task<List<DocumentDto>> MapListAsync(List<Document> docs)
        {
            var result = new List<DocumentDto>(docs.Count);
            foreach (var d in docs)
                result.Add(await MapAsync(d));
            return result;
        }

        private static string FormatFileSize(long bytes)
        {
            if (bytes >= 1_048_576) return $"{bytes / 1_048_576.0:F1} MB";
            if (bytes >= 1_024) return $"{bytes / 1_024.0:F1} KB";
            return $"{bytes} B";
        }
    }
}