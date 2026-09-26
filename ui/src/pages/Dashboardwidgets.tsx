// ─────────────────────────────────────────────────────────────────────────────
//  FILE: ui/src/pages/Dashboardwidgets.tsx
//  Goals page - Modern Design System Upgrade
//
//  Exports (logic unchanged):
//  ✅ GoalsWidget       — "Today's Goals" page (route: /goals)
//                          set work-hours / tasks / support targets, live progress
//
//  NotificationBell → components/NotificationBell.tsx (used in Layout)
//  KudosFeed        → components/KudosFeed.tsx        (used on the Kudos page)
//  Kept separate so this lazy-loaded page isn't pulled into the main bundle.
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { goalsApi } from '../services/api';
import type { GoalProgress } from '../types';
import { useToast } from '../context/ToastContext';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '../components/ui/PageHeader';
import { Card, CardContent } from '../components/ui/Card';
import {
  Target,
  Pencil,
  X,
  Save,
  Loader2,
  Timer,
  ListChecks,
  LifeBuoy,
  Coffee,
  Lightbulb,
  History,
} from 'lucide-react';

// ═══════════════════════════════════════════════════════════════════════════════
//  Goals & Productivity Score page
// ═══════════════════════════════════════════════════════════════════════════════

const GRADE_META: Record<string, { text: string; stroke: string; label: string }> = {
  A: { text: 'text-emerald-600 dark:text-emerald-400', stroke: '#10b981', label: 'Excellent' },
  B: { text: 'text-blue-600 dark:text-blue-400',       stroke: '#3b82f6', label: 'Good' },
  C: { text: 'text-amber-600 dark:text-amber-400',     stroke: '#f59e0b', label: 'Fair' },
  D: { text: 'text-rose-600 dark:text-rose-400',       stroke: '#f43f5e', label: 'Needs focus' },
};

const GOAL_INPUT_CLS =
  'w-full bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white ' +
  'rounded-xl pl-10 pr-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition';

const ProgressBar = ({ value, color }: { value: number; color: string }) => (
  <div className="w-full h-2 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
    <div
      className={`h-full rounded-full transition-all duration-700 ${color}`}
      style={{ width: `${Math.min(value, 100)}%` }}
    />
  </div>
);

export const GoalsWidget = () => {
  const navigate = useNavigate();
  const [editMode, setEditMode] = useState(false);
  const [targetHours, setTargetHours] = useState(8);
  const [targetTasks, setTargetTasks] = useState(5);
  const [targetSupport, setTargetSupport] = useState(3);

  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: progress, isLoading } = useQuery<GoalProgress>({
    queryKey: ['goalProgress'],
    queryFn: () => goalsApi.getProgress().then(r => r.data),
    refetchInterval: 60_000,
  });

  const setGoal = useMutation({
    mutationFn: () => goalsApi.setGoal({
      targetWorkMinutes:    targetHours * 60,
      targetTasksCompleted: targetTasks,
      targetBreakMinutes:   60,
      targetSupportGiven:   targetSupport,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['goalProgress'] });
      toast.success('Goals updated!');
      setEditMode(false);
    }
  });

  const header = (
    <PageHeader
      title="Today's Goals"
      description="Set your daily targets and track your productivity score live."
      breadcrumbs={[
        { label: 'Workspace', href: '/' },
        { label: 'Goals' },
      ]}
      badge={{ label: 'Updates every minute', variant: 'blue', icon: <Target className="w-3 h-3" /> }}
      actions={
        <>
          <button
            onClick={() => navigate('/goal-history')}
            className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition"
          >
            <History className="w-4 h-4" /> History
          </button>
          <button
            onClick={() => setEditMode(!editMode)}
            className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition ${
              editMode
                ? 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700'
                : 'bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-500/20'
            }`}
          >
            {editMode ? <X className="w-4 h-4" /> : <Pencil className="w-4 h-4" />}
            {editMode ? 'Cancel' : 'Edit Goals'}
          </button>
        </>
      }
      className="!mb-0"
    />
  );

  if (isLoading) return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
      {header}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="h-64 bg-slate-100 dark:bg-slate-800/60 rounded-3xl animate-pulse" />
        <div className="lg:col-span-2 h-64 bg-slate-100 dark:bg-slate-800/60 rounded-2xl animate-pulse" />
      </div>
    </div>
  );

  const p = progress;
  const grade = GRADE_META[p?.scoreGrade ?? ''] ?? GRADE_META.D;
  const score = p?.productivityScore ?? 0;
  const r = 52;
  const c = 2 * Math.PI * r;

  const metrics = [
    {
      label:  'Work Hours',
      icon:   Timer,
      pct:    p?.workProgress,
      actual: `${Math.round((p?.actualWorkMinutes ?? 0) / 60 * 10) / 10}h`,
      target: `${Math.round((p?.goal.targetWorkMinutes ?? 480) / 60)}h`,
      color:  'bg-blue-500',
      iconCls: 'text-blue-500',
    },
    {
      label:  'Tasks Done',
      icon:   ListChecks,
      pct:    p?.taskProgress,
      actual: p?.actualTasksCompleted?.toString(),
      target: p?.goal.targetTasksCompleted?.toString(),
      color:  'bg-emerald-500',
      iconCls: 'text-emerald-500',
    },
    {
      label:  'Support Given',
      icon:   LifeBuoy,
      pct:    p?.supportProgress,
      actual: p?.actualSupportGiven?.toString(),
      target: p?.goal.targetSupportGiven?.toString(),
      color:  'bg-violet-500',
      iconCls: 'text-violet-500',
    },
    {
      label:  'Break Time',
      icon:   Coffee,
      pct:    p?.breakProgress,
      actual: `${p?.actualBreakMinutes ?? 0}m`,
      target: `${p?.goal.targetBreakMinutes ?? 60}m`,
      color:  'bg-amber-500',
      iconCls: 'text-amber-500',
    },
  ];

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
      {header}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── Score ring ── */}
        <Card className="relative overflow-hidden !rounded-3xl">
          <div className="absolute -top-20 -right-20 w-56 h-56 bg-gradient-to-br from-blue-500/15 via-indigo-500/10 to-transparent rounded-full blur-2xl pointer-events-none" />
          <CardContent className="relative z-10 flex flex-col items-center text-center">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-4">Productivity Score</p>
            <div className="relative w-36 h-36">
              <svg className="w-36 h-36 -rotate-90" viewBox="0 0 120 120">
                <circle cx="60" cy="60" r={r} fill="none" strokeWidth="10" className="stroke-slate-200 dark:stroke-slate-800" />
                <circle
                  cx="60" cy="60" r={r} fill="none"
                  stroke={grade.stroke}
                  strokeWidth="10"
                  strokeLinecap="round"
                  strokeDasharray={c}
                  strokeDashoffset={c * (1 - Math.min(score, 100) / 100)}
                  className="transition-all duration-700"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className={`text-4xl font-extrabold ${grade.text}`}>{p?.scoreGrade ?? '—'}</span>
                <span className="text-sm font-semibold text-slate-600 dark:text-slate-400">{score}%</span>
              </div>
            </div>
            <p className={`text-sm font-bold mt-4 ${grade.text}`}>{grade.label}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">A 90%+ · B 75%+ · C 60%+</p>
          </CardContent>
        </Card>

        {/* ── Progress / edit ── */}
        <Card className="lg:col-span-2">
          <CardContent>
            <div className="flex items-center gap-2.5 mb-5">
              <div className="p-2 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                {editMode ? <Pencil className="w-4 h-4" /> : <Target className="w-4 h-4" />}
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">{editMode ? 'Set Your Targets' : 'Progress vs Targets'}</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {editMode ? 'Break target stays at 60 minutes' : 'Live progress for today'}
                </p>
              </div>
            </div>

            {editMode ? (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {[
                    { label: 'Work Hours',     icon: Timer,      value: targetHours,   set: setTargetHours,   min: 1, max: 12 },
                    { label: 'Tasks to Complete', icon: ListChecks, value: targetTasks, set: setTargetTasks,   min: 1, max: 20 },
                    { label: 'Support Logs',   icon: LifeBuoy,   value: targetSupport, set: setTargetSupport, min: 0, max: 20 },
                  ].map(f => {
                    const Icon = f.icon;
                    return (
                      <div key={f.label}>
                        <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">{f.label}</label>
                        <div className="relative">
                          <Icon className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                          <input
                            type="number"
                            value={f.value}
                            onChange={e => f.set(+e.target.value)}
                            min={f.min}
                            max={f.max}
                            className={GOAL_INPUT_CLS}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="flex justify-end pt-2 border-t border-slate-100 dark:border-slate-800">
                  <button
                    onClick={() => setGoal.mutate()}
                    disabled={setGoal.isPending}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-500/20 transition disabled:opacity-50"
                  >
                    {setGoal.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    {setGoal.isPending ? 'Saving…' : 'Save Goals'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {metrics.map(item => {
                  const Icon = item.icon;
                  return (
                    <div key={item.label}>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-700 dark:text-slate-300">
                          <Icon className={`w-4 h-4 ${item.iconCls}`} /> {item.label}
                        </span>
                        <span className="text-xs text-slate-500 dark:text-slate-400">
                          <span className="text-sm font-bold text-slate-900 dark:text-white">{item.actual ?? 0}</span> / {item.target ?? '—'}
                        </span>
                      </div>
                      <ProgressBar value={item.pct ?? 0} color={item.color} />
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Insights ── */}
      {!editMode && p?.insights && p.insights.length > 0 && (
        <Card>
          <CardContent>
            <div className="flex items-center gap-2.5 mb-4">
              <div className="p-2 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                <Lightbulb className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Insights</h3>
            </div>
            <div className="space-y-2">
              {p.insights.map((insight, i) => (
                <p key={i} className="text-sm text-slate-700 dark:text-slate-300 px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                  {insight}
                </p>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
