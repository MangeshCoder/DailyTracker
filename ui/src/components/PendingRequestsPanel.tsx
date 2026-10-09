// ─────────────────────────────────────────────────────────────────────────────
//  FILE: ui/src/components/PendingRequestsPanel.tsx
//  Employee Requests → Pending Queue: WFH and half-day requests.
//  Same card as the other requests (leave, missed check-in, expenses …):
//  a note, then Approve or Decline — one click, no drawer or pop-up.
//  Declining needs a note so the person knows why.
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Home, X } from 'lucide-react';
import { wfhApi } from '../services/api';
import type { WFHRequest } from '../types';
import { useToast } from '../context/ToastContext';
import { apiErrorMessage } from '../utils/apiError';

const FIELD = 'w-full bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30';

const day = (iso: string) =>
  new Date(iso).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });

/** "Today", "Tomorrow", "In 3 days" … for the next week; nothing otherwise */
function whenLabel(iso: string) {
  const target = new Date(iso); target.setHours(0, 0, 0, 0);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const days = Math.round((target.getTime() - today.getTime()) / 86_400_000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  if (days > 1 && days <= 7) return `In ${days} days`;
  if (days < 0) return `${-days} day${days === -1 ? '' : 's'} ago`;
  return '';
}

const kind = (r: WFHRequest) =>
  r.requestType === 'WFH' ? 'Work from home' : `Half day${r.halfDaySlot ? ` (${r.halfDaySlot.toLowerCase()})` : ''}`;

export const PendingRequestsPanel = () => {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [notes, setNotes] = useState<Record<number, string>>({});

  const { data: pending = [], isLoading } = useQuery<WFHRequest[]>({
    queryKey: ['pendingWFH'],
    queryFn: () => wfhApi.getPending(),
    refetchInterval: 30000,
  });

  const review = useMutation({
    mutationFn: ({ id, approve }: { id: number; approve: boolean }) => {
      const note = notes[id]?.trim() || undefined;
      return approve ? wfhApi.approve(id, note) : wfhApi.reject(id, note);
    },
    onSuccess: (_, v) => {
      qc.setQueryData<WFHRequest[]>(['pendingWFH'], old => (old ?? []).filter(r => r.id !== v.id));
      setNotes(n => { const next = { ...n }; delete next[v.id]; return next; });
      toast.success(v.approve ? 'Request approved' : 'Request declined');
    },
    onError: (e: unknown) => toast.error(apiErrorMessage(e, 'Could not save the decision')),
    // every manager view that shows WFH (today's status, monthly matrix, history)
    onSettled: () => ['pendingWFH', 'teamStatus', 'teamMonthly', 'team-monthly', 'allWFH']
      .forEach(k => qc.invalidateQueries({ queryKey: [k] })),
  });

  return (
    <section aria-labelledby="wfh-title" className="space-y-3">
      <div className="flex items-center gap-2">
        <Home className="w-4 h-4 text-blue-500" />
        <h3 id="wfh-title" className="text-sm font-bold text-slate-900 dark:text-white">WFH &amp; half-day requests</h3>
        <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-700 dark:text-blue-400">
          {pending.length} pending
        </span>
      </div>

      {isLoading ? (
        <div className="h-24 rounded-2xl bg-slate-100 dark:bg-slate-800/60 animate-pulse" />
      ) : pending.length === 0 ? (
        <p className="text-sm text-slate-500 dark:text-slate-400 px-4 py-6 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 text-center">
          No WFH or half-day requests waiting.
        </p>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {pending.map(r => {
            const busy = review.isPending && review.variables?.id === r.id;
            const note = notes[r.id] ?? '';
            const when = whenLabel(r.requestDate);
            return (
              <article key={r.id} data-testid={`wfh-${r.id}`}
                className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-900 dark:text-white truncate">{r.employeeName}{r.isOwn && ' (you)'}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{kind(r)} · {day(r.requestDate)}</p>
                  </div>
                  {when && (
                    <span className="shrink-0 text-[11px] font-bold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-500/20">
                      {when}
                    </span>
                  )}
                </div>
                {r.reason && (
                  <p className="text-sm text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/50 rounded-xl px-3 py-2 break-words">“{r.reason}”</p>
                )}
                <input
                  value={note}
                  onChange={e => setNotes(n => ({ ...n, [r.id]: e.target.value }))}
                  maxLength={300}
                  placeholder="Note (needed to decline)"
                  aria-label={`Note for ${r.employeeName}`}
                  className={FIELD}
                />
                <div className="flex gap-2">
                  <button type="button" disabled={busy} onClick={() => review.mutate({ id: r.id, approve: true })}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 rounded-xl text-sm font-semibold bg-emerald-700 hover:bg-emerald-800 text-white transition disabled:opacity-50">
                    <Check className="w-4 h-4" /> Approve
                  </button>
                  <button type="button" disabled={busy || !note.trim()} title={!note.trim() ? 'Write why in the note first' : undefined}
                    onClick={() => review.mutate({ id: r.id, approve: false })}
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
