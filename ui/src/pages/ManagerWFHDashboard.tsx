
import { TeamDailyStatusDashboard } from '../components/TeamDailyStatusDashboard';
import { PendingRequestsPanel } from '../components/PendingRequestsPanel';
import { TeamMonthlyAttendances } from '../components/TeamMonthlyAttendance';
import { AllRequestsHistory } from '../components/AllRequestsHistory';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { wfhApi } from '../services/api';
import { WFHRequest } from '../types';

export const ManagerWFHDashboard = () => {
  const [tab, setTab] = useState<'today' | 'pending' | 'monthly' | 'history'>('today');

  const { data: pendingCount } = useQuery({
    queryKey: ['pendingWFHCount'],
    queryFn: () => wfhApi.getPending().then((d: WFHRequest[]) => d.length),
    refetchInterval: 30000,
  });

  const tabs = [
    { key: 'today',   label: '📊 Today\'s Status' },
    { key: 'pending', label: `⏳ Pending${pendingCount ? ` (${pendingCount})` : ''}` },
    { key: 'monthly', label: '📅 Monthly View' },
    { key: 'history', label: '📚 All Requests' },
  ];

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Team Attendance Dashboard</h1>
        <p className="text-slate-400 text-sm mt-1">
          Monitor WFH, half-day and attendance across your team. Review and approve requests.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key as any)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition relative ${
              tab === t.key
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/30'
                : 'text-slate-400 hover:text-white bg-slate-900 border border-slate-800'
            }`}>
            {t.label}
            {t.key === 'pending' && pendingCount ? (
              <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-amber-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                {pendingCount > 9 ? '9+' : pendingCount}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'today' && <TeamDailyStatusDashboard />}
      {tab === 'pending' && <PendingRequestsPanel />}
      {tab === 'monthly' && <TeamMonthlyAttendances />}
      {tab === 'history' && <AllRequestsHistory />}
    </div>
  );
};