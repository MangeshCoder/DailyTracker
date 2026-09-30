using DailyTrackerAPI.Services.Storage;
using DailyTrackerAPI.Custom;
using DailyTrackerAPI.Data;
using DailyTrackerAPI.Extensions;
using DailyTrackerAPI.Hubs;
using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Diagnostics.HealthChecks;
using Microsoft.EntityFrameworkCore;
using System.Text.Json;

var builder = WebApplication.CreateBuilder(args);

// ─── Secrets check ────────────────────────────────────────────────────────────
// Secrets live in .NET User Secrets (run api/setup-secrets.ps1), never in
// appsettings.json. Fail fast with a clear message instead of a cryptic crash.
var jwtKeyValue = builder.Configuration["Jwt:Key"];
// (Skipped for `dotnet ef` design-time runs — creating migrations needs no signing key.)
if (!EF.IsDesignTime && (string.IsNullOrWhiteSpace(jwtKeyValue) || System.Text.Encoding.UTF8.GetByteCount(jwtKeyValue) < 32))
    throw new InvalidOperationException(
        "Jwt:Key is missing or shorter than 32 characters. Run  api/setup-secrets.ps1  once " +
        "(or: dotnet user-secrets set \"Jwt:Key\" \"<random 64+ characters>\") and start the API again.");

// ─── Database ─────────────────────────────────────────────────────────────────
// PostgreSQL (local install on your PC, Neon when hosted). DateTime columns keep
// the old SQL Server meaning ("timestamp without time zone") so no code changes.
AppContext.SetSwitch("Npgsql.EnableLegacyTimestampBehavior", true);
builder.Services.AddDbContext<AppDbContext>(o =>
    o.UseNpgsql(DailyTrackerAPI.Helpers.PostgresConnection.Normalize(builder.Configuration.GetConnectionString("DefaultConnection")),
        // a hosted database that was asleep can take a moment to answer — retry briefly
        npgsql => npgsql.EnableRetryOnFailure(3, TimeSpan.FromSeconds(3), null)));

// ─── Cache (Redis with in-memory fallback) ────────────────────────────────────
builder.Services.AddStackExchangeRedisCache(o =>
    o.Configuration = builder.Configuration.GetConnectionString("Redis") ?? "localhost:6379");
builder.Services.AddMemoryCache();

// ─── SignalR ──────────────────────────────────────────────────────────────────
builder.Services.AddSignalR();

// ─── Controllers ─────────────────────────────────────────────────────────────
builder.Services.AddControllers()
    .AddJsonOptions(o =>
        o.JsonSerializerOptions.PropertyNamingPolicy = JsonNamingPolicy.CamelCase);

// ─── All grouped service registrations (see Extensions/ServiceCollectionExtensions.cs)
builder.Services.AddApplicationServices();
builder.Services.AddFileStorage(builder.Configuration);   // local folders, or a cloud bucket when hosted
builder.Services.AddJwtAuthentication(builder.Configuration);
builder.Services.AddCorsPolicy(builder.Configuration);
builder.Services.AddSwaggerDocs();
builder.Services.AddRateLimiting();
builder.Services.AddHealthMonitoring();

// ─── Misc ─────────────────────────────────────────────────────────────────────
builder.Services.AddHttpClient();
builder.WebHost.ConfigureKestrel(o =>
    o.Limits.MaxRequestBodySize = 55 * 1024 * 1024);  // 55 MB for file uploads

// ─────────────────────────────────────────────────────────────────────────────
// ─── Behind a hosting proxy (Render) ─────────────────────────────────────────
// The proxy ends HTTPS and forwards plain HTTP; these headers tell the app the
// real scheme (https → secure cookies) and the visitor's IP address.
builder.Services.Configure<Microsoft.AspNetCore.Builder.ForwardedHeadersOptions>(o =>
{
    o.ForwardedHeaders = Microsoft.AspNetCore.HttpOverrides.ForwardedHeaders.XForwardedFor
                       | Microsoft.AspNetCore.HttpOverrides.ForwardedHeaders.XForwardedProto;
    o.KnownIPNetworks.Clear();   // the proxy's address isn't fixed
    o.KnownProxies.Clear();
});

var app = builder.Build();
app.UseForwardedHeaders();

// Check the file storage settings now, so a wrong value is one clear line in the
// log at startup (instead of errors on every upload/download later)
try { app.Services.GetRequiredService<IFileStorage>(); }
catch (Exception ex) { app.Logger.LogCritical("File storage is misconfigured: {Message} (check the Storage__S3__* settings)", ex.Message); }
// ─────────────────────────────────────────────────────────────────────────────

// ─── Request monitor ──────────────────────────────────────────────────────────
// Server errors (500) and API calls over 2 s are saved for the managers'
// System page; anything over 1 s is also a warning in the hosting logs.
// SignalR hubs are long-lived connections, so they're skipped.
app.Use(async (context, next) =>
{
    if (context.Request.Path.StartsWithSegments("/hubs")) { await next(); return; }
    var watch = System.Diagnostics.Stopwatch.StartNew();
    Exception? escaped = null;
    try { await next(); }
    catch (Exception ex) { escaped = ex; throw; }
    finally
    {
        var ms = watch.ElapsedMilliseconds;
        if (ms > 1000)
            app.Logger.LogWarning("Slow request: {Method} {Path} took {Ms} ms (status {Status})",
                context.Request.Method, context.Request.Path, ms, context.Response.StatusCode);
        var error = escaped ?? context.Features.Get<IExceptionHandlerFeature>()?.Error;
        if (escaped != null && !context.Response.HasStarted) context.Response.StatusCode = 500;
        await context.RequestServices.GetRequiredService<DailyTrackerAPI.Services.Monitoring.ErrorLogWriter>()
            .RecordAsync(context, ms, error);
    }
});

// ─── Global Exception Handler ─────────────────────────────────────────────────
app.UseExceptionHandler(errorApp =>
    errorApp.Run(async context =>
    {
        context.Response.ContentType = "application/json";
        var ex = context.Features.Get<IExceptionHandlerFeature>()?.Error;

        // Business-rule errors thrown by our own code → their real message
        // (framework/database errors keep the generic text below)
        bool ours = ex?.TargetSite?.DeclaringType?.Namespace?.StartsWith("DailyTrackerAPI") == true;
        int? status = ex switch
        {
            ValidationException => StatusCodes.Status400BadRequest,
            KeyNotFoundException when ours => StatusCodes.Status404NotFound,
            UnauthorizedAccessException when ours => StatusCodes.Status403Forbidden,
            InvalidOperationException when ours => StatusCodes.Status400BadRequest,
            _ => null,
        };
        if (status.HasValue)
        {
            context.Response.StatusCode = status.Value;
            await context.Response.WriteAsJsonAsync(new { message = ex!.Message });
            return;
        }

        context.Response.StatusCode = StatusCodes.Status500InternalServerError;
        await context.Response.WriteAsJsonAsync(new { message = "An unexpected error occurred." });
    }));

// ─── Swagger (Development only) ───────────────────────────────────────────────
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI(c =>
        c.SwaggerEndpoint("/swagger/v1/swagger.json", "Daily Tracker API v2"));
}

// ─── Middleware Pipeline ──────────────────────────────────────────────────────
// (the hosting proxy already redirects http → https itself)
if (!app.Environment.IsDevelopment() && !app.Configuration.GetValue<bool>("Hosting:BehindHttpsProxy"))
{
    app.UseHttpsRedirection();
}
// Private uploads (HR documents, support evidence, certificates) are only served
// through authenticated API endpoints — never as public static files.
string[] privateUploadDirs = { "/uploads/documents", "/uploads/support", "/uploads/certifications" };
app.Use(async (context, next) =>
{
    if (privateUploadDirs.Any(d => context.Request.Path.StartsWithSegments(d, StringComparison.OrdinalIgnoreCase)))
    {
        context.Response.StatusCode = StatusCodes.Status404NotFound;
        return;
    }
    await next();
});
// wwwroot: the built UI when hosted (+ locally uploaded files on your PC).
// Vite's /assets/* files have a content hash in their name → cache for a year;
// index.html and the service worker must always be re-checked.
app.UseDefaultFiles();      // "/" → index.html (only when the built UI is in wwwroot)
// Face-recognition model files have no extension (…-shard1), which the normal
// static-file handler refuses — they'd fall through to index.html and the face
// engine would read a web page as model data.
var modelsDir = Path.Combine(app.Environment.WebRootPath ?? Path.Combine(app.Environment.ContentRootPath, "wwwroot"), "models");
if (Directory.Exists(modelsDir))
{
    app.UseStaticFiles(new StaticFileOptions
    {
        FileProvider = new Microsoft.Extensions.FileProviders.PhysicalFileProvider(modelsDir),
        RequestPath = "/models",
        ServeUnknownFileTypes = true,
        DefaultContentType = "application/octet-stream",
        OnPrepareResponse = ctx => ctx.Context.Response.Headers.CacheControl = "public, max-age=604800",
    });
}
app.UseStaticFiles(new StaticFileOptions
{
    OnPrepareResponse = ctx =>
    {
        var path = ctx.Context.Request.Path.Value ?? "";
        ctx.Context.Response.Headers.CacheControl =
            path.StartsWith("/assets/", StringComparison.Ordinal) ? "public, max-age=31536000, immutable"
            : path.EndsWith(".html") || path.EndsWith("sw.js") || path.Contains("workbox-") || path.EndsWith(".webmanifest") ? "no-cache"
            : ctx.Context.Response.Headers.CacheControl.ToString();
    }
});
app.UseCors("AllowReact");
app.UseAuthentication();
app.UseAuthorization();

// ─── Accounts waiting for approval ────────────────────────────────────────────
// A newly registered person is "Pending" until a manager assigns a role; until
// then they can only see who they are, edit their profile and sign out.
string[] pendingAllowed = { "/api/auth/me", "/api/auth/logout", "/api/auth/refresh", "/api/auth/revoke", "/api/profile/me" };
app.Use(async (context, next) =>
{
    if (context.User.IsInRole("Pending")
        && (context.Request.Path.StartsWithSegments("/api") || context.Request.Path.StartsWithSegments("/hubs"))
        && !pendingAllowed.Any(p => context.Request.Path.StartsWithSegments(p, StringComparison.OrdinalIgnoreCase)))
    {
        context.Response.StatusCode = StatusCodes.Status403Forbidden;
        await context.Response.WriteAsJsonAsync(new { message = "Your account is waiting for a manager's approval." });
        return;
    }
    await next();
});
app.UseRateLimiter();
app.MapControllers();

// ─── Profile photos (public) ─────────────────────────────────────────────────
// Answered from file storage: wwwroot/uploads/avatars on your PC, the storage
// bucket when hosted — same URL either way.
var avatarTypes = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
{
    [".jpg"] = "image/jpeg", [".jpeg"] = "image/jpeg", [".png"] = "image/png",
    [".webp"] = "image/webp", [".gif"] = "image/gif",
};
app.MapGet("/uploads/avatars/{name}", async (string name, IFileStorage files, HttpContext http) =>
{
    if (!System.Text.RegularExpressions.Regex.IsMatch(name, "^[A-Za-z0-9_-]{1,100}\\.[A-Za-z]{3,4}$")
        || !avatarTypes.TryGetValue(Path.GetExtension(name), out var type))
        return Results.NotFound();
    var stream = await files.OpenReadAsync($"uploads/avatars/{name}", http.RequestAborted);
    if (stream == null) return Results.NotFound();
    http.Response.Headers.CacheControl = "public, max-age=604800, immutable";   // names never change
    http.Response.Headers["X-Content-Type-Options"] = "nosniff";
    return Results.Stream(stream, type);
}).AllowAnonymous();

// ─── SignalR Hubs ─────────────────────────────────────────────────────────────
app.MapHub<NotificationHub>("/hubs/notifications");
app.MapHub<ChatHub>("/hubs/chat");

// ─── Health Checks ────────────────────────────────────────────────────────────
// /health = "is the app up?" — never touches the database, so an uptime pinger
// can keep the server awake without waking (and using up) the free database
app.MapHealthChecks("/health", new HealthCheckOptions { Predicate = check => check.Name == "self" });
app.MapHealthChecks("/health/detail", new HealthCheckOptions
{
    ResponseWriter = async (context, report) =>
    {
        context.Response.ContentType = "application/json";
        await context.Response.WriteAsJsonAsync(new
        {
            status = report.Status.ToString(),
            checks = report.Entries.Select(e => new
            {
                name = e.Key,
                status = e.Value.Status.ToString(),
                description = e.Value.Description
            }),
            duration = report.TotalDuration
        });
    }
});

// ─── Optional integrations: warn once if not configured ─────────────────────
if (!DailyTrackerAPI.Services.Auth.EmailService.IsConfigured(app.Configuration))
    app.Logger.LogWarning("Email is not configured (local: Email:Username / Email:Password via api/setup-secrets.ps1; hosted: Email:BrevoApiKey + Email:FromAddress) — OTP, password reset and approval emails will fail.");
if (string.IsNullOrWhiteSpace(app.Configuration["Gemini:ApiKey"]))
    app.Logger.LogWarning("Gemini:ApiKey is not configured — the AI assistant will use its offline fallback. Run api/setup-secrets.ps1.");

// ─── Auto Migrate ─────────────────────────────────────────────────────────────
using (var scope = app.Services.CreateScope())
{
    scope.ServiceProvider
         .GetRequiredService<AppDbContext>()
         .Database.Migrate();
}

// ─── The web app (hosted build) ───────────────────────────────────────────────
// When the UI is built into wwwroot (Docker image), any other page URL
// (/dashboard, /chat?c=5 …) returns index.html and React shows the page.
// Real files (/assets/x.js) and API, hub, upload and health URLs never fall back to it.
if (File.Exists(Path.Combine(app.Environment.WebRootPath ?? "", "index.html")))
{
    app.MapFallbackToFile("{*path:nonfile:regex(^(?!api/|hubs/|uploads/|models/|health|swagger).*$)}", "index.html",
        new StaticFileOptions { OnPrepareResponse = ctx => ctx.Context.Response.Headers.CacheControl = "no-cache" });
}

app.Run();