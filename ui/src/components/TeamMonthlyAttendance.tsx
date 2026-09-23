import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { wfhApi } from '../services/api'; 
import { WFHRequest,TeamDailyStatus,TeamMonthlyAttendance } from '../types'; 
import { StatusPill } from './StatusPill';
import { useState } from 'react';

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

  return (
    <div className="space-y-4">
      {/* Month/year selector */}
      <div className="flex items-center gap-3">
        <select value={month} onChange={e => setMonth(+e.target.value)}
          className="bg-slate-800 border border-slate-700 text-white text-sm rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500">
          {monthOptions.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
        </select>
        <select value={year} onChange={e => setYear(+e.target.value)}
          className="bg-slate-800 border border-slate-700 text-white text-sm rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500">
          {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      {isLoading ? (
        <div className="h-64 bg-slate-800 rounded-2xl animate-pulse" />
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/50">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Employee</th>
                  <th className="text-center px-3 py-3 text-xs font-semibold text-emerald-400 uppercase tracking-wider">Present</th>
                  <th className="text-center px-3 py-3 text-xs font-semibold text-blue-400 uppercase tracking-wider">WFH</th>
                  <th className="text-center px-3 py-3 text-xs font-semibold text-amber-400 uppercase tracking-wider">Half Day</th>
                  <th className="text-center px-3 py-3 text-xs font-semibold text-red-400 uppercase tracking-wider">Absent</th>
                  <th className="text-center px-3 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Attendance %</th>
                  <th className="text-center px-3 py-3 text-xs font-semibold text-orange-400 uppercase tracking-wider">Weekend</th>
                  <th className="text-center px-3 py-3 text-xs font-semibold text-violet-400 uppercase tracking-wider">Holiday</th>
                  <th className="text-center px-3 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Avg Hours/Day</th>
                  <th className="text-center px-3 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Tasks Done</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {(members as TeamMonthlyAttendance[]).map(m => {
                  const pct = m.attendancePercentage;
                  const pctColor = pct >= 90 ? 'text-emerald-400' : pct >= 75 ? 'text-amber-400' : 'text-red-400';

                  return (
                    <tr key={m.userId} className="hover:bg-slate-800/30 transition">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-xs font-bold text-slate-300">
                            {m.fullName.charAt(0)}
                          </div>
                          <div>
                            <p className="text-white text-sm font-medium">{m.fullName}</p>
                            <p className="text-slate-600 text-xs">{m.role}</p>
                          </div>
                        </div>
                      </td>
                      <td className="text-center px-3 py-3 text-emerald-400 font-semibold">{m.daysPresent}</td>
                      <td className="text-center px-3 py-3 text-blue-400 font-semibold">{m.daysWFH}</td>
                      <td className="text-center px-3 py-3 text-amber-400 font-semibold">{m.daysHalfDay}</td>
                      <td className="text-center px-3 py-3 text-red-400 font-semibold">{m.daysAbsent}</td>
                      <td className="text-center px-3 py-3">
                        <div className="inline-flex flex-col items-center gap-1">
                          <span className={`font-bold ${pctColor}`}>{pct}%</span>
                          <div className="w-16 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${pct >= 90 ? 'bg-emerald-500' : pct >= 75 ? 'bg-amber-500' : 'bg-red-500'}`}
                              style={{ width: `${Math.min(100, pct)}%` }} />
                          </div>
                        </div>
                      </td>
                      <td className="text-center px-3 py-3 text-orange-400 font-semibold">
                        {m.daysWeekend > 0 ? m.daysWeekend : '—'}
                      </td>
                      <td className="text-center px-3 py-3 text-violet-400 font-semibold">
                        {m.daysHoliday > 0 ? m.daysHoliday : '—'}
                      </td>
                      <td className="text-center px-3 py-3 text-slate-300">{m.averageDailyHours}h</td>
                      <td className="text-center px-3 py-3 text-slate-300">{m.totalTasksCompleted}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};