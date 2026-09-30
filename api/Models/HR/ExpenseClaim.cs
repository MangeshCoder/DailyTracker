using DailyTrackerAPI.Models.Auth;

namespace DailyTrackerAPI.Models.HR
{
    /// <summary>
    /// Money an employee spent for work (travel, food, internet …) with the bill
    /// attached. Approved claims are paid back with that month's salary.
    /// </summary>
    public class ExpenseClaim
    {
        public int Id { get; set; }
        public int UserId { get; set; }
        public DateTime ExpenseDate { get; set; }            // the day on the bill (India date)
        public string Category { get; set; } = "Other";      // Travel, Food, Internet, Office, Other
        public decimal Amount { get; set; }
        public string Description { get; set; } = "";
        public string ReceiptKey { get; set; } = "";         // private file storage key
        public string ReceiptFileName { get; set; } = "";
        public string ReceiptMimeType { get; set; } = "";
        public string Status { get; set; } = "Pending";      // Pending, Approved, Rejected
        public int? ReviewedById { get; set; }
        public string? ReviewNote { get; set; }
        public DateTime? ReviewedAt { get; set; }
        /// <summary>The payroll month it is paid in (the India month it was approved)</summary>
        public int? PayMonth { get; set; }
        public int? PayYear { get; set; }
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        public virtual User User { get; set; } = null!;
        public virtual User? ReviewedBy { get; set; }
    }
}
