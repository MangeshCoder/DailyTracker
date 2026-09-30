using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace DailyTrackerAPI.Migrations
{
    /// <inheritdoc />
    public partial class FixMeetingTimes : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Meeting times were saved as India wall-clock time but marked UTC,
            // so they now show 5½ hours late. Move the saved ones back to real UTC.
            migrationBuilder.Sql("UPDATE \"Meetings\" SET \"ScheduledAt\" = \"ScheduledAt\" - interval '330 minutes';");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("UPDATE \"Meetings\" SET \"ScheduledAt\" = \"ScheduledAt\" + interval '330 minutes';");
        }
    }
}
