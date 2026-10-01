using System.Net;
using System.Net.Http.Headers;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Threading.Channels;
using DailyTrackerAPI.Data;
using DailyTrackerAPI.Models.Communication;
using DailyTrackerAPI.Models.Monitoring;
using Microsoft.EntityFrameworkCore;

namespace DailyTrackerAPI.Services.Communication
{
    // ─────────────────────────────────────────────────────────────────────────
    //  Phone / browser push notifications (Web Push — works on Android, desktop
    //  browsers, and iPhone when the app is added to the home screen).
    //
    //  • Every bell notification is also pushed (PushingNotificationSender), and
    //    chat messages are pushed to members who don't have the app open.
    //  • Pushes go through a queue and are sent in the background, so saving a
    //    request never waits on Google / Apple / Mozilla's push servers.
    //  • Standards: VAPID (RFC 8292) to identify this server, aes128gcm payload
    //    encryption (RFC 8291) — built-in .NET crypto, no extra package.
    //  • The VAPID key pair comes from configuration (Push:VapidPublicKey /
    //    Push:VapidPrivateKey) or is made once and kept in the AppSecrets table.
    // ─────────────────────────────────────────────────────────────────────────

    /// <summary>What a push shows: title, text, the page to open, and a tag (same tag replaces the older one)</summary>
    public record PushMessage(string Title, string Body, string? Url = null, string? Tag = null);

    /// <summary>Queue a push for some people (returns at once; sent in the background)</summary>
    public interface IPushSender
    {
        void Enqueue(IEnumerable<int> userIds, PushMessage message);
    }

    public sealed class PushQueue : IPushSender
    {
        private readonly Channel<(int[] UserIds, PushMessage Message)> _channel =
            Channel.CreateBounded<(int[], PushMessage)>(new BoundedChannelOptions(2000) { FullMode = BoundedChannelFullMode.DropOldest });

        public void Enqueue(IEnumerable<int> userIds, PushMessage message)
        {
            var ids = userIds.Distinct().ToArray();
            if (ids.Length > 0) _channel.Writer.TryWrite((ids, message));
        }

        internal ChannelReader<(int[] UserIds, PushMessage Message)> Reader => _channel.Reader;
    }

    /// <summary>Sends queued pushes one batch at a time</summary>
    public sealed class PushWorker : BackgroundService
    {
        private readonly PushQueue _queue;
        private readonly IServiceScopeFactory _scopes;
        private readonly ILogger<PushWorker> _log;

        public PushWorker(PushQueue queue, IServiceScopeFactory scopes, ILogger<PushWorker> log)
        { _queue = queue; _scopes = scopes; _log = log; }

        protected override async Task ExecuteAsync(CancellationToken stop)
        {
            await foreach (var (userIds, message) in _queue.Reader.ReadAllAsync(stop))
            {
                try
                {
                    using var scope = _scopes.CreateScope();
                    await scope.ServiceProvider.GetRequiredService<PushDelivery>().DeliverAsync(userIds, message, stop);
                }
                catch (OperationCanceledException) when (stop.IsCancellationRequested) { break; }
                catch (Exception ex) { _log.LogWarning(ex, "Push delivery failed"); }
            }
        }
    }

    /// <summary>The server's VAPID key pair (base64url): from configuration, else made once and stored</summary>
    public sealed class VapidKeys
    {
        public const string PublicKeyName = "push.vapid.public", PrivateKeyName = "push.vapid.private";
        private static readonly SemaphoreSlim Gate = new(1, 1);
        private static (string Public, string Private)? _cached;

        private readonly AppDbContext _db;
        private readonly IConfiguration _config;
        public VapidKeys(AppDbContext db, IConfiguration config) { _db = db; _config = config; }

        public string Subject => _config["Push:Subject"] is { Length: > 0 } s ? s : "mailto:admin@montcrestsoftware.com";

        public async Task<(string Public, string Private)> GetAsync()
        {
            var pub = _config["Push:VapidPublicKey"]; var priv = _config["Push:VapidPrivateKey"];
            if (!string.IsNullOrWhiteSpace(pub) && !string.IsNullOrWhiteSpace(priv)) return (pub.Trim(), priv.Trim());
            if (_cached is { } c) return c;

            await Gate.WaitAsync();
            try
            {
                if (_cached is { } c2) return c2;
                var stored = await _db.AppSecrets.AsNoTracking()
                    .Where(s => s.Key == PublicKeyName || s.Key == PrivateKeyName).ToDictionaryAsync(s => s.Key, s => s.Value);
                if (stored.TryGetValue(PublicKeyName, out var p) && stored.TryGetValue(PrivateKeyName, out var k))
                    return (_cached = (p, k)).Value;

                using var ec = ECDsa.Create(ECCurve.NamedCurves.nistP256);
                var prm = ec.ExportParameters(true);
                var made = (Public: B64.Encode(WebPushCrypto.Uncompressed(prm.Q)), Private: B64.Encode(prm.D!));
                _db.AppSecrets.RemoveRange(_db.AppSecrets.Where(s => s.Key == PublicKeyName || s.Key == PrivateKeyName));
                _db.AppSecrets.Add(new AppSecret { Key = PublicKeyName, Value = made.Public });
                _db.AppSecrets.Add(new AppSecret { Key = PrivateKeyName, Value = made.Private });
                await _db.SaveChangesAsync();
                return (_cached = made).Value;
            }
            finally { Gate.Release(); }
        }

        /// <summary>Forget the cached pair (tests; or after a database restore)</summary>
        public static void ResetCache() => _cached = null;
    }

    /// <summary>Encrypts and posts one push to every device of the given people</summary>
    public sealed class PushDelivery
    {
        public const string HttpClientName = "webpush";
        private readonly AppDbContext _db;
        private readonly VapidKeys _keys;
        private readonly IHttpClientFactory _http;
        private readonly ILogger<PushDelivery> _log;

        public PushDelivery(AppDbContext db, VapidKeys keys, IHttpClientFactory http, ILogger<PushDelivery> log)
        { _db = db; _keys = keys; _http = http; _log = log; }

        /// <returns>how many devices accepted the push</returns>
        public async Task<int> DeliverAsync(IReadOnlyCollection<int> userIds, PushMessage message, CancellationToken ct = default)
        {
            var subs = await _db.PushSubscriptions.Where(s => userIds.Contains(s.UserId)).ToListAsync(ct);
            if (subs.Count == 0) return 0;

            var (pub, priv) = await _keys.GetAsync();
            var payload = JsonSerializer.SerializeToUtf8Bytes(new
            {
                title = Clip(message.Title, 80),
                body = Clip(message.Body, 240),
                url = message.Url ?? "/notifications",
                tag = message.Tag,
            });
            var client = _http.CreateClient(HttpClientName);
            int ok = 0;
            foreach (var sub in subs)
            {
                try
                {
                    using var req = new HttpRequestMessage(HttpMethod.Post, sub.Endpoint)
                    {
                        Content = new ByteArrayContent(WebPushCrypto.Encrypt(payload, sub.P256dh, sub.Auth)),
                    };
                    req.Content.Headers.ContentType = new MediaTypeHeaderValue("application/octet-stream");
                    req.Content.Headers.ContentEncoding.Add("aes128gcm");
                    req.Headers.TryAddWithoutValidation("TTL", "86400");            // keep for a day if the phone is off
                    req.Headers.TryAddWithoutValidation("Urgency", "high");
                    req.Headers.TryAddWithoutValidation("Authorization", WebPushCrypto.VapidHeader(sub.Endpoint, _keys.Subject, pub, priv));

                    using var res = await client.SendAsync(req, ct);
                    if (res.IsSuccessStatusCode) { ok++; sub.LastSentAt = DateTime.UtcNow; }
                    else if (res.StatusCode is HttpStatusCode.NotFound or HttpStatusCode.Gone)
                        _db.PushSubscriptions.Remove(sub);                         // device unsubscribed / reinstalled
                    else
                        _log.LogWarning("Push to user {User} refused: {Status}", sub.UserId, (int)res.StatusCode);
                }
                catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException or FormatException or CryptographicException)
                {
                    _log.LogWarning("Push to user {User} failed: {Error}", sub.UserId, ex.Message);
                }
            }
            await _db.SaveChangesAsync(ct);
            return ok;
        }

        private static string Clip(string s, int max) => s.Length <= max ? s : s[..(max - 1)] + "…";
    }

    /// <summary>
    /// Wraps the SignalR sender: every "ReceiveNotification" (a bell notification)
    /// is also queued as a push, so all existing notifications reach phones too.
    /// </summary>
    public sealed class PushingNotificationSender : INotificationSender
    {
        private readonly SignalRNotificationSender _inner;
        private readonly IPushSender _push;
        public PushingNotificationSender(SignalRNotificationSender inner, IPushSender push) { _inner = inner; _push = push; }

        public async Task SendToUser(int userId, string eventName, object data)
        {
            await _inner.SendToUser(userId, eventName, data);
            if (eventName == "ReceiveNotification" && ToPush(data) is { } msg) _push.Enqueue(new[] { userId }, msg);
        }

        public Task SendToManagers(string eventName, object data) => _inner.SendToManagers(eventName, data);
        public Task SendToAll(string eventName, object data) => _inner.SendToAll(eventName, data);

        private static PushMessage? ToPush(object data)
        {
            var json = JsonSerializer.SerializeToElement(data);
            string? Get(string name) => json.ValueKind == JsonValueKind.Object
                ? json.EnumerateObject().FirstOrDefault(p => p.Name.Equals(name, StringComparison.OrdinalIgnoreCase)).Value is { ValueKind: JsonValueKind.String } v ? v.GetString() : null
                : null;
            var title = Get("Title");
            return string.IsNullOrWhiteSpace(title) ? null : new PushMessage(title, Get("Message") ?? "", Get("ActionUrl"));
        }
    }

    /// <summary>base64url without padding (what browsers and VAPID use)</summary>
    public static class B64
    {
        public static string Encode(byte[] b) => Convert.ToBase64String(b).TrimEnd('=').Replace('+', '-').Replace('/', '_');
        public static byte[] Decode(string s)
        {
            s = s.Trim().Replace('-', '+').Replace('_', '/');
            return Convert.FromBase64String(s.PadRight(s.Length + (4 - s.Length % 4) % 4, '='));
        }
    }

    public static class WebPushCrypto
    {
        private const int RecordSize = 4096;

        public static byte[] Uncompressed(ECPoint q) => [0x04, .. q.X!, .. q.Y!];

        private static ECParameters PublicFromUncompressed(byte[] raw)
        {
            if (raw.Length != 65 || raw[0] != 0x04) throw new FormatException("Not an uncompressed P-256 public key");
            return new ECParameters { Curve = ECCurve.NamedCurves.nistP256, Q = new ECPoint { X = raw[1..33], Y = raw[33..65] } };
        }

        /// <summary>RFC 8291 / 8188 "aes128gcm": one record, the browser's keys from its subscription</summary>
        public static byte[] Encrypt(byte[] plaintext, string p256dh, string auth, byte[]? salt = null, ECDiffieHellman? serverKey = null)
        {
            var uaPublic = B64.Decode(p256dh);
            var authSecret = B64.Decode(auth);
            salt ??= RandomNumberGenerator.GetBytes(16);

            using var server = serverKey ?? ECDiffieHellman.Create(ECCurve.NamedCurves.nistP256);
            var asPublic = Uncompressed(server.ExportParameters(false).Q);
            using var ua = ECDiffieHellman.Create(PublicFromUncompressed(uaPublic));
            var ecdhSecret = server.DeriveRawSecretAgreement(ua.PublicKey);

            var keyInfo = Concat(Encoding.ASCII.GetBytes("WebPush: info\0"), uaPublic, asPublic);
            var ikm = HKDF.DeriveKey(HashAlgorithmName.SHA256, ecdhSecret, 32, authSecret, keyInfo);
            var cek = HKDF.DeriveKey(HashAlgorithmName.SHA256, ikm, 16, salt, Encoding.ASCII.GetBytes("Content-Encoding: aes128gcm\0"));
            var nonce = HKDF.DeriveKey(HashAlgorithmName.SHA256, ikm, 12, salt, Encoding.ASCII.GetBytes("Content-Encoding: nonce\0"));

            var padded = Concat(plaintext, [0x02]);                       // 0x02 = last (only) record
            if (padded.Length + 16 > RecordSize - 86) throw new ArgumentException("Push payload too large");
            var cipher = new byte[padded.Length];
            var tag = new byte[16];
            using (var gcm = new AesGcm(cek, 16)) gcm.Encrypt(nonce, padded, cipher, tag);

            var header = new byte[16 + 4 + 1 + asPublic.Length];
            salt.CopyTo(header, 0);
            header[16] = 0; header[17] = 0; header[18] = RecordSize >> 8; header[19] = RecordSize & 0xFF;
            header[20] = (byte)asPublic.Length;
            asPublic.CopyTo(header, 21);
            return Concat(header, cipher, tag);
        }

        /// <summary>RFC 8292 header: "vapid t=&lt;signed JWT&gt;, k=&lt;public key&gt;"</summary>
        public static string VapidHeader(string endpoint, string subject, string publicKey, string privateKey, DateTimeOffset? now = null)
        {
            var aud = new Uri(endpoint).GetLeftPart(UriPartial.Authority);
            var exp = (now ?? DateTimeOffset.UtcNow).AddHours(12).ToUnixTimeSeconds();
            var head = B64.Encode(Encoding.UTF8.GetBytes("{\"typ\":\"JWT\",\"alg\":\"ES256\"}"));
            var body = B64.Encode(JsonSerializer.SerializeToUtf8Bytes(new { aud, exp, sub = subject }));

            var pub = PublicFromUncompressed(B64.Decode(publicKey));
            pub.D = B64.Decode(privateKey);
            using var ec = ECDsa.Create(pub);
            var sig = ec.SignData(Encoding.ASCII.GetBytes($"{head}.{body}"), HashAlgorithmName.SHA256, DSASignatureFormat.IeeeP1363FixedFieldConcatenation);
            return $"vapid t={head}.{body}.{B64.Encode(sig)}, k={publicKey}";
        }

        private static byte[] Concat(params byte[][] parts)
        {
            var r = new byte[parts.Sum(p => p.Length)];
            int o = 0;
            foreach (var p in parts) { p.CopyTo(r, o); o += p.Length; }
            return r;
        }
    }
}
