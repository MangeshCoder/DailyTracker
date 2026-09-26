import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { leaveApi, holidayApi } from '../services/api';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/Authcontext';
import {
  CalendarRange,
  Palmtree,
  HeartPulse,
  Clock,
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Calendar,
  Sparkles,
  Send,
  PartyPopper,
  X,
  Check,
  UserCheck
} from 'lucide-react';
import type { LeaveBalanceDto, LeaveTypeBalanceItem } from '../types';
import { DatePicker } from '../components/DatePicker';
import { PageHeader } from '../components/ui/PageHeader';
import { StatCard } from '../components/ui/StatCard';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { StatusBadge } from '../components/ui/StatusBadge';

// ─── Leave type visual configuration ─────────────────────────────────────────
interface LeaveTypeConfig {
  icon: string;
  badgeBg: string;
  badgeText: string;
  barColor: string;
  description: string;
}

const LEAVE_CONFIG: Record<string, LeaveTypeConfig> = {
  Casual: {
    icon: '🌴',
    badgeBg: 'bg-blue-500/10 dark:bg-blue-500/15',
    badgeText: 'text-blue-700 dark:text-blue-300 border-blue-500/25',
    barColor: 'from-blue-500 to-indigo-500',
    description: 'Personal time off, vacation & urgent work',
  },
  Sick: {
    icon: '🤒',
    badgeBg: 'bg-rose-500/10 dark:bg-rose-500/15',
    badgeText: 'text-rose-700 dark:text-rose-300 border-rose-500/25',
    barColor: 'from-rose-500 to-pink-500',
    description: 'Medical emergencies & health recovery',
  },
  Earned: {
    icon: '⭐',
    badgeBg: 'bg-amber-500/10 dark:bg-amber-500/15',
    badgeText: 'text-amber-700 dark:text-amber-300 border-amber-500/25',
    barColor: 'from-amber-500 to-orange-500',
    description: 'Accrued annual vacation quota',
  },
  CompOff: {
    icon: '🔄',
    badgeBg: 'bg-purple-500/10 dark:bg-purple-500/15',
    badgeText: 'text-purple-700 dark:text-purple-300 border-purple-500/25',
    barColor: 'from-purple-500 to-indigo-500',
    description: 'Compensatory leave for weekend/overtime duty',
  },
  Unpaid: {
    icon: '💸',
    badgeBg: 'bg-slate-500/10 dark:bg-slate-500/15',
    badgeText: 'text-slate-700 dark:text-slate-300 border-slate-500/25',
    barColor: 'from-slate-500 to-slate-600',
    description: 'Leave without pay exceeding quota',
  },
};

// ─── Single leave-type balance card ──────────────────────────────────────────
const LeaveTypeCard = ({ item }: { item: LeaveTypeBalanceItem }) => {
  const cfg = LEAVE_CONFIG[item.leaveType] ?? LEAVE_CONFIG.Casual;
  const usedPct = item.isUnlimited
    ? 0
    : item.entitlement > 0
    ? Math.min(100, Math.round((item.used / item.entitlement) * 100))
    : 0;
  const isExhausted = !item.isUnlimited && item.remaining === 0 && item.entitlement > 0;

  return (
    <div
      className={`relative overflow-hidden rounded-2xl border p-4 transition-all duration-200 bg-white/70 dark:bg-slate-900/60 backdrop-blur-sm ${
        isExhausted
          ? 'border-rose-300 dark:border-rose-900/60 shadow-sm shadow-rose-500/5'
          : 'border-slate-200/80 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700/80 hover:shadow-md'
      }`}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-lg flex-shrink-0">
            {cfg.icon}
          </div>
          <div>
            <h4 className="text-sm font-semibold text-slate-900 dark:white leading-tight">
              {item.leaveType}
            </h4>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate max-w-[120px]">
              {item.isUnlimited ? 'No Cap' : `${item.entitlement}d quota`}
            </p>
          </div>
        </div>

        {item.isUnlimited ? (
          <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full border border-slate-200 dark:border-slate-700">
            Unlimited
          </span>
        ) : (
          <div className="text-right">
            <span
              className={`text-base font-bold ${
                isExhausted
                  ? 'text-rose-600 dark:text-rose-400'
                  : 'text-slate-900 dark:text-white'
              }`}
            >
              {item.remaining}
            </span>
            <span className="text-[11px] text-slate-500 dark:text-slate-400 ml-1">
              left
            </span>
          </div>
        )}
      </div>

      {/* Progress bar */}
      {!item.isUnlimited && (
        <div className="mb-2.5">
          <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full bg-gradient-to-r transition-all duration-500 ${
                isExhausted ? 'from-rose-500 to-rose-600' : cfg.barColor
              }`}
              style={{ width: `${usedPct}%` }}
            />
          </div>
        </div>
      )}

      {/* Stats footer */}
      <div className="flex justify-between items-center text-xs text-slate-500 dark:text-slate-400 pt-1 border-t border-slate-100 dark:border-slate-800/80">
        <span>
          Used: <strong className="text-slate-800 dark:text-slate-200">{item.used}d</strong>
        </span>
        {item.pending > 0 && (
          <span className="text-[11px] text-amber-600 dark:text-amber-400 font-medium inline-flex items-center gap-1">
            <Clock className="w-3 h-3 inline" /> {item.pending}d pending
          </span>
        )}
      </div>
    </div>
  );
};

// ─── Balance Section ─────────────────────────────────────────────────────────
const BalanceSection = ({
  balances,
  isManager,
  isLoading,
}: {
  balances: LeaveBalanceDto[];
  isManager: boolean;
  isLoading: boolean;
}) => {
  const [expandedUser, setExpandedUser] = useState<number | null>(null);
  const year = balances[0]?.year ?? new Date().getFullYear();

  if (isLoading) {
    return (
      <Card className="mb-6">
        <CardContent className="p-6">
          <div className="h-5 bg-slate-200 dark:bg-slate-800 rounded w-48 mb-4 animate-pulse" />
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className="h-28 bg-slate-100 dark:bg-slate-800/60 rounded-2xl animate-pulse"
              />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  // Employee view: see own balance cards
  if (!isManager) {
    const myBalance = balances[0];
    if (!myBalance) return null;

    return (
      <div className="mb-8">
        <div className="flex items-center justify-between mb-3 px-1">
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
            Leave Quota Allocation — {year}
          </h3>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            Refreshes annually on Jan 1
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
          {myBalance.balances.map((item) => (
            <LeaveTypeCard key={item.leaveType} item={item} />
          ))}
        </div>
      </div>
    );
  }

  // Manager view: collapsible team members
  return (
    <Card className="mb-8 border-slate-200/80 dark:border-slate-800">
      <CardHeader className="pb-3 border-b border-slate-200/80 dark:border-slate-800/80">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-blue-500" />
              <span>Team Leave Quotas — {year}</span>
            </CardTitle>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Review remaining annual balances across your department
            </p>
          </div>
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
            {balances.length} Employees
          </span>
        </div>
      </CardHeader>
      <CardContent className="p-4 sm:p-5 space-y-2.5">
        {balances.map((emp) => {
          const isOpen = expandedUser === emp.userId;
          const exhausted = emp.balances.filter(
            (b) => !b.isUnlimited && b.remaining === 0 && b.entitlement > 0
          ).length;

          return (
            <div
              key={emp.userId}
              className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden bg-slate-50/50 dark:bg-slate-900/40 transition-colors"
            >
              <button
                type="button"
                onClick={() => setExpandedUser(isOpen ? null : emp.userId)}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-100/70 dark:hover:bg-slate-800/50 transition text-left"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center text-xs font-bold shadow-sm shadow-blue-500/20">
                    {emp.userName.charAt(0).toUpperCase()}
                  </div>
                  <div className="truncate">
                    <span className="text-sm font-semibold text-slate-900 dark:text-white block truncate">
                      {emp.userName}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3 flex-shrink-0">
                  {exhausted > 0 && (
                    <span className="text-[11px] font-medium text-rose-600 dark:text-rose-400 bg-rose-500/10 border border-rose-500/20 px-2 py-0.5 rounded-full">
                      {exhausted} type exhausted
                    </span>
                  )}

                  {/* Mini balance indicators */}
                  <div className="hidden sm:flex items-center gap-2">
                    {emp.balances
                      .filter((b) => !b.isUnlimited)
                      .map((b) => {
                        const pct =
                          b.entitlement > 0
                            ? Math.min(100, Math.round((b.used / b.entitlement) * 100))
                            : 0;
                        const cfg = LEAVE_CONFIG[b.leaveType];
                        return (
                          <div
                            key={b.leaveType}
                            className="flex flex-col items-center gap-0.5"
                            title={`${b.leaveType}: ${b.used}/${b.entitlement} days used`}
                          >
                            <div className="w-7 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                              <div
                                className={`h-full bg-gradient-to-r ${cfg?.barColor ?? 'from-blue-500 to-indigo-500'}`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <span className="text-[9px] font-medium text-slate-400 uppercase">
                              {b.leaveType.slice(0, 3)}
                            </span>
                          </div>
                        );
                      })}
                  </div>

                  <span className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition">
                    {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </span>
                </div>
              </button>

              {isOpen && (
                <div className="px-4 pb-4 pt-2 bg-white/60 dark:bg-slate-900/60 border-t border-slate-200/80 dark:border-slate-800">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5 mt-2">
                    {emp.balances.map((item) => (
                      <LeaveTypeCard key={item.leaveType} item={item} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
        {balances.length === 0 && (
          <p className="text-slate-500 text-sm text-center py-6">
            No active employee balances found.
          </p>
        )}
      </CardContent>
    </Card>
  );
};

// ─── Main Leave Management Component ─────────────────────────────────────────
export const LeaveManagementPage: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const isManager = user?.role === 'Manager';

  const [showApply, setShowApply] = useState(false);
  const [tab, setTab] = useState<'mine' | 'all' | 'holidays'>('mine');
  const [form, setForm] = useState({
    fromDate: '',
    toDate: '',
    leaveType: 'Casual',
    reason: '',
  });

  const [reviewId, setReviewId] = useState<number | null>(null);
  const [reviewNote, setReviewNote] = useState('');
  const [holidayForm, setHolidayForm] = useState({ name: '', date: '', type: 'Public' });

  // ── Queries ──
  const { data: myLeaves = [] } = useQuery({
    queryKey: ['myLeaves'],
    queryFn: () => leaveApi.getMine().then((r) => r.data),
    enabled: tab === 'mine',
  });

  const { data: allLeaves = [] } = useQuery({
    queryKey: ['allLeaves'],
    queryFn: () => leaveApi.getAll().then((r) => r.data),
    enabled: tab === 'all' && isManager,
  });

  const { data: holidays = [] } = useQuery({
    queryKey: ['holidays'],
    queryFn: () => holidayApi.getByYear().then((r) => r.data),
    enabled: tab === 'holidays',
  });

  const { data: balances = [], isLoading: balanceLoading } = useQuery<LeaveBalanceDto[]>({
    queryKey: ['leaveBalance'],
    queryFn: () => leaveApi.getBalance().then((r) => r.data),
  });

  // ── Mutations ──
  const applyLeave = useMutation({
    mutationFn: () => leaveApi.apply(form),
    onSuccess: () => {
      toast.success('Leave applied successfully 🎉');
      qc.invalidateQueries({ queryKey: ['myLeaves'] });
      qc.invalidateQueries({ queryKey: ['leaveBalance'] });
      setForm({ fromDate: '', toDate: '', leaveType: 'Casual', reason: '' });
      setShowApply(false);
    },
    onError: (error: any) => {
      const msg =
        error.response?.data?.message ||
        error.response?.data ||
        'Failed to apply leave';
      toast.error(msg);
    },
  });

  const cancelLeave = useMutation({
    mutationFn: (id: number) => leaveApi.cancel(id),
    onSuccess: () => {
      toast.success('Leave application cancelled');
      qc.invalidateQueries({ queryKey: ['myLeaves'] });
      qc.invalidateQueries({ queryKey: ['leaveBalance'] });
    },
    onError: () => toast.error('Failed to cancel leave'),
  });

  const doReview = useMutation({
    mutationFn: ({ id, s }: { id: number; s: string }) =>
      leaveApi.review(id, { status: s, reviewNote }),
    onSuccess: () => {
      toast.success('Leave review decision submitted');
      qc.invalidateQueries({ queryKey: ['allLeaves'] });
      qc.invalidateQueries({ queryKey: ['leaveBalance'] });
      setReviewId(null);
      setReviewNote('');
    },
    onError: () => toast.error('Failed to submit review'),
  });

  const createHoliday = useMutation({
    mutationFn: () => holidayApi.create(holidayForm),
    onSuccess: () => {
      toast.success('Holiday added to corporate calendar 🎉');
      qc.invalidateQueries({ queryKey: ['holidays'] });
      setHolidayForm({ name: '', date: '', type: 'Public' });
    },
    onError: () => toast.error('Failed to create holiday'),
  });

  const deleteHoliday = useMutation({
    mutationFn: (id: number) => holidayApi.delete(id),
    onSuccess: () => {
      toast.success('Holiday removed from calendar');
      qc.invalidateQueries({ queryKey: ['holidays'] });
    },
    onError: () => toast.error('Failed to delete holiday'),
  });

  // ── Metrics Calculation ──
  const myBalanceItem = balances[0];
  const totalRemainingQuota = useMemo(() => {
    if (!myBalanceItem) return 0;
    return myBalanceItem.balances
      .filter((b) => !b.isUnlimited)
      .reduce((sum, b) => sum + b.remaining, 0);
  }, [myBalanceItem]);

  const totalUsedDays = useMemo(() => {
    if (!myBalanceItem) return 0;
    return myBalanceItem.balances.reduce((sum, b) => sum + b.used, 0);
  }, [myBalanceItem]);

  const pendingLeavesCount = useMemo(() => {
    const list = isManager && tab === 'all' ? allLeaves : myLeaves;
    return list.filter((l: any) => l.status === 'Pending').length;
  }, [myLeaves, allLeaves, isManager, tab]);

  const sickRemaining = useMemo(() => {
    const found = myBalanceItem?.balances.find((b) => b.leaveType === 'Sick');
    return found ? found.remaining : 0;
  }, [myBalanceItem]);

  // Duration in days calculator for form
  const estimatedDays = useMemo(() => {
    if (!form.fromDate || !form.toDate) return null;
    const d1 = new Date(form.fromDate);
    const d2 = new Date(form.toDate);
    if (isNaN(d1.getTime()) || isNaN(d2.getTime()) || d2 < d1) return 0;
    const diffTime = Math.abs(d2.getTime() - d1.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
  }, [form.fromDate, form.toDate]);

  const currentLeaveData = tab === 'mine' ? myLeaves : allLeaves;

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* ── Page Header ── */}
      <PageHeader
        title="Leave & Time Off"
        description="Submit planned absence requests, check annual balances, and track manager approval workflows."
        breadcrumbs={[
          { label: 'Workspace', href: '/' },
          { label: 'HR & Requests' },
          { label: 'Leave Management' },
        ]}
        badge={{ label: 'Annual Quota Active', variant: 'emerald' }}
        actions={
          <button
            type="button"
            onClick={() => setShowApply(!showApply)}
            className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition cursor-pointer shadow-md ${
              showApply
                ? 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700 shadow-none'
                : 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-500/20'
            }`}
          >
            {showApply ? (
              <>
                <X className="w-4 h-4" />
                <span>Cancel</span>
              </>
            ) : (
              <>
                <Plus className="w-4 h-4" />
                <span>Apply for Leave</span>
              </>
            )}
          </button>
        }
      />

      {/* ── KPI Stat Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Available"
          value={`${totalRemainingQuota} Days`}
          subtitle="Total remaining across categories"
          icon={CalendarRange}
          color="emerald"
        />
        <StatCard
          title="Used This Year"
          value={`${totalUsedDays} Days`}
          subtitle="Approved leaves consumed"
          icon={Palmtree}
          color="indigo"
        />
        <StatCard
          title="Sick Leave Available"
          value={`${sickRemaining} Days`}
          subtitle="Dedicated medical reserve"
          icon={HeartPulse}
          color="rose"
        />
        <StatCard
          title="Pending In Review"
          value={pendingLeavesCount}
          subtitle={isManager && tab === 'all' ? 'Team queue waiting' : 'Your pending requests'}
          icon={Clock}
          color="amber"
        />
      </div>

      {/* ── Annual Leave Balance breakdown ── */}
      <BalanceSection
        balances={balances}
        isManager={isManager}
        isLoading={balanceLoading}
      />

      {/* ── Apply Leave Form (Collapsible Card) ── */}
      {showApply && (
        <Card className="border-blue-500/30 shadow-lg shadow-blue-500/5 animate-in fade-in slide-in-from-top-4 duration-300">
          <CardHeader className="border-b border-slate-200/80 dark:border-slate-800/80 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-blue-500" />
                  <span>Submit Leave Application</span>
                </CardTitle>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Specify your leave dates, category, and brief note for supervisor sign-off.
                </p>
              </div>
              {estimatedDays !== null && estimatedDays > 0 && (
                <div className="px-3 py-1 rounded-xl bg-blue-500/10 border border-blue-500/25 text-blue-600 dark:text-blue-400 text-xs font-semibold">
                  {estimatedDays} Day{estimatedDays > 1 ? 's' : ''} Duration
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-5 sm:p-6 space-y-6">
            {/* Category Selector */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-2.5">
                Leave Category <span className="text-rose-500">*</span>
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                {(['Casual', 'Sick', 'Earned', 'CompOff', 'Unpaid'] as const).map((type) => {
                  const cfg = LEAVE_CONFIG[type];
                  const isSelected = form.leaveType === type;
                  const itemBalance = myBalanceItem?.balances.find(
                    (b) => b.leaveType === type
                  );

                  return (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setForm((p) => ({ ...p, leaveType: type }))}
                      className={`flex flex-col items-center justify-center p-3 rounded-2xl border text-center transition-all cursor-pointer ${
                        isSelected
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-500/10 ring-2 ring-blue-500/30'
                          : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 hover:border-slate-300 dark:hover:border-slate-700'
                      }`}
                    >
                      <span className="text-2xl mb-1">{cfg.icon}</span>
                      <span className="text-xs font-bold text-slate-900 dark:text-white">
                        {type}
                      </span>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                        {itemBalance
                          ? itemBalance.isUnlimited
                            ? 'Unlimited'
                            : `${itemBalance.remaining}d left`
                          : ''}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Date Pickers */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-2">
                  From Date <span className="text-rose-500">*</span>
                </label>
                <DatePicker
                  value={form.fromDate}
                  onChange={(v) => setForm((p) => ({ ...p, fromDate: v }))}
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-2">
                  To Date <span className="text-rose-500">*</span>
                </label>
                <DatePicker
                  value={form.toDate}
                  onChange={(v) => setForm((p) => ({ ...p, toDate: v }))}
                />
              </div>
            </div>

            {/* Reason Textarea */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  Reason / Purpose <span className="text-rose-500">*</span>
                </label>
                <span className="text-[11px] text-slate-400">
                  {form.reason.length} / 500
                </span>
              </div>
              <textarea
                value={form.reason}
                onChange={(e) => setForm((p) => ({ ...p, reason: e.target.value }))}
                placeholder="Provide a clear, brief reason for your requested leave..."
                rows={3}
                maxLength={500}
                className="w-full bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white text-xs sm:text-sm rounded-2xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none transition"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowApply(false)}
                className="px-5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => applyLeave.mutate()}
                disabled={
                  !form.fromDate ||
                  !form.toDate ||
                  !form.reason.trim() ||
                  applyLeave.isPending
                }
                className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition shadow-md shadow-blue-500/20"
              >
                <Send className="w-3.5 h-3.5" />
                <span>
                  {applyLeave.isPending ? 'Submitting Application...' : 'Submit Application'}
                </span>
              </button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Navigation Tabs ── */}
      <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
        <div className="flex gap-2 bg-slate-100 dark:bg-slate-900/90 p-1.5 rounded-2xl border border-slate-200/80 dark:border-slate-800">
          <button
            type="button"
            onClick={() => setTab('mine')}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition cursor-pointer ${
              tab === 'mine'
                ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            My Leave Requests
          </button>
          {isManager && (
            <button
              type="button"
              onClick={() => setTab('all')}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                tab === 'all'
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <span>Team Applications</span>
              {pendingLeavesCount > 0 && (
                <span className="w-5 h-5 rounded-full bg-amber-500 text-white text-[10px] font-bold flex items-center justify-center">
                  {pendingLeavesCount}
                </span>
              )}
            </button>
          )}
          <button
            type="button"
            onClick={() => setTab('holidays')}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition cursor-pointer flex items-center gap-1.5 ${
              tab === 'holidays'
                ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <span>🗓️ Company Holidays</span>
          </button>
        </div>
      </div>

      {/* ── Tab Content: Holidays vs Requests ── */}
      {tab === 'holidays' ? (
        <div className="space-y-6">
          {/* Manager: Add Holiday Card */}
          {isManager && (
            <Card className="border-slate-200/80 dark:border-slate-800">
              <CardHeader className="pb-3 border-b border-slate-200/80 dark:border-slate-800/80">
                <CardTitle className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <PartyPopper className="w-4 h-4 text-amber-500" />
                  <span>Add Corporate / Public Holiday</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 sm:p-5">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      Holiday Name
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Independence Day"
                      value={holidayForm.name}
                      onChange={(e) =>
                        setHolidayForm((p) => ({ ...p, name: e.target.value }))
                      }
                      className="w-full bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white text-xs sm:text-sm rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      Holiday Date
                    </label>
                    <DatePicker
                      value={holidayForm.date}
                      onChange={(v) =>
                        setHolidayForm((p) => ({ ...p, date: v }))
                      }
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      Holiday Type
                    </label>
                    <select
                      value={holidayForm.type}
                      onChange={(e) =>
                        setHolidayForm((p) => ({ ...p, type: e.target.value }))
                      }
                      className="w-full bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white text-xs sm:text-sm rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="Public">Public (Mandatory)</option>
                      <option value="Optional">Optional (Floating)</option>
                      <option value="Company">Company Special</option>
                    </select>
                  </div>
                </div>
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => createHoliday.mutate()}
                    disabled={
                      !holidayForm.name ||
                      !holidayForm.date ||
                      createHoliday.isPending
                    }
                    className="inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition shadow-sm shadow-blue-500/20"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{createHoliday.isPending ? 'Adding...' : 'Add Holiday'}</span>
                  </button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Holiday List Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {(holidays as any[]).map((h: any) => (
              <div
                key={h.id}
                className={`relative rounded-2xl border p-4 transition-all bg-white dark:bg-slate-900/60 ${
                  h.isToday
                    ? 'border-blue-500 ring-2 ring-blue-500/20 shadow-md'
                    : 'border-slate-200/80 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700/80'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">🎉</span>
                      <h4 className="font-bold text-slate-900 dark:text-white text-sm sm:text-base">
                        {h.name}
                      </h4>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-medium pl-7">
                      {new Date(h.date).toLocaleDateString('en-IN', {
                        weekday: 'short',
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                      })}
                    </p>
                  </div>

                  {isManager && (
                    <button
                      type="button"
                      onClick={() => deleteHoliday.mutate(h.id)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 transition"
                      title="Remove holiday"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-100 dark:border-slate-800/80 pl-7">
                  <span className="text-[10px] font-semibold tracking-wider uppercase px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                    {h.type}
                  </span>
                  {h.isToday && (
                    <span className="text-[11px] font-bold text-blue-600 dark:text-blue-400 animate-pulse">
                      Today's Holiday 🎉
                    </span>
                  )}
                </div>
              </div>
            ))}
            {(holidays as any[]).length === 0 && (
              <div className="col-span-full text-center py-16 text-slate-400">
                No company holidays published yet.
              </div>
            )}
          </div>
        </div>
      ) : (
        /* ── Leave Requests List ── */
        <div className="space-y-3.5">
          {currentLeaveData.length === 0 && (
            <Card className="border-slate-200/80 dark:border-slate-800">
              <CardContent className="text-center py-16 text-slate-400 dark:text-slate-500 space-y-3">
                <CalendarRange className="w-10 h-10 mx-auto opacity-40 text-slate-400" />
                <p className="text-sm font-medium">No leave applications found in this view.</p>
                <p className="text-xs text-slate-400">
                  Click "+ Apply for Leave" above to create a new time off request.
                </p>
              </CardContent>
            </Card>
          )}

          {currentLeaveData.map((l: any) => {
            const cfg = LEAVE_CONFIG[l.leaveType] ?? LEAVE_CONFIG.Casual;
            const isPending = l.status === 'Pending';

            return (
              <Card
                key={l.id}
                className="border-slate-200/80 dark:border-slate-800/80 hover:border-slate-300 dark:hover:border-slate-700/80 transition-all shadow-sm"
              >
                <CardContent className="p-4 sm:p-5">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                    <div className="space-y-2 flex-1">
                      {tab === 'all' && (
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
                          <span className="w-5 h-5 rounded-full bg-blue-500/10 text-blue-600 flex items-center justify-center text-[10px]">
                            👤
                          </span>
                          <span>{l.userName}</span>
                        </div>
                      )}

                      <div className="flex items-center gap-2.5 flex-wrap">
                        <div className="flex items-center gap-1.5">
                          <span className="text-lg">{cfg.icon}</span>
                          <span className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                            {l.leaveType} Leave
                          </span>
                        </div>
                        <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                          {l.leaveDays} Day{l.leaveDays > 1 ? 's' : ''}
                        </span>
                      </div>

                      {/* Date Range */}
                      <p className="text-xs sm:text-sm font-medium text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-slate-400 inline" />
                        <span>
                          {new Date(l.fromDate).toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                          })}
                        </span>
                        <span className="text-slate-400">→</span>
                        <span>
                          {new Date(l.toDate).toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </span>
                      </p>

                      {/* Reason */}
                      {l.reason && (
                        <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed bg-slate-50 dark:bg-slate-900/60 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                          {l.reason}
                        </p>
                      )}

                      {/* Manager Review note */}
                      {l.reviewerName && (
                        <div className="pt-1 text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                          <span>
                            Reviewed by <strong>{l.reviewerName}</strong>
                            {l.reviewNote ? `: "${l.reviewNote}"` : ''}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Right side: Status and Actions */}
                    <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-start gap-2 flex-shrink-0">
                      <StatusBadge status={l.status} />

                      <span className="text-[11px] text-slate-400">
                        {new Date(l.appliedAt).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                        })}
                      </span>

                      {/* Cancel action for employee */}
                      {tab === 'mine' && isPending && (
                        <button
                          type="button"
                          onClick={() => cancelLeave.mutate(l.id)}
                          className="mt-1 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:text-rose-500 transition px-2 py-1 rounded-lg hover:bg-rose-500/10 cursor-pointer"
                        >
                          Cancel Request
                        </button>
                      )}

                      {/* Review trigger for manager */}
                      {tab === 'all' && isPending && reviewId !== l.id && (
                        <button
                          type="button"
                          onClick={() => {
                            setReviewId(l.id);
                            setReviewNote('');
                          }}
                          className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10 border border-blue-500/30 px-3 py-1.5 rounded-xl hover:bg-blue-100 dark:hover:bg-blue-500/20 transition cursor-pointer"
                        >
                          Review Application
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Manager Review Drawer */}
                  {reviewId === l.id && (
                    <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-800 space-y-3 animate-in fade-in duration-200">
                      <textarea
                        value={reviewNote}
                        onChange={(e) => setReviewNote(e.target.value)}
                        placeholder="Add review feedback or reason (optional)..."
                        rows={2}
                        className="w-full bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white text-xs rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                      />
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => doReview.mutate({ id: l.id, s: 'Approved' })}
                          disabled={doReview.isPending}
                          className="flex-1 inline-flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold py-2 rounded-xl transition shadow-sm shadow-emerald-500/20"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Approve</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => doReview.mutate({ id: l.id, s: 'Rejected' })}
                          disabled={doReview.isPending}
                          className="flex-1 inline-flex items-center justify-center gap-1.5 bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold py-2 rounded-xl transition shadow-sm shadow-rose-500/20"
                        >
                          <X className="w-3.5 h-3.5" />
                          <span>Reject</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setReviewId(null)}
                          className="px-3.5 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold rounded-xl transition"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default LeaveManagementPage;