import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { leaveApi, holidayApi } from '../services/api';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/Authcontext';
import { Trash2 } from 'lucide-react';
import { LeaveBalanceDto, LeaveTypeBalanceItem } from '../types';
import { DatePicker } from '../components/DatePicker';

// ─── Leave type visual config ─────────────────────────────────────────────────
const LEAVE_CONFIG: Record<string, { icon: string; color: string; bar: string }> = {
  Casual:  { icon: '🌴', color: 'text-blue-400',    bar: 'bg-blue-500'    },
  Sick:    { icon: '🤒', color: 'text-red-400',     bar: 'bg-red-500'     },
  Earned:  { icon: '⭐', color: 'text-amber-400',   bar: 'bg-amber-500'   },
  CompOff: { icon: '🔄', color: 'text-violet-400',  bar: 'bg-violet-500'  },
  Unpaid:  { icon: '💸', color: 'text-slate-400',   bar: 'bg-slate-500'   },
};

// ─── Single leave-type balance card ──────────────────────────────────────────
const LeaveTypeCard = ({ item }: { item: LeaveTypeBalanceItem }) => {
  const cfg     = LEAVE_CONFIG[item.leaveType] ?? LEAVE_CONFIG.Casual;
  const usedPct = item.isUnlimited
    ? 0
    : item.entitlement > 0 ? Math.min(100, Math.round(item.used / item.entitlement * 100)) : 0;

  const isExhausted = !item.isUnlimited && item.remaining === 0 && item.entitlement > 0;

  return (
    <div className={`bg-slate-800/60 border rounded-2xl p-4 transition-colors ${
      isExhausted ? 'border-red-500/40' : 'border-slate-700/50 hover:border-slate-600'
    }`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xl">{cfg.icon}</span>
          <span className="text-sm font-semibold text-white">{item.leaveType}</span>
        </div>
        {item.isUnlimited
          ? <span className="text-xs text-slate-500 bg-slate-700/50 px-2 py-0.5 rounded-full">Unlimited</span>
          : <span className={`text-xs font-bold ${isExhausted ? 'text-red-400' : cfg.color}`}>
              {item.remaining} left
            </span>
        }
      </div>

      {/* Progress bar (only for capped types) */}
      {!item.isUnlimited && (
        <div className="mb-3">
          <div className="w-full h-1.5 bg-slate-700 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${isExhausted ? 'bg-red-500' : cfg.bar}`}
              style={{ width: `${usedPct}%` }}
            />
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="flex justify-between text-xs text-slate-500">
        {item.isUnlimited ? (
          <span>Used: <span className="text-white font-medium">{item.used}d</span></span>
        ) : (
          <>
            <span>Used: <span className="text-white font-medium">{item.used}d</span></span>
            <span>/ {item.entitlement}d annual</span>
          </>
        )}
      </div>

      {/* Pending indicator */}
      {item.pending > 0 && (
        <p className="text-[11px] text-amber-400/80 mt-1.5">
          ⏳ {item.pending}d pending approval
        </p>
      )}
    </div>
  );
};

// ─── Balance section: employee sees own, manager sees all ────────────────────
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
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 mb-6">
        <div className="h-4 bg-slate-800 rounded w-40 mb-4 animate-pulse" />
        <div className="grid grid-cols-3 gap-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-24 bg-slate-800 rounded-2xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  // ── Employee view ──────────────────────────────────────────────────────────
  if (!isManager) {
    const myBalance = balances[0];
    if (!myBalance) return null;

    return (
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-white">
            📊 Your Leave Balance — {year}
          </h3>
          <span className="text-xs text-slate-500">Annual entitlements</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {myBalance.balances.map(item => (
            <LeaveTypeCard key={item.leaveType} item={item} />
          ))}
        </div>
      </div>
    );
  }

  // ── Manager view — collapsible per-employee ────────────────────────────────
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-white">
          📊 Team Leave Balances — {year}
        </h3>
        <span className="text-xs text-slate-500">{balances.length} employees</span>
      </div>

      <div className="space-y-2">
        {balances.map(emp => {
          const isOpen = expandedUser === emp.userId;

          // Quick summary: count exhausted leave types
          const exhausted = emp.balances.filter(
            b => !b.isUnlimited && b.remaining === 0 && b.entitlement > 0
          ).length;

          return (
            <div key={emp.userId} className="border border-slate-800 rounded-xl overflow-hidden">
              {/* Employee row */}
              <button
                onClick={() => setExpandedUser(isOpen ? null : emp.userId)}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-800/40 transition text-left"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-xs font-bold text-blue-400">
                    {emp.userName.charAt(0).toUpperCase()}
                  </div>
                  <span className="text-sm font-medium text-white">{emp.userName}</span>
                </div>

                <div className="flex items-center gap-3">
                  {exhausted > 0 && (
                    <span className="text-[11px] text-red-400 bg-red-500/10 border border-red-500/20 px-2 py-0.5 rounded-full">
                      {exhausted} type{exhausted > 1 ? 's' : ''} exhausted
                    </span>
                  )}
                  {/* Mini bar summary */}
                  <div className="hidden sm:flex items-center gap-1.5">
                    {emp.balances.filter(b => !b.isUnlimited).map(b => {
                      const pct = b.entitlement > 0 ? Math.min(100, b.used / b.entitlement * 100) : 0;
                      const cfg = LEAVE_CONFIG[b.leaveType];
                      return (
                        <div key={b.leaveType} className="flex flex-col items-center gap-0.5">
                          <div className="w-8 h-1 bg-slate-700 rounded-full overflow-hidden">
                            <div className={`h-full ${cfg?.bar ?? 'bg-blue-500'}`} style={{ width: `${pct}%` }} />
                          </div>
                          <span className="text-[9px] text-slate-600">{b.leaveType.slice(0, 3)}</span>
                        </div>
                      );
                    })}
                  </div>
                  <span className="text-slate-500 text-xs">{isOpen ? '▲' : '▼'}</span>
                </div>
              </button>

              {/* Expanded cards */}
              {isOpen && (
                <div className="px-4 pb-4 pt-2 bg-slate-800/20">
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
                    {emp.balances.map(item => (
                      <LeaveTypeCard key={item.leaveType} item={item} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {balances.length === 0 && (
          <p className="text-slate-500 text-sm text-center py-4">No active employees found.</p>
        )}
      </div>
    </div>
  );
};

// ─── Main page ────────────────────────────────────────────────────────────────
export const LeaveManagementPage = () => {
  const { user }  = useAuth();
  const { toast } = useToast();
  const qc        = useQueryClient();
  const isManager = user?.role === 'Manager';

  const [showApply, setShowApply] = useState(false);
  const [tab,       setTab]       = useState<'mine' | 'all' | 'holidays'>('mine');
  const [form,      setForm]      = useState({ fromDate: '', toDate: '', leaveType: 'Casual', reason: '' });
  const [reviewId,  setReviewId]  = useState<number | null>(null);
  const [reviewNote, setReviewNote] = useState('');
  const [holidayForm, setHolidayForm] = useState({ name: '', date: '', type: 'Public' });

  const { data: myLeaves  = [] } = useQuery({
    queryKey: ['myLeaves'],
    queryFn:  () => leaveApi.getMine().then(r => r.data),
    enabled:  tab === 'mine',
  });
  const { data: allLeaves = [] } = useQuery({
    queryKey: ['allLeaves'],
    queryFn:  () => leaveApi.getAll().then(r => r.data),
    enabled:  tab === 'all' && isManager,
  });
  const { data: holidays  = [] } = useQuery({
    queryKey: ['holidays'],
    queryFn:  () => holidayApi.getByYear().then(r => r.data),
    enabled:  tab === 'holidays',
  });

  const { data: balances = [], isLoading: balanceLoading } = useQuery<LeaveBalanceDto[]>({
    queryKey: ['leaveBalance'],
    queryFn:  () => leaveApi.getBalance().then(r => r.data),
  });

  const applyLeave = useMutation({
    mutationFn: () => leaveApi.apply(form),
    onSuccess: () => {
      toast.success('Leave applied successfully 🎉');
      qc.invalidateQueries({ queryKey: ['myLeaves'] });
      qc.invalidateQueries({ queryKey: ['leaveBalance'] });
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
      toast.success('Leave cancelled');
      qc.invalidateQueries({ queryKey: ['myLeaves'] });
      qc.invalidateQueries({ queryKey: ['leaveBalance'] });
    },
  });

  const doReview = useMutation({
    mutationFn: ({ id, s }: { id: number; s: string }) =>
      leaveApi.review(id, { status: s, reviewNote }),
    onSuccess: () => {
      toast.success('Review submitted');
      qc.invalidateQueries({ queryKey: ['allLeaves'] });
      qc.invalidateQueries({ queryKey: ['leaveBalance'] });
      setReviewId(null);
    },
  });

  const createHoliday = useMutation({
    mutationFn: () => holidayApi.create(holidayForm),
    onSuccess: () => {
      toast.success('Holiday added successfully 🎉');
      qc.invalidateQueries({ queryKey: ['holidays'] });
      setHolidayForm({ name: '', date: '', type: 'Public' });
    },
  });

  const deleteHoliday = useMutation({
    mutationFn: (id: number) => holidayApi.delete(id),
    onSuccess: () => {
      toast.success('Holiday deleted');
      qc.invalidateQueries({ queryKey: ['holidays'] });
    },
  });

  const leaveData: any[] = tab === 'mine' ? myLeaves : allLeaves;
  const statusColor: Record<string, string> = {
    Pending:  'text-amber-400 bg-amber-500/10 border border-amber-500/20',
    Approved: 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/20',
    Rejected: 'text-red-400 bg-red-500/10 border border-red-500/20',
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* ── Page header ───────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Leave Management</h1>
          <p className="text-slate-400 text-sm mt-1">Apply and track your leave requests</p>
        </div>
        <button
          onClick={() => setShowApply(!showApply)}
          className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition"
        >
          {showApply ? 'Cancel' : '+ Apply Leave'}
        </button>
      </div>

      {/* ── Annual leave balance (new per-type cards) ──────────────────────── */}
      <BalanceSection
        balances={balances}
        isManager={isManager}
        isLoading={balanceLoading}
      />

      {/* ── Apply leave form (UNCHANGED) ──────────────────────────────────── */}
      {showApply && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 mb-6">
          <h3 className="text-sm font-semibold text-white mb-4">New Leave Application</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1">From Date</label>
             <DatePicker value={form.fromDate}
              onChange={v => setForm(p => ({ ...p, fromDate: v }))} />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">To Date</label>
              <DatePicker value={form.toDate}
                onChange={v => setForm(p => ({ ...p, toDate: v }))} />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Leave Type</label>
              <select
                value={form.leaveType}
                onChange={e => setForm(p => ({ ...p, leaveType: e.target.value }))}
                className="w-full bg-slate-800 border border-slate-700 text-white text-sm rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {['Casual', 'Sick', 'Earned', 'CompOff', 'Unpaid'].map(t => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </div>
          </div>
          <textarea
            value={form.reason}
            onChange={e => setForm(p => ({ ...p, reason: e.target.value }))}
            placeholder="Reason for leave..."
            rows={2}
            className="w-full bg-slate-800 border border-slate-700 text-white text-sm rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none mb-3"
          />
          <button
            onClick={() => applyLeave.mutate()}
            disabled={!form.fromDate || !form.toDate || !form.reason.trim() || applyLeave.isPending}
            className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-6 py-2.5 rounded-xl text-sm font-semibold transition"
          >
            {applyLeave.isPending ? 'Submitting...' : 'Submit Application'}
          </button>
        </div>
      )}

      {/* ── Tabs ──────────────────────────────────────────────────────────── */}
      <div className="flex gap-2 mb-5 bg-slate-900 border border-slate-800 rounded-2xl p-1.5 w-fit">
        {(['mine', ...(isManager ? ['all'] : []), 'holidays'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t as 'mine' | 'all' | 'holidays')}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition ${
              tab === t ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            {t === 'mine' ? 'My Leaves' : t === 'all' ? 'All Team Leaves' : '🗓️ Holidays'}
          </button>
        ))}
      </div>

      {/* ── Holidays tab (UNCHANGED) ───────────────────────────────────────── */}
      {tab === 'holidays' ? (
        <>
          {isManager && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 mb-6">
              <h3 className="text-sm font-semibold text-white mb-4">Add New Holiday</h3>
              <div className="grid md:grid-cols-3 gap-3 mb-3">
                <input
                  type="text" placeholder="Holiday Name" value={holidayForm.name}
                  onChange={e => setHolidayForm(p => ({ ...p, name: e.target.value }))}
                  className="bg-slate-800 border border-slate-700 text-white text-sm rounded-xl px-3 py-2"
                />
                <DatePicker value={holidayForm.date}
                  onChange={v => setHolidayForm(p => ({ ...p, date: v }))} />
                <select
                  value={holidayForm.type}
                  onChange={e => setHolidayForm(p => ({ ...p, type: e.target.value }))}
                  className="bg-slate-800 border border-slate-700 text-white text-sm rounded-xl px-3 py-2"
                >
                  <option value="Public">Public</option>
                  <option value="Optional">Optional</option>
                  <option value="Company">Company</option>
                </select>
              </div>
              <button
                onClick={() => createHoliday.mutate()}
                disabled={!holidayForm.name || !holidayForm.date || createHoliday.isPending}
                className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-6 py-2.5 rounded-xl text-sm font-semibold transition"
              >
                {createHoliday.isPending ? 'Adding...' : 'Add Holiday'}
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {(holidays as any[]).map((h: any) => (
              <div
                key={h.id}
                className={`bg-slate-900 border rounded-2xl p-4 ${
                  h.isToday ? 'border-blue-500 ring-1 ring-blue-500/20' : 'border-slate-800'
                }`}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-white font-semibold">{h.name}</p>
                    <p className="text-slate-400 text-sm mt-1">
                      {new Date(h.date).toLocaleDateString('en-IN', {
                        weekday: 'long', day: 'numeric', month: 'long',
                      })}
                    </p>
                  </div>
                  {isManager && (
                    <button
                      onClick={() => deleteHoliday.mutate(h.id)}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-xs text-slate-500 bg-slate-800 px-2 py-0.5 rounded-lg">{h.type}</span>
                  {h.isToday && <span className="text-xs text-blue-400 font-medium">Today 🎉</span>}
                </div>
              </div>
            ))}
            {(holidays as any[]).length === 0 && (
              <div className="col-span-3 text-center py-12 text-slate-500">No holidays added yet.</div>
            )}
          </div>
        </>
      ) : (
        // ── Leave list (UNCHANGED) ───────────────────────────────────────────
        <div className="space-y-3">
          {leaveData.length === 0 && (
            <div className="text-center py-12 text-slate-500">No leave requests found.</div>
          )}
          {leaveData.map((l: any) => (
            <div key={l.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  {tab === 'all' && (
                    <p className="text-xs text-slate-400 mb-1 font-medium">👤 {l.userName}</p>
                  )}
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-white font-semibold">
                      {LEAVE_CONFIG[l.leaveType]?.icon ?? '🗓️'} {l.leaveType} Leave
                    </p>
                    <span className="text-xs text-slate-500">•</span>
                    <p className="text-slate-400 text-sm">
                      {l.leaveDays} day{l.leaveDays > 1 ? 's' : ''}
                    </p>
                  </div>
                  <p className="text-slate-300 text-sm">
                    {new Date(l.fromDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                    {' → '}
                    {new Date(l.toDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </p>
                  <p className="text-slate-500 text-xs mt-1.5">{l.reason}</p>
                  {l.reviewerName && (
                    <p className="text-slate-400 text-xs mt-1">
                      Reviewed by {l.reviewerName}{l.reviewNote ? `: ${l.reviewNote}` : ''}
                    </p>
                  )}
                </div>
                <div className="flex flex-col items-end gap-2 ml-4">
                  <span className={`text-xs px-2.5 py-1 rounded-xl font-medium ${statusColor[l.status] ?? ''}`}>
                    {l.status}
                  </span>
                  <p className="text-xs text-slate-600">
                    Applied {new Date(l.appliedAt).toLocaleDateString()}
                  </p>
                  {tab === 'mine' && l.status === 'Pending' && (
                    <button
                      onClick={() => cancelLeave.mutate(l.id)}
                      className="text-xs text-red-400 hover:text-red-300 transition"
                    >
                      Cancel
                    </button>
                  )}
                  {tab === 'all' && l.status === 'Pending' && !reviewId && (
                    <button
                      onClick={() => setReviewId(l.id)}
                      className="text-xs bg-blue-600/20 text-blue-400 border border-blue-500/30 px-3 py-1 rounded-lg hover:bg-blue-600/30 transition"
                    >
                      Review
                    </button>
                  )}
                </div>
              </div>

              {reviewId === l.id && (
                <div className="mt-4 pt-4 border-t border-slate-800">
                  <textarea
                    value={reviewNote}
                    onChange={e => setReviewNote(e.target.value)}
                    placeholder="Review note (optional)..."
                    rows={2}
                    className="w-full bg-slate-800 border border-slate-700 text-white text-sm rounded-xl px-3 py-2 focus:outline-none resize-none mb-3"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => doReview.mutate({ id: l.id, s: 'Approved' })}
                      className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white text-sm py-2 rounded-xl font-medium transition"
                    >
                      ✅ Approve
                    </button>
                    <button
                      onClick={() => doReview.mutate({ id: l.id, s: 'Rejected' })}
                      className="flex-1 bg-red-600 hover:bg-red-500 text-white text-sm py-2 rounded-xl font-medium transition"
                    >
                      ❌ Reject
                    </button>
                    <button
                      onClick={() => setReviewId(null)}
                      className="bg-slate-700 text-slate-300 text-sm py-2 px-3 rounded-xl"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};