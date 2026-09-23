using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace DailyTrackerAPI.Migrations
{
    /// <inheritdoc />
    public partial class updateDailyLogModel : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<double>(
                name: "CheckInLatitude",
                table: "DailyLogs",
                type: "float",
                nullable: true);

            migrationBuilder.AddColumn<double>(
                name: "CheckInLongitude",
                table: "DailyLogs",
                type: "float",
                nullable: true);

            migrationBuilder.AddColumn<double>(
                name: "CheckOutLatitude",
                table: "DailyLogs",
                type: "float",
                nullable: true);

            migrationBuilder.AddColumn<double>(
                name: "CheckOutLongitude",
                table: "DailyLogs",
                type: "float",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "CheckInLatitude",
                table: "DailyLogs");

            migrationBuilder.DropColumn(
                name: "CheckInLongitude",
                table: "DailyLogs");

            migrationBuilder.DropColumn(
                name: "CheckOutLatitude",
                table: "DailyLogs");

            migrationBuilder.DropColumn(
                name: "CheckOutLongitude",
                table: "DailyLogs");
        }
    }
}
