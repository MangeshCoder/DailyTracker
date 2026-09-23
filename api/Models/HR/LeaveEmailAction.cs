namespace DailyTrackerAPI.Models.HR
{
    public class LeaveEmailAction
    {
        public int Id { get; set; }

        public int LeaveId { get; set; }
        public int ManagerId { get; set; }

        public string Token { get; set; } = Guid.NewGuid().ToString();

        public DateTime ExpiryDate { get; set; }

        public bool IsUsed { get; set; } = false;

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}
