import { useQuery } from '@tanstack/react-query';
import { analyticsApi } from '../services/api';
import { AdvancedAnalytics } from '../types';
import { HeatmapCalendar,ProjectBreakdown,ProductivityTrendChart,PeakHoursChart } from './Analyticscharts';
import { Skeleton } from '../components/Skeleton';

export const AdvancedAnalyticsPage = () => {
  const { data: analytics, isLoading } = useQuery<AdvancedAnalytics>({
    queryKey: ['analytics'],
    queryFn: () => analyticsApi.getAdvanced(90).then(r => r.data),
  });

  const scoreColor = (s: number) =>
    s >= 80 ? 'text-emerald-400' : s >= 60 ? 'text-blue-400' : s >= 40 ? 'text-amber-400' : 'text-red-400';

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Analytics</h1>
        <p className="text-slate-400 text-sm mt-1">Deep insights into your productivity and work patterns</p>
      </div>

      {/* Summary cards */}
      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {[
            { label: 'Productivity Score', value: `${analytics?.overallProductivityScore ?? 0}%`, sub: 'Last 90 days', color: scoreColor(analytics?.overallProductivityScore ?? 0) },
            { label: 'Total Work', value: `${Math.round((analytics?.totalWorkMinutes ?? 0) / 60)}h`, sub: 'Last 90 days', color: 'text-blue-400' },
            { label: 'Tasks Completed', value: analytics?.totalTasksCompleted?.toString() ?? '0', sub: 'Last 90 days', color: 'text-violet-400' },
            { label: 'Support Given', value: analytics?.totalSupportGiven?.toString() ?? '0', sub: 'Last 90 days', color: 'text-pink-400' },
            { label: 'Best Day', value: analytics?.mostProductiveDay ?? 'N/A', sub: 'Most productive', color: 'text-amber-400' },
          ].map(card => (
            <div key={card.label} className="bg-slate-900 border border-slate-800 rounded-2xl p-4 text-center">
              <p className={`text-2xl font-bold ${card.color}`}>{card.value}</p>
              <p className="text-xs text-white font-medium mt-1">{card.label}</p>
              <p className="text-xs text-slate-500 mt-0.5">{card.sub}</p>
            </div>
          ))}
        </div>
      )}

      {/* Heatmap */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
        <h3 className="text-sm font-semibold text-white mb-4">📅 Activity Heatmap (Last 365 Days)</h3>
        <HeatmapCalendar />
      </div>

      {/* Trend + Peak Hours */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <h3 className="text-sm font-semibold text-white mb-4">📈 Productivity Trend (Last 30 Days)</h3>
          <ProductivityTrendChart days={30} />
          <div className="flex gap-3 mt-3 text-xs text-slate-500">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500" /> 80%+ Excellent</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500" /> 60-79% Good</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500" /> Below 60</span>
          </div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <h3 className="text-sm font-semibold text-white mb-4">⏰ Peak Productivity Hours</h3>
          <PeakHoursChart />
          {analytics?.mostProductiveDay && (
            <p className="text-xs text-slate-400 mt-3">
              📅 Most productive day of the week: <span className="text-amber-400 font-medium">{analytics.mostProductiveDay}</span>
            </p>
          )}
        </div>
      </div>

      {/* Project breakdown */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
        <h3 className="text-sm font-semibold text-white mb-4">🗂️ Project Time Breakdown (Last 30 Days)</h3>
        {analytics?.mostWorkedProject && analytics.mostWorkedProject !== 'N/A' && (
          <p className="text-xs text-slate-400 mb-4">
            🏆 Most worked project: <span className="text-blue-400 font-medium">{analytics.mostWorkedProject}</span>
          </p>
        )}
        <ProjectBreakdown />
      </div>
    </div>
  );
};