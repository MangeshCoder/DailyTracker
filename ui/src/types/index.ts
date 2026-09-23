// ─── Core Types (original) ────────────────────────────────────────────────────
export interface User { id: number; fullName: string; email: string; role: string; isActive: boolean;department?:      string;
  designation?:     string;
  profilePhotoUrl?: string;
  phone?:           string;
  bio?:             string;
  joinDate?:        string;}
export interface AuthResponse { accessToken: string; refreshToken: string; accessTokenExpiry: string; user: User; }
export interface LoginDto { email: string; password: string; }

// ─── Two-Factor Authentication ────────────────────────────────────────────────
export interface LoginResponseDto {
  requiresTwoFactor: boolean;
  tempToken?: string;
  message?: string;
  tokens?: AuthResponse;
}
export interface ManagerUserDto {
  id: number;
  fullName: string;
  email: string;
  role: string;
  isActive: boolean;
}
export interface Setup2FAResponse { manualEntryKey: string; qrCodeBase64: string; message: string; }
export interface RegisterDto { fullName: string; email: string; password: string; role: string; }
export interface BreakLog { id: number; breakType: string; startTime: string; endTime?: string; durationMinutes: number; isActive: boolean; }
export interface TaskLog { id: number; taskTitle: string; description?: string; projectName?: string; status: 'InProgress'|'Completed'|'Blocked'|'OnHold'; timeSpentMinutes: number; priority: 'Low'|'Medium'|'High'; tags?: string; completedAt?: string; createdAt: string; }
export interface CreateTaskDto { taskTitle: string; description?: string; projectName?: string; status: string; timeSpentMinutes: number; priority: string; tags?: string; }
export interface MediaEvidence { id: number; mediaType: string; fileName: string; url: string; fileSizeBytes: number; mimeType: string; }
export interface SupportLog {
  id: number;
  supportEngineerName: string;       // ← NEW (Feature 2)
  supportedDeveloperName: string;
  issueDescription: string;
  resolution?: string;
  timeSpentMinutes: number;
  supportType: string;
  supportedAt: string;
  media?: MediaEvidence[];
  distanceFromOfficeMetres?: number;
  wasAssigned?: boolean;             // ← NEW (Feature 3)
}
export interface CreateSupportDto {
  supportEngineerId: number;         // ← NEW (Feature 2)
  supportedDeveloperId: number;
  issueDescription: string;
  resolution?: string;
  timeSpentMinutes: number;
  supportType: string;
  supportAssignmentId?: number;      // ← NEW (Feature 3)
}

export interface SupportAssignment {
  id: number;
  supportEngineerId: number;
  supportEngineerName: string;
  developerId: number;
  developerName: string;
  assignedByManager: string;
  isActive: boolean;
  notes?: string;
  assignedAt: string;
}
 
// ── 4. ADD MyAssignment interface ─────────────────────────────────────────────
 
export interface MyAssignment {
  hasAssignment: boolean;
  assignmentId?: number;
  supportEngineerId?: number;
  supportEngineerName?: string;
  notes?: string;
  assignedAt?: string;
}

export interface DailyLog { id: number; logDate: string; checkInTime?: string; checkOutTime?: string; totalWorkMinutes: number; totalBreakMinutes: number; dayStatus: string; notes?: string; workHours: string; breaks: BreakLog[]; tasks: TaskLog[]; supportLogs: SupportLog[]; }
export interface DashboardSummary { todayLog?: DailyLog; tasksCompleted: number; tasksInProgress: number; totalSupportGiven: number; netWorkMinutes: number; netWorkHours: string; isCheckedIn: boolean; hasActiveBreak: boolean; activeBreak?: BreakLog; }

// ─── Feature 11: Security ─────────────────────────────────────────────────────
export interface RefreshTokenRequest { refreshToken: string; }

// ─── Feature 4: Goals ─────────────────────────────────────────────────────────
export interface SetGoalDto { targetWorkMinutes: number; targetTasksCompleted: number; targetSupportGiven: number; targetBreakMinutes: number; managerSetNote?: string; }
export interface GoalProgress {
  goal: SetGoalDto;
  actualWorkMinutes: number; actualTasksCompleted: number; actualBreakMinutes: number; actualSupportGiven: number;
  workProgress: number; taskProgress: number; breakProgress: number; supportProgress: number;
  productivityScore: number; scoreGrade: string; insights: string[];
}
export interface GoalHistoryEntry {
  date: string;
  dayName: string;       // "Mon"
  dateLabel: string;     // "Jan 15"

  // Targets
  targetWorkMinutes: number;
  targetTasksCompleted: number;
  targetSupportGiven: number;
  targetBreakMinutes: number;

  // Actuals
  actualWorkMinutes: number;
  actualTasksCompleted: number;
  actualSupportGiven: number;
  actualBreakMinutes: number;

  // Progress 0–100
  workProgress: number;
  taskProgress: number;
  supportProgress: number;
  breakProgress: number;

  // Score
  productivityScore: number;
  scoreGrade: string;    // "A" | "B" | "C" | "D"
  goalWasSet: boolean;   // false = worked but no goal configured that day
}

// ─── Feature 6: EOD Report ────────────────────────────────────────────────────
export interface CreateEODReportDto { whatWasDone: string; blockers?: string; planForTomorrow?: string; learnings?: string; moodRating: string; }
export interface EODReport { id: number; userName: string; reportDate: string; whatWasDone: string; blockers?: string; planForTomorrow?: string; learnings?: string; moodRating: string; submittedAt: string; isReviewedByManager: boolean; managerComment?: string; }

// ─── Feature 3: Task Templates ────────────────────────────────────────────────
export interface CreateTemplateDto { title: string; description?: string; projectName?: string; defaultTimeMinutes: number; priority: string; tags?: string; isRecurring: boolean; recurrenceDays?: string; }
export interface TaskTemplate extends CreateTemplateDto { id: number; createdAt: string; }

// ─── Feature 3: Task Timer ────────────────────────────────────────────────────
export interface TaskTimer { id: number; taskLogId: number; startedAt: string; stoppedAt?: string; durationMinutes: number; isRunning: boolean; totalSessionMinutes: number; }

// ─── Feature 9: Team Features ─────────────────────────────────────────────────
export interface UpdatePresenceDto { isAvailableForHelp: boolean; status: string; statusMessage?: string; }
export interface UserPresence { user: User; isAvailableForHelp: boolean; status: string; statusMessage?: string; updatedAt: string; isCheckedInToday: boolean; checkInTime?: string; }
export interface GiveKudosDto { toUserId: number; message: string; badgeType: string; }
export interface Kudos { id: number; fromUserName: string; toUserName: string; message: string; badgeType: string; givenAt: string; }
export interface KudosSummary { user: User; totalReceived: number; totalGiven: number; badgeCounts: Record<string, number>; recentKudos: Kudos[]; }
export interface KudosLeaderboardEntry {
  rank:          number;
  userId:        number;
  userName:      string;
  totalReceived: number;
  totalGiven:    number;
  badgeCounts:   Record<string, number>;
  topBadge:      string;
  // NOTE: no 'role' — backend DTO does not include it
}

export interface KudosLeaderboard {
  year:        number;
  month:       number | null;
  periodLabel: string;        // e.g. "March 2025" or "Full Year 2025"
  entries:     KudosLeaderboardEntry[];
  // NOTE: property is 'entries', not 'rankings'
}

// ─── Feature 9: Leave ─────────────────────────────────────────────────────────
export interface ApplyLeaveDto { fromDate: string; toDate: string; leaveType: string; reason: string; }
export interface LeaveRequest { id: number; userName: string; fromDate: string; toDate: string; leaveDays: number; leaveType: string; reason: string; status: string; reviewerName?: string; reviewNote?: string; reviewedAt?: string; appliedAt: string; }
export interface ReviewLeaveDto { status: string; reviewNote?: string; }
export interface LeaveTypeBalanceItem {leaveType: string;entitlement: number; used: number;pending: number;remaining: number;isUnlimited: boolean;}
export interface LeaveBalanceDto {userId: number;userName: string;year: number;balances: LeaveTypeBalanceItem[];}

// ─── Feature 10: Attendance ───────────────────────────────────────────────────
export interface Holiday { id: number; date: string; name: string; type: string; year: number; isToday: boolean; }
export interface CreateHolidayDto { date: string; name: string; type: string; }

// ─── Feature 1: Notifications ─────────────────────────────────────────────────
export interface AppNotification { id: number; title: string; message: string; type: string; actionUrl?: string; isRead: boolean; createdAt: string; }

// ─── Feature 5: Analytics ─────────────────────────────────────────────────────
export interface HeatmapData { date: string; workMinutes: number; tasksCompleted: number; level: number; }
export interface ProjectTime { projectName: string; totalMinutes: number; taskCount: number; percentage: number; }
export interface ProductivityTrend { date: string; score: number; workMinutes: number; tasksCompleted: number; dayName: string; }
export interface PeakHour { hour: number; hourLabel: string; tasksCompleted: number; }
export interface AdvancedAnalytics { heatmap: HeatmapData[]; projectBreakdown: ProjectTime[]; productivityTrend: ProductivityTrend[]; peakHours: PeakHour[]; overallProductivityScore: number; mostProductiveDay: string; mostWorkedProject: string; totalTasksCompleted: number; totalWorkMinutes: number; totalSupportGiven: number; }

// ─── Audit ────────────────────────────────────────────────────────────────────
export interface AuditLog { id: number; userName: string; action: string; entity: string; entityId?: number; oldValues?: string; newValues?: string; ipAddress?: string; createdAt: string; }

// ─── Manager types (from previous version) ────────────────────────────────────
export interface UserDailyActivity { user: User; dayStatus: string; checkInTime?: string; checkOutTime?: string; workHours: string; totalBreakMinutes: number; tasksTotal: number; tasksCompleted: number; tasksInProgress: number; supportGiven: number; isOnBreak: boolean; activeBreakType?: string; tasks: TaskLog[]; supportLogs: SupportLog[]; }
export interface ManagerTeamDaily { date: string; totalMembers: number; checkedIn: number; notCheckedIn: number; members: UserDailyActivity[]; }
export interface UserAttendanceSummary { user: User; month: number; year: number; workingDaysInMonth: number; daysPresent: number; daysWFH: number; daysHalfDay: number; daysAbsent: number; attendancePercentage: number; totalWorkMinutes: number; totalWorkHours: string; averageDailyHours: number; totalTasksCompleted: number; totalSupportGiven: number;daysWeekend: number; daysHoliday: number;  }
export interface AttendanceDay { date: string; status: string; checkIn?: string; checkOut?: string; workHours: string; tasksCompleted: number; }
export interface TeamMonthlyStats { month: number; year: number; members: UserAttendanceSummary[]; teamAverageAttendance: number; teamTotalTasksCompleted: number; teamTotalSupportLogs: number; }
export interface UserFullReport { user: User; fromDate: string; toDate: string; totalWorkingDays: number; daysPresent: number; attendancePercentage: number; totalWorkMinutes: number; totalWorkHours: string; averageDailyHours: number; totalTasksCompleted: number; totalTasksLogged: number; totalSupportGiven: number; dailyEntries: DailyReportEntry[]; }
export interface DailyReportEntry { date: string; dayStatus: string; checkIn: string; checkOut: string; workHours: string; breakMinutes: number; tasksSummary: string[]; supportSummary: string[]; notes?: string; }

export interface WeeklyReport { days: DailyLog[]; totalWorkMinutes: number; totalTasksCompleted: number; totalSupportGiven: number; averageDailyHours: number; }

// Manager Types
export interface UserDailyActivity { user: User; dayStatus: string; checkInTime?: string; checkOutTime?: string; workHours: string; totalBreakMinutes: number; tasksTotal: number; tasksCompleted: number; tasksInProgress: number; supportGiven: number; isOnBreak: boolean; activeBreakType?: string; tasks: TaskLog[]; supportLogs: SupportLog[]; }
export interface ManagerTeamDaily { date: string; totalMembers: number; checkedIn: number; notCheckedIn: number; members: UserDailyActivity[]; }
export interface UserAttendanceSummary { user: User; month: number; year: number; workingDaysInMonth: number; daysPresent: number; daysWFH: number; daysHalfDay: number; daysAbsent: number; attendancePercentage: number; totalWorkMinutes: number; totalWorkHours: string; averageDailyHours: number; totalTasksCompleted: number; totalSupportGiven: number; }
export interface AttendanceDay { date: string; status: string; checkIn?: string; checkOut?: string; workHours: string; tasksCompleted: number; }
export interface TeamMonthlyStats { month: number; year: number; members: UserAttendanceSummary[]; teamAverageAttendance: number; teamTotalTasksCompleted: number; teamTotalSupportLogs: number; }
export interface DailyReportEntry { date: string; dayStatus: string; checkIn: string; checkOut: string; workHours: string; breakMinutes: number; tasksSummary: string[]; supportSummary: string[]; notes?: string; }
export interface UserFullReport { user: User; fromDate: string; toDate: string; totalWorkingDays: number; daysPresent: number; attendancePercentage: number; totalWorkMinutes: number; totalWorkHours: string; averageDailyHours: number; totalTasksCompleted: number; totalTasksLogged: number; totalSupportGiven: number; dailyEntries: DailyReportEntry[]; }
export interface WFHRequest {
  id: number;
  userId: number;
  employeeName: string;
  requestType: 'WFH' | 'HalfDay';
  requestDate: string;
  requestDateLabel: string;
  halfDaySlot?: string;
  reason: string;
  status: 'Pending' | 'Approved' | 'Rejected' | 'Cancelled';
  reviewedByName?: string;
  reviewNote?: string;
  reviewedAt?: string;
  requestedAt: string;
}

export interface TeamMemberStatus {
  userId: number;
  fullName: string;
  email: string;
  role: string;
  effectiveStatus: string;
  checkInTime?: string;
  checkOutTime?: string;
  workMinutes: number;
  workHours: string;
  breakMinutes: number;
  isOnBreak: boolean;
  tasksCompleted: number;
  tasksTotal: number;
  hasApprovedWFH: boolean;
  hasApprovedHalfDay: boolean;
  halfDaySlot?: string;
  hasPendingRequest: boolean;
  pendingRequestType?: string;
  pendingRequestId?: number;
}

export interface TeamDailyStatus {
  date: string;
  dateLabel: string;
  totalMembers: number;
  presentCount: number;
  wfhCount: number;
  halfDayCount: number;
  notCheckedInCount: number;
  pendingRequestsCount: number;
  members: TeamMemberStatus[];
}

export interface TeamMonthlyAttendance {
  userId:              number;
  fullName:            string;
  role:                string;
  workingDaysInMonth:  number;
  daysPresent:         number;
  daysWFH:             number;
  daysHalfDay:         number;
  daysAbsent:          number;
  daysWeekend:         number;   // ← NEW
  daysHoliday:         number;   // ← NEW
  attendancePercentage: number;
  totalWorkHours:      string;
  averageDailyHours:   number;
  totalTasksCompleted: number;
  wfhDates:            string[];
  halfDayDates:        string[];
  weekendDates:        string[];  // ← NEW
  holidayDates:        string[];  // ← NEW
}

export interface EmailOtpRequest {
  email: string;
}

export interface VerifyOtpRequest {
  email: string;
  code: string;
}

export interface ConversationSummary {
  id: number;
  type: 'Direct' | 'Group';
  displayName: string;
  avatarUrl?: string;
  otherUserId?: number;
  lastMessagePreview?: string;
  lastMessageAt?: string;
  unreadCount: number;
  memberCount: number;
  isMuted: boolean;
}

export interface ConversationDetail {
  id: number;
  type: 'Direct' | 'Group';
  groupName?: string;
  groupAvatar?: string;
  createdAt: string;
  myRole: 'Member' | 'Admin';
  members: MemberInfo[];
}

export interface MemberInfo {
  userId: number;
  fullName: string;
  email: string;
  role: string;
  joinedAt: string;
}

export interface ChatMessage {
  id: number;
  conversationId: number;
  senderId: number;
  senderName: string;
  senderInitial: string;
  content: string;
  messageType: 'Text' | 'Image' | 'File' | 'System';
  attachmentUrl?: string;
  attachmentName?: string;
  isDeleted: boolean;
  isEdited: boolean;
  sentAt: string;
  editedAt?: string;
  replyTo?: ReplyPreview;
  reactions: Reaction[];
  readByUserIds: number[];
}

export interface ReplyPreview {
  id: number;
  senderName: string;
  contentPreview: string;
}

export interface Reaction {
  emoji: string;
  count: number;
  userIds: number[];
}

export interface UserChatProfile {
  id: number;
  fullName: string;
  email: string;
  role: string;
  onlineStatus: 'Online' | 'Offline' | 'Busy' | 'Away';
  statusMessage?: string;
}

export interface SendMessagePayload {
  conversationId: number;
  content: string;
  messageType?: string;
  attachmentUrl?: string;
  attachmentName?: string;
  replyToMessageId?: number;
}

//Announcement Types
export interface Announcement {
  id: number;
  title: string;
  content: string;
  category: 'General' | 'Policy' | 'Event' | 'Urgent';
  isPinned: boolean;
  expiresAt: string | null;
  createdAt: string;
  createdByName: string;
  isRead: boolean;
}

export interface AnnouncementsResponse {
  pinned: Announcement[];
  regular: Announcement[];
  unreadCount: number;
}

export interface CreateAnnouncementDto {
  title: string;
  content: string;
  category: string;
  isPinned: boolean;
  expiresAt: string | null;
}

export interface UserProfile {
  id:              number;
  fullName:        string;
  email:           string;
  role:            string;
  isActive:        boolean;
  department:      string | null;
  designation:     string | null;
  phone:           string | null;
  bio:             string | null;
  profilePhotoUrl: string | null;
  joinDate:        string | null;
  createdAt:       string;
  managerId:       number | null;
  managerName:     string | null;
}

export interface UpdateProfileDto {
  fullName?:    string;
  phone?:       string;
  bio?:         string;
  designation?: string;
  department?:  string;
  joinDate?:    string;  // ISO string
}

// export interface DirectoryUser {
//   id: number;
//   fullName: string;
//   email: string;
//   role: string;
//   department: string | null;
//   designation: string | null;
//   phone: string | null;
//   profilePhotoUrl: string | null;
//   isActive: boolean;
//   managerName: string | null;
// }

export interface UpdateEmployeeProfileDto {
  department?:  string;
  designation?: string;
  joinDate?:    string;  // ISO string
  managerId?:   number;
}
export type DirectoryUser = UserProfile;

export type MemberDayStatus =
  | 'Present' | 'WFH' | 'HalfDay' | 'Leave'
  | 'Absent'  | 'Weekend' | 'Holiday' | 'Unknown';

export interface CalendarMemberDay {
  userId:          number;
  fullName:        string;
  profilePhotoUrl: string | null;
  role:            string;
  status: string; 
  leaveType:       string | null;
}

export interface CalendarDay {
  date:        string;        // "yyyy-MM-dd"
  weekday:     string;        // "Mon", "Tue" …
  isWeekend:   boolean;
  isHoliday:   boolean;
  holidayName: string | null;
  isToday:     boolean;
  members:     CalendarMemberDay[];
}

export interface TeamCalendarResponse {
  month: number;
  year:  number;
  label: string;              // "June 2025"
  days:  CalendarDay[];
}

// ─── Meeting Log (Feature 6) ──────────────────────────────────────────────────

export type MeetingType   = 'StandUp' | 'Planning' | 'Review' | 'Retrospective' | 'OneOnOne' | 'Other';
export type MeetingStatus = 'Scheduled' | 'InProgress' | 'Completed' | 'Cancelled';
export type RsvpResponse  = 'Pending' | 'Accepted' | 'Declined' | 'Maybe';
export type ActionStatus  = 'Open' | 'InProgress' | 'Done';

export interface MeetingAttendeeDto {
  userId:          number;
  fullName:        string;
  profilePhotoUrl: string | null;
  role:            string;
  response:        RsvpResponse;
  attended:        boolean;
}

export interface MeetingActionItemDto {
  id:                  number;
  description:         string;
  assignedToUserId:    number | null;
  assignedToUserName:  string | null;
  status:              ActionStatus;
  dueDate:             string | null;
  createdAt:           string;
}

export interface MeetingDto {
  id:                number;
  title:             string;
  agenda:            string | null;
  notes:             string | null;
  location:          string | null;
  meetingType:       MeetingType;
  scheduledAt:       string;
  durationMinutes:   number;
  status:            MeetingStatus;
  isRecurring:       boolean;
  recurrencePattern: string | null;
  organisedByUserId: number;
  organisedByName:   string;
  createdAt:         string;
  myResponse:        RsvpResponse | null;
  isOrganiser:       boolean;
  attendees:         MeetingAttendeeDto[];
  actionItems:       MeetingActionItemDto[];
}

export interface CreateMeetingDto {
  title:             string;
  agenda?:           string;
  location?:         string;
  meetingType:       MeetingType;
  scheduledAt:       string;
  durationMinutes:   number;
  isRecurring:       boolean;
  recurrencePattern?: string;
  attendeeIds:       number[];
}

export interface UpdateMeetingDto {
  title?:            string;
  agenda?:           string;
  notes?:            string;
  location?:         string;
  meetingType?:      MeetingType;
  scheduledAt?:      string;
  durationMinutes?:  number;
  status?:           MeetingStatus;
}

export interface CreateActionItemDto {
  description:       string;
  assignedToUserId?: number;
  dueDate?:          string;
}

export interface UpdateActionItemDto {
  description?:      string;
  assignedToUserId?: number;
  status?:           ActionStatus;
  dueDate?:          string;
}

// ─── Performance Review (Feature 7) ──────────────────────────────────────────

export type CycleType     = 'Quarterly' | 'HalfYearly' | 'Annual' | 'Custom';
export type CycleStatus   = 'Active' | 'Closed';
export type ReviewStatus  = 'Pending' | 'SelfAssessment' | 'ManagerReview' | 'Completed';

export type Competency =
  | 'TechnicalSkills' | 'Communication' | 'Teamwork'
  | 'ProblemSolving'  | 'DeliveryQuality' | 'Initiative';

export const COMPETENCIES: { key: Competency; label: string; icon: string }[] = [
  { key: 'TechnicalSkills',  label: 'Technical Skills',   icon: '💻' },
  { key: 'Communication',    label: 'Communication',       icon: '💬' },
  { key: 'Teamwork',         label: 'Teamwork',            icon: '🤝' },
  { key: 'ProblemSolving',   label: 'Problem Solving',     icon: '🧩' },
  { key: 'DeliveryQuality',  label: 'Delivery & Quality',  icon: '🎯' },
  { key: 'Initiative',       label: 'Initiative',          icon: '🚀' },
];

export const RATING_LABELS: Record<number, string> = {
  1: 'Needs Improvement',
  2: 'Below Expectations',
  3: 'Meets Expectations',
  4: 'Exceeds Expectations',
  5: 'Outstanding',
};

export interface ReviewRatingDto {
  id:         number;
  competency: Competency;
  score:      number;
  comment:    string | null;
}

export interface PerformanceReviewSummaryDto {
  id:              number;
  revieweeName:    string;
  profilePhotoUrl: string | null;
  reviewerName:    string;
  status:          ReviewStatus;
  selfRating:      number | null;
  overallRating:   number | null;
}

export interface ReviewCycleDto {
  id:                    number;
  title:                 string;
  description:           string | null;
  cycleType:             CycleType;
  startDate:             string;
  endDate:               string;
  selfAssessmentDueDate: string | null;
  status:                CycleStatus;
  createdByName:         string;
  createdAt:             string;
  totalReviews:          number;
  pendingCount:          number;
  selfSubmittedCount:    number;
  completedCount:        number;
  myReview:              PerformanceReviewSummaryDto | null;
}

export interface PerformanceReviewDto {
  id:                  number;
  reviewCycleId:       number;
  cycleTitle:          string;
  cycleType:           string;
  cycleStart:          string;
  cycleEnd:            string;
  revieweeId:          number;
  revieweeName:        string;
  revieweePhoto:       string | null;
  revieweeRole:        string;
  reviewerId:          number;
  reviewerName:        string;
  selfAssessmentText:  string | null;
  selfRating:          number | null;
  achievements:        string | null;
  improvements:        string | null;
  goals:               string | null;
  selfSubmittedAt:     string | null;
  managerFeedback:     string | null;
  overallRating:       number | null;
  strengthsNote:       string | null;
  developmentNote:     string | null;
  managerSubmittedAt:  string | null;
  ratings:             ReviewRatingDto[];
  status:              ReviewStatus;
  createdAt:           string;
  updatedAt:           string;
}

export interface SubmitSelfAssessmentDto {
  selfAssessmentText: string;
  selfRating:         number;
  achievements?:      string;
  improvements?:      string;
  goals?:             string;
}

export interface SubmitManagerReviewDto {
  managerFeedback: string;
  overallRating:   number;
  strengthsNote?:  string;
  developmentNote?: string;
  ratings: { competency: string; score: number; comment?: string }[];
}

export interface CreateReviewCycleDto {
  title:                 string;
  description?:          string;
  cycleType:             CycleType;
  startDate:             string;
  endDate:               string;
  selfAssessmentDueDate?: string;
  revieweeIds:           number[];
}

// ─── Feature 8: Overtime Tracker ─────────────────────────────────────────────

export interface OvertimeDayDto {
  date:            string;
  dateLabel:       string;    // "Mon, Jan 15"
  dayStatus:       string;    // "Present" | "WFH" | "HalfDay"
  workMinutes:     number;
  standardMinutes: number;
  overtimeMinutes: number;
  workHours:       string;    // "9h 30m"
  overtimeHours:   string;    // "1h 30m"
  hasOvertime:     boolean;
}

export interface OvertimeWeekDto {
  weekNumber:           number;
  weekLabel:            string;   // "Week 1 (Jan 1–7)"
  totalOvertimeMinutes: number;
  totalOvertimeHours:   string;
  daysWithOvertime:     number;
}

export interface OvertimeSummaryDto {
  userId:    number;
  fullName:  string;
  role:      string;
  month:     number;
  year:      number;
  totalOvertimeMinutes:      number;
  totalOvertimeHours:        string;
  daysWithOvertime:          number;
  totalWorkingDays:          number;
  avgOvertimePerDayMinutes:  number;
  avgOvertimePerDayHours:    string;
  peakOvertimeDate:          string | null;
  peakOvertimeMinutes:       number;
  peakOvertimeHours:         string;
  standardMinutesPerDay:     number;
  days:  OvertimeDayDto[];
  weeks: OvertimeWeekDto[];
}

export interface TeamOvertimeDto {
  month:      number;
  year:       number;
  monthLabel: string;
  teamTotalOvertimeMinutes: number;
  teamTotalOvertimeHours:   string;
  teamMembersWithOvertime:  number;
  members: OvertimeSummaryDto[];
}

// ─── Payroll Summary ──────────────────────────────────────────────────────────

export interface SetSalaryDto {
  monthlySalary:      number;
  currency:           string;
  overtimeMultiplier: number;
}

export interface EmployeeSalaryDto {
  userId:             number;
  fullName:           string;
  role:               string;
  monthlySalary:      number;
  currency:           string;
  overtimeMultiplier: number;
  effectiveFrom:      string;
  setByName:          string;
  updatedAt:          string;
}

export interface PayslipEarningDto {
  label:  string;
  amount: number;
  note:   string;
}

export interface PayslipDeductionDto {
  label:  string;
  amount: number;
  note:   string;
}

export interface PayslipDto {
  userId:             number;
  fullName:           string;
  role:               string;
  email:              string;
  month:              number;
  year:               number;
  monthLabel:         string;
  monthlySalary:      number;
  currency:           string;
  overtimeMultiplier: number;
  salaryConfigured:   boolean;
  workingDaysInMonth: number;
  perDayRate:         number;
  hourlyRate:         number;
  daysPresent:        number;
  daysHalfDay:        number;
  daysPaidLeave:      number;
  daysUnpaidLeave:    number;
  daysAbsent:         number;
  overtimeMinutes:    number;
  overtimeHours:      string;
  basicEarnings:      number;
  overtimePay:        number;
  grossEarnings:      number;
  unpaidLeaveDeduction: number;
  absentDeduction:    number;
  totalDeductions:    number;
  netPay:             number;
  earnings:           PayslipEarningDto[];
  deductions:         PayslipDeductionDto[];
}

export interface TeamPayrollDto {
  month:                number;
  year:                 number;
  monthLabel:           string;
  teamTotalGross:       number;
  teamTotalNet:         number;
  teamTotalDeductions:  number;
  teamTotalOvertimePay: number;
  membersConfigured:    number;
  membersNotConfigured: number;
  members:              PayslipDto[];
}

// ─── Document Management ──────────────────────────────────────────────────────

export type DocumentCategory =
  | 'OfferLetter'
  | 'Contract'
  | 'Payslip'
  | 'IDProof'
  | 'Certificate'
  | 'Policy'
  | 'Appraisal'
  | 'Warning'
  | 'Other';

export interface DocumentDto {
  id:                  number;
  title:               string;
  description?:        string;
  category:            string;
  fileName:            string;
  mimeType:            string;
  fileSizeBytes:       number;
  fileSizeLabel:       string;
  isPublic:            boolean;
  uploadedAt:          string;
  expiresAt?:          string;
  isExpired:           boolean;
  expiresWithin30Days: boolean;
  ownerUserId:         number;
  ownerName:           string;
  uploadedByUserId:    number;
  uploadedByName:      string;
  downloadUrl:         string;
}

export interface DocumentSummaryDto {
  totalDocuments:    number;
  myDocuments:       number;
  publicDocuments:   number;
  expiringDocuments: number;
  expiredDocuments:  number;
  byCategory:        Record<string, number>;
}

export interface UploadDocumentDto {
  title:        string;
  description?: string;
  category:     string;
  ownerUserId:  number;
  isPublic:     boolean;
  expiresAt?:   string;
}

export interface UpdateDocumentDto {
  title?:       string;
  description?: string;
  category?:    string;
  isPublic?:    boolean;
  expiresAt?:   string;
}

// ─── Training & Certification Tracker ────────────────────────────────────────

export type TrainingStatus = 'Planned' | 'InProgress' | 'Completed' | 'Cancelled';
export type TrainingType   = 'Online' | 'Internal' | 'External' | 'Conference' | 'Workshop' | 'Certification';
export type CertStatus     = 'Active' | 'Expired' | 'Revoked';

export interface TrainingDto {
  id:            number;
  userId:        number;
  userName:      string;
  title:         string;
  provider?:     string;
  trainingType:  string;
  description?:  string;
  startDate:     string;
  endDate?:      string;
  durationHours: number;
  status:        string;
  notes?:        string;
  courseUrl?:    string;
  createdAt:     string;
}

export interface CertificationDto {
  id:                  number;
  userId:              number;
  userName:            string;
  name:                string;
  issuingOrganization: string;
  issueDate:           string;
  expiryDate?:         string;
  credentialId?:       string;
  credentialUrl?:      string;
  status:              string;
  hasFile:             boolean;
  fileName?:           string;
  fileSizeLabel?:      string;
  downloadUrl?:        string;
  isExpired:           boolean;
  expiresWithin30Days: boolean;
  daysUntilExpiry?:    number;
  createdAt:           string;
}

export interface TrainingStatsDto {
  totalTrainings:        number;
  completedTrainings:    number;
  plannedTrainings:      number;
  inProgressTrainings:   number;
  totalHours:            number;
  totalCertifications:   number;
  activeCertifications:  number;
  expiredCertifications: number;
  expiringWithin30Days:  number;
  byTrainingType:        Record<string, number>;
}

export interface TeamTrainingStatsDto {
  totalMembers:       number;
  totalTrainings:     number;
  totalCertifications: number;
  expiringCerts:      number;
  totalHours:         number;
  members:            MemberTrainingSummaryDto[];
}

export interface MemberTrainingSummaryDto {
  userId:            number;
  fullName:          string;
  role:              string;
  trainingCount:     number;
  completedCount:    number;
  hoursCompleted:    number;
  certificationCount: number;
  expiringCertCount: number;
}

export interface CreateTrainingDto {
  title:         string;
  provider?:     string;
  trainingType:  string;
  description?:  string;
  startDate:     string;
  endDate?:      string;
  durationHours: number;
  status:        string;
  notes?:        string;
  courseUrl?:    string;
}

export interface UpdateTrainingDto {
  title?:         string;
  provider?:      string;
  trainingType?:  string;
  description?:   string;
  startDate?:     string;
  endDate?:       string;
  durationHours?: number;
  status?:        string;
  notes?:         string;
  courseUrl?:     string;
}

export interface CreateCertificationDto {
  name:                string;
  issuingOrganization: string;
  issueDate:           string;
  expiryDate?:         string;
  credentialId?:       string;
  credentialUrl?:      string;
}

export interface UpdateCertificationDto {
  name?:                string;
  issuingOrganization?: string;
  issueDate?:           string;
  expiryDate?:          string;
  credentialId?:        string;
  credentialUrl?:       string;
  status?:              string;
}

// ─── Resignation & Exit Management ───────────────────────────────────────────

export interface ExitChecklistItemDto {
  id:               number;
  task:             string;
  isCompleted:      boolean;
  completedAt?:     string;
  completedByName?: string;
}

export interface ResignationDto {
  id:                   number;
  userId:               number;
  employeeName:         string;
  department?:          string;
  designation?:         string;
  reason:               string;
  requestedLastDay:     string;
  status:               'Pending' | 'Accepted' | 'Rejected' | 'Completed';
  reviewNote?:          string;
  reviewedByName?:      string;
  reviewedAt?:          string;
  noticePeriodEndDate?: string;
  exitDate?:            string;
  submittedAt:          string;
  noticeDaysRemaining?: number;
  isMyResignation:      boolean;
  checklistItems:       ExitChecklistItemDto[];
}

export interface ResignationSummaryDto {
  pendingCount:   number;
  acceptedCount:  number;
  completedCount: number;
  rejectedCount:  number;
  active:         ResignationDto[];
}

export interface SubmitResignationDto {
  reason:           string;
  requestedLastDay: string;
}

export interface ReviewResignationDto {
  decision:            'Accepted' | 'Rejected';
  reviewNote?:         string;
  noticePeriodEndDate?: string;
}

export interface CompleteExitDto {
  exitDate:   string;
  finalNote?: string;
}
export interface FaceDescriptorResponse {
  userId:         number;
  fullName:       string;
  faceRegistered: boolean;
  descriptor?:    string; // JSON array of 128 floats, null if not registered
}
 
export interface FaceAttemptLog {
  id:          number;
  userId:      number;
  fullName:    string;
  action:      'CheckIn' | 'CheckOut';
  success:     boolean;
  distance:    number;
  result:      'Matched' | 'Mismatch' | 'NoFaceDetected' | 'NotRegistered';
  attemptedAt: string;
}