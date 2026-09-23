using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace DailyTrackerAPI.Migrations
{
    /// <inheritdoc />
    public partial class updatesupportlogmodel : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<double>(
                name: "DistanceFromOfficeMetres",
                table: "SupportLogs",
                type: "float",
                nullable: true);

            migrationBuilder.AddColumn<double>(
                name: "Latitude",
                table: "SupportLogs",
                type: "float",
                nullable: true);

            migrationBuilder.AddColumn<double>(
                name: "Longitude",
                table: "SupportLogs",
                type: "float",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "DistanceFromOfficeMetres",
                table: "SupportLogs");

            migrationBuilder.DropColumn(
                name: "Latitude",
                table: "SupportLogs");

            migrationBuilder.DropColumn(
                name: "Longitude",
                table: "SupportLogs");
        }
    }
}
