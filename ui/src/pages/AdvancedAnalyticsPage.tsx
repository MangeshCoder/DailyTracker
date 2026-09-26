// ─────────────────────────────────────────────────────────────────────────────
//  FILE: ui/src/pages/AdvancedAnalyticsPage.tsx
//  Analytics - Modern Design System Upgrade
//
//  Route: /analytics
//  Logic unchanged from previous version:
//  ✅ 90-day summary (productivity score, work, tasks, support, best day)
//  ✅ Activity heatmap, productivity trend, peak hours, project breakdown
//     (chart components live in Analyticscharts.tsx)
// ─────────────────────────────────────────────────────────────────────────────

import { useQuery } from '@tanstack/react-query';
import { analyticsApi } from '../services/api';
import type { AdvancedAnalytics } from '../types';
import { HeatmapCalendar, ProjectBreakdown, ProductivityTrendChart, PeakHoursChart } from './Analyticscharts';
import { PageHeader } from '../components/ui/PageHeader';
import { StatCard } from '../components/ui/StatCard';
import { Card, CardContent } from '../components/ui/Card';
import {
  Gauge,
  Timer,
  ListChecks,
  LifeBuoy,
  Trophy,
  CalendarDays,
  TrendingUp,
  Clock,
  FolderKanban,
  Sparkles,
  Star,
} from 'lucide-react';

const SectionTitle = ({
  icon: Icon, title, subtitle, tone = 'blue',
}: {
  icon: React.ElementType; title: string; subtitle?: string;
  tone?: 'blue' | 'emerald' | 'amber' | 'violet';
}) => {
  const tones = {
    blue:    'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
    emerald: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
    amber:   'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
    violet:  'bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20',
  };
  return (
    <div className="flex items-center gap-2.5 mb-5">
      <div className={`p-2 rounded-lg border ${tones[tone]}`}>
        <Icon className="w-4 h-4" />
      </div>
      <div>
        <h3 className="text-sm font-bold text-slate-900 dark:text-white">{title}</h3>
        {subtitle && <p className="text-xs text-slate-500 dark:text-slate-400">{subtitle}</p>}
      </div>
    </div>
  );
};

export const AdvancedAnalyticsPage = () => {
  const { data: analytics, isLoading } = useQuery<AdvancedAnalytics>({
    queryKey: ['analytics'],
    queryFn: () => analyticsApi.getAdvanced(90).then(r => r.data),
  });

  const score = analytics?.overallProductivityScore ?? 0;
  const scoreColor: 'emerald' | 'blue' | 'amber' | 'rose' =
    score >= 80 ? 'emerald' : score >= 60 ? 'blue' : score >= 40 ? 'amber' : 'rose';
  const scoreLabel =
    score >= 80 ? 'Excellent' : score >= 60 ? 'Good' : score >= 40 ? 'Fair' : 'Needs focus';

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* ── Page Header ── */}
      <PageHeader
        title="Analytics"
        description="Deep insights into your productivity and work patterns."
        breadcrumbs={[
          { label: 'Workspace', href: '/' },
          { label: 'Reports' },
          { label: 'Analytics' },
        ]}
        badge={{ label: 'Last 90 days', variant: 'blue', icon: <Sparkles className="w-3 h-3" /> }}
        className="!mb-0"
      />

      {/* ── Summary ── */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
        <StatCard
          title="Productivity"
          value={`${score}%`}
          subtitle={scoreLabel}
          icon={Gauge}
          color={scoreColor}
          loading={isLoading}
        />
        <StatCard
          title="Total Work"
          value={`${Math.round((analytics?.totalWorkMinutes ?? 0) / 60)}h`}
          subtitle="Last 90 days"
          icon={Timer}
          color="blue"
          loading={isLoading}
        />
        <StatCard
          title="Tasks Completed"
          value={analytics?.totalTasksCompleted ?? 0}
          subtitle="Last 90 days"
          icon={ListChecks}
          color="purple"
          loading={isLoading}
        />
        <StatCard
          title="Support Given"
          value={analytics?.totalSupportGiven ?? 0}
          subtitle="Last 90 days"
          icon={LifeBuoy}
          color="rose"
          loading={isLoading}
        />
        <StatCard
          title="Best Day"
          value={analytics?.mostProductiveDay ?? 'N/A'}
          subtitle="Most productive"
          icon={Trophy}
          color="amber"
          loading={isLoading}
          className="col-span-2 md:col-span-1"
        />
      </div>

      {/* ── Heatmap ── */}
      <Card>
        <CardContent>
          <SectionTitle icon={CalendarDays} title="Activity Heatmap" subtitle="Last 365 days" tone="emerald" />
          <HeatmapCalendar />
        </CardContent>
      </Card>

      {/* ── Trend + Peak Hours ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardContent>
            <SectionTitle icon={TrendingUp} title="Productivity Trend" subtitle="Last 30 days" tone="blue" />
            <ProductivityTrendChart days={30} />
            <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400">
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500" /> 80%+ Excellent</span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-blue-500" /> 60–79% Good</span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-500" /> Below 60</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <SectionTitle icon={Clock} title="Peak Productivity Hours" subtitle="When you complete the most tasks" tone="amber" />
            <PeakHoursChart />
            {analytics?.mostProductiveDay && (
              <div className="flex items-center gap-2 mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400">
                <Star className="w-3.5 h-3.5 text-amber-500" />
                Most productive day of the week:
                <span className="font-bold text-amber-600 dark:text-amber-400">{analytics.mostProductiveDay}</span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Project breakdown ── */}
      <Card>
        <CardContent>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg border bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20">
                <FolderKanban className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">Project Time Breakdown</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">Last 30 days</p>
              </div>
            </div>
            {analytics?.mostWorkedProject && analytics.mostWorkedProject !== 'N/A' && (
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 w-fit">
                <Trophy className="w-3.5 h-3.5" /> Top project: {analytics.mostWorkedProject}
              </span>
            )}
          </div>
          <ProjectBreakdown />
        </CardContent>
      </Card>
    </div>
  );
};