// ─────────────────────────────────────────────────────────────────────────────
//  FILE: ui/src/components/AutoCheckoutNotice.tsx
//  Dashboard card shown after a forgotten check-out: the app closed the day at
//  the last activity (or after a normal day). One click to confirm, or send the
//  real finish time to the manager / team lead for approval.
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Clock3, Check, Send } from 'lucide-react';
import { dailyLogApi } from '../services/api';
import { useToast } from '../context/ToastContext';
import { apiErrorMessage } from '../utils/apiError';
import { DateTimePicker } from './DateTimePicker';
import { utcDate } from '../utils/date';

interface AutoCheckout {
  logId: number;
  logDate: string;
  checkInTime: string;
  checkOutTime: string;
  basis: 'LastActivity' | 'NormalDay';
  workMinutes: number;
}

const time = (iso: string) => utcDate(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' });
const day = (iso: string) => new Date(iso).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' });
const hours = (m: number) => `${Math.floor(m / 60)}h ${m % 60}m`;
/** 'YYYY-MM-DDTHH:mm' in this browser's time, as the picker expects */
const pickerValue = (iso: string) => {
  const d = utcDate(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};

export const AutoCheckoutNotice = () => {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [correcting, setCorrecting] = useState(false);
  const [finishedAt, setFinishedAt] = useState('');
  const [reason, setReason] = useState('');

  const { data } = useQuery<AutoCheckout | null>({
    queryKey: ['autoCheckout'],
    queryFn: () => dailyLogApi.getAutoCheckout().then(r => (r.status === 204 ? null : r.data)),
    staleTime: 5 * 60_000,
  });

  const done = () => {
    qc.setQueryData(['autoCheckout'], null);
    ['todayLog', 'history', 'dashboard'].forEach(k => qc.invalidateQueries({ queryKey: [k] }));
  };

  const confirm = useMutation({
    mutationFn: (id: number) => dailyLogApi.confirmAutoCheckout(id),
    onSuccess: () => { toast.success('Thanks — your hours stay as they are.'); done(); },
    onError: (e: unknown) => toast.error(apiErrorMessage(e, 'Could not save your answer')),
  });

  const correct = useMutation({
    mutationFn: (id: number) => dailyLogApi.requestCheckoutCorrection(id, {
      checkOutTime: new Date(finishedAt).toISOString(),
      reason: reason.trim(),
    }),
    onSuccess: () => { toast.success('Sent to your manager for approval.'); done(); },
    onError: (e: unknown) => toast.error(apiErrorMessage(e, 'Could not send the correction')),
  });

  if (!data) return null;

  return (
    <section role="region" aria-label="Forgotten check-out"
      className="rounded-2xl border border-amber-300/70 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 p-4 sm:p-5 space-y-3">
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-xl bg-amber-500/15 text-amber-700 dark:text-amber-400 shrink-0">
          <Clock3 className="w-5 h-5" />
        </div>
        <div className="min-w-0">
          <p className="font-semibold text-slate-900 dark:text-white">You didn't check out on {day(data.logDate)}</p>
          <p className="text-sm text-slate-700 dark:text-slate-300 mt-0.5">
            We closed your day at <strong>{time(data.checkOutTime)}</strong>{' '}
            {data.basis === 'LastActivity' ? '(your last activity in the app)' : '(a normal working day after check-in)'}
            {' '}— {hours(data.workMinutes)} of work from {time(data.checkInTime)}. Is that right?
          </p>
        </div>
      </div>

      {!correcting ? (
        <div className="flex flex-wrap gap-2 sm:pl-12">
          <button type="button" disabled={confirm.isPending} onClick={() => confirm.mutate(data.logId)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 text-white transition disabled:opacity-50">
            <Check className="w-4 h-4" /> That's right
          </button>
          <button type="button" onClick={() => { setCorrecting(true); setFinishedAt(pickerValue(data.checkOutTime)); }}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold border border-amber-400/70 dark:border-amber-500/40 text-amber-800 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-500/10 transition">
            I finished at a different time
          </button>
        </div>
      ) : (
        <div className="grid gap-2 sm:grid-cols-[14rem_1fr_auto] sm:pl-12 items-start">
          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">I finished at</label>
            <DateTimePicker value={finishedAt} onChange={setFinishedAt} />
          </div>
          <div>
            <label htmlFor="correction-reason" className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Why (for your manager)</label>
            <input id="correction-reason" value={reason} onChange={e => setReason(e.target.value)} maxLength={300}
              placeholder="e.g. stayed late for the release"
              className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
          </div>
          <div className="flex gap-2 sm:pt-5">
            <button type="button" disabled={!finishedAt || !reason.trim() || correct.isPending}
              onClick={() => correct.mutate(data.logId)}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white transition disabled:opacity-50">
              <Send className="w-4 h-4" /> Send to manager
            </button>
            <button type="button" onClick={() => setCorrecting(false)}
              className="px-3 py-2.5 rounded-xl text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition">
              Cancel
            </button>
          </div>
        </div>
      )}
    </section>
  );
};
