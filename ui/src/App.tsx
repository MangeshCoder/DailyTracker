import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { AuthProvider, useAuth } from './context/Authcontext';
import { ThemeProvider } from './context/ThemeContext';
import { ToastProvider } from './context/ToastContext';
import { SignalRProvider } from './context/SignalRContext';
import { queryClient } from './components/QueryClient';
import { ToastContainer } from './components/ToastContainer';
import { Layout } from './components/layout/Layout';
import { lazy, Suspense } from 'react';
import { SkeletonDashboard } from './components/Skeleton';
import { LeaveManagementPage } from './pages/LeaveManagementPage';
import { WFHRequestPage } from './pages/WFHRequestPage';
import { ManagerWFHDashboard } from './pages/ManagerWFHDashboard';
import { EmailAction } from './pages/EmailAction';
import { WFHEmailActionPage } from './pages/WFHEmailActionPage';
import { AssignRole } from './pages/AssignRole';
import { AiChatWidget } from './components/AiChatWidget';
// ═══════════════════════════════════════════════════════════════════════════════
// LAZY PAGE IMPORTS (Feature 15: Code splitting)
// ═══════════════════════════════════════════════════════════════════════════════

// Employee Pages
const DashboardPage = lazy(() =>
  import('./pages/Dashboardpage').then(m => ({ default: m.DashboardPage }))
);
const TasksPage = lazy(() =>
  import('./pages/Taskspage').then(m => ({ default: m.TasksPage }))
);
const SupportPage = lazy(() =>
  import('./pages/Supportpage').then(m => ({ default: m.SupportPage }))
);
const GoalsWidget = lazy(() =>
  import('./pages/Dashboardwidgets').then(m => ({ default: m.GoalsWidget }))
);
const GoalHistoryPage = lazy(() =>
  import('./pages/GoalHistoryPage').then(m => ({ default: m.GoalHistoryPage }))
);
const HistoryPage = lazy(() =>
  import('./pages/Historyanalyticspages').then(m => ({ default: m.HistoryPage }))
);
const AnalyticsPage = lazy(() =>
  import('./pages/AdvancedAnalyticsPage').then(m => ({ default: m.AdvancedAnalyticsPage }))
);
const MyReportPage = lazy(() =>
  import('./pages/Myreportpage').then(m => ({ default: m.MyReportPage }))
);
const KudosPage = lazy(() =>
  import('./pages/KudosPage').then(m => ({ default: m.KudosPage }))
);
const AnnouncementsPage = lazy(() =>
  import('./pages/AnnouncementsPage').then(m => ({ default: m.AnnouncementsPage }))
);
// ADD this line right after the KudosPage import
const ChatPage = lazy(() => import('./pages/Chatpage').then(m => ({ default: m.ChatPage })));

const TwoFactorSettingsPage = lazy(() =>
  import('./pages/TwoFactorSettingsPage').then(m => ({ default: m.TwoFactorSettingsPage }))
);
const FaceSetupPage = lazy(() =>
  import('./pages/FaceSetupPage').then(m => ({ default: m.FaceSetupPage }))
);

// ✅ EOD Report Pages - NEW
const EODReportPage = lazy(() =>
  import('./pages/EODReportPage').then(m => ({ default: m.EODReportPage }))
);
const MyEODReviewsPage = lazy(() =>
  import('./pages/MyEODReviewsPage').then(m => ({ default: m.MyEODReviewsPage }))
);

// Manager Pages
const ManagerDashboardPage = lazy(() =>
  import('./pages/Managerdashboardpage').then(m => ({ default: m.ManagerDashboardPage }))
);
const ManagerEODReviewPage = lazy(() =>
  import('./pages/ManagerEODReviewPage').then(m => ({ default: m.ManagerEODReviewPage }))
);

// Auth Pages
const LoginPage = lazy(() =>
  import('./pages/Authpages').then(m => ({ default: m.LoginPage }))
);
const RegisterPage = lazy(() =>
  import('./pages/Authpages').then(m => ({ default: m.RegisterPage }))
);
const ForgotPasswordPage = lazy(() =>
  import('./pages/ForgotPasswordPage').then(m => ({ default: m.default }))
);
const ProfilePage = lazy(() =>
  import('./pages/ProfilePage').then(m => ({ default: m.ProfilePage }))
);
const DirectoryPage = lazy(() =>
  import('./pages/Directorypage').then(m => ({ default: m.DirectoryPage }))
);

const TeamCalendarPage = lazy(() =>
  import('./pages/TeamCalendarPage').then(m => ({ default: m.TeamCalendarPage }))
);

const MeetingLogPage = lazy(() =>
  import('./pages/MeetingLogPage').then(m => ({ default: m.MeetingLogPage }))
);


const PerformanceReviewPage = lazy(() =>
  import('./pages/PerformanceReviewPage').then(m => ({ default: m.PerformanceReviewPage }))
);

const OvertimeTrackerPage = lazy(() =>
  import('./pages/OvertimeTrackerPage').then(m => ({ default: m.OvertimeTrackerPage }))
);

const PayrollPage = lazy(() =>
  import('./pages/PayrollPage').then(m => ({ default: m.PayrollPage }))
);

const DocumentManagementPage = lazy(() =>
  import('./pages/DocumentManagementPage').then(m => ({ default: m.DocumentManagementPage }))
);

const TrainingCertificationPage = lazy(() =>
  import('./pages/TrainingCertificationPage').then(m => ({ default: m.TrainingCertificationPage }))
);

const WFHSummaryPage = lazy(() =>
  import('./pages/WFHSummaryPage').then(m => ({ default: m.WFHSummaryPage }))
);

const ResignationPage = lazy(() =>
  import('./pages/ResignationPage').then(m => ({ default: m.ResignationPage }))
);

const NotificationsPage = lazy(() =>
  import('./pages/NotificationsPage').then(m => ({ default: m.NotificationsPage }))
);

const SupportAssignmentPage = lazy(() =>
  import('./pages/SupportAssignmentPage').then(m => ({ default: m.SupportAssignmentPage }))
);

const UserDetailPage = lazy(() =>
  import('./pages/Userdetailpage').then(m => ({ default: m.UserDetailPage }))
);

// ═══════════════════════════════════════════════════════════════════════════════
// ROUTE GUARDS
// ═══════════════════════════════════════════════════════════════════════════════

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />;
};

const ManagerRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (user?.role !== 'Manager' && user?.role !== 'TeamLead') return <Navigate to="/" replace />;
  return <>{children}</>;
};

// ═══════════════════════════════════════════════════════════════════════════════
// ROUTES CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

const AppRoutes = () => {
  const { isAuthenticated } = useAuth();

  return (
    <>
    <Routes>
      {/* ─── Auth Routes ──────────────────────────────────────────────────── */}
      <Route
        path="/login"
        element={isAuthenticated ? <Navigate to="/" /> : (
          <Suspense fallback={<SkeletonDashboard />}>
            <LoginPage />
          </Suspense>
        )}
      />
      <Route
        path="/register"
        element={isAuthenticated ? <Navigate to="/" /> : (
          <Suspense fallback={<SkeletonDashboard />}>
            <RegisterPage />
          </Suspense>
        )}
      />
      <Route
        path="/forgot-password"
        element={isAuthenticated ? <Navigate to="/" /> : (
          <Suspense fallback={<SkeletonDashboard />}>
            <ForgotPasswordPage />
          </Suspense>
        )}
      />

      {/* ─── Protected Routes ─────────────────────────────────────────────── */}
      <Route
        path="/"
        element={<ProtectedRoute><Layout /></ProtectedRoute>}
      >
        <Route
          path="profile"
          element={
            <Suspense fallback={<div className="p-8 text-slate-400">Loading…</div>}>
              <ProfilePage />
            </Suspense>
          }
        />
        <Route
          path="team/directory"
          element={
            <Suspense fallback={<div className="p-8 text-slate-400">Loading…</div>}>
              <DirectoryPage />
            </Suspense>
          }
        />
        <Route
          path="team/calendar"
          element={
            <Suspense fallback={<div className="p-8 text-slate-400">Loading…</div>}>
              <TeamCalendarPage />
            </Suspense>
          }
        />
        <Route
          path="meetings"
          element={
            <Suspense fallback={<SkeletonDashboard />}>
              <MeetingLogPage />
            </Suspense>
          }
        />
        <Route
          path="reviews"
          element={
            <Suspense fallback={<SkeletonDashboard />}>
              <PerformanceReviewPage />
            </Suspense>
          }
        />
        <Route
          path="overtime"
          element={
            <Suspense fallback={<SkeletonDashboard />}>
              <OvertimeTrackerPage />
            </Suspense>
          }
        />
        <Route
          path="payroll"
          element={
            <Suspense fallback={<SkeletonDashboard />}>
              <PayrollPage />
            </Suspense>
          }
        />
        <Route
          path="documents"
          element={
            <Suspense fallback={<SkeletonDashboard />}>
              <DocumentManagementPage />
            </Suspense>
          }
        />
        <Route
          path="training"
          element={
            <Suspense fallback={<SkeletonDashboard />}>
              <TrainingCertificationPage />
            </Suspense>
          }
        />
        <Route
          path="wfh-summary"
          element={
            <Suspense fallback={<SkeletonDashboard />}>
              <WFHSummaryPage />
            </Suspense>
          }
        />
        <Route
          path="resignation"
          element={
            <Suspense fallback={<SkeletonDashboard />}>
              <ResignationPage />
            </Suspense>
          }
        />
        <Route
          path="notifications"
          element={
            <Suspense fallback={<SkeletonDashboard />}>
              <NotificationsPage />
            </Suspense>
          }
        />
        {/* EMPLOYEE ROUTES */}
        <Route
          index
          element={
            <Suspense fallback={<SkeletonDashboard />}>
              <DashboardPage />
            </Suspense>
          }
        />
        <Route
          path="tasks"
          element={
            <Suspense fallback={<SkeletonDashboard />}>
              <TasksPage />
            </Suspense>
          }
        />
        <Route
          path="support"
          element={
            <Suspense fallback={<SkeletonDashboard />}>
              <SupportPage />
            </Suspense>
          }
        />
        <Route
          path="Goals"
          element={
            <Suspense fallback={<SkeletonDashboard />}>
              <GoalsWidget />
            </Suspense>
          }
        />
        <Route
          path="Goal history"
          element={
            <Suspense fallback={<SkeletonDashboard />}>
              <GoalHistoryPage />
            </Suspense>
          }
        />
        <Route
          path="history"
          element={
            <Suspense fallback={<SkeletonDashboard />}>
              <HistoryPage />
            </Suspense>
          }
        />
        <Route
          path="chat"
          element={
            <Suspense fallback={<SkeletonDashboard />}>
              <ChatPage />
            </Suspense>
          }
        />
        <Route
          path="analytics"
          element={
            <Suspense fallback={<SkeletonDashboard />}>
              <AnalyticsPage />
            </Suspense>
          }
        />
        <Route
          path="kudos"
          element={
            <Suspense fallback={<SkeletonDashboard />}>
              <KudosPage />
            </Suspense>
          }
        />
        <Route
          path="face-setup"
          element={
            <ProtectedRoute>
              <Suspense fallback={<SkeletonDashboard />}>
                <FaceSetupPage />
              </Suspense>
            </ProtectedRoute>
          }
        />
        <Route
          path="announcements"
          element={
            <Suspense fallback={<div className="p-8 text-slate-400">Loading…</div>}>
              <AnnouncementsPage />
            </Suspense>
          }
        />
        <Route
          path="leave"
          element={<LeaveManagementPage />}
        />
        <Route
          path="my-report"
          element={
            <Suspense fallback={<SkeletonDashboard />}>
              <MyReportPage />
            </Suspense>
          }
        />
        <Route
          path="security"
          element={
            <Suspense fallback={<SkeletonDashboard />}>
              <TwoFactorSettingsPage />
            </Suspense>
          }
        />
        <Route
          path="request"
          element={<WFHRequestPage />}
        />

        {/* ✅ EOD REPORT ROUTES - NEW */}
        <Route
          path="eod-reports"
          element={
            <Suspense fallback={<SkeletonDashboard />}>
              <EODReportPage />
            </Suspense>
          }
        />
        <Route
          path="my-eod-reviews"
          element={
            <Suspense fallback={<SkeletonDashboard />}>
              <MyEODReviewsPage />
            </Suspense>
          }
        />

        {/* MANAGER ROUTES */}
        <Route
          path="manager"
          element={
            <ManagerRoute>
              <Suspense fallback={<SkeletonDashboard />}>
                <ManagerDashboardPage />
              </Suspense>
            </ManagerRoute>
          }
        />
        <Route
          path="manager/wfh-dashboard"
          element={
            <ManagerRoute>
              <ManagerWFHDashboard />
            </ManagerRoute>
          }
        />
        <Route
          path="manager/eod-reviews"
          element={
            <ManagerRoute>
              <Suspense fallback={<SkeletonDashboard />}>
                <ManagerEODReviewPage />
              </Suspense>
            </ManagerRoute>
          }
        />
        <Route
            path="manager/assign-role"
            element={
              <ManagerRoute>
                <AssignRole />
              </ManagerRoute>
            }
          />
          <Route
          path="/manager/face-setup/:userId"
          element={
            <ManagerRoute>
              <Suspense fallback={<SkeletonDashboard />}>
                <FaceSetupPage />
              </Suspense>
            </ManagerRoute>
          }
        />
          <Route
          path="manager/user/:userId"
          element={
            <ManagerRoute>
              <Suspense fallback={<SkeletonDashboard />}>
                <UserDetailPage />
              </Suspense>
            </ManagerRoute>
          }
        />
          <Route
            path="manager/support-assignments"
            element={
              <ManagerRoute>
                <Suspense fallback={<div className="p-8 text-slate-400">Loading…</div>}>
                  <SupportAssignmentPage />
                </Suspense>
              </ManagerRoute>
            }
          />
      </Route>
      <Route path="/email-action" element={<EmailAction />} />
      <Route path="/wfh-email-action" element={<WFHEmailActionPage />} />

      {/* ─── 404 Route ───────────────────────────────────────────────────── */}
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
    <AiChatWidget />
    </>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN APP COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter
        future={{
    v7_startTransition: true,
    v7_relativeSplatPath: true,
  }}>
        <ThemeProvider>
          <ToastProvider>
            <AuthProvider>
              <SignalRProvider>
                <AppRoutes />
                <ToastContainer />
              </SignalRProvider>
            </AuthProvider>
          </ToastProvider>
        </ThemeProvider>
      </BrowserRouter>
      {(import.meta as any).env.DEV && <ReactQueryDevtools />}
    </QueryClientProvider>
  );
}

export default App;