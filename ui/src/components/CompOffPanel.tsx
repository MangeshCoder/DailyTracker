// ─────────────────────────────────────────────────────────────────────────────
//  FILE: ui/src/components/CompOffPanel.tsx
//  Comp-off: a day off earned by working on a weekend or a public holiday.
//   • MyCompOffPanel — on the Leave page: days available, waiting, when they run out
//   • PendingCompOffPanel — on Employee Requests: the manager approves or declines
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Palmtree, X } from 'lucide-react';
import { compOffApi } from '../services/api';
import { useToast } from '../context/ToastContext';
import { apiErrorMessage } from '../utils/apiError';

export interface CompOffCredit {
  id: number;
  userId: number;
  userName: string;
  workDate: string;
  occasion: string;
  workMinutes: number;
  state: 'Pending' | 'Available' | 'Used' | 'Expired' | 'Rejected';
  expiresOn: string;
  usedOn?: string | null;
  reviewerName?: string | null;
  reviewNote?: string | null;
  isOwn: boolean;
}

interface MyCompOff {
  available: number;
  pending: number;
  used: number;
  expired: number;
  nextExpiry?: string | null;
  minHours: number;
  validDays: number;
  credits: CompOffCredit[];
}

const day = (d: string) => new Date(d).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
const date = (d: string) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
const hours = (m: number) => `${Math.floor(m / 60)}h ${m % 60}m`;

const STATE_STYLE: Record<CompOffCredit['state'], string> = {
  Available: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/25',
  Pending: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/25',
  Used: 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/25',
  Expired: 'bg-slate-500/10 text-slate-500 dark:text-slate-500 border-slate-500/20',
  Rejected: 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/25',
};
const STATE_LABEL: Record<CompOffCredit['state'], string> = {
  Available: 'Available', Pending: 'Waiting for approval', Used: 'Used', Expired: 'Expired', Rejected: 'Declined',
};

export const useMyCompOff = () =>
  useQuery<MyCompOff>({ queryKey: ['myCompOff'], queryFn: () => compOffApi.getMine().then(r => r.data) });

/** The employee's own comp-off on the Leave page */
export const MyCompOffPanel = () => {
  const { data, isLoading } = useMyCompOff();
  if (isLoading || !data?.credits) return null;

  return (
    <section aria-labelledby="compoff-title"
      className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 p-4 sm:p-5 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 id="compoff-title" className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Palmtree className="w-4 h-4 text-purple-500" /> Comp-off
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Work {data.minHours}+ hours on a weekend or holiday to earn a day off. Use it within {data.validDays} days — apply for a “CompOff” leave.
          </p>
        </div>
        <dl className="flex gap-2 text-center">
          <div className="rounded-xl bg-emerald-500/10 px-3 py-1.5">
            <dt className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-400">Available</dt>
            <dd data-testid="compoff-available" className="text-lg font-bold text-emerald-700 dark:text-emerald-300">{data.available}</dd>
          </div>
          <div className="rounded-xl bg-amber-500/10 px-3 py-1.5">
            <dt className="text-[10px] font-semibold text-amber-700 dark:text-amber-400">Waiting</dt>
            <dd className="text-lg font-bold text-amber-700 dark:text-amber-300">{data.pending}</dd>
          </div>
        </dl>
      </div>

      {data.nextExpiry && (
        <p className="text-xs font-medium text-amber-700 dark:text-amber-300 bg-amber-500/10 rounded-xl px-3 py-2">
          ⏳ Your next comp-off day runs out on {date(data.nextExpiry)}.
        </p>
      )}

      {data.credits.length === 0 ? (
        <p className="text-xs text-slate-500 dark:text-slate-400">No comp-off yet.</p>
      ) : (
        <ul className="divide-y divide-slate-100 dark:divide-slate-800">
          {data.credits.slice(0, 8).map(c => (
            <li key={c.id} className="py-2.5 flex flex-wrap items-center justify-between gap-2 text-sm">
              <div className="min-w-0">
                <p className="font-semibold text-slate-900 dark:text-white">
                  {day(c.workDate)} <span className="font-normal text-slate-500 dark:text-slate-400">· {c.occasion} · {hours(c.workMinutes)}</span>
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {c.state === 'Available' && `Use by ${date(c.expiresOn)}`}
                  {c.state === 'Used' && c.usedOn && `Taken on ${date(c.usedOn)}`}
                  {c.state === 'Expired' && `Ran out on ${date(c.expiresOn)}`}
                  {c.state === 'Pending' && 'Your manager will approve it'}
                  {c.state === 'Rejected' && (c.reviewNote ? `“${c.reviewNote}”` : `Declined by ${c.reviewerName ?? 'your manager'}`)}
                </p>
              </div>
              <span className={`shrink-0 text-[11px] font-bold px-2 py-0.5 rounded-full border ${STATE_STYLE[c.state]}`}>
                {STATE_LABEL[c.state]}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};

/** Comp-off waiting for this manager / team lead (shared with the page's counter) */
export const usePendingCompOff = (enabled = true) =>
  useQuery<CompOffCredit[]>({
    queryKey: ['pendingCompOff'],
    queryFn: () => compOffApi.getPending().then(r => r.data),
    refetchInterval: 30000,
    enabled,
  });

export const PendingCompOffPanel = () => {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [notes, setNotes] = useState<Record<number, string>>({});
  const { data: pending = [], isLoading } = usePendingCompOff();

  const review = useMutation({
    mutationFn: ({ id, status }: { id: number; status: 'Approved' | 'Rejected' }) =>
      compOffApi.review(id, { status, note: notes[id] || undefined }),
    onSuccess: (_, v) => toast.success(v.status === 'Approved' ? 'Comp-off approved' : 'Comp-off declined'),
    onError: (e: unknown) => toast.error(apiErrorMessage(e, 'Could not save the decision')),
    onSettled: () => ['pendingCompOff', 'leaveBalance'].forEach(k => qc.invalidateQueries({ queryKey: [k] })),
  });

  return (
    <section aria-labelledby="pending-compoff-title" className="space-y-3">
      <div className="flex items-center gap-2">
        <Palmtree className="w-4 h-4 text-purple-500" />
        <h3 id="pending-compoff-title" className="text-sm font-bold text-slate-900 dark:text-white">Comp-off earned</h3>
        <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-700 dark:text-purple-400">
          {pending.length} pending
        </span>
      </div>

      {isLoading ? (
        <div className="h-24 rounded-2xl bg-slate-100 dark:bg-slate-800/60 animate-pulse" />
      ) : pending.length === 0 ? (
        <p className="text-sm text-slate-500 dark:text-slate-400 px-4 py-6 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 text-center">
          No comp-off waiting.
        </p>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {pending.map(c => {
            const busy = review.isPending && review.variables?.id === c.id;
            return (
              <article key={c.id} data-testid={`compoff-${c.id}`}
                className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-900 dark:text-white truncate">{c.userName}{c.isOwn && ' (you)'}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Worked {day(c.workDate)} · {c.occasion} · {hours(c.workMinutes)}
                    </p>
                  </div>
                  <span className="shrink-0 text-[11px] font-bold px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-700 dark:text-purple-400 border border-purple-500/20">
                    1 day
                  </span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400">If approved, it can be used until {date(c.expiresOn)}.</p>
                <input
                  value={notes[c.id] ?? ''}
                  onChange={e => setNotes(n => ({ ...n, [c.id]: e.target.value }))}
                  placeholder="Note to the employee (optional)"
                  aria-label={`Note for ${c.userName}`}
                  className="w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                />
                <div className="flex gap-2">
                  <button type="button" disabled={busy} onClick={() => review.mutate({ id: c.id, status: 'Approved' })}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 rounded-xl text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 text-white transition disabled:opacity-50">
                    <Check className="w-4 h-4" /> Approve
                  </button>
                  <button type="button" disabled={busy} onClick={() => review.mutate({ id: c.id, status: 'Rejected' })}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 rounded-xl text-sm font-semibold border border-rose-300 dark:border-rose-500/40 text-rose-700 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition disabled:opacity-50">
                    <X className="w-4 h-4" /> Decline
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
