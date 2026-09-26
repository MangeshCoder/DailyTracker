import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { analyticsApi } from '../services/api';
import type { HeatmapData, ProjectTime, ProductivityTrend, PeakHour } from '../types';

// ═══════════════════════════════════════════════════════════════════════════════
//  Feature 5: GitHub-style Heatmap Calendar
// ═══════════════════════════════════════════════════════════════════════════════
const LEVEL_COLORS_DARK = [
  'bg-slate-200 dark:bg-slate-800/80 hover:bg-slate-300 dark:hover:bg-slate-700', // 0 - no activity
  'bg-blue-200 dark:bg-blue-950/80 border border-blue-400/20 hover:scale-110',      // 1 - light
  'bg-blue-400 dark:bg-blue-800 hover:scale-110',                                   // 2 - moderate
  'bg-blue-500 dark:bg-blue-600 hover:scale-110',                                   // 3 - good
  'bg-blue-600 dark:bg-blue-400 hover:scale-110',                                   // 4 - excellent
];

export const HeatmapCalendar: React.FC<{ userId?: number }> = ({ userId }) => {
  const { data: heatmap, isLoading } = useQuery<HeatmapData[]>({
    queryKey: ['heatmap', userId],
    queryFn: () =>
      userId
        ? analyticsApi.getUserAnalytics(userId, 365).then((r) => r.data.heatmap)
        : analyticsApi.getHeatmap(365).then((r) => r.data),
  });

  if (isLoading) {
    return <div className="animate-pulse h-36 bg-slate-100 dark:bg-slate-800 rounded-2xl" />;
  }

  if (!heatmap || heatmap.length === 0) {
    return (
      <div className="text-center py-10 text-slate-400 text-xs sm:text-sm">
        No activity logged in this period. Start completing daily tasks!
      </div>
    );
  }

  // Build full 52-week grid
  const today = new Date();
  const startDate = new Date(today);
  startDate.setDate(today.getDate() - 364);

  const dataMap = new Map(heatmap.map((d) => [d.date.split('T')[0], d]));

  const weeks: Array<Array<{ date: Date; data?: HeatmapData }>> = [];
  const current = new Date(startDate);
  current.setDate(current.getDate() - current.getDay());

  while (current <= today) {
    const week: Array<{ date: Date; data?: HeatmapData }> = [];
    for (let d = 0; d < 7; d++) {
      const dateKey = current.toISOString().split('T')[0];
      week.push({ date: new Date(current), data: dataMap.get(dateKey) });
      current.setDate(current.getDate() + 1);
    }
    weeks.push(week);
  }

  const months: { label: string; col: number }[] = [];
  let lastMonth = -1;
  weeks.forEach((week, i) => {
    const month = week[0].date.getMonth();
    if (month !== lastMonth) {
      months.push({
        label: week[0].date.toLocaleString('default', { month: 'short' }),
        col: i,
      });
      lastMonth = month;
    }
  });

  return (
    <div className="space-y-3">
      {/* Month labels */}
      <div className="relative h-4 text-[10px] text-slate-500 font-semibold overflow-hidden">
        {months.map((m) => (
          <span
            key={`${m.label}-${m.col}`}
            className="absolute"
            style={{ left: `${m.col * 14}px` }}
          >
            {m.label}
          </span>
        ))}
      </div>

      {/* Grid */}
      <div className="flex gap-1 overflow-x-auto pb-2 scrollbar-thin">
        {weeks.map((week, wi) => (
          <div key={wi} className="flex flex-col gap-1 flex-shrink-0">
            {week.map((cell, di) => {
              const level = cell.data?.level ?? 0;
              const isFuture = cell.date > today;
              const tooltip = cell.data
                ? `${cell.date.toLocaleDateString('en-IN', {
                    weekday: 'short',
                    day: 'numeric',
                    month: 'short',
                  })}: ${Math.round((cell.data.workMinutes / 60) * 10) / 10}h, ${cell.data.tasksCompleted} tasks`
                : cell.date.toDateString();

              return (
                <div
                  key={di}
                  title={tooltip}
                  className={`w-3 h-3 rounded-[3px] transition-all cursor-pointer ${
                    isFuture
                      ? 'bg-transparent'
                      : LEVEL_COLORS_DARK[level]
                  }`}
                />
              );
            })}
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-2 justify-end text-[11px] font-medium text-slate-500">
        <span>Less active</span>
        {LEVEL_COLORS_DARK.map((c, i) => (
          <div key={i} className={`w-3 h-3 rounded-[3px] ${c}`} />
        ))}
        <span>High activity</span>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
//  Feature 5: Project Time Breakdown (Donut Chart)
// ═══════════════════════════════════════════════════════════════════════════════
const PROJECT_COLORS = [
  '#3b82f6',
  '#8b5cf6',
  '#10b981',
  '#f59e0b',
  '#ef4444',
  '#06b6d4',
  '#ec4899',
  '#84cc16',
];

export const ProjectBreakdown: React.FC = () => {
  const { data: projects, isLoading } = useQuery<ProjectTime[]>({
    queryKey: ['projects'],
    queryFn: () => analyticsApi.getProjects(30).then((r) => r.data),
  });

  if (isLoading) {
    return <div className="animate-pulse h-48 bg-slate-100 dark:bg-slate-800 rounded-2xl" />;
  }

  if (!projects || projects.length === 0) {
    return (
      <div className="text-center py-10 text-slate-400 text-xs sm:text-sm">
        No project logs registered yet. Assign projects to your daily task items!
      </div>
    );
  }

  const totalMins = projects.reduce((s, p) => s + p.totalMinutes, 0);

  let startPct = 0;
  const segments = projects.slice(0, 8).map((p, i) => {
    const pct = totalMins > 0 ? (p.totalMinutes / totalMins) * 100 : 0;
    const seg = {
      start: startPct,
      end: startPct + pct,
      color: PROJECT_COLORS[i % PROJECT_COLORS.length],
    };
    startPct += pct;
    return seg;
  });

  const gradient = segments
    .map((s) => `${s.color} ${s.start}% ${s.end}%`)
    .join(', ');

  const totalHours = Math.round((totalMins / 60) * 10) / 10;

  return (
    <div className="flex flex-col sm:flex-row gap-6 items-center">
      {/* Donut chart */}
      <div className="relative flex-shrink-0">
        <div
          className="w-36 h-36 rounded-full shadow-lg"
          style={{ background: `conic-gradient(${gradient})` }}
        />
        <div className="absolute inset-4 bg-white dark:bg-slate-900 rounded-full flex flex-col items-center justify-center shadow-inner">
          <span className="text-base font-bold text-slate-900 dark:text-white">
            {totalHours}h
          </span>
          <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">
            Total Logged
          </span>
        </div>
      </div>

      {/* Legend */}
      <div className="flex-1 w-full space-y-2">
        {projects.slice(0, 8).map((p, i) => (
          <div
            key={p.projectName}
            className="flex items-center gap-2.5 p-1.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/60 transition"
          >
            <div
              className="w-3 h-3 rounded-md flex-shrink-0 shadow-sm"
              style={{ backgroundColor: PROJECT_COLORS[i % PROJECT_COLORS.length] }}
            />
            <span className="text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-200 flex-1 truncate">
              {p.projectName}
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              {Math.round((p.totalMinutes / 60) * 10) / 10}h
            </span>
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300 w-12 text-right bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md">
              {p.percentage}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
//  Feature 5: Productivity Trend (Bar Chart)
// ═══════════════════════════════════════════════════════════════════════════════
export const ProductivityTrendChart: React.FC<{ days?: number }> = ({ days = 14 }) => {
  const { data: trend, isLoading } = useQuery<ProductivityTrend[]>({
    queryKey: ['trend', days],
    queryFn: () =>
      analyticsApi.getAdvanced(days).then((r) => r.data.productivityTrend),
  });

  if (isLoading) {
    return <div className="animate-pulse h-36 bg-slate-100 dark:bg-slate-800 rounded-2xl" />;
  }

  if (!trend || trend.length === 0) {
    return (
      <div className="text-center py-8 text-slate-400 text-xs sm:text-sm">
        No productivity trend data recorded yet.
      </div>
    );
  }

  const max = Math.max(...trend.map((d) => d.score), 1);

  return (
    <div className="space-y-2">
      <div className="flex items-end gap-1.5 sm:gap-2 h-36 pt-4">
        {trend.map((d, i) => {
          const heightPct = Math.max((d.score / max) * 100, 6);
          const colorClass =
            d.score >= 80
              ? 'bg-gradient-to-t from-emerald-600 to-emerald-400'
              : d.score >= 60
              ? 'bg-gradient-to-t from-blue-600 to-blue-400'
              : 'bg-gradient-to-t from-amber-600 to-amber-400';

          return (
            <div
              key={i}
              className="flex-1 flex flex-col items-center gap-1 group relative h-full justify-end cursor-pointer"
            >
              {/* Floating Tooltip */}
              <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute -top-8 bg-slate-900 text-white text-[10px] px-2 py-0.5 rounded shadow pointer-events-none whitespace-nowrap z-10">
                {d.score}% ({Math.round((d.workMinutes / 60) * 10) / 10}h)
              </div>

              <div
                className={`w-full rounded-t-lg transition-all duration-300 group-hover:brightness-110 ${colorClass}`}
                style={{ height: `${heightPct}%` }}
              />
            </div>
          );
        })}
      </div>

      {/* Day Labels */}
      <div className="flex gap-1.5 sm:gap-2">
        {trend.map((d, i) => (
          <div
            key={i}
            className="flex-1 text-center text-[10px] font-semibold text-slate-500 truncate"
          >
            {d.dayName}
          </div>
        ))}
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
//  Feature 5: Peak Hours Bar Chart
// ═══════════════════════════════════════════════════════════════════════════════
export const PeakHoursChart: React.FC = () => {
  const { data: hours, isLoading } = useQuery<PeakHour[]>({
    queryKey: ['peakHours'],
    queryFn: () => analyticsApi.getPeakHours(30).then((r) => r.data),
  });

  if (isLoading) {
    return <div className="animate-pulse h-28 bg-slate-100 dark:bg-slate-800 rounded-2xl" />;
  }

  if (!hours || hours.length === 0) {
    return (
      <div className="text-center py-6 text-slate-400 text-xs sm:text-sm">
        Log more daily tasks to reveal peak productivity hours.
      </div>
    );
  }

  const max = Math.max(...hours.map((h) => h.tasksCompleted), 1);

  return (
    <div className="space-y-2">
      <div className="flex items-end gap-1.5 h-24 pt-2">
        {hours.map((h) => {
          const pct = Math.max((h.tasksCompleted / max) * 100, 4);
          const isPeak = h.tasksCompleted === max && max > 0;

          return (
            <div
              key={h.hour}
              className="flex-1 flex flex-col items-center gap-1 group relative h-full justify-end cursor-pointer"
            >
              {/* Tooltip */}
              <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute -top-7 bg-slate-900 text-white text-[10px] px-2 py-0.5 rounded shadow pointer-events-none whitespace-nowrap z-10">
                {h.tasksCompleted} tasks
              </div>

              <div
                className={`w-full rounded-t-md transition-all duration-300 ${
                  isPeak
                    ? 'bg-gradient-to-t from-purple-600 to-indigo-400 ring-2 ring-purple-400/40'
                    : 'bg-purple-500/70 hover:bg-purple-500'
                }`}
                style={{ height: `${pct}%` }}
              />
            </div>
          );
        })}
      </div>

      <div className="flex gap-1.5">
        {hours.map((h) => (
          <div
            key={h.hour}
            className="flex-1 text-center text-[10px] font-semibold text-slate-500"
          >
            {h.hour < 12 ? `${h.hour}a` : h.hour === 12 ? '12p' : `${h.hour - 12}p`}
          </div>
        ))}
      </div>
    </div>
  );
};