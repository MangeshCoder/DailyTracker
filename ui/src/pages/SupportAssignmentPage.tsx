// ─────────────────────────────────────────────────────────────────────────────
//  FILE: ui/src/pages/SupportAssignmentPage.tsx
//  Support Assignments (Manager) - Modern Design System Upgrade
//
//  Route: /manager/support-assignments
//  Logic unchanged from previous version:
//  ✅ Lists all assignments (active + removed)
//  ✅ Manager creates new assignment (engineer → developer, optional notes)
//  ✅ Manager removes (deactivates) an assignment
//  UI: native confirm() replaced with the app's themed useConfirm dialog.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useMemo } from 'react';
import { supportAssignmentApi, authApi } from '../services/api';
import type { SupportAssignment, User } from '../types';
import { useConfirm } from '../hooks/useConfirm';
import { PageHeader } from '../components/ui/PageHeader';
import { StatCard } from '../components/ui/StatCard';
import { Card, CardContent } from '../components/ui/Card';
import {
  Trash2,
  Plus,
  X,
  Link2,
  Link2Off,
  Users,
  UserCog,
  Code2,
  ArrowRight,
  ChevronDown,
  Loader2,
  AlertCircle,
  CalendarDays,
  StickyNote,
  Search,
  History,
  Info,
  Save,
} from 'lucide-react';

// ─── Shared input styles ──────────────────────────────────────────────────────

const INPUT_CLS =
  'w-full bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white ' +
  'placeholder:text-slate-400 dark:placeholder:text-slate-500 rounded-xl px-3.5 py-2.5 text-sm ' +
  'focus:outline-none focus:ring-2 focus:ring-violet-500/40 focus:border-violet-500 transition';

const LABEL_CLS = 'block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5';

const Select = ({ children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) => (
  <div className="relative">
    <select {...props} className={`${INPUT_CLS} appearance-none pr-10 cursor-pointer`}>
      {children}
    </select>
    <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
  </div>
);

const formatDate = (d: string) =>
  new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

// ─── Person chip ──────────────────────────────────────────────────────────────

const Person = ({ name, role, tone }: { name: string; role: string; tone: 'violet' | 'blue' }) => (
  <div className="flex items-center gap-2.5 min-w-0">
    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0 bg-gradient-to-br ${
      tone === 'violet' ? 'from-violet-500 to-fuchsia-500' : 'from-blue-500 to-cyan-500'
    }`}>
      {name.charAt(0)}
    </div>
    <div className="min-w-0">
      <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{name}</p>
      <p className={`text-[11px] font-semibold ${
        tone === 'violet' ? 'text-violet-600 dark:text-violet-400' : 'text-blue-600 dark:text-blue-400'
      }`}>
        {role}
      </p>
    </div>
  </div>
);

// ─── Main Page ────────────────────────────────────────────────────────────────

export const SupportAssignmentPage = () => {
  const [assignments, setAssignments] = useState<SupportAssignment[]>([]);
  const [users,       setUsers]       = useState<User[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [showForm,    setShowForm]    = useState(false);
  const [saving,      setSaving]      = useState(false);
  const [error,       setError]       = useState('');
  const [search,      setSearch]      = useState('');
  const [showRemoved, setShowRemoved] = useState(false);
  const { confirm } = useConfirm();

  const [form, setForm] = useState({
    supportEngineerId: 0,
    developerId:       0,
    notes:             '',
  });

  const load = async () => {
    try {
      const [assignRes, usersRes] = await Promise.all([
        supportAssignmentApi.getAll(),
        authApi.getUsers(),
      ]);
      setAssignments(assignRes.data);
      setUsers(usersRes.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.supportEngineerId) { setError('Select a support engineer.'); return; }
    if (!form.developerId)       { setError('Select a developer.');        return; }

    setSaving(true);
    setError('');
    try {
      await supportAssignmentApi.create(form);
      setForm({ supportEngineerId: 0, developerId: 0, notes: '' });
      setShowForm(false);
      await load();
    } catch {
      setError('Failed to create assignment.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivate = async (id: number, engineerName: string, developerName: string) => {
    const ok = await confirm(`Remove assignment: ${engineerName} → ${developerName}?`, {
      title:       'Remove Assignment?',
      confirmText: 'Yes, remove',
      danger:      true,
    });
    if (!ok) return;
    await supportAssignmentApi.deactivate(id);
    await load();
  };

  const active   = assignments.filter(a => a.isActive);
  const inactive = assignments.filter(a => !a.isActive);

  const engineerCount = useMemo(() => new Set(active.map(a => a.supportEngineerId)).size, [active]);

  const filteredActive = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return active;
    return active.filter(a =>
      a.supportEngineerName.toLowerCase().includes(q) ||
      a.developerName.toLowerCase().includes(q) ||
      (a.notes ?? '').toLowerCase().includes(q),
    );
  }, [active, search]);

  const selectedEngineer = users.find(u => u.id === form.supportEngineerId);
  const selectedDeveloper = users.find(u => u.id === form.developerId);

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">

      {/* ── Page Header ── */}
      <PageHeader
        title="Support Assignments"
        description="Assign support engineers to developers. Employees see their assigned engineer pre-filled when they create a support log."
        breadcrumbs={[
          { label: 'Workspace', href: '/' },
          { label: 'Management' },
          { label: 'Support Assignments' },
        ]}
        badge={{ label: 'Manager Only', variant: 'purple', icon: <UserCog className="w-3 h-3" /> }}
        actions={
          <button
            type="button"
            onClick={() => { setShowForm(!showForm); setError(''); }}
            className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition cursor-pointer ${
              showForm
                ? 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700'
                : 'bg-violet-600 hover:bg-violet-500 text-white shadow-md shadow-violet-500/20'
            }`}
          >
            {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            {showForm ? 'Cancel' : 'New Assignment'}
          </button>
        }
        className="!mb-0"
      />

      {/* ── Stats ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard title="Active Assignments" value={active.length}   icon={Link2}    color="emerald" loading={loading} />
        <StatCard title="Engineers Assigned" value={engineerCount}   icon={Users}    color="purple"  loading={loading} />
        <StatCard title="Removed"            value={inactive.length} icon={Link2Off} color="slate"   loading={loading} />
      </div>

      {/* ── Create form ── */}
      {showForm && (
        <Card className="relative overflow-hidden">
          <div className="absolute -top-20 -right-20 w-56 h-56 bg-gradient-to-br from-violet-500/15 to-transparent rounded-full blur-2xl pointer-events-none" />
          <CardContent className="relative z-10">
            <div className="flex items-center gap-2.5 mb-5">
              <div className="p-2 rounded-lg bg-violet-500/10 text-violet-600 dark:text-violet-400 border border-violet-500/20">
                <Link2 className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">Assign Engineer to Developer</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">The developer will see this engineer locked on their support form</p>
              </div>
            </div>

            <form onSubmit={handleCreate} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-4 md:items-end">
                <div>
                  <label className={LABEL_CLS}>Support Engineer <span className="text-rose-500">*</span></label>
                  <Select
                    value={form.supportEngineerId}
                    onChange={e => setForm({ ...form, supportEngineerId: parseInt(e.target.value) })}
                  >
                    <option value={0}>Select engineer…</option>
                    {users.map(u => (
                      <option key={u.id} value={u.id}>{u.fullName} — {u.role}</option>
                    ))}
                  </Select>
                </div>

                <div className="hidden md:flex items-center justify-center pb-2.5">
                  <div className="p-2 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400">
                    <ArrowRight className="w-4 h-4" />
                  </div>
                </div>

                <div>
                  <label className={LABEL_CLS}>Developer <span className="text-rose-500">*</span></label>
                  <Select
                    value={form.developerId}
                    onChange={e => setForm({ ...form, developerId: parseInt(e.target.value) })}
                  >
                    <option value={0}>Select developer…</option>
                    {users
                      .filter(u => u.id !== form.supportEngineerId)
                      .map(u => (
                        <option key={u.id} value={u.id}>{u.fullName} — {u.role}</option>
                      ))}
                  </Select>
                </div>
              </div>

              <div>
                <label className={LABEL_CLS}>Notes (optional)</label>
                <div className="relative">
                  <StickyNote className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={form.notes}
                    onChange={e => setForm({ ...form, notes: e.target.value })}
                    className={`${INPUT_CLS} pl-10`}
                    placeholder="e.g. Assigned for Q1 sprint"
                  />
                </div>
              </div>

              {/* Preview */}
              {selectedEngineer && selectedDeveloper && (
                <div className="flex flex-wrap items-center gap-3 px-4 py-3 rounded-2xl bg-violet-500/5 border border-violet-500/20">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-violet-600 dark:text-violet-400">Preview</span>
                  <Person name={selectedEngineer.fullName} role="Support Engineer" tone="violet" />
                  <ArrowRight className="w-4 h-4 text-slate-400" />
                  <Person name={selectedDeveloper.fullName} role="Developer" tone="blue" />
                </div>
              )}

              {error && (
                <div className="flex items-start gap-2 px-3.5 py-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20">
                  <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                  <p className="text-sm text-rose-700 dark:text-rose-300">{error}</p>
                </div>
              )}

              <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-4 py-2.5 rounded-xl text-sm font-semibold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-violet-600 hover:bg-violet-500 text-white shadow-md shadow-violet-500/20 transition disabled:opacity-50"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  {saving ? 'Saving…' : 'Assign'}
                </button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-20 rounded-2xl bg-slate-100 dark:bg-slate-800/60 animate-pulse" />
          ))}
        </div>
      ) : (
        <>
          {/* ── Active assignments ── */}
          <Card className="overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  <Link2 className="w-4 h-4" />
                </div>
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">Active Assignments</h2>
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  {active.length} active
                </span>
              </div>
              {active.length > 0 && (
                <div className="relative sm:w-64">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Search name or note…"
                    className={`${INPUT_CLS} pl-9 py-2`}
                  />
                </div>
              )}
            </div>

            {active.length === 0 ? (
              <div className="px-5 py-14 text-center">
                <div className="w-14 h-14 mx-auto rounded-2xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
                  <Link2 className="w-7 h-7 text-violet-500" />
                </div>
                <p className="text-base font-bold text-slate-900 dark:text-white mt-3">No active assignments</p>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                  Click <span className="font-semibold text-violet-600 dark:text-violet-400">New Assignment</span> to create one.
                </p>
              </div>
            ) : filteredActive.length === 0 ? (
              <div className="px-5 py-10 text-center text-sm text-slate-500 dark:text-slate-400">
                No assignments match "{search}".
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
                {filteredActive.map(a => (
                  <div key={a.id} className="px-5 py-4 flex flex-col md:flex-row md:items-center gap-3 md:gap-4 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="flex-1 min-w-0">
                        <Person name={a.supportEngineerName} role="Support Engineer" tone="violet" />
                      </div>
                      <div className="p-1.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 shrink-0">
                        <ArrowRight className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <Person name={a.developerName} role="Developer" tone="blue" />
                      </div>
                    </div>

                    <div className="flex items-center justify-between md:justify-end gap-3 md:w-72 shrink-0">
                      <div className="text-xs space-y-0.5 min-w-0 md:text-right">
                        <p className="inline-flex items-center gap-1 text-slate-600 dark:text-slate-400">
                          <UserCog className="w-3.5 h-3.5" /> By {a.assignedByManager}
                        </p>
                        <p className="flex md:justify-end items-center gap-1 text-slate-500 dark:text-slate-500">
                          <CalendarDays className="w-3.5 h-3.5" /> {formatDate(a.assignedAt)}
                        </p>
                        {a.notes && (
                          <p className="flex md:justify-end items-center gap-1 text-slate-500 dark:text-slate-400 italic truncate" title={a.notes}>
                            <StickyNote className="w-3.5 h-3.5 shrink-0" /> <span className="truncate">{a.notes}</span>
                          </p>
                        )}
                      </div>
                      <button
                        onClick={() => handleDeactivate(a.id, a.supportEngineerName, a.developerName)}
                        className="p-2 rounded-lg text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/20 transition shrink-0"
                        title="Remove assignment"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* ── Removed assignments ── */}
          {inactive.length > 0 && (
            <Card className="overflow-hidden">
              <button
                type="button"
                onClick={() => setShowRemoved(!showRemoved)}
                className="w-full px-5 py-4 flex items-center justify-between gap-3 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition"
              >
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-lg bg-slate-500/10 text-slate-500 dark:text-slate-400 border border-slate-500/20">
                    <History className="w-4 h-4" />
                  </div>
                  <h2 className="text-sm font-bold text-slate-700 dark:text-slate-300">Removed Assignments</h2>
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-500/10 text-slate-600 dark:text-slate-400 border border-slate-500/20">
                    {inactive.length} 
                  </span>
                </div>
                <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${showRemoved ? 'rotate-180' : ''}`} />
              </button>

              {showRemoved && (
                <div className="divide-y divide-slate-100 dark:divide-slate-800/60 border-t border-slate-100 dark:border-slate-800">
                  {inactive.map(a => (
                    <div key={a.id} className="px-5 py-3 flex items-center gap-3 text-sm">
                      <span className="inline-flex items-center gap-1.5 text-slate-500 dark:text-slate-400 min-w-0">
                        <UserCog className="w-3.5 h-3.5 shrink-0" /> <span className="truncate line-through">{a.supportEngineerName}</span>
                      </span>
                      <ArrowRight className="w-3.5 h-3.5 text-slate-300 dark:text-slate-600 shrink-0" />
                      <span className="inline-flex items-center gap-1.5 text-slate-500 dark:text-slate-400 min-w-0">
                        <Code2 className="w-3.5 h-3.5 shrink-0" /> <span className="truncate line-through">{a.developerName}</span>
                      </span>
                      <span className="ml-auto text-xs text-slate-400 dark:text-slate-500 shrink-0">
                        {formatDate(a.assignedAt)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          )}

          <p className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
            <Info className="w-3.5 h-3.5" />
            Removing an assignment unlocks the engineer field on that developer's support form.
          </p>
        </>
      )}
    </div>
  );
};
