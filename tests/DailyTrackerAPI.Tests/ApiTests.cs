using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using DailyTrackerAPI.Data;
using DailyTrackerAPI.Helpers;
using DailyTrackerAPI.Models.Auth;
using DailyTrackerAPI.Models.Communication;
using Microsoft.Extensions.DependencyInjection;

namespace DailyTrackerAPI.Tests;

/// <summary>Chat endpoints through the real ASP.NET pipeline (routing, auth, model binding)</summary>
public class ChatApiTests : IDisposable
{
    private readonly ApiFactory _factory = new();
    private readonly HttpClient _mangesh, _priya, _outsider;

    public ChatApiTests()
    {
        User u1, u2, u3;
        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            db.Database.EnsureCreated();
            u1 = new User { Id = 1, FullName = "Mangesh", Email = "m@test.dev", PasswordHash = "x", Role = "TeamLead", IsActive = true };
            u2 = new User { Id = 2, FullName = "Priya", Email = "p@test.dev", PasswordHash = "x", Role = "Developer", IsActive = true };
            u3 = new User { Id = 3, FullName = "Outsider", Email = "o@test.dev", PasswordHash = "x", Role = "Developer", IsActive = true };
            db.Users.AddRange(u1, u2, u3);
            var conv = new Conversation { Id = 1, Type = "Direct", CreatedByUserId = 1 };
            conv.Members.Add(new ConversationMember { UserId = 1 });
            conv.Members.Add(new ConversationMember { UserId = 2 });
            db.Conversations.Add(conv);
            db.SaveChanges();
        }
        _mangesh = ClientFor(u1); _priya = ClientFor(u2); _outsider = ClientFor(u3);
    }

    public void Dispose() => _factory.Dispose();

    private HttpClient ClientFor(User u)
    {
        using var scope = _factory.Services.CreateScope();
        var token = scope.ServiceProvider.GetRequiredService<JwtHelper>().GenerateAccessToken(u).Token;
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
        return client;
    }

    private static MultipartFormDataContent Upload(string name, byte[] bytes, string? caption = null)
    {
        var form = new MultipartFormDataContent();
        var file = new ByteArrayContent(bytes);
        file.Headers.ContentType = new MediaTypeHeaderValue("application/octet-stream");
        form.Add(file, "file", name);
        if (caption != null) form.Add(new StringContent(caption), "caption");
        return form;
    }

    private static async Task<JsonElement> Json(HttpResponseMessage r) =>
        JsonDocument.Parse(await r.Content.ReadAsStringAsync()).RootElement;

    [Fact]
    public async Task Image_upload_and_member_download_round_trip()
    {
        var up = await _mangesh.PostAsync("/api/chat/conversations/1/attachments", Upload("photo.png", TestFiles.Png, "look"));
        Assert.Equal(HttpStatusCode.OK, up.StatusCode);
        var msg = await Json(up);
        Assert.Equal("Image", msg.GetProperty("messageType").GetString());
        Assert.Equal(TestFiles.Png.Length, msg.GetProperty("attachmentSize").GetInt64());
        var url = msg.GetProperty("attachmentUrl").GetString()!;

        var dl = await _priya.GetAsync(url);
        Assert.Equal(HttpStatusCode.OK, dl.StatusCode);
        Assert.Equal("image/png", dl.Content.Headers.ContentType?.MediaType);
        Assert.Equal("inline", dl.Content.Headers.ContentDisposition?.DispositionType);
        Assert.Equal("nosniff", dl.Headers.GetValues("X-Content-Type-Options").Single());
        Assert.True(dl.Headers.CacheControl?.Private);
        Assert.Equal(TestFiles.Png, await dl.Content.ReadAsByteArrayAsync());

        var forced = await _priya.GetAsync(url + "?download=true");
        Assert.Equal("attachment", forced.Content.Headers.ContentDisposition?.DispositionType);
    }

    [Fact]
    public async Task Attachment_access_requires_membership_and_login()
    {
        var url = (await Json(await _mangesh.PostAsync("/api/chat/conversations/1/attachments", Upload("a.png", TestFiles.Png))))
            .GetProperty("attachmentUrl").GetString()!;

        Assert.Equal(HttpStatusCode.Forbidden, (await _outsider.GetAsync(url)).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await _factory.CreateClient().GetAsync(url)).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden,
            (await _outsider.PostAsync("/api/chat/conversations/1/attachments", Upload("b.png", TestFiles.Png))).StatusCode);
    }

    [Fact]
    public async Task Non_media_files_always_download_and_unsafe_types_are_refused()
    {
        var txtUrl = (await Json(await _mangesh.PostAsync("/api/chat/conversations/1/attachments", Upload("notes.txt", "hello"u8.ToArray()))))
            .GetProperty("attachmentUrl").GetString()!;
        Assert.Equal("attachment", (await _priya.GetAsync(txtUrl)).Content.Headers.ContentDisposition?.DispositionType);

        var svg = await _mangesh.PostAsync("/api/chat/conversations/1/attachments", Upload("x.svg", "<svg onload=alert(1)>"u8.ToArray()));
        Assert.Equal(HttpStatusCode.BadRequest, svg.StatusCode);
        Assert.Contains("can't be shared", await svg.Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task Attachments_are_stored_outside_the_public_web_root()
    {
        await _mangesh.PostAsync("/api/chat/conversations/1/attachments", Upload("a.png", TestFiles.Png));

        Assert.True(Directory.Exists(Path.Combine(_factory.ContentRoot, "App_Data", "chat", "1")));
        Assert.False(Directory.Exists(Path.Combine(_factory.ContentRoot, "wwwroot", "chat")));
        Assert.Equal(HttpStatusCode.NotFound, (await _mangesh.GetAsync("/App_Data/chat/1/")).StatusCode);
    }

    [Fact]
    public async Task Poll_lifecycle_over_http()
    {
        var created = await _mangesh.PostAsJsonAsync("/api/chat/conversations/1/polls",
            new { question = "Deploy Friday?", options = new[] { "Yes", "No" }, allowMultiple = false });
        Assert.Equal(HttpStatusCode.OK, created.StatusCode);
        var poll = (await Json(created)).GetProperty("poll");
        var pollId = poll.GetProperty("id").GetInt32();
        var yes = poll.GetProperty("options")[0].GetProperty("id").GetInt32();

        var vote = await _priya.PostAsJsonAsync($"/api/chat/polls/{pollId}/vote", new { optionIds = new[] { yes } });
        Assert.Equal(HttpStatusCode.OK, vote.StatusCode);
        Assert.Equal(2, (await Json(vote)).GetProperty("poll").GetProperty("options")[0].GetProperty("voterIds")[0].GetInt32());

        Assert.Equal(HttpStatusCode.BadRequest, (await _mangesh.PostAsJsonAsync("/api/chat/conversations/1/polls",
            new { question = "", options = new[] { "A", "B" } })).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await _priya.PostAsync($"/api/chat/polls/{pollId}/close", null)).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await _mangesh.PostAsync($"/api/chat/polls/{pollId}/close", null)).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest,
            (await _priya.PostAsJsonAsync($"/api/chat/polls/{pollId}/vote", new { optionIds = new[] { yes } })).StatusCode);
    }

    [Fact]
    public async Task Mention_creates_a_bell_notification_with_a_link_to_the_chat()
    {
        var sent = await _mangesh.PostAsJsonAsync("/api/chat/messages",
            new { conversationId = 1, content = "@Priya can you check?", mentionedUserIds = new[] { 2, 3 } });
        Assert.Equal(HttpStatusCode.OK, sent.StatusCode);
        Assert.Equal(new[] { 2 }, (await Json(sent)).GetProperty("mentionedUserIds").EnumerateArray().Select(e => e.GetInt32()));

        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var n = db.Notifications.Single();
        Assert.Equal(2, n.UserId);                       // not the outsider (3)
        Assert.Contains("Mangesh mentioned you", n.Title);
        Assert.Equal("/chat?c=1", n.ActionUrl);
    }

    [Fact]
    public async Task Pin_endpoints_and_pinned_list()
    {
        var id = (await Json(await _mangesh.PostAsJsonAsync("/api/chat/messages", new { conversationId = 1, content = "pin me" })))
            .GetProperty("id").GetInt32();

        var pin = await _priya.PostAsync($"/api/chat/messages/{id}/pin", null);
        Assert.Equal(HttpStatusCode.OK, pin.StatusCode);
        Assert.True((await Json(pin)).GetProperty("isPinned").GetBoolean());
        Assert.Single((await _priya.GetFromJsonAsync<JsonElement>("/api/chat/conversations/1/pinned")).EnumerateArray());
        Assert.Equal(HttpStatusCode.Forbidden, (await _outsider.PostAsync($"/api/chat/messages/{id}/pin", null)).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await _outsider.GetAsync("/api/chat/conversations/1/pinned")).StatusCode);

        Assert.Equal(HttpStatusCode.OK, (await _mangesh.DeleteAsync($"/api/chat/messages/{id}/pin")).StatusCode);
        Assert.Empty((await _priya.GetFromJsonAsync<JsonElement>("/api/chat/conversations/1/pinned")).EnumerateArray());
    }

    [Fact]
    public async Task Text_endpoint_ignores_spoofed_fields_and_reports_missing_conversation_as_404()
    {
        var sent = await Json(await _mangesh.PostAsJsonAsync("/api/chat/messages",
            new { conversationId = 1, content = "hi", messageType = "System", attachmentUrl = "https://evil" }));
        Assert.Equal("Text", sent.GetProperty("messageType").GetString());
        Assert.Equal(JsonValueKind.Null, sent.GetProperty("attachmentUrl").ValueKind);

        Assert.Equal(HttpStatusCode.NotFound,
            (await _mangesh.PostAsJsonAsync("/api/chat/messages", new { conversationId = 999, content = "x" })).StatusCode);
    }
}

/// <summary>Secrets handling and private uploads (Program.cs)</summary>
public class SecurityTests
{
    [Fact]
    public void Api_refuses_to_start_without_a_jwt_key()
    {
        using var factory = new ApiFactory(jwtKey: "");
        var ex = Assert.ThrowsAny<Exception>(() => factory.Services);
        Assert.Contains("Jwt:Key is missing", ex.ToString());
        Assert.Contains("setup-secrets.ps1", ex.ToString());
    }

    [Fact]
    public void Api_refuses_a_short_jwt_key()
    {
        using var factory = new ApiFactory(jwtKey: "too-short");
        Assert.ThrowsAny<Exception>(() => factory.Services);
    }

    [Fact]
    public void Committed_appsettings_contains_no_secrets()
    {
        var json = File.ReadAllText(Path.Combine(Paths.ApiProject, "appsettings.json"));
        Assert.DoesNotContain("AIza", json);   // Google API keys
        foreach (var key in new[] { "\"Key\"", "\"Password\"", "\"ApiKey\"", "\"Username\"" })
        {
            var line = json.Split('\n').FirstOrDefault(l => l.Contains(key));
            Assert.True(line == null || line.Contains("\"\""), $"{key} must be empty in appsettings.json (use user secrets)");
        }
    }

    [Theory]
    [InlineData("/uploads/documents/6/salary-slip.pdf")]
    [InlineData("/uploads/support/10/shot.png")]
    [InlineData("/uploads/certifications/3/cert.pdf")]
    [InlineData("/UPLOADS/Documents/6/salary-slip.pdf")]
    public async Task Private_uploads_are_not_served_as_static_files(string path)
    {
        using var factory = new ApiFactory(prepareContentRoot: SeedUploads);
        var res = await factory.CreateClient().GetAsync(path);
        Assert.Equal(HttpStatusCode.NotFound, res.StatusCode);
    }

    [Fact]
    public async Task Profile_photos_stay_public()
    {
        using var factory = new ApiFactory(prepareContentRoot: SeedUploads);
        var res = await factory.CreateClient().GetAsync("/uploads/avatars/a.jpg");
        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
    }

    private static void SeedUploads(string root)
    {
        var web = Path.Combine(root, "wwwroot", "uploads");
        foreach (var (dir, file) in new[] { ("avatars", "a.jpg"), ("documents/6", "salary-slip.pdf"), ("support/10", "shot.png"), ("certifications/3", "cert.pdf") })
        {
            Directory.CreateDirectory(Path.Combine(web, dir));
            File.WriteAllText(Path.Combine(web, dir, file), "x");
        }
    }
}
