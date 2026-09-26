// ─────────────────────────────────────────────────────────────────────────────
//  FILE: ui/src/pages/Historyanalyticspages.tsx
//  History - Modern Design System Upgrade
//
//  HistoryPage (route: /history) — logic unchanged:
//  ✅ Past daily logs for 7 / 14 / 30 / 90 days
//  ✅ Click a day → detail panel (times, tasks, support + media, notes)
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useMemo } from 'react';
import { dailyLogApi } from '../services/api';
import type { DailyLog } from '../types';
import { SupportMediaDisplay } from '../components/SupportMediaDisplay';
import { PageHeader } from '../components/ui/PageHeader';
import { StatCard } from '../components/ui/StatCard';
import { Card, CardContent } from '../components/ui/Card';
import {
  History,
  CalendarDays,
  Clock,
  Timer,
  Coffee,
  ListChecks,
  LifeBuoy,
  CheckCircle2,
  RefreshCw,
  Ban,
  StickyNote,
  ChevronRight,
  MousePointerClick,
  Inbox,
  X,
} from 'lucide-react';

// ─── Shared helpers ───────────────────────────────────────────────────────────

const STATUS_CHIP: Record<string, string> = {
  Present: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
  WFH:     'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
  HalfDay: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
  Absent:  'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20',
};

const formatISTTime = (dateString?: string) => {
  if (!dateString) return '--:--';
  // Force treat backend time as UTC
  const utcDate = new Date(dateString + 'Z');
  return utcDate.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    timeZone: 'Asia/Kolkata',
  });
};

const minsToHM = (m: number) => `${Math.floor(m / 60)}h ${m % 60}m`;

// ─── History Page ─────────────────────────────────────────────────────────────

export const HistoryPage = () => {
  const [history, setHistory] = useState<DailyLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLog, setSelectedLog] = useState<DailyLog | null>(null);
  const [days, setDays] = useState(30);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const res = await dailyLogApi.getHistory(days);
        setHistory(res.data);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [days]);

  const stats = useMemo(() => {
    const totalMins = history.reduce((s, l) => s + (l.totalWorkMinutes ?? 0), 0);
    const tasksDone = history.reduce((s, l) => s + l.tasks.filter(t => t.status === 'Completed').length, 0);
    const support   = history.reduce((s, l) => s + l.supportLogs.length, 0);
    return { totalMins, tasksDone, support };
  }, [history]);

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* ── Page Header ── */}
      <PageHeader
        title="History"
        description="Your past activity logs — check-ins, tasks and support, day by day."
        breadcrumbs={[
          { label: 'Workspace', href: '/' },
          { label: 'Reports' },
          { label: 'History' },
        ]}
        badge={{ label: `Last ${days} days`, variant: 'blue', icon: <History className="w-3 h-3" /> }}
        actions={
          <div className="inline-flex p-1 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
            {[7, 14, 30, 90].map(d => (
              <button
                key={d}
                onClick={() => { setDays(d); setSelectedLog(null); }}
                className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition ${
                  days === d
                    ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-sm'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {d}d
              </button>
            ))}
          </div>
        }
        className="!mb-0"
      />

      {/* ── Stats ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Days Logged"   value={history.length}           icon={CalendarDays} color="blue"    loading={loading} />
        <StatCard title="Total Work"    value={minsToHM(stats.totalMins)} icon={Timer}        color="emerald" loading={loading} />
        <StatCard title="Tasks Done"    value={stats.tasksDone}           icon={ListChecks}   color="purple"  loading={loading} />
        <StatCard title="Support Given" value={stats.support}             icon={LifeBuoy}     color="amber"   loading={loading} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* ── Log list ── */}
        <div className="lg:col-span-3 space-y-2.5">
          {loading ? (
            [1, 2, 3, 4, 5].map(i => (
              <div key={i} className="h-20 rounded-2xl bg-slate-100 dark:bg-slate-800/60 animate-pulse" />
            ))
          ) : history.length === 0 ? (
            <div className="text-center py-16 px-4 rounded-3xl border-2 border-dashed border-slate-200 dark:border-slate-800">
              <Inbox className="w-9 h-9 mx-auto text-slate-300 dark:text-slate-600" />
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 mt-3">No history yet</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Your daily logs will appear here after you check in.</p>
            </div>
          ) : (
            history.map(log => {
              const active = selectedLog?.id === log.id;
              const done = log.tasks.filter(t => t.status === 'Completed').length;
              return (
                <button
                  key={log.id}
                  onClick={() => setSelectedLog(active ? null : log)}
                  className={`w-full text-left rounded-2xl border p-4 transition-all ${
                    active
                      ? 'border-blue-500 bg-blue-500/5 ring-2 ring-blue-500/20'
                      : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-md'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3 mb-2.5">
                    <p className="text-sm font-bold text-slate-900 dark:text-white truncate">
                      {new Date(log.logDate).toLocaleDateString('en-IN', {
                        weekday: 'long', day: 'numeric', month: 'short', year: 'numeric'
                      })}
                    </p>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${STATUS_CHIP[log.dayStatus] ?? STATUS_CHIP.Present}`}>
                        {log.dayStatus}
                      </span>
                      <ChevronRight className={`w-4 h-4 text-slate-400 transition-transform ${active ? 'rotate-90 lg:rotate-0 text-blue-500' : ''}`} />
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
                    <span className="inline-flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      {log.checkInTime ? formatISTTime(log.checkInTime) : '--'} → {log.checkOutTime ? formatISTTime(log.checkOutTime) : '--'}
                    </span>
                    <span className="inline-flex items-center gap-1 font-semibold text-blue-600 dark:text-blue-400">
                      <Timer className="w-3.5 h-3.5" /> {log.workHours}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> {done} tasks
                    </span>
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* ── Detail panel ── */}
        <div className="lg:col-span-2">
          {selectedLog ? (
            <Card className="lg:sticky lg:top-4">
              <CardContent>
                <div className="flex items-start justify-between gap-3 mb-5">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Day Details</p>
                    <h3 className="text-base font-bold text-slate-900 dark:text-white mt-0.5">
                      {new Date(selectedLog.logDate).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
                    </h3>
                  </div>
                  <button
                    onClick={() => setSelectedLog(null)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                    aria-label="Close details"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-5">
                  {[
                    { l: 'Check In',   v: selectedLog.checkInTime ? formatISTTime(selectedLog.checkInTime) : '--',   i: Clock,  c: 'text-emerald-600 dark:text-emerald-400' },
                    { l: 'Check Out',  v: selectedLog.checkOutTime ? formatISTTime(selectedLog.checkOutTime) : '--', i: Clock,  c: 'text-rose-600 dark:text-rose-400' },
                    { l: 'Work Hours', v: selectedLog.workHours,                                                      i: Timer,  c: 'text-blue-600 dark:text-blue-400' },
                    { l: 'Break Time', v: `${selectedLog.totalBreakMinutes}m`,                                        i: Coffee, c: 'text-amber-600 dark:text-amber-400' },
                  ].map(s => {
                    const Icon = s.i;
                    return (
                      <div key={s.l} className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                        <p className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                          <Icon className="w-3.5 h-3.5" /> {s.l}
                        </p>
                        <p className={`text-base font-bold mt-0.5 ${s.c}`}>{s.v}</p>
                      </div>
                    );
                  })}
                </div>

                {selectedLog.tasks.length > 0 && (
                  <div className="mb-5">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                      Tasks ({selectedLog.tasks.length})
                    </p>
                    <div className="space-y-1.5">
                      {selectedLog.tasks.map(t => {
                        const Icon = t.status === 'Completed' ? CheckCircle2 : t.status === 'Blocked' ? Ban : RefreshCw;
                        const cls  = t.status === 'Completed' ? 'text-emerald-500' : t.status === 'Blocked' ? 'text-rose-500' : 'text-blue-500';
                        return (
                          <div key={t.id} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800/40 text-xs">
                            <Icon className={`w-3.5 h-3.5 shrink-0 ${cls}`} />
                            <span className="text-slate-800 dark:text-slate-200 font-medium flex-1 truncate">{t.taskTitle}</span>
                            <span className="text-slate-500 dark:text-slate-400 shrink-0">{t.timeSpentMinutes}m</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {selectedLog.supportLogs.length > 0 && (
                  <div className="mb-5">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                      Support Given ({selectedLog.supportLogs.length})
                    </p>
                    <div className="space-y-1.5">
                      {selectedLog.supportLogs.map(s => (
                        <div key={s.id} className="px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800/40 text-xs">
                          <div className="flex items-center gap-2">
                            <LifeBuoy className="w-3.5 h-3.5 shrink-0 text-violet-500" />
                            <span className="text-slate-800 dark:text-slate-200 font-medium flex-1 truncate">{s.supportedDeveloperName}</span>
                            <span className="text-slate-500 dark:text-slate-400 shrink-0">{s.timeSpentMinutes}m</span>
                          </div>
                          {s.media && s.media.length > 0 && <SupportMediaDisplay media={s.media} />}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {selectedLog.tasks.length === 0 && selectedLog.supportLogs.length === 0 && (
                  <p className="text-xs text-slate-500 dark:text-slate-400 italic mb-4">No tasks or support logged this day.</p>
                )}

                {selectedLog.notes && (
                  <div className="p-3 rounded-xl bg-amber-500/5 border border-amber-500/20">
                    <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-400 mb-1">
                      <StickyNote className="w-3.5 h-3.5" /> Notes
                    </p>
                    <p className="text-xs text-slate-700 dark:text-slate-300">{selectedLog.notes}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="hidden lg:flex flex-col items-center justify-center text-center h-64 rounded-3xl border-2 border-dashed border-slate-200 dark:border-slate-800 lg:sticky lg:top-4">
              <MousePointerClick className="w-8 h-8 text-slate-300 dark:text-slate-600" />
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 mt-3">Select a day</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Click any log on the left to see full details</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
