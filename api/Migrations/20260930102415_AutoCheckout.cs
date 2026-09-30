using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace DailyTrackerAPI.Migrations
{
    /// <inheritdoc />
    public partial class AutoCheckout : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "AutoCheckOutBasis",
                table: "DailyLogs",
                type: "citext",
                maxLength: 20,
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "AutoCheckedOut",
                table: "DailyLogs",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<DateTime>(
                name: "CorrectionCheckOut",
                table: "DailyLogs",
                type: "timestamp without time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "CorrectionReason",
                table: "DailyLogs",
                type: "citext",
                maxLength: 300,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "CorrectionReviewNote",
                table: "DailyLogs",
                type: "citext",
                maxLength: 300,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "CorrectionReviewedAt",
                table: "DailyLogs",
                type: "timestamp without time zone",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "CorrectionReviewedById",
                table: "DailyLogs",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "CorrectionStatus",
                table: "DailyLogs",
                type: "citext",
                maxLength: 20,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "AutoCheckOutBasis",
                table: "DailyLogs");

            migrationBuilder.DropColumn(
                name: "AutoCheckedOut",
                table: "DailyLogs");

            migrationBuilder.DropColumn(
                name: "CorrectionCheckOut",
                table: "DailyLogs");

            migrationBuilder.DropColumn(
                name: "CorrectionReason",
                table: "DailyLogs");

            migrationBuilder.DropColumn(
                name: "CorrectionReviewNote",
                table: "DailyLogs");

            migrationBuilder.DropColumn(
                name: "CorrectionReviewedAt",
                table: "DailyLogs");

            migrationBuilder.DropColumn(
                name: "CorrectionReviewedById",
                table: "DailyLogs");

            migrationBuilder.DropColumn(
                name: "CorrectionStatus",
                table: "DailyLogs");
        }
    }
}
