// ─────────────────────────────────────────────────────────────────────────────
//  FILE: ui/src/components/EmailActionCard.tsx
//  Shared result card for approve / reject links opened from emails
//  (EmailAction.tsx → leave, WFHEmailActionPage.tsx → WFH). Light + dark.
// ─────────────────────────────────────────────────────────────────────────────

import { Link } from 'react-router-dom';
import { Loader2, CheckCircle2, XCircle, Building2, ArrowRight } from 'lucide-react';

export const EmailActionCard = ({
  kind,
  state,
  message,
}: {
  kind: 'Leave' | 'WFH';
  state: 'loading' | 'success' | 'error';
  message: string;
}) => (
  <div className="min-h-screen flex items-center justify-center p-4 bg-slate-50 dark:bg-slate-950 relative overflow-hidden">
    <div className="absolute -top-40 -left-40 w-96 h-96 bg-blue-500/10 dark:bg-blue-600/15 rounded-full blur-3xl pointer-events-none" />
    <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-indigo-500/10 dark:bg-indigo-600/15 rounded-full blur-3xl pointer-events-none" />

    <div className="relative w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-xl overflow-hidden">
      <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 px-6 py-4 flex items-center gap-2.5 text-white">
        <div className="w-8 h-8 rounded-lg bg-white/15 border border-white/20 flex items-center justify-center">
          <Building2 className="w-4 h-4" />
        </div>
        <div>
          <p className="text-sm font-bold">Daily Tracker</p>
          <p className="text-[11px] text-white/80">{kind} request · email action</p>
        </div>
      </div>

      <div className="p-8 text-center">
        {state === 'loading' ? (
          <>
            <Loader2 className="w-10 h-10 mx-auto text-blue-500 animate-spin" />
            <p className="text-sm font-medium text-slate-600 dark:text-slate-400 mt-4">{message}</p>
          </>
        ) : (
          <>
            <div className={`w-16 h-16 mx-auto rounded-full flex items-center justify-center border ${
              state === 'success'
                ? 'bg-emerald-500/10 border-emerald-500/20'
                : 'bg-rose-500/10 border-rose-500/20'
            }`}>
              {state === 'success'
                ? <CheckCircle2 className="w-9 h-9 text-emerald-500" />
                : <XCircle className="w-9 h-9 text-rose-500" />}
            </div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white mt-4">
              {state === 'success' ? 'Done' : 'Action Failed'}
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1.5">{message}</p>
            <Link
              to="/"
              className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-500/20 transition"
            >
              Open Daily Tracker <ArrowRight className="w-4 h-4" />
            </Link>
          </>
        )}
      </div>
    </div>
  </div>
);
