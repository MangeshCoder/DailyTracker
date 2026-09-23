using DailyTrackerAPI.Models.Auth;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace DailyTrackerAPI.Models.HR
{
    // ─── Payroll Summary — Employee Salary Configuration ─────────────────────
    //
    // Stores the monthly salary for each employee.
    // Set by a Manager/TeamLead. One record per employee (unique on UserId).
    // When salary changes, the old record is updated (UpdatedAt tracks history).
    //
    // Payroll is calculated on-demand from this record + DailyLog data.
    // No payroll rows are stored — calculation happens at request time.
    // ─────────────────────────────────────────────────────────────────────────
    public class EmployeeSalary
    {
        public int Id { get; set; }

        // ── Employee ──────────────────────────────────────────────────────────
        public int UserId { get; set; }
        public virtual User User { get; set; } = null!;

        // ── Salary ────────────────────────────────────────────────────────────
        /// <summary>Gross monthly salary (before deductions)</summary>
        [Column(TypeName = "decimal(18,2)")]
        public decimal MonthlySalary { get; set; }

        /// <summary>Currency code — INR, USD, EUR etc.</summary>
        [MaxLength(10)]
        public string Currency { get; set; } = "INR";

        /// <summary>
        /// Overtime multiplier — 1.5 means 1.5× hourly rate per OT hour.
        /// Stored so each employee can have a different OT rate.
        /// </summary>
        [Column(TypeName = "decimal(4,2)")]
        public decimal OvertimeMultiplier { get; set; } = 1.5m;

        // ── Meta ──────────────────────────────────────────────────────────────
        public DateTime EffectiveFrom { get; set; } = DateTime.UtcNow;

        /// <summary>Manager who set / last updated this salary</summary>
        public int SetByUserId { get; set; }
        public virtual User SetBy { get; set; } = null!;

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    }
}
