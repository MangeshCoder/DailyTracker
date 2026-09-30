// ─────────────────────────────────────────────────────────────────────────────
//  FILE: ui/src/pages/ExpensesPage.tsx
//  Expense claims: send a bill (travel, food, internet …) with the amount; once
//  your manager / team lead approves it, it's paid with that month's salary.
//  Managers and team leads also see their team's claims for the year.
// ─────────────────────────────────────────────────────────────────────────────
import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Paperclip, Plus, Send, Trash2, X } from 'lucide-react';
import { expenseApi } from '../services/api';
import { useAuth } from '../context/Authcontext';
import { useToast } from '../context/ToastContext';
import { useConfirm } from '../hooks/useConfirm';
import { apiErrorMessage } from '../utils/apiError';
import { localDate } from '../utils/date';
import { PageHeader } from '../components/ui/PageHeader';
import { Select } from '../components/ui/Select';
import { DatePicker } from '../components/DatePicker';
import { ExcelButton } from '../components/ExcelButton';
import { CATEGORY_ICON, billDate, rupees, useOpenReceipt, type ExpenseClaim } from '../components/ExpensePanels';

const CATEGORIES = ['Travel', 'Food', 'Internet', 'Office', 'Other'] as const;
const FIELD = 'w-full bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white text-sm rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500';
const LABEL = 'block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5';

const STATUS_STYLE: Record<ExpenseClaim['status'], string> = {
  Pending: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/25',
  Approved: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/25',
  Rejected: 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/25',
};
const STATUS_LABEL: Record<ExpenseClaim['status'], string> = { Pending: 'Waiting', Approved: 'Approved', Rejected: 'Declined' };

const blank = () => ({ expenseDate: localDate(), category: 'Travel', amount: '', description: '' });

const ClaimRow = ({ c, showName, onCancel }: { c: ExpenseClaim; showName?: boolean; onCancel?: () => void }) => {
  const openReceipt = useOpenReceipt();
  return (
    <li className="py-3 flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-slate-900 dark:text-white">
          {CATEGORY_ICON[c.category] ?? '🧾'} {showName ? `${c.userName} · ` : ''}{c.description}
        </p>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          {c.category} · bill of {billDate(c.expenseDate)}
          {c.status === 'Approved' && c.paidWith && <> · paid with {c.paidWith} salary</>}
          {c.status === 'Rejected' && c.reviewNote && <> · “{c.reviewNote}”</>}
        </p>
        <button type="button" onClick={() => openReceipt(c)}
          className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline">
          <Paperclip className="w-3 h-3" /> View bill
        </button>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-sm font-bold text-slate-900 dark:text-white tabular-nums">{rupees(c.amount)}</span>
        <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${STATUS_STYLE[c.status]}`}>{STATUS_LABEL[c.status]}</span>
        {onCancel && (
          <button type="button" onClick={onCancel} aria-label={`Withdraw ${c.description}`}
            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10">
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>
    </li>
  );
};

export const ExpensesPage = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { confirm } = useConfirm();
  const qc = useQueryClient();
  const isLead = user?.role === 'Manager' || user?.role === 'TeamLead';
  const year = new Date().getFullYear();

  const [tab, setTab] = useState<'mine' | 'team'>('mine');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(blank);
  const [file, setFile] = useState<File | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const { data: mine = [], isLoading } = useQuery<ExpenseClaim[]>({
    queryKey: ['myExpenses'], queryFn: () => expenseApi.getMine().then(r => r.data),
  });
  const { data: team = [] } = useQuery<ExpenseClaim[]>({
    queryKey: ['teamExpenses', year], queryFn: () => expenseApi.getTeam(year).then(r => r.data), enabled: isLead && tab === 'team',
  });

  const submit = useMutation({
    mutationFn: () => {
      const fd = new FormData();
      fd.append('expenseDate', form.expenseDate);
      fd.append('category', form.category);
      fd.append('amount', form.amount);
      fd.append('description', form.description.trim());
      if (file) fd.append('receipt', file);
      return expenseApi.submit(fd);
    },
    onSuccess: () => {
      toast.success('Claim sent to your manager');
      setForm(blank()); setFile(null); setShowForm(false);
      if (fileInput.current) fileInput.current.value = '';
    },
    onError: (e: unknown) => toast.error(apiErrorMessage(e, 'Could not send the claim')),
    onSettled: () => qc.invalidateQueries({ queryKey: ['myExpenses'] }),
  });

  const cancel = useMutation({
    mutationFn: (id: number) => expenseApi.cancel(id),
    onSuccess: () => toast.success('Claim withdrawn'),
    onError: (e: unknown) => toast.error(apiErrorMessage(e, 'Could not withdraw the claim')),
    onSettled: () => qc.invalidateQueries({ queryKey: ['myExpenses'] }),
  });

  const amount = Number(form.amount);
  const tooBig = file ? file.size > 5 * 1024 * 1024 : false;
  const ready = form.expenseDate && amount > 0 && form.description.trim() && file && !tooBig;
  const waiting = mine.filter(c => c.status === 'Pending').reduce((s, c) => s + c.amount, 0);
  const approvedThisYear = mine.filter(c => c.status === 'Approved' && c.expenseDate.startsWith(String(year))).reduce((s, c) => s + c.amount, 0);

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
      <PageHeader
        title="Expenses"
        description="Claim money you spent for work. Approved claims are paid with that month's salary."
        breadcrumbs={[{ label: 'Workspace', href: '/' }, { label: 'HR & Requests' }, { label: 'Expenses' }]}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <ExcelButton fetch={() => expenseApi.export(year)} fileName={`${isLead ? 'Team' : 'My'}_Expenses_${year}.xlsx`} />
            <button type="button" onClick={() => setShowForm(s => !s)}
              className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition ${showForm
                ? 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                : 'bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-500/20'}`}>
              {showForm ? <><X className="w-4 h-4" /> Cancel</> : <><Plus className="w-4 h-4" /> New claim</>}
            </button>
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 p-4">
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Waiting for approval</p>
          <p className="text-xl font-bold text-amber-600 dark:text-amber-400 tabular-nums">{rupees(waiting)}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 p-4">
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Approved in {year}</p>
          <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">{rupees(approvedThisYear)}</p>
        </div>
      </div>

      {showForm && (
        <form aria-label="New expense claim" onSubmit={e => { e.preventDefault(); if (ready) submit.mutate(); }}
          className="rounded-2xl border border-blue-500/30 bg-white dark:bg-slate-900/90 p-4 sm:p-5 space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className={LABEL}>Bill date</label>
              <DatePicker value={form.expenseDate} onChange={v => setForm(f => ({ ...f, expenseDate: v }))} max={localDate()} />
            </div>
            <div>
              <label className={LABEL} id="expense-category">Category</label>
              <Select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} className={FIELD} aria-label="Category">
                {CATEGORIES.map(c => <option key={c} value={c}>{CATEGORY_ICON[c]} {c}</option>)}
              </Select>
            </div>
            <div>
              <label className={LABEL} htmlFor="expense-amount">Amount (₹)</label>
              <input id="expense-amount" type="number" inputMode="decimal" min="1" step="0.01" max="100000"
                value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} placeholder="0.00" className={FIELD} />
            </div>
          </div>
          <div>
            <label className={LABEL} htmlFor="expense-description">What was it for?</label>
            <input id="expense-description" value={form.description} maxLength={500}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="e.g. Cab to client office" className={FIELD} />
          </div>
          <div>
            <label className={LABEL} htmlFor="expense-bill">Bill (PDF or photo, up to 5 MB)</label>
            <input id="expense-bill" ref={fileInput} type="file" accept="application/pdf,image/jpeg,image/png,image/webp"
              onChange={e => setFile(e.target.files?.[0] ?? null)}
              className="block w-full text-sm text-slate-700 dark:text-slate-300 file:mr-3 file:px-3 file:py-2 file:rounded-xl file:border-0 file:bg-blue-50 dark:file:bg-blue-500/10 file:text-blue-700 dark:file:text-blue-300 file:font-semibold" />
            {tooBig && <p className="text-xs text-rose-600 mt-1">That file is bigger than 5 MB.</p>}
          </div>
          <div className="flex justify-end">
            <button type="submit" disabled={!ready || submit.isPending}
              className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-5 py-2.5 rounded-xl text-sm font-semibold">
              <Send className="w-4 h-4" /> {submit.isPending ? 'Sending…' : 'Send claim'}
            </button>
          </div>
        </form>
      )}

      {isLead && (
        <div className="flex gap-2 bg-slate-100 dark:bg-slate-900/90 p-1.5 rounded-2xl border border-slate-200/80 dark:border-slate-800 w-fit">
          {(['mine', 'team'] as const).map(t => (
            <button key={t} type="button" onClick={() => setTab(t)}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition ${tab === t
                ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}>
              {t === 'mine' ? 'My claims' : `Team ${year}`}
            </button>
          ))}
        </div>
      )}

      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 px-4 sm:px-5">
        {tab === 'mine' ? (
          isLoading ? <div className="h-24 my-4 rounded-xl bg-slate-100 dark:bg-slate-800/60 animate-pulse" />
          : mine.length === 0 ? <p className="py-10 text-center text-sm text-slate-500 dark:text-slate-400">No claims yet. Use “New claim” to send a bill.</p>
          : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {mine.map(c => (
                <ClaimRow key={c.id} c={c}
                  onCancel={c.status === 'Pending' ? async () => {
                    if (await confirm(`Withdraw the claim of ${rupees(c.amount)}?`, { title: 'Withdraw claim?', confirmText: 'Withdraw' })) cancel.mutate(c.id);
                  } : undefined} />
              ))}
            </ul>
          )
        ) : team.length === 0 ? (
          <p className="py-10 text-center text-sm text-slate-500 dark:text-slate-400">No claims from your team this year.</p>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {team.map(c => <ClaimRow key={c.id} c={c} showName />)}
          </ul>
        )}
      </section>
    </div>
  );
};

export default ExpensesPage;
