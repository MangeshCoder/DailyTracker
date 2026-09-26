import React, { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Home, Calendar, Clock, CheckCircle2, PlusCircle, History } from 'lucide-react';
import { WFHRequestForm } from '../components/WFHRequestForm';
import { MyWFHRequests } from '../components/MyWFHRequests';
import { PageHeader, StatCard } from '../components/ui';
import { wfhApi } from '../services/api';
import type { WFHRequest } from '../types';

export const WFHRequestPage: React.FC = () => {
  const qc = useQueryClient();
  const [tab, setTab] = useState<'new' | 'history'>('new');

  const { data: rawRequests, isLoading } = useQuery({
    queryKey: ['myWFHRequests'],
    queryFn: async () => {
      try {
        const res = await wfhApi.getMy();
        return res;
      } catch (err) {
        console.warn('Could not fetch WFH requests', err);
        return [];
      }
    },
  });

  // Resilient array extraction: handles array, axios-wrapped { data: [...] }, or object envelopes
  const requests: WFHRequest[] = useMemo(() => {
    if (!rawRequests) return [];
    if (Array.isArray(rawRequests)) return rawRequests;
    if (Array.isArray((rawRequests as any)?.data)) return (rawRequests as any).data;
    if (Array.isArray((rawRequests as any)?.requests)) return (rawRequests as any).requests;
    return [];
  }, [rawRequests]);

  const approvedCount = requests.filter(r => r?.status === 'Approved').length;
  const pendingCount = requests.filter(r => r?.status === 'Pending').length;
  const wfhDaysCount = requests.filter(
    r => r?.status === 'Approved' && (r?.requestType === 'WFH' || !(r as any)?.halfDaySlot)
  ).length;

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
      {/* Page Header */}
      <PageHeader
        title="WFH & Flexible Attendance"
        description="Submit requests for work-from-home or half-day attendance, check supervisor approvals, and track your remote days."
        badge={{
          label: 'Policy Active',
          variant: 'blue',
          icon: <Home className="w-3.5 h-3.5" />,
        }}
        breadcrumbs={[
          { label: 'Workspace', href: '/' },
          { label: 'WFH & Passes' },
        ]}
      />

      {/* Summary Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard
          title="Total Requests"
          value={requests.length}
          subtitle="All-time submissions"
          icon={Calendar}
          color="blue"
          loading={isLoading}
        />
        <StatCard
          title="Approved"
          value={approvedCount}
          subtitle="Manager validated"
          icon={CheckCircle2}
          color="emerald"
          loading={isLoading}
        />
        <StatCard
          title="Pending Review"
          value={pendingCount}
          subtitle={pendingCount > 0 ? 'Awaiting response' : 'None in queue'}
          icon={Clock}
          color="amber"
          loading={isLoading}
        />
        <StatCard
          title="WFH Days"
          value={wfhDaysCount}
          subtitle="Approved remote days"
          icon={Home}
          color="indigo"
          loading={isLoading}
        />
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 p-1.5 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-fit">
        <button
          type="button"
          onClick={() => setTab('new')}
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
            tab === 'new'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <PlusCircle className="w-4 h-4" />
          <span>New Request</span>
        </button>
        <button
          type="button"
          onClick={() => setTab('history')}
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
            tab === 'history'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <History className="w-4 h-4" />
          <span>My Requests</span>
          {requests.length > 0 && (
            <span
              className={`text-xs px-2 py-0.5 rounded-full ${
                tab === 'history'
                  ? 'bg-white/20 text-white'
                  : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
              }`}
            >
              {requests.length}
            </span>
          )}
        </button>
      </div>

      {/* Tab Panels */}
      {tab === 'new' ? (
        <WFHRequestForm
          onSuccess={() => {
            qc.invalidateQueries({ queryKey: ['myWFHRequests'] });
            setTab('history');
          }}
        />
      ) : (
        <MyWFHRequests />
      )}
    </div>
  );
};
export default WFHRequestPage;