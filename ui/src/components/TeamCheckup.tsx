// ─────────────────────────────────────────────────────────────────────────────
//  FILE: ui/src/components/TeamCheckup.tsx
//  Team check-up (8 Oct 2026), on Manager Dashboard → User Management.
//  Until the "Reports to" fix, everyone approved was linked to whoever approved
//  them. This card lists who needs a look, and fixes them in place:
//   • Needs fixing — reports to nobody, to someone who has left, or to someone
//     who can't approve (not a Manager / Team Lead)
//   • Worth a check — developers straight under a manager while team leads exist
//     (often right, so the manager can mark them as correct)
// ─────────────────────────────────────────────────────────────────────────────
import { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Users } from 'lucide-react';
import { Select } from './ui/Select';
import type { ManagerUserDto } from '../types';

export interface TeamIssue { user: ManagerUserDto; why: string }

const roleName = (role: string) => (role === 'TeamLead' ? 'Team Lead' : role);
const canLead = (u?: ManagerUserDto) => !!u && u.isActive && (u.role === 'Manager' || u.role === 'TeamLead');

/** Who needs fixing and who is worth a check, from the User Management list */
export function findTeamIssues(users: ManagerUserDto[]): { fix: TeamIssue[]; check: TeamIssue[] } {
  const byId = new Map(users.map(u => [u.id, u]));
  const hasTeamLeads = users.some(u => u.isActive && u.role === 'TeamLead');
  const fix: TeamIssue[] = [];
  const check: TeamIssue[] = [];
  for (const u of users) {
    if (!u.isActive || u.role === 'Manager' || u.role === 'Admin' || u.role === 'Pending') continue;
    const boss = u.managerId ? byId.get(u.managerId) : undefined;
    if (!u.managerId) fix.push({ user: u, why: 'Reports to nobody yet, so their requests go to every manager.' });
    else if (!boss) fix.push({ user: u, why: 'Reports to someone who is no longer in the list.' });
    else if (!boss.isActive) fix.push({ user: u, why: `Reports to ${boss.fullName}, who has left.` });
    else if (!canLead(boss)) fix.push({ user: u, why: `Reports to ${boss.fullName}, a ${roleName(boss.role)}, who can't approve requests.` });
    else if (hasTeamLeads && u.role === 'Developer' && boss.role === 'Manager')
      check.push({ user: u, why: `Reports straight to ${boss.fullName} (Manager).` });
  }
  const byName = (a: TeamIssue, b: TeamIssue) => a.user.fullName.localeCompare(b.user.fullName);
  return { fix: fix.sort(byName), check: check.sort(byName) };
}

// the "worth a check" people the manager already said are right (this browser only)
const OK_KEY = 'dt.teamCheckup.ok';
const readOk = (): number[] => {
  try { const v = JSON.parse(localStorage.getItem(OK_KEY) ?? '[]'); return Array.isArray(v) ? v : []; } catch { return []; }
};
const saveOk = (ids: number[]) => {
  try { localStorage.setItem(OK_KEY, JSON.stringify(ids)); } catch { /* private mode: just not remembered */ }
};

interface Props {
  users: ManagerUserDto[];
  leaders: ManagerUserDto[];
  onReportsTo: (userId: number, managerId: number) => void;
}

export const TeamCheckup = ({ users, leaders, onReportsTo }: Props) => {
  const { fix, check } = useMemo(() => findTeamIssues(users), [users]);
  const [ok, setOk] = useState<number[]>(readOk);
  // shown again as soon as someone new lands in the group
  const toCheck = check.filter(i => !ok.includes(i.user.id));

  const markCorrect = () => {
    const ids = [...new Set([...ok, ...check.map(i => i.user.id)])];
    setOk(ids);
    saveOk(ids);
  };

  if (fix.length === 0 && toCheck.length === 0) {
    return (
      <p role="status" aria-label="Team check-up"
        className="flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-400">
        <CheckCircle2 className="w-4 h-4 shrink-0" />
        Team check-up: everyone reports to an active team lead or manager.
      </p>
    );
  }

  const row = (issue: TeamIssue) => (
    <li key={issue.user.id} className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 py-2.5">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-slate-900 dark:text-white">
          {issue.user.fullName} <span className="font-normal text-slate-500 dark:text-slate-400">· {roleName(issue.user.role)}</span>
        </p>
        <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">{issue.why}</p>
      </div>
      <div className="sm:w-64 shrink-0">
        <Select
          aria-label={`Who should ${issue.user.fullName} report to?`}
          value=""
          onChange={e => e.target.value && onReportsTo(issue.user.id, Number(e.target.value))}
          className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl px-3 py-2 text-sm"
        >
          <option value="">Choose who they report to…</option>
          {leaders.filter(l => l.id !== issue.user.id).map(l => (
            <option key={l.id} value={l.id}>{l.fullName} · {roleName(l.role)}</option>
          ))}
        </Select>
      </div>
    </li>
  );

  return (
    <section role="region" aria-label="Team check-up"
      className="rounded-2xl border border-amber-300/70 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 p-4 sm:p-5 space-y-4">
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-xl bg-amber-500/15 text-amber-700 dark:text-amber-400 shrink-0">
          <Users className="w-5 h-5" />
        </div>
        <div className="min-w-0">
          <p className="font-semibold text-slate-900 dark:text-white">Team check-up</p>
          <p className="text-sm text-slate-700 dark:text-slate-300 mt-0.5">
            The person someone reports to decides their WFH, missed check-in, expense and comp-off requests. Fix these so requests reach the right team lead.
          </p>
        </div>
      </div>

      {fix.length > 0 && (
        <div>
          <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-rose-700 dark:text-rose-400">
            <AlertTriangle className="w-3.5 h-3.5" /> Needs fixing · {fix.length}
          </p>
          <ul className="divide-y divide-amber-200/70 dark:divide-amber-500/20">
            {fix.map(row)}
          </ul>
        </div>
      )}

      {toCheck.length > 0 && (
        <div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
              Worth a check · {toCheck.length}
            </p>
            <button type="button" onClick={markCorrect}
              className="text-xs font-semibold text-blue-700 dark:text-blue-400 hover:underline">
              These are correct
            </button>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
            Before 8 October, everyone was linked to the manager who approved them. If any of these belong in a team lead's team, move them.
          </p>
          <ul className="divide-y divide-amber-200/70 dark:divide-amber-500/20">
            {toCheck.map(row)}
          </ul>
        </div>
      )}
    </section>
  );
};
