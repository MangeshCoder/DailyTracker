using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace DailyTrackerAPI.Migrations
{
    /// <inheritdoc />
    public partial class Onboarding : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "OnboardingPlans",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    UserId = table.Column<int>(type: "integer", nullable: false),
                    BuddyUserId = table.Column<int>(type: "integer", nullable: true),
                    CreatedById = table.Column<int>(type: "integer", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    CompletedAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_OnboardingPlans", x => x.Id);
                    table.ForeignKey(
                        name: "FK_OnboardingPlans_Users_BuddyUserId",
                        column: x => x.BuddyUserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_OnboardingPlans_Users_CreatedById",
                        column: x => x.CreatedById,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_OnboardingPlans_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "OnboardingTasks",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    PlanId = table.Column<int>(type: "integer", nullable: false),
                    Title = table.Column<string>(type: "citext", maxLength: 200, nullable: false),
                    Kind = table.Column<string>(type: "citext", maxLength: 20, nullable: false),
                    Owner = table.Column<string>(type: "citext", maxLength: 20, nullable: false),
                    SortOrder = table.Column<int>(type: "integer", nullable: false),
                    DoneAt = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    DoneById = table.Column<int>(type: "integer", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_OnboardingTasks", x => x.Id);
                    table.ForeignKey(
                        name: "FK_OnboardingTasks_OnboardingPlans_PlanId",
                        column: x => x.PlanId,
                        principalTable: "OnboardingPlans",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_OnboardingPlans_BuddyUserId",
                table: "OnboardingPlans",
                column: "BuddyUserId");

            migrationBuilder.CreateIndex(
                name: "IX_OnboardingPlans_CreatedById",
                table: "OnboardingPlans",
                column: "CreatedById");

            migrationBuilder.CreateIndex(
                name: "IX_OnboardingPlans_UserId",
                table: "OnboardingPlans",
                column: "UserId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_OnboardingTasks_PlanId",
                table: "OnboardingTasks",
                column: "PlanId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "OnboardingTasks");

            migrationBuilder.DropTable(
                name: "OnboardingPlans");
        }
    }
}
