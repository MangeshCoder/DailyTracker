namespace DailyTrackerAPI.DTOs
{
    public class ExpenseClaimDto
    {
        public int Id { get; set; }
        public int UserId { get; set; }
        public string UserName { get; set; } = "";
        public DateTime ExpenseDate { get; set; }
        public string Category { get; set; } = "";
        public decimal Amount { get; set; }
        public string Description { get; set; } = "";
        public string ReceiptFileName { get; set; } = "";
        public string Status { get; set; } = "";
        public string? ReviewerName { get; set; }
        public string? ReviewNote { get; set; }
        public DateTime? ReviewedAt { get; set; }
        /// <summary>"October 2026" — the salary it is paid with</summary>
        public string? PaidWith { get; set; }
        public DateTime CreatedAt { get; set; }
        public bool IsOwn { get; set; }
    }

    public class SubmitExpenseDto
    {
        public DateTime ExpenseDate { get; set; }
        public string Category { get; set; } = "";
        public decimal Amount { get; set; }
        public string Description { get; set; } = "";
    }

    public class ReviewExpenseDto
    {
        public string Status { get; set; } = "";
        public string? Note { get; set; }
    }
}
