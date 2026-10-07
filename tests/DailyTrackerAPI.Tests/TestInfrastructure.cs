using DailyTrackerAPI.Data;
using DailyTrackerAPI.Models.Auth;
using DailyTrackerAPI.Models.Communication;
using DailyTrackerAPI.Services.Communication;
using DailyTrackerAPI.Services.Storage;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Migrations;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.FileProviders;
using Microsoft.Extensions.Hosting;
using Npgsql;

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
/// Which database the tests run on:
///   default          → a throw-away SQLite file (fast, nothing to install;
///                       a file rather than :memory: so parallel requests in
///                       the live-chat tests each get their own connection)
///   TEST_POSTGRES set → a fresh PostgreSQL database per test, built by the
///                       real migrations (CI does this, like production on Neon)
///   e.g. TEST_POSTGRES="Host=localhost;Username=postgres;Password=..."
/// </summary>
public sealed class TestDatabase : IDisposable
{
    static TestDatabase() => AppContext.SetSwitch("Npgsql.EnableLegacyTimestampBehavior", true);

    private static readonly string? PostgresServer = Environment.GetEnvironmentVariable("TEST_POSTGRES");
    public static bool IsPostgres => !string.IsNullOrWhiteSpace(PostgresServer);

    private readonly string? _sqliteFile;
    private readonly string? _pgConnection, _pgName;

    public TestDatabase()
    {
        if (IsPostgres)
        {
            _pgName = "dt_test_" + Guid.NewGuid().ToString("N")[..12];
            _pgConnection = new NpgsqlConnectionStringBuilder(PostgresServer) { Database = _pgName }.ConnectionString;
        }
        else
        {
            _sqliteFile = Path.Combine(Path.GetTempPath(), $"dt-test-{Guid.NewGuid():N}.db");
        }
    }

    public void Configure(DbContextOptionsBuilder o)
    {
        if (_sqliteFile != null)
            o.UseSqlite($"Data Source={_sqliteFile};Default Timeout=30").ReplaceService<IMigrator, NoopMigrator>();
        else o.UseNpgsql(_pgConnection);
    }

    public DbContextOptions<AppDbContext> Options
    {
        get { var b = new DbContextOptionsBuilder<AppDbContext>(); Configure(b); return b.Options; }
    }

    /// <summary>SQLite: schema from the model. PostgreSQL: the real migrations.</summary>
    public static void CreateSchema(AppDbContext db)
    {
        if (db.Database.IsNpgsql()) db.Database.Migrate();
        else db.Database.EnsureCreated();
    }

    /// <summary>Seed rows use fixed ids; move PostgreSQL's id counters past them.</summary>
    public static void AfterSeed(AppDbContext db)
    {
        if (!db.Database.IsNpgsql()) return;
        db.Database.ExecuteSqlRaw("""
            DO $$ DECLARE r record; BEGIN
              FOR r IN SELECT table_name, column_name FROM information_schema.columns
                       WHERE table_schema = 'public' AND is_identity = 'YES' LOOP
                EXECUTE format('SELECT setval(pg_get_serial_sequence(%L, %L), COALESCE((SELECT MAX(%I) FROM %I), 0) + 1, false)',
                               quote_ident(r.table_name), r.column_name, r.column_name, r.table_name);
              END LOOP;
            END $$;
            """);
    }

    public void Dispose()
    {
        if (_sqliteFile != null)
        {
            SqliteConnection.ClearAllPools();
            foreach (var f in new[] { _sqliteFile, _sqliteFile + "-wal", _sqliteFile + "-shm", _sqliteFile + "-journal" })
                try { File.Delete(f); } catch { /* temp */ }
        }
        if (_pgName == null) return;
        NpgsqlConnection.ClearAllPools();
        using var admin = new NpgsqlConnection(new NpgsqlConnectionStringBuilder(PostgresServer) { Database = "postgres" }.ConnectionString);
        admin.Open();
        using var drop = new NpgsqlCommand($"DROP DATABASE IF EXISTS \"{_pgName}\" WITH (FORCE)", admin);
        drop.ExecuteNonQuery();
    }
}

/// <summary>
/// In-memory SQLite database with the real EF model, seeded with:
///   users 1 (Mangesh), 2 (Priya), 3 (Outsider)
///   conversation 1 = group "Dev" with users 1 (Admin) and 2
/// </summary>
public sealed class ChatTestDb : IDisposable
{
    private readonly TestDatabase _database = new();
    private readonly DbContextOptions<AppDbContext> _options;
    public string StorageRoot { get; } = Paths.NewTempDir("chat-tests");

    public ChatTestDb()
    {
        _options = _database.Options;

        using var db = NewContext();
        TestDatabase.CreateSchema(db);
        foreach (var (id, name) in new[] { (1, "Mangesh Ghule"), (2, "Priya Sharma"), (3, "Outsider") })
            db.Users.Add(new User { Id = id, FullName = name, Email = $"u{id}@test.dev", PasswordHash = "x", Role = "Developer", IsActive = true });
        var conv = new Conversation { Id = 1, Type = "Group", GroupName = "Dev", CreatedByUserId = 1 };
        conv.Members.Add(new ConversationMember { UserId = 1, Role = "Admin" });
        conv.Members.Add(new ConversationMember { UserId = 2, Role = "Member" });
        db.Conversations.Add(conv);
        db.SaveChanges();
        TestDatabase.AfterSeed(db);
    }

    public AppDbContext NewContext() => new(_options);

    /// <summary>A service on a fresh DbContext (like one HTTP request)</summary>
    public ChatService Service() => new(NewContext(), Files);

    /// <summary>Chat files are kept in a temp folder (App_Data under StorageRoot)</summary>
    public IFileStorage Files => _files ??= new LocalFileStorage(new FakeEnv(StorageRoot));
    private IFileStorage? _files;

    public void Dispose()
    {
        _database.Dispose();
        try { Directory.Delete(StorageRoot, true); } catch { /* temp */ }
    }
}

/// <summary>
/// Boots the real API (Program.cs) on the test database (see TestDatabase).
/// Secrets come from environment variables, exactly like CI.
/// </summary>
public sealed class ApiFactory : WebApplicationFactory<AppDbContext>
{
    private readonly TestDatabase _database = new();
    public string ContentRoot { get; }

    private readonly Action<IServiceCollection>? _configureServices;
    private readonly IDictionary<string, string?>? _settings;

    public ApiFactory(string? jwtKey = null, Action<string>? prepareContentRoot = null,
        Action<IServiceCollection>? configureServices = null, IDictionary<string, string?>? settings = null)
    {
        _configureServices = configureServices;
        _settings = settings;
        ContentRoot = Paths.NewTempDir("api-tests");
        File.Copy(Path.Combine(Paths.ApiProject, "appsettings.json"), Path.Combine(ContentRoot, "appsettings.json"));
        prepareContentRoot?.Invoke(ContentRoot);

        // Environment variables override appsettings.json and user secrets.
        Environment.SetEnvironmentVariable("Jwt__Key", jwtKey ?? Convert.ToBase64String(System.Security.Cryptography.RandomNumberGenerator.GetBytes(64)));
        Environment.SetEnvironmentVariable("ASPNETCORE_TEST_CONTENTROOT_DAILYTRACKERAPI", ContentRoot);
    }

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Testing");   // not Development: no user secrets, no static-web-assets manifest
        builder.UseContentRoot(ContentRoot);
        // per-test settings (e.g. a Gemini key), added last so they win over appsettings and environment
        if (_settings != null) builder.ConfigureAppConfiguration(c => c.AddInMemoryCollection(_settings));
        builder.ConfigureServices(services =>
        {
            foreach (var d in services.Where(d => d.ServiceType == typeof(DbContextOptions<AppDbContext>)
                                               || d.ServiceType.Name.Contains("IDbContextOptionsConfiguration")).ToList())
                services.Remove(d);
            services.AddDbContext<AppDbContext>(_database.Configure);

            // No background schedulers during tests
            foreach (var d in services.Where(d => d.ServiceType == typeof(IHostedService)).ToList())
                services.Remove(d);

            _configureServices?.Invoke(services);
        });
    }

    protected override void Dispose(bool disposing)
    {
        base.Dispose(disposing);
        _database.Dispose();
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
