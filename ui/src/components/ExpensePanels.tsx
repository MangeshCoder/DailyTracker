// ─────────────────────────────────────────────────────────────────────────────
//  FILE: ui/src/components/ExpensePanels.tsx
//  Expense claims shared bits:
//   • openReceipt — shows the bill in a new tab (it's private, so it's fetched
//     with the sign-in and opened from memory)
//   • PendingExpensesPanel — on Employee Requests: approve, or decline with a reason
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Paperclip, Receipt, X } from 'lucide-react';
import { downloadBlob, expenseApi } from '../services/api';
import { useToast } from '../context/ToastContext';
import { apiErrorMessage } from '../utils/apiError';

export interface ExpenseClaim {
  id: number;
  userId: number;
  userName: string;
  expenseDate: string;
  category: string;
  amount: number;
  description: string;
  receiptFileName: string;
  status: 'Pending' | 'Approved' | 'Rejected';
  reviewerName?: string | null;
  reviewNote?: string | null;
  reviewedAt?: string | null;
  paidWith?: string | null;
  createdAt: string;
  isOwn: boolean;
}

export const rupees = (n: number) =>
  `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
export const billDate = (d: string) =>
  new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

export const CATEGORY_ICON: Record<string, string> = { Travel: '🚕', Food: '🍱', Internet: '📶', Office: '🖇️', Other: '🧾' };

/** Opens the bill in a new tab (falls back to saving it if pop-ups are blocked) */
export const useOpenReceipt = () => {
  const { toast } = useToast();
  return async (c: Pick<ExpenseClaim, 'id' | 'receiptFileName'>) => {
    const tab = window.open('', '_blank');
    try {
      const res = await expenseApi.receipt(c.id);
      const url = URL.createObjectURL(res.data);
      if (tab) { tab.location.href = url; setTimeout(() => URL.revokeObjectURL(url), 60_000); }
      else { URL.revokeObjectURL(url); downloadBlob(res.data, c.receiptFileName); }
    } catch (e) {
      tab?.close();
      toast.error(apiErrorMessage(e, 'Could not open the bill'));
    }
  };
};

export const usePendingExpenses = (enabled = true) =>
  useQuery<ExpenseClaim[]>({
    queryKey: ['pendingExpenses'],
    queryFn: () => expenseApi.getPending().then(r => r.data),
    refetchInterval: 30000,
    enabled,
  });

export const PendingExpensesPanel = () => {
  const qc = useQueryClient();
  const { toast } = useToast();
  const openReceipt = useOpenReceipt();
  const [notes, setNotes] = useState<Record<number, string>>({});
  const { data: pending = [], isLoading } = usePendingExpenses();

  const review = useMutation({
    mutationFn: ({ id, status }: { id: number; status: 'Approved' | 'Rejected' }) =>
      expenseApi.review(id, { status, note: notes[id]?.trim() || undefined }),
    onSuccess: (_, v) => toast.success(v.status === 'Approved' ? 'Claim approved — paid with this month\'s salary' : 'Claim declined'),
    onError: (e: unknown) => toast.error(apiErrorMessage(e, 'Could not save the decision')),
    onSettled: () => ['pendingExpenses', 'teamExpenses'].forEach(k => qc.invalidateQueries({ queryKey: [k] })),
  });

  return (
    <section aria-labelledby="pending-expenses-title" className="space-y-3">
      <div className="flex items-center gap-2">
        <Receipt className="w-4 h-4 text-teal-500" />
        <h3 id="pending-expenses-title" className="text-sm font-bold text-slate-900 dark:text-white">Expense claims</h3>
        <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-teal-500/10 text-teal-700 dark:text-teal-400">
          {pending.length} pending
        </span>
      </div>

      {isLoading ? (
        <div className="h-24 rounded-2xl bg-slate-100 dark:bg-slate-800/60 animate-pulse" />
      ) : pending.length === 0 ? (
        <p className="text-sm text-slate-500 dark:text-slate-400 px-4 py-6 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 text-center">
          No expense claims waiting.
        </p>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {pending.map(c => {
            const busy = review.isPending && review.variables?.id === c.id;
            const note = notes[c.id] ?? '';
            return (
              <article key={c.id} data-testid={`expense-${c.id}`}
                className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-900 dark:text-white truncate">{c.userName}{c.isOwn && ' (you)'}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {CATEGORY_ICON[c.category] ?? '🧾'} {c.category} · bill of {billDate(c.expenseDate)}
                    </p>
                  </div>
                  <span className="shrink-0 text-base font-bold text-slate-900 dark:text-white tabular-nums">{rupees(c.amount)}</span>
                </div>
                <p className="text-sm text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/50 rounded-xl px-3 py-2 break-words">{c.description}</p>
                <button type="button" onClick={() => openReceipt(c)}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline">
                  <Paperclip className="w-3.5 h-3.5" /> View bill ({c.receiptFileName})
                </button>
                <input
                  value={note}
                  onChange={e => setNotes(n => ({ ...n, [c.id]: e.target.value }))}
                  placeholder="Note (needed to decline)"
                  aria-label={`Note for ${c.userName}`}
                  className="w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                />
                <div className="flex gap-2">
                  <button type="button" disabled={busy} onClick={() => review.mutate({ id: c.id, status: 'Approved' })}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 rounded-xl text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 text-white transition disabled:opacity-50">
                    <Check className="w-4 h-4" /> Approve
                  </button>
                  <button type="button" disabled={busy || !note.trim()} title={!note.trim() ? 'Write why in the note first' : undefined}
                    onClick={() => review.mutate({ id: c.id, status: 'Rejected' })}
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
