using DailyTrackerAPI.Data;
using DailyTrackerAPI.Models.Auth;
using DailyTrackerAPI.Models.Communication;
using DailyTrackerAPI.Services.Communication;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Migrations;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.FileProviders;
using Microsoft.Extensions.Hosting;

// Tests change process-wide environment variables (Jwt__Key) — run them one at a time.
[assembly: CollectionBehavior(DisableTestParallelization = true)]

namespace DailyTrackerAPI.Tests;

/// <summary>Where the real API project lives (for appsettings.json)</summary>
internal static class Paths
{
    public static string ApiProject { get; } = FindApiProject();

    private static string FindApiProject()
    {
        var dir = new DirectoryInfo(AppContext.BaseDirectory);
        while (dir != null && !File.Exists(Path.Combine(dir.FullName, "api", "DailyTrackerAPI.csproj")))
            dir = dir.Parent;
        return dir == null
            ? throw new InvalidOperationException("Could not locate the api/ folder from " + AppContext.BaseDirectory)
            : Path.Combine(dir.FullName, "api");
    }

    public static string NewTempDir(string prefix)
    {
        var path = Path.Combine(Path.GetTempPath(), $"{prefix}-{Guid.NewGuid():N}");
        Directory.CreateDirectory(path);
        return path;
    }
}

internal static class TestFiles
{
    /// <summary>A real 1×1 PNG</summary>
    public static readonly byte[] Png = Convert.FromBase64String(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=");

    public static IFormFile Form(string name, byte[] bytes) =>
        new FormFile(new MemoryStream(bytes), 0, bytes.Length, "file", name)
        {
            Headers = new HeaderDictionary(),
            ContentType = "application/octet-stream"
        };
}

/// <summary>IWebHostEnvironment pointing at a temp folder (attachment storage)</summary>
internal sealed class FakeEnv(string root) : IWebHostEnvironment
{
    public string WebRootPath { get; set; } = Path.Combine(root, "wwwroot");
    public IFileProvider WebRootFileProvider { get; set; } = new NullFileProvider();
    public string ApplicationName { get; set; } = "DailyTrackerAPI.Tests";
    public IFileProvider ContentRootFileProvider { get; set; } = new NullFileProvider();
    public string ContentRootPath { get; set; } = root;
    public string EnvironmentName { get; set; } = "Test";
}

/// <summary>
/// In-memory SQLite database with the real EF model, seeded with:
///   users 1 (Mangesh), 2 (Priya), 3 (Outsider)
///   conversation 1 = group "Dev" with users 1 (Admin) and 2
/// </summary>
public sealed class ChatTestDb : IDisposable
{
    private readonly SqliteConnection _conn;
    private readonly DbContextOptions<AppDbContext> _options;
    public string StorageRoot { get; } = Paths.NewTempDir("chat-tests");

    public ChatTestDb()
    {
        _conn = new SqliteConnection("DataSource=:memory:");
        _conn.Open();
        _options = new DbContextOptionsBuilder<AppDbContext>().UseSqlite(_conn).Options;

        using var db = NewContext();
        db.Database.EnsureCreated();
        foreach (var (id, name) in new[] { (1, "Mangesh Ghule"), (2, "Priya Sharma"), (3, "Outsider") })
            db.Users.Add(new User { Id = id, FullName = name, Email = $"u{id}@test.dev", PasswordHash = "x", Role = "Developer", IsActive = true });
        var conv = new Conversation { Id = 1, Type = "Group", GroupName = "Dev", CreatedByUserId = 1 };
        conv.Members.Add(new ConversationMember { UserId = 1, Role = "Admin" });
        conv.Members.Add(new ConversationMember { UserId = 2, Role = "Member" });
        db.Conversations.Add(conv);
        db.SaveChanges();
    }

    public AppDbContext NewContext() => new(_options);

    /// <summary>A service on a fresh DbContext (like one HTTP request)</summary>
    public ChatService Service() => new(NewContext(), new FakeEnv(StorageRoot));

    public void Dispose()
    {
        _conn.Dispose();
        try { Directory.Delete(StorageRoot, true); } catch { /* temp */ }
    }
}

/// <summary>
/// Boots the real API (Program.cs) with SQLite instead of SQL Server.
/// Secrets come from environment variables, exactly like CI.
/// </summary>
public sealed class ApiFactory : WebApplicationFactory<AppDbContext>
{
    private readonly SqliteConnection _conn = new("DataSource=:memory:");
    public string ContentRoot { get; }

    public ApiFactory(string? jwtKey = null, Action<string>? prepareContentRoot = null)
    {
        ContentRoot = Paths.NewTempDir("api-tests");
        File.Copy(Path.Combine(Paths.ApiProject, "appsettings.json"), Path.Combine(ContentRoot, "appsettings.json"));
        prepareContentRoot?.Invoke(ContentRoot);

        // Environment variables override appsettings.json and user secrets.
        Environment.SetEnvironmentVariable("Jwt__Key", jwtKey ?? Convert.ToBase64String(System.Security.Cryptography.RandomNumberGenerator.GetBytes(64)));
        Environment.SetEnvironmentVariable("ASPNETCORE_TEST_CONTENTROOT_DAILYTRACKERAPI", ContentRoot);
        _conn.Open();
    }

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Testing");   // not Development: no user secrets, no static-web-assets manifest
        builder.UseContentRoot(ContentRoot);
        builder.ConfigureServices(services =>
        {
            foreach (var d in services.Where(d => d.ServiceType == typeof(DbContextOptions<AppDbContext>)
                                               || d.ServiceType.Name.Contains("IDbContextOptionsConfiguration")).ToList())
                services.Remove(d);
            services.AddDbContext<AppDbContext>(o => o.UseSqlite(_conn).ReplaceService<IMigrator, NoopMigrator>());

            // No background schedulers during tests
            foreach (var d in services.Where(d => d.ServiceType == typeof(IHostedService)).ToList())
                services.Remove(d);
        });
    }

    protected override void Dispose(bool disposing)
    {
        base.Dispose(disposing);
        _conn.Dispose();
        Environment.SetEnvironmentVariable("Jwt__Key", null);
        try { Directory.Delete(ContentRoot, true); } catch { /* temp */ }
    }
}

/// <summary>
/// Program.cs calls Database.Migrate(); the SQL Server migrations can't run on
/// SQLite, so tests create the schema with EnsureCreated() instead.
/// </summary>
internal sealed class NoopMigrator : IMigrator
{
    public void Migrate(string? targetMigration = null) { }
    public Task MigrateAsync(string? targetMigration = null, CancellationToken cancellationToken = default) => Task.CompletedTask;
    public string GenerateScript(string? fromMigration = null, string? toMigration = null,
        MigrationsSqlGenerationOptions options = MigrationsSqlGenerationOptions.Default) => "";
    public bool HasPendingModelChanges() => false;
}
