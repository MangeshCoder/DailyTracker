using DailyTrackerAPI.Data;
using DailyTrackerAPI.Services.Storage;
using DailyTrackerAPI.DTOs;
using DailyTrackerAPI.Models.HR;
using DailyTrackerAPI.Services.Communication;
using DailyTrackerAPI.Services.Auth;
using Microsoft.EntityFrameworkCore;

namespace DailyTrackerAPI.Services.HR
{
    // ─── Interface ────────────────────────────────────────────────────────────
    public interface IDocumentService
    {
        Task<DocumentDto> UploadAsync(int uploaderId, string uploaderRole, UploadDocumentDto dto, IFormFile file);
        Task<List<DocumentDto>> GetMyDocumentsAsync(int userId);
        Task<List<DocumentDto>> GetAllDocumentsAsync(int requesterId);
        Task<List<DocumentDto>> GetDocumentsForUserAsync(int targetUserId, int requesterId);
        Task<DocumentDto?> GetDocumentAsync(int documentId, int requesterId, string requesterRole);
        Task<DocumentDto?> UpdateAsync(int documentId, int requesterId, string requesterRole, UpdateDocumentDto dto);
        Task<bool> DeleteAsync(int documentId, int requesterId, string requesterRole);
        Task<DocumentSummaryDto> GetSummaryAsync(int userId, string role);
        Task<(string Key, string MimeType, string FileName)?> GetFileInfoAsync(int documentId, int requesterId, string requesterRole);
    }

    // ─── Implementation ───────────────────────────────────────────────────────
    public class DocumentService : IDocumentService
    {
        private readonly AppDbContext _db;
        private readonly IFileStorage _files;
        private readonly IAppNotificationService _notif;
        private readonly ITeamScope _scope;

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
            IFileStorage files,
            IAppNotificationService notif,
            ITeamScope scope)
        {
            _db = db;
            _files = files;
            _notif = notif;
            _scope = scope;
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
            // Uploading for someone else: only for people you manage
            var ownerUserId = dto.OwnerUserId > 0 ? dto.OwnerUserId : uploaderId;
            if (ownerUserId != uploaderId)
                await _scope.EnsureCanManageAsync(uploaderId, ownerUserId);

            // Save the file (uploads/documents/{folder}/{random name})
            var ext = Path.GetExtension(file.FileName);
            var relativePath = $"{UploadSubdir}/{Guid.NewGuid():N}/{Guid.NewGuid():N}{ext}";
            await _files.SaveAsync(relativePath, file);

            // Save to DB to get the Id
            var document = new Document
            {
                OwnerUserId = ownerUserId,
                UploadedByUserId = uploaderId,
                Title = dto.Title.Trim(),
                Description = dto.Description?.Trim(),
                Category = dto.Category,
                FileName = file.FileName,
                FilePath = relativePath,
                MimeType = mime,
                FileSizeBytes = file.Length,
                IsPublic = dto.IsPublic,
                UploadedAt = DateTime.UtcNow,
                ExpiresAt = dto.ExpiresAt,
            };

            _db.Documents.Add(document);
            try { await _db.SaveChangesAsync(); }
            catch { await _files.DeleteAsync(relativePath); throw; }   // no orphan files

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
        public async Task<List<DocumentDto>> GetAllDocumentsAsync(int requesterId)
        {
            var team = await _scope.ManagedUserIdsAsync(requesterId);   // null = everyone
            var docs = await _db.Documents
                .Include(d => d.OwnerUser)
                .Include(d => d.UploadedBy)
                .Where(d => team == null || team.Contains(d.OwnerUserId) || d.OwnerUserId == requesterId || d.IsPublic)
                .OrderByDescending(d => d.UploadedAt)
                .ToListAsync();

            return await MapListAsync(docs);
        }

        // ── Documents for a specific employee (Manager view) ─────────────────
        public async Task<List<DocumentDto>> GetDocumentsForUserAsync(int targetUserId, int requesterId)
        {
            if (targetUserId != requesterId) await _scope.EnsureCanManageAsync(requesterId, targetUserId);
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
            if (!await CanAccessAsync(doc, requesterId)) return null;

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
            if (!await CanManageAsync(doc, requesterId)) return null;

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
            if (!await CanManageAsync(doc, requesterId)) return false;

            // Delete the stored file (and its now-empty folder)
            try { await _files.DeleteAsync(doc.FilePath); }
            catch { /* already gone */ }

            _db.Documents.Remove(doc);
            await _db.SaveChangesAsync();
            return true;
        }

        // ── Summary stats ─────────────────────────────────────────────────────
        public async Task<DocumentSummaryDto> GetSummaryAsync(int userId, string role)
        {
            var now = DateTime.UtcNow;
            var team = await _scope.ManagedUserIdsAsync(userId);   // null = everyone
            var query = _db.Documents.Where(d =>
                d.OwnerUserId == userId || d.IsPublic || team == null || team.Contains(d.OwnerUserId));

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
        public async Task<(string Key, string MimeType, string FileName)?> GetFileInfoAsync(
            int documentId, int requesterId, string requesterRole)
        {
            var doc = await _db.Documents.FindAsync(documentId);
            if (doc == null) return null;
            if (!await CanAccessAsync(doc, requesterId)) return null;

            return (doc.FilePath, doc.MimeType, doc.FileName);
        }

        // ─── Access helpers ───────────────────────────────────────────────────

        /// <summary>Can this user read/download this document?</summary>
        private async Task<bool> CanAccessAsync(Document doc, int userId) =>
            doc.IsPublic || doc.OwnerUserId == userId || await _scope.CanManageAsync(userId, doc.OwnerUserId);

        /// <summary>Can this user edit/delete this document?</summary>
        private async Task<bool> CanManageAsync(Document doc, int userId) =>
            (doc.OwnerUserId == userId && doc.UploadedByUserId == userId)
            || (doc.OwnerUserId != userId && await _scope.CanManageAsync(userId, doc.OwnerUserId));

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