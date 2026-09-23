using DailyTrackerAPI.Data;
using DailyTrackerAPI.Helpers;
using DailyTrackerAPI.Hubs;
using DailyTrackerAPI.Services;
using DailyTrackerAPI.Services.AI;
using DailyTrackerAPI.Services.Attendance;
using DailyTrackerAPI.Services.Auth;
using DailyTrackerAPI.Services.Communication;
using DailyTrackerAPI.Services.HR;
using DailyTrackerAPI.Services.Tasks;
using DailyTrackerAPI.Services.Team;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.Extensions.Diagnostics.HealthChecks;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using System.Text;
using System.Text.Json;
using System.Threading.RateLimiting;

namespace DailyTrackerAPI.Extensions
{
    public static class ServiceCollectionExtensions
    {
        // ── Called in Program.cs:  builder.Services.AddApplicationServices(); ─
        public static IServiceCollection AddApplicationServices(
            this IServiceCollection services)
        {
            // ── Infrastructure ────────────────────────────────────────────────
            services.AddScoped<JwtHelper>();
            services.AddScoped<INotificationSender, SignalRNotificationSender>();
            services.AddScoped<IMediaStorageService, MediaStorageService>();

            // ── Auth & Security ───────────────────────────────────────────────
            services.AddScoped<IAuthService, AuthService>();
            services.AddScoped<IRefreshTokenService, RefreshTokenService>();
            services.AddScoped<ITwoFactorService, TwoFactorService>();
            services.AddScoped<IAuditService, AuditService>();
            services.AddScoped<IEmailService, EmailService>();
            services.AddScoped<IEmailOtpService, EmailOtpService>();
            services.AddScoped<IEmailActionService, EmailActionService>();

            // ── Attendance & Work Tracking ────────────────────────────────────
            services.AddScoped<IDailyLogService, DailyLogService>();
            services.AddScoped<IBreakService, BreakService>();
            services.AddScoped<IPresenceService, PresenceService>();
            services.AddScoped<IWFHRequestService, WFHRequestService>();

            // ── Tasks & Productivity ──────────────────────────────────────────
            services.AddScoped<ITaskService, TaskService>();
            services.AddScoped<ITaskTemplateService, TaskTemplateService>();
            services.AddScoped<ITaskTimerService, TaskTimerService>();
            services.AddScoped<ISupportService, SupportService>();
            services.AddScoped<IGoalService, GoalService>();
            services.AddScoped<IEODService, EODService>();
            services.AddScoped<ISupportAssignmentService, SupportAssignmentService>();

            // ── HR & Leave ────────────────────────────────────────────────────
            services.AddScoped<ILeaveService, LeaveService>();
            services.AddScoped<IHolidayService, HolidayService>();
            services.AddScoped<IResignationService, ResignationService>();

            // ── Communication & Engagement ────────────────────────────────────
            services.AddScoped<IAnnouncementService, AnnouncementService>();
            services.AddScoped<IKudosService, KudosService>();
            services.AddScoped<IMeetingService, MeetingService>();
            services.AddScoped<IChatService, ChatService>();
            services.AddScoped<IAppNotificationService, AppNotificationService>();

            // ── Team & Performance ────────────────────────────────────────────
            services.AddScoped<IDashboardService, DashboardService>();
            services.AddScoped<IManagerService, ManagerService>();
            services.AddScoped<IReportService, ReportService>();
            services.AddScoped<IAnalyticsService, AnalyticsService>();
            services.AddScoped<IPerformanceReviewService, PerformanceReviewService>();

            // ── Payroll & Finance ─────────────────────────────────────────────
            services.AddScoped<IDocumentService, DocumentService>();
            services.AddScoped<ITrainingService, TrainingService>();

            // ── AI ────────────────────────────────────────────────────────────
            services.AddHttpClient<IAiService, GeminiService>();

            // ── Background Jobs ───────────────────────────────────────────────
            services.AddHostedService<NotificationSchedulerService>();
            services.AddScoped<ILocationService, LocationService>();

            return services;
        }

        // ── Called in Program.cs:  builder.Services.AddJwtAuthentication(config); ─
        public static IServiceCollection AddJwtAuthentication(
            this IServiceCollection services,
            IConfiguration config)
        {
            var jwtKey = config["Jwt:Key"]!;

            services
                .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
                .AddJwtBearer(options =>
                {
                    options.TokenValidationParameters = new TokenValidationParameters
                    {
                        ValidateIssuer = true,
                        ValidateAudience = true,
                        ValidateLifetime = true,
                        ValidateIssuerSigningKey = true,
                        ValidIssuer = config["Jwt:Issuer"],
                        ValidAudience = config["Jwt:Audience"],
                        IssuerSigningKey = new SymmetricSecurityKey(
                                                       Encoding.UTF8.GetBytes(jwtKey)),
                        ClockSkew = TimeSpan.Zero
                    };

                    // Read JWT from cookie first, fall back to SignalR query string
                    options.Events = new JwtBearerEvents
                    {
                        OnMessageReceived = context =>
                        {
                            var token = context.Request.Cookies["accessToken"];
                            if (!string.IsNullOrEmpty(token))
                            {
                                context.Token = token;
                                return Task.CompletedTask;
                            }

                            var queryToken = context.Request.Query["access_token"];
                            if (!string.IsNullOrEmpty(queryToken) &&
                                context.HttpContext.Request.Path.StartsWithSegments("/hubs"))
                            {
                                context.Token = queryToken;
                            }

                            return Task.CompletedTask;
                        }
                    };
                });

            services.AddAuthorization();
            return services;
        }

        // ── Called in Program.cs:  builder.Services.AddCorsPolicy(); ──────────
        public static IServiceCollection AddCorsPolicy(
            this IServiceCollection services)
        {
            services.AddCors(options =>
                options.AddPolicy("AllowReact", policy =>
                    policy.WithOrigins(
                        "http://localhost:3000",
                        "http://192.168.1.244:3000"
                        )
                          .AllowAnyHeader()
                          .AllowAnyMethod()
                          .AllowCredentials()
                ));

            return services;
        }

        // ── Called in Program.cs:  builder.Services.AddSwaggerDocs(); ─────────
        public static IServiceCollection AddSwaggerDocs(
            this IServiceCollection services)
        {
            services.AddEndpointsApiExplorer();
            services.AddSwaggerGen(c =>
            {
                c.SwaggerDoc("v1", new OpenApiInfo
                {
                    Title = "Daily Tracker API",
                    Version = "v2",
                    Description = "Full-featured employee management and activity tracking system"
                });

                c.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
                {
                    Description = "JWT Authorization: Bearer {token}",
                    Name = "Authorization",
                    In = ParameterLocation.Header,
                    Type = SecuritySchemeType.ApiKey,
                    Scheme = "Bearer"
                });

                c.AddSecurityRequirement(new OpenApiSecurityRequirement
                {
                    {
                        new OpenApiSecurityScheme
                        {
                            Reference = new OpenApiReference
                            {
                                Type = ReferenceType.SecurityScheme,
                                Id   = "Bearer"
                            }
                        },
                        Array.Empty<string>()
                    }
                });
            });

            return services;
        }

        // ── Called in Program.cs:  builder.Services.AddRateLimiting(); ────────
        public static IServiceCollection AddRateLimiting(
            this IServiceCollection services)
        {
            services.AddRateLimiter(options =>
            {
                // Login: max 5 attempts per minute
                options.AddFixedWindowLimiter("LoginRateLimit", o =>
                {
                    o.PermitLimit = 5;
                    o.Window = TimeSpan.FromMinutes(1);
                    o.QueueProcessingOrder = QueueProcessingOrder.OldestFirst;
                    o.QueueLimit = 0;
                });

                // General API: 100 requests per minute
                options.AddFixedWindowLimiter("ApiRateLimit", o =>
                {
                    o.PermitLimit = 100;
                    o.Window = TimeSpan.FromMinutes(1);
                });

                options.OnRejected = async (context, _) =>
                {
                    context.HttpContext.Response.StatusCode = 429;
                    await context.HttpContext.Response.WriteAsJsonAsync(new
                    {
                        message = "Too many requests. Please slow down.",
                        retryAfter = "60 seconds"
                    });
                };
            });

            return services;
        }

        // ── Called in Program.cs:  builder.Services.AddHealthMonitoring(); ────
        public static IServiceCollection AddHealthMonitoring(
            this IServiceCollection services)
        {
            services.AddHealthChecks()
                .AddDbContextCheck<AppDbContext>("database")
                .AddCheck("self", () => HealthCheckResult.Healthy("API is running"));

            return services;
        }
    }
}