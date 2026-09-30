namespace DailyTrackerAPI.DTOs
{
    public class CompOffCreditDto
    {
        public int Id { get; set; }
        public int UserId { get; set; }
        public string UserName { get; set; } = "";
        public DateTime WorkDate { get; set; }
        public string Occasion { get; set; } = "";
        public int WorkMinutes { get; set; }
        /// <summary>Pending, Available, Used, Expired or Rejected</summary>
        public string State { get; set; } = "";
        public DateTime ExpiresOn { get; set; }
        public DateTime? UsedOn { get; set; }               // first day of the leave it paid for
        public string? ReviewerName { get; set; }
        public string? ReviewNote { get; set; }
        public bool IsOwn { get; set; }
    }

    public class MyCompOffDto
    {
        public int Available { get; set; }
        public int Pending { get; set; }
        public int Used { get; set; }
        public int Expired { get; set; }
        /// <summary>The earliest date an available day runs out, if any</summary>
        public DateTime? NextExpiry { get; set; }
        public int MinHours { get; set; }
        public int ValidDays { get; set; }
        public List<CompOffCreditDto> Credits { get; set; } = new();
    }

    public class ReviewCompOffDto
    {
        public string Status { get; set; } = "";
        public string? Note { get; set; }
    }
}
