import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { goalsApi } from '../services/api';
import { GoalHistoryEntry } from '../types';

// ═══════════════════════════════════════════════════════════════════════════════
//  Goal History Page
//  Route: /goals/history  (add this to your router)
//
//  Shows completed daily goals for the last 7 or 30 days.
//  Matches the existing dark slate-900/slate-800 theme.
// ═══════════════════════════════════════════════════════════════════════════════

type Preset = 'week' | 'month';

// ── Small reusable progress bar ───────────────────────────────────────────────
const Bar = ({ value, color }: { value: number; color: string }) => (
  <div className="w-full h-1.5 bg-slate-700 rounded-full overflow-hidden">
    <div
      className={`h-full rounded-full ${color}`}
      style={{ width: `${Math.min(value, 100)}%` }}
    />
  </div>
);

// ── Grade badge ───────────────────────────────────────────────────────────────
const GradeBadge = ({ grade, score }: { grade: string; score: number }) => {
  const colors: Record<string, string> = {
    A: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    B: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    C: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    D: 'bg-red-500/20 text-red-400 border-red-500/30',
  };
  return (
    <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-semibold ${colors[grade] ?? colors.D}`}>
      <span className="text-base leading-none">{grade}</span>
      <span className="opacity-70">{score}%</span>
    </div>
  );
};

// ── Day card (week view) ───────────────────────────────────────────────────────
const DayCard = ({ entry }: { entry: GoalHistoryEntry }) => {
  const [expanded, setExpanded] = useState(false);

  const metrics = [
    { label: 'Work',    pct: entry.workProgress,    actual: `${Math.round(entry.actualWorkMinutes / 60 * 10) / 10}h`, target: `${Math.round(entry.targetWorkMinutes / 60)}h`,   color: 'bg-blue-500' },
    { label: 'Tasks',   pct: entry.taskProgress,    actual: entry.actualTasksCompleted,  target: entry.targetTasksCompleted,  color: 'bg-emerald-500' },
    { label: 'Support', pct: entry.supportProgress, actual: entry.actualSupportGiven,    target: entry.targetSupportGiven,    color: 'bg-violet-500' },
    { label: 'Break',   pct: entry.breakProgress,   actual: `${entry.actualBreakMinutes}m`, target: `${entry.targetBreakMinutes}m`, color: 'bg-amber-500' },
  ];

  return (
    <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-4 hover:border-slate-600 transition-colors">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-sm font-semibold text-white">{entry.dayName}</p>
          <p className="text-xs text-slate-500">{entry.dateLabel}</p>
        </div>
        <div className="flex items-center gap-2">
          {!entry.goalWasSet && (
            <span className="text-[10px] text-slate-600 bg-slate-700/50 px-2 py-0.5 rounded-full">
              no goal set
            </span>
          )}
          <GradeBadge grade={entry.scoreGrade} score={entry.productivityScore} />
        </div>
      </div>

      {/* Mini bars — always visible */}
      <div className="space-y-2">
        {metrics.map(m => (
          <div key={m.label}>
            <div className="flex justify-between items-center mb-0.5">
              <span className="text-[11px] text-slate-500">{m.label}</span>
              <span className="text-[11px] text-slate-400">
                <span className="text-white">{m.actual}</span>
                {' '}/{' '}{m.target}
              </span>
            </div>
            <Bar value={m.pct} color={m.color} />
          </div>
        ))}
      </div>

      {/* Overall score bar */}
      <div className="mt-3 pt-3 border-t border-slate-700/50">
        <div className="flex justify-between items-center mb-1">
          <span className="text-[11px] text-slate-500">Overall score</span>
          <span className="text-[11px] text-white font-medium">{entry.productivityScore}%</span>
        </div>
        <Bar
          value={entry.productivityScore}
          color={
            entry.productivityScore >= 90 ? 'bg-emerald-500' :
            entry.productivityScore >= 75 ? 'bg-blue-500' :
            entry.productivityScore >= 60 ? 'bg-amber-500' : 'bg-red-500'
          }
        />
      </div>
    </div>
  );
};

// ── Month row (compact, one per day) ─────────────────────────────────────────
const MonthRow = ({ entry }: { entry: GoalHistoryEntry }) => {
  const gradeColor: Record<string, string> = {
    A: 'text-emerald-400', B: 'text-blue-400', C: 'text-amber-400', D: 'text-red-400'
  };

  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-800/60 hover:bg-slate-800/30 transition-colors">
      {/* Date */}
      <div className="w-16 flex-shrink-0">
        <p className="text-xs font-medium text-white">{entry.dateLabel}</p>
        <p className="text-[10px] text-slate-600">{entry.dayName}</p>
      </div>

      {/* Grade + score */}
      <div className="w-16 flex-shrink-0 flex items-center gap-1.5">
        <span className={`text-sm font-bold ${gradeColor[entry.scoreGrade] ?? 'text-slate-400'}`}>
          {entry.scoreGrade}
        </span>
        <span className="text-xs text-slate-500">{entry.productivityScore}%</span>
      </div>

      {/* Score bar */}
      <div className="flex-1">
        <Bar
          value={entry.productivityScore}
          color={
            entry.productivityScore >= 90 ? 'bg-emerald-500' :
            entry.productivityScore >= 75 ? 'bg-blue-500' :
            entry.productivityScore >= 60 ? 'bg-amber-500' : 'bg-red-500'
          }
        />
      </div>

      {/* Quick stats */}
      <div className="flex items-center gap-3 flex-shrink-0 text-[11px] text-slate-500">
        <span title="Work hours">
          🕐 {Math.round(entry.actualWorkMinutes / 60 * 10) / 10}h
        </span>
        <span title="Tasks done">
          ✅ {entry.actualTasksCompleted}/{entry.targetTasksCompleted}
        </span>
        <span title="Support logs">
          🤝 {entry.actualSupportGiven}/{entry.targetSupportGiven}
        </span>
      </div>

      {/* No goal indicator */}
      {!entry.goalWasSet && (
        <span className="text-[10px] text-slate-700 flex-shrink-0">no goal</span>
      )}
    </div>
  );
};

// ── Summary stats bar ─────────────────────────────────────────────────────────
const SummaryBar = ({ entries }: { entries: GoalHistoryEntry[] }) => {
  if (entries.length === 0) return null;

  const avg     = (arr: number[]) => Math.round(arr.reduce((a, b) => a + b, 0) / arr.length * 10) / 10;
  const avgScore = avg(entries.map(e => e.productivityScore));
  const grades  = entries.map(e => e.scoreGrade);
  const gradeCount = { A: 0, B: 0, C: 0, D: 0 } as Record<string, number>;
  grades.forEach(g => gradeCount[g] = (gradeCount[g] ?? 0) + 1);
  const topGrade = Object.entries(gradeCount).sort((a, b) => b[1] - a[1])[0]?.[0];

  const totalWork  = entries.reduce((s, e) => s + e.actualWorkMinutes, 0);
  const totalTasks = entries.reduce((s, e) => s + e.actualTasksCompleted, 0);

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
      {[
        { label: 'Avg Score',   value: `${avgScore}%`,                        icon: '📊', color: 'text-blue-400' },
        { label: 'Days Tracked', value: entries.length.toString(),             icon: '📅', color: 'text-violet-400' },
        { label: 'Total Work',  value: `${Math.round(totalWork / 60 * 10) / 10}h`, icon: '🕐', color: 'text-emerald-400' },
        { label: 'Tasks Done',  value: totalTasks.toString(),                  icon: '✅', color: 'text-amber-400' },
      ].map(stat => (
        <div key={stat.label} className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-3">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-base">{stat.icon}</span>
            <span className="text-xs text-slate-500">{stat.label}</span>
          </div>
          <p className={`text-xl font-bold ${stat.color}`}>{stat.value}</p>
        </div>
      ))}
    </div>
  );
};

// ── Main page ─────────────────────────────────────────────────────────────────
export const GoalHistoryPage = () => {
  const [preset, setPreset] = useState<Preset>('week');

  const { data: entries = [], isLoading } = useQuery<GoalHistoryEntry[]>({
    queryKey: ['goalHistory', preset],
    queryFn:  () => goalsApi.getHistory(preset).then(r => r.data),
  });

  // Sort oldest → newest for display
  const sorted = [...entries].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  return (
    <div className="min-h-screen bg-slate-950 p-6">
      <div className="max-w-4xl mx-auto">

        {/* ── Page header ─────────────────────────────────────────────── */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-white">Goal History</h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Review your productivity over time
            </p>
          </div>

          {/* Week / Month toggle */}
          <div className="flex items-center gap-1 bg-slate-800 border border-slate-700 rounded-xl p-1">
            {(['week', 'month'] as Preset[]).map(p => (
              <button
                key={p}
                onClick={() => setPreset(p)}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium transition ${
                  preset === p
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {p === 'week' ? 'This Week' : 'This Month'}
              </button>
            ))}
          </div>
        </div>

        {/* ── Loading skeleton ─────────────────────────────────────────── */}
        {isLoading && (
          <div className="space-y-3">
            {Array.from({ length: preset === 'week' ? 7 : 5 }).map((_, i) => (
              <div key={i} className="h-24 bg-slate-800/50 rounded-2xl animate-pulse" />
            ))}
          </div>
        )}

        {/* ── Empty state ──────────────────────────────────────────────── */}
        {!isLoading && sorted.length === 0 && (
          <div className="text-center py-20 text-slate-600">
            <p className="text-4xl mb-3">📭</p>
            <p className="text-sm">No work logs found for this period.</p>
          </div>
        )}

        {/* ── Data ─────────────────────────────────────────────────────── */}
        {!isLoading && sorted.length > 0 && (
          <>
            {/* Summary strip */}
            <SummaryBar entries={sorted} />

            {/* Week view — one card per day */}
            {preset === 'week' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {sorted.map(entry => (
                  <DayCard key={entry.date} entry={entry} />
                ))}
              </div>
            )}

            {/* Month view — compact table rows */}
            {preset === 'month' && (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
                {/* Column headers */}
                <div className="flex items-center gap-3 px-4 py-2 bg-slate-800/50 border-b border-slate-700">
                  <span className="w-16 text-[11px] text-slate-500 flex-shrink-0">Date</span>
                  <span className="w-16 text-[11px] text-slate-500 flex-shrink-0">Grade</span>
                  <span className="flex-1 text-[11px] text-slate-500">Score</span>
                  <span className="flex-shrink-0 text-[11px] text-slate-500 hidden sm:block">Work · Tasks · Support</span>
                </div>

                {sorted.map(entry => (
                  <MonthRow key={entry.date} entry={entry} />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};