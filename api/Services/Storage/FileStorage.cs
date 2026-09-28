using Amazon.Runtime;
using Amazon.S3;
using Amazon.S3.Model;
using Microsoft.AspNetCore.Mvc;

namespace DailyTrackerAPI.Services.Storage
{
    // ─────────────────────────────────────────────────────────────────────────
    //  Where uploaded files live
    //
    //    Storage:Provider = "Local" (default) → folders on this computer
    //        keys "uploads/…" → wwwroot/uploads/…   (profile photos are public)
    //        other keys       → App_Data/…          (chat files, never public)
    //    Storage:Provider = "S3" → a private S3-compatible bucket
    //        (Backblaze B2 when hosted: the server's own disk is wiped on
    //         every restart/deploy, so files must live outside it)
    //
    //  A key is a relative path like "uploads/avatars/ab12.jpg" and is what the
    //  database stores — the same key works with either provider.
    // ─────────────────────────────────────────────────────────────────────────

    public interface IFileStorage
    {
        Task SaveAsync(string key, IFormFile file, CancellationToken ct = default);
        Task SaveAsync(string key, Stream content, string contentType, CancellationToken ct = default);
        Task<Stream?> OpenReadAsync(string key, CancellationToken ct = default);
        Task DeleteAsync(string key, CancellationToken ct = default);

        /// <summary>Local disk: the file's full path (served with seek support). Cloud storage: null.</summary>
        string? LocalPath(string key);
    }

    public static class FileStorageKeys
    {
        /// <summary>Rejects anything that could escape the storage folder</summary>
        public static string Normalize(string key)
        {
            var k = key.Replace('\\', '/').TrimStart('/');
            if (k.Length == 0 || k.Split('/').Any(part => part is "" or "." or ".."))
                throw new UnauthorizedAccessException("Invalid file path.");
            return k;
        }
    }

    // ── Local folders ────────────────────────────────────────────────────────
    public sealed class LocalFileStorage : IFileStorage
    {
        private readonly string _webRoot, _dataRoot;

        public LocalFileStorage(IWebHostEnvironment env)
        {
            _webRoot = Path.GetFullPath(env.WebRootPath ?? Path.Combine(env.ContentRootPath, "wwwroot"));
            _dataRoot = Path.GetFullPath(Path.Combine(env.ContentRootPath, "App_Data"));
        }

        public string? LocalPath(string key)
        {
            var k = FileStorageKeys.Normalize(key);
            var root = k.StartsWith("uploads/", StringComparison.Ordinal) ? _webRoot : _dataRoot;
            var full = Path.GetFullPath(Path.Combine(root, k.Replace('/', Path.DirectorySeparatorChar)));
            if (!full.StartsWith(root + Path.DirectorySeparatorChar, StringComparison.Ordinal))
                throw new UnauthorizedAccessException("Invalid file path.");
            return full;
        }

        public async Task SaveAsync(string key, IFormFile file, CancellationToken ct = default)
        {
            await using var source = file.OpenReadStream();
            await SaveAsync(key, source, file.ContentType, ct);
        }

        public async Task SaveAsync(string key, Stream content, string contentType, CancellationToken ct = default)
        {
            var path = LocalPath(key)!;
            Directory.CreateDirectory(Path.GetDirectoryName(path)!);
            await using var target = new FileStream(path, FileMode.CreateNew);
            await content.CopyToAsync(target, ct);
        }

        public Task<Stream?> OpenReadAsync(string key, CancellationToken ct = default)
        {
            var path = LocalPath(key)!;
            return Task.FromResult<Stream?>(File.Exists(path)
                ? new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.Read)
                : null);
        }

        public Task DeleteAsync(string key, CancellationToken ct = default)
        {
            var path = LocalPath(key)!;
            if (File.Exists(path)) File.Delete(path);
            // tidy up a now-empty per-item folder (documents/12/, support/7/ …)
            var dir = Path.GetDirectoryName(path);
            if (dir != null && Directory.Exists(dir) && !Directory.EnumerateFileSystemEntries(dir).Any()
                && dir != _webRoot && dir != _dataRoot)
                Directory.Delete(dir);
            return Task.CompletedTask;
        }
    }

    // ── S3-compatible bucket (Backblaze B2, Cloudflare R2, AWS S3 …) ─────────
    public sealed class S3FileStorage : IFileStorage, IDisposable
    {
        private readonly AmazonS3Client _s3;
        private readonly string _bucket;

        public S3FileStorage(IConfiguration config)
        {
            var section = config.GetSection("Storage:S3");
            _bucket = section["Bucket"]?.Trim() is { Length: > 0 } b ? b : throw new InvalidOperationException("Storage:S3:Bucket is not set.");
            // "s3.us-west-004.backblazeb2.com" is accepted too (https:// is added)
            var serviceUrl = section["ServiceUrl"]?.Trim().TrimEnd('/');
            if (string.IsNullOrEmpty(serviceUrl))
                throw new InvalidOperationException("Storage:S3:ServiceUrl is not set.");
            if (!serviceUrl.StartsWith("http://", StringComparison.OrdinalIgnoreCase)
                && !serviceUrl.StartsWith("https://", StringComparison.OrdinalIgnoreCase))
                serviceUrl = "https://" + serviceUrl;
            if (string.IsNullOrWhiteSpace(section["AccessKey"]) || string.IsNullOrWhiteSpace(section["SecretKey"]))
                throw new InvalidOperationException("Storage:S3:AccessKey / Storage:S3:SecretKey are not set.");
            var s3Config = new AmazonS3Config
            {
                ServiceURL = serviceUrl,
                ForcePathStyle = true,
                // B2 accepts only the classic request checksums
                RequestChecksumCalculation = RequestChecksumCalculation.WHEN_REQUIRED,
                ResponseChecksumValidation = ResponseChecksumValidation.WHEN_REQUIRED,
            };
            if (!string.IsNullOrWhiteSpace(section["Region"])) s3Config.AuthenticationRegion = section["Region"]!.Trim();
            _s3 = new AmazonS3Client(new BasicAWSCredentials(section["AccessKey"]!.Trim(), section["SecretKey"]!.Trim()), s3Config);
        }

        public string? LocalPath(string key) => null;

        public async Task SaveAsync(string key, IFormFile file, CancellationToken ct = default)
        {
            await using var source = file.OpenReadStream();
            await SaveAsync(key, source, file.ContentType, ct);
        }

        public async Task SaveAsync(string key, Stream content, string contentType, CancellationToken ct = default)
        {
            await _s3.PutObjectAsync(new PutObjectRequest
            {
                BucketName = _bucket,
                Key = FileStorageKeys.Normalize(key),
                InputStream = content,
                ContentType = string.IsNullOrWhiteSpace(contentType) ? "application/octet-stream" : contentType,
                AutoCloseStream = false,
                UseChunkEncoding = false,
            }, ct);
        }

        public async Task<Stream?> OpenReadAsync(string key, CancellationToken ct = default)
        {
            try
            {
                var response = await _s3.GetObjectAsync(_bucket, FileStorageKeys.Normalize(key), ct);
                return new S3ObjectStream(response);
            }
            catch (AmazonS3Exception ex) when (ex.StatusCode == System.Net.HttpStatusCode.NotFound)
            {
                return null;
            }
        }

        public async Task DeleteAsync(string key, CancellationToken ct = default) =>
            await _s3.DeleteObjectAsync(_bucket, FileStorageKeys.Normalize(key), ct);

        public void Dispose() => _s3.Dispose();

        /// <summary>The object's content stream; disposing it also releases the HTTP response</summary>
        private sealed class S3ObjectStream(GetObjectResponse response) : Stream
        {
            private readonly Stream _inner = response.ResponseStream;
            public override bool CanRead => true;
            public override bool CanSeek => false;
            public override bool CanWrite => false;
            public override long Length => response.ContentLength;
            public override long Position { get => throw new NotSupportedException(); set => throw new NotSupportedException(); }
            public override int Read(byte[] buffer, int offset, int count) => _inner.Read(buffer, offset, count);
            public override ValueTask<int> ReadAsync(Memory<byte> buffer, CancellationToken ct = default) => _inner.ReadAsync(buffer, ct);
            public override Task<int> ReadAsync(byte[] buffer, int offset, int count, CancellationToken ct) => _inner.ReadAsync(buffer, offset, count, ct);
            public override void Flush() { }
            public override long Seek(long offset, SeekOrigin origin) => throw new NotSupportedException();
            public override void SetLength(long value) => throw new NotSupportedException();
            public override void Write(byte[] buffer, int offset, int count) => throw new NotSupportedException();
            protected override void Dispose(bool disposing)
            {
                if (disposing) { _inner.Dispose(); response.Dispose(); }
                base.Dispose(disposing);
            }
        }
    }

    public static class FileStorageExtensions
    {
        public static IServiceCollection AddFileStorage(this IServiceCollection services, IConfiguration config)
        {
            if (string.Equals(config["Storage:Provider"], "S3", StringComparison.OrdinalIgnoreCase))
                services.AddSingleton<IFileStorage, S3FileStorage>();
            else
                services.AddSingleton<IFileStorage, LocalFileStorage>();
            return services;
        }

        /// <summary>
        /// Sends a stored file to the browser. Local files keep seek support (video);
        /// cloud files are streamed through the API so every permission check stays here.
        /// downloadName = null → no file name (shown inline); otherwise a download.
        /// </summary>
        public static async Task<IActionResult> StoredFileAsync(this ControllerBase c, IFileStorage storage,
            string key, string contentType, string? downloadName)
        {
            var local = storage.LocalPath(key);
            if (local != null)
            {
                if (!File.Exists(local)) return c.NotFound();
                return downloadName == null
                    ? c.PhysicalFile(local, contentType, enableRangeProcessing: true)
                    : c.PhysicalFile(local, contentType, downloadName, enableRangeProcessing: true);
            }
            var stream = await storage.OpenReadAsync(key, c.HttpContext.RequestAborted);
            if (stream == null) return c.NotFound();
            if (stream.Length > 0) c.Response.ContentLength = stream.Length;
            return downloadName == null ? c.File(stream, contentType) : c.File(stream, contentType, downloadName);
        }
    }
}
