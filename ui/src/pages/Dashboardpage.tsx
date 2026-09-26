// ─────────────────────────────────────────────────────────────────────────────
//  FILE: ui/src/pages/Dashboardpage.tsx
//  Employee Dashboard - Modern Design System Upgrade
//
//  Logic unchanged from previous version:
//  ✅ Location validation (useGeolocation) + locationError banner + WFH link
//  ✅ GPS requesting indicator
//  ✅ Face recognition (FaceVerifyModal) before check-in / check-out
//  ✅ Swal confirm before check-out
//  ✅ Breaks, EOD Report modal, TeamPresencePanel
//
//  Check-in flow:
//    Click Check In → FaceVerifyModal (optional) → GPS check → checkIn(lat, lng)
//  Check-out flow:
//    Click Check Out → FaceVerifyModal (optional) → Swal confirm → GPS check → checkOut(lat, lng)
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback } from 'react';
import { dashboardApi, dailyLogApi, breaksApi } from '../services/api';
import type { DashboardSummary, TaskLog } from '../types';
import { useAuth } from '../context/Authcontext';
import { useTheme } from '../context/ThemeContext';
import { SupportMediaDisplay } from '../components/SupportMediaDisplay';
import Swal from 'sweetalert2';
import { EODReportModal, TeamPresencePanel } from './Teamcomponents';
import { useGeolocation } from '../context/useGeolocation';
import { useNavigate } from 'react-router-dom';
import { FaceVerifyModal } from '../components/FaceVerifyModal';
import type { FaceVerifyResult } from '../hooks/useFaceRecognition';
import { PageHeader } from '../components/ui/PageHeader';
import { StatCard } from '../components/ui/StatCard';
import { Card, CardContent } from '../components/ui/Card';
import {
  LogIn,
  LogOut,
  Coffee,
  UtensilsCrossed,
  PauseCircle,
  CheckCircle2,
  Clock,
  Timer,
  ListChecks,
  LifeBuoy,
  MapPin,
  AlertTriangle,
  X,
  FileText,
  Sun,
  Loader2,
  Ban,
  RefreshCw,
  PauseOctagon,
  Home,
  Building2,
  ArrowRight,
  Activity,
} from 'lucide-react';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const formatISTTime = (dateString?: string) => {
  if (!dateString) return '--:--';
  const utcDate = new Date(dateString + 'Z');
  return utcDate.toLocaleTimeString('en-IN', {
    hour: '2-digit', minute: '2-digit',
    hour12: true, timeZone: 'Asia/Kolkata',
  });
};

const getGreeting = () => {
  const h = new Date().getHours();
  if (h < 12) return 'Good Morning';
  if (h < 17) return 'Good Afternoon';
  return 'Good Evening';
};

const WORKDAY_MINUTES = 480; // 8h target used for the progress bar

const TASK_STATUS_STYLE: Record<TaskLog['status'], { icon: React.ElementType; cls: string; label: string }> = {
  Completed:  { icon: CheckCircle2, label: 'Completed',   cls: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' },
  InProgress: { icon: RefreshCw,    label: 'In Progress', cls: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20' },
  Blocked:    { icon: Ban,          label: 'Blocked',     cls: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20' },
  OnHold:     { icon: PauseOctagon, label: 'On Hold',     cls: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20' },
};

const PRIORITY_STYLE: Record<string, string> = {
  High:   'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20',
  Medium: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
  Low:    'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20',
};

// ─── Loading Skeleton ─────────────────────────────────────────────────────────

const DashboardSkeleton = () => (
  <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
    <div className="pb-5 border-b border-slate-200 dark:border-slate-800/80 space-y-2">
      <div className="h-3 w-32 bg-slate-200 dark:bg-slate-800 rounded animate-pulse" />
      <div className="h-8 w-72 bg-slate-200 dark:bg-slate-800 rounded-lg animate-pulse" />
      <div className="h-4 w-48 bg-slate-200 dark:bg-slate-800 rounded animate-pulse" />
    </div>
    <div className="h-44 bg-slate-100 dark:bg-slate-800/60 rounded-3xl animate-pulse" />
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="h-28 bg-slate-100 dark:bg-slate-800/60 rounded-2xl animate-pulse" />
      ))}
    </div>
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 h-64 bg-slate-100 dark:bg-slate-800/60 rounded-2xl animate-pulse" />
      <div className="h-64 bg-slate-100 dark:bg-slate-800/60 rounded-2xl animate-pulse" />
    </div>
  </div>
);

// ─── Section Title ────────────────────────────────────────────────────────────

const SectionTitle = ({
  icon: Icon, title, subtitle, action,
}: {
  icon: React.ElementType; title: string; subtitle?: string; action?: React.ReactNode;
}) => (
  <div className="flex items-center justify-between gap-3 mb-4">
    <div className="flex items-center gap-2.5 min-w-0">
      <div className="p-2 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 shrink-0">
        <Icon className="w-4 h-4" />
      </div>
      <div className="min-w-0">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white truncate">{title}</h3>
        {subtitle && <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{subtitle}</p>}
      </div>
    </div>
    {action}
  </div>
);

// ─── Main Page ────────────────────────────────────────────────────────────────

export const DashboardPage = () => {
  const { user } = useAuth();
  const { isDark } = useTheme();
  const navigate = useNavigate();

  const [summary, setSummary]             = useState<DashboardSummary | null>(null);
  const [loading, setLoading]             = useState(true);
  const [actionLoading, setActionLoading] = useState('');
  const [locationError, setLocationError] = useState('');
  const [showEODModal, setShowEODModal]   = useState(false);

  // ── Face verification state ──────────────────────────────────────────────
  const [showFaceVerify, setShowFaceVerify] = useState(false);
  const [pendingAction, setPendingAction]   = useState<'checkin' | 'checkout' | null>(null);

  const geo = useGeolocation();

  // Swal colours follow the current theme
  const swalTheme = isDark
    ? { background: 'rgb(15, 23, 42)', color: '#ffffff' }
    : { background: '#ffffff', color: 'rgb(15, 23, 42)' };

  const load = useCallback(async () => {
    try {
      const res = await dashboardApi.getTodaySummary();
      setSummary(res.data);
    } catch {
      /* no log yet */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, 60000);
    return () => clearInterval(interval);
  }, [load]);

  // ── Step 1: Click Check In → open face modal ─────────────────────────────
  const handleCheckIn = () => {
    setLocationError('');
    setPendingAction('checkin');
    setShowFaceVerify(true);
  };

  // ── Step 1: Click Check Out → open face modal ────────────────────────────
  const handleCheckOut = () => {
    setLocationError('');
    setPendingAction('checkout');
    setShowFaceVerify(true);
  };

  // ── Step 2: Face modal done → run location + API ─────────────────────────
  // faceResult = FaceVerifyResult (matched/mismatch/skipped) or null (WFH / skipped)
  // In all cases we proceed — face is optional, location is required.
  const handleFaceVerifyComplete = async (_faceResult: FaceVerifyResult | null) => {
    setShowFaceVerify(false);

    // ── CHECK IN FLOW ──────────────────────────────────────────────────────
    if (pendingAction === 'checkin') {
      setPendingAction(null);
      setActionLoading('checkin');

      try {
        const coords = await geo.requestLocation();

        if (!coords) {
          if (geo.status === 'denied') {
            setLocationError(
              'Location permission denied. Please allow location in browser settings. ' +
              'If you are working from home, apply for a WFH request first.'
            );
          } else if (geo.status === 'outside') {
            setLocationError(
              `${geo.errorMessage} If you are working from home, apply for a WFH request first.`
            );
          } else {
            setLocationError('Could not get your location. Please try again.');
          }
          return;
        }

        await dailyLogApi.checkIn({
          dayStatus: 'Present',
          latitude:  coords.latitude,
          longitude: coords.longitude,
        });

        await load();

      } catch (err: any) {
        if (err?.response?.status === 403) {
          setLocationError(err.response.data?.message);
        } else {
          setLocationError('Check-in failed. Please try again.');
        }
      } finally {
        setActionLoading('');
      }
    }

    // ── CHECK OUT FLOW ─────────────────────────────────────────────────────
    if (pendingAction === 'checkout') {
      setPendingAction(null);

      // Swal confirm comes AFTER face verify, before location check
      const confirmed = await Swal.fire({
        title: 'Ready to check out?',
        text:  'Are you sure you want to check out for today?',
        icon:  'question',
        ...swalTheme,
        iconColor: '#3b82f6',
        showCancelButton:   true,
        confirmButtonColor: '#3b82f6',
        cancelButtonColor:  '#94a3b8',
        confirmButtonText:  'Yes, check out',
        cancelButtonText:   'Cancel',
        customClass: { popup: 'font-sans rounded-2xl' },
      });

      if (!confirmed.isConfirmed) return;

      setActionLoading('checkout');

      try {
        const coords = await geo.requestLocation();

        if (!coords) {
          if (geo.status === 'denied') {
            setLocationError('Location permission denied. Cannot check out without location verification.');
          } else if (geo.status === 'outside') {
            setLocationError(geo.errorMessage ?? 'You are outside the office location.');
          } else {
            setLocationError('Could not get your location. Please try again.');
          }
          return;
        }

        await dailyLogApi.checkOut({
          latitude:  coords.latitude,
          longitude: coords.longitude,
        });

        await load();

        Swal.fire({
          title: 'Checked Out!',
          text:  'Have a great rest of your day.',
          icon:  'success',
          ...swalTheme,
          iconColor: '#10b981',
          timer: 2000,
          showConfirmButton: false,
          customClass: { popup: 'font-sans rounded-2xl' },
        });

      } catch (err: any) {
        if (err?.response?.status === 403) {
          setLocationError(err.response.data?.message);
        } else {
          setLocationError('Check-out failed. Please try again.');
        }
      } finally {
        setActionLoading('');
      }
    }
  };

  // ── Face modal cancelled → reset state ──────────────────────────────────
  const handleFaceCancel = () => {
    setShowFaceVerify(false);
    setPendingAction(null);
  };

  // ── Break handler ────────────────────────────────────────────────────────
  const handleBreak = async (type: string) => {
    setActionLoading(`break-${type}`);
    try {
      if (summary?.hasActiveBreak && summary.activeBreak) {
        await breaksApi.endBreak(summary.activeBreak.id);
      } else {
        await breaksApi.startBreak(type);
      }
      await load();
    } finally {
      setActionLoading('');
    }
  };

  if (loading) return <DashboardSkeleton />;

  const log            = summary?.todayLog;
  const isCheckedIn    = summary?.isCheckedIn ?? false;
  const isCheckedOut   = !!log?.checkOutTime;
  const hasActiveBreak = summary?.hasActiveBreak ?? false;
  const isWFH          = log?.dayStatus === 'WFH';
  const tasks          = log?.tasks ?? [];
  const supportLogs    = log?.supportLogs ?? [];
  const workPercent    = Math.min(((log?.totalWorkMinutes ?? 0) / WORKDAY_MINUTES) * 100, 100);
  const gpsBusy        = geo.status === 'requesting';

  // Header status badge
  const statusBadge = !isCheckedIn
    ? { label: 'Not Checked In', variant: 'slate' as const, icon: <Clock className="w-3 h-3" /> }
    : isCheckedOut
      ? { label: 'Day Completed', variant: 'blue' as const, icon: <CheckCircle2 className="w-3 h-3" /> }
      : hasActiveBreak
        ? { label: 'On Break', variant: 'amber' as const, icon: <Coffee className="w-3 h-3" /> }
        : { label: 'Active', variant: 'emerald' as const, icon: <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">

      {/* ── Face Verify Modal ────────────────────────────────────────────── */}
      {showFaceVerify && pendingAction && (
        <FaceVerifyModal
          action={pendingAction === 'checkin' ? 'CheckIn' : 'CheckOut'}
          isWFH={isWFH}
          onSuccess={handleFaceVerifyComplete}
          onCancel={handleFaceCancel}
        />
      )}

      {/* ── Page Header ──────────────────────────────────────────────────── */}
      <PageHeader
        title={`${getGreeting()}, ${user?.fullName?.split(' ')[0] ?? ''}! 👋`}
        description={new Date().toLocaleDateString('en-IN', {
          weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
        })}
        breadcrumbs={[
          { label: 'Workspace', href: '/' },
          { label: 'Dashboard' },
        ]}
        badge={statusBadge}
        actions={
          <button
            type="button"
            onClick={() => setShowEODModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-500/20 transition cursor-pointer"
          >
            <FileText className="w-4 h-4" />
            <span>Submit EOD Report</span>
          </button>
        }
        className="!mb-0"
      />

      {/* ── Location Error Banner ────────────────────────────────────────── */}
      {locationError && (
        <div className="flex items-start gap-3 px-4 py-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/20">
          <div className="p-1.5 rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400 shrink-0">
            <MapPin className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-rose-700 dark:text-rose-300">Location check failed</p>
            <p className="text-sm text-rose-600 dark:text-rose-400 mt-0.5">{locationError}</p>
            {locationError.includes('working from home') && (
              <button
                onClick={() => navigate('/request')}
                className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-500 transition"
              >
                <Home className="w-3.5 h-3.5" />
                Apply for WFH Request
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <button
            onClick={() => setLocationError('')}
            className="p-1 rounded-lg text-rose-500/70 hover:text-rose-600 dark:hover:text-rose-300 hover:bg-rose-500/10 transition shrink-0"
            aria-label="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ── GPS requesting indicator ─────────────────────────────────────── */}
      {gpsBusy && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-blue-500/10 border border-blue-500/20">
          <Loader2 className="w-4 h-4 text-blue-600 dark:text-blue-400 animate-spin shrink-0" />
          <p className="text-sm font-medium text-blue-700 dark:text-blue-300">Getting your location…</p>
        </div>
      )}

      {/* ── Attendance Hero Card ─────────────────────────────────────────── */}
      <Card className="relative overflow-hidden !rounded-3xl">
        <div className="absolute -top-24 -right-24 w-64 h-64 bg-gradient-to-br from-blue-500/15 via-indigo-500/10 to-transparent rounded-full blur-2xl pointer-events-none" />
        <CardContent className="relative z-10">
          <div className="flex flex-col lg:flex-row lg:items-center gap-6">

            {/* Left: status + actions */}
            <div className="flex-1 min-w-0 space-y-4">
              <div className="flex items-center gap-3">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border ${
                  !isCheckedIn
                    ? 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20'
                    : isCheckedOut
                      ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20'
                      : hasActiveBreak
                        ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
                        : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                }`}>
                  {!isCheckedIn ? <Sun className="w-6 h-6" />
                    : isCheckedOut ? <CheckCircle2 className="w-6 h-6" />
                    : hasActiveBreak ? <Coffee className="w-6 h-6" />
                    : <Activity className="w-6 h-6" />}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Today's Attendance
                  </p>
                  <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white truncate">
                    {!isCheckedIn
                      ? 'Ready to start your day?'
                      : isCheckedOut
                        ? `Day completed at ${formatISTTime(log?.checkOutTime)}`
                        : hasActiveBreak
                          ? `On ${summary?.activeBreak?.breakType} break · ${summary?.activeBreak?.durationMinutes}m`
                          : `Working since ${formatISTTime(log?.checkInTime)}`}
                  </h2>
                  {isCheckedIn && log?.dayStatus && (
                    <span className="inline-flex items-center gap-1 mt-1 text-[11px] font-semibold px-2 py-0.5 rounded-full border bg-slate-500/5 text-slate-600 dark:text-slate-300 border-slate-500/20">
                      {isWFH ? <Home className="w-3 h-3" /> : <Building2 className="w-3 h-3" />}
                      {log.dayStatus}
                    </span>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap gap-2.5">
                {!isCheckedIn ? (
                  <button
                    onClick={handleCheckIn}
                    disabled={actionLoading === 'checkin' || gpsBusy}
                    className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold px-6 py-3 rounded-xl shadow-lg shadow-emerald-500/25 transition cursor-pointer"
                  >
                    {actionLoading === 'checkin'
                      ? <Loader2 className="w-4 h-4 animate-spin" />
                      : <LogIn className="w-4 h-4" />}
                    {actionLoading === 'checkin' ? 'Checking in…' : 'Check In'}
                  </button>
                ) : !isCheckedOut ? (
                  <>
                    {!hasActiveBreak ? (
                      <>
                        <button
                          onClick={() => handleBreak('Lunch')}
                          disabled={!!actionLoading}
                          className="inline-flex items-center gap-2 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-700 dark:text-amber-400 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-semibold px-4 py-3 rounded-xl transition cursor-pointer"
                        >
                          {actionLoading === 'break-Lunch'
                            ? <Loader2 className="w-4 h-4 animate-spin" />
                            : <UtensilsCrossed className="w-4 h-4" />}
                          Lunch Break
                        </button>
                        <button
                          onClick={() => handleBreak('Tea')}
                          disabled={!!actionLoading}
                          className="inline-flex items-center gap-2 bg-orange-500/10 hover:bg-orange-500/20 border border-orange-500/30 text-orange-700 dark:text-orange-400 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-semibold px-4 py-3 rounded-xl transition cursor-pointer"
                        >
                          {actionLoading === 'break-Tea'
                            ? <Loader2 className="w-4 h-4 animate-spin" />
                            : <Coffee className="w-4 h-4" />}
                          Tea Break
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => handleBreak('')}
                        disabled={!!actionLoading}
                        className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold px-4 py-3 rounded-xl shadow-md shadow-blue-500/20 transition cursor-pointer"
                      >
                        {actionLoading.startsWith('break-')
                          ? <Loader2 className="w-4 h-4 animate-spin" />
                          : <PauseCircle className="w-4 h-4" />}
                        End {summary?.activeBreak?.breakType} Break
                        <span className="px-1.5 py-0.5 rounded-md bg-white/20 text-xs">
                          {summary?.activeBreak?.durationMinutes}m
                        </span>
                      </button>
                    )}
                    <button
                      onClick={handleCheckOut}
                      disabled={!!actionLoading || gpsBusy}
                      className="inline-flex items-center gap-2 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold px-5 py-3 rounded-xl shadow-lg shadow-rose-500/20 transition cursor-pointer"
                    >
                      {actionLoading === 'checkout'
                        ? <Loader2 className="w-4 h-4 animate-spin" />
                        : <LogOut className="w-4 h-4" />}
                      {actionLoading === 'checkout' ? 'Checking out…' : 'Check Out'}
                    </button>
                  </>
                ) : (
                  <div className="inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-sm font-medium px-4 py-3 rounded-xl">
                    <CheckCircle2 className="w-4 h-4" />
                    Great work today! See you tomorrow.
                  </div>
                )}
              </div>
            </div>

            {/* Right: today's timeline */}
            <div className="lg:w-[380px] shrink-0 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Today's Timeline
                </p>
                <span className="text-xs font-bold text-slate-900 dark:text-white">
                  {Math.round(workPercent)}%
                  <span className="font-medium text-slate-500 dark:text-slate-400"> of 8h</span>
                </span>
              </div>

              <div className="h-2.5 w-full rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-blue-600 via-indigo-500 to-violet-500 transition-all duration-700"
                  style={{ width: `${workPercent}%` }}
                />
              </div>

              <div className="flex items-center justify-between mt-3 text-xs">
                <div>
                  <p className="text-slate-500 dark:text-slate-400">In</p>
                  <p className="font-bold text-slate-900 dark:text-white">{formatISTTime(log?.checkInTime)}</p>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-300 dark:text-slate-600" />
                <div className="text-right">
                  <p className="text-slate-500 dark:text-slate-400">Out</p>
                  <p className="font-bold text-slate-900 dark:text-white">
                    {log?.checkOutTime ? formatISTTime(log.checkOutTime) : isCheckedIn ? 'Now' : '--:--'}
                  </p>
                </div>
              </div>

              <div className="flex gap-4 mt-3 pt-3 border-t border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400">
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 bg-blue-500 rounded-full" /> Work: {log?.workHours ?? '0h 0m'}
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 bg-amber-500 rounded-full" /> Breaks: {log?.totalBreakMinutes ?? 0}m
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Stats ────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Check In"
          value={formatISTTime(log?.checkInTime)}
          subtitle={log?.dayStatus ?? 'Not checked in'}
          icon={LogIn}
          color="emerald"
        />
        <StatCard
          title="Work Hours"
          value={summary?.netWorkHours ?? '0h 0m'}
          subtitle="Net of breaks"
          icon={Timer}
          color="blue"
        />
        <StatCard
          title="Tasks Done"
          value={`${summary?.tasksCompleted ?? 0} / ${(summary?.tasksCompleted ?? 0) + (summary?.tasksInProgress ?? 0)}`}
          subtitle={`${summary?.tasksInProgress ?? 0} in progress`}
          icon={ListChecks}
          color="purple"
          onClick={() => navigate('/tasks')}
        />
        <StatCard
          title="Support Given"
          value={summary?.totalSupportGiven ?? 0}
          subtitle="developers helped"
          icon={LifeBuoy}
          color="amber"
          onClick={() => navigate('/support')}
        />
      </div>

      {/* ── Tasks + Support ──────────────────────────────────────────────── */}
      {isCheckedIn && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Today's Tasks */}
          <Card className="lg:col-span-2">
            <CardContent>
              <SectionTitle
                icon={ListChecks}
                title="Today's Tasks"
                subtitle={`${tasks.length} total`}
                action={
                  <button
                    onClick={() => navigate('/tasks')}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-500 transition shrink-0"
                  >
                    View all <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                }
              />

              {tasks.length === 0 ? (
                <div className="text-center py-10 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800">
                  <ListChecks className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-600" />
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 mt-2">No tasks logged yet</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Log your first task to track today's progress</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {tasks.slice(0, 5).map((task) => {
                    const st = TASK_STATUS_STYLE[task.status] ?? TASK_STATUS_STYLE.InProgress;
                    const StIcon = st.icon;
                    return (
                      <div
                        key={task.id}
                        className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 hover:border-slate-200 dark:hover:border-slate-700 transition"
                      >
                        <div className={`p-2 rounded-lg border shrink-0 ${st.cls}`} title={st.label}>
                          <StIcon className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">{task.taskTitle}</p>
                          {task.projectName && (
                            <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{task.projectName}</p>
                          )}
                        </div>
                        <span className="hidden sm:inline-flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400 shrink-0">
                          <Clock className="w-3.5 h-3.5" /> {task.timeSpentMinutes}m
                        </span>
                        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border shrink-0 ${PRIORITY_STYLE[task.priority] ?? PRIORITY_STYLE.Low}`}>
                          {task.priority}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Support Given Today */}
          <Card>
            <CardContent>
              <SectionTitle
                icon={LifeBuoy}
                title="Support Given Today"
                subtitle={`${supportLogs.length} session${supportLogs.length === 1 ? '' : 's'}`}
              />

              {supportLogs.length === 0 ? (
                <div className="text-center py-10 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800">
                  <LifeBuoy className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-600" />
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 mt-2">No support logged</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Helped a teammate? Log it on the Support page</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {supportLogs.map((s) => (
                    <div
                      key={s.id}
                      className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800"
                    >
                      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-violet-500 to-pink-500 flex items-center justify-center text-xs font-bold text-white shrink-0">
                        {s.supportedDeveloperName.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">{s.supportedDeveloperName}</p>
                          <span className="text-xs text-slate-500 dark:text-slate-400 shrink-0">{s.timeSpentMinutes}m</span>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">{s.issueDescription}</p>
                        {s.media && s.media.length > 0 && <SupportMediaDisplay media={s.media} />}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Not checked in: getting-started hint ─────────────────────────── */}
      {!isCheckedIn && (
        <div className="text-center py-12 px-4 rounded-3xl border-2 border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
            <Sun className="w-7 h-7 text-amber-500" />
          </div>
          <p className="text-base font-bold text-slate-900 dark:text-white mt-3">Ready to start your day?</p>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Click <span className="font-semibold text-emerald-600 dark:text-emerald-400">Check In</span> to begin tracking your work
          </p>
          <p className="inline-flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 mt-3">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
            Working from home? Apply for a WFH request before checking in.
          </p>
        </div>
      )}

      {/* ── Team Presence ────────────────────────────────────────────────── */}
      <TeamPresencePanel />

      <EODReportModal open={showEODModal} onClose={() => setShowEODModal(false)} />
    </div>
  );
};
