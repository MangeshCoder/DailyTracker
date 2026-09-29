using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace DailyTrackerAPI.Migrations
{
    /// <inheritdoc />
    public partial class MonitoringAndBackups : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "AppErrorLogs",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    OccurredAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    Kind = table.Column<string>(type: "citext", maxLength: 10, nullable: false),
                    Method = table.Column<string>(type: "citext", maxLength: 10, nullable: false),
                    Path = table.Column<string>(type: "citext", maxLength: 500, nullable: false),
                    StatusCode = table.Column<int>(type: "integer", nullable: false),
                    DurationMs = table.Column<int>(type: "integer", nullable: false),
                    UserId = table.Column<int>(type: "integer", nullable: true),
                    Message = table.Column<string>(type: "citext", maxLength: 1000, nullable: false),
                    Details = table.Column<string>(type: "citext", maxLength: 8000, nullable: true),
                    TraceId = table.Column<string>(type: "citext", maxLength: 100, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AppErrorLogs", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "DatabaseBackups",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    StartedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    FinishedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    Trigger = table.Column<string>(type: "citext", maxLength: 10, nullable: false),
                    Status = table.Column<string>(type: "citext", maxLength: 10, nullable: false),
                    FileKey = table.Column<string>(type: "citext", maxLength: 200, nullable: true),
                    SizeBytes = table.Column<long>(type: "bigint", nullable: false),
                    TableCount = table.Column<int>(type: "integer", nullable: false),
                    RowCount = table.Column<long>(type: "bigint", nullable: false),
                    Error = table.Column<string>(type: "citext", maxLength: 2000, nullable: true),
                    RequestedByUserId = table.Column<int>(type: "integer", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_DatabaseBackups", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_AppErrorLogs_OccurredAt",
                table: "AppErrorLogs",
                column: "OccurredAt");

            migrationBuilder.CreateIndex(
                name: "IX_DatabaseBackups_StartedAt",
                table: "DatabaseBackups",
                column: "StartedAt");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "AppErrorLogs");

            migrationBuilder.DropTable(
                name: "DatabaseBackups");
        }
    }
}
