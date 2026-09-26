// ─────────────────────────────────────────────────────────────────────────────
//  FILE: ui/src/pages/Supportpage.tsx
//  Support Logs - Modern Design System Upgrade
//
//  Logic unchanged from previous version:
//  ✅ Two dropdowns — Support Engineer + Developer (both required)
//  ✅ On form open, calls GET /support/my-assignment
//       Assignment found  → engineer locked to "Assigned by manager"
//       No assignment     → open "Choose support engineer" dropdown
//  ✅ Location validation (useGeolocation) — must be at office to save
//  ✅ File upload with progress (createWithMedia) + delete with confirm
//  ✅ List / Kanban views
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useMemo } from 'react';
import { supportApi, authApi } from '../services/api';
import type { SupportLog, User, CreateSupportDto, MyAssignment } from '../types';
import { SupportMediaDisplay } from '../components/SupportMediaDisplay';
import { SupportKanbanBoard } from './SupportKanbanBoard';
import { SupportFileUpload } from '../components/SupportFileUpload';
import { useGeolocation } from '../context/useGeolocation';
import { useConfirm } from '../hooks/useConfirm';
import { PageHeader } from '../components/ui/PageHeader';
import { StatCard } from '../components/ui/StatCard';
import { Card, CardContent } from '../components/ui/Card';
import {
  Trash2,
  Plus,
  X,
  LifeBuoy,
  Clock,
  Timer,
  Users,
  UserCheck,
  LayoutGrid,
  Columns3,
  MapPin,
  CheckCircle2,
  Loader2,
  RefreshCw,
  Lock,
  Info,
  ChevronDown,
  ArrowRight,
  AlertCircle,
  Paperclip,
  Save,
  FileText,
  Wrench,
  Code2,
  Bug,
  Rocket,
  HelpCircle,
} from 'lucide-react';

const supportTypes = ['Technical', 'CodeReview', 'Debugging', 'Deployment', 'Other'];

const SUPPORT_TYPE_STYLE: Record<string, { icon: React.ElementType; cls: string; label: string }> = {
  Technical:  { icon: Wrench,     label: 'Technical',   cls: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20' },
  CodeReview: { icon: Code2,      label: 'Code Review', cls: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20' },
  Debugging:  { icon: Bug,        label: 'Debugging',   cls: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20' },
  Deployment: { icon: Rocket,     label: 'Deployment',  cls: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' },
  Other:      { icon: HelpCircle, label: 'Other',       cls: 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20' },
};

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

// ─── Location Status Banner ───────────────────────────────────────────────────

function LocationBanner({ status, distance, accuracy, errorMessage, onRetry }: {
  status: string; distance: number | null; accuracy: number | null;
  errorMessage: string; onRetry: () => void;
}) {
  if (status === 'requesting')
    return (
      <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-blue-500/10 border border-blue-500/20">
        <Loader2 className="w-4 h-4 text-blue-600 dark:text-blue-400 animate-spin shrink-0" />
        <div>
          <p className="text-sm font-semibold text-blue-700 dark:text-blue-300">Checking your location…</p>
          <p className="text-xs text-blue-600/80 dark:text-blue-400/70 mt-0.5">Please allow location access when prompted</p>
        </div>
      </div>
    );

  if (status === 'success')
    return (
      <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20">
        <div className="p-1.5 rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 shrink-0">
          <CheckCircle2 className="w-4 h-4" />
        </div>
        <div>
          <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">You are at the office</p>
          <p className="text-xs text-emerald-600/80 dark:text-emerald-400/70 mt-0.5">
            {distance !== null ? `${Math.round(distance)}m from office` : ''}
            {accuracy !== null ? ` · GPS accuracy ±${Math.round(accuracy)}m` : ''}
          </p>
        </div>
      </div>
    );

  if (status === 'outside' || status === 'denied' || status === 'timeout' ||
      status === 'unavailable' || status === 'error')
    return (
      <div className="flex items-start gap-3 px-4 py-3 rounded-2xl bg-rose-500/10 border border-rose-500/20">
        <div className="p-1.5 rounded-lg bg-rose-500/15 text-rose-600 dark:text-rose-400 shrink-0">
          <MapPin className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-rose-700 dark:text-rose-300">
            {status === 'denied' ? 'Location permission denied' : 'Location check failed'}
          </p>
          <p className="text-xs text-rose-600/90 dark:text-rose-400/80 mt-0.5">{errorMessage}</p>
        </div>
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex items-center gap-1.5 shrink-0 text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/20 transition"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Retry
        </button>
      </div>
    );

  return null;
}

// ─── Main Page ────────────────────────────────────────────────────────────────

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

  // Assignment state
  const [myAssignment,      setMyAssignment]      = useState<MyAssignment | null>(null);
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

  const handleCancelForm = () => {
    setShowForm(false);
    setMyAssignment(null);
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
  const developersHelped = useMemo(
    () => new Set(logs.map(l => l.supportedDeveloperName)).size, [logs]
  );
  const assignedCount = logs.filter(l => l.wasAssigned).length;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">

      {/* ── Page Header ── */}
      <PageHeader
        title="Support Logs"
        description="Log the help you give teammates — debugging, code reviews, deployments and more."
        breadcrumbs={[
          { label: 'Workspace', href: '/' },
          { label: 'Work' },
          { label: 'Support Logs' },
        ]}
        badge={{ label: 'Today', variant: 'purple', icon: <LifeBuoy className="w-3 h-3" /> }}
        actions={
          <>
            {/* View toggle */}
            <div className="inline-flex p-1 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              {([
                { k: 'list',   l: 'List',   i: LayoutGrid },
                { k: 'kanban', l: 'Kanban', i: Columns3 },
              ] as const).map(v => {
                const Icon = v.i;
                return (
                  <button
                    key={v.k}
                    type="button"
                    onClick={() => setView(v.k)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition ${
                      view === v.k
                        ? 'bg-white dark:bg-slate-800 text-violet-600 dark:text-violet-400 shadow-sm'
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {v.l}
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={showForm ? handleCancelForm : handleOpenForm}
              className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition cursor-pointer ${
                showForm
                  ? 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700'
                  : 'bg-violet-600 hover:bg-violet-500 text-white shadow-md shadow-violet-500/20'
              }`}
            >
              {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
              {showForm ? 'Cancel' : 'Log Support'}
            </button>
          </>
        }
        className="!mb-0"
      />

      {/* ── Stats ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Logs Today"        value={logs.length}                                         icon={LifeBuoy}  color="purple"  loading={loading} />
        <StatCard title="Time Spent"        value={`${Math.floor(totalTime / 60)}h ${totalTime % 60}m`} icon={Timer}     color="blue"    loading={loading} />
        <StatCard title="Developers Helped" value={developersHelped}                                    icon={Users}     color="emerald" loading={loading} />
        <StatCard title="Manager Assigned"  value={assignedCount}                                       icon={UserCheck} color="amber"   loading={loading} />
      </div>

      {/* ── Form ── */}
      {showForm && (
        <Card className="relative overflow-hidden">
          <div className="absolute -top-20 -right-20 w-56 h-56 bg-gradient-to-br from-violet-500/15 to-transparent rounded-full blur-2xl pointer-events-none" />
          <CardContent className="relative z-10 space-y-5">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-violet-500/10 text-violet-600 dark:text-violet-400 border border-violet-500/20">
                <FileText className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">New Support Log</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">You must be at the office to save a log</p>
              </div>
            </div>

            <LocationBanner
              status={geo.status}
              distance={geo.distance}
              accuracy={geo.accuracy}
              errorMessage={geo.errorMessage}
              onRetry={handleRetryLocation}
            />

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                {/* ── Support Engineer ── */}
                <div className="md:col-span-2">
                  <label className={LABEL_CLS}>Support Engineer <span className="text-rose-500">*</span></label>
                  {assignmentLoading ? (
                    <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-sm text-slate-500 dark:text-slate-400">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Checking assignment…
                    </div>
                  ) : myAssignment?.hasAssignment ? (
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl bg-violet-500/10 border border-violet-500/30">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center text-xs font-bold text-white shrink-0">
                          {myAssignment.supportEngineerName?.charAt(0)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] font-semibold text-violet-600 dark:text-violet-400">Assigned by manager</p>
                          <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{myAssignment.supportEngineerName}</p>
                        </div>
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-violet-600 dark:text-violet-400 bg-violet-500/10 border border-violet-500/20 px-2 py-0.5 rounded-full shrink-0">
                          <Lock className="w-3 h-3" /> Locked
                        </span>
                      </div>
                      {myAssignment.notes && (
                        <p className="text-xs text-slate-500 dark:text-slate-400 px-1">Note: {myAssignment.notes}</p>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      <Select
                        value={form.supportEngineerId}
                        onChange={e => setForm({ ...form, supportEngineerId: parseInt(e.target.value) })}
                      >
                        <option value={0}>Select support engineer…</option>
                        {users.map(u => (
                          <option key={u.id} value={u.id}>{u.fullName} — {u.role}</option>
                        ))}
                      </Select>
                      <p className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400 px-1">
                        <Info className="w-3.5 h-3.5" /> No engineer assigned by manager — choose one above
                      </p>
                    </div>
                  )}
                </div>

                {/* ── Developer ── */}
                <div>
                  <label className={LABEL_CLS}>Developer Helped <span className="text-rose-500">*</span></label>
                  <Select
                    value={form.supportedDeveloperId}
                    onChange={e => setForm({ ...form, supportedDeveloperId: parseInt(e.target.value) })}
                  >
                    <option value={0}>Select developer helped…</option>
                    {users.map(u => (
                      <option key={u.id} value={u.id}>{u.fullName} — {u.role}</option>
                    ))}
                  </Select>
                </div>

                {/* ── Support Type ── */}
                <div>
                  <label className={LABEL_CLS}>Support Type</label>
                  <Select
                    value={form.supportType}
                    onChange={e => setForm({ ...form, supportType: e.target.value })}
                  >
                    {supportTypes.map(t => (
                      <option key={t} value={t}>{SUPPORT_TYPE_STYLE[t]?.label ?? t}</option>
                    ))}
                  </Select>
                </div>

                {/* ── Issue ── */}
                <div className="md:col-span-2">
                  <label className={LABEL_CLS}>Issue Description <span className="text-rose-500">*</span></label>
                  <textarea
                    required rows={3}
                    value={form.issueDescription}
                    onChange={e => setForm({ ...form, issueDescription: e.target.value })}
                    className={`${INPUT_CLS} resize-none`}
                    placeholder="What was the problem?"
                  />
                </div>

                {/* ── Resolution ── */}
                <div className="md:col-span-2">
                  <label className={LABEL_CLS}>Resolution</label>
                  <textarea
                    rows={2}
                    value={form.resolution}
                    onChange={e => setForm({ ...form, resolution: e.target.value })}
                    className={`${INPUT_CLS} resize-none`}
                    placeholder="How was it solved?"
                  />
                </div>

                {/* ── Time Spent ── */}
                <div>
                  <label className={LABEL_CLS}>Time Spent (minutes)</label>
                  <div className="relative">
                    <Clock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="number" min={0}
                      value={form.timeSpentMinutes}
                      onChange={e => setForm({ ...form, timeSpentMinutes: parseInt(e.target.value) || 0 })}
                      className={`${INPUT_CLS} pl-10`}
                      placeholder="0"
                    />
                  </div>
                </div>

                {/* ── Attachments ── */}
                <div className="md:col-span-2">
                  <label className={`${LABEL_CLS} flex items-center gap-1.5`}>
                    <Paperclip className="w-3.5 h-3.5" /> Attach Files
                  </label>
                  <SupportFileUpload files={files} setFiles={setFiles} uploadProgress={uploadProgress} />
                </div>
              </div>

              {error && (
                <div className="flex items-start gap-2 px-3.5 py-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20">
                  <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                  <p className="text-sm text-rose-700 dark:text-rose-300">{error}</p>
                </div>
              )}

              <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={handleCancelForm}
                  className="px-4 py-2.5 rounded-xl text-sm font-semibold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving || !geo.withinOffice}
                  title={!geo.withinOffice ? 'Location verification required' : ''}
                  className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-violet-600 hover:bg-violet-500 text-white shadow-md shadow-violet-500/20 transition disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  {saving ? 'Saving…' : 'Save Log'}
                </button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* ── Logs ── */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-48 rounded-2xl bg-slate-100 dark:bg-slate-800/60 animate-pulse" />
          ))}
        </div>
      ) : view === 'kanban' ? (
        <SupportKanbanBoard logs={logs} onDelete={handleDelete} />
      ) : logs.length === 0 ? (
        <div className="text-center py-14 px-4 rounded-3xl border-2 border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
            <LifeBuoy className="w-7 h-7 text-violet-500" />
          </div>
          <p className="text-base font-bold text-slate-900 dark:text-white mt-3">No support logged today</p>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Helped a teammate? Click <span className="font-semibold text-violet-600 dark:text-violet-400">Log Support</span> to record it.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {logs.map((log) => {
            const st = SUPPORT_TYPE_STYLE[log.supportType] ?? SUPPORT_TYPE_STYLE.Other;
            const TypeIcon = st.icon;
            return (
              <Card key={log.id} hover className="p-5 flex flex-col">
                {/* Engineer → Developer */}
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="flex -space-x-2 shrink-0">
                      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center text-xs font-bold text-white ring-2 ring-white dark:ring-slate-900" title={log.supportEngineerName}>
                        {log.supportEngineerName.charAt(0)}
                      </div>
                      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-xs font-bold text-white ring-2 ring-white dark:ring-slate-900" title={log.supportedDeveloperName}>
                        {log.supportedDeveloperName.charAt(0)}
                      </div>
                    </div>
                    <div className="min-w-0">
                      <p className="flex items-center gap-1.5 text-sm font-bold text-slate-900 dark:text-white min-w-0">
                        <span className="truncate text-violet-600 dark:text-violet-400">{log.supportEngineerName}</span>
                        <ArrowRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="truncate">{log.supportedDeveloperName}</span>
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="inline-flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                          <Clock className="w-3 h-3" /> {formatISTTime(log.supportedAt)}
                        </span>
                        {log.wasAssigned && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                            <UserCheck className="w-3 h-3" /> Manager assigned
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDelete(log.id)}
                    title="Delete log"
                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-500/10 transition shrink-0"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <p className="text-sm text-slate-700 dark:text-slate-300 line-clamp-3 mb-3">{log.issueDescription}</p>

                {log.resolution && (
                  <div className="flex items-start gap-2 px-3 py-2 mb-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                    <p className="text-xs text-emerald-700 dark:text-emerald-300">{log.resolution}</p>
                  </div>
                )}

                {log.media && log.media.length > 0 && <SupportMediaDisplay media={log.media} />}

                <div className="flex items-center justify-between gap-2 mt-auto pt-3 border-t border-slate-100 dark:border-slate-800 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold">
                      <Timer className="w-3.5 h-3.5" /> {log.timeSpentMinutes} min
                    </span>
                    {log.distanceFromOfficeMetres != null && (
                      <span className="hidden sm:inline-flex items-center gap-1 text-slate-500 dark:text-slate-400">
                        <MapPin className="w-3.5 h-3.5" /> {Math.round(log.distanceFromOfficeMetres)}m from office
                      </span>
                    )}
                  </div>
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border font-semibold ${st.cls}`}>
                    <TypeIcon className="w-3 h-3" /> {st.label}
                  </span>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};
