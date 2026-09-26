// ─────────────────────────────────────────────────────────────────────────────
//  FILE: ui/src/components/TeamMonthlyAttendance.tsx
//  Manager WFH Dashboard → "Monthly" tab — light/dark upgrade
//
//  Logic unchanged: month/year → wfhApi.getTeamMonthly → attendance table.
//  Year list now runs up to the current year (was fixed 2024–2026).
// ─────────────────────────────────────────────────────────────────────────────

import { useQuery } from '@tanstack/react-query';
import { wfhApi } from '../services/api';
import type { TeamMonthlyAttendance } from '../types';
import { useState } from 'react';
import { Card } from './ui/Card';
import { ChevronDown, CalendarRange, Inbox } from 'lucide-react';

const SELECT_CLS =
  'appearance-none bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white ' +
  'rounded-xl pl-3.5 pr-9 py-2.5 text-sm font-medium cursor-pointer ' +
  'focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition';

const START_YEAR = 2024;
const YEARS = Array.from({ length: new Date().getFullYear() - START_YEAR + 1 }, (_, i) => START_YEAR + i);

export const TeamMonthlyAttendances = () => {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());

  const { data: members = [], isLoading } = useQuery<TeamMonthlyAttendance[]>({
    queryKey: ['teamMonthly', month, year],
    queryFn: () => wfhApi.getTeamMonthly(month, year),
  });

  const monthOptions = Array.from({ length: 12 }, (_, i) => ({
    value: i + 1,
    label: new Date(2024, i).toLocaleString('default', { month: 'long' })
  }));

  const heads: { l: string; c: string; a?: string }[] = [
    { l: 'Employee',      c: 'text-slate-500 dark:text-slate-400', a: 'text-left pl-5' },
    { l: 'Present',       c: 'text-emerald-600 dark:text-emerald-400' },
    { l: 'WFH',           c: 'text-blue-600 dark:text-blue-400' },
    { l: 'Half Day',      c: 'text-amber-600 dark:text-amber-400' },
    { l: 'Absent',        c: 'text-rose-600 dark:text-rose-400' },
    { l: 'Attendance',    c: 'text-slate-500 dark:text-slate-400' },
    { l: 'Weekend',       c: 'text-orange-600 dark:text-orange-400' },
    { l: 'Holiday',       c: 'text-violet-600 dark:text-violet-400' },
    { l: 'Avg Hrs/Day',   c: 'text-slate-500 dark:text-slate-400' },
    { l: 'Tasks Done',    c: 'text-slate-500 dark:text-slate-400', a: 'text-center pr-5' },
  ];

  return (
    <div className="space-y-4">
      {/* Month / year selector */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-700 dark:text-slate-300 mr-1">
          <CalendarRange className="w-4 h-4 text-blue-500" /> Period
        </span>
        <div className="relative">
          <select value={month} onChange={e => setMonth(+e.target.value)} className={SELECT_CLS}>
            {monthOptions.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
          <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>
        <div className="relative">
          <select value={year} onChange={e => setYear(+e.target.value)} className={SELECT_CLS}>
            {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>
      </div>

      {isLoading ? (
        <div className="h-64 bg-slate-100 dark:bg-slate-800/60 rounded-2xl animate-pulse" />
      ) : members.length === 0 ? (
        <div className="text-center py-14 rounded-3xl border-2 border-dashed border-slate-200 dark:border-slate-800">
          <Inbox className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-600" />
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 mt-2">No attendance data for this month</p>
        </div>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[900px]">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/40 border-b border-slate-200 dark:border-slate-800">
                  {heads.map(h => (
                    <th key={h.l} className={`px-3 py-3 text-[11px] font-semibold uppercase tracking-wider ${h.c} ${h.a ?? 'text-center'}`}>
                      {h.l}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                {members.map(m => {
                  const pct = m.attendancePercentage;
                  const pctColor = pct >= 90 ? 'text-emerald-600 dark:text-emerald-400' : pct >= 75 ? 'text-amber-600 dark:text-amber-400' : 'text-rose-600 dark:text-rose-400';
                  const barColor = pct >= 90 ? 'bg-emerald-500' : pct >= 75 ? 'bg-amber-500' : 'bg-rose-500';

                  return (
                    <tr key={m.userId} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition">
                      <td className="pl-5 pr-3 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center text-xs font-bold text-white shrink-0">
                            {m.fullName.charAt(0)}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">{m.fullName}</p>
                            <p className="text-xs text-slate-500 dark:text-slate-400">{m.role}</p>
                          </div>
                        </div>
                      </td>
                      <td className="text-center px-3 py-3 font-semibold text-emerald-600 dark:text-emerald-400">{m.daysPresent}</td>
                      <td className="text-center px-3 py-3 font-semibold text-blue-600 dark:text-blue-400">{m.daysWFH}</td>
                      <td className="text-center px-3 py-3 font-semibold text-amber-600 dark:text-amber-400">{m.daysHalfDay}</td>
                      <td className="text-center px-3 py-3 font-semibold text-rose-600 dark:text-rose-400">{m.daysAbsent}</td>
                      <td className="text-center px-3 py-3">
                        <div className="inline-flex flex-col items-center gap-1">
                          <span className={`font-bold ${pctColor}`}>{pct}%</span>
                          <div className="w-16 h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${barColor}`} style={{ width: `${Math.min(100, pct)}%` }} />
                          </div>
                        </div>
                      </td>
                      <td className="text-center px-3 py-3 font-semibold text-orange-600 dark:text-orange-400">
                        {m.daysWeekend > 0 ? m.daysWeekend : <span className="text-slate-300 dark:text-slate-600">—</span>}
                      </td>
                      <td className="text-center px-3 py-3 font-semibold text-violet-600 dark:text-violet-400">
                        {m.daysHoliday > 0 ? m.daysHoliday : <span className="text-slate-300 dark:text-slate-600">—</span>}
                      </td>
                      <td className="text-center px-3 py-3 text-slate-700 dark:text-slate-300">{m.averageDailyHours}h</td>
                      <td className="text-center pl-3 pr-5 py-3 text-slate-700 dark:text-slate-300">{m.totalTasksCompleted}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
};
