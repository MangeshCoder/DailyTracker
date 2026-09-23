using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace DailyTrackerAPI.Migrations
{
    /// <inheritdoc />
    public partial class updatesupportUserModel : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "SupportAssignmentId",
                table: "SupportLogs",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "SupportEngineerId",
                table: "SupportLogs",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.CreateTable(
                name: "SupportAssignments",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    SupportEngineerId = table.Column<int>(type: "int", nullable: false),
                    DeveloperId = table.Column<int>(type: "int", nullable: false),
                    AssignedByManagerId = table.Column<int>(type: "int", nullable: false),
                    IsActive = table.Column<bool>(type: "bit", nullable: false),
                    Notes = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    AssignedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
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

            migrationBuilder.CreateIndex(
                name: "IX_SupportLogs_SupportAssignmentId",
                table: "SupportLogs",
                column: "SupportAssignmentId");

            migrationBuilder.CreateIndex(
                name: "IX_SupportLogs_SupportEngineerId",
                table: "SupportLogs",
                column: "SupportEngineerId");

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

            migrationBuilder.AddForeignKey(
                name: "FK_SupportLogs_SupportAssignments_SupportAssignmentId",
                table: "SupportLogs",
                column: "SupportAssignmentId",
                principalTable: "SupportAssignments",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "FK_SupportLogs_Users_SupportEngineerId",
                table: "SupportLogs",
                column: "SupportEngineerId",
                principalTable: "Users",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_SupportLogs_SupportAssignments_SupportAssignmentId",
                table: "SupportLogs");

            migrationBuilder.DropForeignKey(
                name: "FK_SupportLogs_Users_SupportEngineerId",
                table: "SupportLogs");

            migrationBuilder.DropTable(
                name: "SupportAssignments");

            migrationBuilder.DropIndex(
                name: "IX_SupportLogs_SupportAssignmentId",
                table: "SupportLogs");

            migrationBuilder.DropIndex(
                name: "IX_SupportLogs_SupportEngineerId",
                table: "SupportLogs");

            migrationBuilder.DropColumn(
                name: "SupportAssignmentId",
                table: "SupportLogs");

            migrationBuilder.DropColumn(
                name: "SupportEngineerId",
                table: "SupportLogs");
        }
    }
}
