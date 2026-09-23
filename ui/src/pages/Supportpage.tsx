// ─────────────────────────────────────────────────────────────────────────────
//  FILE 12: frontend/src/pages/Supportpage.tsx
//  ACTION: REPLACE entire file
//
//  Changes from previous version:
//  Feature 2: Two dropdowns — Support Engineer + Developer (both required)
//  Feature 3: On form open, calls GET /support/my-assignment
//             If assignment found:
//               - Engineer field shows "Assigned by manager: [Name]" (locked)
//               - Cannot be changed by employee
//             If no assignment:
//               - Engineer field shows open dropdown "Choose support engineer"
//  Location validation: unchanged (geo hook still used)
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useMemo } from 'react';
import { supportApi, authApi } from '../services/api';
import { SupportLog, User, CreateSupportDto, MyAssignment } from '../types';
import { SupportMediaDisplay } from '../components/SupportMediaDisplay';
import { SupportKanbanBoard } from './SupportKanbanBoard';
import { SupportFileUpload } from '../components/SupportFileUpload';
import { Trash2 } from 'lucide-react';
import { useGeolocation } from '../context/useGeolocation';
import { useConfirm } from '../hooks/useConfirm';

const supportTypes = ['Technical', 'CodeReview', 'Debugging', 'Deployment', 'Other'];

const formatISTTime = (dateString?: string) => {
  if (!dateString) return '--:--';
  const utcDate = new Date(dateString + 'Z');
  return utcDate.toLocaleTimeString('en-IN', {
    hour: '2-digit', minute: '2-digit',
    hour12: true, timeZone: 'Asia/Kolkata',
  });
};

const defaultForm: CreateSupportDto = {
  supportEngineerId:    0,
  supportedDeveloperId: 0,
  issueDescription:     '',
  resolution:           '',
  timeSpentMinutes:     0,
  supportType:          'Technical',
};

// ── Location Status Banner (same as before) ───────────────────────────────────
function LocationBanner({ status, distance, accuracy, errorMessage, onRetry }: {
  status: string; distance: number | null; accuracy: number | null;
  errorMessage: string; onRetry: () => void;
}) {
  if (status === 'requesting')
    return (
      <div className="flex items-center gap-3 px-4 py-3 bg-blue-500/10 border border-blue-500/30 rounded-xl">
        <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin shrink-0" />
        <div>
          <p className="text-blue-400 text-sm font-medium">Checking your location…</p>
          <p className="text-blue-400/60 text-xs mt-0.5">Please allow location access when prompted</p>
        </div>
      </div>
    );

  if (status === 'success')
    return (
      <div className="flex items-center gap-3 px-4 py-3 bg-green-500/10 border border-green-500/30 rounded-xl">
        <span className="text-xl shrink-0">✅</span>
        <div>
          <p className="text-green-400 text-sm font-medium">You are at the office</p>
          <p className="text-green-400/60 text-xs mt-0.5">
            {distance !== null ? `${Math.round(distance)}m from office` : ''}
            {accuracy !== null ? ` · GPS accuracy ±${Math.round(accuracy)}m` : ''}
          </p>
        </div>
      </div>
    );

  if (status === 'outside' || status === 'denied' || status === 'timeout' ||
      status === 'unavailable' || status === 'error')
    return (
      <div className="flex items-start gap-3 px-4 py-3 bg-red-500/10 border border-red-500/30 rounded-xl">
        <span className="text-xl shrink-0 mt-0.5">📍</span>
        <div className="flex-1">
          <p className="text-red-400 text-sm font-medium">
            {status === 'denied' ? 'Location permission denied' : 'Location check failed'}
          </p>
          <p className="text-red-400/70 text-xs mt-0.5">{errorMessage}</p>
        </div>
        <button onClick={onRetry} className="shrink-0 text-xs text-red-400 hover:text-red-300 underline">
          Retry
        </button>
      </div>
    );

  return null;
}

// ── Main Page ──────────────────────────────────────────────────────────────────
export const SupportPage = () => {
  const [logs,    setLogs]    = useState<SupportLog[]>([]);
  const [users,   setUsers]   = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form,    setForm]    = useState<CreateSupportDto>(defaultForm);
  const [files,   setFiles]   = useState<File[]>([]);
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState('');
  const [view,    setView]    = useState<'list' | 'kanban'>('list');
  const [uploadProgress, setUploadProgress] = useState(0);
  const { confirm } = useConfirm();

  // Feature 3 — assignment state
  const [myAssignment,     setMyAssignment]     = useState<MyAssignment | null>(null);
  const [assignmentLoading, setAssignmentLoading] = useState(false);

  const geo = useGeolocation();

  const load = async () => {
    try {
      const [logsRes, usersRes] = await Promise.all([
        supportApi.getToday(),
        authApi.getUsers(),
      ]);
      setLogs(logsRes.data);
      setUsers(usersRes.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  // ── Open form: fetch assignment + request GPS ─────────────────────────────
  const handleOpenForm = async () => {
    setShowForm(true);
    setError('');

    // Fetch assignment and GPS in parallel
    setAssignmentLoading(true);
    const [assignmentRes] = await Promise.all([
      supportApi.getMyAssignment().catch(() => null),
      geo.requestLocation(),
    ]);

    if (assignmentRes?.data) {
      const assignment: MyAssignment = assignmentRes.data;
      setMyAssignment(assignment);

      // Pre-fill engineer if assigned by manager
      if (assignment.hasAssignment && assignment.supportEngineerId) {
        setForm(prev => ({
          ...prev,
          supportEngineerId:   assignment.supportEngineerId!,
          supportAssignmentId: assignment.assignmentId,
        }));
      }
    }
    setAssignmentLoading(false);
  };

  const handleRetryLocation = async () => {
    setError('');
    await geo.requestLocation();
  };

  // ── Submit ────────────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.supportEngineerId) {
      setError('Please select a support engineer.');
      return;
    }
    if (!form.supportedDeveloperId) {
      setError('Please select a developer.');
      return;
    }
    if (!geo.withinOffice || geo.latitude === null || geo.longitude === null) {
      setError('Location check required. Please allow location access and ensure you are at the office.');
      return;
    }

    setSaving(true);
    setError('');

    try {
      if (files.length > 0) {
        const formData = new FormData();
        formData.append('supportEngineerId',    form.supportEngineerId.toString());
        formData.append('supportedDeveloperId', form.supportedDeveloperId.toString());
        formData.append('issueDescription',     form.issueDescription);
        formData.append('resolution',           form.resolution ?? '');
        formData.append('timeSpentMinutes',     form.timeSpentMinutes.toString());
        formData.append('supportType',          form.supportType);
        formData.append('latitude',             geo.latitude.toString());
        formData.append('longitude',            geo.longitude.toString());
        if (form.supportAssignmentId)
          formData.append('supportAssignmentId', form.supportAssignmentId.toString());
        files.forEach((f) => formData.append('files', f));

        await supportApi.createWithMedia(formData, (percent) => setUploadProgress(percent));
      } else {
        await supportApi.create({
          ...form,
          latitude:  geo.latitude,
          longitude: geo.longitude,
        });
      }

      setForm(defaultForm);
      setFiles([]);
      setMyAssignment(null);
      setShowForm(false);
      await load();
    } catch (err: any) {
      if (err?.response?.status === 403) {
        setError(err.response.data?.message ?? 'You are not at the company location.');
      } else {
        setError('Failed to log support. Make sure you are checked in today.');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
     const ok = await confirm('This support log and any attached media will be permanently deleted.', {
      title:       'Delete Support Log?',
      confirmText: 'Yes, delete',
      danger:      true,
    });
    if (!ok) return;
    await supportApi.delete(id);
    await load();
  };

  const totalTime = useMemo(
    () => logs.reduce((sum, l) => sum + l.timeSpentMinutes, 0), [logs]
  );

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="p-6 max-w-6xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Support Logs</h1>
          <p className="text-slate-400 text-sm mt-1">
            {logs.length} logs · {Math.floor(totalTime / 60)}h {totalTime % 60}m total
          </p>
        </div>
        <div className="flex gap-3">
          <button onClick={() => setView('list')}
            className={`px-4 py-2 rounded-xl text-sm ${view === 'list' ? 'bg-violet-600 text-white' : 'bg-slate-800 text-slate-400'}`}>
            List
          </button>
          <button onClick={() => setView('kanban')}
            className={`px-4 py-2 rounded-xl text-sm ${view === 'kanban' ? 'bg-violet-600 text-white' : 'bg-slate-800 text-slate-400'}`}>
            Kanban
          </button>
          <button onClick={handleOpenForm}
            className="bg-violet-600 hover:bg-violet-500 text-white px-4 py-2 rounded-xl text-sm">
            Log Support
          </button>
        </div>
      </div>

      {/* Form */}
      {showForm && (
        <div className="bg-slate-900 border border-slate-700 rounded-2xl p-5 mb-6 space-y-4">

          {/* Location Banner */}
          <LocationBanner
            status={geo.status}
            distance={geo.distance}
            accuracy={geo.accuracy}
            errorMessage={geo.errorMessage}
            onRetry={handleRetryLocation}
          />

          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">

              {/* ── Support Engineer dropdown (Feature 2 + 3) ──────────────── */}
              <div className="col-span-2">
                {assignmentLoading ? (
                  <div className="flex items-center gap-2 px-3 py-2.5 bg-slate-800 rounded-xl text-sm text-slate-400">
                    <div className="w-3 h-3 border border-slate-500 border-t-transparent rounded-full animate-spin" />
                    Checking assignment…
                  </div>
                ) : myAssignment?.hasAssignment ? (
                  /* Manager assigned — show locked field */
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2 px-3 py-2.5 bg-violet-500/10 border border-violet-500/30 rounded-xl">
                      <span className="text-violet-400 text-sm">👨‍💻</span>
                      <div className="flex-1">
                        <p className="text-xs text-violet-400 font-medium">Assigned by manager</p>
                        <p className="text-white text-sm font-semibold">{myAssignment.supportEngineerName}</p>
                      </div>
                      <span className="text-xs text-violet-400/60 bg-violet-500/10 px-2 py-0.5 rounded-lg">Locked</span>
                    </div>
                    {myAssignment.notes && (
                      <p className="text-xs text-slate-500 px-1">Note: {myAssignment.notes}</p>
                    )}
                  </div>
                ) : (
                  /* No assignment — open dropdown */
                  <div className="flex flex-col gap-1">
                    <p className="text-xs text-slate-400 px-1">
                      ℹ️ No engineer assigned by manager — choose below
                    </p>
                    <select
                      value={form.supportEngineerId}
                      onChange={e => setForm({ ...form, supportEngineerId: parseInt(e.target.value) })}
                      className="bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2.5 text-sm w-full"
                    >
                      <option value={0}>Select support engineer…</option>
                      {users.map(u => (
                        <option key={u.id} value={u.id}>{u.fullName} — {u.role}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* ── Developer dropdown (Feature 2) ────────────────────────── */}
              <div className="col-span-2 md:col-span-1">
                <select
                  value={form.supportedDeveloperId}
                  onChange={e => setForm({ ...form, supportedDeveloperId: parseInt(e.target.value) })}
                  className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2.5 text-sm"
                >
                  <option value={0}>Select developer helped…</option>
                  {users.map(u => (
                    <option key={u.id} value={u.id}>{u.fullName} — {u.role}</option>
                  ))}
                </select>
              </div>

              {/* Support Type */}
              <div className="col-span-2 md:col-span-1">
                <select
                  value={form.supportType}
                  onChange={e => setForm({ ...form, supportType: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2.5 text-sm"
                >
                  {supportTypes.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>

              <textarea required rows={2}
                value={form.issueDescription}
                onChange={e => setForm({ ...form, issueDescription: e.target.value })}
                className="col-span-2 bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2.5 text-sm"
                placeholder="Issue description…"
              />

              <textarea rows={2}
                value={form.resolution}
                onChange={e => setForm({ ...form, resolution: e.target.value })}
                className="col-span-2 bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2.5 text-sm"
                placeholder="Resolution…"
              />

              <input type="number" min={0}
                value={form.timeSpentMinutes}
                onChange={e => setForm({ ...form, timeSpentMinutes: parseInt(e.target.value) || 0 })}
                className="bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2.5 text-sm"
                placeholder="Time spent (minutes)"
              />

              <div className="col-span-2">
                <label className="block text-xs text-slate-400 mb-2">Attach Files</label>
                <SupportFileUpload files={files} setFiles={setFiles} uploadProgress={uploadProgress} />
                {files.length > 0 && (
                  <div className="mt-3 space-y-1 text-xs text-slate-400">
                    {files.map((file, i) => (
                      <div key={i} className="flex justify-between items-center bg-slate-800 px-3 py-2 rounded-lg border border-slate-700">
                        <span className="truncate">{file.name}</span>
                        <span className="text-slate-500">{(file.size / 1024).toFixed(1)} KB</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {error && <p className="text-red-400 text-sm">{error}</p>}

            <div className="flex gap-2">
              <button type="submit" disabled={saving || !geo.withinOffice}
                title={!geo.withinOffice ? 'Location verification required' : ''}
                className="bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed text-white px-4 py-2 rounded-xl text-sm">
                {saving ? 'Saving…' : 'Save'}
              </button>
              <button type="button" onClick={() => { setShowForm(false); setMyAssignment(null); }}
                className="bg-slate-700 text-slate-300 px-4 py-2 rounded-xl text-sm">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Log cards */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : view === 'kanban' ? (
        <SupportKanbanBoard logs={logs} onDelete={handleDelete} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {logs.map((log) => (
            <div key={log.id}
              className="bg-slate-900 border border-slate-800 rounded-2xl p-5 hover:border-violet-500/40 transition-all duration-200 shadow-md">

              <div className="flex justify-between items-start mb-3">
                <div>
                  {/* Engineer → Developer header (Feature 2) */}
                  <div className="flex items-center gap-1.5 text-sm">
                    <span className="text-violet-400 font-semibold">{log.supportEngineerName}</span>
                    <span className="text-slate-500 text-xs">→ helped →</span>
                    <span className="text-white font-semibold">{log.supportedDeveloperName}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <p className="text-xs text-slate-500">{formatISTTime(log.supportedAt)}</p>
                    {/* Assignment badge (Feature 3) */}
                    {log.wasAssigned && (
                      <span className="text-[10px] bg-violet-500/20 text-violet-400 px-1.5 py-0.5 rounded-full">
                        Manager assigned
                      </span>
                    )}
                  </div>
                </div>
                <button onClick={() => handleDelete(log.id)}
                  className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition">
                  <Trash2 size={16} />
                </button>
              </div>

              <p className="text-slate-300 text-sm mb-2 line-clamp-2">{log.issueDescription}</p>

              {log.resolution && (
                <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-lg px-3 py-2 text-xs mb-3">
                  ✔ {log.resolution}
                </div>
              )}

              {log.media && log.media.length > 0 && <SupportMediaDisplay media={log.media} />}

              {log.distanceFromOfficeMetres != null && (
                <div className="mt-2 flex items-center gap-1 text-xs text-slate-600">
                  <span>📍</span>
                  <span>{Math.round(log.distanceFromOfficeMetres)}m from office</span>
                </div>
              )}

              <div className="flex justify-between items-center mt-3 text-xs">
                <span className="bg-slate-800 px-3 py-1 rounded-lg text-slate-300">
                  ⏱ {log.timeSpentMinutes} min
                </span>
                <span className="text-slate-500">{log.supportType}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};