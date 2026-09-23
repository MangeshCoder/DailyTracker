// ─────────────────────────────────────────────────────────────────────────────
//  FILE: frontend/src/pages/OvertimeTrackerPage.tsx
//  ACTION: CREATE this as a new file
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { overtimeApi } from '../services/api';
import { useAuth } from '../context/Authcontext';
import type {
  OvertimeSummaryDto,
  OvertimeDayDto,
  OvertimeWeekDto,
  TeamOvertimeDto,
} from '../types';

// ─── Constants ────────────────────────────────────────────────────────────────

const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];

const STATUS_COLOR: Record<string, string> = {
  Present: 'text-emerald-400',
  WFH:     'text-blue-400',
  HalfDay: 'text-amber-400',
};

// ─── Avatar (initials-based, no photo since User model has no photo field) ────
const Avatar = ({ name, size = 'sm' }: { name: string; size?: 'xs' | 'sm' | 'md' }) => {
  const sizeMap = {
    xs: 'w-6 h-6 text-[10px]',
    sm: 'w-8 h-8 text-xs',
    md: 'w-11 h-11 text-sm',
  };
  const initials = name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className={`${sizeMap[size]} rounded-full bg-gradient-to-br from-violet-500 to-blue-600
      flex items-center justify-center font-bold text-white flex-shrink-0`}>
      {initials}
    </div>
  );
};

// ─── Work vs Standard vs Overtime bar for a single day ───────────────────────
const WorkBar = ({ day }: { day: OvertimeDayDto }) => {
  // Scale to the bigger of (workMinutes, standardMinutes, 600)
  const scale    = Math.max(day.workMinutes, day.standardMinutes, 600);
  const stdPct   = Math.min(100, (day.standardMinutes / scale) * 100);
  const workPct  = Math.min(100, (day.workMinutes    / scale) * 100);
  const otPct    = Math.max(0, workPct - stdPct);

  return (
    <div className="relative h-3 w-full rounded-full bg-slate-800 overflow-hidden">
      {/* Grey — standard target zone */}
      <div className="absolute inset-y-0 left-0 bg-slate-600 rounded-full"
        style={{ width: `${stdPct}%` }} />
      {/* Blue — actual work up to standard */}
      <div className="absolute inset-y-0 left-0 bg-blue-500 rounded-full transition-all"
        style={{ width: `${Math.min(workPct, stdPct)}%` }} />
      {/* Orange — overtime portion beyond standard */}
      {otPct > 0 && (
        <div className="absolute inset-y-0 bg-orange-500 rounded-r-full transition-all"
          style={{ left: `${stdPct}%`, width: `${otPct}%` }} />
      )}
    </div>
  );
};

// ─── Weekly bar chart ─────────────────────────────────────────────────────────
const WeekChart = ({
  weeks,
  maxMinutes,
}: {
  weeks: OvertimeWeekDto[];
  maxMinutes: number;
}) => {
  if (!weeks.length) return null;

  return (
    <div className="flex items-end gap-2 h-28">
      {weeks.map(w => {
        const pct = maxMinutes > 0
          ? (w.totalOvertimeMinutes / maxMinutes) * 100
          : 0;
        const hasOt = w.totalOvertimeMinutes > 0;

        return (
          <div key={w.weekNumber} className="flex-1 flex flex-col items-center gap-1">
            <span className={`text-[10px] font-semibold ${hasOt ? 'text-orange-400' : 'text-slate-600'}`}>
              {hasOt ? w.totalOvertimeHours : '–'}
            </span>
            <div className="w-full bg-slate-800 rounded-t-lg overflow-hidden"
              style={{ height: '72px' }}>
              <div
                className="w-full bg-gradient-to-t from-orange-600 to-orange-400 rounded-t-lg
                  transition-all duration-500 mt-auto"
                style={{
                  height: `${Math.max(pct, hasOt ? 4 : 0)}%`,
                  marginTop: `${100 - Math.max(pct, hasOt ? 4 : 0)}%`,
                }}
              />
            </div>
            <span className="text-slate-500 text-[10px]">W{w.weekNumber}</span>
          </div>
        );
      })}
    </div>
  );
};

// ─── Month navigation ─────────────────────────────────────────────────────────
const MonthNav = ({
  month,
  year,
  onChange,
}: {
  month: number;
  year: number;
  onChange: (m: number, y: number) => void;
}) => {
  const now = new Date();
  const isCurrentMonth =
    month === now.getMonth() + 1 && year === now.getFullYear();

  const prev = () => {
    if (month === 1) onChange(12, year - 1);
    else onChange(month - 1, year);
  };

  const next = () => {
    if (isCurrentMonth) return;
    if (month === 12) onChange(1, year + 1);
    else onChange(month + 1, year);
  };

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={prev}
        className="w-8 h-8 flex items-center justify-center rounded-xl
          bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 transition">
        ‹
      </button>
      <span className="text-white font-semibold text-sm min-w-[130px] text-center">
        {MONTHS[month - 1]} {year}
      </span>
      <button
        onClick={next}
        disabled={isCurrentMonth}
        className="w-8 h-8 flex items-center justify-center rounded-xl
          bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 transition
          disabled:opacity-30 disabled:cursor-not-allowed">
        ›
      </button>
    </div>
  );
};

// ─── My Overtime View (employee) ──────────────────────────────────────────────
const MySummaryView = ({ summary }: { summary: OvertimeSummaryDto }) => {
  const [filter, setFilter] = useState<'all' | 'ot'>('all');

  const visibleDays = useMemo(
    () => filter === 'ot'
      ? summary.days.filter(d => d.hasOvertime)
      : summary.days,
    [summary.days, filter]
  );

  const maxWeekOT = useMemo(
    () => Math.max(...summary.weeks.map(w => w.totalOvertimeMinutes), 1),
    [summary.weeks]
  );

  const stats = [
    {
      icon:  '⏱️',
      label: 'Total Overtime',
      value: summary.totalOvertimeHours,
      sub:   `${summary.daysWithOvertime} day${summary.daysWithOvertime !== 1 ? 's' : ''} with OT`,
      color: 'text-orange-400',
      bg:    'bg-orange-500/10 border-orange-500/20',
    },
    {
      icon:  '📅',
      label: 'Days Worked',
      value: String(summary.totalWorkingDays),
      sub:   `${summary.daysWithOvertime} had overtime`,
      color: 'text-blue-400',
      bg:    'bg-blue-500/10 border-blue-500/20',
    },
    {
      icon:  '📊',
      label: 'Avg / OT Day',
      value: summary.daysWithOvertime > 0 ? summary.avgOvertimePerDayHours : '–',
      sub:   'average on overtime days',
      color: 'text-violet-400',
      bg:    'bg-violet-500/10 border-violet-500/20',
    },
    {
      icon:  '🏆',
      label: 'Peak Day',
      value: summary.peakOvertimeMinutes > 0 ? summary.peakOvertimeHours : '–',
      sub:   summary.peakOvertimeDate
        ? new Date(summary.peakOvertimeDate).toLocaleDateString('en-IN', {
            day: '2-digit', month: 'short',
          })
        : 'No overtime yet',
      color: 'text-emerald-400',
      bg:    'bg-emerald-500/10 border-emerald-500/20',
    },
  ];

  return (
    <div className="space-y-6">

      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {stats.map(s => (
          <div key={s.label} className={`rounded-2xl border p-4 ${s.bg}`}>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg">{s.icon}</span>
              <span className="text-slate-500 text-xs">{s.label}</span>
            </div>
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-slate-600 text-xs mt-0.5">{s.sub}</p>
          </div>
        ))}
      </div>

      {/* Weekly chart */}
      {summary.weeks.length > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <h3 className="text-white font-semibold text-sm mb-4">
            Weekly Overtime Breakdown
          </h3>
          <WeekChart weeks={summary.weeks} maxMinutes={maxWeekOT} />
          <div className="flex flex-wrap gap-4 mt-3 pt-3 border-t border-slate-800">
            {summary.weeks.map(w => (
              <div key={w.weekNumber} className="text-xs">
                <span className="text-slate-500">{w.weekLabel}:</span>{' '}
                <span className={
                  w.totalOvertimeMinutes > 0
                    ? 'text-orange-400 font-semibold'
                    : 'text-slate-600'
                }>
                  {w.totalOvertimeMinutes > 0 ? w.totalOvertimeHours : 'No OT'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Daily breakdown */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-800">
          <h3 className="text-white font-semibold text-sm">Daily Breakdown</h3>
          <div className="flex rounded-xl overflow-hidden border border-slate-700">
            {([['all', 'All Days'], ['ot', 'OT Days Only']] as const).map(([k, l]) => (
              <button
                key={k}
                onClick={() => setFilter(k)}
                className={`px-3 py-1 text-xs font-medium transition
                  ${filter === k
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-800 text-slate-400 hover:text-white'}`}>
                {l}
              </button>
            ))}
          </div>
        </div>

        {/* Legend */}
        <div className="flex gap-4 px-4 py-2 border-b border-slate-800/60">
          {[
            { color: 'bg-blue-500',   label: 'Standard hours' },
            { color: 'bg-orange-500', label: 'Overtime'       },
            { color: 'bg-slate-600',  label: 'Remaining'      },
          ].map(l => (
            <span key={l.label} className="flex items-center gap-1.5 text-xs text-slate-500">
              <span className={`w-3 h-2 rounded-sm inline-block ${l.color}`} />
              {l.label}
            </span>
          ))}
        </div>

        {/* Rows */}
        <div className="divide-y divide-slate-800/60">
          {visibleDays.length === 0 ? (
            <p className="text-slate-600 text-sm italic text-center py-10">
              {filter === 'ot'
                ? 'No overtime days this month.'
                : 'No work logs found for this month.'}
            </p>
          ) : visibleDays.map(d => (
            <div
              key={d.date}
              className={`px-4 py-3 flex items-center gap-3
                ${d.hasOvertime ? 'bg-orange-500/[0.03]' : ''}`}>

              {/* Date + status */}
              <div className="w-28 flex-shrink-0">
                <p className="text-slate-300 text-xs font-medium">{d.dateLabel}</p>
                <span className={`text-[10px] font-semibold
                  ${STATUS_COLOR[d.dayStatus] ?? 'text-slate-500'}`}>
                  {d.dayStatus}
                </span>
              </div>

              {/* Bar */}
              <div className="flex-1">
                <WorkBar day={d} />
              </div>

              {/* Hours */}
              <div className="w-40 flex-shrink-0 text-right">
                <span className="text-slate-400 text-xs">{d.workHours}</span>
                {d.hasOvertime && (
                  <span className="ml-2 text-orange-400 text-xs font-semibold">
                    +{d.overtimeHours}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Footer note */}
      <p className="text-slate-600 text-xs text-center">
        Standard workday: {summary.standardMinutesPerDay / 60}h
        ({summary.standardMinutesPerDay} min).
        Overtime = actual work − standard.
        Per-day target uses your Daily Goal if set, otherwise 8h default.
      </p>
    </div>
  );
};

// ─── Team View (Manager / TeamLead) ──────────────────────────────────────────
const TeamView = ({ team }: { team: TeamOvertimeDto }) => {
  const [expanded, setExpanded] = useState<number | null>(null);
  const maxOT = Math.max(...team.members.map(m => m.totalOvertimeMinutes), 1);

  return (
    <div className="space-y-5">

      {/* Team stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          {
            icon:  '⏱️',
            label: 'Team Total Overtime',
            value: team.teamTotalOvertimeHours,
            color: 'text-orange-400',
            bg:    'bg-orange-500/10 border-orange-500/20',
          },
          {
            icon:  '👥',
            label: 'Members with OT',
            value: String(team.teamMembersWithOvertime),
            color: 'text-blue-400',
            bg:    'bg-blue-500/10 border-blue-500/20',
          },
          {
            icon:  '🏢',
            label: 'Team Size',
            value: String(team.members.length),
            color: 'text-violet-400',
            bg:    'bg-violet-500/10 border-violet-500/20',
          },
        ].map(s => (
          <div key={s.label} className={`rounded-2xl border p-4 ${s.bg}`}>
            <div className="flex items-center gap-2 mb-2">
              <span>{s.icon}</span>
              <span className="text-slate-500 text-xs">{s.label}</span>
            </div>
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Leaderboard */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="p-4 border-b border-slate-800">
          <h3 className="text-white font-semibold text-sm">
            Overtime Leaderboard — {team.monthLabel}
          </h3>
          <p className="text-slate-500 text-xs mt-0.5">
            Sorted by total overtime, highest first. Click any row to see daily breakdown.
          </p>
        </div>

        <div className="divide-y divide-slate-800/60">
          {team.members.map((m, idx) => {
            const barPct  = maxOT > 0 ? (m.totalOvertimeMinutes / maxOT) * 100 : 0;
            const isOpen  = expanded === m.userId;
            const rankColor =
              idx === 0 ? 'text-amber-400' :
              idx === 1 ? 'text-slate-300' :
              idx === 2 ? 'text-orange-600' :
                          'text-slate-600';

            return (
              <div key={m.userId}>

                {/* Summary row */}
                <div
                  onClick={() => setExpanded(isOpen ? null : m.userId)}
                  className="px-4 py-3 flex items-center gap-3 cursor-pointer
                    hover:bg-slate-800/30 transition">

                  {/* Rank */}
                  <span className={`w-6 text-center text-sm font-bold flex-shrink-0 ${rankColor}`}>
                    {idx + 1}
                  </span>

                  <Avatar name={m.fullName} size="sm" />

                  <div className="flex-1 min-w-0">
                    <p className="text-slate-200 text-sm font-medium truncate">
                      {m.fullName}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-orange-500 rounded-full transition-all duration-500"
                          style={{ width: `${barPct}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="text-right flex-shrink-0">
                    <p className={`text-sm font-bold
                      ${m.totalOvertimeMinutes > 0 ? 'text-orange-400' : 'text-slate-600'}`}>
                      {m.totalOvertimeMinutes > 0 ? m.totalOvertimeHours : '–'}
                    </p>
                    <p className="text-slate-600 text-xs">
                      {m.daysWithOvertime} OT day{m.daysWithOvertime !== 1 ? 's' : ''}
                    </p>
                  </div>

                  <span className="text-slate-600 text-xs ml-1">
                    {isOpen ? '▲' : '▼'}
                  </span>
                </div>

                {/* Expanded daily breakdown */}
                {isOpen && (
                  <div className="px-4 pb-4 bg-slate-800/20 border-t border-slate-800/60">
                    {m.days.filter(d => d.hasOvertime).length === 0 ? (
                      <p className="text-slate-600 text-xs italic py-3">
                        No overtime days this month.
                      </p>
                    ) : (
                      <>
                        {/* Legend */}
                        <div className="flex gap-4 py-2">
                          {[
                            { color: 'bg-blue-500',   label: 'Standard' },
                            { color: 'bg-orange-500', label: 'Overtime' },
                          ].map(l => (
                            <span key={l.label}
                              className="flex items-center gap-1.5 text-xs text-slate-500">
                              <span className={`w-3 h-2 rounded-sm inline-block ${l.color}`} />
                              {l.label}
                            </span>
                          ))}
                        </div>

                        <div className="space-y-2">
                          {m.days.filter(d => d.hasOvertime).map(d => (
                            <div key={d.date}
                              className="flex items-center gap-3">
                              <span className="text-slate-500 text-xs w-28 flex-shrink-0">
                                {d.dateLabel}
                              </span>
                              <div className="flex-1">
                                <WorkBar day={d} />
                              </div>
                              <span className="text-slate-400 text-xs w-14 text-right flex-shrink-0">
                                {d.workHours}
                              </span>
                              <span className="text-orange-400 text-xs font-semibold w-14 text-right flex-shrink-0">
                                +{d.overtimeHours}
                              </span>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {team.members.length === 0 && (
            <p className="text-slate-600 text-sm italic text-center py-10">
              No team members found.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── Main Page ────────────────────────────────────────────────────────────────
export const OvertimeTrackerPage = () => {
  const { user } = useAuth();
  const isManager = user?.role === 'Manager' || user?.role === 'TeamLead';

  const now   = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year,  setYear]  = useState(now.getFullYear());
  const [tab,   setTab]   = useState<'my' | 'team'>('my');

  // My overtime
  const {
    data: mySummary,
    isLoading: myLoading,
  } = useQuery<OvertimeSummaryDto>({
    queryKey: ['overtime-my', month, year],
    queryFn:  () => overtimeApi.getMy(month, year).then(r => r.data),
    staleTime: 30_000,
  });

  // Team overtime (only fetched when on team tab)
  const {
    data: teamData,
    isLoading: teamLoading,
  } = useQuery<TeamOvertimeDto>({
    queryKey: ['overtime-team', month, year],
    queryFn:  () => overtimeApi.getTeam(month, year).then(r => r.data),
    staleTime: 30_000,
    enabled:  isManager && tab === 'team',
  });

  const loading = tab === 'my' ? myLoading : teamLoading;

  return (
    <div className="p-6 max-w-5xl mx-auto">

      {/* Page header */}
      <div className="flex items-start justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Overtime Tracker ⏱️</h1>
          <p className="text-slate-400 text-sm mt-1">
            Track work hours beyond the standard{' '}
            {mySummary ? mySummary.standardMinutesPerDay / 60 : 8}h workday
          </p>
        </div>
        <MonthNav
          month={month}
          year={year}
          onChange={(m, y) => { setMonth(m); setYear(y); }}
        />
      </div>

      {/* My / Team tabs — visible to Manager and TeamLead only */}
      {isManager && (
        <div className="flex rounded-xl overflow-hidden border border-slate-700 w-fit mb-6">
          {([['my', 'My Overtime'], ['team', 'Team Overview']] as const).map(([k, l]) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={`px-5 py-2 text-sm font-medium transition
                ${tab === k
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-800 text-slate-400 hover:text-white'}`}>
              {l}
            </button>
          ))}
        </div>
      )}

      {/* Content */}
      {loading ? (
        // Skeleton
        <div className="space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[...Array(4)].map((_, i) => (
              <div key={i}
                className="h-24 bg-slate-900 border border-slate-800 rounded-2xl animate-pulse" />
            ))}
          </div>
          <div className="h-64 bg-slate-900 border border-slate-800 rounded-2xl animate-pulse" />
        </div>
      ) : tab === 'my' && mySummary ? (
        <MySummaryView summary={mySummary} />
      ) : tab === 'team' && teamData ? (
        <TeamView team={teamData} />
      ) : (
        // Empty state
        <div className="text-center py-16 border-2 border-dashed border-slate-800 rounded-2xl">
          <div className="text-4xl mb-3">⏱️</div>
          <p className="text-slate-300 font-semibold">No data for this month</p>
          <p className="text-slate-500 text-sm mt-1">
            Check in and log work hours to start tracking overtime
          </p>
        </div>
      )}
    </div>
  );
};