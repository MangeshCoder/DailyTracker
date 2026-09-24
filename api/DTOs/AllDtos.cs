using System.ComponentModel.DataAnnotations;

namespace DailyTrackerAPI.DTOs
{
    // Auth DTOs are used for registration, login, and token responses. They include validation attributes to ensure required fields are provided and properly formatted.
    public class RegisterDto
    {
        [Required] public string FullName { get; set; } = string.Empty;
        [Required, EmailAddress] public string Email { get; set; } = string.Empty;
        [Required, MinLength(6)] public string Password { get; set; } = string.Empty;
        //public string Role { get; set; } = "Developer";
    }

    public class LoginDto
    {
        [Required, EmailAddress] public string Email { get; set; } = string.Empty;
        [Required] public string Password { get; set; } = string.Empty;
    }

    public class AuthResponseDto
    {
        public string Token { get; set; } = string.Empty;
        public DateTime Expiry { get; set; }
        public UserDto User { get; set; } = null!;
    }

    public class UserDto
    {
        public int Id { get; set; }
        public string FullName { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
        public string Role { get; set; } = string.Empty;
        public bool IsActive { get; set; } = true;
        public string? Department { get; set; }
        public string? Designation { get; set; }
        public string? ProfilePhotoUrl { get; set; }

    }

    // Includes all fields plus manager info (denormalized for convenience)
    public class UserProfileDto
    {
        public int Id { get; set; }
        public string FullName { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
        public string Role { get; set; } = string.Empty;
        public bool IsActive { get; set; }
        public string? Department { get; set; }
        public string? Designation { get; set; }
        public string? Phone { get; set; }
        public string? Bio { get; set; }
        public DateTime? JoinDate { get; set; }
        public string? ProfilePhotoUrl { get; set; }
        public DateTime CreatedAt { get; set; }
        public int? ManagerId { get; set; }
        public string? ManagerName { get; set; }
    }

    // Manager-only fields (Role, Department, Designation, ManagerId, IsActive) are NOT included here to prevent unauthorized changes.
    public class UpdateProfileDto
    {
        public string? FullName { get; set; }   // allow name correction
        public string? Department { get; set; }
        public string? Designation { get; set; }
        public string? Phone { get; set; }
        public string? Bio { get; set; }
        public DateTime? JoinDate { get; set; }
        // NOTE: ProfilePhotoUrl is set only via POST /api/profile/photo (file upload)
        // NOTE: Role, Email, ManagerId, IsActive are NOT editable here (manager-only)
    }

    /// <summary>Lightweight card for the /team/directory grid</summary>
    public class DirectoryUserDto
    {
        public int Id { get; set; }
        public string FullName { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
        public string Role { get; set; } = string.Empty;
        public string? Department { get; set; }
        public string? Designation { get; set; }
        public string? Phone { get; set; }
        public string? ProfilePhotoUrl { get; set; }
        public bool IsActive { get; set; }
        public string? ManagerName { get; set; }
    }

    public class UpdateEmployeeProfileDto
    {
        public string? Department { get; set; }
        public string? Designation { get; set; }
        public DateTime? JoinDate { get; set; }
        public int? ManagerId { get; set; }
    }

    // ─── Auth / Security ──────────────────────────────────────────────────────
    public class AuthResponseV2Dto
    {
        public string AccessToken { get; set; } = string.Empty;
        public string RefreshToken { get; set; } = string.Empty;
        public DateTime AccessTokenExpiry { get; set; }
        public UserDto User { get; set; } = null!;
    }

    public class RefreshTokenRequestDto
    {
        public string RefreshToken { get; set; } = string.Empty;
    }

    // ─── Two-Factor Authentication DTOs ───────────────────────────────────────
    public class Setup2FAResponseDto
    {
        public string ManualEntryKey { get; set; } = string.Empty;  // Base32 secret for manual entry
        public string QrCodeBase64 { get; set; } = string.Empty;   // PNG QR code as base64
        public string Message { get; set; } = string.Empty;
    }

    public class Verify2FASetupDto
    {
        public string Code { get; set; } = string.Empty;  // 6-digit TOTP code
    }

    public class Verify2FALoginDto
    {
        public string TempToken { get; set; } = string.Empty;  // From login response when 2FA required
        public string Code { get; set; } = string.Empty;        // 6-digit TOTP code
    }

    public class Disable2FADto
    {
        public string Code { get; set; } = string.Empty;  // Current 6-digit code to verify identity
    }

    /// <summary>
    /// Check RequiresTwoFactor: if true, send TempToken + Code to verify-2fa-login.
    /// </summary>
    public class LoginResponseDto
    {
        public bool RequiresTwoFactor { get; set; }
        public string? TempToken { get; set; }           // Present when RequiresTwoFactor
        public string? Message { get; set; }             // "Enter the 6-digit code from your authenticator app"
        public AuthResponseV2Dto? Tokens { get; set; }   // Present when !RequiresTwoFactor
        public UserDto? User => Tokens?.User;            // <-- ADD THIS LINE for direct frontend compatibility
    }

    public class ChangePasswordDto
    {
        public string CurrentPassword { get; set; } = string.Empty;
        public string NewPassword { get; set; } = string.Empty;
    }

    public class ForgotPasswordDto { public string Email { get; set; } = string.Empty; }
    public class ResetPasswordDto
    {
        public string Email { get; set; }
        public string Code { get; set; }
        public string NewPassword { get; set; }
    }

    public class VerifyLoginOtpDto
    {
        public string Email { get; set; }
        public string Code { get; set; }
    }

    // ─── Audit Log ────────────────────────────────────────────────────────────
    public class AuditLogDto
    {
        public int Id { get; set; }
        public string UserName { get; set; } = string.Empty;
        public string Action { get; set; } = string.Empty;
        public string Entity { get; set; } = string.Empty;
        public int? EntityId { get; set; }
        public string? OldValues { get; set; }
        public string? NewValues { get; set; }
        public string? IpAddress { get; set; }
        public DateTime CreatedAt { get; set; }
    }

    // ─── Goals & Productivity ─────────────────────────────────────────────────
    public class SetGoalDto
    {
        public int TargetWorkMinutes { get; set; } = 480;
        public int TargetTasksCompleted { get; set; } = 5;
        public int TargetBreakMinutes { get; set; } = 60;
        public int TargetSupportGiven { get; set; } = 5;
        public string? ManagerSetNote { get; set; }
    }

    // ─── EOD Report ──────────────────────────────────────────────────────────
    public class CreateEODReportDto
    {
        public string WhatWasDone { get; set; } = string.Empty;
        public string? Blockers { get; set; }
        public string? PlanForTomorrow { get; set; }
        public string? Learnings { get; set; }
        public string MoodRating { get; set; } = "Good";
    }

    public class EODReportResponseDto
    {
        public int Id { get; set; }
        public string UserName { get; set; } = string.Empty;
        public DateTime ReportDate { get; set; }
        public string WhatWasDone { get; set; } = string.Empty;
        public string? Blockers { get; set; }
        public string? PlanForTomorrow { get; set; }
        public string? Learnings { get; set; }
        public string MoodRating { get; set; } = string.Empty;
        public DateTime SubmittedAt { get; set; }
        public bool IsReviewedByManager { get; set; }
        public string? ManagerComment { get; set; }
    }

    public class ManagerReviewEODDto
    {
        public string ManagerComment { get; set; } = string.Empty;
    }

    // ─── Task Templates ───────────────────────────────────────────────────────
    public class CreateTemplateDto
    {
        public string Title { get; set; } = string.Empty;
        public string? Description { get; set; }
        public string? ProjectName { get; set; }
        public int DefaultTimeMinutes { get; set; } = 60;
        public string Priority { get; set; } = "Medium";
        public string? Tags { get; set; }
        public bool IsRecurring { get; set; }
        public string? RecurrenceDays { get; set; }
    }

    public class TaskTemplateDto : CreateTemplateDto
    {
        public int Id { get; set; }
        public DateTime CreatedAt { get; set; }
    }

    // ─── Task Timer ───────────────────────────────────────────────────────────
    public class TaskTimerDto
    {
        public int Id { get; set; }
        public int TaskLogId { get; set; }
        public DateTime StartedAt { get; set; }
        public DateTime? StoppedAt { get; set; }
        public int DurationMinutes { get; set; }
        public bool IsRunning { get; set; }
        public int TotalSessionMinutes { get; set; } // all sessions combined
    }

    // ─── Team Presence ────────────────────────────────────────────────────────
    public class UpdatePresenceDto
    {
        public bool IsAvailableForHelp { get; set; }
        public string Status { get; set; } = "Online";
        public string? StatusMessage { get; set; }
    }

    public class UserPresenceDto
    {
        public UserDto User { get; set; } = null!;
        public bool IsAvailableForHelp { get; set; }
        public string Status { get; set; } = "Online";
        public string? StatusMessage { get; set; }
        public DateTime UpdatedAt { get; set; }
        public bool IsCheckedInToday { get; set; }
        public string? CheckInTime { get; set; }
    }

    // ─── Kudos ────────────────────────────────────────────────────────────────
    public class GiveKudosDto
    {
        public int ToUserId { get; set; }
        public string Message { get; set; } = string.Empty;
        public string BadgeType { get; set; } = "GreatWork";
    }

    public class KudosDto
    {
        public int Id { get; set; }
        public string FromUserName { get; set; } = string.Empty;
        public string ToUserName { get; set; } = string.Empty;
        public string Message { get; set; } = string.Empty;
        public string BadgeType { get; set; } = string.Empty;
        public DateTime GivenAt { get; set; }
    }

    public class KudosSummaryDto
    {
        public UserDto User { get; set; } = null!;
        public int TotalReceived { get; set; }
        public int TotalGiven { get; set; }
        public Dictionary<string, int> BadgeCounts { get; set; } = new();
        public List<KudosDto> RecentKudos { get; set; } = new();
    }

    public class KudosLeaderboardEntryDto
    {
        public int Rank { get; set; }         
        public int UserId { get; set; }
        public string UserName { get; set; } = string.Empty;
        public int TotalReceived { get; set; }         
        public int TotalGiven { get; set; }         
        public Dictionary<string, int> BadgeCounts { get; set; } = new();
        public string TopBadge { get; set; } = string.Empty;
    }

    public class KudosLeaderboardDto
    {
        public int Year { get; set; }
        public int? Month { get; set; }         
        public string PeriodLabel { get; set; } = string.Empty;
        public List<KudosLeaderboardEntryDto> Entries { get; set; } = new();
    }

    // ─── Announcements ────────────────────────────────────────────────────────
    public class CreateAnnouncementDto
    {
        public string Title { get; set; } = string.Empty;
        public string Content { get; set; } = string.Empty;
        public string Category { get; set; } = "General";   // General | Policy | Event | Urgent
        public bool IsPinned { get; set; } = false;
        public DateTime? ExpiresAt { get; set; }
    }

    public class AnnouncementDto
    {
        public int Id { get; set; }
        public string Title { get; set; } = string.Empty;
        public string Content { get; set; } = string.Empty;
        public string Category { get; set; } = string.Empty;
        public bool IsPinned { get; set; }
        public DateTime? ExpiresAt { get; set; }
        public DateTime CreatedAt { get; set; }
        public string CreatedByName { get; set; } = string.Empty;
        public bool IsRead { get; set; }   // computed per requesting user
    }

    public class AnnouncementsResponseDto
    {
        public List<AnnouncementDto> Pinned { get; set; } = new();   // pinned first
        public List<AnnouncementDto> Regular { get; set; } = new();   // rest
        public int UnreadCount { get; set; }
    }

    // ─── Leave Management ─────────────────────────────────────────────────────
    public class ApplyLeaveDto
    {
        public DateTime FromDate { get; set; }
        public DateTime ToDate { get; set; }
        public string LeaveType { get; set; } = "Casual";
        public string Reason { get; set; } = string.Empty;
    }

    public class LeaveResponseDto
    {
        public int Id { get; set; }
        public string UserName { get; set; } = string.Empty;
        public DateTime FromDate { get; set; }
        public DateTime ToDate { get; set; }
        public int LeaveDays { get; set; }
        public string LeaveType { get; set; } = string.Empty;
        public string Reason { get; set; } = string.Empty;
        public string Status { get; set; } = string.Empty;
        public string? ReviewerName { get; set; }
        public string? ReviewNote { get; set; }
        public DateTime? ReviewedAt { get; set; }
        public DateTime AppliedAt { get; set; }
    }

    public class ReviewLeaveDto
    {
        public string Status { get; set; } = "Approved"; // Approved or Rejected
        public string? ReviewNote { get; set; }
    }

    // ─── Holidays ─────────────────────────────────────────────────────────────
    public class CreateHolidayDto
    {
        public DateTime Date { get; set; }
        public string Name { get; set; } = string.Empty;
        public string Type { get; set; } = "Public";
    }

    public class HolidayDto : CreateHolidayDto
    {
        public int Id { get; set; }
        public int Year { get; set; }
        public bool IsToday { get; set; }
    }

    // ─── Late Arrival ─────────────────────────────────────────────────────────
    public class LateArrivalReasonDto
    {
        public string Reason { get; set; } = string.Empty;
    }

    // ─── Notifications ────────────────────────────────────────────────────────
    public class NotificationDto
    {
        public int Id { get; set; }
        public string Title { get; set; } = string.Empty;
        public string Message { get; set; } = string.Empty;
        public string Type { get; set; } = string.Empty;
        public string? ActionUrl { get; set; }
        public bool IsRead { get; set; }
        public DateTime CreatedAt { get; set; }
    }

    // ─── Advanced Analytics ───────────────────────────────────────────────────
    public class HeatmapDataDto
    {
        public DateTime Date { get; set; }
        public int WorkMinutes { get; set; }
        public int TasksCompleted { get; set; }
        public int Level { get; set; }  // 0–4 (like GitHub heatmap)
    }

    public class ProjectTimeDto
    {
        public string ProjectName { get; set; } = string.Empty;
        public int TotalMinutes { get; set; }
        public int TaskCount { get; set; }
        public double Percentage { get; set; }
    }

    public class ProductivityTrendDto
    {
        public DateTime Date { get; set; }
        public double Score { get; set; }
        public int WorkMinutes { get; set; }
        public int TasksCompleted { get; set; }
        public int SupportLogsCompleted { get; set; }
        public string DayName { get; set; } = string.Empty;
    }

    public class PeakHourDto
    {
        public int Hour { get; set; }
        public string HourLabel { get; set; } = string.Empty;
        public int TasksCompleted { get; set; }
    }

    public class AdvancedAnalyticsDto
    {
        public List<HeatmapDataDto> Heatmap { get; set; } = new();
        public List<ProjectTimeDto> ProjectBreakdown { get; set; } = new();
        public List<ProductivityTrendDto> ProductivityTrend { get; set; } = new();
        public List<PeakHourDto> PeakHours { get; set; } = new();
        public double OverallProductivityScore { get; set; }
        public string MostProductiveDay { get; set; } = string.Empty;
        public string MostWorkedProject { get; set; } = string.Empty;
        public int TotalTasksCompleted { get; set; }
        public int TotalWorkMinutes { get; set; }
        public int TotalSupportGiven { get; set; }
    }


    public class GoalProgressDto
    {
        public SetGoalDto Goal { get; set; } = null!;
        public int ActualWorkMinutes { get; set; }
        public int ActualTasksCompleted { get; set; }
        public int ActualSupportGiven { get; set; }
        public int ActualBreakMinutes { get; set; }
        public double WorkProgress { get; set; }     // 0–100
        public double TaskProgress { get; set; }
        public double SupportProgress { get; set; }
        public double BreakProgress { get; set; }
        public double ProductivityScore { get; set; } // 0–100
        public string ScoreGrade { get; set; } = string.Empty; // A, B, C, D
        public List<string> Insights { get; set; } = new();
    }
    // ─── DailyLog ───────────────────────────────────────────────────────────────

    public class CheckInDto
    {
        public string DayStatus { get; set; } = "Present"; // Present, WFH, HalfDay
        public string? Notes { get; set; }
        // GPS coordinates from browser — required for location check
        [Required] public double Latitude { get; set; }
        [Required] public double Longitude { get; set; }
    }

    public class CheckOutDto
    {
        public string? Notes { get; set; }
        [Required] public double Latitude { get; set; }
        [Required] public double Longitude { get; set; }
    }

    public class DailyLogResponseDto
    {
        public int Id { get; set; }
        public DateTime LogDate { get; set; }
        public DateTime? CheckInTime { get; set; }
        public DateTime? CheckOutTime { get; set; }
        public int TotalWorkMinutes { get; set; }
        public int TotalBreakMinutes { get; set; }
        public string DayStatus { get; set; } = string.Empty;
        public string? Notes { get; set; }
        public string WorkHours { get; set; } = string.Empty;
        public List<BreakLogDto> Breaks { get; set; } = new();
        public List<TaskLogDto> Tasks { get; set; } = new();
        public List<SupportLogResponseDto> SupportLogs { get; set; } = new();
    }

    // ─── Breaks ─────────────────────────────────────────────────────────────────

    public class StartBreakDto
    {
        [Required] public string BreakType { get; set; } = "Tea"; // Lunch, Tea, Other
    }

    public class BreakLogDto
    {
        public int Id { get; set; }
        public string BreakType { get; set; } = string.Empty;
        public DateTime StartTime { get; set; }
        public DateTime? EndTime { get; set; }
        public int DurationMinutes { get; set; }
        public bool IsActive { get; set; }
    }

    // ─── Tasks ──────────────────────────────────────────────────────────────────

    public class CreateTaskDto
    {
        [Required] public string TaskTitle { get; set; } = string.Empty;
        public string? Description { get; set; }
        public string? ProjectName { get; set; }
        public string Status { get; set; } = "InProgress";
        public int TimeSpentMinutes { get; set; } = 0;
        public string Priority { get; set; } = "Medium";
        public string? Tags { get; set; }
    }

    public class UpdateTaskDto
    {
        public string? TaskTitle { get; set; }
        public string? Description { get; set; }
        public string? ProjectName { get; set; }
        public string? Status { get; set; }
        public int? TimeSpentMinutes { get; set; }
        public string? Priority { get; set; }
        public string? Tags { get; set; }
    }

    public class TaskLogDto
    {
        public int Id { get; set; }
        public string TaskTitle { get; set; } = string.Empty;
        public string? Description { get; set; }
        public string? ProjectName { get; set; }
        public string Status { get; set; } = string.Empty;
        public int TimeSpentMinutes { get; set; }
        public string Priority { get; set; } = string.Empty;
        public string? Tags { get; set; }
        public DateTime? CompletedAt { get; set; }
        public DateTime CreatedAt { get; set; }
    }

    // ─── Support ────────────────────────────────────────────────────────────────

    public class CreateSupportDto
    {
        [Required] public int SupportEngineerId { get; set; }  // ← NEW (Feature 2)
        [Required] public int SupportedDeveloperId { get; set; }
        [Required] public string IssueDescription { get; set; } = string.Empty;
        public string? Resolution { get; set; }
        public int TimeSpentMinutes { get; set; } = 0;
        public string SupportType { get; set; } = "Technical";
        [Required] public double Latitude { get; set; }
        [Required] public double Longitude { get; set; }
        public int? SupportAssignmentId { get; set; }  // ← NEW (Feature 3, optional)
    }

    public class SupportLogResponseDto
    {
        public int Id { get; set; }
        public string SupportEngineerName { get; set; } = string.Empty;  // ← NEW
        public string SupportedDeveloperName { get; set; } = string.Empty;
        public string IssueDescription { get; set; } = string.Empty;
        public string? Resolution { get; set; }
        public int TimeSpentMinutes { get; set; }
        public string SupportType { get; set; } = string.Empty;
        public DateTime SupportedAt { get; set; }
        public List<MediaEvidenceDto> Media { get; set; } = new();
        public double? Latitude { get; set; }
        public double? Longitude { get; set; }
        public double? DistanceFromOfficeMetres { get; set; }
        public bool WasAssigned { get; set; }  // ← true if created under manager assignment
    }
    public class SupportAssignmentDto
    {
        public int Id { get; set; }
        public int SupportEngineerId { get; set; }
        public string SupportEngineerName { get; set; } = string.Empty;
        public int DeveloperId { get; set; }
        public string DeveloperName { get; set; } = string.Empty;
        public string AssignedByManager { get; set; } = string.Empty;
        public bool IsActive { get; set; }
        public string? Notes { get; set; }
        public DateTime AssignedAt { get; set; }
    }

    public class CreateSupportAssignmentDto
    {
        [Required] public int SupportEngineerId { get; set; }
        [Required] public int DeveloperId { get; set; }
        public string? Notes { get; set; }
    }

    public class MyAssignmentDto
    {
        public bool HasAssignment { get; set; }
        public int? AssignmentId { get; set; }
        public int? SupportEngineerId { get; set; }
        public string? SupportEngineerName { get; set; }
        public string? Notes { get; set; }
        public DateTime? AssignedAt { get; set; }
    }

    public class MediaEvidenceDto
    {
        public int Id { get; set; }
        public string MediaType { get; set; } = string.Empty;  // Screenshot | Recording | File
        public string FileName { get; set; } = string.Empty;
        public string Url { get; set; } = string.Empty;        // /uploads/support/xxx
        public long FileSizeBytes { get; set; }
        public string MimeType { get; set; } = string.Empty;
    }

    // ─── Dashboard ──────────────────────────────────────────────────────────────

    public class DashboardSummaryDto
    {
        public DailyLogResponseDto? TodayLog { get; set; }
        public int TasksCompleted { get; set; }
        public int TasksInProgress { get; set; }
        public int TotalSupportGiven { get; set; }
        public int NetWorkMinutes { get; set; }
        public string NetWorkHours { get; set; } = string.Empty;
        public bool IsCheckedIn { get; set; }
        public bool HasActiveBreak { get; set; }
        public BreakLogDto? ActiveBreak { get; set; }
    }

    public class WeeklyReportDto
    {
        public List<DailyLogResponseDto> Days { get; set; } = new();
        public int TotalWorkMinutes { get; set; }
        public int TotalTasksCompleted { get; set; }
        public int TotalSupportGiven { get; set; }
        public double AverageDailyHours { get; set; }
    }

    public class TeamMemberActivityDto
    {
        public UserDto User { get; set; } = null!;
        public bool IsCheckedIn { get; set; }
        public DateTime? CheckInTime { get; set; }
        public int TasksDoneToday { get; set; }
        public string DayStatus { get; set; } = string.Empty;
    }

    // ─── Attendance ────────────────────────────────────────────────────────────

    public class UserAttendanceSummaryDto
    {
        public UserDto User { get; set; } = null!;
        public int Month { get; set; }
        public int Year { get; set; }
        public int WorkingDaysInMonth { get; set; }
        public int DaysPresent { get; set; }
        public int DaysWFH { get; set; }
        public int DaysHalfDay { get; set; }
        public int DaysAbsent { get; set; }
        public int DaysWeekend { get; set; }  
        public int DaysHoliday { get; set; }  
        public double AttendancePercentage { get; set; }
        public int TotalWorkMinutes { get; set; }
        public string TotalWorkHours { get; set; } = string.Empty;
        public double AverageDailyHours { get; set; }
        public int TotalTasksCompleted { get; set; }
        public int TotalSupportGiven { get; set; }
    }

    public class AttendanceDayDto
    {
        public DateTime Date { get; set; }
        public string Status { get; set; } = "Absent";
        public string? CheckIn { get; set; }
        public string? CheckOut { get; set; }
        public string WorkHours { get; set; } = "0h 0m";
        public int TasksCompleted { get; set; }
    }

    // ─── Manager Team Overview ─────────────────────────────────────────────────

    public class ManagerTeamDailyDto
    {
        public DateTime Date { get; set; }
        public int TotalMembers { get; set; }
        public int CheckedIn { get; set; }
        public int NotCheckedIn { get; set; }
        public List<UserDailyActivityDto> Members { get; set; } = new();
    }

    public class UserDailyActivityDto
    {
        public UserDto User { get; set; } = null!;
        public string DayStatus { get; set; } = "Absent";
        public string? CheckInTime { get; set; }
        public string? CheckOutTime { get; set; }
        public string WorkHours { get; set; } = "0h 0m";
        public int TotalBreakMinutes { get; set; }
        public int TasksTotal { get; set; }
        public int TasksCompleted { get; set; }
        public int TasksInProgress { get; set; }
        public int SupportGiven { get; set; }
        public bool IsOnBreak { get; set; }
        public string? ActiveBreakType { get; set; }
        public List<TaskLogDto> Tasks { get; set; } = new();
        public List<SupportLogResponseDto> SupportLogs { get; set; } = new();
    }

    // ─── User Full Report (for PDF/Word export) ────────────────────────────────

    public class UserFullReportDto
    {
        public UserDto User { get; set; } = null!;
        public DateTime FromDate { get; set; }
        public DateTime ToDate { get; set; }
        public int TotalWorkingDays { get; set; }
        public int DaysPresent { get; set; }
        public double AttendancePercentage { get; set; }
        public int TotalWorkMinutes { get; set; }
        public string TotalWorkHours { get; set; } = string.Empty;
        public double AverageDailyHours { get; set; }
        public int TotalTasksCompleted { get; set; }
        public int TotalTasksLogged { get; set; }
        public int TotalSupportGiven { get; set; }
        public List<DailyReportEntryDto> DailyEntries { get; set; } = new();
    }

    public class DailyReportEntryDto
    {
        public DateTime Date { get; set; }
        public string DayStatus { get; set; } = string.Empty;
        public string CheckIn { get; set; } = "--";
        public string CheckOut { get; set; } = "--";
        public string WorkHours { get; set; } = "0h 0m";
        public int BreakMinutes { get; set; }
        public List<string> TasksSummary { get; set; } = new();
        public List<string> SupportSummary { get; set; } = new();
        public string? Notes { get; set; }
    }

    // ─── Manager Stats ─────────────────────────────────────────────────────────

    public class TeamMonthlyStatsDto
    {
        public int Month { get; set; }
        public int Year { get; set; }
        public List<UserAttendanceSummaryDto> Members { get; set; } = new();
        public double TeamAverageAttendance { get; set; }
        public int TeamTotalTasksCompleted { get; set; }
        public int TeamTotalSupportLogs { get; set; }
    }

    public record OtpRequest(string Code);
    public record SendOtpRequest(string Purpose);
    public record VerifyOtpRequest(string Code, string Purpose);
    /// <summary>Same DeviceToken should be sent as X-Device-Token header on login to skip 2FA.</summary>
    public class TrustDeviceRequest
    {
        public string DeviceToken { get; set; } = string.Empty;  // UUID - same as X-Device-Token header
        public string? DeviceName { get; set; }                   // e.g. "Chrome on Windows" for display
    }

    public class CreateWFHRequestDto
    {
        /// <summary>WFH | HalfDay</summary>
        public string RequestType { get; set; } = "WFH";

        /// <summary>Date the request applies to (YYYY-MM-DD)</summary>
        public DateTime RequestDate { get; set; }

        /// <summary>Morning | Afternoon — only for HalfDay</summary>
        public string? HalfDaySlot { get; set; }

        /// <summary>Why the employee needs WFH/HalfDay</summary>
        public string Reason { get; set; } = string.Empty;
    }

    public class ReviewWFHRequestDto
    {
        public string? Note { get; set; }
    }

    public class WFHRequestDto
    {
        public int Id { get; set; }
        public int UserId { get; set; }
        public string EmployeeName { get; set; } = "";
        public string RequestType { get; set; } = "";
        public DateTime RequestDate { get; set; }
        public string RequestDateLabel { get; set; } = "";
        public string? HalfDaySlot { get; set; }
        public string Reason { get; set; } = "";
        public string Status { get; set; } = "";
        public string? ReviewedByName { get; set; }
        public string? ReviewNote { get; set; }
        public DateTime? ReviewedAt { get; set; }
        public DateTime RequestedAt { get; set; }
    }

    public class ManagerDailyStatusDto
    {
        public DateTime Date { get; set; }
        public string DateLabel { get; set; } = "";
        public int TotalMembers { get; set; }
        public int PresentCount { get; set; }
        public int WFHCount { get; set; }
        public int HalfDayCount { get; set; }
        public int NotCheckedInCount { get; set; }
        public int PendingRequestsCount { get; set; }
        public List<TeamMemberStatusDto> Members { get; set; } = new();
    }

    public class TeamMemberStatusDto
    {
        public int UserId { get; set; }
        public string FullName { get; set; } = "";
        public string Email { get; set; } = "";
        public string Role { get; set; } = "";
        public string EffectiveStatus { get; set; } = "";
        public DateTime? CheckInTime { get; set; }
        public DateTime? CheckOutTime { get; set; }
        public int WorkMinutes { get; set; }
        public string WorkHours { get; set; } = "";
        public int BreakMinutes { get; set; }
        public bool IsOnBreak { get; set; }
        public int TasksCompleted { get; set; }
        public int TasksTotal { get; set; }
        public bool HasApprovedWFH { get; set; }
        public bool HasApprovedHalfDay { get; set; }
        public string? HalfDaySlot { get; set; }
        public bool HasPendingRequest { get; set; }
        public string? PendingRequestType { get; set; }
        public int? PendingRequestId { get; set; }
    }

    public class TeamAttendanceMonthDto
    {
        public int UserId { get; set; }
        public string FullName { get; set; } = "";
        public string Role { get; set; } = "";
        public int Month { get; set; }
        public int Year { get; set; }
        public int WorkingDaysInMonth { get; set; }
        public int DaysPresent { get; set; }
        public int DaysWFH { get; set; }
        public int DaysHalfDay { get; set; }
        public int DaysAbsent { get; set; }
        public int DaysWeekend { get; set; }  
        public int DaysHoliday { get; set; }
        public List<string> WeekendDates { get; set; } = new();
        public List<string> HolidayDates { get; set; } = new();
        public double AttendancePercentage { get; set; }
        public int TotalWorkMinutes { get; set; }
        public string TotalWorkHours { get; set; } = "";
        public double AverageDailyHours { get; set; }
        public int TotalTasksCompleted { get; set; }
        public List<string> WFHDates { get; set; } = new();
        public List<string> HalfDayDates { get; set; } = new();
    }

    public class EmailRequestDto
    {
        public string Email { get; set; }
    }
    public class RegisterWithOtpDto
    {
        public string FullName { get; set; }
        public string Email { get; set; }
        public string Password { get; set; }
       // public string Role { get; set; }
        public string Code { get; set; }
    }

    public class EmailReviewDto
    {
        public string Token { get; set; }
        public string Status { get; set; }
    }

    //public class LeaveBalanceDto
    //{
    //    public int UserId { get; set; }
    //    public string UserName { get; set; } = "";
    //    public int UsedDays { get; set; }
    //    public int RemainingDays { get; set; }
    //}

    // One row per leave type (Casual, Sick, Earned, CompOff, Unpaid)
    public class LeaveTypeBalanceItem
    {
        public string LeaveType { get; set; } = string.Empty;
        public int Entitlement { get; set; }   // Annual cap; 0 = unlimited
        public int Used { get; set; }          // Approved + Pending this year
        public int Pending { get; set; }       // Subset of Used that are still Pending
        public int Remaining { get; set; }     // Entitlement - Used (0 for unlimited types)
        public bool IsUnlimited { get; set; }  // true for CompOff, Unpaid
    }

    public class LeaveBalanceDto
    {
        public int UserId { get; set; }
        public string UserName { get; set; } = string.Empty;
        public int Year { get; set; }
        public List<LeaveTypeBalanceItem> Balances { get; set; } = new();
    }

    public class CreateGroupDto
    {
        public string GroupName { get; set; } = string.Empty;
        public string? GroupAvatar { get; set; }
        public List<int> MemberIds { get; set; } = new();
    }

    public class SendMessageDto
    {
        public int ConversationId { get; set; }
        public string Content { get; set; } = string.Empty;
        public string? MessageType { get; set; } = "Text";
        public string? AttachmentUrl { get; set; }
        public string? AttachmentName { get; set; }
        public int? ReplyToMessageId { get; set; }
    }

    public class ConversationDto
    {
        public int Id { get; set; }
        public string Type { get; set; } = "";
        public string DisplayName { get; set; } = "";
        public string? GroupAvatar { get; set; }
        public int? OtherUserId { get; set; }
        public int UnreadCount { get; set; }
        public DateTime? LastMessageAt { get; set; }
        public string? LastMessagePreview { get; set; }
        public int MemberCount { get; set; }
    }

    public class ConversationSummaryDto : ConversationDto
    {
        public bool IsMuted { get; set; }
        public string? AvatarUrl { get; set; }
    }

    public class ConversationDetailDto
    {
        public int Id { get; set; }
        public string Type { get; set; } = "";
        public string? GroupName { get; set; }
        public string? GroupAvatar { get; set; }
        public DateTime CreatedAt { get; set; }
        public string MyRole { get; set; } = "";
        public List<MemberDto> Members { get; set; } = new();
    }

    public class MemberDto
    {
        public int UserId { get; set; }
        public string FullName { get; set; } = "";
        public string Email { get; set; } = "";
        public string Role { get; set; } = "";
        public DateTime JoinedAt { get; set; }
    }

    public class ChatMessageDto
    {
        public int Id { get; set; }
        public int ConversationId { get; set; }
        public int? SenderId { get; set; }
        public string SenderName { get; set; } = "";
        public string SenderInitial { get; set; } = "";
        public string Content { get; set; } = "";
        public string MessageType { get; set; } = "Text";
        public string? AttachmentUrl { get; set; }
        public string? AttachmentName { get; set; }
        public bool IsDeleted { get; set; }
        public bool IsEdited { get; set; }
        public DateTime SentAt { get; set; }
        public DateTime? EditedAt { get; set; }
        public ReplyPreviewDto? ReplyTo { get; set; }
        public List<ReactionDto> Reactions { get; set; } = new();
        public List<int> ReadByUserIds { get; set; } = new();
    }

    public class ReplyPreviewDto
    {
        public int Id { get; set; }
        public string SenderName { get; set; } = "";
        public string ContentPreview { get; set; } = "";
    }

    public class ReactionDto
    {
        public string Emoji { get; set; } = "";
        public int Count { get; set; }
        public List<int> UserIds { get; set; } = new();
    }

    public class ReactionResult
    {
        public int MessageId { get; set; }
        public string Emoji { get; set; } = "";
        public bool Added { get; set; }
        public Dictionary<string, int> ReactionCounts { get; set; } = new();
    }

    public class UserChatProfileDto
    {
        public int Id { get; set; }
        public string FullName { get; set; } = "";
        public string Email { get; set; } = "";
        public string Role { get; set; } = "";
        public string OnlineStatus { get; set; } = "Offline";
        public string? StatusMessage { get; set; }
    }
    public class AssignRoleDto
    {
        public int UserId { get; set; }
        public string Role { get; set; } = string.Empty;
        public int? ManagerId { get; set; }
    }

    public class EditMessageDto { public string Content { get; set; } = ""; }
    public class ReactDto { public string Emoji { get; set; } = ""; }
    public class AddMembersDto { public List<int> UserIds { get; set; } = new(); }
    public class UpdateGroupDto { public string? GroupName { get; set; } public string? GroupAvatar { get; set; } }

    // ─────────────────────────────────────────────────────────────────────────
    //  GoalHistoryDto  —  one entry per calendar day
    //
    //  Returned by GET /api/goals/history?from=2025-01-01&to=2025-01-31
    //
    //  WHY a separate DTO and not reuse GoalProgressDto?
    //    GoalProgressDto is designed for today's LIVE view — it recalculates
    //    work minutes from CheckInTime in real time if the user is still checked in.
    //    History entries are always complete/settled days, so we can use the
    //    stored TotalWorkMinutes directly. The shape is also simpler — no insights
    //    list, no live recalc needed.
    //
    //  Days with a DailyLog but no DailyGoal: targets will be 0 (user didn't
    //    set a goal that day). The UI treats 0 targets as "no goal set".
    //  Days with no DailyLog at all: the entry is skipped (not returned).
    // ─────────────────────────────────────────────────────────────────────────
    public class GoalHistoryDto
    {
        // ── When ─────────────────────────────────────────────────────────────
        public DateTime Date { get; set; }
        public string DayName { get; set; } = string.Empty;    // "Mon", "Tue" …
        public string DateLabel { get; set; } = string.Empty;  // "Jan 15"

        // ── Targets (0 if no goal was set that day) ───────────────────────────
        public int TargetWorkMinutes { get; set; }
        public int TargetTasksCompleted { get; set; }
        public int TargetSupportGiven { get; set; }
        public int TargetBreakMinutes { get; set; }

        // ── Actuals ───────────────────────────────────────────────────────────
        public int ActualWorkMinutes { get; set; }
        public int ActualTasksCompleted { get; set; }
        public int ActualSupportGiven { get; set; }
        public int ActualBreakMinutes { get; set; }

        // ── Progress (0–100) ──────────────────────────────────────────────────
        public double WorkProgress { get; set; }
        public double TaskProgress { get; set; }
        public double SupportProgress { get; set; }
        public double BreakProgress { get; set; }

        // ── Score ─────────────────────────────────────────────────────────────
        public double ProductivityScore { get; set; }
        public string ScoreGrade { get; set; } = string.Empty; // A, B, C, D
        public bool GoalWasSet { get; set; }  // false = worked but no goal configured
    }

    /// <summary>One employee's status on one specific calendar day</summary>
    public class CalendarMemberDayDto
    {
        public int UserId { get; set; }
        public string FullName { get; set; } = string.Empty;
        public string? ProfilePhotoUrl { get; set; }
        public string Role { get; set; } = string.Empty;
        /// <summary>Present | WFH | HalfDay | Leave | Absent | Weekend | Unknown</summary>
        public string Status { get; set; } = "Unknown";
        /// <summary>Leave type when Status = Leave (Casual, Sick, etc.)</summary>
        public string? LeaveType { get; set; }
    }

    /// <summary>All employees' status for one calendar day</summary>
    public class CalendarDayDto
    {
        public string Date { get; set; } = string.Empty;  // yyyy-MM-dd
        public string Weekday { get; set; } = string.Empty;  // Mon, Tue …
        public bool IsWeekend { get; set; }
        public bool IsHoliday { get; set; }
        public string? HolidayName { get; set; }
        public bool IsToday { get; set; }
        public List<CalendarMemberDayDto> Members { get; set; } = new();
    }

    /// <summary>Full monthly calendar response</summary>
    public class TeamCalendarResponseDto
    {
        public int Month { get; set; }
        public int Year { get; set; }
        public string Label { get; set; } = string.Empty;   // "June 2025"
        public List<CalendarDayDto> Days { get; set; } = new();
    }


    // ─── Meeting Log (Feature 6) ──────────────────────────────────────────────

    public class MeetingAttendeeDto
    {
        public int UserId { get; set; }
        public string FullName { get; set; } = string.Empty;
        public string? ProfilePhotoUrl { get; set; }
        public string Role { get; set; } = string.Empty;
        /// <summary>Pending | Accepted | Declined | Maybe</summary>
        public string Response { get; set; } = "Pending";
        public bool Attended { get; set; }
    }

    public class MeetingActionItemDto
    {
        public int Id { get; set; }
        public string Description { get; set; } = string.Empty;
        public int? AssignedToUserId { get; set; }
        public string? AssignedToUserName { get; set; }
        /// <summary>Open | InProgress | Done</summary>
        public string Status { get; set; } = "Open";
        public DateTime? DueDate { get; set; }
        public DateTime CreatedAt { get; set; }
    }

    public class MeetingDto
    {
        public int Id { get; set; }
        public string Title { get; set; } = string.Empty;
        public string? Agenda { get; set; }
        public string? Notes { get; set; }
        public string? Location { get; set; }
        public string MeetingType { get; set; } = string.Empty;
        public DateTime ScheduledAt { get; set; }
        public int DurationMinutes { get; set; }
        public string Status { get; set; } = string.Empty;
        public bool IsRecurring { get; set; }
        public string? RecurrencePattern { get; set; }
        public int OrganisedByUserId { get; set; }
        public string OrganisedByName { get; set; } = string.Empty;
        public DateTime CreatedAt { get; set; }
        // Current user's RSVP (null if not an attendee)
        public string? MyResponse { get; set; }
        public bool IsOrganiser { get; set; }
        public List<MeetingAttendeeDto> Attendees { get; set; } = new();
        public List<MeetingActionItemDto> ActionItems { get; set; } = new();
    }

    // Create / update meeting
    public class CreateMeetingDto
    {
        public string Title { get; set; } = string.Empty;
        public string? Agenda { get; set; }
        public string? Location { get; set; }
        public string MeetingType { get; set; } = "Other";
        public DateTime ScheduledAt { get; set; }
        public int DurationMinutes { get; set; } = 30;
        public bool IsRecurring { get; set; } = false;
        public string? RecurrencePattern { get; set; }
        /// <summary>UserIds to invite (organiser is auto-added)</summary>
        public List<int> AttendeeIds { get; set; } = new();
    }

    public class UpdateMeetingDto
    {
        public string? Title { get; set; }
        public string? Agenda { get; set; }
        public string? Notes { get; set; }
        public string? Location { get; set; }
        public string? MeetingType { get; set; }
        public DateTime? ScheduledAt { get; set; }
        public int? DurationMinutes { get; set; }
        public string? Status { get; set; }
        public string? RecurrencePattern { get; set; }
    }

    // Respond to an invite
    public class MeetingRsvpDto
    {
        /// <summary>Accepted | Declined | Maybe</summary>
        public string Response { get; set; } = "Accepted";
    }

    // Create / update an action item
    public class CreateActionItemDto
    {
        public string Description { get; set; } = string.Empty;
        public int? AssignedToUserId { get; set; }
        public DateTime? DueDate { get; set; }
    }

    public class UpdateActionItemDto
    {
        public string? Description { get; set; }
        public int? AssignedToUserId { get; set; }
        public string? Status { get; set; }
        public DateTime? DueDate { get; set; }
    }

    // ─── Performance Review (Feature 7) ──────────────────────────────────────

    // ── Review Cycle DTOs ────────────────────────────────────────────────────

    public class CreateReviewCycleDto
    {
        public string Title { get; set; } = string.Empty;
        public string? Description { get; set; }
        public string CycleType { get; set; } = "Quarterly";
        public DateTime StartDate { get; set; }
        public DateTime EndDate { get; set; }
        public DateTime? SelfAssessmentDueDate { get; set; }
        /// <summary>UserIds of employees to include in this cycle</summary>
        public List<int> RevieweeIds { get; set; } = new();
    }

    public class ReviewCycleDto
    {
        public int Id { get; set; }
        public string Title { get; set; } = string.Empty;
        public string? Description { get; set; }
        public string CycleType { get; set; } = string.Empty;
        public DateTime StartDate { get; set; }
        public DateTime EndDate { get; set; }
        public DateTime? SelfAssessmentDueDate { get; set; }
        public string Status { get; set; } = string.Empty;
        public string CreatedByName { get; set; } = string.Empty;
        public DateTime CreatedAt { get; set; }
        // Summary counts
        public int TotalReviews { get; set; }
        public int PendingCount { get; set; }
        public int SelfSubmittedCount { get; set; }
        public int CompletedCount { get; set; }
        // My review inside this cycle (null if current user is the manager/creator)
        public PerformanceReviewSummaryDto? MyReview { get; set; }
    }

    // ── Performance Review DTOs ──────────────────────────────────────────────

    public class ReviewRatingDto
    {
        public int Id { get; set; }
        public string Competency { get; set; } = string.Empty;
        public int Score { get; set; }
        public string? Comment { get; set; }
    }

    /// <summary>Compact summary used inside ReviewCycleDto</summary>
    public class PerformanceReviewSummaryDto
    {
        public int Id { get; set; }
        public string RevieweeName { get; set; } = string.Empty;
        public string? ProfilePhotoUrl { get; set; }
        public string ReviewerName { get; set; } = string.Empty;
        public string Status { get; set; } = string.Empty;
        public int? SelfRating { get; set; }
        public int? OverallRating { get; set; }
    }

    /// <summary>Full review detail</summary>
    public class PerformanceReviewDto
    {
        public int Id { get; set; }
        public int ReviewCycleId { get; set; }
        public string CycleTitle { get; set; } = string.Empty;
        public string CycleType { get; set; } = string.Empty;
        public DateTime CycleStart { get; set; }
        public DateTime CycleEnd { get; set; }

        // Participants
        public int RevieweeId { get; set; }
        public string RevieweeName { get; set; } = string.Empty;
        public string? RevieweePhoto { get; set; }
        public string RevieweeRole { get; set; } = string.Empty;
        public int ReviewerId { get; set; }
        public string ReviewerName { get; set; } = string.Empty;

        // Self-assessment
        public string? SelfAssessmentText { get; set; }
        public int? SelfRating { get; set; }
        public string? Achievements { get; set; }
        public string? Improvements { get; set; }
        public string? Goals { get; set; }
        public DateTime? SelfSubmittedAt { get; set; }

        // Manager review
        public string? ManagerFeedback { get; set; }
        public int? OverallRating { get; set; }
        public string? StrengthsNote { get; set; }
        public string? DevelopmentNote { get; set; }
        public DateTime? ManagerSubmittedAt { get; set; }

        // Competency ratings
        public List<ReviewRatingDto> Ratings { get; set; } = new();

        public string Status { get; set; } = string.Empty;
        public DateTime CreatedAt { get; set; }
        public DateTime UpdatedAt { get; set; }
    }

    // ── Write DTOs ───────────────────────────────────────────────────────────

    public class SubmitSelfAssessmentDto
    {
        public string SelfAssessmentText { get; set; } = string.Empty;
        public int SelfRating { get; set; }   // 1–5
        public string? Achievements { get; set; }
        public string? Improvements { get; set; }
        public string? Goals { get; set; }
    }

    public class SubmitManagerReviewDto
    {
        public string ManagerFeedback { get; set; } = string.Empty;
        public int OverallRating { get; set; }  // 1–5
        public string? StrengthsNote { get; set; }
        public string? DevelopmentNote { get; set; }
        /// <summary>One entry per competency (6 fixed competencies)</summary>
        public List<RatingInputDto> Ratings { get; set; } = new();
    }

    public class RatingInputDto
    {
        public string Competency { get; set; } = string.Empty;
        public int Score { get; set; }  // 1–5
        public string? Comment { get; set; }
    }

    // ─── Feature 8: Overtime Tracker ─────────────────────────────────────────

    /// <summary>Overtime data for a single working day</summary>
    public class OvertimeDayDto
    {
        public DateTime Date { get; set; }
        public string DateLabel { get; set; } = string.Empty;  // "Mon, Jan 15"
        public string DayStatus { get; set; } = string.Empty;  // Present | WFH | HalfDay
        public int WorkMinutes { get; set; }   // actual minutes from DailyLog
        public int StandardMinutes { get; set; }   // target (DailyGoal or 480)
        public int OvertimeMinutes { get; set; }   // MAX(0, WorkMinutes - StandardMinutes)
        public string WorkHours { get; set; } = string.Empty;  // "9h 30m"
        public string OvertimeHours { get; set; } = string.Empty;  // "1h 30m"
        public bool HasOvertime { get; set; }
    }

    /// <summary>Weekly rollup within a month</summary>
    public class OvertimeWeekDto
    {
        public int WeekNumber { get; set; }
        public string WeekLabel { get; set; } = string.Empty;  // "Week 1 (Jan 1–7)"
        public int TotalOvertimeMinutes { get; set; }
        public string TotalOvertimeHours { get; set; } = string.Empty;
        public int DaysWithOvertime { get; set; }
    }

    /// <summary>Full monthly overtime summary for one employee</summary>
    public class OvertimeSummaryDto
    {
        public int UserId { get; set; }
        public string FullName { get; set; } = string.Empty;
        public string Role { get; set; } = string.Empty;

        public int Month { get; set; }
        public int Year { get; set; }

        public int TotalOvertimeMinutes { get; set; }
        public string TotalOvertimeHours { get; set; } = string.Empty;
        public int DaysWithOvertime { get; set; }
        public int TotalWorkingDays { get; set; }
        public int AvgOvertimePerDayMinutes { get; set; }
        public string AvgOvertimePerDayHours { get; set; } = string.Empty;

        public DateTime? PeakOvertimeDate { get; set; }
        public int PeakOvertimeMinutes { get; set; }
        public string PeakOvertimeHours { get; set; } = string.Empty;

        public int StandardMinutesPerDay { get; set; } = 480;

        public List<OvertimeDayDto> Days { get; set; } = new();
        public List<OvertimeWeekDto> Weeks { get; set; } = new();
    }

    /// <summary>Manager view — overtime for every team member in a month</summary>
    public class TeamOvertimeDto
    {
        public int Month { get; set; }
        public int Year { get; set; }
        public string MonthLabel { get; set; } = string.Empty;

        public int TeamTotalOvertimeMinutes { get; set; }
        public string TeamTotalOvertimeHours { get; set; } = string.Empty;
        public int TeamMembersWithOvertime { get; set; }

        public List<OvertimeSummaryDto> Members { get; set; } = new();
    }

    // ─── Payroll Summary ──────────────────────────────────────────────────────

    // ── Salary configuration DTOs ────────────────────────────────────────────

    public class SetSalaryDto
    {
        public decimal MonthlySalary { get; set; }
        public string Currency { get; set; } = "INR";
        public decimal OvertimeMultiplier { get; set; } = 1.5m;
    }

    public class EmployeeSalaryDto
    {
        public int UserId { get; set; }
        public string FullName { get; set; } = string.Empty;
        public string Role { get; set; } = string.Empty;
        public decimal MonthlySalary { get; set; }
        public string Currency { get; set; } = string.Empty;
        public decimal OvertimeMultiplier { get; set; }
        public DateTime EffectiveFrom { get; set; }
        public string SetByName { get; set; } = string.Empty;
        public DateTime UpdatedAt { get; set; }
    }

    // ── Payslip line items ───────────────────────────────────────────────────

    public class PayslipEarningDto
    {
        public string Label { get; set; } = string.Empty;  // "Basic Pay", "Overtime"
        public decimal Amount { get; set; }
        public string Note { get; set; } = string.Empty;  // "22 days × ₹1,136"
    }

    public class PayslipDeductionDto
    {
        public string Label { get; set; } = string.Empty;  // "Unpaid Leave", "Absent"
        public decimal Amount { get; set; }
        public string Note { get; set; } = string.Empty;
    }

    // ── Full payslip ─────────────────────────────────────────────────────────

    public class PayslipDto
    {
        // Who
        public int UserId { get; set; }
        public string FullName { get; set; } = string.Empty;
        public string Role { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;

        // Period
        public int Month { get; set; }
        public int Year { get; set; }
        public string MonthLabel { get; set; } = string.Empty;  // "March 2025"

        // Salary config used
        public decimal MonthlySalary { get; set; }
        public string Currency { get; set; } = string.Empty;
        public decimal OvertimeMultiplier { get; set; }
        public bool SalaryConfigured { get; set; }  // false if no salary set yet

        // Working days
        public int WorkingDaysInMonth { get; set; }
        public decimal PerDayRate { get; set; }
        public decimal HourlyRate { get; set; }

        // Attendance
        public int DaysPresent { get; set; }  // Present + WFH
        public int DaysHalfDay { get; set; }  // counts as 0.5
        public int DaysPaidLeave { get; set; }  // Casual, Sick, Earned, CompOff
        public int DaysUnpaidLeave { get; set; }  // Unpaid leave type
        public int DaysAbsent { get; set; }  // no log, no leave

        // Overtime
        public int OvertimeMinutes { get; set; }
        public string OvertimeHours { get; set; } = string.Empty;  // "6h 30m"

        // Earnings
        public decimal BasicEarnings { get; set; }
        public decimal OvertimePay { get; set; }
        public decimal GrossEarnings { get; set; }

        // Deductions
        public decimal UnpaidLeaveDeduction { get; set; }
        public decimal AbsentDeduction { get; set; }
        public decimal TotalDeductions { get; set; }

        // Net
        public decimal NetPay { get; set; }
        public int DaysWeekend { get; set; }  // came in on Saturday/Sunday
        public int DaysHoliday { get; set; }  // came in on a public holiday

        // Line item breakdown (for payslip display)
        public List<PayslipEarningDto> Earnings { get; set; } = new();
        public List<PayslipDeductionDto> Deductions { get; set; } = new();
    }

    // ── Team payroll overview ────────────────────────────────────────────────

    public class TeamPayrollDto
    {
        public int Month { get; set; }
        public int Year { get; set; }
        public string MonthLabel { get; set; } = string.Empty;
        public decimal TeamTotalGross { get; set; }
        public decimal TeamTotalNet { get; set; }
        public decimal TeamTotalDeductions { get; set; }
        public decimal TeamTotalOvertimePay { get; set; }
        public int MembersConfigured { get; set; }  // have salary set
        public int MembersNotConfigured { get; set; }  // no salary yet
        public List<PayslipDto> Members { get; set; } = new();
    }

    // ─── Document Management ──────────────────────────────────────────────────

    // ── Input DTOs ───────────────────────────────────────────────────────────

    /// <summary>
    /// Received as multipart/form-data because a file is attached.
    /// The controller reads these fields with [FromForm].
    /// </summary>
    public class UploadDocumentDto
    {
        [Required, MaxLength(200)]
        public string Title { get; set; } = string.Empty;

        [MaxLength(1000)]
        public string? Description { get; set; }

        /// <summary>OfferLetter | Contract | Payslip | IDProof | Certificate | Policy | Appraisal | Warning | Other</summary>
        public string Category { get; set; } = "Other";

        /// <summary>
        /// Which employee this document belongs to.
        /// - Employee uploading their own doc: leave as 0 → backend fills their own userId.
        /// - Manager uploading for an employee: pass the employee's userId.
        /// </summary>
        public int OwnerUserId { get; set; } = 0;

        public bool IsPublic { get; set; } = false;
        public DateTime? ExpiresAt { get; set; }
    }

    public class UpdateDocumentDto
    {
        public string? Title { get; set; }
        public string? Description { get; set; }
        public string? Category { get; set; }
        public bool? IsPublic { get; set; }
        public DateTime? ExpiresAt { get; set; }
    }

    // ── Response DTOs ────────────────────────────────────────────────────────

    public class DocumentDto
    {
        public int Id { get; set; }
        public string Title { get; set; } = string.Empty;
        public string? Description { get; set; }
        public string Category { get; set; } = string.Empty;
        public string FileName { get; set; } = string.Empty;
        public string MimeType { get; set; } = string.Empty;
        public long FileSizeBytes { get; set; }
        public string FileSizeLabel { get; set; } = string.Empty;  // "2.4 MB"
        public bool IsPublic { get; set; }
        public DateTime UploadedAt { get; set; }
        public DateTime? ExpiresAt { get; set; }
        public bool IsExpired { get; set; }
        public bool ExpiresWithin30Days { get; set; }

        // Owner info
        public int OwnerUserId { get; set; }
        public string OwnerName { get; set; } = string.Empty;

        // Uploader info
        public int UploadedByUserId { get; set; }
        public string UploadedByName { get; set; } = string.Empty;

        // Download URL
        public string DownloadUrl { get; set; } = string.Empty; // /api/documents/{id}/download
    }

    public class DocumentSummaryDto
    {
        public int TotalDocuments { get; set; }
        public int MyDocuments { get; set; }
        public int PublicDocuments { get; set; }
        public int ExpiringDocuments { get; set; }  // expiring within 30 days
        public int ExpiredDocuments { get; set; }

        // Counts by category
        public Dictionary<string, int> ByCategory { get; set; } = new();
    }

    // ─── Training Input DTOs ──────────────────────────────────────────────────

    public class CreateTrainingDto
    {
        [Required, MaxLength(200)]
        public string Title { get; set; } = string.Empty;

        [MaxLength(150)]
        public string? Provider { get; set; }

        /// <summary>Online | Internal | External | Conference | Workshop | Certification</summary>
        public string TrainingType { get; set; } = "Online";

        [MaxLength(1000)]
        public string? Description { get; set; }

        [Required]
        public DateTime StartDate { get; set; }
        public DateTime? EndDate { get; set; }

        public decimal DurationHours { get; set; } = 0;

        /// <summary>Planned | InProgress | Completed | Cancelled</summary>
        public string Status { get; set; } = "Planned";

        [MaxLength(1000)]
        public string? Notes { get; set; }

        [MaxLength(500)]
        public string? CourseUrl { get; set; }
    }

    public class UpdateTrainingDto
    {
        public string? Title { get; set; }
        public string? Provider { get; set; }
        public string? TrainingType { get; set; }
        public string? Description { get; set; }
        public DateTime? StartDate { get; set; }
        public DateTime? EndDate { get; set; }
        public decimal? DurationHours { get; set; }
        public string? Status { get; set; }
        public string? Notes { get; set; }
        public string? CourseUrl { get; set; }
    }

    // ─── Training Response DTOs ───────────────────────────────────────────────

    public class TrainingDto
    {
        public int Id { get; set; }
        public int UserId { get; set; }
        public string UserName { get; set; } = string.Empty;
        public string Title { get; set; } = string.Empty;
        public string? Provider { get; set; }
        public string TrainingType { get; set; } = string.Empty;
        public string? Description { get; set; }
        public DateTime StartDate { get; set; }
        public DateTime? EndDate { get; set; }
        public decimal DurationHours { get; set; }
        public string Status { get; set; } = string.Empty;
        public string? Notes { get; set; }
        public string? CourseUrl { get; set; }
        public DateTime CreatedAt { get; set; }
    }

    // ─── Certification Input DTOs ─────────────────────────────────────────────
    // Received as multipart/form-data (file is optional)

    public class CreateCertificationDto
    {
        [Required, MaxLength(200)]
        public string Name { get; set; } = string.Empty;

        [Required, MaxLength(150)]
        public string IssuingOrganization { get; set; } = string.Empty;

        [Required]
        public DateTime IssueDate { get; set; }

        public DateTime? ExpiryDate { get; set; }

        [MaxLength(100)]
        public string? CredentialId { get; set; }

        [MaxLength(500)]
        public string? CredentialUrl { get; set; }
    }

    public class UpdateCertificationDto
    {
        public string? Name { get; set; }
        public string? IssuingOrganization { get; set; }
        public DateTime? IssueDate { get; set; }
        public DateTime? ExpiryDate { get; set; }
        public string? CredentialId { get; set; }
        public string? CredentialUrl { get; set; }
        public string? Status { get; set; }
    }

    // ─── Certification Response DTOs ──────────────────────────────────────────

    public class CertificationDto
    {
        public int Id { get; set; }
        public int UserId { get; set; }
        public string UserName { get; set; } = string.Empty;
        public string Name { get; set; } = string.Empty;
        public string IssuingOrganization { get; set; } = string.Empty;
        public DateTime IssueDate { get; set; }
        public DateTime? ExpiryDate { get; set; }
        public string? CredentialId { get; set; }
        public string? CredentialUrl { get; set; }
        public string Status { get; set; } = string.Empty;

        // File info
        public bool HasFile { get; set; }
        public string? FileName { get; set; }
        public string? FileSizeLabel { get; set; }
        public string? DownloadUrl { get; set; }  // /api/training/certifications/{id}/download

        // Computed
        public bool IsExpired { get; set; }
        public bool ExpiresWithin30Days { get; set; }
        public int? DaysUntilExpiry { get; set; }  // null if no expiry
        public DateTime CreatedAt { get; set; }
    }

    // ─── Summary / Stats DTOs ─────────────────────────────────────────────────

    public class TrainingStatsDto
    {
        // Training stats
        public int TotalTrainings { get; set; }
        public int CompletedTrainings { get; set; }
        public int PlannedTrainings { get; set; }
        public int InProgressTrainings { get; set; }
        public decimal TotalHours { get; set; }

        // Certification stats
        public int TotalCertifications { get; set; }
        public int ActiveCertifications { get; set; }
        public int ExpiredCertifications { get; set; }
        public int ExpiringWithin30Days { get; set; }

        // Breakdown by training type
        public Dictionary<string, int> ByTrainingType { get; set; } = new();
    }

    public class TeamTrainingStatsDto
    {
        public int TotalMembers { get; set; }
        public int TotalTrainings { get; set; }
        public int TotalCertifications { get; set; }
        public int ExpiringCerts { get; set; }
        public decimal TotalHours { get; set; }

        public List<MemberTrainingSummaryDto> Members { get; set; } = new();
    }

    public class MemberTrainingSummaryDto
    {
        public int UserId { get; set; }
        public string FullName { get; set; } = string.Empty;
        public string Role { get; set; } = string.Empty;
        public int TrainingCount { get; set; }
        public int CompletedCount { get; set; }
        public decimal HoursCompleted { get; set; }
        public int CertificationCount { get; set; }
        public int ExpiringCertCount { get; set; }
    }

    // Swagger-safe wrapper — avoids duplicate "Name" key collision between
    // CreateCertificationDto.Name and IFormFile.Name when flattening form params
    public class CreateCertFormRequest
    {
        [Required] public string Name { get; set; } = string.Empty;
        [Required] public string IssuingOrganization { get; set; } = string.Empty;
        [Required] public DateTime IssueDate { get; set; }
        public DateTime? ExpiryDate { get; set; }
        public string? CredentialId { get; set; }
        public string? CredentialUrl { get; set; }
        public IFormFile? File { get; set; }  // named "File" not "Name"
    }

    // ═══════════════════════════════════════════════════════════════════════════
    //  Resignation & Exit Management DTOs
    // ═══════════════════════════════════════════════════════════════════════════

    // ─── Input ────────────────────────────────────────────────────────────────

    public class SubmitResignationDto
    {
        [Required, MaxLength(1000)]
        public string Reason { get; set; } = string.Empty;

        [Required]
        public DateTime RequestedLastDay { get; set; }
    }

    public class ReviewResignationDto
    {
        /// <summary>Accepted | Rejected</summary>
        [Required]
        public string Decision { get; set; } = string.Empty;

        [MaxLength(1000)]
        public string? ReviewNote { get; set; }

        /// <summary>Official last day (required when Decision = Accepted)</summary>
        public DateTime? NoticePeriodEndDate { get; set; }
    }

    public class CompleteExitDto
    {
        public DateTime ExitDate { get; set; }

        [MaxLength(1000)]
        public string? FinalNote { get; set; }
    }

    // ─── Checklist input ──────────────────────────────────────────────────────

    public class AddChecklistItemDto
    {
        [Required, MaxLength(200)]
        public string Task { get; set; } = string.Empty;
    }

    // ─── Response ─────────────────────────────────────────────────────────────

    public class ExitChecklistItemDto
    {
        public int Id { get; set; }
        public string Task { get; set; } = string.Empty;
        public bool IsCompleted { get; set; }
        public DateTime? CompletedAt { get; set; }
        public string? CompletedByName { get; set; }
    }

    public class ResignationDto
    {
        public int Id { get; set; }
        public int UserId { get; set; }
        public string EmployeeName { get; set; } = string.Empty;
        public string? Department { get; set; }
        public string? Designation { get; set; }
        public string Reason { get; set; } = string.Empty;
        public DateTime RequestedLastDay { get; set; }
        public string Status { get; set; } = string.Empty;
        public string? ReviewNote { get; set; }
        public string? ReviewedByName { get; set; }
        public DateTime? ReviewedAt { get; set; }
        public DateTime? NoticePeriodEndDate { get; set; }
        public DateTime? ExitDate { get; set; }
        public DateTime SubmittedAt { get; set; }

        // Computed helpers for UI
        public int? NoticeDaysRemaining { get; set; }  // null if not accepted yet
        public bool IsMyResignation { get; set; }  // true if current user owns it

        public List<ExitChecklistItemDto> ChecklistItems { get; set; } = new();
    }

    public class ResignationSummaryDto
    {
        public int PendingCount { get; set; }
        public int AcceptedCount { get; set; }
        public int CompletedCount { get; set; }
        public int RejectedCount { get; set; }
        public List<ResignationDto> Active { get; set; } = new(); // Pending + Accepted
    }

    public class WeekendHolidayAttendanceDto
    {
        public int UserId { get; set; }
        public string FullName { get; set; } = string.Empty;
        public string Role { get; set; } = string.Empty;
        public DateTime Date { get; set; }
        public string DayStatus { get; set; } = string.Empty;  // "Weekend" | "Holiday"
        public string DayOfWeek { get; set; } = string.Empty;  // "Saturday" | "Sunday" | "Monday"...
        public string? HolidayName { get; set; }                  // name of the holiday if applicable
        public DateTime? CheckInTime { get; set; }
        public DateTime? CheckOutTime { get; set; }
        public int WorkMinutes { get; set; }
        public string WorkHours { get; set; } = string.Empty;
    }

    // ── Face Registration ─────────────────────────────────────────────────────

    /// <summary>Employee or manager submits 128-float descriptor from face-api.js</summary>
    public class RegisterFaceDto
    {
        /// <summary>JSON array of 128 floats e.g. "[0.12, -0.45, ...]"</summary>
        public string Descriptor { get; set; } = string.Empty;

        /// <summary>Optional: manager registering on behalf of an employee</summary>
        public int? TargetUserId { get; set; }
    }

    /// <summary>Log a face attempt result from the frontend after comparison</summary>
    public class FaceAttemptDto
    {
        public string Action { get; set; } = "CheckIn"; // "CheckIn" | "CheckOut"
        public bool Success { get; set; }
        public float Distance { get; set; }
        public string Result { get; set; } = string.Empty;
        // "NoFaceDetected" | "Mismatch" | "NotRegistered" | "Matched"
    }

    /// <summary>Returned to the client when they request a descriptor for verification</summary>
    public class FaceDescriptorResponseDto
    {
        public int UserId { get; set; }
        public string FullName { get; set; } = string.Empty;
        public bool FaceRegistered { get; set; }
        public string? Descriptor { get; set; } // null if not yet registered
    }

    /// <summary>One failed/passed face attempt shown to manager</summary>
    public class FaceAttemptLogDto
    {
        public int Id { get; set; }
        public int UserId { get; set; }
        public string FullName { get; set; } = string.Empty;
        public string Action { get; set; } = string.Empty;
        public bool Success { get; set; }
        public float Distance { get; set; }
        public string Result { get; set; } = string.Empty;
        public DateTime AttemptedAt { get; set; }
    }

    // ─── Location Tracking (Away-From-Office) ──────────────────────────────────
    public class GrantConsentDto
    {
        [Required, MaxLength(20)]
        public string PolicyVersion { get; set; } = string.Empty;
    }

    public class ConsentStatusDto
    {
        public bool HasActiveConsent { get; set; }
        public DateTime? ConsentedAt { get; set; }
        public string? PolicyVersion { get; set; }
    }
    // ─── Geofence Events ────────────────────────────────────────────────────────
    public class GeofenceEventDto
    {
        [Required, MaxLength(64)]
        public string ClientEventId { get; set; } = string.Empty;

        [Required, MaxLength(10)]
        public string EventType { get; set; } = string.Empty; // "Enter" | "Exit"

        public double Latitude { get; set; }
        public double Longitude { get; set; }
        public DateTime OccurredAt { get; set; }
    }

    public class GeofenceEventBatchDto
    {
        public List<GeofenceEventDto> Events { get; set; } = new();
    }

    public class GeofenceEventBatchResultDto
    {
        public int Processed { get; set; }
        public int Skipped { get; set; }
        public int Rejected { get; set; }
    }
}
