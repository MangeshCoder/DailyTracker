// ─────────────────────────────────────────────────────────────────────────────
//  Missed check-in — "I worked that day but forgot to check in".
//    MissedCheckInCard            → My Report: ask for a day (tap a red day in the
//                                   calendar to pick it) + my requests
//    PendingMissedCheckInsPanel   → Employee Requests: approve (the day is added)
//                                   or decline with a reason
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Clock4, Home, Building2, Loader2, X, CalendarPlus } from 'lucide-react';
import { Card } from './ui/Card';
import { DatePicker } from './DatePicker';
import { missedCheckInApi, type MissedCheckIn } from '../services/api';
import { useToast } from '../context/ToastContext';
import { apiErrorMessage } from '../utils/apiError';
import { localDate, utcDate } from '../utils/date';

const time = (iso: string) => utcDate(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' });
const day = (iso: string) => new Date(iso).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
const span = (from: string, to: string) => {
  const m = Math.max(0, Math.round((utcDate(to).getTime() - utcDate(from).getTime()) / 60000));
  return `${Math.floor(m / 60)}h ${m % 60}m`;
};

const STATUS_CLS: Record<string, string> = {
  Pending:  'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20',
  Approved: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20',
  Rejected: 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20',
};
const FIELD = 'w-full bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30';
const LABEL = 'block text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1';

// ── Employee ─────────────────────────────────────────────────────────────────

export const MissedCheckInCard = ({ pickedDate, onSent }: { pickedDate?: string; onSent?: () => void }) => {
  const qc = useQueryClient();
  const { toast } = useToast();
  const today = new Date();
  const yesterday = localDate(new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1));
  const earliest = localDate(new Date(today.getFullYear(), today.getMonth(), today.getDate() - 30));

  const [date, setDate] = useState('');
  const [from, setFrom] = useState('09:30');
  const [to, setTo] = useState('18:30');
  const [mode, setMode] = useState<'Office' | 'WFH'>('Office');
  const [reason, setReason] = useState('');
  useEffect(() => { if (pickedDate) setDate(pickedDate); }, [pickedDate]);

  const { data: mine = [] } = useQuery({ queryKey: ['myMissedCheckIns'], queryFn: () => missedCheckInApi.mine().then(r => r.data) });

  const send = useMutation({
    mutationFn: () => missedCheckInApi.request({ date, checkIn: from, checkOut: to, workMode: mode, reason }),
    onSuccess: () => {
      toast.success('Sent to your team lead / manager for approval.');
      setDate(''); setReason('');
      qc.invalidateQueries({ queryKey: ['myMissedCheckIns'] });
      onSent?.();
    },
    onError: (e: unknown) => toast.error(apiErrorMessage(e, 'Could not send the request')),
  });
  const cancel = useMutation({
    mutationFn: (id: number) => missedCheckInApi.cancel(id),
    onSuccess: () => { toast.success('Request cancelled.'); qc.invalidateQueries({ queryKey: ['myMissedCheckIns'] }); },
    onError: (e: unknown) => toast.error(apiErrorMessage(e, 'Could not cancel')),
  });

  return (
    <Card className="p-4 sm:p-5 space-y-4" data-testid="missed-checkin-card">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
          <CalendarPlus className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-sm font-bold text-slate-900 dark:text-white">Forgot to check in?</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Ask to add a working day from the last 30 days. Tap a red (absent) day in the calendar to pick it.
            Once approved it counts like any other day.
          </p>
        </div>
      </div>

      <form className="space-y-3" onSubmit={e => { e.preventDefault(); send.mutate(); }}>
        <div>
          <label className={LABEL}>Day</label>
          <DatePicker value={date} onChange={setDate} min={earliest} max={yesterday} placeholder="Pick the day" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className={LABEL} htmlFor="mc-from">Checked in</label>
            <input id="mc-from" type="time" value={from} onChange={e => setFrom(e.target.value)} required className={FIELD} />
          </div>
          <div>
            <label className={LABEL} htmlFor="mc-to">Checked out</label>
            <input id="mc-to" type="time" value={to} onChange={e => setTo(e.target.value)} required className={FIELD} />
          </div>
        </div>
        <div role="radiogroup" aria-label="Where" className="grid grid-cols-2 gap-2">
          {([['Office', Building2], ['WFH', Home]] as const).map(([m, Icon]) => (
            <button key={m} type="button" role="radio" aria-checked={mode === m} onClick={() => setMode(m)}
              className={`inline-flex items-center justify-center gap-1.5 py-2 rounded-xl text-sm font-semibold border transition ${
                mode === m ? 'border-blue-500 bg-blue-500/10 text-blue-700 dark:text-blue-400'
                           : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>
              <Icon className="w-4 h-4" /> {m === 'Office' ? 'At the office' : 'Work from home'}
            </button>
          ))}
        </div>
        <div>
          <label className={LABEL} htmlFor="mc-reason">Why couldn’t you check in?</label>
          <input id="mc-reason" value={reason} onChange={e => setReason(e.target.value)} maxLength={300}
            placeholder="e.g. phone battery died" className={FIELD} />
        </div>
        <button type="submit" disabled={!date || reason.trim().length < 3 || send.isPending}
          className="w-full inline-flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold bg-blue-600 hover:bg-blue-500 text-white transition disabled:opacity-50">
          {send.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CalendarPlus className="w-4 h-4" />}
          Send for approval
        </button>
      </form>

      {mine.length > 0 && (
        <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2">
          <p className={LABEL}>Your requests</p>
          {mine.slice(0, 6).map(r => (
            <div key={r.id} className="flex items-start justify-between gap-2 text-sm">
              <div className="min-w-0">
                <p className="font-medium text-slate-900 dark:text-white">
                  {day(r.date)} · {time(r.checkIn)}–{time(r.checkOut)}{r.workMode === 'WFH' && ' · WFH'}
                </p>
                {r.reviewNote && <p className="text-xs text-slate-500 dark:text-slate-400 break-words">{r.reviewedBy}: “{r.reviewNote}”</p>}
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${STATUS_CLS[r.status] ?? ''}`}>{r.status}</span>
                {r.status === 'Pending' && (
                  <button type="button" onClick={() => cancel.mutate(r.id)} disabled={cancel.isPending}
                    className="text-xs font-semibold text-rose-600 dark:text-rose-400 hover:underline disabled:opacity-50">Cancel</button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
};

// ── Team lead / manager ─────────────────────────────────────────────────────

export const usePendingMissedCheckIns = (enabled = true) =>
  useQuery<MissedCheckIn[]>({
    queryKey: ['pendingMissedCheckIns'],
    queryFn: () => missedCheckInApi.pending().then(r => r.data),
    refetchInterval: 30000,
    enabled,
  });

export const PendingMissedCheckInsPanel = () => {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [notes, setNotes] = useState<Record<number, string>>({});
  const { data: pending = [], isLoading } = usePendingMissedCheckIns();

  const review = useMutation({
    mutationFn: ({ id, status }: { id: number; status: 'Approved' | 'Rejected' }) =>
      missedCheckInApi.review(id, { status, note: notes[id] || undefined }),
    onSuccess: (_, v) => toast.success(v.status === 'Approved' ? 'Day added to their attendance' : 'Request declined'),
    onError: (e: unknown) => toast.error(apiErrorMessage(e, 'Could not save the decision')),
    onSettled: () => ['pendingMissedCheckIns', 'teamStatus', 'teamMonthly'].forEach(k => qc.invalidateQueries({ queryKey: [k] })),
  });

  return (
    <section aria-labelledby="missed-title" className="space-y-3">
      <div className="flex items-center gap-2">
        <Clock4 className="w-4 h-4 text-blue-500" />
        <h3 id="missed-title" className="text-sm font-bold text-slate-900 dark:text-white">Missed check-ins</h3>
        <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-700 dark:text-blue-400">
          {pending.length} pending
        </span>
      </div>

      {isLoading ? (
        <div className="h-24 rounded-2xl bg-slate-100 dark:bg-slate-800/60 animate-pulse" />
      ) : pending.length === 0 ? (
        <p className="text-sm text-slate-500 dark:text-slate-400 px-4 py-6 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 text-center">
          No missed check-ins waiting.
        </p>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {pending.map(r => {
            const busy = review.isPending && review.variables?.id === r.id;
            return (
              <article key={r.id} data-testid={`missed-${r.id}`}
                className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-900 dark:text-white truncate">{r.userName}{r.isOwn && ' (you)'}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Forgot to check in · {day(r.date)}</p>
                  </div>
                  <span className="shrink-0 text-[11px] font-bold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-500/20">
                    {r.workMode === 'WFH' ? 'WFH' : 'Office'}
                  </span>
                </div>
                <dl className="grid grid-cols-3 gap-2 text-sm">
                  <div className="rounded-xl bg-slate-50 dark:bg-slate-800/50 px-3 py-2">
                    <dt className="text-[11px] text-slate-500 dark:text-slate-400">In</dt>
                    <dd className="font-semibold text-slate-900 dark:text-white">{time(r.checkIn)}</dd>
                  </div>
                  <div className="rounded-xl bg-slate-50 dark:bg-slate-800/50 px-3 py-2">
                    <dt className="text-[11px] text-slate-500 dark:text-slate-400">Out</dt>
                    <dd className="font-semibold text-slate-900 dark:text-white">{time(r.checkOut)}</dd>
                  </div>
                  <div className="rounded-xl bg-blue-50 dark:bg-blue-500/10 px-3 py-2">
                    <dt className="text-[11px] text-blue-700 dark:text-blue-300">Day</dt>
                    <dd className="font-semibold text-blue-800 dark:text-blue-200">{span(r.checkIn, r.checkOut)}</dd>
                  </div>
                </dl>
                <p className="text-sm text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/50 rounded-xl px-3 py-2 break-words">“{r.reason}”</p>
                <input
                  value={notes[r.id] ?? ''}
                  onChange={e => setNotes(n => ({ ...n, [r.id]: e.target.value }))}
                  placeholder="Note (needed to decline)"
                  aria-label={`Note for ${r.userName}`}
                  className={FIELD}
                />
                <div className="flex gap-2">
                  <button type="button" disabled={busy} onClick={() => review.mutate({ id: r.id, status: 'Approved' })}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 rounded-xl text-sm font-semibold bg-emerald-700 hover:bg-emerald-800 text-white transition disabled:opacity-50">
                    <Check className="w-4 h-4" /> Approve
                  </button>
                  <button type="button" disabled={busy} onClick={() => review.mutate({ id: r.id, status: 'Rejected' })}
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
