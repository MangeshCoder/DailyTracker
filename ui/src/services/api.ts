import axios from 'axios';
import { ChatMessage, ConversationDetail,TrainingDto, 
   CertificationDto, TrainingStatsDto, TeamTrainingStatsDto,
   CreateTrainingDto, UpdateTrainingDto, CreateCertificationDto, 
   UpdateCertificationDto, ConversationSummary, DocumentDto, DocumentSummaryDto, 
   SendMessagePayload, UpdateDocumentDto, UserChatProfile, 
   ExitChecklistItemDto,
   ResignationDto,
   CompleteExitDto,
   ReviewResignationDto,
   ResignationSummaryDto,
   SubmitResignationDto,
   AppNotification} from '../types';
import { ChatApiResponse, MessageHistory } from '../types/chat';

//const BASE_URL = 'https://localhost:7096/api';
//const BASE_URL = 'http://192.168.1.244:5053/api';
const BASE_URL = import.meta.env.VITE_API_URL ?? 'https://localhost:7096/api';

const api = axios.create({
  baseURL: BASE_URL,
  withCredentials: true // 🔥 REQUIRED for httpOnly cookies
});


// ─── Auto-refresh on 401 ─────────────────────────────────────────────
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value?: unknown) => void;
  reject: (reason?: unknown) => void;
}> = [];

const processQueue = (error: unknown) => {
  failedQueue.forEach(p => {
    if (error) {
      p.reject(error);
    } else {
      p.resolve();
    }
  });
  failedQueue = [];
};

api.interceptors.response.use(
  res => res,
  async error => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then(() => api(originalRequest));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        // 🔥 Refresh using cookie (NO BODY)
        await axios.post(`${BASE_URL}/auth/refresh`, {}, { withCredentials: true });

        processQueue(null);
        return api(originalRequest);

      } catch (refreshError) {
        processQueue(refreshError);
        window.location.href = "/login";
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

// ─── Device token for trusted devices (skip 2FA for 30 days) ──────────────────
const DEVICE_TOKEN_KEY = 'deviceToken';
export const getDeviceToken = (): string => {
  let t = localStorage.getItem(DEVICE_TOKEN_KEY);
  if (!t) {
    t = crypto.randomUUID();
    localStorage.setItem(DEVICE_TOKEN_KEY, t);
  }
  return t;
};

// ─── Auth ─────────────────────────────────────────────────────────────────────
export const authApi = {
  login: (d: { email: string; password: string }, deviceToken?: string) =>
    api.post('/auth/login', d, {
      headers: deviceToken ? { 'X-Device-Token': deviceToken } : undefined,
    }),
  verify2FALogin: (tempToken: string, code: string) =>
    api.post('/auth/verify-2fa-login', { tempToken, code }),
  register: (d: object) => api.post('/auth/register', d),
  refresh: () => api.post('/auth/refresh'),
  logout: () => api.post('/auth/logout'),
  getUsers: () => api.get('/auth/users'),
  // Two-Factor Authentication
  get2FAStatus: () => api.get<{ twoFactorEnabled: boolean }>('/auth/2fa-status'),
  setup2FA: () => api.post<{ manualEntryKey: string; qrCodeBase64: string; message: string }>('/auth/setup-2fa'),
  verify2FASetup: (code: string) => api.post('/auth/verify-2fa-setup', { code }),
  disable2FA: (code: string) => api.post('/auth/disable-2fa', { code }),
  trustDevice: (deviceToken: string, deviceName?: string) =>
    api.post('/auth/trust-device', { deviceToken, deviceName }),
    sendRegisterOtp: (data: { email: string }) =>
  api.post('/auth/send-register-otp', data),

  verifyRegisterOtp: (data: any) =>
    api.post('/auth/verify-register-otp', data),

  sendLoginOtp: (data: { email: string }) =>
    api.post('/auth/send-login-otp', data),

  verifyLoginOtp: (data: { email: string; code: string }) =>
    api.post('/auth/verify-login-otp', data),

  sendForgotPasswordOtp: (data: { email: string }) =>
    api.post('/auth/send-forgot-password-otp', data),

  resetPassword: (data: { email: string; code: string; newPassword: string }) =>
    api.post('/auth/reset-password', data),
  me: () => api.get('/auth/me').then(r => r.data),
  getPendingUsers: () => api.get('/auth/pending-users'),
  assignRole: (d: { userId: number; role: string }) => api.post('/auth/assign-role', d),
};

// ─── AI Chat ──────────────────────────────────────────────────────────────────
export const aiChatApi = {
  sendMessage: (message: string, history: MessageHistory[]) =>
    api.post<ChatApiResponse>('/aichat/send', { message, history }),
  executeAction: (type: string, payload: Record<string, any>) =>
    api.post<{ success: boolean; message: string; item?: any }>('/aichat/execute-action', {
      type,
      payload,
    }),
  getContextSummary: () =>
    api.get<{
      success: boolean;
      summary: {
        isCheckedIn: boolean;
        checkInTime: string | null;
        isCheckedOut: boolean;
        checkOutTime: string | null;
        totalWorkMinutes: number;
        tasksCount: number;
        completedTasksCount: number;
        isOnBreak: boolean;
        activeBreakType: string | null;
        dayStatus: string;
      };
    }>('/aichat/context-summary'),
      getEodDraft: () =>
      api.get<{ success: boolean; draft?: any; message?: string }>("/aichat/eod-draft"),
    
};

// ─── Daily Log ────────────────────────────────────────────────────────────────
export const dailyLogApi = {
  checkIn: (d: object) => api.post('/dailylog/checkin', d),
  checkOut: (d: object) => api.put('/dailylog/checkout', d),
  getToday: () => api.get('/dailylog/today'),
  getByDate: (date: string) => api.get(`/dailylog/date/${date}`),
  getHistory: (days = 30) => api.get(`/dailylog/history?days=${days}`),
};

// ─── Breaks ───────────────────────────────────────────────────────────────────
export const breaksApi = {
  startBreak: (breakType: string) => api.post('/breaks/start', { breakType }),
  endBreak: (breakId: number) => api.put(`/breaks/end/${breakId}`),
};

// ─── Tasks ────────────────────────────────────────────────────────────────────
export const tasksApi = {
  create: (d: object) => api.post('/tasks', d),
  update: (id: number, d: object) => api.put(`/tasks/${id}`, d),
  delete: (id: number) => api.delete(`/tasks/${id}`),
  getToday: () => api.get('/tasks/today'),
  getByDate: (date: string) => api.get(`/tasks/date/${date}`),
};

// ─── Support ──────────────────────────────────────────────────────────────────
export const supportApi = {
  create: (d: object) => api.post('/support', d),
 
  createWithMedia: (formData: FormData, onUploadProgress?: (percent: number) => void) =>
    api.post('/support/with-media', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (progressEvent) => {
        if (!progressEvent.total) return;
        const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
        onUploadProgress?.(percent);
      },
    }),
 
  delete:        (id: number) => api.delete(`/support/${id}`),
  getToday:      ()           => api.get('/support/today'),
  getMyAssignment: ()         => api.get('/support/my-assignment'),  // ← NEW Feature 3
};

export const supportAssignmentApi = {
  getAll:     ()                         => api.get('/support/assignments'),
  create:     (d: object)                => api.post('/support/assignments', d),
  deactivate: (id: number)               => api.delete(`/support/assignments/${id}`),
};

// ─── Dashboard ────────────────────────────────────────────────────────────────
export const dashboardApi = {
  getTodaySummary: () => api.get('/dashboard/today'),
  getWeeklyReport: () => api.get('/dashboard/weekly'),
};

// ─── Goals (Feature 4) ────────────────────────────────────────────────────────
export const goalsApi = {
  setGoal: (d: object) => api.post('/goals', d),
  getProgress: () => api.get('/goals/today'),
  getTrend: (days = 14) => api.get(`/goals/trend?days=${days}`),
  getHistory: (preset: 'week' | 'month') =>api.get(`/goals/history?preset=${preset}`),
  getHistoryRange:  (from: string, to: string) => api.get(`/goals/history?from=${from}&to=${to}`),
};

// ─── EOD Reports (Feature 6) ──────────────────────────────────────────────────
export const eodApi = {
  submit: (d: object) => api.post('/eod', d),
  getToday: () => api.get('/eod/today'),
  getHistory: (days = 14) => api.get(`/eod/history?days=${days}`),
  getPending: () => api.get('/eod/pending'),
  review: (id: number, d: object) => api.put(`/eod/${id}/review`, d),
};

// ─── Kudos (Feature 9) ────────────────────────────────────────────────────────
export const kudosApi = {
  give: (d: object) => api.post('/kudos', d),
  getRecent: (limit = 20) => api.get(`/kudos/recent?limit=${limit}`),
  getMySummary: () => api.get('/kudos/my'),
  getLeaderboard: (period: 'week' | 'month' | 'alltime') => {
      const now   = new Date();
      const year  = now.getFullYear();
      const month = now.getMonth() + 1; // 1-based

      if (period === 'week') {
        // Backend doesn't have a week mode — use current month as closest proxy
        return api.get(`/kudos/leaderboard?year=${year}&month=${month}`);
      }
      if (period === 'month') {
        return api.get(`/kudos/leaderboard?year=${year}&month=${month}`);
      }
      // alltime → full year (omit month)
      return api.get(`/kudos/leaderboard?year=${year}`);
    },
};

// ─── Announcements (Feature 10) ───────────────────────────────────────────────
export const announcementsApi = {
  getAll:        ()                      => api.get('/announcements'),
  getUnreadCount:()                      => api.get('/announcements/unread-count'),
  create:        (d: object)             => api.post('/announcements', d),
  markRead:      (id: number)            => api.post(`/announcements/${id}/read`),
  markAllRead:   ()                      => api.post('/announcements/read-all'),
  togglePin:     (id: number)            => api.patch(`/announcements/${id}/pin`),
  delete:        (id: number)            => api.delete(`/announcements/${id}`),
};

// ─── Presence (Feature 9) ─────────────────────────────────────────────────────
export const presenceApi = {
  update: (d: object) => api.put('/presence', d),
  getTeam: () => api.get('/presence/team'),
};

// ─── Leave (Feature 9) ────────────────────────────────────────────────────────
export const leaveApi = {
  apply: (d: object) => api.post('/leave', d),
  getMine: () => api.get('/leave/my'),
  getAll: (status?: string) => api.get('/leave/all', { params: status ? { status } : {} }),
  review: (id: number, d: object) => api.put(`/leave/${id}/review`, d),
  cancel: (id: number) => api.delete(`/leave/${id}`),
  getBalance: () => api.get('/leave/balance'),
  reviewFromEmail: (token: string, status: string) => api.post('/leave/email-review', { token, status })
};

// ─── Holidays (Feature 10) ────────────────────────────────────────────────────
export const holidayApi = {
  getByYear: (year = new Date().getFullYear()) => api.get(`/holidays?year=${year}`),
  isToday: () => api.get('/holidays/today'),
  create: (d: object) => api.post('/holidays', d),
  delete: (id: number) => api.delete(`/holidays/${id}`),
};

// ─── Notifications (Feature 1) ────────────────────────────────────────────────
export const notifApi = {
  // ── Bell popup (existing — unchanged) ──────────────────────────────────────
  // Returns latest 50 notifications. Fast. Used only by the bell dropdown.
  getAll:       (unreadOnly = false) =>
    api.get<AppNotification[]>(`/notifications?unreadOnly=${unreadOnly}`),

  getCount:     () =>
    api.get<{ count: number }>('/notifications/count'),

  markRead:     (id: number) =>
    api.put(`/notifications/${id}/read`),

  markAllRead:  () =>
    api.put('/notifications/read-all'),

  // ── Inbox page (new) ───────────────────────────────────────────────────────
  // Paginated, no 50-item cap — skip/take for infinite scroll.
  getPaged: (skip = 0, take = 30, unreadOnly = false) =>
    api.get<AppNotification[]>(
      `/notifications/paged?skip=${skip}&take=${take}&unreadOnly=${unreadOnly}`
    ),

  // Delete one notification (user dismisses it permanently)
  deleteOne: (id: number) =>
    api.delete(`/notifications/${id}`),

  // Clear all already-read notifications in one request
  clearRead: () =>
    api.delete<{ deleted: number; message: string }>('/notifications/clear-read'),
};

// ─── Analytics (Feature 5) ────────────────────────────────────────────────────
export const analyticsApi = {
  getAdvanced: (days = 90) => api.get(`/analytics?days=${days}`),
  getHeatmap: (days = 365) => api.get(`/analytics/heatmap?days=${days}`),
  getProjects: (days = 30) => api.get(`/analytics/projects?days=${days}`),
  getPeakHours: (days = 30) => api.get(`/analytics/peak-hours?days=${days}`),
  getUserAnalytics: (userId: number, days = 90) => api.get(`/analytics/user/${userId}?days=${days}`),
};

// ─── Task Templates (Feature 3) ───────────────────────────────────────────────
export const templateApi = {
  getAll: () => api.get('/task-templates'),
  getRecurring: () => api.get('/task-templates/recurring'),
  create: (d: object) => api.post('/task-templates', d),
  useTemplate: (templateId: number, dailyLogId: number) =>
    api.post(`/task-templates/${templateId}/use/${dailyLogId}`),
  delete: (id: number) => api.delete(`/task-templates/${id}`),
};

// ─── Task Timer (Feature 3) ───────────────────────────────────────────────────
export const taskTimerApi = {
  start: (taskId: number) => api.post(`/task-timer/${taskId}/start`),
  stop: (taskId: number) => api.post(`/task-timer/${taskId}/stop`),
  getActive: () => api.get('/task-timer/active'),
};

// ─── Manager API ──────────────────────────────────────────────────────────────
export const managerApi = {
  getTeamDaily: (date?: string) => api.get('/manager/team/daily', { params: date ? { date } : {} }),
  getTeamMonthly: (month: number, year: number) => api.get('/manager/team/monthly', { params: { month, year } }),
  getUserAttendance: (userId: number, month: number, year: number) =>
    api.get(`/manager/user/${userId}/attendance`, { params: { month, year } }),
  getUserCalendar: (userId: number, month: number, year: number) =>
    api.get(`/manager/user/${userId}/calendar`, { params: { month, year } }),
  getUserReport: (userId: number, from: string, to: string) =>
    api.get(`/manager/user/${userId}/report`, { params: { from, to } }),
  downloadUserReport: (userId: number, format: string, from: string, to: string) =>
    api.get(`/manager/user/${userId}/download`, { params: { format, from, to }, responseType: 'blob' }),
  getAllUsers: () => api.get('/manager/users'),
  toggleUserStatus: (userId: number) =>
    api.put(`/manager/user/${userId}/toggle-status`)
};

// ─── Report API ───────────────────────────────────────────────────────────────
export const reportApi = {
  getMyReport: (from: string, to: string) => api.get('/report/my', { params: { from, to } }),
  downloadMyReport: (format: string, from: string, to: string) =>
    api.get('/report/my/download', { params: { format, from, to }, responseType: 'blob' }),
  getMyAttendance: (month: number, year: number) =>
    api.get('/report/my/attendance', { params: { month, year } }),
  getMyCalendar: (month: number, year: number) =>
    api.get('/report/my/calendar', { params: { month, year } }),
};

// ─── Audit ────────────────────────────────────────────────────────────────────
export const auditApi = {
  getLogs: (userId?: number, entity?: string, take = 50) =>
    api.get('/audit', { params: { userId, entity, take } }),
};

// ─── Helper: download blob ────────────────────────────────────────────────────
export const downloadBlob = (blob: Blob, filename: string) => {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  a.remove(); window.URL.revokeObjectURL(url);
};

export const wfhApi = {
  submit: (data: object) =>
    api.post('/wfh-requests', data).then(r => r.data),

  getMy: () =>
    api.get('/wfh-requests/my').then(r => r.data),

  cancel: (id: number) =>
    api.delete(`/wfh-requests/${id}/cancel`).then(r => r.data),

  getPending: () =>
    api.get('/wfh-requests/pending').then(r => r.data),

  getAll: (month: number, year: number) =>
    api.get('/wfh-requests/all', { params: { month, year } })
       .then(r => r.data),

  approve: (id: number, note?: string) =>
    api.post(`/wfh-requests/${id}/approve`, { note })
       .then(r => r.data),

  reject: (id: number, note?: string) =>
    api.post(`/wfh-requests/${id}/reject`, { note })
       .then(r => r.data),

  getTeamStatus: (date?: string) =>
    api.get('/wfh-requests/team-status',
      { params: date ? { date } : {} })
       .then(r => r.data),

  getTeamMonthly: (month: number, year: number) =>
    api.get('/wfh-requests/team-monthly',
      { params: { month, year } })
       .then(r => r.data),

    reviewFromEmail: (token: string, status: string) =>
    api.post('/wfh-requests/review', null, {
      params: { token, status }
    }).then(r => r.data),     
};

export const profileApi = {
  // Own profile
  getMe:       ()              => api.get('/profile/me'),
  updateMe:    (d: object)     => api.put('/profile/me', d),        // PUT → UpdateProfileDto
  deletePhoto: ()              => api.delete('/profile/me/photo'),

  // Photo upload — multipart/form-data
  uploadPhoto: (file: File) => {
    const fd = new FormData();
    fd.append('photo', file);
    return api.post('/profile/me/photo', fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  // Directory — client-side filtering is used in the page,
  // but params are kept here in case you want server-side later
  getDirectory: (params?: { search?: string; role?: string; department?: string }) =>
    api.get('/profile/directory', { params }),

  // Single employee
  getUser: (userId: number) => api.get(`/profile/${userId}`),

  // Manager: edit dept/designation/joindate/manager of any employee
  adminUpdate: (userId: number, d: object) => api.put(`/profile/${userId}/admin`, d),
};


export const teamCalendarApi = {
  get: (month: number, year: number) =>
    api.get('/team-calendar', { params: { month, year } }),
};

export const chatApi = {
  // Conversations
  getConversations: (): Promise<ConversationSummary[]> =>
    api.get('/chat/conversations').then(r => r.data),

  openDirect: (otherUserId: number): Promise<ConversationSummary> =>
    api.post(`/chat/conversations/direct/${otherUserId}`)
      .then(r => r.data),

  createGroup: (
    data: { groupName: string; groupAvatar?: string; memberIds: number[] }
  ): Promise<ConversationSummary> =>
    api.post('/chat/conversations/group', data)
      .then(r => r.data),

  getConversationDetail: (convId: number): Promise<ConversationDetail> =>
    api.get(`/chat/conversations/${convId}`).then(r => r.data),

  getUsers: (): Promise<UserChatProfile[]> =>
    api.get('/chat/users').then(r => r.data),
  
  getOnlineUsers: () =>
    api.get('/chat/online-users'),

  // Messages
  getMessages: (convId: number, pageSize = 50, beforeMessageId?: number): Promise<ChatMessage[]> =>
    api.get(`/chat/conversations/${convId}/messages`, {
      params: { pageSize, beforeMessageId }
    }).then(r => r.data),

  sendMessage: (data: SendMessagePayload): Promise<ChatMessage> =>
    api.post('/chat/messages', data).then(r => r.data),

  editMessage: (messageId: number, content: string): Promise<ChatMessage> =>
    api.put(`/chat/messages/${messageId}`, { content }).then(r => r.data),

  deleteMessage: (messageId: number) =>
    api.delete(`/chat/messages/${messageId}`).then(r => r.data),

  searchMessages: (convId: number, q: string) =>
    api.get(`/chat/conversations/${convId}/search`, { params: { q } }),

  // Read
  markRead: (convId: number) =>
    api.post(`/chat/conversations/${convId}/read`),

  getUnreadCounts: (): Promise<Record<number, number>> =>
    api.get('/chat/unread-counts').then(r => r.data),

  // Reactions
  react: (messageId: number, emoji: string) =>
    api.post(`/chat/messages/${messageId}/react`, { emoji }),

  // Group management
  addMembers: (convId: number, userIds: number[]) =>
    api.post(`/chat/conversations/${convId}/members`, { userIds }),

  removeMember: (convId: number, targetUserId: number) =>
    api.delete(`/chat/conversations/${convId}/members/${targetUserId}`),

  leaveGroup: (convId: number) =>
    api.post(`/chat/conversations/${convId}/leave`),

  updateGroupInfo: (convId: number, data: { groupName?: string; groupAvatar?: string }) =>
    api.put(`/chat/conversations/${convId}/group-info`, data),

  promoteAdmin: (convId: number, targetUserId: number) =>
    api.post(`/chat/conversations/${convId}/members/${targetUserId}/promote`),
};

// ─── Meeting Log (Feature 6) ──────────────────────────────────────────────────
export const meetingApi = {
  // Meetings
  getAll:   (month?: number, year?: number) =>
    api.get('/meetings', { params: month && year ? { month, year } : {} }),
  getById:  (id: number) =>
    api.get(`/meetings/${id}`),
  create:   (d: object) =>
    api.post('/meetings', d),
  update:   (id: number, d: object) =>
    api.put(`/meetings/${id}`, d),
  delete:   (id: number) =>
    api.delete(`/meetings/${id}`),
  rsvp:     (id: number, response: string) =>
    api.post(`/meetings/${id}/rsvp`, { response }),

  // Action items
  addActionItem:    (meetingId: number, d: object) =>
    api.post(`/meetings/${meetingId}/action-items`, d),
  updateActionItem: (itemId: number, d: object) =>
    api.put(`/meetings/action-items/${itemId}`, d),
  deleteActionItem: (itemId: number) =>
    api.delete(`/meetings/action-items/${itemId}`),
};

// ─── Performance Review (Feature 7) ──────────────────────────────────────────
export const reviewApi = {
  // Shared
  getCycles:  ()           => api.get('/reviews/cycles'),
  getCycle:   (id: number) => api.get(`/reviews/cycles/${id}`),
  getMyReviews: ()         => api.get('/reviews/my'),
  getReview:  (id: number) => api.get(`/reviews/${id}`),
  submitSelfAssessment: (id: number, d: object) =>
    api.put(`/reviews/${id}/self-assessment`, d),

  // Manager only
  createCycle:  (d: object)                    => api.post('/reviews/cycles', d),
  closeCycle:   (id: number)                   => api.put(`/reviews/cycles/${id}/close`, {}),
  getTeamReviews: (cycleId?: number)           =>
    api.get('/reviews/team', { params: cycleId ? { cycleId } : {} }),
  submitManagerReview: (id: number, d: object) =>
    api.put(`/reviews/${id}/manager-review`, d),
};

// ─── Feature 8: Overtime Tracker ─────────────────────────────────────────────
export const overtimeApi = {
  /** Employee: own monthly overtime summary */
  getMy: (month?: number, year?: number) =>
    api.get('/overtime/my', { params: { month, year } }),

  /** Manager/TeamLead: all team members' overtime for a month */
  getTeam: (month?: number, year?: number) =>
    api.get('/overtime/team', { params: { month, year } }),
};

// ─── Payroll Summary ──────────────────────────────────────────────────────────
export const payrollApi = {
  // Employee
  getMyPayslip:  (month?: number, year?: number) =>
    api.get('/payroll/my', { params: { month, year } }),
  getMySalary:   () =>
    api.get('/payroll/salary/my'),

  // Manager / TeamLead
  getTeamPayroll: (month?: number, year?: number) =>
    api.get('/payroll/team', { params: { month, year } }),
  getTeamSalaries: () =>
    api.get('/payroll/salary/team'),
  setSalary: (userId: number, data: object) =>
    api.put(`/payroll/salary/${userId}`, data),
  downloadPayslip: (month?: number, year?: number) =>
    api.get('/payroll/my/download', {
      params:       { month, year },
      responseType: 'blob',   // ← REQUIRED so axios treats response as binary
    }),
};

export const documentApi = {

  // Employee — own + public docs
  getMy: () =>
    api.get<DocumentDto[]>('/documents/my'),

  // Manager/TeamLead — all documents
  getAll: () =>
    api.get<DocumentDto[]>('/documents/all'),

  // Manager/TeamLead — docs for a specific employee
  getForUser: (userId: number) =>
    api.get<DocumentDto[]>(`/documents/user/${userId}`),

  // Summary stats
  getSummary: () =>
    api.get<DocumentSummaryDto>('/documents/summary'),

  // Single document metadata
  getOne: (id: number) =>
    api.get<DocumentDto>(`/documents/${id}`),

  // Upload — multipart/form-data
  upload: (formData: FormData) =>
    api.post<DocumentDto>('/documents', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),

  // Update metadata
  update: (id: number, data: UpdateDocumentDto) =>
    api.put<DocumentDto>(`/documents/${id}`, data),

  // Delete
  delete: (id: number) =>
    api.delete(`/documents/${id}`),

  // Download — returns blob so browser can save/open
  download: (id: number) =>
    api.get(`/documents/${id}/download`, { responseType: 'blob' }),
};

// ─── Training & Certification Tracker ────────────────────────────────────────
export const trainingApi = {

  // ── Trainings ──────────────────────────────────────────────────────────────
  getMyTrainings:       ()            => api.get<TrainingDto[]>('/training/my'),
  getAllTrainings:       ()            => api.get<TrainingDto[]>('/training/all'),
  getTrainingsForUser:  (uid: number) => api.get<TrainingDto[]>(`/training/user/${uid}`),
  getMyStats:           ()            => api.get<TrainingStatsDto>('/training/stats'),
  getTeamStats:         ()            => api.get<TeamTrainingStatsDto>('/training/stats/team'),

  createTraining: (data: CreateTrainingDto) =>
    api.post<TrainingDto>('/training', data),

  updateTraining: (id: number, data: UpdateTrainingDto) =>
    api.put<TrainingDto>(`/training/${id}`, data),

  deleteTraining: (id: number) =>
    api.delete(`/training/${id}`),

  // ── Certifications ─────────────────────────────────────────────────────────
  getMyCertifications:      ()            => api.get<CertificationDto[]>('/training/certifications/my'),
  getAllCertifications:      ()            => api.get<CertificationDto[]>('/training/certifications/all'),
  getCertificationsForUser: (uid: number) => api.get<CertificationDto[]>(`/training/certifications/user/${uid}`),
  getExpiring:              ()            => api.get<CertificationDto[]>('/training/certifications/expiring'),

  createCertification: (formData: FormData) =>
    api.post<CertificationDto>('/training/certifications', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),

  updateCertification: (id: number, data: UpdateCertificationDto) =>
    api.put<CertificationDto>(`/training/certifications/${id}`, data),

  deleteCertification: (id: number) =>
    api.delete(`/training/certifications/${id}`),

  downloadCert: (id: number) =>
    api.get(`/training/certifications/${id}/download`, { responseType: 'blob' }),
};

// ─── Resignation & Exit Management ───────────────────────────────────────────
export const resignationApi = {

  // Employee
  submit:   (data: SubmitResignationDto) =>
    api.post<ResignationDto>('/resignation', data),

  getMy:    () =>
    api.get<ResignationDto>('/resignation/my'),

  withdraw: () =>
    api.delete('/resignation/withdraw'),

  // Manager
  getAll:   (status?: string) =>
    api.get<ResignationDto[]>('/resignation', { params: status ? { status } : {} }),

  getSummary: () =>
    api.get<ResignationSummaryDto>('/resignation/summary'),

  getById:  (id: number) =>
    api.get<ResignationDto>(`/resignation/${id}`),

  review:   (id: number, data: ReviewResignationDto) =>
    api.put<ResignationDto>(`/resignation/${id}/review`, data),

  completeExit: (id: number, data: CompleteExitDto) =>
    api.put<ResignationDto>(`/resignation/${id}/complete`, data),

  // Checklist
  addChecklistItem:    (resignationId: number, task: string) =>
    api.post<ExitChecklistItemDto>(`/resignation/${resignationId}/checklist`, { task }),

  toggleChecklistItem: (itemId: number) =>
    api.put<ExitChecklistItemDto>(`/resignation/checklist/${itemId}/toggle`),

  deleteChecklistItem: (itemId: number) =>
    api.delete(`/resignation/checklist/${itemId}`),
  
};
export const faceApi = {
  // Register own face (employee)
  registerFace: (descriptor: string) =>
    api.post('/face/register', { descriptor }),
 
  // Manager registers on behalf of employee
  registerFaceForUser: (userId: number, descriptor: string) =>
    api.post('/face/register', { descriptor, targetUserId: userId }),
 
  // Get own descriptor
  getMyDescriptor: () =>
    api.get('/face/descriptor'),
 
  // Get any user's descriptor (manager)
  getDescriptor: (userId: number) =>
    api.get(`/face/descriptor/${userId}`),
 
  // Log an attempt result
  logAttempt: (data: {
    action: 'CheckIn' | 'CheckOut';
    success: boolean;
    distance: number;
    result: string;
  }) => api.post('/face/log-attempt', data),
 
  // Get own attempt history
  getMyAttempts: (days = 7) =>
    api.get(`/face/attempts?days=${days}`),
 
  // Manager: get one employee's attempts
  getUserAttempts: (userId: number, days = 30) =>
    api.get(`/face/attempts/${userId}?days=${days}`),
 
  // Manager: all team failed attempts today
  getTeamFailedToday: () =>
    api.get('/face/attempts/team/failed-today'),
};

export default api;