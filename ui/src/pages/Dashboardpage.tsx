// ─────────────────────────────────────────────────────────────────────────────
//  FILE: daily-tracker-ui/src/pages/Dashboardpage.tsx
//  ACTION: REPLACE entire file
//
//  Merges:
//  ✅ Location validation (useGeolocation) — unchanged from your current file
//  ✅ locationError banner + WFH link — unchanged
//  ✅ GPS requesting indicator — unchanged
//  ✅ EOD Report modal — unchanged
//  ✅ TeamPresencePanel — unchanged
//  ✅ Face recognition — properly wired in
//
//  New check-in flow:
//    Click Check In
//      → FaceVerifyModal opens (optional, can skip)
//      → After verify/skip → GPS location check runs
//      → If location OK → checkIn(lat, lng)
//      → If location fails → show locationError banner
//
//  New check-out flow:
//    Click Check Out
//      → FaceVerifyModal opens (optional, can skip)
//      → After verify/skip → Swal confirm dialog
//      → After confirm → GPS location check runs
//      → If location OK → checkOut(lat, lng)
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback } from 'react';
import { dashboardApi, dailyLogApi, breaksApi } from '../services/api';
import { DashboardSummary } from '../types';
import { useAuth } from '../context/Authcontext';
import { SupportMediaDisplay } from '../components/SupportMediaDisplay';
import Swal from 'sweetalert2';
import { EODReportModal, TeamPresencePanel } from './Teamcomponents';
import { useGeolocation } from '../context/useGeolocation';
import { useNavigate } from 'react-router-dom';
import { FaceVerifyModal } from '../components/FaceVerifyModal';
import type { FaceVerifyResult } from '../hooks/useFaceRecognition';

const formatISTTime = (dateString?: string) => {
  if (!dateString) return '--:--';
  const utcDate = new Date(dateString + 'Z');
  return utcDate.toLocaleTimeString('en-IN', {
    hour: '2-digit', minute: '2-digit',
    hour12: true, timeZone: 'Asia/Kolkata',
  });
};

const StatCard = ({ label, value, sub, color }: {
  label: string; value: string | number; sub?: string; color: string;
}) => (
  <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
    <p className="text-slate-400 text-sm font-medium mb-1">{label}</p>
    <p className={`text-3xl font-bold ${color}`}>{value}</p>
    {sub && <p className="text-slate-500 text-xs mt-1">{sub}</p>}
  </div>
);

const TimelineBar = ({ summary }: { summary: DashboardSummary }) => {
  const log = summary.todayLog;
  if (!log?.checkInTime) return null;
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 mt-4">
      <h3 className="text-sm font-semibold text-slate-300 mb-4">Today's Timeline</h3>
      <div className="relative h-10">
        <div className="absolute inset-0 bg-slate-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-blue-600 to-blue-500 rounded-full"
            style={{ width: `${Math.min((log.totalWorkMinutes / 480) * 100, 100)}%` }}
          />
        </div>
        <div className="absolute inset-0 flex items-center px-4">
          <span className="text-xs text-white font-medium">
            {formatISTTime(log.checkInTime)}
            {' → '}
            {log.checkOutTime ? formatISTTime(log.checkOutTime) : 'Now'}
          </span>
        </div>
      </div>
      <div className="flex gap-4 mt-3 text-xs text-slate-500">
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 bg-blue-500 rounded-full" /> Work: {log.workHours}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 bg-amber-500 rounded-full" /> Breaks: {log.totalBreakMinutes}m
        </span>
      </div>
    </div>
  );
};

// ─── Main Page ─────────────────────────────────────────────────────────────────

export const DashboardPage = () => {
  const { user } = useAuth();
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
  const handleFaceVerifyComplete = async (faceResult: FaceVerifyResult | null) => {
    setShowFaceVerify(false);

    // ── CHECK IN FLOW ──────────────────────────────────────────────────────
    if (pendingAction === 'checkin') {
      setPendingAction(null);
      setActionLoading('checkin');

      try {
        // Get GPS location
        const coords = await geo.requestLocation();

        if (!coords) {
          if (geo.status === 'denied') {
            setLocationError(
              '📍 Location permission denied. Please allow location in browser settings. ' +
              'If you are working from home, apply for a WFH request first.'
            );
          } else if (geo.status === 'outside') {
            setLocationError(
              `📍 ${geo.errorMessage} If you are working from home, apply for a WFH request first.`
            );
          } else {
            setLocationError('📍 Could not get your location. Please try again.');
          }
          return;
        }

        // Check in with coordinates
        await dailyLogApi.checkIn({
          dayStatus: 'Present',
          latitude:  coords.latitude,
          longitude: coords.longitude,
        });

        await load();

      } catch (err: any) {
        if (err?.response?.status === 403) {
          setLocationError(`📍 ${err.response.data?.message}`);
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
        background: 'rgb(15, 23, 42)',
        color: '#ffffff',
        iconColor: '#3b82f6',
        showCancelButton:   true,
        confirmButtonColor: '#3b82f6',
        cancelButtonColor:  '#94a3b8',
        confirmButtonText:  'Yes, check out',
        cancelButtonText:   'Cancel',
        customClass: { popup: 'font-sans rounded-lg' },
      });

      if (!confirmed.isConfirmed) return;

      setActionLoading('checkout');

      try {
        // Get GPS location
        const coords = await geo.requestLocation();

        if (!coords) {
          if (geo.status === 'denied') {
            setLocationError('📍 Location permission denied. Cannot check out without location verification.');
          } else if (geo.status === 'outside') {
            setLocationError(`📍 ${geo.errorMessage}`);
          } else {
            setLocationError('📍 Could not get your location. Please try again.');
          }
          return;
        }

        // Check out with coordinates
        await dailyLogApi.checkOut({
          latitude:  coords.latitude,
          longitude: coords.longitude,
        });

        await load();

        Swal.fire({
          title: 'Checked Out!',
          text:  'Have a great rest of your day.',
          icon:  'success',
          background: 'rgb(15, 23, 42)',
          color: '#ffffff',
          iconColor: '#3b82f6',
          timer: 2000,
          showConfirmButton: false,
        });

      } catch (err: any) {
        if (err?.response?.status === 403) {
          setLocationError(`📍 ${err.response.data?.message}`);
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

  // ── Break handler (unchanged) ────────────────────────────────────────────
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

  const getGreeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good Morning';
    if (h < 17) return 'Good Afternoon';
    return 'Good Evening';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const isCheckedIn    = summary?.isCheckedIn ?? false;
  const isCheckedOut   = !!summary?.todayLog?.checkOutTime;
  const hasActiveBreak = summary?.hasActiveBreak ?? false;
  const isWFH          = summary?.todayLog?.dayStatus === 'WFH';

  return (
    <div className="p-6 max-w-5xl mx-auto">

      {/* ── Face Verify Modal ────────────────────────────────────────────── */}
      {showFaceVerify && pendingAction && (
        <FaceVerifyModal
          action={pendingAction === 'checkin' ? 'CheckIn' : 'CheckOut'}
          isWFH={isWFH}
          onSuccess={handleFaceVerifyComplete}
          onCancel={handleFaceCancel}
        />
      )}

      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">
              {getGreeting()}, {user?.fullName?.split(' ')[0]}! 👋
            </h1>
            <p className="text-slate-400 text-sm mt-1">
              {new Date().toLocaleDateString('en-IN', {
                weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
              })}
            </p>
          </div>
          {isCheckedIn && !isCheckedOut && (
            <span className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 px-4 py-2 rounded-full text-sm font-medium">
              <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
              Active
            </span>
          )}
        </div>
      </div>

      {/* ── Location Error Banner ────────────────────────────────────────── */}
      {locationError && (
        <div className="mb-4 flex items-start gap-3 px-4 py-3 bg-red-500/10 border border-red-500/30 rounded-xl">
          <div className="flex-1">
            <p className="text-red-400 text-sm">{locationError}</p>
            {locationError.includes('working from home') && (
              <button
                onClick={() => navigate('/request')}
                className="mt-2 text-xs text-blue-400 hover:text-blue-300 underline"
              >
                → Apply for WFH Request
              </button>
            )}
          </div>
          <button
            onClick={() => setLocationError('')}
            className="text-red-400/60 hover:text-red-400 text-lg leading-none"
          >
            ✕
          </button>
        </div>
      )}

      {/* GPS requesting indicator */}
      {geo.status === 'requesting' && (
        <div className="mb-4 flex items-center gap-3 px-4 py-3 bg-blue-500/10 border border-blue-500/30 rounded-xl">
          <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin shrink-0" />
          <p className="text-blue-400 text-sm">Getting your location…</p>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-3 mb-6">
        {!isCheckedIn ? (
          <button
            onClick={handleCheckIn}
            disabled={actionLoading === 'checkin' || geo.status === 'requesting'}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold px-6 py-3 rounded-xl shadow-lg shadow-emerald-500/25 transition-all duration-200"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
            </svg>
            {actionLoading === 'checkin' ? 'Checking in...' : 'Check In'}
          </button>
        ) : !isCheckedOut ? (
          <>
            {!hasActiveBreak ? (
              <>
                <button
                  onClick={() => handleBreak('Lunch')}
                  disabled={!!actionLoading}
                  className="flex items-center gap-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white font-semibold px-5 py-3 rounded-xl transition-all duration-200"
                >
                  🍱 Lunch Break
                </button>
                <button
                  onClick={() => handleBreak('Tea')}
                  disabled={!!actionLoading}
                  className="flex items-center gap-2 bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white font-semibold px-5 py-3 rounded-xl transition-all duration-200"
                >
                  ☕ Tea Break
                </button>
              </>
            ) : (
              <button
                onClick={() => handleBreak('')}
                disabled={!!actionLoading}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold px-5 py-3 rounded-xl animate-pulse transition-all duration-200"
              >
                ⏸ End {summary?.activeBreak?.breakType} Break ({summary?.activeBreak?.durationMinutes}m)
              </button>
            )}
            <button
              onClick={handleCheckOut}
              disabled={!!actionLoading || geo.status === 'requesting'}
              className="flex items-center gap-2 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-semibold px-5 py-3 rounded-xl shadow-lg shadow-red-500/20 transition-all duration-200"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              {actionLoading === 'checkout' ? 'Checking out...' : 'Check Out'}
            </button>
          </>
        ) : (
          <div className="flex items-center gap-2 bg-slate-800 border border-slate-700 text-slate-400 px-5 py-3 rounded-xl text-sm">
            ✅ Day completed! Checked out at{' '}
            {summary?.todayLog?.checkOutTime ? formatISTTime(summary.todayLog.checkOutTime) : ''}
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="Check In"
          value={summary?.todayLog?.checkInTime ? formatISTTime(summary.todayLog.checkInTime) : '--:--'}
          sub={summary?.todayLog?.dayStatus}
          color="text-emerald-400"
        />
        <StatCard
          label="Work Hours"
          value={summary?.netWorkHours ?? '0h 0m'}
          sub="Net of breaks"
          color="text-blue-400"
        />
        <StatCard
          label="Tasks Done"
          value={`${summary?.tasksCompleted ?? 0} / ${(summary?.tasksCompleted ?? 0) + (summary?.tasksInProgress ?? 0)}`}
          sub={`${summary?.tasksInProgress ?? 0} in progress`}
          color="text-violet-400"
        />
        <StatCard
          label="Support Given"
          value={summary?.totalSupportGiven ?? 0}
          sub="developers helped"
          color="text-amber-400"
        />
      </div>

      {/* Timeline */}
      <TimelineBar summary={summary ?? {
        isCheckedIn: false, hasActiveBreak: false,
        tasksCompleted: 0, tasksInProgress: 0,
        totalSupportGiven: 0, netWorkMinutes: 0, netWorkHours: '0h 0m',
      }} />

      {/* Recent Tasks */}
      {summary?.todayLog?.tasks && summary.todayLog.tasks.length > 0 && (
        <div className="mt-6 bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-slate-300">Today's Tasks</h3>
            <span className="text-xs text-slate-500">{summary.todayLog.tasks.length} total</span>
          </div>
          <div className="space-y-2">
            {summary.todayLog.tasks.slice(0, 5).map(task => (
              <div key={task.id} className="flex items-center gap-3 p-3 bg-slate-800/50 rounded-xl">
                <span className="text-lg">
                  {task.status === 'Completed' ? '✅' : task.status === 'Blocked' ? '🚫' : '🔄'}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white font-medium truncate">{task.taskTitle}</p>
                  {task.projectName && <p className="text-xs text-slate-500">{task.projectName}</p>}
                </div>
                <span className="text-xs text-slate-500 flex-shrink-0">{task.timeSpentMinutes}m</span>
                <span className={`text-xs px-2 py-1 rounded-lg flex-shrink-0 ${
                  task.priority === 'High'   ? 'bg-red-500/20 text-red-400'     :
                  task.priority === 'Medium' ? 'bg-amber-500/20 text-amber-400' :
                  'bg-slate-700 text-slate-400'
                }`}>{task.priority}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Support */}
      {summary?.todayLog?.supportLogs && summary.todayLog.supportLogs.length > 0 && (
        <div className="mt-4 bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <h3 className="text-sm font-semibold text-slate-300 mb-4">Support Given Today</h3>
          <div className="space-y-2">
            {summary.todayLog.supportLogs.map(s => (
              <div key={s.id} className="flex items-start gap-3 p-3 bg-slate-800/50 rounded-xl">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-pink-500 flex items-center justify-center text-xs font-bold flex-shrink-0">
                  {s.supportedDeveloperName.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white font-medium">{s.supportedDeveloperName}</p>
                  <p className="text-xs text-slate-400 truncate">{s.issueDescription}</p>
                  {s.media && s.media.length > 0 && <SupportMediaDisplay media={s.media} />}
                </div>
                <span className="text-xs text-slate-500">{s.timeSpentMinutes}m</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {!isCheckedIn && (
        <div className="mt-8 text-center py-12 border-2 border-dashed border-slate-800 rounded-2xl">
          <div className="text-4xl mb-3">☀️</div>
          <p className="text-slate-300 font-semibold">Ready to start your day?</p>
          <p className="text-slate-500 text-sm mt-1">Click "Check In" to begin tracking your work</p>
        </div>
      )}

      {/* EOD Report */}
      <div className="flex justify-between items-center mb-6 p-2">
        <button
          onClick={() => setShowEODModal(true)}
          className="bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-semibold px-6 py-3 rounded-xl transition flex items-center gap-2 shadow-lg"
        >
          📝 Submit EOD Report
        </button>
      </div>

      {/* Team Presence */}
      <div className="mt-4">
        <TeamPresencePanel />
      </div>

      <EODReportModal open={showEODModal} onClose={() => setShowEODModal(false)} />
    </div>
  );
};