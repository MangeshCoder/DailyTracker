// ─────────────────────────────────────────────────────────────────────────────
//  FILE: ui/src/components/OnboardingChecklist.tsx
//  A new joiner's getting-started checklist.
//   • OnboardingSteps — the list of steps (shared by the dashboard card and the
//     manager's Onboarding page); app steps link to where they're done
//   • GettingStartedCard — on the employee's dashboard until everything is done
// ─────────────────────────────────────────────────────────────────────────────
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, CheckCircle2, Circle, Rocket, Trash2 } from 'lucide-react';
import { onboardingApi } from '../services/api';
import { useToast } from '../context/ToastContext';
import { apiErrorMessage } from '../utils/apiError';

export interface OnboardingTask {
  id: number;
  title: string;
  kind: string;
  owner: 'Employee' | 'Manager';
  done: boolean;
  doneAt?: string | null;
  link?: string | null;
  canTick: boolean;
}

export interface OnboardingPlan {
  id: number;
  userId: number;
  userName: string;
  role: string;
  joinDate?: string | null;
  buddyUserId?: number | null;
  buddyName?: string | null;
  createdAt: string;
  completedAt?: string | null;
  doneCount: number;
  totalCount: number;
  tasks: OnboardingTask[];
}

export const Progress = ({ done, total }: { done: number; total: number }) => {
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden"
        role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Onboarding progress">
        <div className="h-full rounded-full bg-gradient-to-r from-blue-500 to-emerald-500 transition-all" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-bold text-slate-700 dark:text-slate-300 tabular-nums">{done}/{total}</span>
    </div>
  );
};

/** The steps, grouped by who does them. `onRemove` shows a delete button on manual steps (managers). */
export const OnboardingSteps = ({ plan, queryKey, onRemove }: {
  plan: OnboardingPlan;
  queryKey: unknown[];
  onRemove?: (taskId: number) => void;
}) => {
  const qc = useQueryClient();
  const { toast } = useToast();
  const tick = useMutation({
    mutationFn: ({ id, done }: { id: number; done: boolean }) => onboardingApi.tick(id, done),
    onError: (e: unknown) => toast.error(apiErrorMessage(e, 'Could not update the step')),
    onSettled: () => qc.invalidateQueries({ queryKey }),
  });

  const groups: { owner: OnboardingTask['owner']; label: string }[] = [
    { owner: 'Employee', label: 'Your steps' },
    { owner: 'Manager', label: 'Your manager does' },
  ];

  return (
    <div className="space-y-4">
      {groups.map(g => {
        const tasks = plan.tasks.filter(t => t.owner === g.owner);
        if (tasks.length === 0) return null;
        return (
          <div key={g.owner}>
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
              {onRemove ? (g.owner === 'Employee' ? 'Employee' : 'Manager / team lead') : g.label}
            </p>
            <ul className="space-y-1">
              {tasks.map(t => (
                <li key={t.id} className="flex items-center gap-2.5 rounded-xl px-2 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-800/40">
                  {t.canTick ? (
                    <button type="button" aria-label={`${t.done ? 'Untick' : 'Tick'} ${t.title}`}
                      disabled={tick.isPending} onClick={() => tick.mutate({ id: t.id, done: !t.done })}
                      className="shrink-0 disabled:opacity-50">
                      {t.done ? <CheckCircle2 className="w-5 h-5 text-emerald-500" /> : <Circle className="w-5 h-5 text-slate-400 hover:text-blue-500" />}
                    </button>
                  ) : t.done ? (
                    <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-500" aria-label="Done" />
                  ) : (
                    <Circle className="w-5 h-5 shrink-0 text-slate-300 dark:text-slate-600" aria-label="Not done yet" />
                  )}
                  <span className={`flex-1 min-w-0 text-sm ${t.done ? 'text-slate-400 dark:text-slate-500 line-through' : 'text-slate-800 dark:text-slate-200'}`}>
                    {t.title}
                    {t.kind !== 'Manual' && !t.done && (
                      <span className="ml-1.5 text-[10px] font-semibold text-slate-400">· ticks itself</span>
                    )}
                  </span>
                  {t.link && !t.done && !onRemove && (
                    <Link to={t.link} className="shrink-0 inline-flex items-center gap-1 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline">
                      Go <ArrowRight className="w-3 h-3" />
                    </Link>
                  )}
                  {onRemove && t.kind === 'Manual' && (
                    <button type="button" aria-label={`Remove ${t.title}`} onClick={() => onRemove(t.id)}
                      className="shrink-0 p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
};

/** The employee's own checklist on the dashboard (hidden once finished or if they have none) */
export const GettingStartedCard = () => {
  const { data: plan } = useQuery<OnboardingPlan | null>({
    queryKey: ['myOnboarding'],
    queryFn: () => onboardingApi.getMine().then(r => (r.status === 204 ? null : r.data)),
  });
  if (!plan?.tasks || plan.completedAt) return null;

  return (
    <section aria-labelledby="getting-started-title"
      className="rounded-2xl border border-blue-500/25 bg-gradient-to-br from-blue-50 to-white dark:from-blue-500/10 dark:to-slate-900/80 p-4 sm:p-5 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id="getting-started-title" className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Rocket className="w-5 h-5 text-blue-500" /> Getting started
          </h2>
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
            A few steps for your first days.
            {plan.buddyName && <> Your buddy is <strong className="text-slate-800 dark:text-slate-200">{plan.buddyName}</strong> — ask them anything.</>}
          </p>
        </div>
      </div>
      <Progress done={plan.doneCount} total={plan.totalCount} />
      <OnboardingSteps plan={plan} queryKey={['myOnboarding']} />
    </section>
  );
};
