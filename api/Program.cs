using DailyTrackerAPI.Custom;
using DailyTrackerAPI.Data;
using DailyTrackerAPI.Extensions;
using DailyTrackerAPI.Hubs;
using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Diagnostics.HealthChecks;
using Microsoft.EntityFrameworkCore;
using System.Text.Json;

var builder = WebApplication.CreateBuilder(args);

// ─── Database ─────────────────────────────────────────────────────────────────
builder.Services.AddDbContext<AppDbContext>(o =>
    o.UseSqlServer(builder.Configuration.GetConnectionString("DefaultConnection")));

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
builder.Services.AddJwtAuthentication(builder.Configuration);
builder.Services.AddCorsPolicy();
builder.Services.AddSwaggerDocs();
builder.Services.AddRateLimiting();
builder.Services.AddHealthMonitoring();

// ─── Misc ─────────────────────────────────────────────────────────────────────
builder.Services.AddHttpClient();
builder.WebHost.ConfigureKestrel(o =>
    o.Limits.MaxRequestBodySize = 55 * 1024 * 1024);  // 55 MB for file uploads

// ─────────────────────────────────────────────────────────────────────────────
var app = builder.Build();
// ─────────────────────────────────────────────────────────────────────────────

// ─── Global Exception Handler ─────────────────────────────────────────────────
app.UseExceptionHandler(errorApp =>
    errorApp.Run(async context =>
    {
        context.Response.ContentType = "application/json";
        var ex = context.Features.Get<IExceptionHandlerFeature>()?.Error;

        if (ex is ValidationException)
        {
            context.Response.StatusCode = StatusCodes.Status400BadRequest;
            await context.Response.WriteAsJsonAsync(new { message = ex.Message });
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
if (!app.Environment.IsDevelopment())
{
    app.UseHttpsRedirection();
}
app.UseStaticFiles();       // Serve wwwroot/uploads/*
app.UseCors("AllowReact");
app.UseAuthentication();
app.UseAuthorization();
app.UseRateLimiter();
app.MapControllers();

// ─── SignalR Hubs ─────────────────────────────────────────────────────────────
app.MapHub<NotificationHub>("/hubs/notifications");
app.MapHub<ChatHub>("/hubs/chat");

// ─── Health Checks ────────────────────────────────────────────────────────────
app.MapHealthChecks("/health");
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

// ─── Auto Migrate ─────────────────────────────────────────────────────────────
using (var scope = app.Services.CreateScope())
{
    scope.ServiceProvider
         .GetRequiredService<AppDbContext>()
         .Database.Migrate();
}

app.Run();