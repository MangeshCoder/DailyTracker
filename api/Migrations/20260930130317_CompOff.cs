using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace DailyTrackerAPI.Migrations
{
    /// <inheritdoc />
    public partial class CompOff : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "CompOffCredits",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    UserId = table.Column<int>(type: "integer", nullable: false),
                    DailyLogId = table.Column<int>(type: "integer", nullable: false),
                    WorkDate = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    Occasion = table.Column<string>(type: "citext", maxLength: 100, nullable: false),
                    WorkMinutes = table.Column<int>(type: "integer", nullable: false),
                    Status = table.Column<string>(type: "citext", maxLength: 20, nullable: false),
                    ExpiresOn = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    UsedByLeaveId = table.Column<int>(type: "integer", nullable: true),
                    ReviewedById = table.Column<int>(type: "integer", nullable: true),
                    ReviewNote = table.Column<string>(type: "citext", maxLength: 300, nullable: true),
                    ReviewedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    ExpiryReminderSent = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CompOffCredits", x => x.Id);
                    table.ForeignKey(
                        name: "FK_CompOffCredits_DailyLogs_DailyLogId",
                        column: x => x.DailyLogId,
                        principalTable: "DailyLogs",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_CompOffCredits_LeaveRequests_UsedByLeaveId",
                        column: x => x.UsedByLeaveId,
                        principalTable: "LeaveRequests",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_CompOffCredits_Users_ReviewedById",
                        column: x => x.ReviewedById,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_CompOffCredits_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_CompOffCredits_DailyLogId",
                table: "CompOffCredits",
                column: "DailyLogId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_CompOffCredits_ReviewedById",
                table: "CompOffCredits",
                column: "ReviewedById");

            migrationBuilder.CreateIndex(
                name: "IX_CompOffCredits_UsedByLeaveId",
                table: "CompOffCredits",
                column: "UsedByLeaveId");

            migrationBuilder.CreateIndex(
                name: "IX_CompOffCredits_UserId_Status",
                table: "CompOffCredits",
                columns: new[] { "UserId", "Status" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "CompOffCredits");
        }
    }
}
