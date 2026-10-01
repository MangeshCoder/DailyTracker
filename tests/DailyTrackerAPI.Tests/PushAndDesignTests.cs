using System.Collections.Concurrent;
using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using DailyTrackerAPI.Data;
using DailyTrackerAPI.Helpers;
using DailyTrackerAPI.Models.Auth;
using DailyTrackerAPI.Models.Communication;
using DailyTrackerAPI.Services.Communication;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace DailyTrackerAPI.Tests;

/// <summary>Pushes the app queued (instead of sending them in the background)</summary>
public sealed class CapturingPushSender : IPushSender
{
    public ConcurrentQueue<(int[] UserIds, PushMessage Message)> Sent { get; } = new();
    public void Enqueue(IEnumerable<int> userIds, PushMessage message) => Sent.Enqueue((userIds.ToArray(), message));
}

/// <summary>Stands in for Google / Mozilla / Apple's push servers</summary>
public sealed class FakePushServer : HttpMessageHandler
{
    public List<(HttpRequestMessage Request, byte[] Body)> Received { get; } = new();
    public HttpStatusCode Reply { get; set; } = HttpStatusCode.Created;
    protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct)
    {
        Received.Add((request, await request.Content!.ReadAsByteArrayAsync(ct)));
        return new HttpResponseMessage(Reply);
    }
}

/// <summary>
/// Phone push notifications and the colour design saved on the account (1 Oct 2026).
///   1 Mangesh (Manager) · 2 Priya · 3 Ravi
/// </summary>
public class PushAndDesignTests : IDisposable
{
    private readonly CapturingPushSender _queued = new();
    private readonly FakePushServer _pushServer = new();
    private readonly ApiFactory _factory;
    private readonly HttpClient _mangesh, _priya;

    public PushAndDesignTests()
    {
        VapidKeys.ResetCache();
        _factory = new ApiFactory(configureServices: s =>
        {
            s.AddSingleton<IPushSender>(_queued);
            s.AddHttpClient(PushDelivery.HttpClientName).ConfigurePrimaryHttpMessageHandler(() => _pushServer);
        });
        var users = new[]
        {
            new User { Id = 1, FullName = "Mangesh", Email = "m@test.dev", PasswordHash = "x", Role = "Manager", IsActive = true },
            new User { Id = 2, FullName = "Priya", Email = "p@test.dev", PasswordHash = "x", Role = "Developer", IsActive = true, ManagerId = 1 },
            new User { Id = 3, FullName = "Ravi", Email = "r@test.dev", PasswordHash = "x", Role = "Developer", IsActive = true, ManagerId = 1 },
        };
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        TestDatabase.CreateSchema(db);
        db.Users.AddRange(users);
        db.Conversations.Add(new Conversation { Id = 1, Type = "Direct", CreatedByUserId = 1 });
        db.Conversations.Add(new Conversation { Id = 2, Type = "Group", GroupName = "Team", CreatedByUserId = 1 });
        db.ConversationMembers.AddRange(
            new ConversationMember { ConversationId = 1, UserId = 1 }, new ConversationMember { ConversationId = 1, UserId = 2 },
            new ConversationMember { ConversationId = 2, UserId = 1 }, new ConversationMember { ConversationId = 2, UserId = 2 },
            new ConversationMember { ConversationId = 2, UserId = 3, IsMuted = true });
        db.SaveChanges();
        TestDatabase.AfterSeed(db);
        var jwt = scope.ServiceProvider.GetRequiredService<JwtHelper>();
        HttpClient Client(User u) { var c = _factory.CreateClient(); c.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", jwt.GenerateAccessToken(u).Token); return c; }
        _mangesh = Client(users[0]);
        _priya = Client(users[1]);
    }

    public void Dispose() { _factory.Dispose(); VapidKeys.ResetCache(); }

    private static async Task<JsonElement> Json(HttpResponseMessage r)
    {
        Assert.True(r.IsSuccessStatusCode, $"{(int)r.StatusCode} {await r.Content.ReadAsStringAsync()}");
        return JsonDocument.Parse(await r.Content.ReadAsStringAsync()).RootElement;
    }

    /// <summary>A browser's push keys, like PushManager.subscribe() makes</summary>
    private sealed class FakeBrowser : IDisposable
    {
        public ECDiffieHellman Key { get; } = ECDiffieHellman.Create(ECCurve.NamedCurves.nistP256);
        public byte[] AuthSecret { get; } = RandomNumberGenerator.GetBytes(16);
        public string P256dh => B64.Encode(WebPushCrypto.Uncompressed(Key.ExportParameters(false).Q));
        public string Auth => B64.Encode(AuthSecret);
        public void Dispose() => Key.Dispose();

        /// <summary>Decrypts an aes128gcm push body the way a browser does (RFC 8291 / 8188)</summary>
        public byte[] Decrypt(byte[] body)
        {
            var salt = body[..16];
            var rs = (body[16] << 24) | (body[17] << 16) | (body[18] << 8) | body[19];
            Assert.Equal(4096, rs);
            var idLen = body[20];
            var asPublic = body[21..(21 + idLen)];
            var cipher = body[(21 + idLen)..];

            using var server = ECDiffieHellman.Create(new ECParameters
            { Curve = ECCurve.NamedCurves.nistP256, Q = new ECPoint { X = asPublic[1..33], Y = asPublic[33..65] } });
            var secret = Key.DeriveRawSecretAgreement(server.PublicKey);
            var uaPublic = B64.Decode(P256dh);
            var keyInfo = Encoding.ASCII.GetBytes("WebPush: info\0").Concat(uaPublic).Concat(asPublic).ToArray();
            var ikm = HKDF.DeriveKey(HashAlgorithmName.SHA256, secret, 32, AuthSecret, keyInfo);
            var cek = HKDF.DeriveKey(HashAlgorithmName.SHA256, ikm, 16, salt, Encoding.ASCII.GetBytes("Content-Encoding: aes128gcm\0"));
            var nonce = HKDF.DeriveKey(HashAlgorithmName.SHA256, ikm, 12, salt, Encoding.ASCII.GetBytes("Content-Encoding: nonce\0"));
            var plain = new byte[cipher.Length - 16];
            using (var gcm = new AesGcm(cek, 16)) gcm.Decrypt(nonce, cipher[..^16], cipher[^16..], plain);
            Assert.Equal(0x02, plain[^1]);                     // last-record delimiter
            return plain[..^1];
        }
    }

    private Task<HttpResponseMessage> Subscribe(HttpClient c, FakeBrowser b, string endpoint = "https://fcm.googleapis.com/fcm/send/abc123") =>
        c.PostAsJsonAsync("/api/push/subscribe", new { endpoint, keys = new { p256dh = b.P256dh, auth = b.Auth }, device = "Android · Chrome" });

    // ── design ──────────────────────────────────────────────────────────────

    [Fact]
    public async Task The_chosen_design_is_saved_on_the_account()
    {
        Assert.Equal(JsonValueKind.Null, (await Json(await _priya.GetAsync("/api/auth/me"))).GetProperty("uiDesign").ValueKind);

        await Json(await _priya.PutAsJsonAsync("/api/profile/me/design", new { design = "purple" }));
        Assert.Equal("purple", (await Json(await _priya.GetAsync("/api/auth/me"))).GetProperty("uiDesign").GetString());
        Assert.Equal(JsonValueKind.Null, (await Json(await _mangesh.GetAsync("/api/auth/me"))).GetProperty("uiDesign").ValueKind);   // only hers

        var bad = await _priya.PutAsJsonAsync("/api/profile/me/design", new { design = "pink" });
        Assert.Equal(HttpStatusCode.BadRequest, bad.StatusCode);
    }

    // ── subscriptions ───────────────────────────────────────────────────────

    [Fact]
    public async Task A_device_subscribes_and_unsubscribes_and_bad_ones_are_refused()
    {
        using var phone = new FakeBrowser();
        await Json(await Subscribe(_priya, phone));
        await Json(await Subscribe(_priya, phone));                                   // again: still one row
        var devices = await Json(await _priya.GetAsync("/api/push/devices"));
        Assert.Equal("Android · Chrome", devices.EnumerateArray().Single().GetProperty("device").GetString());

        Assert.Equal(HttpStatusCode.BadRequest, (await Subscribe(_priya, phone, "http://insecure.example/x")).StatusCode);
        var badKeys = await _priya.PostAsJsonAsync("/api/push/subscribe",
            new { endpoint = "https://fcm.googleapis.com/fcm/send/zz", keys = new { p256dh = "abc", auth = "def" } });
        Assert.Equal(HttpStatusCode.BadRequest, badKeys.StatusCode);

        // the same browser used by someone else later belongs to them now
        await Json(await Subscribe(_mangesh, phone));
        Assert.Empty((await Json(await _priya.GetAsync("/api/push/devices"))).EnumerateArray());
        Assert.Single((await Json(await _mangesh.GetAsync("/api/push/devices"))).EnumerateArray());

        await Json(await _mangesh.PostAsJsonAsync("/api/push/unsubscribe", new { endpoint = "https://fcm.googleapis.com/fcm/send/abc123" }));
        Assert.Empty((await Json(await _mangesh.GetAsync("/api/push/devices"))).EnumerateArray());
    }

    // ── what gets pushed ────────────────────────────────────────────────────

    [Fact]
    public async Task Every_bell_notification_is_also_pushed()
    {
        using (var scope = _factory.Services.CreateScope())
            await scope.ServiceProvider.GetRequiredService<IAppNotificationService>()
                .CreateAsync(2, "Leave approved", "Your leave on 14 Oct was approved", "Success", "/leave");

        var (to, msg) = Assert.Single(_queued.Sent);
        Assert.Equal(new[] { 2 }, to);
        Assert.Equal(("Leave approved", "Your leave on 14 Oct was approved", "/leave"), (msg.Title, msg.Body, msg.Url));
    }

    [Fact]
    public async Task Chat_messages_are_pushed_to_members_without_the_app_open_except_muted_and_sender()
    {
        await Json(await _mangesh.PostAsJsonAsync("/api/chat/messages", new { conversationId = 1, content = "Can you review the PR?" }));
        var (to, msg) = Assert.Single(_queued.Sent);
        Assert.Equal(new[] { 2 }, to);
        Assert.Equal(("Mangesh", "Can you review the PR?", "/chat?c=1", "chat-1"), (msg.Title, msg.Body, msg.Url, msg.Tag));

        _queued.Sent.Clear();
        await Json(await _priya.PostAsJsonAsync("/api/chat/messages", new { conversationId = 2, content = "Standup in 5" }));
        (to, msg) = Assert.Single(_queued.Sent);
        Assert.Equal(new[] { 1 }, to);                                                 // Ravi muted the group, Priya sent it
        Assert.Equal(("Team", "Priya: Standup in 5"), (msg.Title, msg.Body));
    }

    // ── the encryption matches the standard's own example (RFC 8291 §5) ──────

    [Fact]
    public void Encryption_matches_the_RFC_8291_example()
    {
        static ECDiffieHellman Key(string priv, string pub)
        {
            var q = B64.Decode(pub);
            return ECDiffieHellman.Create(new ECParameters
            { Curve = ECCurve.NamedCurves.nistP256, D = B64.Decode(priv), Q = new ECPoint { X = q[1..33], Y = q[33..65] } });
        }
        const string uaPublic = "BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4";
        const string authSecret = "BTBZMqHH6r4Tts7J_aSIgg";
        const string expected = "DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPTpK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN";
        var plaintext = Encoding.UTF8.GetBytes("When I grow up, I want to be a watermelon");

        // RFC 8291 uses a 4096-byte record size, like we do
        using var server = Key("yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw",
            "BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8");
        var body = WebPushCrypto.Encrypt(plaintext, uaPublic, authSecret, B64.Decode("DGv6ra1nlYgDCS1FRnbzlw"), server);
        Assert.Equal(expected, B64.Encode(body));
    }

    // ── delivery ────────────────────────────────────────────────────────────

    [Fact]
    public async Task A_push_is_encrypted_for_the_device_and_signed_with_the_servers_key()
    {
        using var phone = new FakeBrowser();
        await Json(await Subscribe(_priya, phone));
        var publicKey = (await Json(await _priya.GetAsync("/api/push/config"))).GetProperty("publicKey").GetString()!;
        Assert.Equal(publicKey, (await Json(await _mangesh.GetAsync("/api/push/config"))).GetProperty("publicKey").GetString());   // same key every time

        var test = await Json(await _priya.PostAsync("/api/push/test", null));
        Assert.Equal(1, test.GetProperty("sent").GetInt32());

        var (req, body) = Assert.Single(_pushServer.Received);
        Assert.Equal("https://fcm.googleapis.com/fcm/send/abc123", req.RequestUri!.ToString());
        Assert.Equal("aes128gcm", req.Content!.Headers.ContentEncoding.Single());
        Assert.Equal("86400", req.Headers.GetValues("TTL").Single());

        // only this device can read it
        var payload = JsonDocument.Parse(phone.Decrypt(body)).RootElement;
        Assert.Equal("DailyTracker", payload.GetProperty("title").GetString());
        Assert.Equal("/notifications", payload.GetProperty("url").GetString());

        // VAPID: "vapid t=<JWT>, k=<server public key>", JWT signed by that key, for that push server
        var auth = req.Headers.GetValues("Authorization").Single();
        Assert.StartsWith("vapid t=", auth);
        Assert.EndsWith($", k={publicKey}", auth);
        var jwt = auth["vapid t=".Length..auth.IndexOf(',')].Split('.');
        var claims = JsonDocument.Parse(B64.Decode(jwt[1])).RootElement;
        Assert.Equal("https://fcm.googleapis.com", claims.GetProperty("aud").GetString());
        Assert.StartsWith("mailto:", claims.GetProperty("sub").GetString());
        var pk = B64.Decode(publicKey);
        using var verify = ECDsa.Create(new ECParameters { Curve = ECCurve.NamedCurves.nistP256, Q = new ECPoint { X = pk[1..33], Y = pk[33..65] } });
        Assert.True(verify.VerifyData(Encoding.ASCII.GetBytes($"{jwt[0]}.{jwt[1]}"), B64.Decode(jwt[2]), HashAlgorithmName.SHA256));
    }

    [Fact]
    public async Task A_device_the_push_service_no_longer_knows_is_forgotten()
    {
        using var phone = new FakeBrowser();
        await Json(await Subscribe(_priya, phone));
        _pushServer.Reply = HttpStatusCode.Gone;

        var test = await Json(await _priya.PostAsync("/api/push/test", null));
        Assert.Equal(0, test.GetProperty("sent").GetInt32());
        Assert.Empty((await Json(await _priya.GetAsync("/api/push/devices"))).EnumerateArray());
    }
}
