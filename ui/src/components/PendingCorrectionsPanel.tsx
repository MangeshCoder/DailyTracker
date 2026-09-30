// ─────────────────────────────────────────────────────────────────────────────
//  FILE: ui/src/components/PendingCorrectionsPanel.tsx
//  Check-out corrections waiting for a decision — shown on Employee Requests
//  next to leave and WFH. After a forgotten check-out the employee sends the
//  real finish time; approving it updates their hours (and overtime).
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Clock3, X } from 'lucide-react';
import { dailyLogApi } from '../services/api';
import { useToast } from '../context/ToastContext';
import { apiErrorMessage } from '../utils/apiError';
import { utcDate } from '../utils/date';

interface Correction {
  logId: number;
  userName: string;
  logDate: string;
  checkInTime: string;
  autoCheckOutTime: string;
  requestedCheckOut: string;
  basis: 'LastActivity' | 'NormalDay';
  reason: string;
  isOwn: boolean;
}

const time = (iso: string) => utcDate(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' });
const day = (iso: string) => new Date(iso).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
const span = (from: string, to: string) => {
  const m = Math.max(0, Math.round((utcDate(to).getTime() - utcDate(from).getTime()) / 60000));
  return `${Math.floor(m / 60)}h ${m % 60}m`;
};

/** Pending corrections for this manager / team lead (shared with the page's counter) */
export const usePendingCorrections = (enabled = true) =>
  useQuery<Correction[]>({
    queryKey: ['pendingCorrections'],
    queryFn: () => dailyLogApi.getPendingCorrections().then(r => r.data),
    refetchInterval: 30000,
    enabled,
  });

export const PendingCorrectionsPanel = () => {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [notes, setNotes] = useState<Record<number, string>>({});
  const { data: pending = [], isLoading } = usePendingCorrections();

  const review = useMutation({
    mutationFn: ({ id, status }: { id: number; status: 'Approved' | 'Rejected' }) =>
      dailyLogApi.reviewCheckoutCorrection(id, { status, note: notes[id] || undefined }),
    onSuccess: (_, v) => toast.success(v.status === 'Approved' ? 'Check-out corrected — hours updated' : 'Correction declined'),
    onError: (e: unknown) => toast.error(apiErrorMessage(e, 'Could not save the decision')),
    onSettled: () => ['pendingCorrections', 'teamStatus', 'teamMonthly'].forEach(k => qc.invalidateQueries({ queryKey: [k] })),
  });

  return (
    <section aria-labelledby="corrections-title" className="space-y-3">
      <div className="flex items-center gap-2">
        <Clock3 className="w-4 h-4 text-amber-500" />
        <h3 id="corrections-title" className="text-sm font-bold text-slate-900 dark:text-white">Check-out corrections</h3>
        <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-400">
          {pending.length} pending
        </span>
      </div>

      {isLoading ? (
        <div className="h-24 rounded-2xl bg-slate-100 dark:bg-slate-800/60 animate-pulse" />
      ) : pending.length === 0 ? (
        <p className="text-sm text-slate-500 dark:text-slate-400 px-4 py-6 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 text-center">
          No check-out corrections waiting.
        </p>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {pending.map(c => {
            const busy = review.isPending && review.variables?.id === c.logId;
            return (
              <article key={c.logId} data-testid={`correction-${c.logId}`}
                className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-900 dark:text-white truncate">{c.userName}{c.isOwn && ' (you)'}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Forgot to check out · {day(c.logDate)}</p>
                  </div>
                  <span className="shrink-0 text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20">
                    Correction
                  </span>
                </div>

                <dl className="grid grid-cols-3 gap-2 text-sm">
                  <div className="rounded-xl bg-slate-50 dark:bg-slate-800/50 px-3 py-2">
                    <dt className="text-[11px] text-slate-500 dark:text-slate-400">Checked in</dt>
                    <dd className="font-semibold text-slate-900 dark:text-white">{time(c.checkInTime)}</dd>
                  </div>
                  <div className="rounded-xl bg-slate-50 dark:bg-slate-800/50 px-3 py-2">
                    <dt className="text-[11px] text-slate-500 dark:text-slate-400">
                      Closed by app{c.basis === 'LastActivity' ? ' (last activity)' : ''}
                    </dt>
                    <dd className="font-semibold text-slate-900 dark:text-white line-through decoration-slate-400">{time(c.autoCheckOutTime)}</dd>
                  </div>
                  <div className="rounded-xl bg-blue-50 dark:bg-blue-500/10 px-3 py-2">
                    <dt className="text-[11px] text-blue-700 dark:text-blue-300">Says finished</dt>
                    <dd className="font-semibold text-blue-800 dark:text-blue-200">{time(c.requestedCheckOut)}</dd>
                  </div>
                </dl>
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  Day becomes {span(c.checkInTime, c.requestedCheckOut)} long (was {span(c.checkInTime, c.autoCheckOutTime)}), breaks not included.
                </p>
                <p className="text-sm text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/50 rounded-xl px-3 py-2 break-words">“{c.reason}”</p>

                <input
                  value={notes[c.logId] ?? ''}
                  onChange={e => setNotes(n => ({ ...n, [c.logId]: e.target.value }))}
                  placeholder="Note to the employee (optional)"
                  aria-label={`Note for ${c.userName}`}
                  className="w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                />
                <div className="flex gap-2">
                  <button type="button" disabled={busy} onClick={() => review.mutate({ id: c.logId, status: 'Approved' })}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 rounded-xl text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 text-white transition disabled:opacity-50">
                    <Check className="w-4 h-4" /> Approve
                  </button>
                  <button type="button" disabled={busy} onClick={() => review.mutate({ id: c.logId, status: 'Rejected' })}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 rounded-xl text-sm font-semibold border border-rose-300 dark:border-rose-500/40 text-rose-700 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition disabled:opacity-50">
                    <X className="w-4 h-4" /> Reject
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
};
