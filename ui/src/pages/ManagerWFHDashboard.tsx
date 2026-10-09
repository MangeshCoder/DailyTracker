import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { wfhApi } from '../services/api';
import type { WFHRequest, TeamDailyStatus } from '../types';
import { PageHeader } from '../components/ui/PageHeader';
import { StatCard } from '../components/ui/StatCard';
import { TeamDailyStatusDashboard } from '../components/TeamDailyStatusDashboard';
import { PendingRequestsPanel } from '../components/PendingRequestsPanel';
import { PendingLeavePanel, TeamLeaveHistory, usePendingLeave } from '../components/PendingLeavePanel';
import { useAuth } from '../context/Authcontext';
import { PendingCorrectionsPanel, usePendingCorrections } from '../components/PendingCorrectionsPanel';
import { PendingMissedCheckInsPanel, usePendingMissedCheckIns } from '../components/MissedCheckIn';
import { PendingCompOffPanel, usePendingCompOff } from '../components/CompOffPanel';
import { PendingExpensesPanel, usePendingExpenses } from '../components/ExpensePanels';
import { DelegationPanel, useMyDelegations } from '../components/DelegationPanel';
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
  const { data: teamStatus, refetch: refetchStatus } = useQuery<TeamDailyStatus>({
    queryKey: ['teamStatus'],
    queryFn: () => wfhApi.getTeamStatus(),
    refetchInterval: 60000,
  });

  // leave applications wait here too, so one place covers every request
  // (a team lead covering for an away Manager decides leave too)
  const { data: delegations } = useMyDelegations();
  const canReviewLeave = useAuth().user?.role === 'Manager'
    || !!delegations?.actingFor?.some(d => d.fromRole === 'Manager');
  const { data: pendingLeave = [] } = usePendingLeave(canReviewLeave);
  const { data: pendingCorrections = [] } = usePendingCorrections();
  const { data: pendingMissed = [] } = usePendingMissedCheckIns();
  const { data: pendingCompOff = [] } = usePendingCompOff();
  const { data: pendingExpenses = [] } = usePendingExpenses();
  const pendingCount = pendingRequests.length + pendingLeave.filter(l => l.canReview !== false).length
    + pendingCorrections.length + pendingMissed.length + pendingCompOff.length + pendingExpenses.length;

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
        title="Employee Requests"
        description="See who is in today, and decide your team's leave, WFH, half days, comp-off, expenses, missed check-ins and check-out corrections in one place."
        breadcrumbs={[
          { label: 'Workspace', href: '/' },
          { label: 'Management' },
          { label: 'Employee Requests' },
        ]}
        actions={
          <button
            type="button"
            onClick={() => refetchStatus()}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition cursor-pointer shadow-sm"
          >
            <RefreshCw className="w-3.5 h-3.5 text-blue-500" />
            <span>Refresh</span>
          </button>
        }
      />

      {/* ── Away? hand over approvals / covering for someone ── */}
      <DelegationPanel />

      {/* ── KPI Stat Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Pending Approval"
          value={pendingCount}
          subtitle="Leave, WFH, expenses & more"
          icon={Clock}
          color="amber"
        />
        <StatCard
          title="In the office today"
          value={teamStatus ? teamStatus.presentCount : '...'}
          subtitle="Checked in at the office"
          icon={Building2}
          color="emerald"
        />
        <StatCard
          title="Working from home"
          value={teamStatus ? teamStatus.wfhCount : '...'}
          subtitle="Approved for today"
          icon={Home}
          color="blue"
        />
        <StatCard
          title="Half day"
          value={teamStatus ? teamStatus.halfDayCount : '...'}
          subtitle="Approved for today"
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
        {tab === 'pending' && (
          <div className="space-y-8">
            {canReviewLeave && <PendingLeavePanel />}
            <PendingMissedCheckInsPanel />
            <PendingCorrectionsPanel />
            <PendingCompOffPanel />
            <PendingExpensesPanel />
            <PendingRequestsPanel />
          </div>
        )}
        {tab === 'monthly' && <TeamMonthlyAttendances />}
        {tab === 'history' && (
          <div className="space-y-8">
            {canReviewLeave && <TeamLeaveHistory />}
            <section aria-label="WFH and half-day history" className="space-y-3">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">WFH &amp; half-day history</h3>
              <AllRequestsHistory />
            </section>
          </div>
        )}
      </div>
    </div>
  );
};

export default ManagerWFHDashboard;