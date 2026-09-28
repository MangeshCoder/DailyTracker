using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace DailyTrackerAPI.Migrations
{
    /// <inheritdoc />
    public partial class InitialPostgres : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterDatabase()
                .Annotation("Npgsql:PostgresExtension:citext", ",,");

            migrationBuilder.CreateTable(
                name: "EmailOtps",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Email = table.Column<string>(type: "citext", maxLength: 256, nullable: false),
                    Code = table.Column<string>(type: "citext", maxLength: 6, nullable: false),
                    ExpiresAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    IsUsed = table.Column<bool>(type: "boolean", nullable: false, defaultValue: false),
                    Purpose = table.Column<string>(type: "citext", maxLength: 50, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_EmailOtps", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Holidays",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Date = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    Name = table.Column<string>(type: "citext", nullable: false),
                    Type = table.Column<string>(type: "citext", nullable: false),
                    Year = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Holidays", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "LeaveEmailActions",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    LeaveId = table.Column<int>(type: "integer", nullable: false),
                    ManagerId = table.Column<int>(type: "integer", nullable: false),
                    Token = table.Column<string>(type: "citext", nullable: false),
                    ExpiryDate = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    IsUsed = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_LeaveEmailActions", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "SchedulerRuns",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    JobKey = table.Column<string>(type: "citext", maxLength: 50, nullable: false),
                    RunDate = table.Column<DateOnly>(type: "date", nullable: false),
                    RanAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SchedulerRuns", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Users",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    FullName = table.Column<string>(type: "citext", maxLength: 100, nullable: false),
                    Email = table.Column<string>(type: "citext", maxLength: 100, nullable: false),
                    PasswordHash = table.Column<string>(type: "citext", nullable: false),
                    Role = table.Column<string>(type: "citext", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    ManagerId = table.Column<int>(type: "integer", nullable: true),
                    Department = table.Column<string>(type: "citext", maxLength: 100, nullable: true),
                    Designation = table.Column<string>(type: "citext", maxLength: 100, nullable: true),
                    Phone = table.Column<string>(type: "citext", maxLength: 20, nullable: true),
                    Bio = table.Column<string>(type: "citext", maxLength: 500, nullable: true),
                    ProfilePhotoUrl = table.Column<string>(type: "citext", maxLength: 500, nullable: true),
                    JoinDate = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    FaceDescriptor = table.Column<string>(type: "citext", nullable: true),
                    FaceRegistered = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Users", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Users_Users_ManagerId",
                        column: x => x.ManagerId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "Announcements",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Title = table.Column<string>(type: "citext", maxLength: 200, nullable: false),
                    Content = table.Column<string>(type: "citext", nullable: false),
                    Category = table.Column<string>(type: "citext", maxLength: 50, nullable: false),
                    IsPinned = table.Column<bool>(type: "boolean", nullable: false),
                    ExpiresAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    CreatedByUserId = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Announcements", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Announcements_Users_CreatedByUserId",
                        column: x => x.CreatedByUserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "AuditLogs",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    UserId = table.Column<int>(type: "integer", nullable: true),
                    Action = table.Column<string>(type: "citext", nullable: false),
                    Entity = table.Column<string>(type: "citext", nullable: false),
                    EntityId = table.Column<int>(type: "integer", nullable: true),
                    OldValues = table.Column<string>(type: "citext", nullable: true),
                    NewValues = table.Column<string>(type: "citext", nullable: true),
                    IpAddress = table.Column<string>(type: "citext", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AuditLogs", x => x.Id);
                    table.ForeignKey(
                        name: "FK_AuditLogs_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "Certifications",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    UserId = table.Column<int>(type: "integer", nullable: false),
                    Name = table.Column<string>(type: "citext", maxLength: 200, nullable: false),
                    IssuingOrganization = table.Column<string>(type: "citext", maxLength: 150, nullable: false),
                    IssueDate = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    ExpiryDate = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    CredentialId = table.Column<string>(type: "citext", maxLength: 100, nullable: true),
                    CredentialUrl = table.Column<string>(type: "citext", maxLength: 500, nullable: true),
                    Status = table.Column<string>(type: "citext", maxLength: 20, nullable: false),
                    FileName = table.Column<string>(type: "citext", maxLength: 260, nullable: true),
                    FilePath = table.Column<string>(type: "citext", maxLength: 500, nullable: true),
                    MimeType = table.Column<string>(type: "citext", maxLength: 100, nullable: true),
                    FileSizeBytes = table.Column<long>(type: "bigint", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Certifications", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Certifications_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "Conversations",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Type = table.Column<string>(type: "citext", maxLength: 20, nullable: false),
                    GroupName = table.Column<string>(type: "citext", maxLength: 100, nullable: true),
                    GroupAvatar = table.Column<string>(type: "citext", maxLength: 500, nullable: true),
                    CreatedByUserId = table.Column<int>(type: "integer", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    LastMessageAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    LastMessagePreview = table.Column<string>(type: "citext", maxLength: 500, nullable: true),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Conversations", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Conversations_Users_CreatedByUserId",
                        column: x => x.CreatedByUserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "DailyGoals",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    UserId = table.Column<int>(type: "integer", nullable: false),
                    GoalDate = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    TargetWorkMinutes = table.Column<int>(type: "integer", nullable: false),
                    TargetTasksCompleted = table.Column<int>(type: "integer", nullable: false),
                    TargetSupportGiven = table.Column<int>(type: "integer", nullable: false),
                    TargetBreakMinutes = table.Column<int>(type: "integer", nullable: false),
                    ProductivityScore = table.Column<double>(type: "double precision", nullable: false),
                    ManagerSetNote = table.Column<string>(type: "citext", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_DailyGoals", x => x.Id);
                    table.ForeignKey(
                        name: "FK_DailyGoals_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "DailyLogs",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    UserId = table.Column<int>(type: "integer", nullable: false),
                    LogDate = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    CheckInTime = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    CheckOutTime = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    TotalWorkMinutes = table.Column<int>(type: "integer", nullable: false),
                    TotalBreakMinutes = table.Column<int>(type: "integer", nullable: false),
                    DayStatus = table.Column<string>(type: "citext", nullable: false),
                    Notes = table.Column<string>(type: "citext", maxLength: 500, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    CheckInLatitude = table.Column<double>(type: "double precision", nullable: true),
                    CheckInLongitude = table.Column<double>(type: "double precision", nullable: true),
                    CheckOutLatitude = table.Column<double>(type: "double precision", nullable: true),
                    CheckOutLongitude = table.Column<double>(type: "double precision", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_DailyLogs", x => x.Id);
                    table.ForeignKey(
                        name: "FK_DailyLogs_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "Documents",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    OwnerUserId = table.Column<int>(type: "integer", nullable: false),
                    UploadedByUserId = table.Column<int>(type: "integer", nullable: false),
                    Title = table.Column<string>(type: "citext", maxLength: 200, nullable: false),
                    Description = table.Column<string>(type: "citext", maxLength: 1000, nullable: true),
                    Category = table.Column<string>(type: "citext", maxLength: 50, nullable: false),
                    FileName = table.Column<string>(type: "citext", maxLength: 260, nullable: false),
                    FilePath = table.Column<string>(type: "citext", maxLength: 500, nullable: false),
                    MimeType = table.Column<string>(type: "citext", maxLength: 100, nullable: false),
                    FileSizeBytes = table.Column<long>(type: "bigint", nullable: false),
                    IsPublic = table.Column<bool>(type: "boolean", nullable: false),
                    UploadedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    ExpiresAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Documents", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Documents_Users_OwnerUserId",
                        column: x => x.OwnerUserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_Documents_Users_UploadedByUserId",
                        column: x => x.UploadedByUserId,
                        principalTable: "Users",
                        principalColumn: "Id");
                });

            migrationBuilder.CreateTable(
                name: "EmployeeSalaries",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    UserId = table.Column<int>(type: "integer", nullable: false),
                    MonthlySalary = table.Column<decimal>(type: "numeric(18,2)", nullable: false),
                    Currency = table.Column<string>(type: "citext", maxLength: 10, nullable: false),
                    OvertimeMultiplier = table.Column<decimal>(type: "numeric(4,2)", nullable: false),
                    EffectiveFrom = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    SetByUserId = table.Column<int>(type: "integer", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_EmployeeSalaries", x => x.Id);
                    table.ForeignKey(
                        name: "FK_EmployeeSalaries_Users_SetByUserId",
                        column: x => x.SetByUserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_EmployeeSalaries_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "FaceAttemptLogs",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    UserId = table.Column<int>(type: "integer", nullable: false),
                    Action = table.Column<string>(type: "citext", nullable: false),
                    Success = table.Column<bool>(type: "boolean", nullable: false),
                    Distance = table.Column<float>(type: "real", nullable: false),
                    Result = table.Column<string>(type: "citext", nullable: false),
                    AttemptedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_FaceAttemptLogs", x => x.Id);
                    table.ForeignKey(
                        name: "FK_FaceAttemptLogs_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "GeofenceEvents",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    UserId = table.Column<int>(type: "integer", nullable: false),
                    EventType = table.Column<string>(type: "citext", maxLength: 10, nullable: false),
                    Latitude = table.Column<double>(type: "double precision", nullable: false),
                    Longitude = table.Column<double>(type: "double precision", nullable: false),
                    OccurredAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    ReceivedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    ClientEventId = table.Column<string>(type: "citext", maxLength: 64, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_GeofenceEvents", x => x.Id);
                    table.ForeignKey(
                        name: "FK_GeofenceEvents_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "Kudos",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    FromUserId = table.Column<int>(type: "integer", nullable: false),
                    ToUserId = table.Column<int>(type: "integer", nullable: false),
                    Message = table.Column<string>(type: "citext", nullable: false),
                    BadgeType = table.Column<string>(type: "citext", nullable: false),
                    GivenAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Kudos", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Kudos_Users_FromUserId",
                        column: x => x.FromUserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Kudos_Users_ToUserId",
                        column: x => x.ToUserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "LeaveRequests",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    UserId = table.Column<int>(type: "integer", nullable: false),
                    FromDate = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    ToDate = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    LeaveType = table.Column<string>(type: "citext", nullable: false),
                    Reason = table.Column<string>(type: "citext", nullable: false),
                    Status = table.Column<string>(type: "citext", nullable: false),
                    ReviewedByUserId = table.Column<int>(type: "integer", nullable: true),
                    ReviewNote = table.Column<string>(type: "citext", nullable: true),
                    ReviewedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    AppliedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_LeaveRequests", x => x.Id);
                    table.ForeignKey(
                        name: "FK_LeaveRequests_Users_ReviewedByUserId",
                        column: x => x.ReviewedByUserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_LeaveRequests_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "LocationConsents",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    UserId = table.Column<int>(type: "integer", nullable: false),
                    ConsentedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    PolicyVersion = table.Column<string>(type: "citext", maxLength: 20, nullable: false),
                    Revoked = table.Column<bool>(type: "boolean", nullable: false),
                    RevokedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_LocationConsents", x => x.Id);
                    table.ForeignKey(
                        name: "FK_LocationConsents_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "Meetings",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Title = table.Column<string>(type: "citext", maxLength: 200, nullable: false),
                    Agenda = table.Column<string>(type: "citext", maxLength: 2000, nullable: true),
                    Notes = table.Column<string>(type: "citext", maxLength: 2000, nullable: true),
                    Location = table.Column<string>(type: "citext", maxLength: 100, nullable: true),
                    MeetingType = table.Column<string>(type: "citext", maxLength: 30, nullable: false),
                    ScheduledAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    DurationMinutes = table.Column<int>(type: "integer", nullable: false),
                    Status = table.Column<string>(type: "citext", maxLength: 20, nullable: false),
                    IsRecurring = table.Column<bool>(type: "boolean", nullable: false),
                    RecurrencePattern = table.Column<string>(type: "citext", maxLength: 20, nullable: true),
                    OrganisedByUserId = table.Column<int>(type: "integer", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Meetings", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Meetings_Users_OrganisedByUserId",
                        column: x => x.OrganisedByUserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "Notifications",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    UserId = table.Column<int>(type: "integer", nullable: false),
                    Title = table.Column<string>(type: "citext", nullable: false),
                    Message = table.Column<string>(type: "citext", nullable: false),
                    Type = table.Column<string>(type: "citext", nullable: false),
                    ActionUrl = table.Column<string>(type: "citext", nullable: true),
                    IsRead = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Notifications", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Notifications_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "PendingLogins",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    UserId = table.Column<int>(type: "integer", nullable: false),
                    TempToken = table.Column<string>(type: "citext", nullable: false),
                    IpAddress = table.Column<string>(type: "citext", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    ExpiresAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    IsUsed = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PendingLogins", x => x.Id);
                    table.ForeignKey(
                        name: "FK_PendingLogins_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "RefreshTokens",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    UserId = table.Column<int>(type: "integer", nullable: false),
                    Token = table.Column<string>(type: "citext", nullable: false),
                    ExpiresAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    IsRevoked = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    CreatedByIp = table.Column<string>(type: "citext", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_RefreshTokens", x => x.Id);
                    table.ForeignKey(
                        name: "FK_RefreshTokens_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "Resignations",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    UserId = table.Column<int>(type: "integer", nullable: false),
                    Reason = table.Column<string>(type: "citext", maxLength: 1000, nullable: false),
                    RequestedLastDay = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    Status = table.Column<string>(type: "citext", maxLength: 20, nullable: false),
                    ReviewedByUserId = table.Column<int>(type: "integer", nullable: true),
                    ReviewNote = table.Column<string>(type: "citext", maxLength: 1000, nullable: true),
                    ReviewedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    NoticePeriodEndDate = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    ExitDate = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    SubmittedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Resignations", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Resignations_Users_ReviewedByUserId",
                        column: x => x.ReviewedByUserId,
                        principalTable: "Users",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_Resignations_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "ReviewCycles",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Title = table.Column<string>(type: "citext", maxLength: 100, nullable: false),
                    Description = table.Column<string>(type: "citext", maxLength: 500, nullable: true),
                    CycleType = table.Column<string>(type: "citext", maxLength: 20, nullable: false),
                    StartDate = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    EndDate = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    SelfAssessmentDueDate = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    Status = table.Column<string>(type: "citext", maxLength: 20, nullable: false),
                    CreatedByUserId = table.Column<int>(type: "integer", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ReviewCycles", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ReviewCycles_Users_CreatedByUserId",
                        column: x => x.CreatedByUserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "SupportAssignments",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    SupportEngineerId = table.Column<int>(type: "integer", nullable: false),
                    DeveloperId = table.Column<int>(type: "integer", nullable: false),
                    AssignedByManagerId = table.Column<int>(type: "integer", nullable: false),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    Notes = table.Column<string>(type: "citext", maxLength: 500, nullable: true),
                    AssignedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SupportAssignments", x => x.Id);
                    table.ForeignKey(
                        name: "FK_SupportAssignments_Users_AssignedByManagerId",
                        column: x => x.AssignedByManagerId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_SupportAssignments_Users_DeveloperId",
                        column: x => x.DeveloperId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_SupportAssignments_Users_SupportEngineerId",
                        column: x => x.SupportEngineerId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "TaskTemplates",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    UserId = table.Column<int>(type: "integer", nullable: false),
                    Title = table.Column<string>(type: "citext", nullable: false),
                    Description = table.Column<string>(type: "citext", nullable: true),
                    ProjectName = table.Column<string>(type: "citext", nullable: true),
                    DefaultTimeMinutes = table.Column<int>(type: "integer", nullable: false),
                    Priority = table.Column<string>(type: "citext", nullable: false),
                    Tags = table.Column<string>(type: "citext", nullable: true),
                    IsRecurring = table.Column<bool>(type: "boolean", nullable: false),
                    RecurrenceDays = table.Column<string>(type: "citext", nullable: true),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TaskTemplates", x => x.Id);
                    table.ForeignKey(
                        name: "FK_TaskTemplates_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "Trainings",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    UserId = table.Column<int>(type: "integer", nullable: false),
                    Title = table.Column<string>(type: "citext", maxLength: 200, nullable: false),
                    Provider = table.Column<string>(type: "citext", maxLength: 150, nullable: true),
                    TrainingType = table.Column<string>(type: "citext", maxLength: 30, nullable: false),
                    Description = table.Column<string>(type: "citext", maxLength: 1000, nullable: true),
                    StartDate = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    EndDate = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    DurationHours = table.Column<decimal>(type: "numeric(6,2)", nullable: false),
                    Status = table.Column<string>(type: "citext", maxLength: 20, nullable: false),
                    Notes = table.Column<string>(type: "citext", maxLength: 1000, nullable: true),
                    CourseUrl = table.Column<string>(type: "citext", maxLength: 500, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Trainings", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Trainings_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "TrustedDevices",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    UserId = table.Column<int>(type: "integer", nullable: false),
                    DeviceToken = table.Column<string>(type: "citext", nullable: false),
                    DeviceName = table.Column<string>(type: "citext", nullable: false),
                    IpAddress = table.Column<string>(type: "citext", nullable: false),
                    TrustedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    ExpiresAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    IsRevoked = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TrustedDevices", x => x.Id);
                    table.ForeignKey(
                        name: "FK_TrustedDevices_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "UserPresences",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    UserId = table.Column<int>(type: "integer", nullable: false),
                    IsAvailableForHelp = table.Column<bool>(type: "boolean", nullable: false),
                    Status = table.Column<string>(type: "citext", nullable: false),
                    StatusMessage = table.Column<string>(type: "citext", nullable: true),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_UserPresences", x => x.Id);
                    table.ForeignKey(
                        name: "FK_UserPresences_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "UserTwoFactors",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    UserId = table.Column<int>(type: "integer", nullable: false),
                    TotpEnabled = table.Column<bool>(type: "boolean", nullable: false),
                    TotpSecretKey = table.Column<string>(type: "citext", nullable: true),
                    TotpBackupCodes = table.Column<string>(type: "citext", nullable: true),
                    EmailOtpEnabled = table.Column<bool>(type: "boolean", nullable: false),
                    PendingOtpCode = table.Column<string>(type: "citext", nullable: true),
                    OtpExpiresAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    OtpAttempts = table.Column<int>(type: "integer", nullable: false),
                    OtpPurpose = table.Column<string>(type: "citext", nullable: true),
                    LastVerifiedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_UserTwoFactors", x => x.Id);
                    table.ForeignKey(
                        name: "FK_UserTwoFactors_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "AnnouncementReads",
                columns: table => new
                {
                    AnnouncementId = table.Column<int>(type: "integer", nullable: false),
                    UserId = table.Column<int>(type: "integer", nullable: false),
                    ReadAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AnnouncementReads", x => new { x.AnnouncementId, x.UserId });
                    table.ForeignKey(
                        name: "FK_AnnouncementReads_Announcements_AnnouncementId",
                        column: x => x.AnnouncementId,
                        principalTable: "Announcements",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_AnnouncementReads_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "ChatMessages",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    ConversationId = table.Column<int>(type: "integer", nullable: false),
                    SenderId = table.Column<int>(type: "integer", nullable: true),
                    Content = table.Column<string>(type: "citext", maxLength: 4000, nullable: false),
                    MessageType = table.Column<string>(type: "citext", maxLength: 20, nullable: false),
                    AttachmentUrl = table.Column<string>(type: "citext", maxLength: 1000, nullable: true),
                    AttachmentName = table.Column<string>(type: "citext", maxLength: 200, nullable: true),
                    ReplyToMessageId = table.Column<int>(type: "integer", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                    IsEdited = table.Column<bool>(type: "boolean", nullable: false),
                    SentAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    EditedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    AttachmentSize = table.Column<long>(type: "bigint", nullable: true),
                    AttachmentContentType = table.Column<string>(type: "citext", maxLength: 100, nullable: true),
                    IsPinned = table.Column<bool>(type: "boolean", nullable: false),
                    PinnedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    PinnedByUserId = table.Column<int>(type: "integer", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ChatMessages", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ChatMessages_ChatMessages_ReplyToMessageId",
                        column: x => x.ReplyToMessageId,
                        principalTable: "ChatMessages",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ChatMessages_Conversations_ConversationId",
                        column: x => x.ConversationId,
                        principalTable: "Conversations",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_ChatMessages_Users_SenderId",
                        column: x => x.SenderId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "ConversationMembers",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    ConversationId = table.Column<int>(type: "integer", nullable: false),
                    UserId = table.Column<int>(type: "integer", nullable: false),
                    Role = table.Column<string>(type: "citext", maxLength: 20, nullable: false),
                    JoinedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    HasLeft = table.Column<bool>(type: "boolean", nullable: false),
                    LeftAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    LastReadAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    IsMuted = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ConversationMembers", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ConversationMembers_Conversations_ConversationId",
                        column: x => x.ConversationId,
                        principalTable: "Conversations",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_ConversationMembers_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "AwayLogs",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    UserId = table.Column<int>(type: "integer", nullable: false),
                    DailyLogId = table.Column<int>(type: "integer", nullable: true),
                    StartedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    EndedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    DurationMinutes = table.Column<int>(type: "integer", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AwayLogs", x => x.Id);
                    table.ForeignKey(
                        name: "FK_AwayLogs_DailyLogs_DailyLogId",
                        column: x => x.DailyLogId,
                        principalTable: "DailyLogs",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_AwayLogs_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "BreakLogs",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    DailyLogId = table.Column<int>(type: "integer", nullable: false),
                    BreakType = table.Column<string>(type: "citext", nullable: false),
                    StartTime = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    EndTime = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    DurationMinutes = table.Column<int>(type: "integer", nullable: false),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_BreakLogs", x => x.Id);
                    table.ForeignKey(
                        name: "FK_BreakLogs_DailyLogs_DailyLogId",
                        column: x => x.DailyLogId,
                        principalTable: "DailyLogs",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "EODReports",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    UserId = table.Column<int>(type: "integer", nullable: false),
                    DailyLogId = table.Column<int>(type: "integer", nullable: false),
                    ReportDate = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    WhatWasDone = table.Column<string>(type: "citext", nullable: false),
                    Blockers = table.Column<string>(type: "citext", nullable: true),
                    PlanForTomorrow = table.Column<string>(type: "citext", nullable: true),
                    Learnings = table.Column<string>(type: "citext", nullable: true),
                    MoodRating = table.Column<string>(type: "citext", nullable: false),
                    SubmittedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    IsReviewedByManager = table.Column<bool>(type: "boolean", nullable: false),
                    ManagerComment = table.Column<string>(type: "citext", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_EODReports", x => x.Id);
                    table.ForeignKey(
                        name: "FK_EODReports_DailyLogs_DailyLogId",
                        column: x => x.DailyLogId,
                        principalTable: "DailyLogs",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_EODReports_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "LateArrivalReasons",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    DailyLogId = table.Column<int>(type: "integer", nullable: false),
                    UserId = table.Column<int>(type: "integer", nullable: false),
                    Reason = table.Column<string>(type: "citext", nullable: false),
                    CheckInTime = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    LateByMinutes = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_LateArrivalReasons", x => x.Id);
                    table.ForeignKey(
                        name: "FK_LateArrivalReasons_DailyLogs_DailyLogId",
                        column: x => x.DailyLogId,
                        principalTable: "DailyLogs",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_LateArrivalReasons_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "TaskLogs",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    DailyLogId = table.Column<int>(type: "integer", nullable: false),
                    TaskTitle = table.Column<string>(type: "citext", maxLength: 200, nullable: false),
                    Description = table.Column<string>(type: "citext", maxLength: 1000, nullable: true),
                    ProjectName = table.Column<string>(type: "citext", maxLength: 100, nullable: true),
                    Status = table.Column<string>(type: "citext", nullable: false),
                    TimeSpentMinutes = table.Column<int>(type: "integer", nullable: false),
                    Priority = table.Column<string>(type: "citext", nullable: false),
                    Tags = table.Column<string>(type: "citext", nullable: true),
                    CompletedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TaskLogs", x => x.Id);
                    table.ForeignKey(
                        name: "FK_TaskLogs_DailyLogs_DailyLogId",
                        column: x => x.DailyLogId,
                        principalTable: "DailyLogs",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "WFHRequests",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    UserId = table.Column<int>(type: "integer", nullable: false),
                    RequestType = table.Column<string>(type: "citext", maxLength: 20, nullable: false),
                    RequestDate = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    HalfDaySlot = table.Column<string>(type: "citext", maxLength: 20, nullable: true),
                    Reason = table.Column<string>(type: "citext", maxLength: 500, nullable: false),
                    Status = table.Column<string>(type: "citext", maxLength: 20, nullable: false),
                    ReviewedByUserId = table.Column<int>(type: "integer", nullable: true),
                    ReviewNote = table.Column<string>(type: "citext", maxLength: 500, nullable: true),
                    ReviewedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    DailyLogId = table.Column<int>(type: "integer", nullable: true),
                    RequestedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_WFHRequests", x => x.Id);
                    table.ForeignKey(
                        name: "FK_WFHRequests_DailyLogs_DailyLogId",
                        column: x => x.DailyLogId,
                        principalTable: "DailyLogs",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_WFHRequests_Users_ReviewedByUserId",
                        column: x => x.ReviewedByUserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_WFHRequests_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "MeetingActionItems",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    MeetingId = table.Column<int>(type: "integer", nullable: false),
                    Description = table.Column<string>(type: "citext", maxLength: 500, nullable: false),
                    AssignedToUserId = table.Column<int>(type: "integer", nullable: true),
                    Status = table.Column<string>(type: "citext", maxLength: 20, nullable: false),
                    DueDate = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_MeetingActionItems", x => x.Id);
                    table.ForeignKey(
                        name: "FK_MeetingActionItems_Meetings_MeetingId",
                        column: x => x.MeetingId,
                        principalTable: "Meetings",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_MeetingActionItems_Users_AssignedToUserId",
                        column: x => x.AssignedToUserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "MeetingAttendees",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    MeetingId = table.Column<int>(type: "integer", nullable: false),
                    UserId = table.Column<int>(type: "integer", nullable: false),
                    Response = table.Column<string>(type: "citext", maxLength: 20, nullable: false),
                    Attended = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_MeetingAttendees", x => x.Id);
                    table.ForeignKey(
                        name: "FK_MeetingAttendees_Meetings_MeetingId",
                        column: x => x.MeetingId,
                        principalTable: "Meetings",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_MeetingAttendees_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "ExitChecklistItems",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    ResignationId = table.Column<int>(type: "integer", nullable: false),
                    Task = table.Column<string>(type: "citext", maxLength: 200, nullable: false),
                    IsCompleted = table.Column<bool>(type: "boolean", nullable: false),
                    CompletedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    CompletedByUserId = table.Column<int>(type: "integer", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ExitChecklistItems", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ExitChecklistItems_Resignations_ResignationId",
                        column: x => x.ResignationId,
                        principalTable: "Resignations",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_ExitChecklistItems_Users_CompletedByUserId",
                        column: x => x.CompletedByUserId,
                        principalTable: "Users",
                        principalColumn: "Id");
                });

            migrationBuilder.CreateTable(
                name: "PerformanceReviews",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    ReviewCycleId = table.Column<int>(type: "integer", nullable: false),
                    RevieweeId = table.Column<int>(type: "integer", nullable: false),
                    ReviewerId = table.Column<int>(type: "integer", nullable: false),
                    SelfAssessmentText = table.Column<string>(type: "citext", maxLength: 2000, nullable: true),
                    SelfRating = table.Column<int>(type: "integer", nullable: true),
                    Achievements = table.Column<string>(type: "citext", maxLength: 1000, nullable: true),
                    Improvements = table.Column<string>(type: "citext", maxLength: 1000, nullable: true),
                    Goals = table.Column<string>(type: "citext", maxLength: 1000, nullable: true),
                    SelfSubmittedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    ManagerFeedback = table.Column<string>(type: "citext", maxLength: 2000, nullable: true),
                    OverallRating = table.Column<int>(type: "integer", nullable: true),
                    StrengthsNote = table.Column<string>(type: "citext", maxLength: 1000, nullable: true),
                    DevelopmentNote = table.Column<string>(type: "citext", maxLength: 1000, nullable: true),
                    ManagerSubmittedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    Status = table.Column<string>(type: "citext", maxLength: 20, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PerformanceReviews", x => x.Id);
                    table.ForeignKey(
                        name: "FK_PerformanceReviews_ReviewCycles_ReviewCycleId",
                        column: x => x.ReviewCycleId,
                        principalTable: "ReviewCycles",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_PerformanceReviews_Users_RevieweeId",
                        column: x => x.RevieweeId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_PerformanceReviews_Users_ReviewerId",
                        column: x => x.ReviewerId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "SupportLogs",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    DailyLogId = table.Column<int>(type: "integer", nullable: false),
                    SupportEngineerId = table.Column<int>(type: "integer", nullable: false),
                    SupportedDeveloperId = table.Column<int>(type: "integer", nullable: false),
                    IssueDescription = table.Column<string>(type: "citext", maxLength: 500, nullable: false),
                    Resolution = table.Column<string>(type: "citext", maxLength: 500, nullable: true),
                    TimeSpentMinutes = table.Column<int>(type: "integer", nullable: false),
                    SupportType = table.Column<string>(type: "citext", nullable: false),
                    SupportedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    SupportAssignmentId = table.Column<int>(type: "integer", nullable: true),
                    Latitude = table.Column<double>(type: "double precision", nullable: true),
                    Longitude = table.Column<double>(type: "double precision", nullable: true),
                    DistanceFromOfficeMetres = table.Column<double>(type: "double precision", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SupportLogs", x => x.Id);
                    table.ForeignKey(
                        name: "FK_SupportLogs_DailyLogs_DailyLogId",
                        column: x => x.DailyLogId,
                        principalTable: "DailyLogs",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_SupportLogs_SupportAssignments_SupportAssignmentId",
                        column: x => x.SupportAssignmentId,
                        principalTable: "SupportAssignments",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_SupportLogs_Users_SupportEngineerId",
                        column: x => x.SupportEngineerId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_SupportLogs_Users_SupportedDeveloperId",
                        column: x => x.SupportedDeveloperId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "ChatMessageMentions",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    MessageId = table.Column<int>(type: "integer", nullable: false),
                    UserId = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ChatMessageMentions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ChatMessageMentions_ChatMessages_MessageId",
                        column: x => x.MessageId,
                        principalTable: "ChatMessages",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_ChatMessageMentions_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "ChatPolls",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    MessageId = table.Column<int>(type: "integer", nullable: false),
                    Question = table.Column<string>(type: "citext", maxLength: 300, nullable: false),
                    AllowMultiple = table.Column<bool>(type: "boolean", nullable: false),
                    IsClosed = table.Column<bool>(type: "boolean", nullable: false),
                    ClosedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    CreatedByUserId = table.Column<int>(type: "integer", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ChatPolls", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ChatPolls_ChatMessages_MessageId",
                        column: x => x.MessageId,
                        principalTable: "ChatMessages",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "MessageReactions",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    MessageId = table.Column<int>(type: "integer", nullable: false),
                    UserId = table.Column<int>(type: "integer", nullable: false),
                    Emoji = table.Column<string>(type: "citext", maxLength: 10, nullable: false),
                    ReactedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_MessageReactions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_MessageReactions_ChatMessages_MessageId",
                        column: x => x.MessageId,
                        principalTable: "ChatMessages",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_MessageReactions_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "MessageReadReceipts",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    MessageId = table.Column<int>(type: "integer", nullable: false),
                    UserId = table.Column<int>(type: "integer", nullable: false),
                    ReadAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_MessageReadReceipts", x => x.Id);
                    table.ForeignKey(
                        name: "FK_MessageReadReceipts_ChatMessages_MessageId",
                        column: x => x.MessageId,
                        principalTable: "ChatMessages",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_MessageReadReceipts_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "TaskTimers",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    TaskLogId = table.Column<int>(type: "integer", nullable: false),
                    StartedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    StoppedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    DurationMinutes = table.Column<int>(type: "integer", nullable: false),
                    IsRunning = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TaskTimers", x => x.Id);
                    table.ForeignKey(
                        name: "FK_TaskTimers_TaskLogs_TaskLogId",
                        column: x => x.TaskLogId,
                        principalTable: "TaskLogs",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "ReviewRatings",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    PerformanceReviewId = table.Column<int>(type: "integer", nullable: false),
                    Competency = table.Column<string>(type: "citext", maxLength: 50, nullable: false),
                    Score = table.Column<int>(type: "integer", nullable: false),
                    Comment = table.Column<string>(type: "citext", maxLength: 500, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ReviewRatings", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ReviewRatings_PerformanceReviews_PerformanceReviewId",
                        column: x => x.PerformanceReviewId,
                        principalTable: "PerformanceReviews",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "MediaEvidences",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    UserId = table.Column<int>(type: "integer", nullable: false),
                    MediaType = table.Column<string>(type: "citext", nullable: false),
                    FileName = table.Column<string>(type: "citext", nullable: false),
                    FilePath = table.Column<string>(type: "citext", nullable: false),
                    ThumbnailPath = table.Column<string>(type: "citext", nullable: true),
                    FileSizeBytes = table.Column<long>(type: "bigint", nullable: false),
                    MimeType = table.Column<string>(type: "citext", nullable: false),
                    SupportLogId = table.Column<int>(type: "integer", nullable: true),
                    UploadedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_MediaEvidences", x => x.Id);
                    table.ForeignKey(
                        name: "FK_MediaEvidences_SupportLogs_SupportLogId",
                        column: x => x.SupportLogId,
                        principalTable: "SupportLogs",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_MediaEvidences_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id");
                });

            migrationBuilder.CreateTable(
                name: "ChatPollOptions",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    PollId = table.Column<int>(type: "integer", nullable: false),
                    Text = table.Column<string>(type: "citext", maxLength: 100, nullable: false),
                    SortOrder = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ChatPollOptions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ChatPollOptions_ChatPolls_PollId",
                        column: x => x.PollId,
                        principalTable: "ChatPolls",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "ChatPollVotes",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    OptionId = table.Column<int>(type: "integer", nullable: false),
                    UserId = table.Column<int>(type: "integer", nullable: false),
                    VotedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ChatPollVotes", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ChatPollVotes_ChatPollOptions_OptionId",
                        column: x => x.OptionId,
                        principalTable: "ChatPollOptions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_ChatPollVotes_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_AnnouncementReads_UserId",
                table: "AnnouncementReads",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_Announcements_CreatedByUserId",
                table: "Announcements",
                column: "CreatedByUserId");

            migrationBuilder.CreateIndex(
                name: "IX_AuditLogs_UserId",
                table: "AuditLogs",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_AwayLogs_DailyLogId",
                table: "AwayLogs",
                column: "DailyLogId");

            migrationBuilder.CreateIndex(
                name: "IX_AwayLogs_UserId",
                table: "AwayLogs",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_BreakLogs_DailyLogId",
                table: "BreakLogs",
                column: "DailyLogId");

            migrationBuilder.CreateIndex(
                name: "IX_Certifications_ExpiryDate",
                table: "Certifications",
                column: "ExpiryDate");

            migrationBuilder.CreateIndex(
                name: "IX_Certifications_UserId",
                table: "Certifications",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_ChatMessageMentions_MessageId_UserId",
                table: "ChatMessageMentions",
                columns: new[] { "MessageId", "UserId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ChatMessageMentions_UserId",
                table: "ChatMessageMentions",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_ChatMessages_ConversationId_SentAt",
                table: "ChatMessages",
                columns: new[] { "ConversationId", "SentAt" })
                .Annotation("Npgsql:IndexInclude", new[] { "SenderId", "IsDeleted" });

            migrationBuilder.CreateIndex(
                name: "IX_ChatMessages_Pinned",
                table: "ChatMessages",
                column: "ConversationId",
                filter: "\"IsPinned\" = TRUE");

            migrationBuilder.CreateIndex(
                name: "IX_ChatMessages_ReplyToMessageId",
                table: "ChatMessages",
                column: "ReplyToMessageId");

            migrationBuilder.CreateIndex(
                name: "IX_ChatMessages_SenderId",
                table: "ChatMessages",
                column: "SenderId");

            migrationBuilder.CreateIndex(
                name: "IX_ChatPollOptions_PollId",
                table: "ChatPollOptions",
                column: "PollId");

            migrationBuilder.CreateIndex(
                name: "IX_ChatPolls_MessageId",
                table: "ChatPolls",
                column: "MessageId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ChatPollVotes_OptionId_UserId",
                table: "ChatPollVotes",
                columns: new[] { "OptionId", "UserId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ChatPollVotes_UserId",
                table: "ChatPollVotes",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_ConversationMembers_ConversationId_UserId",
                table: "ConversationMembers",
                columns: new[] { "ConversationId", "UserId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ConversationMembers_UserId",
                table: "ConversationMembers",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_Conversations_CreatedByUserId",
                table: "Conversations",
                column: "CreatedByUserId");

            migrationBuilder.CreateIndex(
                name: "IX_Conversations_LastMessageAt",
                table: "Conversations",
                column: "LastMessageAt");

            migrationBuilder.CreateIndex(
                name: "IX_DailyGoals_UserId_GoalDate",
                table: "DailyGoals",
                columns: new[] { "UserId", "GoalDate" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_DailyLogs_UserId_LogDate",
                table: "DailyLogs",
                columns: new[] { "UserId", "LogDate" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Documents_Category",
                table: "Documents",
                column: "Category");

            migrationBuilder.CreateIndex(
                name: "IX_Documents_OwnerUserId",
                table: "Documents",
                column: "OwnerUserId");

            migrationBuilder.CreateIndex(
                name: "IX_Documents_UploadedByUserId",
                table: "Documents",
                column: "UploadedByUserId");

            migrationBuilder.CreateIndex(
                name: "IX_EmailOtps_Email_Purpose",
                table: "EmailOtps",
                columns: new[] { "Email", "Purpose" });

            migrationBuilder.CreateIndex(
                name: "IX_EmployeeSalaries_SetByUserId",
                table: "EmployeeSalaries",
                column: "SetByUserId");

            migrationBuilder.CreateIndex(
                name: "IX_EmployeeSalaries_UserId",
                table: "EmployeeSalaries",
                column: "UserId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_EODReports_DailyLogId",
                table: "EODReports",
                column: "DailyLogId");

            migrationBuilder.CreateIndex(
                name: "IX_EODReports_UserId_ReportDate",
                table: "EODReports",
                columns: new[] { "UserId", "ReportDate" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ExitChecklistItems_CompletedByUserId",
                table: "ExitChecklistItems",
                column: "CompletedByUserId");

            migrationBuilder.CreateIndex(
                name: "IX_ExitChecklistItems_ResignationId",
                table: "ExitChecklistItems",
                column: "ResignationId");

            migrationBuilder.CreateIndex(
                name: "IX_FaceAttemptLogs_UserId_AttemptedAt",
                table: "FaceAttemptLogs",
                columns: new[] { "UserId", "AttemptedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_GeofenceEvents_ClientEventId",
                table: "GeofenceEvents",
                column: "ClientEventId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_GeofenceEvents_UserId",
                table: "GeofenceEvents",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_Holidays_Date",
                table: "Holidays",
                column: "Date",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Kudos_FromUserId",
                table: "Kudos",
                column: "FromUserId");

            migrationBuilder.CreateIndex(
                name: "IX_Kudos_ToUserId",
                table: "Kudos",
                column: "ToUserId");

            migrationBuilder.CreateIndex(
                name: "IX_LateArrivalReasons_DailyLogId",
                table: "LateArrivalReasons",
                column: "DailyLogId");

            migrationBuilder.CreateIndex(
                name: "IX_LateArrivalReasons_UserId",
                table: "LateArrivalReasons",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_LeaveRequests_ReviewedByUserId",
                table: "LeaveRequests",
                column: "ReviewedByUserId");

            migrationBuilder.CreateIndex(
                name: "IX_LeaveRequests_UserId",
                table: "LeaveRequests",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_LocationConsents_UserId",
                table: "LocationConsents",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_MediaEvidences_SupportLogId",
                table: "MediaEvidences",
                column: "SupportLogId");

            migrationBuilder.CreateIndex(
                name: "IX_MediaEvidences_UserId",
                table: "MediaEvidences",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_MeetingActionItems_AssignedToUserId",
                table: "MeetingActionItems",
                column: "AssignedToUserId");

            migrationBuilder.CreateIndex(
                name: "IX_MeetingActionItems_MeetingId",
                table: "MeetingActionItems",
                column: "MeetingId");

            migrationBuilder.CreateIndex(
                name: "IX_MeetingAttendees_MeetingId_UserId",
                table: "MeetingAttendees",
                columns: new[] { "MeetingId", "UserId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_MeetingAttendees_UserId",
                table: "MeetingAttendees",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_Meetings_OrganisedByUserId",
                table: "Meetings",
                column: "OrganisedByUserId");

            migrationBuilder.CreateIndex(
                name: "IX_MessageReactions_MessageId_UserId",
                table: "MessageReactions",
                columns: new[] { "MessageId", "UserId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_MessageReactions_UserId",
                table: "MessageReactions",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_MessageReadReceipts_MessageId_UserId",
                table: "MessageReadReceipts",
                columns: new[] { "MessageId", "UserId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_MessageReadReceipts_UserId",
                table: "MessageReadReceipts",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_Notifications_UserId_CreatedAt",
                table: "Notifications",
                columns: new[] { "UserId", "CreatedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_Notifications_UserId_Unread",
                table: "Notifications",
                column: "UserId",
                filter: "\"IsRead\" = FALSE");

            migrationBuilder.CreateIndex(
                name: "IX_PendingLogins_TempToken",
                table: "PendingLogins",
                column: "TempToken",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_PendingLogins_UserId",
                table: "PendingLogins",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_PerformanceReviews_ReviewCycleId_RevieweeId",
                table: "PerformanceReviews",
                columns: new[] { "ReviewCycleId", "RevieweeId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_PerformanceReviews_RevieweeId",
                table: "PerformanceReviews",
                column: "RevieweeId");

            migrationBuilder.CreateIndex(
                name: "IX_PerformanceReviews_ReviewerId",
                table: "PerformanceReviews",
                column: "ReviewerId");

            migrationBuilder.CreateIndex(
                name: "IX_RefreshTokens_Token",
                table: "RefreshTokens",
                column: "Token",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_RefreshTokens_UserId",
                table: "RefreshTokens",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_Resignations_ReviewedByUserId",
                table: "Resignations",
                column: "ReviewedByUserId");

            migrationBuilder.CreateIndex(
                name: "IX_Resignations_Status",
                table: "Resignations",
                column: "Status");

            migrationBuilder.CreateIndex(
                name: "IX_Resignations_UserId",
                table: "Resignations",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_ReviewCycles_CreatedByUserId",
                table: "ReviewCycles",
                column: "CreatedByUserId");

            migrationBuilder.CreateIndex(
                name: "IX_ReviewRatings_PerformanceReviewId_Competency",
                table: "ReviewRatings",
                columns: new[] { "PerformanceReviewId", "Competency" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_SchedulerRuns_JobKey_RunDate",
                table: "SchedulerRuns",
                columns: new[] { "JobKey", "RunDate" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_SupportAssignments_AssignedByManagerId",
                table: "SupportAssignments",
                column: "AssignedByManagerId");

            migrationBuilder.CreateIndex(
                name: "IX_SupportAssignments_DeveloperId",
                table: "SupportAssignments",
                column: "DeveloperId");

            migrationBuilder.CreateIndex(
                name: "IX_SupportAssignments_SupportEngineerId",
                table: "SupportAssignments",
                column: "SupportEngineerId");

            migrationBuilder.CreateIndex(
                name: "IX_SupportLogs_DailyLogId",
                table: "SupportLogs",
                column: "DailyLogId");

            migrationBuilder.CreateIndex(
                name: "IX_SupportLogs_SupportAssignmentId",
                table: "SupportLogs",
                column: "SupportAssignmentId");

            migrationBuilder.CreateIndex(
                name: "IX_SupportLogs_SupportedDeveloperId",
                table: "SupportLogs",
                column: "SupportedDeveloperId");

            migrationBuilder.CreateIndex(
                name: "IX_SupportLogs_SupportEngineerId",
                table: "SupportLogs",
                column: "SupportEngineerId");

            migrationBuilder.CreateIndex(
                name: "IX_TaskLogs_DailyLogId",
                table: "TaskLogs",
                column: "DailyLogId");

            migrationBuilder.CreateIndex(
                name: "IX_TaskTemplates_UserId",
                table: "TaskTemplates",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_TaskTimers_TaskLogId",
                table: "TaskTimers",
                column: "TaskLogId");

            migrationBuilder.CreateIndex(
                name: "IX_Trainings_Status",
                table: "Trainings",
                column: "Status");

            migrationBuilder.CreateIndex(
                name: "IX_Trainings_UserId",
                table: "Trainings",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_TrustedDevices_UserId_DeviceToken",
                table: "TrustedDevices",
                columns: new[] { "UserId", "DeviceToken" });

            migrationBuilder.CreateIndex(
                name: "IX_UserPresences_UserId",
                table: "UserPresences",
                column: "UserId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Users_Email",
                table: "Users",
                column: "Email",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Users_ManagerId",
                table: "Users",
                column: "ManagerId");

            migrationBuilder.CreateIndex(
                name: "IX_UserTwoFactors_UserId",
                table: "UserTwoFactors",
                column: "UserId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_WFHRequests_DailyLogId",
                table: "WFHRequests",
                column: "DailyLogId");

            migrationBuilder.CreateIndex(
                name: "IX_WFHRequests_ReviewedByUserId",
                table: "WFHRequests",
                column: "ReviewedByUserId");

            migrationBuilder.CreateIndex(
                name: "IX_WFHRequests_UserId_RequestDate_Status",
                table: "WFHRequests",
                columns: new[] { "UserId", "RequestDate", "Status" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "AnnouncementReads");

            migrationBuilder.DropTable(
                name: "AuditLogs");

            migrationBuilder.DropTable(
                name: "AwayLogs");

            migrationBuilder.DropTable(
                name: "BreakLogs");

            migrationBuilder.DropTable(
                name: "Certifications");

            migrationBuilder.DropTable(
                name: "ChatMessageMentions");

            migrationBuilder.DropTable(
                name: "ChatPollVotes");

            migrationBuilder.DropTable(
                name: "ConversationMembers");

            migrationBuilder.DropTable(
                name: "DailyGoals");

            migrationBuilder.DropTable(
                name: "Documents");

            migrationBuilder.DropTable(
                name: "EmailOtps");

            migrationBuilder.DropTable(
                name: "EmployeeSalaries");

            migrationBuilder.DropTable(
                name: "EODReports");

            migrationBuilder.DropTable(
                name: "ExitChecklistItems");

            migrationBuilder.DropTable(
                name: "FaceAttemptLogs");

            migrationBuilder.DropTable(
                name: "GeofenceEvents");

            migrationBuilder.DropTable(
                name: "Holidays");

            migrationBuilder.DropTable(
                name: "Kudos");

            migrationBuilder.DropTable(
                name: "LateArrivalReasons");

            migrationBuilder.DropTable(
                name: "LeaveEmailActions");

            migrationBuilder.DropTable(
                name: "LeaveRequests");

            migrationBuilder.DropTable(
                name: "LocationConsents");

            migrationBuilder.DropTable(
                name: "MediaEvidences");

            migrationBuilder.DropTable(
                name: "MeetingActionItems");

            migrationBuilder.DropTable(
                name: "MeetingAttendees");

            migrationBuilder.DropTable(
                name: "MessageReactions");

            migrationBuilder.DropTable(
                name: "MessageReadReceipts");

            migrationBuilder.DropTable(
                name: "Notifications");

            migrationBuilder.DropTable(
                name: "PendingLogins");

            migrationBuilder.DropTable(
                name: "RefreshTokens");

            migrationBuilder.DropTable(
                name: "ReviewRatings");

            migrationBuilder.DropTable(
                name: "SchedulerRuns");

            migrationBuilder.DropTable(
                name: "TaskTemplates");

            migrationBuilder.DropTable(
                name: "TaskTimers");

            migrationBuilder.DropTable(
                name: "Trainings");

            migrationBuilder.DropTable(
                name: "TrustedDevices");

            migrationBuilder.DropTable(
                name: "UserPresences");

            migrationBuilder.DropTable(
                name: "UserTwoFactors");

            migrationBuilder.DropTable(
                name: "WFHRequests");

            migrationBuilder.DropTable(
                name: "Announcements");

            migrationBuilder.DropTable(
                name: "ChatPollOptions");

            migrationBuilder.DropTable(
                name: "Resignations");

            migrationBuilder.DropTable(
                name: "SupportLogs");

            migrationBuilder.DropTable(
                name: "Meetings");

            migrationBuilder.DropTable(
                name: "PerformanceReviews");

            migrationBuilder.DropTable(
                name: "TaskLogs");

            migrationBuilder.DropTable(
                name: "ChatPolls");

            migrationBuilder.DropTable(
                name: "SupportAssignments");

            migrationBuilder.DropTable(
                name: "ReviewCycles");

            migrationBuilder.DropTable(
                name: "DailyLogs");

            migrationBuilder.DropTable(
                name: "ChatMessages");

            migrationBuilder.DropTable(
                name: "Conversations");

            migrationBuilder.DropTable(
                name: "Users");
        }
    }
}
