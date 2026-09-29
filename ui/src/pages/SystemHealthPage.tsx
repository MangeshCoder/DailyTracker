// ─────────────────────────────────────────────────────────────────────────────
//  FILE: ui/src/pages/SystemHealthPage.tsx
//  System (Manager) — Route: /manager/system
//
//  ✅ Error log: server errors (500) and API calls slower than 2 s, with who
//     hit them and when; expand a row for the technical details (Copy button
//     → paste them to the developer)
//  ✅ Backups: weekly automatic copy of the whole database in the private
//     storage bucket (newest 8 kept); "Back up now" and Download
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Activity, AlertTriangle, ChevronDown, ChevronRight, Clock, Copy, DatabaseBackup,
  Download, Loader2, RefreshCw, ShieldCheck, Trash2, Turtle,
} from 'lucide-react';
import { monitoringApi } from '../services/api';
import type { DatabaseBackupDto, ErrorLogEntry } from '../types';
import { PageHeader } from '../components/ui/PageHeader';
import { StatCard } from '../components/ui/StatCard';
import { Card, CardContent } from '../components/ui/Card';
import { useToast } from '../context/ToastContext';
import { useConfirm } from '../hooks/useConfirm';
import { apiErrorMessage } from '../utils/apiError';
import { localDate } from '../utils/date';
import { useAuth } from '../context/Authcontext';

// The API sends UTC times without a "Z"
const utc = (s: string) => new Date(/[zZ]|[+-]\d\d:\d\d$/.test(s) ? s : s + 'Z');

const formatWhen = (s: string) =>
  utc(s).toLocaleString('en-IN', {
    day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true,
  });

const timeAgo = (s?: string | null) => {
  if (!s) return 'Never';
  const mins = Math.round((Date.now() - utc(s).getTime()) / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
};

const formatSize = (bytes: number) =>
  bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;

type Tab = 'errors' | 'backups';
type KindFilter = 'All' | 'Error' | 'Slow';

export const SystemHealthPage = () => {
  const { user } = useAuth();
  if (user?.role !== 'Manager') return <Navigate to="/manager" replace />;
  return <SystemHealth />;
};

const SystemHealth = () => {
  const [tab, setTab] = useState<Tab>('errors');
  const qc = useQueryClient();
  const { toast } = useToast();

  const summary = useQuery({
    queryKey: ['monitoringSummary'],
    queryFn: () => monitoringApi.summary().then(r => r.data),
    refetchInterval: 60_000,
  });

  const backupNow = useMutation({
    mutationFn: () => monitoringApi.backupNow(),
    onSuccess: () => toast.success('Backup saved'),
    onError: (e: any) => toast.error(apiErrorMessage(e, 'Backup failed')),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['monitoringSummary'] });
      qc.invalidateQueries({ queryKey: ['backups'] });
    },
  });

  const s = summary.data;

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      <PageHeader
        title="System"
        description="Errors and slow pages your team ran into, and the weekly database backups."
        breadcrumbs={[
          { label: 'Workspace', href: '/' },
          { label: 'Management' },
          { label: 'System' },
        ]}
        badge={{ label: 'Manager Only', variant: 'purple', icon: <ShieldCheck className="w-3 h-3" /> }}
        actions={
          <button
            type="button"
            onClick={() => backupNow.mutate()}
            disabled={backupNow.isPending}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold bg-violet-600 hover:bg-violet-500 text-white shadow-md shadow-violet-500/20 transition cursor-pointer disabled:opacity-60 disabled:cursor-wait"
          >
            {backupNow.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <DatabaseBackup className="w-4 h-4" />}
            {backupNow.isPending ? 'Backing up…' : 'Back up now'}
          </button>
        }
        className="!mb-0"
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Errors (24 h)" value={s?.errors24h ?? 0} icon={AlertTriangle}
          color={s?.errors24h ? 'rose' : 'emerald'} loading={summary.isLoading}
          subtitle={s?.lastErrorAt ? `Last: ${timeAgo(s.lastErrorAt)}` : 'None recorded'}
          onClick={() => setTab('errors')}
        />
        <StatCard
          title="Slow (24 h)" value={s?.slow24h ?? 0} icon={Turtle}
          color={s?.slow24h ? 'amber' : 'emerald'} loading={summary.isLoading}
          subtitle="Requests over 2 seconds"
          onClick={() => setTab('errors')}
        />
        <StatCard
          title="Last backup" value={timeAgo(s?.lastBackup?.startedAt)} icon={DatabaseBackup}
          color={s?.lastBackup ? 'emerald' : 'amber'} loading={summary.isLoading}
          subtitle={s?.lastBackup ? `${formatSize(s.lastBackup.sizeBytes)} · ${s.lastBackup.rowCount.toLocaleString('en-IN')} rows` : 'Runs automatically within the hour'}
          onClick={() => setTab('backups')}
        />
        <StatCard
          title="Next backup" icon={Clock} color="blue" loading={summary.isLoading}
          value={s?.nextBackupDue ? utc(s.nextBackupDue).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : 'Soon'}
          subtitle="Every 7 days, newest 8 kept"
          onClick={() => setTab('backups')}
        />
      </div>

      <div className="inline-flex p-1 rounded-2xl bg-slate-100 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800">
        {([['errors', 'Error Log', Activity], ['backups', 'Backups', DatabaseBackup]] as const).map(([key, label, Icon]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition cursor-pointer ${
              tab === key
                ? 'bg-white dark:bg-slate-800 text-violet-700 dark:text-violet-300 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Icon className="w-4 h-4" /> {label}
          </button>
        ))}
      </div>

      {tab === 'errors' ? <ErrorLog /> : <Backups />}
    </div>
  );
};

// ── Error log ────────────────────────────────────────────────────────────────

const ErrorLog = () => {
  const [kind, setKind] = useState<KindFilter>('All');
  const qc = useQueryClient();
  const { toast } = useToast();
  const { confirm } = useConfirm();

  const log = useInfiniteQuery({
    queryKey: ['errorLog', kind],
    queryFn: ({ pageParam }) =>
      monitoringApi.errors(kind === 'All' ? undefined : kind, pageParam).then(r => r.data),
    initialPageParam: undefined as number | undefined,
    getNextPageParam: last => (last.hasMore ? last.items[last.items.length - 1]?.id : undefined),
  });

  const clear = useMutation({
    mutationFn: () => monitoringApi.clearErrors(),
    onSuccess: r => toast.success(`Cleared ${r.data.removed} entries`),
    onError: (e: any) => toast.error(apiErrorMessage(e, 'Could not clear the log')),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['errorLog'] });
      qc.invalidateQueries({ queryKey: ['monitoringSummary'] });
    },
  });

  const items = log.data?.pages.flatMap(p => p.items) ?? [];

  return (
    <Card>
      <CardContent className="p-0">
        <div className="flex flex-wrap items-center justify-between gap-3 p-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex gap-1.5">
            {(['All', 'Error', 'Slow'] as KindFilter[]).map(k => (
              <button
                key={k}
                type="button"
                onClick={() => setKind(k)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition cursor-pointer ${
                  kind === k
                    ? 'bg-violet-600 border-violet-600 text-white'
                    : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                {k === 'All' ? 'All' : k === 'Error' ? 'Errors' : 'Slow'}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => log.refetch()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${log.isFetching ? 'animate-spin' : ''}`} /> Refresh
            </button>
            <button
              type="button"
              disabled={items.length === 0 || clear.isPending}
              onClick={async () => {
                if (await confirm('Remove every entry from the error log?', { confirmText: 'Clear log' })) clear.mutate();
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-rose-500/30 text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Trash2 className="w-3.5 h-3.5" /> Clear log
            </button>
          </div>
        </div>

        {log.isLoading ? (
          <div className="p-10 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>
        ) : log.isError ? (
          <p className="p-6 text-sm text-rose-600 dark:text-rose-400">{apiErrorMessage(log.error, 'Could not load the error log')}</p>
        ) : items.length === 0 ? (
          <div className="p-10 text-center space-y-2">
            <ShieldCheck className="w-10 h-10 mx-auto text-emerald-500" />
            <p className="font-semibold text-slate-800 dark:text-slate-200">Nothing to report</p>
            <p className="text-sm text-slate-500 dark:text-slate-400">No errors or slow requests in the last 30 days.</p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {items.map(e => <ErrorRow key={e.id} entry={e} />)}
          </ul>
        )}

        {log.hasNextPage && (
          <div className="p-4 border-t border-slate-200 dark:border-slate-800 text-center">
            <button
              type="button"
              onClick={() => log.fetchNextPage()}
              disabled={log.isFetchingNextPage}
              className="text-sm font-semibold text-violet-600 dark:text-violet-400 hover:underline cursor-pointer"
            >
              {log.isFetchingNextPage ? 'Loading…' : 'Show older'}
            </button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

const ErrorRow = ({ entry: e }: { entry: ErrorLogEntry }) => {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const isError = e.kind === 'Error';

  const copy = async () => {
    const text = [
      `${e.kind} · ${formatWhen(e.occurredAt)} (IST)`,
      `${e.method} ${e.path} → ${e.statusCode} in ${e.durationMs} ms`,
      `User: ${e.userName ?? 'not signed in'}`,
      `Message: ${e.message}`,
      e.traceId ? `Trace: ${e.traceId}` : '',
      e.details ?? '',
    ].filter(Boolean).join('\n');
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Copied — paste it to your developer');
    } catch {
      toast.error('Could not copy');
    }
  };

  return (
    <li>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full text-left p-4 flex items-start gap-3 hover:bg-slate-50 dark:hover:bg-slate-900/40 transition cursor-pointer"
      >
        {open ? <ChevronDown className="w-4 h-4 mt-0.5 text-slate-400 shrink-0" /> : <ChevronRight className="w-4 h-4 mt-0.5 text-slate-400 shrink-0" />}
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md ${
              isError ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400' : 'bg-amber-500/10 text-amber-700 dark:text-amber-400'
            }`}>
              {isError ? `Error ${e.statusCode}` : 'Slow'}
            </span>
            <code className="text-xs font-mono text-slate-800 dark:text-slate-200 break-all">
              <span className="font-bold">{e.method}</span> {e.path}
            </code>
          </div>
          <p className="text-sm text-slate-700 dark:text-slate-300 break-words">{e.message}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {formatWhen(e.occurredAt)} · {e.userName ?? 'not signed in'} · {(e.durationMs / 1000).toFixed(1)} s
          </p>
        </div>
      </button>
      {open && (
        <div className="px-4 pb-4 pl-11 space-y-2">
          {e.details ? (
            <pre className="text-[11px] leading-relaxed font-mono whitespace-pre-wrap break-all max-h-80 overflow-auto p-3 rounded-xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300">
              {e.details}
            </pre>
          ) : (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {isError ? 'No technical details were captured.' : 'The request worked, it was just slow. If the same page keeps showing up here, tell your developer.'}
            </p>
          )}
          <button
            type="button"
            onClick={copy}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
          >
            <Copy className="w-3.5 h-3.5" /> Copy details
          </button>
        </div>
      )}
    </li>
  );
};

// ── Backups ──────────────────────────────────────────────────────────────────

const STATUS_STYLE: Record<DatabaseBackupDto['status'], string> = {
  Succeeded: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
  Failed: 'bg-rose-500/10 text-rose-600 dark:text-rose-400',
  Running: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
};

const Backups = () => {
  const { toast } = useToast();
  const [downloading, setDownloading] = useState<number | null>(null);
  const backups = useQuery({
    queryKey: ['backups'],
    queryFn: () => monitoringApi.backups().then(r => r.data),
  });

  const download = async (b: DatabaseBackupDto) => {
    setDownloading(b.id);
    try {
      const res = await monitoringApi.downloadBackup(b.id);
      const url = URL.createObjectURL(res.data as Blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `dailytracker-backup-${localDate(utc(b.startedAt))}.json.gz`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Download failed'));
    } finally {
      setDownloading(null);
    }
  };

  return (
    <Card>
      <CardContent className="p-0">
        <p className="p-4 text-sm text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
          A full copy of the database is saved to your private storage every 7 days (and whenever you press
          <strong className="text-slate-800 dark:text-slate-200"> Back up now</strong>). The newest 8 are kept.
        </p>
        {backups.isLoading ? (
          <div className="p-10 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>
        ) : backups.isError ? (
          <p className="p-6 text-sm text-rose-600 dark:text-rose-400">{apiErrorMessage(backups.error, 'Could not load backups')}</p>
        ) : !backups.data?.length ? (
          <div className="p-10 text-center space-y-2">
            <DatabaseBackup className="w-10 h-10 mx-auto text-slate-400" />
            <p className="font-semibold text-slate-800 dark:text-slate-200">No backups yet</p>
            <p className="text-sm text-slate-500 dark:text-slate-400">The first one runs automatically shortly after the server starts.</p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {backups.data.map(b => (
              <li key={b.id} className="p-4 flex flex-wrap items-center gap-3">
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-sm text-slate-900 dark:text-white">{formatWhen(b.startedAt)}</span>
                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md ${STATUS_STYLE[b.status]}`}>{b.status}</span>
                    <span className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                      {b.trigger === 'Manual' ? `Manual${b.requestedBy ? ` · ${b.requestedBy}` : ''}` : 'Weekly'}
                    </span>
                  </div>
                  {b.status === 'Succeeded' && (
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {formatSize(b.sizeBytes)} · {b.tableCount} tables · {b.rowCount.toLocaleString('en-IN')} rows
                    </p>
                  )}
                  {b.error && <p className="text-xs text-rose-600 dark:text-rose-400 break-words">{b.error}</p>}
                </div>
                {b.canDownload && (
                  <button
                    type="button"
                    onClick={() => download(b)}
                    disabled={downloading === b.id}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer disabled:opacity-60"
                  >
                    {downloading === b.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                    Download
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
};
