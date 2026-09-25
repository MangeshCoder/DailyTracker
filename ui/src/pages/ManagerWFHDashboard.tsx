import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { wfhApi } from '../services/api';
import { WFHRequest, TeamDailyStatus } from '../types';
import { PageHeader } from '../components/ui/PageHeader';
import { StatCard } from '../components/ui/StatCard';
import { TeamDailyStatusDashboard } from '../components/TeamDailyStatusDashboard';
import { PendingRequestsPanel } from '../components/PendingRequestsPanel';
import { TeamMonthlyAttendances } from '../components/TeamMonthlyAttendance';
import { AllRequestsHistory } from '../components/AllRequestsHistory';
import {
  Users,
  Clock,
  Calendar,
  History,
  Building2,
  Home,
  SunMedium,
  CheckCircle2,
  RefreshCw
} from 'lucide-react';

export const ManagerWFHDashboard: React.FC = () => {
  const [tab, setTab] = useState<'today' | 'pending' | 'monthly' | 'history'>('today');

  // Pending count query
  const { data: pendingRequests = [] } = useQuery<WFHRequest[]>({
    queryKey: ['pendingWFH'],
    queryFn: () => wfhApi.getPending(),
    refetchInterval: 30000,
  });

  // Team daily status for KPI counters
  const { data: teamStatus, isLoading: statusLoading, refetch: refetchStatus } = useQuery<TeamDailyStatus>({
    queryKey: ['teamStatus'],
    queryFn: () => wfhApi.getTeamStatus(),
    refetchInterval: 60000,
  });

  const pendingCount = pendingRequests.length;

  interface DashboardTab {
    key: 'today' | 'pending' | 'monthly' | 'history';
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: number;
  }

  const tabs: DashboardTab[] = [
    {
      key: 'today',
      label: "Today's Presence",
      icon: Users,
    },
    {
      key: 'pending',
      label: 'Pending Queue',
      icon: Clock,
      badge: pendingCount,
    },
    {
      key: 'monthly',
      label: 'Monthly Matrix',
      icon: Calendar,
    },
    {
      key: 'history',
      label: 'Request Archive',
      icon: History,
    },
  ];

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* ── Page Header ── */}
      <PageHeader
        title="Manager Attendance & WFH Hub"
        description="Monitor real-time team attendance, audit remote work patterns, and resolve pending WFH or half-day applications."
        breadcrumbs={[
          { label: 'Workspace', href: '/' },
          { label: 'Management' },
          { label: 'Attendance Hub' },
        ]}
        badge={{ label: 'Live Supervisor Sync', variant: 'blue' }}
        actions={
          <button
            type="button"
            onClick={() => refetchStatus()}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition cursor-pointer shadow-sm"
          >
            <RefreshCw className="w-3.5 h-3.5 text-blue-500" />
            <span>Refresh Roster</span>
          </button>
        }
      />

      {/* ── KPI Stat Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Pending Approval"
          value={pendingCount}
          subtitle="Requests awaiting action"
          icon={Clock}
          color="amber"
        />
        <StatCard
          title="In-Office Today"
          value={teamStatus ? `${teamStatus.presentCount} Members` : '...'}
          subtitle="Checked in on site"
          icon={Building2}
          color="emerald"
        />
        <StatCard
          title="Remote / WFH"
          value={teamStatus ? `${teamStatus.wfhCount} Members` : '...'}
          subtitle="Approved telecommuting"
          icon={Home}
          color="blue"
        />
        <StatCard
          title="Half-Day Passes"
          value={teamStatus ? `${teamStatus.halfDayCount} Shifts` : '...'}
          subtitle="Split shift allocations"
          icon={SunMedium}
          color="purple"
        />
      </div>

      {/* ── Navigation Tabs ── */}
      <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
        <div className="flex gap-1.5 sm:gap-2 bg-slate-100 dark:bg-slate-900/90 p-1.5 rounded-2xl border border-slate-200/80 dark:border-slate-800 overflow-x-auto max-w-full">
          {tabs.map((t) => {
            const Icon = t.icon;
            const isActive = tab === t.key;

            return (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                className={`relative inline-flex items-center gap-2 px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition cursor-pointer whitespace-nowrap ${
                  isActive
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-blue-500' : 'text-slate-400'}`} />
                <span>{t.label}</span>
                {t.badge && t.badge > 0 ? (
                  <span className="w-5 h-5 rounded-full bg-amber-500 text-white text-[10px] font-bold flex items-center justify-center animate-pulse">
                    {t.badge > 99 ? '99+' : t.badge}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Tab Content ── */}
      <div className="animate-in fade-in duration-200">
        {tab === 'today' && <TeamDailyStatusDashboard />}
        {tab === 'pending' && <PendingRequestsPanel />}
        {tab === 'monthly' && <TeamMonthlyAttendances />}
        {tab === 'history' && <AllRequestsHistory />}
      </div>
    </div>
  );
};

export default ManagerWFHDashboard;