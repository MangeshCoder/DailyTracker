import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { wfhApi } from '../services/api'; 
import { WFHRequest,TeamDailyStatus } from '../types'; 
import { StatusPill } from './StatusPill';
import { useState } from 'react';
import { DatePicker } from './DatePicker';

const formatISTTime = (dateString?: string) => {
  if (!dateString) return "--:--";

  // Force treat backend time as UTC
  const utcDate = new Date(dateString + "Z");

  return utcDate.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Kolkata",
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

  const summaryCards = status ? [
    { label: 'Present',       count: status.presentCount,      icon: '🏢', color: 'emerald' },
    { label: 'Work From Home', count: status.wfhCount,          icon: '🏠', color: 'blue' },
    { label: 'Half Day',       count: status.halfDayCount,      icon: '🌗', color: 'amber' },
    { label: 'Not Checked In', count: status.notCheckedInCount, icon: '⏳', color: 'slate' },
  ] : [];

  const colorMap: Record<string, string> = {
    emerald: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    blue:    'text-blue-400 bg-blue-500/10 border-blue-500/20',
    amber:   'text-amber-400 bg-amber-500/10 border-amber-500/20',
    slate:   'text-slate-400 bg-slate-800 border-slate-700',
  };

  return (
    <div className="space-y-5">
      {/* Header with date selector */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-white font-semibold">
            {status?.dateLabel || 'Team Status'}
          </p>
          {status && status.pendingRequestsCount && status.pendingRequestsCount > 0 && (
            <p className="text-xs text-amber-400 mt-0.5">
              ⏳ {status.pendingRequestsCount} request{status.pendingRequestsCount > 1 ? 's' : ''} awaiting your approval
            </p>
          )}
        </div> 
        {/* <input
          type="date"
          value={selectedDate}
          onChange={e => setSelectedDate(e.target.value)}
          className="bg-slate-800 border border-slate-700 text-white text-sm rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
        /> */}
        <DatePicker value={selectedDate} onChange={setSelectedDate} />
      </div>

      {isLoading ? (
        <div className="grid grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => <div key={i} className="h-20 bg-slate-800 rounded-2xl animate-pulse" />)}
        </div>
      ) : status && (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {summaryCards.map(card => (
              <div key={card.label}
                className={`rounded-2xl border p-4 text-center ${colorMap[card.color]}`}>
                <p className="text-3xl font-bold">{card.count}</p>
                <p className="text-xs mt-1 font-medium opacity-80">{card.icon} {card.label}</p>
              </div>
            ))}
          </div>

          {/* Member list */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-800">
              <p className="text-sm font-semibold text-white">
                Team Members · {status.totalMembers} total
              </p>
            </div>
            <div className="divide-y divide-slate-800/60">
              {status.members.map(member => (
                <div key={member.userId}
                  className="px-4 py-3.5 flex items-center gap-4 hover:bg-slate-800/30 transition">

                  {/* Avatar */}
                  <div className="w-9 h-9 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-sm font-bold text-slate-300 flex-shrink-0">
                    {member.fullName.charAt(0)}
                  </div>

                  {/* Name & role */}
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-medium truncate">{member.fullName}</p>
                    <p className="text-slate-500 text-xs">{member.role}</p>
                  </div>

                  {/* Status */}
                  <StatusPill status={member.effectiveStatus} size="xs" />

                  {/* Work hours */}
                  <div className="text-right hidden sm:block">
                    <p className="text-white text-sm font-semibold tabular-nums">
                      {member.workMinutes > 0 ? member.workHours : '—'}
                    </p>
                    <p className="text-slate-600 text-xs">
                      {member.tasksCompleted}/{member.tasksTotal} tasks
                    </p>
                  </div>

                  {/* Check-in time */}
                  <div className="text-right text-xs text-slate-500 hidden md:block w-20">
                        {formatISTTime(member.checkInTime)}
                  </div>

                  {/* Pending badge */}
                  {member.hasPendingRequest && (
                    <span className="text-xs text-amber-400 bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 rounded-lg whitespace-nowrap">
                      ⏳ {member.pendingRequestType} Pending
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
};