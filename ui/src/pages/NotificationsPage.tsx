// ─────────────────────────────────────────────────────────────────────────────
//  FILE: ui/src/pages/NotificationsPage.tsx
//  Notifications Inbox - Modern Design System Upgrade
//
//  Full dedicated inbox — separate from the bell popup.
//  Logic unchanged from previous version:
//  ✅ Filter tabs: All | Unread | Read (with counts)
//  ✅ Type filter: Success | Warning | Info | Reminder
//  ✅ Mark individual as read, delete individual
//  ✅ "Mark all read" + "Clear read"
//  ✅ Click a notification with actionUrl → navigate
//  ✅ Load more (30 per page) + real-time refresh via SignalR
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { notifApi } from '../services/api';
import { useSignalR } from '../context/SignalRContext';
import { useToast } from '../context/ToastContext';
import type { AppNotification } from '../types';
import { PageHeader } from '../components/ui/PageHeader';
import { StatCard } from '../components/ui/StatCard';
import { Card } from '../components/ui/Card';
import {
  Bell,
  BellRing,
  CheckCircle2,
  AlertTriangle,
  Info,
  Clock,
  CheckCheck,
  Trash2,
  MailOpen,
  ArrowRight,
  Loader2,
  Inbox,
  PartyPopper,
  Layers,
  ChevronDown,
} from 'lucide-react';

// ─── Constants ────────────────────────────────────────────────────────────────

const PAGE_SIZE = 30;

const TYPE_META: Record<string, { icon: React.ElementType; label: string; color: string; chip: string; iconBox: string }> = {
  Success:  { icon: CheckCircle2,  label: 'Success',  color: 'text-emerald-600 dark:text-emerald-400', chip: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400', iconBox: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400' },
  Warning:  { icon: AlertTriangle, label: 'Warning',  color: 'text-amber-600 dark:text-amber-400',     chip: 'bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400',         iconBox: 'bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400' },
  Info:     { icon: Info,          label: 'Info',     color: 'text-blue-600 dark:text-blue-400',       chip: 'bg-blue-500/10 border-blue-500/30 text-blue-600 dark:text-blue-400',             iconBox: 'bg-blue-500/10 border-blue-500/20 text-blue-600 dark:text-blue-400' },
  Reminder: { icon: BellRing,      label: 'Reminder', color: 'text-violet-600 dark:text-violet-400',   chip: 'bg-violet-500/10 border-violet-500/30 text-violet-600 dark:text-violet-400',     iconBox: 'bg-violet-500/10 border-violet-500/20 text-violet-600 dark:text-violet-400' },
};

function typeOf(t: string) {
  return TYPE_META[t] ?? TYPE_META['Info'];
}

// ─── Relative time helper ─────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins  = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days  = Math.floor(diff / 86_400_000);

  if (mins  < 1)  return 'just now';
  if (mins  < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days  < 7)  return `${days}d ago`;
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ─── Single Notification Row ──────────────────────────────────────────────────

function NotifRow({
  n,
  onMarkRead,
  onDelete,
  onNavigate,
}: {
  n:          AppNotification;
  onMarkRead: (id: number) => void;
  onDelete:   (id: number) => void;
  onNavigate: (url: string) => void;
}) {
  const meta = typeOf(n.type);
  const Icon = meta.icon;

  function handleClick() {
    if (!n.isRead) onMarkRead(n.id);
    if (n.actionUrl) onNavigate(n.actionUrl);
  }

  return (
    <div
      onClick={handleClick}
      className={`group relative flex items-start gap-4 px-5 py-4 cursor-pointer transition-colors ${
        n.isRead
          ? 'hover:bg-slate-50 dark:hover:bg-slate-800/30'
          : 'bg-blue-50/60 dark:bg-blue-500/5 hover:bg-blue-50 dark:hover:bg-blue-500/10'
      }`}
    >
      {/* Unread accent bar */}
      {!n.isRead && <span className="absolute left-0 top-3 bottom-3 w-1 rounded-r-full bg-blue-500" />}

      {/* Type icon */}
      <div className={`shrink-0 w-10 h-10 rounded-xl flex items-center justify-center border ${meta.iconBox}`}>
        <Icon className="w-5 h-5" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-3">
          <p className={`text-sm leading-snug ${
            n.isRead ? 'font-medium text-slate-600 dark:text-slate-400' : 'font-bold text-slate-900 dark:text-white'
          }`}>
            {n.title}
          </p>
          <span className="inline-flex items-center gap-1 text-[11px] text-slate-400 dark:text-slate-500 shrink-0 mt-0.5">
            <Clock className="w-3 h-3" /> {relativeTime(n.createdAt)}
          </span>
        </div>

        <p className={`text-sm mt-1 leading-relaxed ${
          n.isRead ? 'text-slate-500 dark:text-slate-500' : 'text-slate-700 dark:text-slate-300'
        }`}>
          {n.message}
        </p>

        <div className="flex items-center gap-3 mt-2">
          <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full border ${meta.chip}`}>
            {meta.label}
          </span>
          {n.actionUrl && (
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 dark:text-blue-400">
              View details <ArrowRight className="w-3 h-3" />
            </span>
          )}
        </div>
      </div>

      {/* Actions — always visible on mobile, on hover for larger screens */}
      <div className="shrink-0 flex items-center gap-1 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
        {!n.isRead && (
          <button
            onClick={e => { e.stopPropagation(); onMarkRead(n.id); }}
            title="Mark as read"
            className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-500/10 transition-colors"
          >
            <MailOpen className="w-4 h-4" />
          </button>
        )}
        <button
          onClick={e => { e.stopPropagation(); onDelete(n.id); }}
          title="Delete notification"
          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// ─── Skeleton loader ──────────────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <div className="flex items-start gap-4 px-5 py-4 animate-pulse">
      <div className="w-10 h-10 rounded-xl bg-slate-200 dark:bg-slate-800 shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="h-3.5 bg-slate-200 dark:bg-slate-800 rounded w-2/5" />
        <div className="h-3 bg-slate-200 dark:bg-slate-800 rounded w-4/5" />
        <div className="h-2.5 bg-slate-200 dark:bg-slate-800 rounded w-1/4" />
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

type ReadFilter = 'all' | 'unread' | 'read';
type TypeFilter = 'all' | 'Success' | 'Warning' | 'Info' | 'Reminder';

export function NotificationsPage() {
  const qc       = useQueryClient();
  const navigate = useNavigate();
  const { toast }    = useToast();
  const { onEvent }  = useSignalR();

  const [readFilter, setReadFilter] = useState<ReadFilter>('all');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');

  // ── Data — infinite query for load-more ───────────────────────────────────
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
  } = useInfiniteQuery({
    queryKey: ['inbox-notifs', readFilter],
    queryFn: ({ pageParam = 0 }) =>
      notifApi.getPaged(
        pageParam,
        PAGE_SIZE,
        readFilter === 'unread'
      ).then(r => r.data),
    getNextPageParam: (lastPage: AppNotification[], allPages: AppNotification[][]) =>
      lastPage.length === PAGE_SIZE ? allPages.flat().length : undefined,
    initialPageParam: 0,
  });

  // Flatten all pages into one list then apply client-side filters
  const allItems: AppNotification[] = (data?.pages ?? []).flat();

  const filtered = allItems.filter(n => {
    if (readFilter === 'read'   && !n.isRead)  return false;
    if (readFilter === 'unread' && n.isRead)   return false;
    if (typeFilter !== 'all'   && n.type !== typeFilter) return false;
    return true;
  });

  // ── Unread count ─────────────────────────────────────────────────────────
  const { data: countData } = useQuery({
    queryKey: ['notifCount'],
    queryFn:  () => notifApi.getCount().then(r => r.data.count as number),
    refetchInterval: 30_000,
  });
  const unreadCount = countData ?? 0;

  // ── Real-time: new notification arrives → refresh ─────────────────────────
  useEffect(() => {
    const off = onEvent('ReceiveNotification', () => {
      qc.invalidateQueries({ queryKey: ['inbox-notifs'] });
      qc.invalidateQueries({ queryKey: ['notifCount'] });
    });
    return () => off();
  }, [onEvent, qc]);

  // ── Mutations ─────────────────────────────────────────────────────────────

  const invalidate = useCallback(() => {
    qc.invalidateQueries({ queryKey: ['inbox-notifs'] });
    qc.invalidateQueries({ queryKey: ['notifCount'] });
    qc.invalidateQueries({ queryKey: ['notifications'] }); // also refresh bell
  }, [qc]);

  const markRead = useMutation({
    mutationFn: (id: number) => notifApi.markRead(id),
    onSuccess: invalidate,
  });

  const deleteOne = useMutation({
    mutationFn: (id: number) => notifApi.deleteOne(id),
    onSuccess: () => {
      invalidate();
      toast.success('Notification deleted.');
    },
  });

  const markAll = useMutation({
    mutationFn: () => notifApi.markAllRead(),
    onSuccess: () => {
      invalidate();
      toast.success('All notifications marked as read.');
    },
  });

  const clearRead = useMutation({
    mutationFn: () => notifApi.clearRead(),
    onSuccess: (res) => {
      invalidate();
      const count = (res.data as any)?.deleted ?? 0;
      toast.success(`${count} read notification${count !== 1 ? 's' : ''} cleared.`);
    },
  });

  // ── Navigate to actionUrl ─────────────────────────────────────────────────

  function handleNavigate(url: string) {
    if (url.startsWith('/')) navigate(url);
    else window.open(url, '_blank');
  }

  const readCount = allItems.filter(n => n.isRead).length;

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto space-y-6">

      {/* ── Page Header ── */}
      <PageHeader
        title="Notifications"
        description="Your full notification history — updates from all features in one place."
        breadcrumbs={[
          { label: 'Workspace', href: '/' },
          { label: 'Notifications' },
        ]}
        badge={unreadCount > 0
          ? { label: `${unreadCount} unread`, variant: 'rose', icon: <Bell className="w-3 h-3" /> }
          : { label: 'All caught up', variant: 'emerald', icon: <CheckCheck className="w-3 h-3" /> }}
        actions={
          <>
            <button
              onClick={() => markAll.mutate()}
              disabled={markAll.isPending || unreadCount === 0}
              className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-500/20 transition disabled:opacity-40 disabled:shadow-none disabled:cursor-not-allowed"
            >
              {markAll.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCheck className="w-4 h-4" />}
              Mark all read
            </button>
            <button
              onClick={() => clearRead.mutate()}
              disabled={clearRead.isPending || readCount === 0}
              className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 hover:border-rose-500/30 transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {clearRead.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              Clear read
            </button>
          </>
        }
        className="!mb-0"
      />

      {/* ── Stats ── */}
      <div className="grid grid-cols-3 gap-4">
        <StatCard title="Loaded" value={allItems.length} icon={Layers}    color="blue"    loading={isLoading} />
        <StatCard title="Unread" value={unreadCount}     icon={Bell}      color="rose"    loading={isLoading} />
        <StatCard title="Read"   value={readCount}       icon={MailOpen}  color="emerald" loading={isLoading} />
      </div>

      {/* ── Filters ── */}
      <div className="flex flex-col lg:flex-row lg:items-center gap-3">
        <div className="inline-flex p-1 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-fit">
          {([
            { key: 'all',    label: 'All',    count: allItems.length },
            { key: 'unread', label: 'Unread', count: unreadCount },
            { key: 'read',   label: 'Read',   count: readCount },
          ] as { key: ReadFilter; label: string; count: number }[]).map(tab => (
            <button
              key={tab.key}
              onClick={() => setReadFilter(tab.key)}
              className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition ${
                readFilter === tab.key
                  ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {tab.label}
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                readFilter === tab.key ? 'bg-blue-500/10' : 'bg-slate-200 dark:bg-slate-800'
              }`}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        <div className="flex gap-1.5 flex-wrap">
          <button
            onClick={() => setTypeFilter('all')}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition ${
              typeFilter === 'all'
                ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-transparent'
                : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-600'
            }`}
          >
            All Types
          </button>
          {Object.entries(TYPE_META).map(([key, meta]) => {
            const Icon = meta.icon;
            return (
              <button
                key={key}
                onClick={() => setTypeFilter(key as TypeFilter)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition ${
                  typeFilter === key
                    ? meta.chip
                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-600'
                }`}
              >
                <Icon className="w-3.5 h-3.5" /> {meta.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Notification list ── */}
      <Card className="overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/60 dark:bg-slate-800/30">
          <p className="text-xs font-semibold text-slate-600 dark:text-slate-400">
            {filtered.length} notification{filtered.length !== 1 ? 's' : ''}
            {typeFilter !== 'all' ? ` · ${typeFilter}` : ''}
          </p>
          {filtered.length > 0 && (
            <p className="hidden sm:block text-[11px] text-slate-400 dark:text-slate-500">Hover a row to mark read or delete</p>
          )}
        </div>

        {isLoading && (
          <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
            {[...Array(6)].map((_, i) => <SkeletonRow key={i} />)}
          </div>
        )}

        {!isLoading && filtered.length === 0 && (
          <div className="text-center py-16 px-4">
            <div className={`w-14 h-14 mx-auto rounded-2xl flex items-center justify-center border ${
              readFilter === 'unread'
                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500'
                : 'bg-slate-500/10 border-slate-500/20 text-slate-400'
            }`}>
              {readFilter === 'unread' ? <PartyPopper className="w-7 h-7" /> : <Inbox className="w-7 h-7" />}
            </div>
            <p className="text-base font-bold text-slate-900 dark:text-white mt-3">
              {readFilter === 'unread'
                ? 'All caught up! No unread notifications.'
                : readFilter === 'read'
                ? 'No read notifications.'
                : typeFilter !== 'all'
                ? `No ${typeFilter.toLowerCase()} notifications.`
                : 'No notifications yet.'}
            </p>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Notifications from leave, WFH, reviews, training, and all other features appear here.
            </p>
          </div>
        )}

        {!isLoading && filtered.length > 0 && (
          <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
            {filtered.map(n => (
              <NotifRow
                key={n.id}
                n={n}
                onMarkRead={id => markRead.mutate(id)}
                onDelete={id => deleteOne.mutate(id)}
                onNavigate={handleNavigate}
              />
            ))}
          </div>
        )}

        {hasNextPage && (
          <div className="px-5 py-4 border-t border-slate-100 dark:border-slate-800 text-center">
            <button
              onClick={() => fetchNextPage()}
              disabled={isFetchingNextPage}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition disabled:opacity-40"
            >
              {isFetchingNextPage ? <Loader2 className="w-4 h-4 animate-spin" /> : <ChevronDown className="w-4 h-4" />}
              {isFetchingNextPage ? 'Loading…' : 'Load more'}
            </button>
          </div>
        )}

        {!isLoading && !hasNextPage && filtered.length > 0 && (
          <div className="px-5 py-3 border-t border-slate-100 dark:border-slate-800 text-center">
            <p className="text-[11px] text-slate-400 dark:text-slate-500">— End of notifications —</p>
          </div>
        )}
      </Card>
    </div>
  );
}