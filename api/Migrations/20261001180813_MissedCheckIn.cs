using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace DailyTrackerAPI.Migrations
{
    /// <inheritdoc />
    public partial class MissedCheckIn : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "MissedCheckInRequests",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    UserId = table.Column<int>(type: "integer", nullable: false),
                    Date = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    CheckIn = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    CheckOut = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    WorkMode = table.Column<string>(type: "citext", maxLength: 10, nullable: false),
                    Reason = table.Column<string>(type: "citext", maxLength: 300, nullable: false),
                    Status = table.Column<string>(type: "citext", maxLength: 12, nullable: false),
                    ReviewedById = table.Column<int>(type: "integer", nullable: true),
                    ReviewNote = table.Column<string>(type: "citext", maxLength: 300, nullable: true),
                    ReviewedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    DailyLogId = table.Column<int>(type: "integer", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_MissedCheckInRequests", x => x.Id);
                    table.ForeignKey(
                        name: "FK_MissedCheckInRequests_Users_ReviewedById",
                        column: x => x.ReviewedById,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_MissedCheckInRequests_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_MissedCheckInRequests_ReviewedById",
                table: "MissedCheckInRequests",
                column: "ReviewedById");

            migrationBuilder.CreateIndex(
                name: "IX_MissedCheckInRequests_Status",
                table: "MissedCheckInRequests",
                column: "Status");

            migrationBuilder.CreateIndex(
                name: "IX_MissedCheckInRequests_UserId_Date",
                table: "MissedCheckInRequests",
                columns: new[] { "UserId", "Date" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "MissedCheckInRequests");
        }
    }
}
