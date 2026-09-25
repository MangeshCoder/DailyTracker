import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { overtimeApi } from '../services/api';
import { useAuth } from '../context/Authcontext';
import type {
  OvertimeSummaryDto,
  OvertimeDayDto,
  OvertimeWeekDto,
  TeamOvertimeDto,
} from '../types';
import { PageHeader } from '../components/ui/PageHeader';
import { StatCard } from '../components/ui/StatCard';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import {
  Clock,
  Calendar,
  Building2,
  TrendingUp,
  Zap,
  Users,
  User,
  ChevronLeft,
  ChevronRight,
  Filter,
  CheckCircle2,
  AlertTriangle,
  Award,
  ChevronDown,
  ChevronUp
} from 'lucide-react';

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const STATUS_COLOR: Record<string, string> = {
  Present: 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  WFH: 'text-blue-600 dark:text-blue-400 bg-blue-500/10 border-blue-500/20',
  HalfDay: 'text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/20',
};

// ─── Avatar Component ─────────────────────────────────────────────────────────
const Avatar: React.FC<{ name: string; size?: 'xs' | 'sm' | 'md' }> = ({
  name,
  size = 'sm',
}) => {
  const sizeMap = {
    xs: 'w-6 h-6 text-[10px]',
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 text-sm font-bold',
  };
  const initials = name
    .split(' ')
    .filter(Boolean)
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <div
      className={`${sizeMap[size]} rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600
      flex items-center justify-center font-bold text-white flex-shrink-0 shadow-sm`}
    >
      {initials || 'U'}
    </div>
  );
};

// ─── Work vs Standard vs Overtime Progress Bar ────────────────────────────────
const WorkBar: React.FC<{ day: OvertimeDayDto }> = ({ day }) => {
  const scale = Math.max(day.workMinutes, day.standardMinutes, 600);
  const stdPct = Math.min(100, (day.standardMinutes / scale) * 100);
  const workPct = Math.min(100, (day.workMinutes / scale) * 100);
  const otPct = Math.max(0, workPct - stdPct);

  return (
    <div className="relative h-2.5 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
      {/* Grey — standard target zone */}
      <div
        className="absolute inset-y-0 left-0 bg-slate-300 dark:bg-slate-700 rounded-full"
        style={{ width: `${stdPct}%` }}
      />
      {/* Blue — actual work up to standard */}
      <div
        className="absolute inset-y-0 left-0 bg-blue-500 rounded-full transition-all duration-300"
        style={{ width: `${Math.min(workPct, stdPct)}%` }}
      />
      {/* Amber/Orange — overtime portion beyond standard */}
      {otPct > 0 && (
        <div
          className="absolute inset-y-0 bg-amber-500 rounded-r-full transition-all duration-300 animate-pulse"
          style={{ left: `${stdPct}%`, width: `${otPct}%` }}
        />
      )}
    </div>
  );
};

// ─── Weekly Bar Chart ─────────────────────────────────────────────────────────
const WeekChart: React.FC<{
  weeks: OvertimeWeekDto[];
  maxMinutes: number;
}> = ({ weeks, maxMinutes }) => {
  if (!weeks.length) return null;

  return (
    <div className="flex items-end gap-2 h-28 pt-4">
      {weeks.map((w) => {
        const pct = maxMinutes > 0 ? (w.totalOvertimeMinutes / maxMinutes) * 100 : 0;
        const hasOt = w.totalOvertimeMinutes > 0;

        return (
          <div
            key={w.weekNumber}
            className="flex-1 flex flex-col items-center gap-1.5 group cursor-pointer"
          >
            <span
              className={`text-[10px] font-bold ${
                hasOt ? 'text-amber-500 dark:text-amber-400' : 'text-slate-400'
              }`}
            >
              {hasOt ? w.totalOvertimeHours : '–'}
            </span>
            <div
              className="w-full bg-slate-100 dark:bg-slate-800 rounded-t-xl overflow-hidden"
              style={{ height: '70px' }}
            >
              <div
                className="w-full bg-gradient-to-t from-amber-600 to-amber-400 rounded-t-xl transition-all duration-500 group-hover:brightness-110"
                style={{
                  height: `${Math.max(pct, hasOt ? 8 : 0)}%`,
                  marginTop: `${100 - Math.max(pct, hasOt ? 8 : 0)}%`,
                }}
              />
            </div>
            <span className="text-slate-500 text-[10px] font-semibold">
              W{w.weekNumber}
            </span>
          </div>
        );
      })}
    </div>
  );
};

// ─── My Overtime View (Employee) ──────────────────────────────────────────────
const MySummaryView: React.FC<{ summary: OvertimeSummaryDto }> = ({ summary }) => {
  const [filter, setFilter] = useState<'all' | 'ot'>('all');

  const visibleDays = useMemo(
    () =>
      filter === 'ot'
        ? summary.days.filter((d) => d.hasOvertime)
        : summary.days,
    [summary.days, filter]
  );

  const maxWeekOT = useMemo(
    () => Math.max(...summary.weeks.map((w) => w.totalOvertimeMinutes), 1),
    [summary.weeks]
  );

  return (
    <div className="space-y-6">
      {/* KPI Stats Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Overtime"
          value={summary.totalOvertimeHours}
          subtitle={`${summary.daysWithOvertime} days exceeding target`}
          icon={Clock}
          color="amber"
        />
        <StatCard
          title="Days Worked"
          value={String(summary.totalWorkingDays)}
          subtitle="Total attended shifts"
          icon={Building2}
          color="blue"
        />
        <StatCard
          title="Avg / OT Day"
          value={summary.daysWithOvertime > 0 ? summary.avgOvertimePerDayHours : '–'}
          subtitle="Average surplus logged"
          icon={TrendingUp}
          color="purple"
        />
        <StatCard
          title="Peak Day"
          value={summary.peakOvertimeMinutes > 0 ? summary.peakOvertimeHours : '–'}
          subtitle={
            summary.peakOvertimeDate
              ? new Date(summary.peakOvertimeDate).toLocaleDateString('en-IN', {
                  day: '2-digit',
                  month: 'short',
                })
              : 'None recorded'
          }
          icon={Zap}
          color="emerald"
        />
      </div>

      {/* Weekly Breakdown Card */}
      {summary.weeks.length > 0 && (
        <Card className="border-slate-200/80 dark:border-slate-800 shadow-sm overflow-hidden">
          <CardHeader className="p-4 sm:p-5 border-b border-slate-200/80 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-500" />
                <span>Weekly Workload Velocity</span>
              </CardTitle>
              <span className="text-xs text-slate-500">
                Summed by calendar week
              </span>
            </div>
          </CardHeader>
          <CardContent className="p-4 sm:p-5">
            <WeekChart weeks={summary.weeks} maxMinutes={maxWeekOT} />
            <div className="flex flex-wrap gap-4 mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs">
              {summary.weeks.map((w) => (
                <div key={w.weekNumber} className="flex items-center gap-1.5">
                  <span className="text-slate-500 font-medium">{w.weekLabel}:</span>
                  <span
                    className={`font-bold ${
                      w.totalOvertimeMinutes > 0
                        ? 'text-amber-600 dark:text-amber-400'
                        : 'text-slate-400'
                    }`}
                  >
                    {w.totalOvertimeMinutes > 0 ? w.totalOvertimeHours : '0h'}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Daily Breakdown Table */}
      <Card className="border-slate-200/80 dark:border-slate-800 shadow-sm overflow-hidden">
        <CardHeader className="p-4 sm:p-5 border-b border-slate-200/80 dark:border-slate-800">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-sm font-bold text-slate-900 dark:text-white">
                Daily Work Hours Audit
              </CardTitle>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Detailed comparison against standard daily hours ({summary.standardMinutesPerDay / 60}h benchmark).
              </p>
            </div>

            {/* Filter Toggle */}
            <div className="flex gap-1 bg-slate-100 dark:bg-slate-900 p-1 rounded-xl border border-slate-200/80 dark:border-slate-800 text-xs">
              {(['all', 'ot'] as const).map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setFilter(k)}
                  className={`px-3 py-1 rounded-lg font-semibold transition cursor-pointer ${
                    filter === k
                      ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {k === 'all' ? 'All Working Days' : 'Overtime Days Only'}
                </button>
              ))}
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {/* Legend */}
          <div className="flex flex-wrap items-center gap-4 px-5 py-2.5 bg-slate-50/50 dark:bg-slate-950/40 border-b border-slate-100 dark:border-slate-800/80 text-xs text-slate-500">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2 rounded-sm bg-blue-500 inline-block" />
              <span>Standard target</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2 rounded-sm bg-amber-500 inline-block" />
              <span>Overtime logged</span>
            </span>
          </div>

          {/* Rows */}
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {visibleDays.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-xs sm:text-sm">
                {filter === 'ot'
                  ? 'No overtime logged for the selected calendar month.'
                  : 'No work records logged for this month.'}
              </div>
            ) : (
              visibleDays.map((d) => (
                <div
                  key={d.date}
                  className={`p-3.5 sm:p-4 flex items-center gap-3 sm:gap-4 transition ${
                    d.hasOvertime
                      ? 'bg-amber-500/[0.04] dark:bg-amber-500/[0.06]'
                      : 'hover:bg-slate-50/60 dark:hover:bg-slate-800/40'
                  }`}
                >
                  {/* Date + status badge */}
                  <div className="w-28 sm:w-32 flex-shrink-0">
                    <p className="text-slate-900 dark:text-slate-100 text-xs font-bold">
                      {d.dateLabel}
                    </p>
                    <span
                      className={`inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full border mt-0.5 ${
                        STATUS_COLOR[d.dayStatus] ?? 'text-slate-500 bg-slate-100 dark:bg-slate-800'
                      }`}
                    >
                      {d.dayStatus}
                    </span>
                  </div>

                  {/* Meter */}
                  <div className="flex-1 min-w-[80px]">
                    <WorkBar day={d} />
                  </div>

                  {/* Hours Label */}
                  <div className="w-32 sm:w-36 flex-shrink-0 text-right">
                    <span className="text-slate-700 dark:text-slate-300 text-xs font-semibold">
                      {d.workHours}
                    </span>
                    {d.hasOvertime && (
                      <span className="ml-2 text-xs font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">
                        +{d.overtimeHours}
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

// ─── Team View (Manager / TeamLead) ──────────────────────────────────────────
const TeamView: React.FC<{ team: TeamOvertimeDto }> = ({ team }) => {
  const [expanded, setExpanded] = useState<number | null>(null);
  const maxOT = Math.max(...team.members.map((m) => m.totalOvertimeMinutes), 1);

  return (
    <div className="space-y-6">
      {/* Team KPI Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          title="Team Total Overtime"
          value={team.teamTotalOvertimeHours}
          subtitle="Cumulative department surplus"
          icon={Clock}
          color="amber"
        />
        <StatCard
          title="Members with OT"
          value={String(team.teamMembersWithOvertime)}
          subtitle="Active overtime contributors"
          icon={Users}
          color="blue"
        />
        <StatCard
          title="Department Roster"
          value={`${team.members.length} Members`}
          subtitle="Total reporting headcount"
          icon={Building2}
          color="purple"
        />
      </div>

      {/* Leaderboard Card */}
      <Card className="border-slate-200/80 dark:border-slate-800 shadow-sm overflow-hidden">
        <CardHeader className="p-4 sm:p-5 border-b border-slate-200/80 dark:border-slate-800">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Award className="w-4 h-4 text-amber-500" />
                <span>Overtime Governance Leaderboard — {team.monthLabel}</span>
              </CardTitle>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Sorted by highest cumulative hours. Click any member to audit daily timeline.
              </p>
            </div>
          </div>
        </CardHeader>

        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {team.members.map((m, idx) => {
            const barPct = maxOT > 0 ? (m.totalOvertimeMinutes / maxOT) * 100 : 0;
            const isOpen = expanded === m.userId;

            const medalEmoji =
              idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : null;

            return (
              <div key={m.userId}>
                {/* Summary Row */}
                <div
                  onClick={() => setExpanded(isOpen ? null : m.userId)}
                  className="p-4 flex items-center gap-3.5 cursor-pointer hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition select-none"
                >
                  {/* Rank */}
                  <span className="w-6 text-center text-xs sm:text-sm font-bold text-slate-500 dark:text-slate-400 flex-shrink-0">
                    {medalEmoji || idx + 1}
                  </span>

                  <Avatar name={m.fullName} size="sm" />

                  <div className="flex-1 min-w-0">
                    <p className="text-slate-900 dark:text-slate-100 text-xs sm:text-sm font-bold truncate">
                      {m.fullName}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="flex-1 h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-amber-500 to-orange-500 rounded-full transition-all duration-500"
                          style={{ width: `${barPct}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="text-right flex-shrink-0">
                    <p
                      className={`text-xs sm:text-sm font-bold ${
                        m.totalOvertimeMinutes > 0
                          ? 'text-amber-600 dark:text-amber-400'
                          : 'text-slate-400'
                      }`}
                    >
                      {m.totalOvertimeMinutes > 0 ? m.totalOvertimeHours : '–'}
                    </p>
                    <p className="text-slate-400 text-[11px]">
                      {m.daysWithOvertime} OT {m.daysWithOvertime === 1 ? 'day' : 'days'}
                    </p>
                  </div>

                  <div className="text-slate-400 ml-1">
                    {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </div>
                </div>

                {/* Expanded Daily Breakdown */}
                {isOpen && (
                  <div className="px-5 pb-5 pt-3 bg-slate-50/50 dark:bg-slate-950/40 border-t border-slate-100 dark:border-slate-800 space-y-3 animate-in fade-in duration-150">
                    <h5 className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      Overtime Logs for {m.fullName}
                    </h5>

                    {m.days.filter((d) => d.hasOvertime).length === 0 ? (
                      <p className="text-slate-400 text-xs italic py-2">
                        No overtime days logged this month.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {m.days
                          .filter((d) => d.hasOvertime)
                          .map((d) => (
                            <div
                              key={d.date}
                              className="flex items-center gap-3 p-2 bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800"
                            >
                              <span className="text-slate-700 dark:text-slate-300 text-xs font-semibold w-28 flex-shrink-0">
                                {d.dateLabel}
                              </span>
                              <div className="flex-1">
                                <WorkBar day={d} />
                              </div>
                              <span className="text-slate-500 text-xs w-16 text-right font-medium flex-shrink-0">
                                {d.workHours}
                              </span>
                              <span className="text-amber-600 dark:text-amber-400 text-xs font-bold w-16 text-right flex-shrink-0">
                                +{d.overtimeHours}
                              </span>
                            </div>
                          ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {team.members.length === 0 && (
            <div className="text-center py-12 text-slate-400 text-xs sm:text-sm">
              No team member activity recorded for this period.
            </div>
          )}
        </div>
      </Card>
    </div>
  );
};

// ─── Main OvertimeTrackerPage ─────────────────────────────────────────────────
export const OvertimeTrackerPage: React.FC = () => {
  const { user } = useAuth();
  const isManager = user?.role === 'Manager' || user?.role === 'TeamLead';

  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [tab, setTab] = useState<'my' | 'team'>('my');

  const isCurrentMonth =
    month === now.getMonth() + 1 && year === now.getFullYear();

  const prevMonth = () => {
    if (month === 1) {
      setMonth(12);
      setYear((y) => y - 1);
    } else {
      setMonth((m) => m - 1);
    }
  };

  const nextMonth = () => {
    if (isCurrentMonth) return;
    if (month === 12) {
      setMonth(1);
      setYear((y) => y + 1);
    } else {
      setMonth((m) => m + 1);
    }
  };

  const goToday = () => {
    setMonth(now.getMonth() + 1);
    setYear(now.getFullYear());
  };

  // My overtime
  const { data: mySummary, isLoading: myLoading } = useQuery<OvertimeSummaryDto>({
    queryKey: ['overtime-my', month, year],
    queryFn: () => overtimeApi.getMy(month, year).then((r) => r.data),
    staleTime: 30_000,
  });

  // Team overtime
  const { data: teamData, isLoading: teamLoading } = useQuery<TeamOvertimeDto>({
    queryKey: ['overtime-team', month, year],
    queryFn: () => overtimeApi.getTeam(month, year).then((r) => r.data),
    staleTime: 30_000,
    enabled: isManager && tab === 'team',
  });

  const loading = tab === 'my' ? myLoading : teamLoading;

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* ── Page Header ── */}
      <PageHeader
        title="Overtime & Workload Tracker"
        description="Audit daily work hours exceeding standard benchmarks, calculate comp-off surplus, and monitor team workload distribution."
        breadcrumbs={[
          { label: 'Workspace', href: '/' },
          { label: 'Activity & Reports' },
          { label: 'Overtime Tracker' },
        ]}
        badge={{ label: 'Duty Engine Active', variant: 'amber' }}
        actions={
          <div className="flex items-center gap-1.5 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-1 rounded-2xl shadow-sm">
            <button
              type="button"
              onClick={prevMonth}
              className="w-8 h-8 flex items-center justify-center rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              title="Previous Month"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={goToday}
              className="px-3 py-1 rounded-xl text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer min-w-[130px] text-center"
            >
              {MONTHS[month - 1]} {year}
            </button>
            <button
              type="button"
              onClick={nextMonth}
              disabled={isCurrentMonth}
              className="w-8 h-8 flex items-center justify-center rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
              title="Next Month"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        }
      />

      {/* ── Tab Selector for Managers ── */}
      {isManager && (
        <div className="flex gap-1.5 bg-slate-100 dark:bg-slate-900/90 p-1 rounded-2xl border border-slate-200/80 dark:border-slate-800 w-fit">
          <button
            type="button"
            onClick={() => setTab('my')}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition cursor-pointer ${
              tab === 'my'
                ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <User className="w-4 h-4" />
            <span>My Overtime</span>
          </button>
          <button
            type="button"
            onClick={() => setTab('team')}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition cursor-pointer ${
              tab === 'team'
                ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Team Overview</span>
          </button>
        </div>
      )}

      {/* ── Main Content ── */}
      {loading ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="h-28 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl animate-pulse"
              />
            ))}
          </div>
          <div className="h-64 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl animate-pulse" />
        </div>
      ) : tab === 'my' && mySummary ? (
        <MySummaryView summary={mySummary} />
      ) : tab === 'team' && teamData ? (
        <TeamView team={teamData} />
      ) : (
        <Card className="border-slate-200/80 dark:border-slate-800">
          <CardContent className="text-center py-20 text-slate-400 space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-500 mx-auto flex items-center justify-center">
              <Clock className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              No Overtime Data for {MONTHS[month - 1]} {year}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
              Check in and log work hours beyond standard daily hours to track overtime progress.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default OvertimeTrackerPage;