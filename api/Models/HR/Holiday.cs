namespace DailyTrackerAPI.Models.HR
{
    // ─── Feature 10: Holiday Calendar ─────────────────────────────────────────
    public class Holiday
    {
        public int Id { get; set; }
        public DateTime Date { get; set; }
        public string Name { get; set; } = string.Empty;
        public string Type { get; set; } = "Public"; // Public, Optional, CompanySpecific
        public int Year { get; set; }
    }
}
