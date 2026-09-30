using System.Net;
using System.Net.Http.Json;
using DailyTrackerAPI.Data;
using DailyTrackerAPI.Models.Auth;
using Microsoft.Extensions.DependencyInjection;

namespace DailyTrackerAPI.Tests;

/// <summary>
/// How long a sign-in lasts (30 Sep 2026):
///   "Trust this device" ticked   → cookies with an expiry date (stays signed in for days)
///   not ticked (the new default) → cookies without an expiry date: gone when the browser closes,
///                                  and token renewal keeps it that way
/// </summary>
public class SessionCookieTests : IDisposable
{
    private readonly ApiFactory _factory = new();
    private const string Password = "Passw0rd!23";

    public SessionCookieTests()
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        TestDatabase.CreateSchema(db);
        db.Users.Add(new User { Id = 1, FullName = "Mangesh", Email = "m@test.dev", Role = "Manager", IsActive = true,
                                PasswordHash = BCrypt.Net.BCrypt.HashPassword(Password) });
        db.SaveChanges();
        TestDatabase.AfterSeed(db);
    }

    public void Dispose() => _factory.Dispose();

    private async Task<(HttpResponseMessage res, HttpClient client)> Login(string? remember)
    {
        var client = _factory.CreateClient(new() { HandleCookies = false });
        var req = new HttpRequestMessage(HttpMethod.Post, "/api/auth/login")
            { Content = JsonContent.Create(new { email = "m@test.dev", password = Password }) };
        if (remember != null) req.Headers.Add("X-Remember-Me", remember);
        var res = await client.SendAsync(req);
        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
        return (res, client);
    }

    private static string Cookie(HttpResponseMessage r, string name) =>
        r.Headers.GetValues("Set-Cookie").FirstOrDefault(c => c.StartsWith(name + "=")) ?? "";

    private static bool Persistent(string setCookie) => setCookie.Contains("expires=", StringComparison.OrdinalIgnoreCase);

    [Fact]
    public async Task Without_trust_the_sign_in_ends_when_the_browser_closes()
    {
        var (res, _) = await Login("false");
        Assert.False(Persistent(Cookie(res, "refreshToken")));   // no expiry → deleted when the browser closes
        Assert.False(Persistent(Cookie(res, "accessToken")));
        Assert.StartsWith("sessionMode=browser", Cookie(res, "sessionMode"));
        Assert.Contains("httponly", Cookie(res, "refreshToken"), StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task No_choice_sent_means_not_trusted()
    {
        var (res, _) = await Login(null);
        Assert.False(Persistent(Cookie(res, "refreshToken")));
    }

    [Fact]
    public async Task A_trusted_device_stays_signed_in()
    {
        var (res, _) = await Login("true");
        Assert.True(Persistent(Cookie(res, "refreshToken")));
        Assert.True(Persistent(Cookie(res, "accessToken")));
        Assert.Equal("", Cookie(res, "sessionMode").Split(';')[0].Replace("sessionMode=", ""));   // cleared, if sent at all
    }

    [Theory]
    [InlineData("false", false)]
    [InlineData("true", true)]
    public async Task Renewing_the_sign_in_keeps_the_same_kind(string remember, bool persistent)
    {
        var (res, client) = await Login(remember);
        var cookies = string.Join("; ", res.Headers.GetValues("Set-Cookie")
            .Select(c => c.Split(';')[0]).Where(c => !c.EndsWith("=")));
        var req = new HttpRequestMessage(HttpMethod.Post, "/api/auth/refresh");
        req.Headers.Add("Cookie", cookies);
        var renewed = await client.SendAsync(req);
        Assert.Equal(HttpStatusCode.OK, renewed.StatusCode);
        Assert.Equal(persistent, Persistent(Cookie(renewed, "refreshToken")));
    }
}
