import { useEffect, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { goalsApi, notifApi } from '../services/api';
import { AppNotification, GoalProgress } from '../types';
import { useToast } from '../context/ToastContext';
import { useSignalR } from '../context/SignalRContext';
import { useLocation, useNavigate } from 'react-router-dom';

// ═══════════════════════════════════════════════════════════════════════════════
//  Feature 4: Goals & Productivity Score Widget
//
//  CHANGES FROM YOUR ORIGINAL (all marked ── ADDED / CHANGED ──):
//
//  1. Added `targetSupport` state (default 3)
//  2. Added targetSupportGiven to the setGoal mutation payload
//  3. Added input field in editMode for support target
//
//  The progress bar for Support was already in your original JSX — it just
//  needed the backend to return the data AND the form to save the target.
//  These 3 changes complete the loop.
//
//  Everything else is identical to your original.
// ═══════════════════════════════════════════════════════════════════════════════
export const GoalsWidget = () => {
  const [editMode, setEditMode] = useState(false);
  const [targetHours, setTargetHours] = useState(8);
  const [targetTasks, setTargetTasks] = useState(5);

  // ── ADDED: support target state ──────────────────────────────────────────
  const [targetSupport, setTargetSupport] = useState(3);

  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: progress, isLoading } = useQuery<GoalProgress>({
    queryKey: ['goalProgress'],
    queryFn: () => goalsApi.getProgress().then(r => r.data),
    refetchInterval: 60_000,
  });

  const setGoal = useMutation({
    mutationFn: () => goalsApi.setGoal({
      targetWorkMinutes:    targetHours * 60,
      targetTasksCompleted: targetTasks,
      targetBreakMinutes:   60,
      // ── ADDED: include support target in payload ──────────────────────────
      targetSupportGiven:   targetSupport,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['goalProgress'] });
      toast.success('Goals updated!');
      setEditMode(false);
    }
  });

  const gradeColors: Record<string, string> = {
    A: 'text-emerald-400', B: 'text-blue-400', C: 'text-amber-400', D: 'text-red-400'
  };

  if (isLoading) return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 animate-pulse">
      <div className="h-4 bg-slate-800 rounded w-24 mb-4" />
      <div className="h-20 bg-slate-800 rounded-xl" />
    </div>
  );

  const p = progress!;

  const ProgressBar = ({ value, color }: { value: number; color: string }) => (
    <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
      <div
        className={`h-full rounded-full transition-all duration-700 ${color}`}
        style={{ width: `${Math.min(value, 100)}%` }}
      />
    </div>
  );

  return (
    <>
      <div className="flex items-center justify-center min-h-screen bg-slate-950">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 w-full max-w-2xl">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              🎯 Today's Goals
            </h3>
            <div className="flex items-center gap-2">
              <span className={`text-2xl font-bold ${gradeColors[p?.scoreGrade] ?? 'text-slate-400'}`}>
                {p?.scoreGrade}
              </span>
              <span className="text-xs text-slate-500">{p?.productivityScore}%</span>
              <button
                onClick={() => setEditMode(!editMode)}
                className="text-xs text-slate-400 hover:text-blue-400 transition px-2 py-1 rounded-lg hover:bg-slate-800"
              >
                {editMode ? 'Cancel' : '✏️ Edit'}
              </button>
            </div>
          </div>

          {editMode ? (
            <div className="space-y-3">
              <div>
                <label className="text-xs text-slate-400">Target Work Hours</label>
                <input
                  type="number" value={targetHours}
                  onChange={e => setTargetHours(+e.target.value)}
                  min={1} max={12}
                  className="w-full mt-1 bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400">Target Tasks to Complete</label>
                <input
                  type="number" value={targetTasks}
                  onChange={e => setTargetTasks(+e.target.value)}
                  min={1} max={20}
                  className="w-full mt-1 bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* ── ADDED: support target input ───────────────────────────── */}
              <div>
                <label className="text-xs text-slate-400">Target Support Logs</label>
                <input
                  type="number" value={targetSupport}
                  onChange={e => setTargetSupport(+e.target.value)}
                  min={0} max={20}
                  className="w-full mt-1 bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              {/* ─────────────────────────────────────────────────────────── */}

              <button
                onClick={() => setGoal.mutate()}
                disabled={setGoal.isPending}
                className="w-full bg-blue-600 hover:bg-blue-500 text-white py-2 rounded-xl text-sm font-medium transition disabled:opacity-50"
              >
                {setGoal.isPending ? 'Saving...' : 'Save Goals'}
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {[
                {
                  label:  'Work Hours',
                  pct:    p?.workProgress,
                  actual: `${Math.round((p?.actualWorkMinutes ?? 0) / 60 * 10) / 10}h`,
                  target: `${Math.round((p?.goal.targetWorkMinutes ?? 480) / 60)}h`,
                  color:  'bg-blue-500'
                },
                {
                  label:  'Tasks Done',
                  pct:    p?.taskProgress,
                  actual: p?.actualTasksCompleted?.toString(),
                  target: p?.goal.targetTasksCompleted?.toString(),
                  color:  'bg-emerald-500'
                },
                {
                  // ── This bar was already in your JSX — now it has real data ──
                  label:  'Support Given',
                  pct:    p?.supportProgress,
                  actual: p?.actualSupportGiven?.toString(),
                  target: p?.goal.targetSupportGiven?.toString(),
                  color:  'bg-violet-500'
                },
                {
                  label:  'Break Time',
                  pct:    p?.breakProgress,
                  actual: `${p?.actualBreakMinutes}m`,
                  target: `${p?.goal.targetBreakMinutes}m`,
                  color:  'bg-amber-500'
                },
              ].map(item => (
                <div key={item.label}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-slate-400">{item.label}</span>
                    <span className="text-xs text-slate-500">
                      <span className="text-white font-medium">{item.actual}</span> / {item.target}
                    </span>
                  </div>
                  <ProgressBar value={item.pct ?? 0} color={item.color} />
                </div>
              ))}

              {p?.insights && p.insights.length > 0 && (
                <div className="mt-3 space-y-1">
                  {p.insights.map((insight, i) => (
                    <p key={i} className="text-xs text-slate-400">{insight}</p>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
//  Feature 1: Notification Bell with dropdown
// ═══════════════════════════════════════════════════════════════════════════════
export const NotificationBell = () => {
  const [open, setOpen] = useState(false);
  const { onEvent } = useSignalR();
  const { toast } = useToast();
  const qc = useQueryClient();
  const popupRef = useRef<HTMLDivElement>(null);
const location = useLocation();

  const { data: countData } = useQuery({
    queryKey: ['notifCount'],
    queryFn: () => notifApi.getCount().then(r => r.data.count as number),
    refetchInterval: 30_000
  });

  const { data: notifications } = useQuery<AppNotification[]>({
    queryKey: ['notifications'],
    queryFn: () => notifApi.getAll().then(r => r.data),
    enabled: open,
  });

  const markRead = useMutation({
    mutationFn: (id: number) => notifApi.markRead(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifCount'] });
      qc.invalidateQueries({ queryKey: ['notifications'] });
    }
  });

  const markAll = useMutation({
    mutationFn: () => notifApi.markAllRead(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifCount'] });
      qc.invalidateQueries({ queryKey: ['notifications'] });
    }
  });

  // Listen for real-time notifications
  useEffect(() => {
    const off = onEvent('ReceiveNotification', (data: unknown) => {
      const n = data as { title: string; message: string; type: string };
      // Show toast
      if (n.type === 'Success') toast.success(`${n.title}: ${n.message}`);
      else if (n.type === 'Warning') toast.warning(`${n.title}: ${n.message}`);
      else toast.info(`${n.title}: ${n.message}`);
      
      // Refresh notification count
      qc.invalidateQueries({ queryKey: ['notifCount'] });
      qc.invalidateQueries({ queryKey: ['notifications'] });
    });
    return () => off();
  }, [onEvent, toast, qc]);

  useEffect(() => {
  const handleClickOutside = (event: MouseEvent) => {
    if (
      popupRef.current &&
      !popupRef.current.contains(event.target as Node)
    ) {
      setOpen(false);
    }
  };

  if (open) {
    document.addEventListener("mousedown", handleClickOutside);
  }

  return () => {
    document.removeEventListener("mousedown", handleClickOutside);
  };
}, [open]);

useEffect(() => {
  setOpen(false);
}, [location]);

  const typeIcons: Record<string, string> = {
    Success: '✅', Warning: '⚠️', Info: 'ℹ️', Reminder: '🔔'
  };
  
  const navigate = useNavigate();

  return (
    <div ref={popupRef} className="relative">
      <button onClick={() => setOpen(!open)}
        className="relative p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition">
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {countData && countData > 0 && (
          <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
            {countData > 9 ? '9+' : countData}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed left-10 top-4 w-80 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl z-[9999] overflow-hidden">
          <div className="border-b border-slate-800">
            <div className="flex items-center justify-between px-4 pt-4 pb-3">
              <h4 className="text-sm font-semibold text-white">Notifications</h4>
              <button onClick={() => markAll.mutate()}
                className="text-xs text-blue-400 hover:text-blue-300 transition">
                Mark all read
              </button>
            </div>
            {/* ── NEW: View all link ───────────────────────────────────────── */}
            <button
              onClick={() => { setOpen(false); navigate('/notifications'); }}
              className="w-full flex items-center justify-between px-4 py-2.5 bg-slate-800/60 hover:bg-slate-800 text-slate-400 hover:text-white transition-colors text-xs font-medium"
            >
              <span>📥 Open full inbox</span>
              <span className="text-slate-600">→</span>
            </button>
          </div>
          <div className="max-h-72 overflow-y-auto">
            {notifications?.length === 0 ? (
              <div className="text-center py-8 text-slate-500 text-sm">All caught up! 🎉</div>
            ) : (
              notifications?.map(n => (
                <div key={n.id}
                  onClick={() => { if (!n.isRead) markRead.mutate(n.id); }}
                  className={`flex gap-3 p-3 border-b border-slate-800/50 cursor-pointer hover:bg-slate-800/50 transition ${
                    n.isRead ? 'opacity-60' : ''
                  }`}>
                  <span className="text-lg flex-shrink-0">{typeIcons[n.type] ?? 'ℹ️'}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white">{n.title}</p>
                    <p className="text-xs text-slate-400 mt-0.5 line-clamp-2">{n.message}</p>
                    <p className="text-xs text-slate-600 mt-1">
                      {new Date(n.createdAt).toLocaleTimeString()}
                    </p>
                  </div>
                  {!n.isRead && <div className="w-2 h-2 bg-blue-500 rounded-full mt-1 flex-shrink-0" />}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
//  Feature 9: Kudos Widget
// ═══════════════════════════════════════════════════════════════════════════════
export const KudosFeed = () => {
  const { data: kudos } = useQuery<any[]>({
    queryKey: ['kudosFeed'],
    queryFn: () => import('../../src/services/api').then(({ kudosApi }) =>
      kudosApi.getRecent(10).then(r => r.data)
    )
  });

  const BADGE_STYLES: Record<string, string> = {
    GreatWork: '🌟', TeamPlayer: '🤝', ProblemSolver: '🔧',
    Mentor: '🎓', Innovation: '💡'
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
      <h3 className="text-sm font-semibold text-white mb-4">🏆 Recent Kudos</h3>
      <div className="space-y-3">
        {kudos?.length === 0 && (
          <p className="text-slate-500 text-sm">No kudos yet — be the first to give one!</p>
        )}
        {kudos?.map((k: any) => (
          <div key={k.id} className="flex gap-3 items-start bg-slate-800/50 rounded-xl p-3">
            <span className="text-xl flex-shrink-0">{BADGE_STYLES[k.badgeType] ?? '🌟'}</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-white">
                <span className="font-medium text-blue-400">{k.fromUserName}</span>
                {' → '}
                <span className="font-medium text-emerald-400">{k.toUserName}</span>
              </p>
              <p className="text-xs text-slate-400 mt-0.5 line-clamp-2">{k.message}</p>
              <p className="text-xs text-slate-600 mt-1">
                {k.badgeType} · {new Date(k.givenAt).toLocaleDateString('en-GB')}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};