// ─────────────────────────────────────────────────────────────────────────────
//  "Phone notifications" card (Notifications page): turn push on / off for this
//  device, send a test, and see which devices get pushes.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { BellRing, BellOff, Smartphone, Send, Loader2, Share, ShieldAlert } from 'lucide-react';
import { Card } from './ui/Card';
import { pushApi } from '../services/api';
import { useToast } from '../context/ToastContext';
import { apiErrorMessage } from '../utils/apiError';
import { getPushState, enablePush, disablePush, type PushState } from '../utils/push';
import { utcDate } from '../utils/date';

const HELP: Record<Exclude<PushState, 'on' | 'off'>, { icon: typeof BellRing; text: string }> = {
  'needs-install': { icon: Share, text: 'On iPhone and iPad, notifications work from the Home Screen app: tap Share → "Add to Home Screen", open DailyTracker from there, then turn this on.' },
  blocked: { icon: ShieldAlert, text: 'Notifications are blocked for this site. Allow them in the browser’s site settings (the lock icon next to the address), then come back.' },
  unsupported: { icon: BellOff, text: 'This browser can’t receive push notifications. Try Chrome, Edge, Firefox or Samsung Internet.' },
};

export const PushSettingsCard = () => {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [state, setState] = useState<PushState | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { getPushState().then(setState).catch(() => setState('unsupported')); }, []);
  const { data: devices = [] } = useQuery({ queryKey: ['pushDevices'], queryFn: () => pushApi.devices().then(r => r.data) });

  const run = async (fn: () => Promise<PushState>, done: (s: PushState) => string | null) => {
    setBusy(true);
    try {
      const s = await fn();
      setState(s);
      const msg = done(s);
      if (msg) toast.success(msg);
      qc.invalidateQueries({ queryKey: ['pushDevices'] });
    } catch (e) {
      // a browser refusal (no push service, private window …) is not a server problem
      toast.error(e instanceof DOMException
        ? `This browser couldn’t set up notifications (${e.message}). Try again, or use Chrome / Edge / Firefox outside a private window.`
        : apiErrorMessage(e, 'Couldn’t change phone notifications.'));
    } finally { setBusy(false); }
  };

  const sendTest = async () => {
    setBusy(true);
    try { toast.success((await pushApi.test()).data.message); }
    catch (e) { toast.error(apiErrorMessage(e, 'Couldn’t send the test.')); }
    finally { setBusy(false); }
  };

  const on = state === 'on';
  const help = state && state !== 'on' && state !== 'off' ? HELP[state] : null;

  return (
    <Card className="p-4 sm:p-5" data-testid="push-card">
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 border ${
            on ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
               : 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20'}`}>
            {on ? <BellRing className="w-5 h-5" /> : <Smartphone className="w-5 h-5" />}
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">Phone notifications</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {on
                ? 'On for this device — approvals, reminders and chat messages arrive even when DailyTracker is closed.'
                : 'Get approvals, reminders and chat messages on this phone or computer, even when DailyTracker is closed.'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {on && (
            <button type="button" onClick={sendTest} disabled={busy}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition disabled:opacity-50">
              <Send className="w-3.5 h-3.5" /> Send test
            </button>
          )}
          {(state === 'on' || state === 'off') && (
            <button type="button" disabled={busy}
              onClick={() => run(on ? disablePush : enablePush,
                s => s === 'on' ? 'Phone notifications are on for this device.'
                   : s === 'blocked' ? null
                   : on ? 'Phone notifications are off for this device.' : null)}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition disabled:opacity-50 ${
                on ? 'border border-rose-500/30 text-rose-600 dark:text-rose-400 hover:bg-rose-500/10'
                   : 'bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-600/20'}`}>
              {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : on ? <BellOff className="w-3.5 h-3.5" /> : <BellRing className="w-3.5 h-3.5" />}
              {on ? 'Turn off' : 'Turn on'}
            </button>
          )}
          {state === null && <Loader2 className="w-4 h-4 animate-spin text-slate-400" />}
        </div>
      </div>

      {help && (
        <div className="mt-3 flex items-start gap-2 rounded-xl border border-amber-500/25 bg-amber-500/10 px-3 py-2.5 text-xs text-amber-800 dark:text-amber-300">
          <help.icon className="w-4 h-4 flex-shrink-0 mt-0.5" /><span>{help.text}</span>
        </div>
      )}

      {devices.length > 0 && (
        <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">Your devices with notifications on</p>
          <ul className="flex flex-wrap gap-1.5">
            {devices.map(d => (
              <li key={d.id} className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                  title={`Added ${utcDate(d.createdAt).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' })}`}>
                <Smartphone className="w-3 h-3" /> {d.device ?? 'Device'}
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
};
