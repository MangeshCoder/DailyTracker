import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { announcementsApi } from '../services/api';
import { Announcement, AnnouncementsResponse, CreateAnnouncementDto } from '../types';
import { useAuth } from '../context/Authcontext';
import { useSignalR } from '../context/SignalRContext';
import { DatePicker } from '../components/DatePicker';


// ─── Category config ──────────────────────────────────────────────────────────
const CATEGORY_CONFIG: Record<string, { emoji: string; badge: string }> = {
  General: { emoji: '📢', badge: 'bg-slate-700 text-slate-300 border-slate-600' },
  Policy:  { emoji: '📋', badge: 'bg-blue-500/15 text-blue-400 border-blue-500/30' },
  Event:   { emoji: '🎉', badge: 'bg-purple-500/15 text-purple-400 border-purple-500/30' },
  Urgent:  { emoji: '🚨', badge: 'bg-red-500/15 text-red-400 border-red-500/30' },
};

// ─── Relative time helper ─────────────────────────────────────────────────────
function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1)   return 'Just now';
  if (mins < 60)  return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)   return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7)   return `${days}d ago`;
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

// ─── Single Announcement Card ─────────────────────────────────────────────────
interface CardProps {
  item: Announcement;
  isManager: boolean;
  onMarkRead: (id: number) => void;
  onTogglePin: (id: number) => void;
  onDelete: (id: number) => void;
}

const AnnouncementCard = ({ item, isManager, onMarkRead, onTogglePin, onDelete }: CardProps) => {
  const [expanded, setExpanded] = useState(false);
  const cat = CATEGORY_CONFIG[item.category] ?? CATEGORY_CONFIG.General;

  const handleClick = () => {
    if (!item.isRead) onMarkRead(item.id);
    setExpanded((v) => !v);
  };

  return (
    <div
      className={`bg-slate-900 border rounded-2xl p-5 transition-all cursor-pointer
        ${item.isRead ? 'border-slate-800' : 'border-blue-500/40 bg-slate-900/80'}
        ${item.category === 'Urgent' ? 'border-l-4 border-l-red-500' : ''}
        ${item.isPinned ? 'border-l-4 border-l-amber-400' : ''}
      `}
      onClick={handleClick}
    >
      <div className="flex items-start gap-3">
        {/* Unread dot */}
        <div className="mt-1.5 shrink-0">
          {!item.isRead ? (
            <span className="w-2.5 h-2.5 rounded-full bg-blue-500 block" />
          ) : (
            <span className="w-2.5 h-2.5 rounded-full bg-transparent block" />
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1.5">
            {item.isPinned && (
              <span className="text-xs text-amber-400 font-medium">📌 Pinned</span>
            )}
            <span className={`text-xs px-2 py-0.5 rounded-lg border font-medium ${cat.badge}`}>
              {cat.emoji} {item.category}
            </span>
          </div>

          <h3 className={`font-semibold text-sm ${item.isRead ? 'text-slate-300' : 'text-white'}`}>
            {item.title}
          </h3>

          {/* Collapsed preview */}
          {!expanded && (
            <p className="text-slate-400 text-xs mt-1 line-clamp-2">{item.content}</p>
          )}
          {/* Expanded full content */}
          {expanded && (
            <p className="text-slate-300 text-sm mt-2 whitespace-pre-wrap leading-relaxed">
              {item.content}
            </p>
          )}

          <div className="flex items-center gap-3 mt-2">
            <span className="text-slate-500 text-xs">{item.createdByName}</span>
            <span className="text-slate-600 text-xs">·</span>
            <span className="text-slate-500 text-xs">{relativeTime(item.createdAt)}</span>
            {item.expiresAt && (
              <>
                <span className="text-slate-600 text-xs">·</span>
                <span className="text-slate-500 text-xs">
                  Expires {new Date(item.expiresAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Manager actions */}
        {isManager && (
          <div
            className="flex gap-1 shrink-0"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => onTogglePin(item.id)}
              title={item.isPinned ? 'Unpin' : 'Pin'}
              className="p-1.5 rounded-lg text-slate-500 hover:text-amber-400 hover:bg-slate-800 transition-colors"
            >
              📌
            </button>
            <button
              onClick={() => onDelete(item.id)}
              title="Delete"
              className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-slate-800 transition-colors"
            >
              🗑️
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Create Modal ─────────────────────────────────────────────────────────────
interface CreateModalProps { onClose: () => void; }

const CreateModal = ({ onClose }: CreateModalProps) => {
  const qc = useQueryClient();
  const [form, setForm] = useState<CreateAnnouncementDto>({
    title:     '',
    content:   '',
    category:  'General',
    isPinned:  false,
    expiresAt: null,
  });

  const createMutation = useMutation({
    mutationFn: () => announcementsApi.create(form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['announcements'] });
      qc.invalidateQueries({ queryKey: ['announcementUnread'] });
      onClose();
    },
  });

  const handleSubmit = () => {
    if (!form.title.trim() || !form.content.trim()) return;
    createMutation.mutate();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-lg shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-white font-semibold text-lg">📢 New Announcement</h2>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-white transition-colors text-xl leading-none"
          >
            ✕
          </button>
        </div>

        <div className="space-y-4">
          {/* Title */}
          <div>
            <label className="text-slate-400 text-xs font-medium mb-1.5 block">Title *</label>
            <input
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="Announcement title…"
              className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-slate-500"
            />
          </div>

          {/* Category + Pin row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-slate-400 text-xs font-medium mb-1.5 block">Category</label>
              <select
                value={form.category}
                onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {Object.keys(CATEGORY_CONFIG).map((c) => (
                  <option key={c} value={c}>{CATEGORY_CONFIG[c].emoji} {c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-slate-400 text-xs font-medium mb-1.5 block">Expires At (optional)</label>
              {/* <input
                type="date"
                value={form.expiresAt?.slice(0, 10) ?? ''}
                onChange={(e) =>
                  setForm((f) => ({ ...f, expiresAt: e.target.value ? e.target.value + 'T00:00:00Z' : null }))
                }
                className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              /> */}
              <DatePicker value={form.expiresAt?.slice(0, 10) ?? ''}
                  onChange={v => setForm((f) => ({ ...f, expiresAt: v ? v + 'T00:00:00Z' : null }))} />
            </div>
          </div>

          {/* Content */}
          <div>
            <label className="text-slate-400 text-xs font-medium mb-1.5 block">Content *</label>
            <textarea
              value={form.content}
              onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
              placeholder="Write your announcement…"
              rows={5}
              className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-slate-500 resize-none"
            />
          </div>

          {/* Pin toggle */}
          <label className="flex items-center gap-3 cursor-pointer">
            <div
              onClick={() => setForm((f) => ({ ...f, isPinned: !f.isPinned }))}
              className={`w-10 h-5 rounded-full transition-colors relative
                ${form.isPinned ? 'bg-amber-500' : 'bg-slate-700'}`}
            >
              <span
                className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all
                  ${form.isPinned ? 'left-5' : 'left-0.5'}`}
              />
            </div>
            <span className="text-slate-300 text-sm">Pin to top</span>
          </label>
        </div>

        {/* Actions */}
        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-slate-700 text-slate-400 hover:text-white hover:border-slate-600 transition-colors text-sm font-medium"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!form.title.trim() || !form.content.trim() || createMutation.isPending}
            className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40
              disabled:cursor-not-allowed text-white text-sm font-medium transition-colors"
          >
            {createMutation.isPending ? 'Posting…' : '📢 Post Announcement'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Main AnnouncementsPage ───────────────────────────────────────────────────
export const AnnouncementsPage = () => {
  const qc = useQueryClient();
  const { user } = useAuth();
  const isManager = user?.role === 'Manager';
  const [showCreate, setShowCreate] = useState(false);
  const [filter, setFilter] = useState<string>('All');

  const { data, isLoading } = useQuery<AnnouncementsResponse>({
    queryKey: ['announcements'],
    queryFn:  () => announcementsApi.getAll().then((r) => r.data),
    refetchOnWindowFocus: true,
  });

  // ── Listen for real-time new announcements via SignalR
  // The hub already calls SendToAll("NewAnnouncement", payload), so we just
  // invalidate the query when that event fires. Wire this up wherever your
  // SignalR connection lives (e.g. in your NotificationHub listener):
  //   connection.on("NewAnnouncement", () => qc.invalidateQueries(['announcements']));

  const markReadMutation = useMutation({
    mutationFn: (id: number) => announcementsApi.markRead(id),
    onSuccess:  () => {
      qc.invalidateQueries({ queryKey: ['announcements'] });
      qc.invalidateQueries({ queryKey: ['announcementUnread'] });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: () => announcementsApi.markAllRead(),
    onSuccess:  () => {
      qc.invalidateQueries({ queryKey: ['announcements'] });
      qc.invalidateQueries({ queryKey: ['announcementUnread'] });
    },
  });

  const togglePinMutation = useMutation({
    mutationFn: (id: number) => announcementsApi.togglePin(id),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['announcements'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => announcementsApi.delete(id),
    onSuccess:  () => {
      qc.invalidateQueries({ queryKey: ['announcements'] });
      qc.invalidateQueries({ queryKey: ['announcementUnread'] });
    },
  });

  const allItems = [...(data?.pinned ?? []), ...(data?.regular ?? [])];
  const categories = ['All', ...Object.keys(CATEGORY_CONFIG)];

  const filtered = filter === 'All'
    ? allItems
    : allItems.filter((a) => a.category === filter);

  const pinnedFiltered = filtered.filter((a) => a.isPinned);
  const regularFiltered = filtered.filter((a) => !a.isPinned);

  const { onEvent } = useSignalR();

    useEffect(() => {
        const off = onEvent('NewAnnouncement', () => {
        // Refresh both queries when a new announcement is broadcast
        qc.invalidateQueries({ queryKey: ['announcements'] });
        qc.invalidateQueries({ queryKey: ['announcementUnread'] });
        });
        return off;
    }, [onEvent, qc]);

  return (
    <div className="p-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Announcements 📢</h1>
          <p className="text-slate-400 text-sm mt-1">Company-wide updates from management</p>
        </div>
        <div className="flex items-center gap-2">
          {(data?.unreadCount ?? 0) > 0 && (
            <button
              onClick={() => markAllReadMutation.mutate()}
              disabled={markAllReadMutation.isPending}
              className="text-xs text-blue-400 hover:text-blue-300 transition-colors px-3 py-1.5 rounded-lg bg-blue-500/10 border border-blue-500/20"
            >
              Mark all read
            </button>
          )}
          {isManager && (
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-4 py-2 rounded-xl transition-colors"
            >
              + Post
            </button>
          )}
        </div>
      </div>

      {/* Stats row */}
      {data && (
        <div className="flex gap-4 mb-5">
          <div className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 flex items-center gap-3">
            <span className="text-2xl font-bold text-white">{allItems.length}</span>
            <span className="text-slate-400 text-xs">Total</span>
          </div>
          {data.unreadCount > 0 && (
            <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl px-4 py-3 flex items-center gap-3">
              <span className="text-2xl font-bold text-blue-400">{data.unreadCount}</span>
              <span className="text-blue-300 text-xs">Unread</span>
            </div>
          )}
          {data.pinned.length > 0 && (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-3 flex items-center gap-3">
              <span className="text-2xl font-bold text-amber-400">{data.pinned.length}</span>
              <span className="text-amber-300 text-xs">Pinned</span>
            </div>
          )}
        </div>
      )}

      {/* Category filter chips */}
      <div className="flex flex-wrap gap-2 mb-5">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setFilter(cat)}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all border
              ${filter === cat
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white hover:border-slate-600'}`}
          >
            {cat === 'All' ? '🔘 All' : `${CATEGORY_CONFIG[cat]?.emoji} ${cat}`}
          </button>
        ))}
      </div>

      {/* Loading skeleton */}
      {isLoading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-28 bg-slate-900 border border-slate-800 rounded-2xl animate-pulse" />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && allItems.length === 0 && (
        <div className="py-20 text-center">
          <p className="text-5xl mb-4">📭</p>
          <p className="text-slate-300 font-medium">No announcements yet</p>
          <p className="text-slate-500 text-sm mt-2">
            {isManager ? 'Post the first company-wide update.' : 'Check back soon for updates from management.'}
          </p>
        </div>
      )}

      {/* Pinned section */}
      {!isLoading && pinnedFiltered.length > 0 && (
        <div className="mb-4">
          <p className="text-xs font-semibold text-amber-400 uppercase tracking-wider mb-2 px-1">
            📌 Pinned
          </p>
          <div className="space-y-3">
            {pinnedFiltered.map((item) => (
              <AnnouncementCard
                key={item.id}
                item={item}
                isManager={isManager}
                onMarkRead={(id) => markReadMutation.mutate(id)}
                onTogglePin={(id) => togglePinMutation.mutate(id)}
                onDelete={(id) => deleteMutation.mutate(id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Regular section */}
      {!isLoading && regularFiltered.length > 0 && (
        <div>
          {pinnedFiltered.length > 0 && (
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 px-1">
              Recent
            </p>
          )}
          <div className="space-y-3">
            {regularFiltered.map((item) => (
              <AnnouncementCard
                key={item.id}
                item={item}
                isManager={isManager}
                onMarkRead={(id) => markReadMutation.mutate(id)}
                onTogglePin={(id) => togglePinMutation.mutate(id)}
                onDelete={(id) => deleteMutation.mutate(id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Create Modal */}
      {showCreate && <CreateModal onClose={() => setShowCreate(false)} />}
    </div>
  );
};