import { useQuery } from '@tanstack/react-query';
import { analyticsApi } from '../services/api';
import { HeatmapData,ProjectTime,ProductivityTrend,PeakHour } from '../types';

// ═══════════════════════════════════════════════════════════════════════════════
//  Feature 5: GitHub-style Heatmap Calendar
// ═══════════════════════════════════════════════════════════════════════════════
const LEVEL_COLORS = [
  'bg-slate-800 hover:bg-slate-700',        // 0 - no activity
  'bg-blue-900 hover:bg-blue-800',           // 1 - light
  'bg-blue-700 hover:bg-blue-600',           // 2 - moderate
  'bg-blue-500 hover:bg-blue-400',           // 3 - good
  'bg-blue-400 hover:bg-blue-300',           // 4 - excellent
];

export const HeatmapCalendar = ({ userId }: { userId?: number }) => {
  const { data: heatmap, isLoading } = useQuery<HeatmapData[]>({
    queryKey: ['heatmap', userId],
    queryFn: () =>
      (userId
        ? analyticsApi.getUserAnalytics(userId, 365).then(r => r.data.heatmap)
        : analyticsApi.getHeatmap(365).then(r => r.data)),
  });

  if (isLoading) return (
    <div className="animate-pulse h-32 bg-slate-800 rounded-xl" />
  );

  if (!heatmap || heatmap.length === 0) return (
    <div className="text-center py-8 text-slate-500 text-sm">No activity data yet.</div>
  );

  // Build full 52-week grid
  const today = new Date();
  const startDate = new Date(today);
  startDate.setDate(today.getDate() - 364);

  const dataMap = new Map(heatmap.map(d => [d.date.split('T')[0], d]));

  // Week columns
  const weeks: Array<Array<{ date: Date; data?: HeatmapData }>> = [];
  let current = new Date(startDate);

  // Move to Sunday of the start week
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

  // Month labels
  const months: { label: string; col: number }[] = [];
  let lastMonth = -1;
  weeks.forEach((week, i) => {
    const month = week[0].date.getMonth();
    if (month !== lastMonth) {
      months.push({
        label: week[0].date.toLocaleString('default', { month: 'short' }),
        col: i
      });
      lastMonth = month;
    }
  });

  return (
    <div>
      {/* Month labels */}
      <div className="relative h-5 mb-1">
        {months.map(m => (
          <span key={`${m.label}-${m.col}`}
            className="absolute text-xs text-slate-500"
            style={{ left: `${m.col * 14}px` }}>
            {m.label}
          </span>
        ))}
      </div>

      {/* Grid */}
      <div className="flex gap-0.5 overflow-x-auto">
        {weeks.map((week, wi) => (
          <div key={wi} className="flex flex-col gap-0.5">
            {week.map((cell, di) => {
              const level = cell.data?.level ?? 0;
              const isFuture = cell.date > today;
              return (
                <div
                  key={di}
                  title={cell.data
                    ? `${cell.date.toDateString()}: ${Math.round(cell.data.workMinutes / 60 * 10) / 10}h, ${cell.data.tasksCompleted} tasks`
                    : cell.date.toDateString()}
                  className={`w-3 h-3 rounded-sm transition cursor-default ${
                    isFuture ? 'bg-transparent' : LEVEL_COLORS[level]
                  }`}
                />
              );
            })}
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-2 mt-3 justify-end">
        <span className="text-xs text-slate-500">Less</span>
        {LEVEL_COLORS.map((c, i) => (
          <div key={i} className={`w-3 h-3 rounded-sm ${c}`} />
        ))}
        <span className="text-xs text-slate-500">More</span>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
//  Feature 5: Project Time Breakdown (Pie Chart via CSS)
// ═══════════════════════════════════════════════════════════════════════════════
const PROJECT_COLORS = [
  '#3b82f6', '#8b5cf6', '#10b981', '#f59e0b',
  '#ef4444', '#06b6d4', '#ec4899', '#84cc16'
];

export const ProjectBreakdown = () => {
  const { data: projects, isLoading } = useQuery<ProjectTime[]>({
    queryKey: ['projects'],
    queryFn: () => analyticsApi.getProjects(30).then(r => r.data),
  });

  if (isLoading) return <div className="animate-pulse h-48 bg-slate-800 rounded-xl" />;
  if (!projects || projects.length === 0)
    return <div className="text-center py-8 text-slate-500 text-sm">No project data yet. Add tasks with project names!</div>;

  const totalMins = projects.reduce((s, p) => s + p.totalMinutes, 0);

  // Build conic-gradient for pie chart
  let startPct = 0;
  const segments = projects.slice(0, 8).map((p, i) => {
    const pct = (p.totalMinutes / totalMins) * 100;
    const seg = { start: startPct, end: startPct + pct, color: PROJECT_COLORS[i] };
    startPct += pct;
    return seg;
  });

  const gradient = segments
    .map(s => `${s.color} ${s.start}% ${s.end}%`)
    .join(', ');

  return (
    <div className="flex gap-6 items-center">
      {/* Pie chart */}
      <div className="relative flex-shrink-0">
        <div
          className="w-36 h-36 rounded-full shadow-xl"
          style={{ background: `conic-gradient(${gradient})` }}
        />
        <div className="absolute inset-4 bg-slate-900 rounded-full flex items-center justify-center">
          <span className="text-xs text-slate-400 font-medium">Projects</span>
        </div>
      </div>

      {/* Legend */}
      <div className="flex-1 space-y-2">
        {projects.slice(0, 8).map((p, i) => (
          <div key={p.projectName} className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full flex-shrink-0"
              style={{ backgroundColor: PROJECT_COLORS[i] }} />
            <span className="text-sm text-slate-300 flex-1 truncate">{p.projectName}</span>
            <span className="text-xs text-slate-500">{Math.round(p.totalMinutes / 60 * 10) / 10}h</span>
            <span className="text-xs font-medium text-slate-400 w-10 text-right">{p.percentage}%</span>
          </div>
        ))}
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
//  Feature 5: Productivity Trend (bar chart)
// ═══════════════════════════════════════════════════════════════════════════════
export const ProductivityTrendChart = ({ days = 14 }: { days?: number }) => {
  const { data: trend, isLoading } = useQuery<ProductivityTrend[]>({
    queryKey: ['trend', days],
    queryFn: () => analyticsApi.getAdvanced(days).then(r => r.data.productivityTrend),
  });

  if (isLoading) return <div className="animate-pulse h-36 bg-slate-800 rounded-xl" />;
  if (!trend || trend.length === 0)
    return <div className="text-center py-8 text-slate-500 text-sm">No data yet.</div>;

  const max = Math.max(...trend.map(d => d.score), 1);

  return (
    <div>
      <div className="flex items-end gap-1.5 h-32">
        {trend.map((d, i) => (
          <div key={i} className="flex-1 flex flex-col items-center gap-1">
            <div
              className="w-full rounded-t-lg transition-all duration-500 min-h-[2px]"
              style={{
                height: `${(d.score / max) * 100}%`,
                background: d.score >= 80 ? '#10b981'
                  : d.score >= 60 ? '#3b82f6' : '#f59e0b'
              }}
              title={`${d.dayName}: Score ${d.score}%, ${Math.round(d.workMinutes / 60 * 10) / 10}h, ${d.tasksCompleted} tasks`}
            />
          </div>
        ))}
      </div>
      <div className="flex gap-1.5 mt-1.5">
        {trend.map((d, i) => (
          <div key={i} className="flex-1 text-center text-[10px] text-slate-600">{d.dayName}</div>
        ))}
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
//  Feature 5: Peak Hours Bar Chart
// ═══════════════════════════════════════════════════════════════════════════════
export const PeakHoursChart = () => {
  const { data: hours, isLoading } = useQuery<PeakHour[]>({
    queryKey: ['peakHours'],
    queryFn: () => analyticsApi.getPeakHours(30).then(r => r.data),
  });

  if (isLoading) return <div className="animate-pulse h-24 bg-slate-800 rounded-xl" />;
  if (!hours || hours.length === 0)
    return <div className="text-center py-6 text-slate-500 text-sm">Complete more tasks to see peak hours!</div>;

  const max = Math.max(...hours.map(h => h.tasksCompleted), 1);

  return (
    <div>
      <div className="flex items-end gap-1.5 h-20">
        {hours.map(h => (
          <div key={h.hour} className="flex-1 flex flex-col items-center gap-1" title={`${h.hourLabel}: ${h.tasksCompleted} tasks`}>
            <div
              className="w-full bg-violet-500 rounded-t-md"
              style={{ height: `${(h.tasksCompleted / max) * 100}%`, minHeight: '2px' }}
            />
          </div>
        ))}
      </div>
      <div className="flex gap-1.5 mt-1">
        {hours.map(h => (
          <div key={h.hour} className="flex-1 text-center text-[10px] text-slate-600">
            {h.hour < 12 ? `${h.hour}am` : h.hour === 12 ? '12pm' : `${h.hour - 12}pm`}
          </div>
        ))}
      </div>
    </div>
  );
};