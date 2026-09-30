// ─────────────────────────────────────────────────────────────────────────────
//  FILE: ui/src/components/DelegationPanel.tsx
//  Approval delegation on Employee Requests:
//   • "You're deciding for Tina until Fri 10 Oct" — when someone handed over to you
//   • "Going on leave? Hand over your approvals" — choose a colleague and dates
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowRightLeft, Handshake, X } from 'lucide-react';
import { delegationApi, profileApi } from '../services/api';
import { useAuth } from '../context/Authcontext';
import { useToast } from '../context/ToastContext';
import { apiErrorMessage } from '../utils/apiError';
import { localDate } from '../utils/date';
import { Select } from './ui/Select';
import { DatePicker } from './DatePicker';

export interface Delegation {
  id: number;
  fromUserId: number;
  fromName: string;
  fromRole: string;
  toUserId: number;
  toName: string;
  startDate: string;
  endDate: string;
  note?: string | null;
  state: 'Upcoming' | 'Active' | 'Ended';
}
interface MyDelegations { outgoing: Delegation[]; actingFor: Delegation[]; upcoming: Delegation[] }
interface Person { id: number; fullName: string; role: string }

const day = (d: string) => new Date(d).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
const KEY = ['myDelegations'];

/** Hand-overs for the signed-in manager / team lead (shared: the page uses actingFor to show leave) */
export const useMyDelegations = (enabled = true) =>
  useQuery<MyDelegations>({ queryKey: KEY, queryFn: () => delegationApi.getMine().then(r => r.data), enabled });

export const DelegationPanel = () => {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ toUserId: '', startDate: localDate(), endDate: localDate(), note: '' });

  const { data } = useMyDelegations();
  const { data: people = [] } = useQuery<Person[]>({
    queryKey: ['directory'], queryFn: () => profileApi.getDirectory().then(r => r.data), enabled: open,
  });
  const colleagues = people.filter(p => p.id !== user?.id && (p.role === 'Manager' || p.role === 'TeamLead'));
  const refresh = () => ['myDelegations', 'pendingLeave', 'pendingExpenses', 'pendingCompOff', 'pendingCorrections', 'pendingRequests']
    .forEach(k => qc.invalidateQueries({ queryKey: [k] }));

  const create = useMutation({
    mutationFn: () => delegationApi.create({ toUserId: +form.toUserId, startDate: form.startDate, endDate: form.endDate, note: form.note.trim() || undefined }),
    onSuccess: () => { toast.success('Approvals handed over — they were told'); setOpen(false); },
    onError: (e: unknown) => toast.error(apiErrorMessage(e, 'Could not hand over')),
    onSettled: refresh,
  });
  const cancel = useMutation({
    mutationFn: (id: number) => delegationApi.cancel(id),
    onSuccess: () => toast.success('Your approvals are back with you'),
    onError: (e: unknown) => toast.error(apiErrorMessage(e, 'Could not take them back')),
    onSettled: refresh,
  });

  if (!data?.outgoing) return null;
  return (
    <div className="space-y-3">
      {data.actingFor.map(d => (
        <p key={d.id} role="status" className="flex items-center gap-2 text-sm rounded-2xl px-4 py-3 border border-violet-500/25 bg-violet-500/10 text-violet-800 dark:text-violet-200">
          <ArrowRightLeft className="w-4 h-4 shrink-0" />
          <span>You're deciding for <strong>{d.fromName}</strong> until {day(d.endDate)} — their team's requests are in the lists below.</span>
        </p>
      ))}
      {data.upcoming.map(d => (
        <p key={d.id} className="text-xs text-slate-500 dark:text-slate-400 px-1">
          From {day(d.startDate)} to {day(d.endDate)} you'll decide for {d.fromName}.
        </p>
      ))}

      <section aria-labelledby="handover-title"
        className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 id="handover-title" className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Handshake className="w-4 h-4 text-violet-500" /> Going on leave? Hand over your approvals
          </h3>
          {!open && (
            <button type="button" onClick={() => setOpen(true)}
              className="text-xs font-semibold px-3 py-1.5 rounded-xl border border-violet-500/30 text-violet-700 dark:text-violet-300 hover:bg-violet-500/10">
              Hand over
            </button>
          )}
        </div>

        {data.outgoing.map(d => (
          <div key={d.id} data-testid={`handover-${d.id}`} className="flex flex-wrap items-center justify-between gap-2 text-sm rounded-xl bg-slate-50 dark:bg-slate-800/50 px-3 py-2">
            <span className="text-slate-700 dark:text-slate-300">
              <strong>{d.toName}</strong> decides for you {day(d.startDate)} – {day(d.endDate)}
              {d.state === 'Active' ? <span className="ml-1.5 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">· now</span> : null}
            </span>
            <button type="button" disabled={cancel.isPending} onClick={() => cancel.mutate(d.id)}
              className="inline-flex items-center gap-1 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:underline disabled:opacity-50">
              <X className="w-3.5 h-3.5" /> Take back
            </button>
          </div>
        ))}

        {open && (
          <form aria-label="Hand over approvals" onSubmit={e => { e.preventDefault(); if (form.toUserId) create.mutate(); }}
            className="grid gap-3 sm:grid-cols-[1fr_auto_auto] items-end">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">Who decides</label>
              <Select value={form.toUserId} onChange={e => setForm(f => ({ ...f, toUserId: e.target.value }))} aria-label="Who decides while you're away"
                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-white">
                <option value="">Choose a manager or team lead</option>
                {colleagues.map(p => <option key={p.id} value={p.id}>{p.fullName} ({p.role === 'TeamLead' ? 'Team lead' : 'Manager'})</option>)}
              </Select>
            </div>
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">From</label>
              <DatePicker value={form.startDate} min={localDate()} onChange={v => setForm(f => ({ ...f, startDate: v, endDate: f.endDate < v ? v : f.endDate }))} />
            </div>
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">To</label>
              <DatePicker value={form.endDate} min={form.startDate} onChange={v => setForm(f => ({ ...f, endDate: v }))} />
            </div>
            <div className="sm:col-span-3 flex flex-wrap gap-2 justify-end">
              <button type="button" onClick={() => setOpen(false)} className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800">Cancel</button>
              <button type="submit" disabled={!form.toUserId || create.isPending}
                className="px-4 py-2 rounded-xl text-sm font-semibold bg-violet-600 hover:bg-violet-500 text-white disabled:opacity-50">
                Hand over
              </button>
            </div>
          </form>
        )}
        <p className="text-[11px] text-slate-500 dark:text-slate-400">
          They'll decide your team's leave, WFH, comp-off, expenses and check-out corrections for those days, and get the notifications.
        </p>
      </section>
    </div>
  );
};
