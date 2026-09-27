using System.Collections.Concurrent;
using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using DailyTrackerAPI.Data;
using DailyTrackerAPI.Helpers;
using DailyTrackerAPI.Models.Auth;
using DailyTrackerAPI.Models.Communication;
using Microsoft.AspNetCore.Http.Connections;
using Microsoft.AspNetCore.SignalR;
using Microsoft.AspNetCore.SignalR.Client;
using Microsoft.Extensions.DependencyInjection;

namespace DailyTrackerAPI.Tests;

/// <summary>
/// Live chat through the real SignalR hub (/hubs/chat) and REST endpoints:
/// who receives what, unread counts across reconnects, and catching up on
/// messages sent while offline.
///   users 1 (Mangesh) and 2 (Priya) are in group chat 1; 3 (Outsider) is not.
/// </summary>
public class ChatHubTests : IAsyncLifetime
{
    private readonly ApiFactory _factory = new();
    private readonly Dictionary<int, User> _users = new();
    private readonly List<HubConnection> _connections = new();

    public Task InitializeAsync()
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        db.Database.EnsureCreated();
        foreach (var (id, name) in new[] { (1, "Mangesh"), (2, "Priya"), (3, "Outsider") })
            _users[id] = new User { Id = id, FullName = name, Email = $"u{id}@test.dev", PasswordHash = "x", Role = "Developer", IsActive = true };
        db.Users.AddRange(_users.Values);
        var conv = new Conversation { Id = 1, Type = "Group", GroupName = "Dev", CreatedByUserId = 1 };
        conv.Members.Add(new ConversationMember { UserId = 1, Role = "Admin" });
        conv.Members.Add(new ConversationMember { UserId = 2, Role = "Member" });
        db.Conversations.Add(conv);
        db.SaveChanges();
        return Task.CompletedTask;
    }

    public async Task DisposeAsync()
    {
        foreach (var c in _connections) await c.DisposeAsync();
        _factory.Dispose();
    }

    // ── helpers ───────────────────────────────────────────────────────────

    private string TokenFor(int userId)
    {
        using var scope = _factory.Services.CreateScope();
        return scope.ServiceProvider.GetRequiredService<JwtHelper>().GenerateAccessToken(_users[userId]).Token;
    }

    private HttpClient Http(int userId)
    {
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", TokenFor(userId));
        return client;
    }

    /// <summary>A signed-in browser tab: a hub connection that records every event it gets</summary>
    private async Task<Tab> Connect(int userId)
    {
        _factory.CreateClient().Dispose();                       // make sure the test server is running
        var token = TokenFor(userId);
        var conn = new HubConnectionBuilder()
            .WithUrl(new Uri(_factory.Server.BaseAddress, "hubs/chat"), o =>
            {
                o.Transports = HttpTransportType.LongPolling;
                o.HttpMessageHandlerFactory = _ => _factory.Server.CreateHandler();
                o.AccessTokenProvider = () => Task.FromResult<string?>(token);
            })
            .Build();
        var tab = new Tab(conn);
        await conn.StartAsync();
        _connections.Add(conn);
        return tab;
    }

    private static Task<HttpResponseMessage> Send(HttpClient http, int conversationId, string text) =>
        http.PostAsJsonAsync("/api/chat/messages", new { conversationId, content = text });

    private static async Task<JsonElement> Json(HttpResponseMessage r)
    {
        Assert.True(r.IsSuccessStatusCode, $"{(int)r.StatusCode}: {await r.Content.ReadAsStringAsync()}");
        return JsonDocument.Parse(await r.Content.ReadAsStringAsync()).RootElement;
    }

    private static async Task<int> Unread(HttpClient http, int conversationId)
    {
        var counts = await Json(await http.GetAsync("/api/chat/unread-counts"));
        return counts.TryGetProperty(conversationId.ToString(), out var n) ? n.GetInt32() : 0;
    }

    // ── tests ─────────────────────────────────────────────────────────────

    [Fact]
    public async Task Messages_reach_members_live_but_never_outsiders()
    {
        var mangesh = await Connect(1);
        var priya = await Connect(2);
        var outsider = await Connect(3);

        await Json(await Send(Http(2), 1, "hi team"));

        var got = await mangesh.Next("ReceiveMessage");
        Assert.Equal("hi team", got.GetProperty("content").GetString());
        Assert.Equal(2, got.GetProperty("senderId").GetInt32());
        await priya.Next("ReceiveMessage");                      // the sender's other tabs update too
        await outsider.ExpectNone("ReceiveMessage");
    }

    [Fact]
    public async Task Outsiders_cannot_subscribe_to_someone_elses_chat()
    {
        var outsider = await Connect(3);

        var ex = await Assert.ThrowsAsync<HubException>(() => outsider.Connection.InvokeAsync("JoinConversation", 1));
        Assert.Contains("not a member", ex.Message);

        await Json(await Send(Http(2), 1, "private"));
        await outsider.ExpectNone("ReceiveMessage");
    }

    [Fact]
    public async Task A_new_direct_chat_is_joined_live_by_the_other_person()
    {
        var outsider = await Connect(3);

        var dm = await Json(await Http(1).PostAsync("/api/chat/conversations/direct/3", null));
        var dmId = dm.GetProperty("id").GetInt32();

        Assert.Equal(dmId, (await outsider.Next("JoinConversation")).GetInt32());
        await outsider.Connection.InvokeAsync("JoinConversation", dmId);   // what the UI does on that event

        await Json(await Send(Http(1), dmId, "welcome"));
        Assert.Equal("welcome", (await outsider.Next("ReceiveMessage")).GetProperty("content").GetString());
    }

    [Fact]
    public async Task Reactions_are_shared_with_members_only()
    {
        var priya = await Connect(2);
        var outsider = await Connect(3);
        var msg = await Json(await Send(Http(2), 1, "ship it?"));
        var messageId = msg.GetProperty("id").GetInt32();

        await Json(await Http(1).PostAsJsonAsync($"/api/chat/messages/{messageId}/react", new { emoji = "👍" }));

        var update = await priya.Next("ReactionUpdated");
        Assert.Equal(messageId, update.GetProperty("messageId").GetInt32());
        Assert.Equal(1, update.GetProperty("reactionCounts").GetProperty("👍").GetInt32());
        await outsider.ExpectNone("ReactionUpdated");

        var denied = await Http(3).PostAsJsonAsync($"/api/chat/messages/{messageId}/react", new { emoji = "👎" });
        Assert.Equal(HttpStatusCode.Forbidden, denied.StatusCode);
        var missing = await Http(1).PostAsJsonAsync("/api/chat/messages/999999/react", new { emoji = "👍" });
        Assert.Equal(HttpStatusCode.NotFound, missing.StatusCode);
    }

    [Fact]
    public async Task Unread_count_ignores_own_messages_survives_relogin_and_clears_on_read()
    {
        var priya = await Connect(2);
        await Json(await Send(Http(2), 1, "one"));
        await Json(await Send(Http(2), 1, "two"));
        await Json(await Send(Http(1), 1, "my reply"));          // my own message never counts

        Assert.Equal(2, await Unread(Http(1), 1));

        // log in again (new token, new connection): still unread
        var mangesh = await Connect(1);
        Assert.Equal(2, await Unread(Http(1), 1));

        (await Http(1).PostAsync("/api/chat/conversations/1/read", null)).EnsureSuccessStatusCode();
        Assert.Equal(0, await Unread(Http(1), 1));
        Assert.Equal(1, (await priya.Next("ConversationRead")).GetProperty("userId").GetInt32());

        // and it stays read after logging in again
        await mangesh.Connection.StopAsync();
        await Connect(1);
        Assert.Equal(0, await Unread(Http(1), 1));
    }

    [Fact]
    public async Task Outsiders_cannot_mark_a_chat_read_or_fake_typing()
    {
        var priya = await Connect(2);
        var outsider = await Connect(3);

        var denied = await Http(3).PostAsync("/api/chat/conversations/1/read", null);
        Assert.Equal(HttpStatusCode.Forbidden, denied.StatusCode);
        await outsider.Connection.InvokeAsync("MarkRead", 1);
        await outsider.Connection.InvokeAsync("StartTyping", 1);

        await priya.ExpectNone("ConversationRead");
        await priya.ExpectNone("UserTyping");

        // a member typing does reach the others
        var mangesh = await Connect(1);
        await mangesh.Connection.InvokeAsync("StartTyping", 1);
        Assert.Equal(1, (await priya.Next("UserTyping")).GetProperty("userId").GetInt32());
    }

    [Fact]
    public async Task Messages_sent_while_offline_are_in_history_and_live_updates_resume()
    {
        var mangesh = await Connect(1);
        await mangesh.Connection.StopAsync();                    // closed the laptop

        await Json(await Send(Http(2), 1, "sent while you were away"));

        var back = await Connect(1);                             // reconnected
        var history = await Json(await Http(1).GetAsync("/api/chat/conversations/1/messages?pageSize=50"));
        Assert.Contains(history.EnumerateArray(), m => m.GetProperty("content").GetString() == "sent while you were away");

        await Json(await Send(Http(2), 1, "welcome back"));
        Assert.Equal("welcome back", (await back.Next("ReceiveMessage")).GetProperty("content").GetString());
    }

    /// <summary>Records hub events so tests can wait for (or rule out) one</summary>
    private sealed class Tab
    {
        private readonly ConcurrentDictionary<string, BlockingCollection<JsonElement>> _events = new();
        public HubConnection Connection { get; }

        public Tab(HubConnection connection)
        {
            Connection = connection;
            foreach (var name in new[] { "ReceiveMessage", "ReactionUpdated", "ConversationRead", "UserTyping", "JoinConversation" })
                connection.On<JsonElement>(name, e => Queue(name).Add(e.Clone()));
        }

        private BlockingCollection<JsonElement> Queue(string name) => _events.GetOrAdd(name, _ => new());

        public Task<JsonElement> Next(string name) => Task.Run(() =>
            Queue(name).TryTake(out var e, TimeSpan.FromSeconds(10))
                ? e
                : throw new TimeoutException($"No '{name}' event within 10 s"));

        public async Task ExpectNone(string name)
        {
            await Task.Delay(700);
            Assert.True(Queue(name).Count == 0, $"Unexpected '{name}' event");
        }
    }
}
