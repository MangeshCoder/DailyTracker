// ─────────────────────────────────────────────────────────────────────────────
//  FILE: ui/src/components/AllRequestsHistory.tsx
//  Manager WFH Dashboard → "History" tab — light/dark upgrade
//
//  Logic unchanged: wfhApi.getAll(month, year) + type/status filters.
//  Added the missing year selector (year state existed but had no control).
// ─────────────────────────────────────────────────────────────────────────────

import { useQuery } from '@tanstack/react-query';
import { wfhApi } from '../services/api';
import { StatusPill } from './StatusPill';
import { useState } from 'react';
import type { WFHRequest } from '../types';
import { ChevronDown, Home, SunMoon, CalendarDays, UserCheck, Inbox } from 'lucide-react';

const SELECT_CLS =
  'appearance-none bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white ' +
  'rounded-xl pl-3.5 pr-9 py-2.5 text-sm font-medium cursor-pointer ' +
  'focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition';

const START_YEAR = 2024;
const YEARS = Array.from({ length: new Date().getFullYear() - START_YEAR + 1 }, (_, i) => START_YEAR + i);

const Select = ({ children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) => (
  <div className="relative">
    <select {...props} className={SELECT_CLS}>{children}</select>
    <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
  </div>
);

export const AllRequestsHistory = () => {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [filterType, setFilterType] = useState<'All' | 'WFH' | 'HalfDay'>('All');
  const [filterStatus, setFilterStatus] = useState<'All' | 'Pending' | 'Approved' | 'Rejected'>('All');

  const { data: allRequests = [], isLoading } = useQuery<WFHRequest[]>({
    queryKey: ['allWFH', month, year],
    queryFn: () => wfhApi.getAll(month, year),
  });

  const filtered = allRequests.filter(r =>
    (filterType === 'All' || r.requestType === filterType) &&
    (filterStatus === 'All' || r.status === filterStatus)
  );

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <Select value={month} onChange={e => setMonth(+e.target.value)}>
          {Array.from({ length: 12 }, (_, i) => (
            <option key={i + 1} value={i + 1}>
              {new Date(2024, i).toLocaleString('default', { month: 'long' })}
            </option>
          ))}
        </Select>
        <Select value={year} onChange={e => setYear(+e.target.value)}>
          {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
        </Select>
        <Select value={filterType} onChange={e => setFilterType(e.target.value as 'All' | 'WFH' | 'HalfDay')}>
          <option value="All">All Types</option>
          <option value="WFH">WFH</option>
          <option value="HalfDay">Half Day</option>
        </Select>
        <Select value={filterStatus} onChange={e => setFilterStatus(e.target.value as 'All' | 'Pending' | 'Approved' | 'Rejected')}>
          <option value="All">All Statuses</option>
          <option value="Pending">Pending</option>
          <option value="Approved">Approved</option>
          <option value="Rejected">Rejected</option>
        </Select>
        <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 sm:ml-auto">
          {filtered.length} request{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-16 bg-slate-100 dark:bg-slate-800/60 rounded-xl animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-14 rounded-3xl border-2 border-dashed border-slate-200 dark:border-slate-800">
          <Inbox className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-600" />
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 mt-2">No requests found</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Try a different month or filter.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(req => (
            <div
              key={req.id}
              className="flex items-center gap-4 p-4 rounded-xl bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 transition"
            >
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center text-xs font-bold text-white shrink-0">
                {req.employeeName.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">{req.employeeName}</p>
                  <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                    req.requestType === 'WFH'
                      ? 'text-blue-700 dark:text-blue-400 bg-blue-500/10'
                      : 'text-amber-700 dark:text-amber-400 bg-amber-500/10'
                  }`}>
                    {req.requestType === 'WFH' ? <Home className="w-3 h-3" /> : <SunMoon className="w-3 h-3" />}
                    {req.requestType === 'WFH' ? 'WFH' : req.halfDaySlot ?? 'Half Day'}
                  </span>
                </div>
                <p className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  <span className="inline-flex items-center gap-1">
                    <CalendarDays className="w-3 h-3" />
                    {new Date(req.requestDate).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                  </span>
                  {req.reviewedByName && (
                    <span className="inline-flex items-center gap-1">
                      <UserCheck className="w-3 h-3" /> Reviewed by {req.reviewedByName}
                    </span>
                  )}
                </p>
              </div>
              <StatusPill status={req.status} size="xs" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
