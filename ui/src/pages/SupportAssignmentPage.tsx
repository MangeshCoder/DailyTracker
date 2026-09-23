// ─────────────────────────────────────────────────────────────────────────────
//  FILE 13: frontend/src/pages/SupportAssignmentPage.tsx
//  ACTION: CREATE new file (Manager only page)
//
//  Route: /manager/support-assignments
//  Shows all current assignments in a table.
//  Manager can create new assignment (engineer → developer)
//  Manager can deactivate an assignment.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect } from 'react';
import { supportAssignmentApi, authApi } from '../services/api';
import { SupportAssignment, User } from '../types';
import { Trash2 } from 'lucide-react';

export const SupportAssignmentPage = () => {
  const [assignments, setAssignments] = useState<SupportAssignment[]>([]);
  const [users,       setUsers]       = useState<User[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [showForm,    setShowForm]    = useState(false);
  const [saving,      setSaving]      = useState(false);
  const [error,       setError]       = useState('');

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
    if (!confirm(`Remove assignment: ${engineerName} → ${developerName}?`)) return;
    await supportAssignmentApi.deactivate(id);
    await load();
  };

  const active   = assignments.filter(a => a.isActive);
  const inactive = assignments.filter(a => !a.isActive);

  return (
    <div className="p-6 max-w-5xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Support Assignments</h1>
          <p className="text-slate-400 text-sm mt-1">
            Assign support engineers to developers. Employees see their assigned engineer
            pre-filled when they create a support log.
          </p>
        </div>
        <button
          onClick={() => { setShowForm(true); setError(''); }}
          className="bg-violet-600 hover:bg-violet-500 text-white px-4 py-2 rounded-xl text-sm"
        >
          + New Assignment
        </button>
      </div>

      {/* Create form */}
      {showForm && (
        <div className="bg-slate-900 border border-slate-700 rounded-2xl p-5 mb-6">
          <h2 className="text-white font-semibold mb-4">Assign Engineer to Developer</h2>
          <form onSubmit={handleCreate} className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">

              <div>
                <label className="block text-xs text-slate-400 mb-1">Support Engineer</label>
                <select
                  value={form.supportEngineerId}
                  onChange={e => setForm({ ...form, supportEngineerId: parseInt(e.target.value) })}
                  className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2.5 text-sm"
                >
                  <option value={0}>Select engineer…</option>
                  {users.map(u => (
                    <option key={u.id} value={u.id}>{u.fullName} — {u.role}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">Developer</label>
                <select
                  value={form.developerId}
                  onChange={e => setForm({ ...form, developerId: parseInt(e.target.value) })}
                  className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2.5 text-sm"
                >
                  <option value={0}>Select developer…</option>
                  {users
                    .filter(u => u.id !== form.supportEngineerId)
                    .map(u => (
                      <option key={u.id} value={u.id}>{u.fullName} — {u.role}</option>
                    ))}
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs text-slate-400 mb-1">Notes (optional)</label>
                <input
                  type="text"
                  value={form.notes}
                  onChange={e => setForm({ ...form, notes: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2.5 text-sm"
                  placeholder="e.g. Assigned for Q1 sprint"
                />
              </div>
            </div>

            {error && <p className="text-red-400 text-sm">{error}</p>}

            <div className="flex gap-2">
              <button type="submit" disabled={saving}
                className="bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white px-4 py-2 rounded-xl text-sm">
                {saving ? 'Saving…' : 'Assign'}
              </button>
              <button type="button" onClick={() => setShowForm(false)}
                className="bg-slate-700 text-slate-300 px-4 py-2 rounded-xl text-sm">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* Active assignments */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden mb-6">
            <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
              <h2 className="text-white font-semibold">Active Assignments</h2>
              <span className="text-xs bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full">
                {active.length} active
              </span>
            </div>

            {active.length === 0 ? (
              <div className="px-5 py-10 text-center text-slate-500 text-sm">
                No active assignments. Click "+ New Assignment" to create one.
              </div>
            ) : (
              <div className="divide-y divide-slate-800">
                {active.map(a => (
                  <div key={a.id} className="px-5 py-4 flex items-center gap-4">
                    {/* Engineer */}
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-violet-500/20 flex items-center justify-center text-xs text-violet-400 font-bold">
                          {a.supportEngineerName.charAt(0)}
                        </div>
                        <div>
                          <p className="text-sm text-white font-medium">{a.supportEngineerName}</p>
                          <p className="text-xs text-slate-500">Support Engineer</p>
                        </div>
                      </div>
                    </div>

                    {/* Arrow */}
                    <span className="text-slate-600 text-lg shrink-0">→</span>

                    {/* Developer */}
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-blue-500/20 flex items-center justify-center text-xs text-blue-400 font-bold">
                          {a.developerName.charAt(0)}
                        </div>
                        <div>
                          <p className="text-sm text-white font-medium">{a.developerName}</p>
                          <p className="text-xs text-slate-500">Developer</p>
                        </div>
                      </div>
                    </div>

                    {/* Meta */}
                    <div className="hidden md:block text-right shrink-0">
                      <p className="text-xs text-slate-500">By {a.assignedByManager}</p>
                      <p className="text-xs text-slate-600">
                        {new Date(a.assignedAt).toLocaleDateString('en-IN')}
                      </p>
                      {a.notes && <p className="text-xs text-slate-600 italic">{a.notes}</p>}
                    </div>

                    {/* Remove */}
                    <button
                      onClick={() => handleDeactivate(a.id, a.supportEngineerName, a.developerName)}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition shrink-0"
                      title="Remove assignment"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Inactive/removed assignments */}
          {inactive.length > 0 && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-800">
                <h2 className="text-slate-500 font-semibold text-sm">Removed Assignments ({inactive.length})</h2>
              </div>
              <div className="divide-y divide-slate-800/50">
                {inactive.map(a => (
                  <div key={a.id} className="px-5 py-3 flex items-center gap-4 opacity-50">
                    <span className="text-sm text-slate-400">{a.supportEngineerName}</span>
                    <span className="text-slate-600">→</span>
                    <span className="text-sm text-slate-400">{a.developerName}</span>
                    <span className="ml-auto text-xs text-slate-600">
                      {new Date(a.assignedAt).toLocaleDateString('en-IN')}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};