// ─────────────────────────────────────────────────────────────────────────────
//  FILE: ui/src/pages/OnboardingPage.tsx
//  Manager / team lead: new joiners' getting-started checklists.
//  A checklist starts by itself when a new account is approved; recent joiners
//  without one can be started here. Choose a buddy, tick your steps, add or
//  remove steps.
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronDown, Plus, Rocket, UserPlus, X } from 'lucide-react';
import { onboardingApi, profileApi } from '../services/api';
import { PageHeader } from '../components/ui/PageHeader';
import { Select } from '../components/ui/Select';
import { useToast } from '../context/ToastContext';
import { useConfirm } from '../hooks/useConfirm';
import { apiErrorMessage } from '../utils/apiError';
import { OnboardingSteps, Progress, type OnboardingPlan } from '../components/OnboardingChecklist';

interface Candidate { userId: number; fullName: string; role: string; joinedOn: string }
interface Person { id: number; fullName: string }

const SELECT_CLS =
  'appearance-none bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white ' +
  'rounded-xl pl-3 pr-9 py-2 text-sm font-medium cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500/40 transition';

const date = (d: string) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
const TEAM_KEY = ['teamOnboarding'];

const BuddySelect = ({ value, onChange, people, exclude, label }: {
  value: number | null | undefined; onChange: (id: number | null) => void; people: Person[]; exclude: number; label: string;
}) => (
  <Select value={value ?? ''} onChange={e => onChange(e.target.value ? +e.target.value : null)} className={SELECT_CLS} aria-label={label}>
    <option value="">No buddy yet</option>
    {people.filter(p => p.id !== exclude).map(p => <option key={p.id} value={p.id}>{p.fullName}</option>)}
  </Select>
);

const PlanCard = ({ plan, people }: { plan: OnboardingPlan; people: Person[] }) => {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { confirm } = useConfirm();
  const [open, setOpen] = useState(!plan.completedAt);
  const [newStep, setNewStep] = useState('');
  const [owner, setOwner] = useState<'Employee' | 'Manager'>('Employee');
  const refresh = () => qc.invalidateQueries({ queryKey: TEAM_KEY });
  const fail = (what: string) => (e: unknown) => toast.error(apiErrorMessage(e, what));

  const buddy = useMutation({
    mutationFn: (id: number | null) => onboardingApi.setBuddy(plan.id, id),
    onSuccess: (_, id) => toast.success(id ? 'Buddy chosen — both were told' : 'Buddy removed'),
    onError: fail('Could not change the buddy'), onSettled: refresh,
  });
  const add = useMutation({
    mutationFn: () => onboardingApi.addTask(plan.id, { title: newStep.trim(), owner }),
    onSuccess: () => setNewStep(''),
    onError: fail('Could not add the step'), onSettled: refresh,
  });
  const remove = useMutation({
    mutationFn: (taskId: number) => onboardingApi.removeTask(taskId),
    onError: fail('Could not remove the step'), onSettled: refresh,
  });
  const cancel = useMutation({
    mutationFn: () => onboardingApi.cancel(plan.id),
    onSuccess: () => toast.success('Checklist removed'),
    onError: fail('Could not remove the checklist'),
    onSettled: () => ['teamOnboarding', 'onboardingCandidates'].forEach(k => qc.invalidateQueries({ queryKey: [k] })),
  });

  return (
    <article data-testid={`onboarding-${plan.userId}`}
      className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 p-4 sm:p-5 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold text-slate-900 dark:text-white">{plan.userName}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {plan.role} · started {date(plan.createdAt)}
            {plan.completedAt && <span className="ml-1.5 font-semibold text-emerald-600 dark:text-emerald-400">· finished {date(plan.completedAt)}</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <BuddySelect value={plan.buddyUserId} onChange={id => buddy.mutate(id)} people={people} exclude={plan.userId}
            label={`Buddy for ${plan.userName}`} />
          <button type="button" onClick={() => setOpen(o => !o)} aria-expanded={open} aria-label={`${open ? 'Hide' : 'Show'} steps for ${plan.userName}`}
            className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-slate-900 dark:hover:text-white">
            <ChevronDown className={`w-4 h-4 transition ${open ? 'rotate-180' : ''}`} />
          </button>
        </div>
      </div>
      <Progress done={plan.doneCount} total={plan.totalCount} />

      {open && (
        <div className="space-y-4">
          <OnboardingSteps plan={plan} queryKey={TEAM_KEY} onRemove={id => remove.mutate(id)} />
          <form className="flex flex-wrap gap-2" onSubmit={e => { e.preventDefault(); if (newStep.trim()) add.mutate(); }}>
            <input value={newStep} onChange={e => setNewStep(e.target.value)} maxLength={200}
              placeholder="Add a step, e.g. Security training" aria-label={`New step for ${plan.userName}`}
              className="flex-1 min-w-[12rem] bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
            <Select value={owner} onChange={e => setOwner(e.target.value as 'Employee' | 'Manager')} className={SELECT_CLS} aria-label="Who does it">
              <option value="Employee">Employee does it</option>
              <option value="Manager">Manager does it</option>
            </Select>
            <button type="submit" disabled={!newStep.trim() || add.isPending}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-semibold bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-50">
              <Plus className="w-4 h-4" /> Add
            </button>
          </form>
          <button type="button" disabled={cancel.isPending}
            onClick={async () => {
              if (await confirm(`${plan.userName}'s getting-started checklist will be removed.`, { title: 'Remove this checklist?', confirmText: 'Remove' }))
                cancel.mutate();
            }}
            className="inline-flex items-center gap-1 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:underline disabled:opacity-50">
            <X className="w-3.5 h-3.5" /> Remove checklist
          </button>
        </div>
      )}
    </article>
  );
};

export const OnboardingPage = () => {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [buddies, setBuddies] = useState<Record<number, number | null>>({});

  const { data: plans = [], isLoading } = useQuery<OnboardingPlan[]>({
    queryKey: TEAM_KEY, queryFn: () => onboardingApi.getTeam().then(r => r.data),
  });
  const { data: candidates = [] } = useQuery<Candidate[]>({
    queryKey: ['onboardingCandidates'], queryFn: () => onboardingApi.getCandidates().then(r => r.data),
  });
  const { data: people = [] } = useQuery<Person[]>({
    queryKey: ['directory'], queryFn: () => profileApi.getDirectory().then(r => r.data),
  });

  const start = useMutation({
    mutationFn: (userId: number) => onboardingApi.start({ userId, buddyUserId: buddies[userId] ?? null }),
    onSuccess: () => toast.success('Checklist started — they will see it on their dashboard'),
    onError: (e: unknown) => toast.error(apiErrorMessage(e, 'Could not start onboarding')),
    onSettled: () => ['teamOnboarding', 'onboardingCandidates'].forEach(k => qc.invalidateQueries({ queryKey: [k] })),
  });

  const active = plans.filter(p => !p.completedAt);
  const finished = plans.filter(p => p.completedAt);

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
      <PageHeader
        title="Onboarding"
        description="Getting-started checklists for new joiners. They start by themselves when you approve a new account."
        breadcrumbs={[{ label: 'Manager', href: '/manager' }, { label: 'Onboarding' }]}
        badge={{ label: `${active.length} in progress`, variant: 'blue' }}
      />

      {candidates.length > 0 && (
        <section aria-labelledby="candidates-title" className="rounded-2xl border border-dashed border-blue-500/30 bg-blue-50/50 dark:bg-blue-500/5 p-4 sm:p-5 space-y-3">
          <h2 id="candidates-title" className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <UserPlus className="w-4 h-4 text-blue-500" /> Joined recently, no checklist yet
          </h2>
          <ul className="space-y-2">
            {candidates.map(c => (
              <li key={c.userId} className="flex flex-wrap items-center gap-2 justify-between">
                <span className="text-sm text-slate-800 dark:text-slate-200">
                  <strong>{c.fullName}</strong> <span className="text-slate-500 dark:text-slate-400">· {c.role} · joined {date(c.joinedOn)}</span>
                </span>
                <span className="flex items-center gap-2">
                  <BuddySelect value={buddies[c.userId]} onChange={id => setBuddies(b => ({ ...b, [c.userId]: id }))}
                    people={people} exclude={c.userId} label={`Buddy for ${c.fullName}`} />
                  <button type="button" disabled={start.isPending} onClick={() => start.mutate(c.userId)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-semibold bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-50">
                    <Rocket className="w-4 h-4" /> Start onboarding
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {isLoading ? (
        <div className="h-40 rounded-2xl bg-slate-100 dark:bg-slate-800/60 animate-pulse" />
      ) : plans.length === 0 ? (
        <p className="text-sm text-slate-500 dark:text-slate-400 px-4 py-10 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 text-center">
          No onboarding checklists yet. When you approve a new account on Assign Roles, their checklist appears here.
        </p>
      ) : (
        <>
          <div className="space-y-4">{active.map(p => <PlanCard key={p.id} plan={p} people={people} />)}</div>
          {finished.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-sm font-bold text-slate-500 dark:text-slate-400">Finished</h2>
              {finished.map(p => <PlanCard key={p.id} plan={p} people={people} />)}
            </section>
          )}
        </>
      )}
    </div>
  );
};

export default OnboardingPage;
