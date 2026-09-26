// ─────────────────────────────────────────────────────────────────────────────
//  FILE: ui/src/pages/GoalHistoryPage.tsx
//  Goal History - Modern Design System Upgrade
//
//  Route: /goal-history
//  Logic unchanged from previous version:
//  ✅ This Week → one card per day (work / tasks / support / break vs target)
//  ✅ This Month → compact row per day
//  ✅ Summary: avg score, days tracked, total work, tasks done
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { goalsApi } from '../services/api';
import type { GoalHistoryEntry } from '../types';
import { PageHeader } from '../components/ui/PageHeader';
import { StatCard } from '../components/ui/StatCard';
import { Card } from '../components/ui/Card';
import {
  Target,
  BarChart3,
  CalendarDays,
  Timer,
  ListChecks,
  LifeBuoy,
  Coffee,
  Inbox,
  CalendarRange,
  ArrowLeft,
} from 'lucide-react';

type Preset = 'week' | 'month';

// ── Helpers ───────────────────────────────────────────────────────────────────

const scoreBarColor = (score: number) =>
  score >= 90 ? 'bg-emerald-500' :
  score >= 75 ? 'bg-blue-500' :
  score >= 60 ? 'bg-amber-500' : 'bg-rose-500';

const GRADE_STYLE: Record<string, string> = {
  A: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
  B: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30',
  C: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30',
  D: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30',
};

const GRADE_TEXT: Record<string, string> = {
  A: 'text-emerald-600 dark:text-emerald-400',
  B: 'text-blue-600 dark:text-blue-400',
  C: 'text-amber-600 dark:text-amber-400',
  D: 'text-rose-600 dark:text-rose-400',
};

const toHours = (mins: number) => Math.round(mins / 60 * 10) / 10;

// ── Small reusable progress bar ───────────────────────────────────────────────
const Bar = ({ value, color }: { value: number; color: string }) => (
  <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
    <div
      className={`h-full rounded-full transition-all duration-500 ${color}`}
      style={{ width: `${Math.min(value, 100)}%` }}
    />
  </div>
);

// ── Grade badge ───────────────────────────────────────────────────────────────
const GradeBadge = ({ grade, score }: { grade: string; score: number }) => (
  <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-bold ${GRADE_STYLE[grade] ?? GRADE_STYLE.D}`}>
    <span className="text-sm leading-none">{grade}</span>
    <span className="opacity-75 font-semibold">{score}%</span>
  </div>
);

// ── Day card (week view) ───────────────────────────────────────────────────────
const DayCard = ({ entry }: { entry: GoalHistoryEntry }) => {
  const metrics = [
    { label: 'Work',    icon: Timer,      pct: entry.workProgress,    actual: `${toHours(entry.actualWorkMinutes)}h`, target: `${Math.round(entry.targetWorkMinutes / 60)}h`, color: 'bg-blue-500' },
    { label: 'Tasks',   icon: ListChecks, pct: entry.taskProgress,    actual: entry.actualTasksCompleted, target: entry.targetTasksCompleted, color: 'bg-emerald-500' },
    { label: 'Support', icon: LifeBuoy,   pct: entry.supportProgress, actual: entry.actualSupportGiven,   target: entry.targetSupportGiven,   color: 'bg-violet-500' },
    { label: 'Break',   icon: Coffee,     pct: entry.breakProgress,   actual: `${entry.actualBreakMinutes}m`, target: `${entry.targetBreakMinutes}m`, color: 'bg-amber-500' },
  ];

  return (
    <Card hover className="p-4">
      <div className="flex items-center justify-between gap-2 mb-4">
        <div>
          <p className="text-sm font-bold text-slate-900 dark:text-white">{entry.dayName}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">{entry.dateLabel}</p>
        </div>
        <GradeBadge grade={entry.scoreGrade} score={entry.productivityScore} />
      </div>

      <div className="space-y-2.5">
        {metrics.map(m => {
          const Icon = m.icon;
          return (
            <div key={m.label}>
              <div className="flex justify-between items-center mb-1">
                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                  <Icon className="w-3 h-3" /> {m.label}
                </span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                  <span className="font-bold text-slate-900 dark:text-white">{m.actual}</span> / {m.target}
                </span>
              </div>
              <Bar value={m.pct} color={m.color} />
            </div>
          );
        })}
      </div>

      <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800">
        <div className="flex justify-between items-center mb-1">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Overall</span>
          <span className="text-xs font-bold text-slate-900 dark:text-white">{entry.productivityScore}%</span>
        </div>
        <Bar value={entry.productivityScore} color={scoreBarColor(entry.productivityScore)} />
        {!entry.goalWasSet && (
          <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-2">No goal set — default targets used</p>
        )}
      </div>
    </Card>
  );
};

// ── Month row (compact, one per day) ─────────────────────────────────────────
const MonthRow = ({ entry }: { entry: GoalHistoryEntry }) => (
  <div className="flex items-center gap-3 sm:gap-4 px-4 sm:px-5 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
    <div className="w-16 flex-shrink-0">
      <p className="text-xs font-bold text-slate-900 dark:text-white">{entry.dateLabel}</p>
      <p className="text-[10px] text-slate-500 dark:text-slate-400">{entry.dayName}</p>
    </div>

    <div className="w-16 flex-shrink-0 flex items-center gap-1.5">
      <span className={`text-base font-extrabold ${GRADE_TEXT[entry.scoreGrade] ?? 'text-slate-500'}`}>
        {entry.scoreGrade}
      </span>
      <span className="text-xs text-slate-500 dark:text-slate-400">{entry.productivityScore}%</span>
    </div>

    <div className="flex-1 min-w-[60px]">
      <Bar value={entry.productivityScore} color={scoreBarColor(entry.productivityScore)} />
    </div>

    <div className="hidden sm:flex items-center gap-3 flex-shrink-0 text-[11px] text-slate-600 dark:text-slate-400">
      <span className="inline-flex items-center gap-1" title="Work hours">
        <Timer className="w-3.5 h-3.5 text-blue-500" /> {toHours(entry.actualWorkMinutes)}h
      </span>
      <span className="inline-flex items-center gap-1" title="Tasks done">
        <ListChecks className="w-3.5 h-3.5 text-emerald-500" /> {entry.actualTasksCompleted}/{entry.targetTasksCompleted}
      </span>
      <span className="inline-flex items-center gap-1" title="Support logs">
        <LifeBuoy className="w-3.5 h-3.5 text-violet-500" /> {entry.actualSupportGiven}/{entry.targetSupportGiven}
      </span>
    </div>

    {!entry.goalWasSet && (
      <span className="hidden md:inline text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-500/10 text-slate-500 dark:text-slate-400 flex-shrink-0">
        no goal
      </span>
    )}
  </div>
);

// ── Main page ─────────────────────────────────────────────────────────────────
export const GoalHistoryPage = () => {
  const navigate = useNavigate();
  const [preset, setPreset] = useState<Preset>('week');

  const { data: entries = [], isLoading } = useQuery<GoalHistoryEntry[]>({
    queryKey: ['goalHistory', preset],
    queryFn:  () => goalsApi.getHistory(preset).then(r => r.data),
  });

  // Sort oldest → newest for display
  const sorted = [...entries].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  // Summary
  const avgScore  = sorted.length
    ? Math.round(sorted.reduce((a, e) => a + e.productivityScore, 0) / sorted.length * 10) / 10
    : 0;
  const totalWork  = sorted.reduce((s, e) => s + e.actualWorkMinutes, 0);
  const totalTasks = sorted.reduce((s, e) => s + e.actualTasksCompleted, 0);

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* ── Page Header ── */}
      <PageHeader
        title="Goal History"
        description="Review your daily goals and productivity over time."
        breadcrumbs={[
          { label: 'Workspace', href: '/' },
          { label: 'Goals', href: '/goals' },
          { label: 'History' },
        ]}
        badge={{ label: preset === 'week' ? 'This Week' : 'This Month', variant: 'blue', icon: <Target className="w-3 h-3" /> }}
        actions={
          <>
            <button
              onClick={() => navigate('/goals')}
              className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition"
            >
              <ArrowLeft className="w-4 h-4" /> Today's Goals
            </button>
            <div className="inline-flex p-1 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              {(['week', 'month'] as Preset[]).map(p => (
                <button
                  key={p}
                  onClick={() => setPreset(p)}
                  className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition ${
                    preset === p
                      ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-sm'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {p === 'week' ? <CalendarDays className="w-4 h-4" /> : <CalendarRange className="w-4 h-4" />}
                  {p === 'week' ? 'This Week' : 'This Month'}
                </button>
              ))}
            </div>
          </>
        }
        className="!mb-0"
      />

      {/* ── Summary ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Avg Score"    value={`${avgScore}%`}            icon={BarChart3}    color="blue"    loading={isLoading} />
        <StatCard title="Days Tracked" value={sorted.length}             icon={CalendarDays} color="purple"  loading={isLoading} />
        <StatCard title="Total Work"   value={`${toHours(totalWork)}h`}  icon={Timer}        color="emerald" loading={isLoading} />
        <StatCard title="Tasks Done"   value={totalTasks}                icon={ListChecks}   color="amber"   loading={isLoading} />
      </div>

      {/* ── Loading ── */}
      {isLoading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: preset === 'week' ? 7 : 8 }).map((_, i) => (
            <div key={i} className="h-60 bg-slate-100 dark:bg-slate-800/60 rounded-2xl animate-pulse" />
          ))}
        </div>
      )}

      {/* ── Empty ── */}
      {!isLoading && sorted.length === 0 && (
        <div className="text-center py-16 px-4 rounded-3xl border-2 border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
            <Inbox className="w-7 h-7 text-blue-500" />
          </div>
          <p className="text-base font-bold text-slate-900 dark:text-white mt-3">No work logs found</p>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Check in and log tasks to start building your history.</p>
        </div>
      )}

      {/* ── Week view ── */}
      {!isLoading && sorted.length > 0 && preset === 'week' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {sorted.map(entry => <DayCard key={entry.date} entry={entry} />)}
        </div>
      )}

      {/* ── Month view ── */}
      {!isLoading && sorted.length > 0 && preset === 'month' && (
        <Card className="overflow-hidden">
          <div className="flex items-center gap-3 sm:gap-4 px-4 sm:px-5 py-3 bg-slate-50 dark:bg-slate-800/40 border-b border-slate-200 dark:border-slate-800">
            <span className="w-16 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex-shrink-0">Date</span>
            <span className="w-16 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex-shrink-0">Grade</span>
            <span className="flex-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Score</span>
            <span className="hidden sm:block flex-shrink-0 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Work · Tasks · Support</span>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
            {sorted.map(entry => <MonthRow key={entry.date} entry={entry} />)}
          </div>
        </Card>
      )}

      {/* ── Grade legend ── */}
      {!isLoading && sorted.length > 0 && (
        <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-slate-600 dark:text-slate-400">
          {[
            { g: 'A', l: '90%+ Excellent' },
            { g: 'B', l: '75–89% Good' },
            { g: 'C', l: '60–74% Fair' },
            { g: 'D', l: 'Below 60%' },
          ].map(x => (
            <span key={x.g} className="inline-flex items-center gap-1.5">
              <span className={`font-extrabold ${GRADE_TEXT[x.g]}`}>{x.g}</span> {x.l}
            </span>
          ))}
        </div>
      )}
    </div>
  );
};