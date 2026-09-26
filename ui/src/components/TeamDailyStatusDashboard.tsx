// ─────────────────────────────────────────────────────────────────────────────
//  FILE: ui/src/components/TeamDailyStatusDashboard.tsx
//  Manager WFH Dashboard → "Today" tab — light/dark upgrade
//
//  Logic unchanged: team status for a date (default today), refresh every
//  60s, summary counts, member list with status / hours / check-in / pending.
//  Fix: no stray "0" when there are no pending requests.
// ─────────────────────────────────────────────────────────────────────────────

import { useQuery } from '@tanstack/react-query';
import { wfhApi } from '../services/api';
import type { TeamDailyStatus } from '../types';
import { StatusPill } from './StatusPill';
import { useState } from 'react';
import { DatePicker } from './DatePicker';
import { Card } from './ui/Card';
import { StatCard } from './ui/StatCard';
import { Building2, Home, SunMoon, Hourglass, Clock, Users, Inbox } from 'lucide-react';

const formatISTTime = (dateString?: string) => {
  if (!dateString) return '--:--';
  // Force treat backend time as UTC
  const utcDate = new Date(dateString + 'Z');
  return utcDate.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    timeZone: 'Asia/Kolkata',
  });
};

export const TeamDailyStatusDashboard = () => {
  const [selectedDate, setSelectedDate] = useState('');
  const queryDate = selectedDate || undefined;

  const { data: status, isLoading } = useQuery<TeamDailyStatus>({
    queryKey: ['teamStatus', queryDate],
    queryFn: () => wfhApi.getTeamStatus(queryDate),
    refetchInterval: 60000,
  });

  const pending = status?.pendingRequestsCount ?? 0;

  return (
    <div className="space-y-5">
      {/* Header with date selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <p className="text-base font-bold text-slate-900 dark:text-white">
            {status?.dateLabel || 'Team Status'}
          </p>
          {pending > 0 && (
            <p className="inline-flex items-center gap-1 text-xs font-semibold text-amber-600 dark:text-amber-400 mt-0.5">
              <Hourglass className="w-3.5 h-3.5" />
              {pending} request{pending > 1 ? 's' : ''} awaiting your approval
            </p>
          )}
        </div>
        <div className="sm:w-56">
          <DatePicker value={selectedDate} onChange={setSelectedDate} placeholder="Today" />
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Present"        value={status?.presentCount ?? 0}      icon={Building2} color="emerald" loading={isLoading} />
        <StatCard title="Work From Home" value={status?.wfhCount ?? 0}          icon={Home}      color="blue"    loading={isLoading} />
        <StatCard title="Half Day"       value={status?.halfDayCount ?? 0}      icon={SunMoon}   color="amber"   loading={isLoading} />
        <StatCard title="Not Checked In" value={status?.notCheckedInCount ?? 0} icon={Hourglass} color="slate"   loading={isLoading} />
      </div>

      {/* Member list */}
      {isLoading ? (
        <div className="h-64 bg-slate-100 dark:bg-slate-800/60 rounded-2xl animate-pulse" />
      ) : status && (
        <Card className="overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
              <Users className="w-4 h-4" />
            </div>
            <p className="text-sm font-bold text-slate-900 dark:text-white">
              Team Members <span className="font-medium text-slate-500 dark:text-slate-400">· {status.totalMembers} total</span>
            </p>
          </div>

          {status.members.length === 0 ? (
            <div className="text-center py-12">
              <Inbox className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-600" />
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 mt-2">No team members found</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
              {status.members.map(member => (
                <div key={member.userId}
                  className="px-5 py-3.5 flex items-center gap-4 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center text-sm font-bold text-white flex-shrink-0">
                    {member.fullName.charAt(0)}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">{member.fullName}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{member.role}</p>
                  </div>

                  <StatusPill status={member.effectiveStatus} size="xs" />

                  <div className="text-right hidden sm:block w-20">
                    <p className="text-sm font-bold text-slate-900 dark:text-white tabular-nums">
                      {member.workMinutes > 0 ? member.workHours : '—'}
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      {member.tasksCompleted}/{member.tasksTotal} tasks
                    </p>
                  </div>

                  <div className="hidden md:flex items-center justify-end gap-1 w-24 text-xs text-slate-500 dark:text-slate-400">
                    <Clock className="w-3.5 h-3.5" /> {formatISTTime(member.checkInTime)}
                  </div>

                  {member.hasPendingRequest && (
                    <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 dark:text-amber-400 bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 rounded-full whitespace-nowrap">
                      <Hourglass className="w-3 h-3" /> {member.pendingRequestType} Pending
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>
      )}
    </div>
  );
};
