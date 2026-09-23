// ─────────────────────────────────────────────────────────────────────────────
//  FILE 4: frontend/src/pages/WFHSummaryPage.tsx
//  ACTION: REPLACE entire file
//
//  Changes from original:
//  1. Table now has Weekend (orange) and Holiday (violet) columns
//  2. Expanded row shows WeekendDates and HolidayDates
//  3. Stats bar includes weekend + holiday segments
//  4. Summary cards unchanged (WFH-focused)
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { wfhApi } from '../services/api';
import { useAuth } from '../context/Authcontext';
import type { TeamMonthlyAttendance, WFHRequest } from '../types';

const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
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
  if (wfhPct >= 60) return 'bg-orange-500';
  if (wfhPct >= 30) return 'bg-blue-500';
  return 'bg-green-500';
}

function attendanceColor(pct: number) {
  if (pct >= 90) return 'text-green-400';
  if (pct >= 70) return 'text-yellow-400';
  return 'text-red-400';
}

// ─── Stat Card ────────────────────────────────────────────────────────────────
function StatCard({ icon, label, value, sub, color }: {
  icon: string; label: string; value: string | number; sub?: string; color: string;
}) {
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 flex items-center gap-3">
      <span className="text-2xl shrink-0">{icon}</span>
      <div>
        <p className={`text-2xl font-bold ${color}`}>{value}</p>
        <p className="text-slate-400 text-xs">{label}</p>
        {sub && <p className="text-slate-500 text-xs mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

// ─── Month/Year Picker ────────────────────────────────────────────────────────
function MonthYearPicker({ month, year, onChange }: {
  month: number; year: number;
  onChange: (m: number, y: number) => void;
}) {
  const now = new Date();
  const prev = () => { if (month === 1) onChange(12, year - 1); else onChange(month - 1, year); };
  const next = () => {
    if (year === now.getFullYear() && month === now.getMonth() + 1) return;
    if (month === 12) onChange(1, year + 1); else onChange(month + 1, year);
  };
  const isFuture = year === now.getFullYear() && month === now.getMonth() + 1;

  return (
    <div className="flex items-center gap-2 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2">
      <button onClick={prev} className="text-slate-400 hover:text-white transition-colors px-1">‹</button>
      <span className="text-white font-medium text-sm min-w-[120px] text-center">
        {MONTH_NAMES[month - 1]} {year}
      </span>
      <button onClick={next} disabled={isFuture}
        className="text-slate-400 hover:text-white transition-colors px-1 disabled:opacity-30">›</button>
    </div>
  );
}

// ─── Mini Calendar (employee view) ───────────────────────────────────────────
function MiniCalendar({ month, year, wfhDates, halfDayDates }: {
  month: number; year: number; wfhDates: string[]; halfDayDates: string[];
}) {
  const wfhSet     = new Set(wfhDates.map(d => d.slice(0, 10)));
  const halfDaySet = new Set(halfDayDates.map(d => d.slice(0, 10)));
  const firstDay   = new Date(year, month - 1, 1).getDay();
  const daysTotal  = new Date(year, month, 0).getDate();
  const cells: (number | null)[] = [...Array(firstDay).fill(null)];
  for (let d = 1; d <= daysTotal; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const dayKey = (d: number) =>
    `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  const today = new Date();

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
      <h3 className="text-white font-medium text-sm mb-3">{MONTH_NAMES[month - 1]} {year} — WFH Calendar</h3>
      <div className="grid grid-cols-7 mb-1">
        {['Su','Mo','Tu','We','Th','Fr','Sa'].map(d => (
          <div key={d} className="text-center text-slate-500 text-xs py-1">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-0.5">
        {cells.map((day, i) => {
          if (!day) return <div key={i} />;
          const key       = dayKey(day);
          const isWFH     = wfhSet.has(key);
          const isHalfDay = halfDaySet.has(key);
          const isToday   = today.getFullYear() === year && today.getMonth() + 1 === month && today.getDate() === day;
          const isWeekend = new Date(year, month - 1, day).getDay() % 6 === 0;
          return (
            <div key={i} className={`
              aspect-square flex items-center justify-center rounded-lg text-xs font-medium
              ${isWFH     ? 'bg-blue-600 text-white' : ''}
              ${isHalfDay ? 'bg-yellow-600/70 text-white' : ''}
              ${isToday && !isWFH && !isHalfDay ? 'ring-1 ring-blue-500 text-white' : ''}
              ${isWeekend && !isWFH && !isHalfDay ? 'text-slate-600' : ''}
              ${!isWFH && !isHalfDay && !isWeekend && !isToday ? 'text-slate-400' : ''}
            `}>{day}</div>
          );
        })}
      </div>
      <div className="flex gap-3 mt-3 pt-3 border-t border-slate-700">
        <div className="flex items-center gap-1.5 text-xs text-slate-400">
          <div className="w-3 h-3 rounded bg-blue-600" /> WFH
        </div>
        <div className="flex items-center gap-1.5 text-xs text-slate-400">
          <div className="w-3 h-3 rounded bg-yellow-600/70" /> Half Day
        </div>
      </div>
    </div>
  );
}

// ─── Employee Personal View ───────────────────────────────────────────────────
function EmployeeWFHSummary({ month, year }: { month: number; year: number }) {
  const { data: allRequests = [] } = useQuery<WFHRequest[]>({
    queryKey: ['myWFHRequests'],
    queryFn:  () => wfhApi.getMy(),
  });

  const monthRequests = useMemo(() =>
    allRequests.filter(r => {
      const d = new Date(r.requestDate);
      return d.getFullYear() === year && d.getMonth() + 1 === month;
    }),
  [allRequests, month, year]);

  const approved   = monthRequests.filter(r => r.status === 'Approved');
  const pending    = monthRequests.filter(r => r.status === 'Pending');
  const rejected   = monthRequests.filter(r => r.status === 'Rejected');
  const wfhDays    = approved.filter(r => r.requestType === 'WFH');
  const halfDays   = approved.filter(r => r.requestType === 'HalfDay');
  const ytdWFH     = allRequests.filter(r => {
    const d = new Date(r.requestDate);
    return d.getFullYear() === year && r.status === 'Approved' && r.requestType === 'WFH';
  }).length;
  const wfhDates     = approved.filter(r => r.requestType === 'WFH').map(r => r.requestDate.slice(0, 10));
  const halfDayDates = approved.filter(r => r.requestType === 'HalfDay').map(r => r.requestDate.slice(0, 10));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard icon="🏠" label="WFH Days"    value={wfhDays.length}  color="text-blue-400"   sub={MONTH_NAMES[month-1]} />
        <StatCard icon="🌗" label="Half Days"   value={halfDays.length} color="text-yellow-400" sub="approved" />
        <StatCard icon="⏳" label="Pending"     value={pending.length}  color="text-orange-400" sub="awaiting review" />
        <StatCard icon="📅" label="WFH YTD"     value={ytdWFH}          color="text-purple-400" sub={`${year} total`} />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <MiniCalendar month={month} year={year} wfhDates={wfhDates} halfDayDates={halfDayDates} />
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
          <h3 className="text-white font-medium text-sm mb-3">Requests — {MONTH_NAMES[month - 1]} {year}</h3>
          {monthRequests.length === 0 ? (
            <p className="text-slate-500 text-sm py-6 text-center">No requests this month.</p>
          ) : (
            <div className="space-y-2 max-h-72 overflow-y-auto">
              {monthRequests
                .sort((a, b) => new Date(a.requestDate).getTime() - new Date(b.requestDate).getTime())
                .map(r => (
                  <div key={r.id} className="flex items-center justify-between py-2 border-b border-slate-700/50 last:border-0">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{r.requestType === 'WFH' ? '🏠' : '🌗'}</span>
                      <div>
                        <p className="text-white text-sm font-medium">{formatDate(r.requestDate)}</p>
                        <p className="text-slate-500 text-xs">{r.requestType}{r.halfDaySlot ? ` · ${r.halfDaySlot}` : ''}</p>
                      </div>
                    </div>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${
                      r.status === 'Approved' ? 'text-green-400 bg-green-500/20 border-green-500/30' :
                      r.status === 'Pending'  ? 'text-yellow-400 bg-yellow-500/20 border-yellow-500/30' :
                      r.status === 'Rejected' ? 'text-red-400 bg-red-500/20 border-red-500/30' :
                      'text-slate-400 bg-slate-700 border-slate-600'
                    }`}>{r.status}</span>
                  </div>
                ))}
            </div>
          )}
          {rejected.length > 0 && (
            <div className="mt-3 pt-3 border-t border-slate-700 space-y-1">
              <p className="text-slate-400 text-xs font-medium">Rejection notes:</p>
              {rejected.map(r => r.reviewNote && (
                <p key={r.id} className="text-slate-500 text-xs italic">
                  {formatDate(r.requestDate)}: "{r.reviewNote}"
                </p>
              ))}
            </div>
          )}
        </div>
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
    queryFn:  () => wfhApi.getTeamMonthly(month, year),
  });

  const sorted = useMemo(() => {
    const copy = [...teamData];
    if (sortBy === 'wfh')        return copy.sort((a, b) => b.daysWFH - a.daysWFH);
    if (sortBy === 'attendance') return copy.sort((a, b) => b.attendancePercentage - a.attendancePercentage);
    return copy.sort((a, b) => a.fullName.localeCompare(b.fullName));
  }, [teamData, sortBy]);

  const totalWFHDays  = teamData.reduce((s, m) => s + m.daysWFH, 0);
  const totalHalfDays = teamData.reduce((s, m) => s + m.daysHalfDay, 0);
  const totalWeekend  = teamData.reduce((s, m) => s + (m.daysWeekend ?? 0), 0);
  const totalHoliday  = teamData.reduce((s, m) => s + (m.daysHoliday ?? 0), 0);
  const avgWFHPct     = teamData.length > 0
    ? Math.round(teamData.reduce((s, m) => s + pct(m.daysWFH, m.workingDaysInMonth), 0) / teamData.length) : 0;
  const avgAttendance = teamData.length > 0
    ? Math.round(teamData.reduce((s, m) => s + m.attendancePercentage, 0) / teamData.length) : 0;
  const topWFH        = [...teamData].sort((a, b) => b.daysWFH - a.daysWFH)[0];

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-slate-800 border border-slate-700 rounded-xl p-4 h-20 animate-pulse" />
          ))}
        </div>
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 h-64 animate-pulse" />
      </div>
    );
  }

  if (teamData.length === 0) {
    return (
      <div className="text-center py-16 text-slate-500">
        <div className="text-5xl mb-3">📭</div>
        <p className="text-slate-400 font-medium">No data for {MONTH_NAMES[month - 1]} {year}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard icon="🏠" label="Total WFH Days"  value={totalWFHDays}         color="text-blue-400"   sub={`${teamData.length} employees`} />
        <StatCard icon="🌗" label="Total Half Days" value={totalHalfDays}        color="text-yellow-400" />
        <StatCard icon="📊" label="Avg WFH Rate"    value={`${avgWFHPct}%`}      color="text-purple-400" sub="of working days" />
        <StatCard icon="✅" label="Avg Attendance"  value={`${avgAttendance}%`}  color="text-green-400" />
      </div>

      {/* Weekend + Holiday bonus row — only shown when > 0 */}
      {(totalWeekend > 0 || totalHoliday > 0) && (
        <div className="grid grid-cols-2 gap-4">
          {totalWeekend > 0 && (
            <StatCard icon="📅" label="Weekend Days Worked" value={totalWeekend} color="text-orange-400" sub="across all employees" />
          )}
          {totalHoliday > 0 && (
            <StatCard icon="🎉" label="Holiday Days Worked" value={totalHoliday} color="text-violet-400" sub="across all employees" />
          )}
        </div>
      )}

      {/* Top WFH highlight */}
      {topWFH && topWFH.daysWFH > 0 && (
        <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl px-4 py-3 flex items-center gap-3">
          <span className="text-2xl">🏆</span>
          <p className="text-blue-300 text-sm">
            <span className="font-semibold text-white">{topWFH.fullName}</span> has the most WFH days this month —{' '}
            <span className="text-blue-400 font-medium">{topWFH.daysWFH} days</span>
            {' '}({pct(topWFH.daysWFH, topWFH.workingDaysInMonth)}% of working days)
          </p>
        </div>
      )}

      {/* Sort controls */}
      <div className="flex items-center gap-2">
        <span className="text-slate-400 text-xs">Sort by:</span>
        {(['name', 'wfh', 'attendance'] as const).map(s => (
          <button key={s} onClick={() => setSortBy(s)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors border ${
              sortBy === s
                ? 'bg-blue-600 border-blue-500 text-white'
                : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500'
            }`}>
            {s === 'name' ? '🔤 Name' : s === 'wfh' ? '🏠 WFH Days' : '✅ Attendance'}
          </button>
        ))}
      </div>

      {/* Team table — now has Weekend + Holiday columns */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
        <div className="grid grid-cols-10 text-xs text-slate-400 font-medium px-4 py-3 border-b border-slate-700 bg-slate-800/80">
          <div className="col-span-2">Employee</div>
          <div className="text-center">Present</div>
          <div className="text-center">WFH</div>
          <div className="text-center">Half Day</div>
          <div className="text-center">Absent</div>
          <div className="text-center text-orange-400">Weekend</div>
          <div className="text-center text-violet-400">Holiday</div>
          <div className="text-center">WFH %</div>
          <div className="text-center">Attend %</div>
        </div>

        <div className="divide-y divide-slate-700/50">
          {sorted.map(member => {
            const wfhPct  = pct(member.daysWFH, member.workingDaysInMonth);
            const expanded = expandedUser === member.userId;

            return (
              <div key={member.userId}>
                <div
                  className="grid grid-cols-10 items-center px-4 py-3 hover:bg-slate-700/30 transition-colors cursor-pointer"
                  onClick={() => setExpandedUser(expanded ? null : member.userId)}>

                  <div className="col-span-2 flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full shrink-0 ${member.daysWFH > 0 ? 'bg-blue-400' : 'bg-slate-600'}`} />
                    <div className="min-w-0">
                      <p className="text-white text-sm font-medium truncate">{member.fullName}</p>
                      <p className="text-slate-500 text-xs">{member.role}</p>
                    </div>
                  </div>

                  <div className="text-center text-slate-300 text-sm">{member.daysPresent}</div>
                  <div className="text-center text-blue-400 text-sm font-medium">{member.daysWFH}</div>
                  <div className="text-center text-yellow-400 text-sm">{member.daysHalfDay}</div>
                  <div className="text-center text-red-400 text-sm">{member.daysAbsent}</div>

                  {/* Weekend — orange, show — when 0 */}
                  <div className="text-center text-sm">
                    {(member.daysWeekend ?? 0) > 0
                      ? <span className="text-orange-400 font-medium">{member.daysWeekend}</span>
                      : <span className="text-slate-700">—</span>}
                  </div>

                  {/* Holiday — violet, show — when 0 */}
                  <div className="text-center text-sm">
                    {(member.daysHoliday ?? 0) > 0
                      ? <span className="text-violet-400 font-medium">{member.daysHoliday}</span>
                      : <span className="text-slate-700">—</span>}
                  </div>

                  {/* WFH % bar */}
                  <div className="flex flex-col items-center gap-1">
                    <span className="text-xs text-slate-300">{wfhPct}%</span>
                    <div className="w-12 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all ${wfhBarColor(wfhPct)}`}
                        style={{ width: `${wfhPct}%` }} />
                    </div>
                  </div>

                  <div className={`text-center text-sm font-medium ${attendanceColor(member.attendancePercentage)}`}>
                    {member.attendancePercentage}%
                  </div>
                </div>

                {/* Expanded row */}
                {expanded && (
                  <div className="px-6 pb-4 bg-slate-900/40 border-t border-slate-700/40">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-3">

                      {/* WFH dates */}
                      <div>
                        <p className="text-slate-400 text-xs font-medium mb-2">🏠 WFH Dates ({member.daysWFH})</p>
                        {member.wfhDates.length === 0 ? (
                          <p className="text-slate-600 text-xs">None</p>
                        ) : (
                          <div className="flex flex-wrap gap-1.5">
                            {member.wfhDates.sort().map(d => (
                              <span key={d} className="px-2 py-0.5 bg-blue-500/20 text-blue-400 rounded text-xs border border-blue-500/20">
                                {formatDate(d)}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Half day dates */}
                      <div>
                        <p className="text-slate-400 text-xs font-medium mb-2">🌗 Half Day Dates ({member.daysHalfDay})</p>
                        {member.halfDayDates.length === 0 ? (
                          <p className="text-slate-600 text-xs">None</p>
                        ) : (
                          <div className="flex flex-wrap gap-1.5">
                            {member.halfDayDates.sort().map(d => (
                              <span key={d} className="px-2 py-0.5 bg-yellow-500/20 text-yellow-400 rounded text-xs border border-yellow-500/20">
                                {formatDate(d)}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Weekend + Holiday dates — only shown when > 0 */}
                      {((member.daysWeekend ?? 0) > 0 || (member.daysHoliday ?? 0) > 0) && (
                        <div>
                          <p className="text-slate-400 text-xs font-medium mb-2">
                            📅 Weekend/Holiday Worked
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {(member.weekendDates ?? []).sort().map(d => (
                              <span key={d} className="px-2 py-0.5 bg-orange-500/20 text-orange-400 rounded text-xs border border-orange-500/20">
                                {formatDate(d)}
                              </span>
                            ))}
                            {(member.holidayDates ?? []).sort().map(d => (
                              <span key={d} className="px-2 py-0.5 bg-violet-500/20 text-violet-400 rounded text-xs border border-violet-500/20">
                                {formatDate(d)}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Performance */}
                      <div className="space-y-1.5">
                        <p className="text-slate-400 text-xs font-medium mb-2">📈 Performance</p>
                        {[
                          { l: 'Total Hours', v: member.totalWorkHours,             c: 'text-white' },
                          { l: 'Avg Daily',   v: `${member.averageDailyHours}h`,    c: 'text-white' },
                          { l: 'Tasks Done',  v: member.totalTasksCompleted,        c: 'text-green-400' },
                          { l: 'Working Days',v: member.workingDaysInMonth,         c: 'text-slate-300' },
                        ].map(i => (
                          <div key={i.l} className="flex justify-between text-xs">
                            <span className="text-slate-500">{i.l}</span>
                            <span className={`font-medium ${i.c}`}>{i.v}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <p className="text-slate-600 text-xs text-right">
        Click any row to expand WFH dates · {teamData.length} members · {teamData[0]?.workingDaysInMonth ?? '—'} working days
      </p>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export function WFHSummaryPage() {
  const { user } = useAuth();
  const now      = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year,  setYear]  = useState(now.getFullYear());
  const isManager = user?.role === 'Manager' || user?.role === 'TeamLead';

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">🏠 WFH Summary Report</h1>
          <p className="text-slate-400 text-sm mt-0.5">
            {isManager
              ? 'Monthly WFH & attendance breakdown across your team'
              : 'Your monthly WFH and half-day request history'}
          </p>
        </div>
        <MonthYearPicker month={month} year={year} onChange={(m, y) => { setMonth(m); setYear(y); }} />
      </div>
      {isManager ? <TeamWFHSummary month={month} year={year} /> : <EmployeeWFHSummary month={month} year={year} />}
    </div>
  );
}