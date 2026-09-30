// ─────────────────────────────────────────────────────────────────────────────
//  FILE: ui/src/components/PendingLeavePanel.tsx
//  Leave applications waiting for the manager, shown next to pending WFH
//  requests on the manager's Employee Requests page — approve or reject with an
//  optional note. Uses the same API and rules as the Leave page's Team tab
//  (the server decides who can review what; own requests show as "waiting").
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarDays, Check, Palmtree, X } from 'lucide-react';
import { leaveApi } from '../services/api';
import type { LeaveRequest } from '../types';
import { useToast } from '../context/ToastContext';
import { apiErrorMessage } from '../utils/apiError';

const fmt = (d: string) =>
  new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

/** Pending leave for the manager's team (query shared with the page's pending counter).
 *  Leave decisions are Manager-only on the server, so Team Leads don't ask. */
export const usePendingLeave = (enabled = true) =>
  useQuery<LeaveRequest[]>({
    queryKey: ['pendingLeave'],
    queryFn: () => leaveApi.getAll('Pending').then(r => r.data),
    refetchInterval: 30000,
    enabled,
  });

export const PendingLeavePanel = () => {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [notes, setNotes] = useState<Record<number, string>>({});
  const { data: pending = [], isLoading } = usePendingLeave();

  const review = useMutation({
    mutationFn: ({ id, status }: { id: number; status: 'Approved' | 'Rejected' }) =>
      leaveApi.review(id, { status, reviewNote: notes[id] || undefined }),
    onSuccess: (_, v) => toast.success(v.status === 'Approved' ? 'Leave approved' : 'Leave rejected'),
    onError: (err: unknown) => toast.error(apiErrorMessage(err, 'Could not save the decision')),
    // refresh every view that shows leave, so they all match the server
    onSettled: () => {
      ['pendingLeave', 'allLeaves', 'myLeaves', 'leaveBalance', 'teamStatus'].forEach(k =>
        qc.invalidateQueries({ queryKey: [k] }));
    },
  });

  return (
    <section aria-labelledby="pending-leave-title" className="space-y-3">
      <div className="flex items-center gap-2">
        <Palmtree className="w-4 h-4 text-emerald-500" />
        <h3 id="pending-leave-title" className="text-sm font-bold text-slate-900 dark:text-white">Leave requests</h3>
        <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">
          {pending.length} pending
        </span>
      </div>

      {isLoading ? (
        <div className="h-24 rounded-2xl bg-slate-100 dark:bg-slate-800/60 animate-pulse" />
      ) : pending.length === 0 ? (
        <p className="text-sm text-slate-500 dark:text-slate-400 px-4 py-6 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 text-center">
          No leave applications waiting for a decision.
        </p>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {pending.map(l => {
            const busy = review.isPending && review.variables?.id === l.id;
            return (
              <article key={l.id} data-testid={`leave-${l.id}`}
                className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-900 dark:text-white truncate">{l.userName}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Applied {fmt(l.appliedAt)}</p>
                  </div>
                  <span className="shrink-0 text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
                    {l.leaveType}
                  </span>
                </div>

                <div className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                  <CalendarDays className="w-4 h-4 text-slate-400 shrink-0" />
                  <span>{fmt(l.fromDate)}{l.toDate !== l.fromDate && ` → ${fmt(l.toDate)}`}</span>
                  <span className="text-xs text-slate-500 dark:text-slate-400">· {l.leaveDays} day{l.leaveDays === 1 ? '' : 's'}</span>
                </div>

                {l.reason && (
                  <p className="text-sm text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/50 rounded-xl px-3 py-2 break-words">
                    “{l.reason}”
                  </p>
                )}

                {l.canReview === false ? (
                  <p className="text-xs font-medium text-amber-700 dark:text-amber-400">
                    Your own request — another manager decides this one.
                  </p>
                ) : (
                  <>
                    <input
                      value={notes[l.id] ?? ''}
                      onChange={e => setNotes(n => ({ ...n, [l.id]: e.target.value }))}
                      placeholder="Note to the employee (optional)"
                      aria-label={`Note for ${l.userName}`}
                      className="w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                    />
                    <div className="flex gap-2">
                      <button type="button" disabled={busy}
                        onClick={() => review.mutate({ id: l.id, status: 'Approved' })}
                        className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 rounded-xl text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 text-white transition disabled:opacity-50">
                        <Check className="w-4 h-4" /> Approve
                      </button>
                      <button type="button" disabled={busy}
                        onClick={() => review.mutate({ id: l.id, status: 'Rejected' })}
                        className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 rounded-xl text-sm font-semibold border border-rose-300 dark:border-rose-500/40 text-rose-700 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition disabled:opacity-50">
                        <X className="w-4 h-4" /> Reject
                      </button>
                    </div>
                  </>
                )}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
};
