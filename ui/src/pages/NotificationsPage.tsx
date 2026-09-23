// ─────────────────────────────────────────────────────────────────────────────
//  FILE 4:  frontend/src/pages/NotificationsPage.tsx
//  ACTION:  CREATE as a new file
//
//  This is the full dedicated inbox — completely separate from the bell popup.
//  The bell popup still works exactly as before (quick glance, max 50).
//  This page is for reading, filtering, and managing ALL notifications.
//
//  Features:
//  • Filter tabs: All | Unread | Read (shows count on each)
//  • Type filter: All Types | ✅ Success | ⚠️ Warning | ℹ️ Info | 🔔 Reminder
//  • Mark individual as read / unread
//  • Delete individual notification
//  • "Mark all read" button
//  • "Clear all read" button (removes read ones permanently)
//  • Clicking a notification with actionUrl navigates to that route
//  • Infinite scroll via "Load more" button (30 per page)
//  • Real-time: new notifications appear at top via SignalR
//  • Empty states per filter tab
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { notifApi } from '../services/api';
import { useSignalR } from '../context/SignalRContext';
import { useToast } from '../context/ToastContext';
import type { AppNotification } from '../types';

// ─── Constants ────────────────────────────────────────────────────────────────

const PAGE_SIZE = 30;

const TYPE_META: Record<string, { icon: string; label: string; color: string; bg: string; border: string }> = {
  Success:  { icon: '✅', label: 'Success',  color: 'text-green-400',  bg: 'bg-green-500/10',  border: 'border-green-500/30' },
  Warning:  { icon: '⚠️', label: 'Warning',  color: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/30' },
  Info:     { icon: 'ℹ️', label: 'Info',     color: 'text-blue-400',   bg: 'bg-blue-500/10',   border: 'border-blue-500/30' },
  Reminder: { icon: '🔔', label: 'Reminder', color: 'text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-500/30' },
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

  function handleClick() {
    if (!n.isRead) onMarkRead(n.id);
    if (n.actionUrl) onNavigate(n.actionUrl);
  }

  return (
    <div
      onClick={handleClick}
      className={`
        group relative flex items-start gap-4 px-5 py-4
        border-b border-slate-800/60 last:border-0
        transition-colors cursor-pointer
        ${n.isRead
          ? 'hover:bg-slate-800/30'
          : 'bg-slate-800/50 hover:bg-slate-800/70'
        }
      `}
    >
      {/* Unread dot */}
      {!n.isRead && (
        <div className="absolute left-2 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-blue-500" />
      )}

      {/* Type icon pill */}
      <div className={`
        shrink-0 w-10 h-10 rounded-xl flex items-center justify-center text-xl
        ${meta.bg} border ${meta.border}
      `}>
        {meta.icon}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className={`text-sm font-semibold leading-snug ${n.isRead ? 'text-slate-400' : 'text-white'}`}>
            {n.title}
          </p>
          <span className="text-xs text-slate-600 shrink-0 mt-0.5">{relativeTime(n.createdAt)}</span>
        </div>

        <p className={`text-sm mt-0.5 leading-relaxed ${n.isRead ? 'text-slate-600' : 'text-slate-400'}`}>
          {n.message}
        </p>

        <div className="flex items-center gap-3 mt-1.5">
          {/* Type badge */}
          <span className={`text-xs font-medium ${meta.color}`}>
            {meta.label}
          </span>

          {/* Action URL indicator */}
          {n.actionUrl && (
            <span className="text-xs text-slate-600 flex items-center gap-1">
              <span>→</span> View details
            </span>
          )}
        </div>
      </div>

      {/* Action buttons — visible on hover */}
      <div className="shrink-0 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {/* Mark read/unread toggle */}
        <button
          onClick={e => { e.stopPropagation(); onMarkRead(n.id); }}
          title={n.isRead ? 'Already read' : 'Mark as read'}
          className="p-1.5 rounded-lg text-slate-500 hover:text-blue-400 hover:bg-slate-800 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d={n.isRead
                ? 'M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z'
                : 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z'
              }
            />
          </svg>
        </button>

        {/* Delete */}
        <button
          onClick={e => { e.stopPropagation(); onDelete(n.id); }}
          title="Delete notification"
          className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-slate-800 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>
    </div>
  );
}

// ─── Skeleton loader ──────────────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <div className="flex items-start gap-4 px-5 py-4 border-b border-slate-800/60 animate-pulse">
      <div className="w-10 h-10 rounded-xl bg-slate-800 shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="h-3.5 bg-slate-800 rounded w-2/5" />
        <div className="h-3 bg-slate-800 rounded w-4/5" />
        <div className="h-2.5 bg-slate-800 rounded w-1/4" />
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

  // ── Data — use infinite query for load-more ───────────────────────────────
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

  // ── Unread count for badge on tab ────────────────────────────────────────
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

  // ── Count helpers for filter tabs ─────────────────────────────────────────
  const readCount = allItems.filter(n => n.isRead).length;

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            🔔 Notifications
            {unreadCount > 0 && (
              <span className="text-sm font-bold bg-red-500 text-white px-2 py-0.5 rounded-full">
                {unreadCount}
              </span>
            )}
          </h1>
          <p className="text-slate-400 text-sm mt-0.5">
            Your full notification history — updates from all features in one place
          </p>
        </div>

        {/* Bulk action buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => markAll.mutate()}
            disabled={markAll.isPending || unreadCount === 0}
            className="px-3 py-1.5 text-xs font-medium text-blue-400 border border-blue-500/30 bg-blue-500/10 rounded-lg hover:bg-blue-500/20 transition-colors disabled:opacity-40"
          >
            {markAll.isPending ? '…' : '✓ Mark all read'}
          </button>
          <button
            onClick={() => clearRead.mutate()}
            disabled={clearRead.isPending || readCount === 0}
            className="px-3 py-1.5 text-xs font-medium text-red-400 border border-red-500/30 bg-red-500/10 rounded-lg hover:bg-red-500/20 transition-colors disabled:opacity-40"
          >
            {clearRead.isPending ? '…' : '🗑 Clear read'}
          </button>
        </div>
      </div>

      {/* ── Filters row ─────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row gap-3">

        {/* Read/unread tabs */}
        <div className="flex bg-slate-900 border border-slate-800 rounded-xl p-1 w-fit">
          {([
            { key: 'all',    label: `All (${allItems.length})` },
            { key: 'unread', label: `Unread (${unreadCount})` },
            { key: 'read',   label: `Read (${readCount})` },
          ] as { key: ReadFilter; label: string }[]).map(tab => (
            <button
              key={tab.key}
              onClick={() => setReadFilter(tab.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                readFilter === tab.key
                  ? 'bg-slate-700 text-white shadow'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Type filter pills */}
        <div className="flex gap-1.5 flex-wrap">
          <button
            onClick={() => setTypeFilter('all')}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${
              typeFilter === 'all'
                ? 'bg-slate-700 border-slate-600 text-white'
                : 'bg-transparent border-slate-800 text-slate-500 hover:border-slate-600'
            }`}
          >
            All Types
          </button>
          {(Object.entries(TYPE_META) as [string, typeof TYPE_META[string]][]).map(([key, meta]) => (
            <button
              key={key}
              onClick={() => setTypeFilter(key as TypeFilter)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${
                typeFilter === key
                  ? `${meta.bg} ${meta.border} ${meta.color}`
                  : 'bg-transparent border-slate-800 text-slate-500 hover:border-slate-600'
              }`}
            >
              {meta.icon} {meta.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Notification list ────────────────────────────────────────────────── */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">

        {/* Column headers */}
        <div className="px-5 py-3 border-b border-slate-800 flex items-center justify-between">
          <p className="text-slate-500 text-xs font-medium">
            {filtered.length} notification{filtered.length !== 1 ? 's' : ''}
            {typeFilter !== 'all' ? ` · ${typeFilter}` : ''}
          </p>
          {filtered.length > 0 && (
            <p className="text-slate-600 text-xs">Hover a row to dismiss or delete</p>
          )}
        </div>

        {/* Loading skeleton */}
        {isLoading && (
          <div>
            {[...Array(6)].map((_, i) => <SkeletonRow key={i} />)}
          </div>
        )}

        {/* Empty state */}
        {!isLoading && filtered.length === 0 && (
          <div className="text-center py-20 space-y-3">
            <p className="text-5xl">
              {readFilter === 'unread' ? '🎉' : '📭'}
            </p>
            <p className="text-slate-400 font-medium">
              {readFilter === 'unread'
                ? 'All caught up! No unread notifications.'
                : readFilter === 'read'
                ? 'No read notifications.'
                : typeFilter !== 'all'
                ? `No ${typeFilter.toLowerCase()} notifications.`
                : 'No notifications yet.'}
            </p>
            <p className="text-slate-600 text-sm">
              Notifications from leave, WFH, reviews, training, and all other features appear here.
            </p>
          </div>
        )}

        {/* Notification rows */}
        {!isLoading && filtered.map(n => (
          <NotifRow
            key={n.id}
            n={n}
            onMarkRead={id => markRead.mutate(id)}
            onDelete={id => deleteOne.mutate(id)}
            onNavigate={handleNavigate}
          />
        ))}

        {/* Load more */}
        {hasNextPage && (
          <div className="px-5 py-4 border-t border-slate-800 text-center">
            <button
              onClick={() => fetchNextPage()}
              disabled={isFetchingNextPage}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-sm font-medium transition-colors disabled:opacity-40"
            >
              {isFetchingNextPage ? 'Loading…' : 'Load more'}
            </button>
          </div>
        )}

        {/* All loaded indicator */}
        {!isLoading && !hasNextPage && filtered.length > 0 && (
          <div className="px-5 py-3 border-t border-slate-800/50 text-center">
            <p className="text-slate-700 text-xs">— End of notifications —</p>
          </div>
        )}
      </div>

      {/* ── Legend ────────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-4 pb-2">
        {Object.entries(TYPE_META).map(([key, meta]) => (
          <div key={key} className="flex items-center gap-1.5 text-xs text-slate-600">
            <span>{meta.icon}</span>
            <span>{meta.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}