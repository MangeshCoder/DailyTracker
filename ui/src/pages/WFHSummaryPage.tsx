import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { wfhApi } from '../services/api';
import { useAuth } from '../context/Authcontext';
import type { TeamMonthlyAttendance, WFHRequest } from '../types';
import { PageHeader } from '../components/ui/PageHeader';
import { StatCard } from '../components/ui/StatCard';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { StatusBadge } from '../components/ui/StatusBadge';
import {
  Home,
  SunMedium,
  Clock,
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  Award,
  Calendar,
  CheckCircle2,
  Users,
  PartyPopper,
  Filter
} from 'lucide-react';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
}

function pct(value: number, total: number) {
  if (total === 0) return 0;
  return Math.round((value / total) * 100);
}

function wfhBarColor(wfhPct: number) {
  if (wfhPct >= 60) return 'from-amber-500 to-orange-500';
  if (wfhPct >= 30) return 'from-blue-500 to-indigo-500';
  return 'from-emerald-500 to-teal-500';
}

function attendanceColor(pct: number) {
  if (pct >= 90) return 'text-emerald-600 dark:text-emerald-400';
  if (pct >= 70) return 'text-amber-600 dark:text-amber-400';
  return 'text-rose-600 dark:text-rose-400';
}

// ─── Month/Year Picker Component ─────────────────────────────────────────────
function MonthYearPicker({
  month,
  year,
  onChange,
}: {
  month: number;
  year: number;
  onChange: (m: number, y: number) => void;
}) {
  const now = new Date();
  const prev = () => {
    if (month === 1) onChange(12, year - 1);
    else onChange(month - 1, year);
  };
  const next = () => {
    if (year === now.getFullYear() && month === now.getMonth() + 1) return;
    if (month === 12) onChange(1, year + 1);
    else onChange(month + 1, year);
  };
  const isFuture = year === now.getFullYear() && month === now.getMonth() + 1;

  return (
    <div className="flex items-center gap-1.5 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl px-3 py-1.5 shadow-sm">
      <button
        type="button"
        onClick={prev}
        className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
        title="Previous Month"
      >
        <ChevronLeft className="w-4 h-4" />
      </button>
      <span className="text-slate-900 dark:text-white font-semibold text-xs sm:text-sm min-w-[130px] text-center">
        {MONTH_NAMES[month - 1]} {year}
      </span>
      <button
        type="button"
        onClick={next}
        disabled={isFuture}
        className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
        title="Next Month"
      >
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  );
}

// ─── Mini Calendar (Employee View) ───────────────────────────────────────────
function MiniCalendar({
  month,
  year,
  wfhDates,
  halfDayDates,
}: {
  month: number;
  year: number;
  wfhDates: string[];
  halfDayDates: string[];
}) {
  const wfhSet = new Set(wfhDates.map((d) => d.slice(0, 10)));
  const halfDaySet = new Set(halfDayDates.map((d) => d.slice(0, 10)));
  const firstDay = new Date(year, month - 1, 1).getDay();
  const daysTotal = new Date(year, month, 0).getDate();
  const cells: (number | null)[] = [...Array(firstDay).fill(null)];
  for (let d = 1; d <= daysTotal; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const dayKey = (d: number) =>
    `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  const today = new Date();

  return (
    <Card className="border-slate-200/80 dark:border-slate-800">
      <CardHeader className="pb-3 border-b border-slate-200/80 dark:border-slate-800/80">
        <CardTitle className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <Calendar className="w-4 h-4 text-blue-500" />
          <span>
            {MONTH_NAMES[month - 1]} {year} — WFH Calendar Map
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 sm:p-5">
        <div className="grid grid-cols-7 mb-2 text-center text-[11px] font-bold text-slate-400 uppercase">
          {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d) => (
            <div key={d} className="py-1">
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {cells.map((day, i) => {
            if (!day) return <div key={i} className="aspect-square" />;
            const key = dayKey(day);
            const isWFH = wfhSet.has(key);
            const isHalfDay = halfDaySet.has(key);
            const isToday =
              today.getFullYear() === year &&
              today.getMonth() + 1 === month &&
              today.getDate() === day;
            const isWeekend = new Date(year, month - 1, day).getDay() % 6 === 0;

            return (
              <div
                key={i}
                className={`
                  aspect-square flex flex-col items-center justify-center rounded-xl text-xs font-semibold transition-all
                  ${
                    isWFH
                      ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/20'
                      : isHalfDay
                      ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30'
                      : isToday
                      ? 'ring-2 ring-blue-500 text-blue-600 dark:text-blue-400 font-bold bg-blue-50 dark:bg-blue-500/10'
                      : isWeekend
                      ? 'text-slate-400 dark:text-slate-600 bg-slate-50 dark:bg-slate-900/30'
                      : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }
                `}
              >
                <span>{day}</span>
                {isWFH && <span className="text-[9px] leading-none opacity-80">WFH</span>}
                {isHalfDay && <span className="text-[9px] leading-none opacity-80">Half</span>}
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-4 mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80 text-xs text-slate-500 dark:text-slate-400">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-md bg-blue-600" />
            <span>Full WFH</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-md bg-amber-500/30 border border-amber-500/50" />
            <span>Half Day Pass</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-md ring-2 ring-blue-500 bg-transparent" />
            <span>Today</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Employee Personal View ───────────────────────────────────────────────────
function EmployeeWFHSummary({ month, year }: { month: number; year: number }) {
  const { data: allRequests = [] } = useQuery<WFHRequest[]>({
    queryKey: ['myWFHRequests'],
    queryFn: () => wfhApi.getMy(),
  });

  const monthRequests = useMemo(
    () =>
      allRequests.filter((r) => {
        const d = new Date(r.requestDate);
        return d.getFullYear() === year && d.getMonth() + 1 === month;
      }),
    [allRequests, month, year]
  );

  const approved = monthRequests.filter((r) => r.status === 'Approved');
  const pending = monthRequests.filter((r) => r.status === 'Pending');
  const rejected = monthRequests.filter((r) => r.status === 'Rejected');
  const wfhDays = approved.filter((r) => r.requestType === 'WFH');
  const halfDays = approved.filter((r) => r.requestType === 'HalfDay');

  const ytdWFH = allRequests.filter((r) => {
    const d = new Date(r.requestDate);
    return d.getFullYear() === year && r.status === 'Approved' && r.requestType === 'WFH';
  }).length;

  const wfhDates = approved
    .filter((r) => r.requestType === 'WFH')
    .map((r) => r.requestDate.slice(0, 10));
  const halfDayDates = approved
    .filter((r) => r.requestType === 'HalfDay')
    .map((r) => r.requestDate.slice(0, 10));

  return (
    <div className="space-y-6">
      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="WFH Days"
          value={wfhDays.length}
          subtitle={`Approved in ${MONTH_NAMES[month - 1]}`}
          icon={Home}
          color="blue"
        />
        <StatCard
          title="Half Day Passes"
          value={halfDays.length}
          subtitle="Approved split shifts"
          icon={SunMedium}
          color="amber"
        />
        <StatCard
          title="Pending Requests"
          value={pending.length}
          subtitle="Awaiting lead validation"
          icon={Clock}
          color="purple"
        />
        <StatCard
          title="WFH YTD Total"
          value={ytdWFH}
          subtitle={`Full year ${year} quota`}
          icon={CalendarRange}
          color="emerald"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <MiniCalendar
          month={month}
          year={year}
          wfhDates={wfhDates}
          halfDayDates={halfDayDates}
        />

        {/* Month Request List */}
        <Card className="border-slate-200/80 dark:border-slate-800">
          <CardHeader className="pb-3 border-b border-slate-200/80 dark:border-slate-800/80">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Clock className="w-4 h-4 text-blue-500" />
                <span>
                  Log — {MONTH_NAMES[month - 1]} {year}
                </span>
              </CardTitle>
              <span className="text-xs text-slate-500">
                {monthRequests.length} Request{monthRequests.length !== 1 ? 's' : ''}
              </span>
            </div>
          </CardHeader>
          <CardContent className="p-4 sm:p-5">
            {monthRequests.length === 0 ? (
              <p className="text-slate-400 text-sm py-12 text-center">
                No WFH requests submitted for this month.
              </p>
            ) : (
              <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
                {monthRequests
                  .sort(
                    (a, b) =>
                      new Date(a.requestDate).getTime() - new Date(b.requestDate).getTime()
                  )
                  .map((r) => (
                    <div
                      key={r.id}
                      className="flex items-center justify-between p-3 rounded-xl border border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/40 hover:bg-slate-100/60 dark:hover:bg-slate-800/50 transition"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center text-sm font-bold">
                          {r.requestType === 'WFH' ? '🏡' : '⛅'}
                        </div>
                        <div>
                          <p className="text-slate-900 dark:text-white text-xs sm:text-sm font-semibold">
                            {formatDate(r.requestDate)}
                          </p>
                          <p className="text-slate-500 text-[11px]">
                            {r.requestType === 'WFH' ? 'Work From Home' : 'Half Day Pass'}
                            {r.halfDaySlot ? ` · ${r.halfDaySlot}` : ''}
                          </p>
                        </div>
                      </div>
                      <StatusBadge status={r.status} />
                    </div>
                  ))}
              </div>
            )}

            {rejected.length > 0 && (
              <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80 space-y-1.5">
                <p className="text-xs font-semibold text-rose-500">Manager Notes on Denied Requests:</p>
                {rejected.map(
                  (r) =>
                    r.reviewNote && (
                      <p key={r.id} className="text-slate-500 text-xs italic pl-2 border-l-2 border-rose-500/40">
                        {formatDate(r.requestDate)}: "{r.reviewNote}"
                      </p>
                    )
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ─── Manager Team View ────────────────────────────────────────────────────────
function TeamWFHSummary({ month, year }: { month: number; year: number }) {
  const [expandedUser, setExpandedUser] = useState<number | null>(null);
  const [sortBy, setSortBy] = useState<'name' | 'wfh' | 'attendance'>('name');

  const { data: teamData = [], isLoading } = useQuery<TeamMonthlyAttendance[]>({
    queryKey: ['team-monthly', month, year],
    queryFn: () => wfhApi.getTeamMonthly(month, year),
  });

  const sorted = useMemo(() => {
    const copy = [...teamData];
    if (sortBy === 'wfh') return copy.sort((a, b) => b.daysWFH - a.daysWFH);
    if (sortBy === 'attendance')
      return copy.sort((a, b) => b.attendancePercentage - a.attendancePercentage);
    return copy.sort((a, b) => a.fullName.localeCompare(b.fullName));
  }, [teamData, sortBy]);

  const totalWFHDays = teamData.reduce((s, m) => s + m.daysWFH, 0);
  const totalHalfDays = teamData.reduce((s, m) => s + m.daysHalfDay, 0);
  const totalWeekend = teamData.reduce((s, m) => s + (m.daysWeekend ?? 0), 0);
  const totalHoliday = teamData.reduce((s, m) => s + (m.daysHoliday ?? 0), 0);
  const avgWFHPct =
    teamData.length > 0
      ? Math.round(
          teamData.reduce((s, m) => s + pct(m.daysWFH, m.workingDaysInMonth), 0) /
            teamData.length
        )
      : 0;
  const avgAttendance =
    teamData.length > 0
      ? Math.round(
          teamData.reduce((s, m) => s + m.attendancePercentage, 0) / teamData.length
        )
      : 0;
  const topWFH = [...teamData].sort((a, b) => b.daysWFH - a.daysWFH)[0];

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="bg-slate-100 dark:bg-slate-800/60 rounded-2xl h-24 animate-pulse"
            />
          ))}
        </div>
        <div className="bg-slate-100 dark:bg-slate-800/60 rounded-2xl h-64 animate-pulse" />
      </div>
    );
  }

  if (teamData.length === 0) {
    return (
      <Card className="border-slate-200/80 dark:border-slate-800">
        <CardContent className="text-center py-20 text-slate-400 space-y-2">
          <div className="text-4xl mb-2">📊</div>
          <p className="text-base font-semibold text-slate-700 dark:text-slate-300">
            No attendance records found for {MONTH_NAMES[month - 1]} {year}
          </p>
          <p className="text-xs text-slate-400">
            Daily tracker attendance records will show once team check-ins occur.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Team WFH"
          value={`${totalWFHDays} Days`}
          subtitle={`${teamData.length} team members`}
          icon={Home}
          color="blue"
        />
        <StatCard
          title="Total Half Days"
          value={`${totalHalfDays} Passes`}
          subtitle="Partial shifts completed"
          icon={SunMedium}
          color="amber"
        />
        <StatCard
          title="Avg WFH Rate"
          value={`${avgWFHPct}%`}
          subtitle="Of total business days"
          icon={TrendingUp}
          color="purple"
        />
        <StatCard
          title="Avg Attendance"
          value={`${avgAttendance}%`}
          subtitle="Overall team presence"
          icon={CheckCircle2}
          color="emerald"
        />
      </div>

      {/* Weekend + Holiday row */}
      {(totalWeekend > 0 || totalHoliday > 0) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {totalWeekend > 0 && (
            <StatCard
              title="Weekend Days Worked"
              value={`${totalWeekend} Days`}
              subtitle="Extra duty logged"
              icon={Calendar}
              color="amber"
            />
          )}
          {totalHoliday > 0 && (
            <StatCard
              title="Holiday Days Worked"
              value={`${totalHoliday} Days`}
              subtitle="Special duty logged"
              icon={PartyPopper}
              color="purple"
            />
          )}
        </div>
      )}

      {/* Top WFH highlight banner */}
      {topWFH && topWFH.daysWFH > 0 && (
        <div className="rounded-2xl p-4 bg-gradient-to-r from-blue-500/10 via-indigo-500/10 to-transparent border border-blue-500/25 flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center flex-shrink-0">
            <Award className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-blue-600 dark:text-blue-400 font-semibold uppercase tracking-wider">
              Highest Remote Attendance
            </p>
            <p className="text-xs sm:text-sm text-slate-800 dark:text-slate-200 mt-0.5">
              <strong className="text-slate-900 dark:text-white font-bold">{topWFH.fullName}</strong> logged{' '}
              <strong className="text-blue-600 dark:text-blue-400 font-bold">{topWFH.daysWFH} days</strong> ({pct(topWFH.daysWFH, topWFH.workingDaysInMonth)}% of active business days)
            </p>
          </div>
        </div>
      )}

      {/* Sort controls */}
      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Sort by:</span>
        <div className="flex gap-1.5 bg-slate-100 dark:bg-slate-900 p-1 rounded-xl border border-slate-200/80 dark:border-slate-800">
          {(['name', 'wfh', 'attendance'] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSortBy(s)}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                sortBy === s
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {s === 'name' ? '🔤 Employee Name' : s === 'wfh' ? '🏡 WFH Days' : '✅ Attendance %'}
            </button>
          ))}
        </div>
      </div>

      {/* Team table Card */}
      <Card className="border-slate-200/80 dark:border-slate-800 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-900/90 text-slate-500 dark:text-slate-400 uppercase tracking-wider font-bold border-b border-slate-200/80 dark:border-slate-800">
              <tr>
                <th className="py-3.5 px-4">Employee</th>
                <th className="py-3.5 px-3 text-center">Present</th>
                <th className="py-3.5 px-3 text-center text-blue-600 dark:text-blue-400">WFH</th>
                <th className="py-3.5 px-3 text-center text-amber-600 dark:text-amber-400">Half Day</th>
                <th className="py-3.5 px-3 text-center text-rose-600 dark:text-rose-400">Absent</th>
                <th className="py-3.5 px-3 text-center text-orange-600 dark:text-orange-400">Weekend</th>
                <th className="py-3.5 px-3 text-center text-purple-600 dark:text-purple-400">Holiday</th>
                <th className="py-3.5 px-3 text-center">WFH %</th>
                <th className="py-3.5 px-4 text-center">Attendance %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
              {sorted.map((member) => {
                const wfhPct = pct(member.daysWFH, member.workingDaysInMonth);
                const expanded = expandedUser === member.userId;

                return (
                  <React.Fragment key={member.userId}>
                    <tr
                      onClick={() => setExpandedUser(expanded ? null : member.userId)}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition cursor-pointer"
                    >
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2.5">
                          <div
                            className={`w-2.5 h-2.5 rounded-full ${
                              member.daysWFH > 0 ? 'bg-blue-500' : 'bg-slate-400'
                            }`}
                          />
                          <div>
                            <p className="font-semibold text-slate-900 dark:text-white text-xs sm:text-sm">
                              {member.fullName}
                            </p>
                            <p className="text-[11px] text-slate-400">{member.role}</p>
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-3 text-center font-medium text-slate-700 dark:text-slate-300">
                        {member.daysPresent}
                      </td>
                      <td className="py-3.5 px-3 text-center font-bold text-blue-600 dark:text-blue-400">
                        {member.daysWFH}
                      </td>
                      <td className="py-3.5 px-3 text-center font-medium text-amber-600 dark:text-amber-400">
                        {member.daysHalfDay}
                      </td>
                      <td className="py-3.5 px-3 text-center font-medium text-rose-600 dark:text-rose-400">
                        {member.daysAbsent}
                      </td>

                      <td className="py-3.5 px-3 text-center font-medium text-orange-600 dark:text-orange-400">
                        {(member.daysWeekend ?? 0) > 0 ? member.daysWeekend : <span className="text-slate-300 dark:text-slate-600">—</span>}
                      </td>

                      <td className="py-3.5 px-3 text-center font-medium text-purple-600 dark:text-purple-400">
                        {(member.daysHoliday ?? 0) > 0 ? member.daysHoliday : <span className="text-slate-300 dark:text-slate-600">—</span>}
                      </td>

                      <td className="py-3.5 px-3 text-center">
                        <div className="flex flex-col items-center gap-1">
                          <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                            {wfhPct}%
                          </span>
                          <div className="w-14 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                            <div
                              className={`h-full bg-gradient-to-r ${wfhBarColor(wfhPct)}`}
                              style={{ width: `${wfhPct}%` }}
                            />
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-center">
                        <span className={`font-bold ${attendanceColor(member.attendancePercentage)}`}>
                          {member.attendancePercentage}%
                        </span>
                      </td>
                    </tr>

                    {/* Expanded details */}
                    {expanded && (
                      <tr>
                        <td colSpan={9} className="bg-slate-50 dark:bg-slate-900/50 p-4 border-t border-slate-100 dark:border-slate-800">
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                            {/* WFH dates */}
                            <div>
                              <p className="text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1.5 uppercase">
                                🏡 WFH Dates ({member.daysWFH})
                              </p>
                              {member.wfhDates.length === 0 ? (
                                <p className="text-slate-400 text-xs">None</p>
                              ) : (
                                <div className="flex flex-wrap gap-1">
                                  {member.wfhDates.sort().map((d) => (
                                    <span
                                      key={d}
                                      className="px-2 py-0.5 bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-lg text-[11px] font-medium border border-blue-500/20"
                                    >
                                      {formatDate(d)}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>

                            {/* Half day dates */}
                            <div>
                              <p className="text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1.5 uppercase">
                                ⛅ Half Days ({member.daysHalfDay})
                              </p>
                              {member.halfDayDates.length === 0 ? (
                                <p className="text-slate-400 text-xs">None</p>
                              ) : (
                                <div className="flex flex-wrap gap-1">
                                  {member.halfDayDates.sort().map((d) => (
                                    <span
                                      key={d}
                                      className="px-2 py-0.5 bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-lg text-[11px] font-medium border border-amber-500/20"
                                    >
                                      {formatDate(d)}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>

                            {/* Weekend / Holiday dates */}
                            {((member.daysWeekend ?? 0) > 0 || (member.daysHoliday ?? 0) > 0) && (
                              <div>
                                <p className="text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1.5 uppercase">
                                  📅 Weekend / Holiday Duties
                                </p>
                                <div className="flex flex-wrap gap-1">
                                  {(member.weekendDates ?? []).sort().map((d) => (
                                    <span
                                      key={d}
                                      className="px-2 py-0.5 bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400 rounded-lg text-[11px] font-medium border border-orange-500/20"
                                    >
                                      {formatDate(d)} (Wknd)
                                    </span>
                                  ))}
                                  {(member.holidayDates ?? []).sort().map((d) => (
                                    <span
                                      key={d}
                                      className="px-2 py-0.5 bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400 rounded-lg text-[11px] font-medium border border-purple-500/20"
                                    >
                                      {formatDate(d)} (Hol)
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Performance statistics */}
                            <div>
                              <p className="text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1.5 uppercase">
                                📈 Work Hours & Tasks
                              </p>
                              <div className="space-y-1 text-xs">
                                <div className="flex justify-between">
                                  <span className="text-slate-500">Total Hours:</span>
                                  <span className="font-semibold text-slate-900 dark:text-white">
                                    {member.totalWorkHours}h
                                  </span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-slate-500">Avg Daily:</span>
                                  <span className="font-semibold text-slate-900 dark:text-white">
                                    {member.averageDailyHours}h
                                  </span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-slate-500">Tasks Completed:</span>
                                  <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                                    {member.totalTasksCompleted}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <p className="text-xs text-slate-400 text-right pr-2">
        Click any row to reveal specific attendance dates · {teamData.length} active team members
      </p>
    </div>
  );
}

// ─── Main Page Component ──────────────────────────────────────────────────────
export function WFHSummaryPage() {
  const { user } = useAuth();
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const isManager = user?.role === 'Manager' || user?.role === 'TeamLead';

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      <PageHeader
        title="WFH & Attendance Summary"
        description={
          isManager
            ? 'Monthly WFH allocation and attendance matrices across your organization.'
            : 'Personal monthly remote attendance distribution and request logs.'
        }
        breadcrumbs={[
          { label: 'Workspace', href: '/' },
          { label: 'HR & Requests' },
          { label: 'WFH Summary' },
        ]}
        badge={{ label: 'Monthly Auditing Active', variant: 'blue' }}
        actions={
          <MonthYearPicker
            month={month}
            year={year}
            onChange={(m, y) => {
              setMonth(m);
              setYear(y);
            }}
          />
        }
      />

      {isManager ? (
        <TeamWFHSummary month={month} year={year} />
      ) : (
        <EmployeeWFHSummary month={month} year={year} />
      )}
    </div>
  );
}

export default WFHSummaryPage;