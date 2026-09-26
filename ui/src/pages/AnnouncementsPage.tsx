// ─────────────────────────────────────────────────────────────────────────────
//  FILE: ui/src/pages/AnnouncementsPage.tsx
//  Announcements - Modern Design System Upgrade
//
//  Logic unchanged from previous version:
//  ✅ Pinned + regular announcements, category filter
//  ✅ Click to expand (marks as read), mark all read
//  ✅ Manager: post, pin/unpin, delete
//  ✅ Real-time refresh on "NewAnnouncement" SignalR event
//  UI: delete now asks for confirmation (themed useConfirm dialog).
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { announcementsApi } from '../services/api';
import type { Announcement, AnnouncementsResponse, CreateAnnouncementDto } from '../types';
import { useAuth } from '../context/Authcontext';
import { useSignalR } from '../context/SignalRContext';
import { useConfirm } from '../hooks/useConfirm';
import { DatePicker } from '../components/DatePicker';
import { PageHeader } from '../components/ui/PageHeader';
import { StatCard } from '../components/ui/StatCard';
import {
  Megaphone,
  ScrollText,
  PartyPopper,
  Siren,
  Pin,
  PinOff,
  Trash2,
  Plus,
  X,
  CheckCheck,
  Clock,
  CalendarX,
  UserRound,
  ChevronDown,
  Loader2,
  Inbox,
  Bell,
  Layers,
  Send,
  LayoutGrid,
} from 'lucide-react';

// ─── Category config ──────────────────────────────────────────────────────────
const CATEGORY_CONFIG: Record<string, { icon: React.ElementType; badge: string; accent: string }> = {
  General: { icon: Megaphone,   badge: 'bg-slate-500/10 text-slate-600 dark:text-slate-300 border-slate-500/30',     accent: 'bg-slate-400' },
  Policy:  { icon: ScrollText,  badge: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30',         accent: 'bg-blue-500' },
  Event:   { icon: PartyPopper, badge: 'bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/30', accent: 'bg-violet-500' },
  Urgent:  { icon: Siren,       badge: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30',         accent: 'bg-rose-500' },
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

// ─── Shared input styles ──────────────────────────────────────────────────────
const INPUT_CLS =
  'w-full bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white ' +
  'placeholder:text-slate-400 dark:placeholder:text-slate-500 rounded-xl px-3.5 py-2.5 text-sm ' +
  'focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition';
const LABEL_CLS = 'block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5';

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
  const CatIcon = cat.icon;

  const handleClick = () => {
    if (!item.isRead) onMarkRead(item.id);
    setExpanded((v) => !v);
  };

  const accent = item.isPinned ? 'bg-amber-400' : item.category === 'Urgent' ? 'bg-rose-500' : !item.isRead ? 'bg-blue-500' : '';

  return (
    <div
      onClick={handleClick}
      className={`group relative overflow-hidden rounded-2xl border p-5 pl-6 cursor-pointer transition-all hover:shadow-md ${
        item.isRead
          ? 'bg-white dark:bg-slate-900/90 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
          : 'bg-blue-50/60 dark:bg-blue-500/5 border-blue-200 dark:border-blue-500/30'
      }`}
    >
      {accent && <span className={`absolute left-0 top-0 bottom-0 w-1 ${accent}`} />}

      <div className="flex items-start gap-4">
        <div className={`hidden sm:flex w-10 h-10 rounded-xl items-center justify-center border shrink-0 ${cat.badge}`}>
          <CatIcon className="w-5 h-5" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1.5">
            {item.isPinned && (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                <Pin className="w-3 h-3" /> Pinned
              </span>
            )}
            <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full border ${cat.badge}`}>
              <CatIcon className="w-3 h-3" /> {item.category}
            </span>
            {!item.isRead && (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 dark:text-blue-400">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500" /> New
              </span>
            )}
          </div>

          <h3 className={`text-base leading-snug ${item.isRead ? 'font-semibold text-slate-800 dark:text-slate-200' : 'font-bold text-slate-900 dark:text-white'}`}>
            {item.title}
          </h3>

          {expanded ? (
            <p className="text-sm text-slate-700 dark:text-slate-300 mt-2 whitespace-pre-wrap leading-relaxed">{item.content}</p>
          ) : (
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">{item.content}</p>
          )}

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-3 text-xs text-slate-500 dark:text-slate-400">
            <span className="inline-flex items-center gap-1"><UserRound className="w-3.5 h-3.5" /> {item.createdByName}</span>
            <span className="inline-flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> {relativeTime(item.createdAt)}</span>
            {item.expiresAt && (
              <span className="inline-flex items-center gap-1">
                <CalendarX className="w-3.5 h-3.5" />
                Expires {new Date(item.expiresAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
              </span>
            )}
            <span className="inline-flex items-center gap-1 ml-auto font-semibold text-blue-600 dark:text-blue-400">
              {expanded ? 'Show less' : 'Read more'}
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${expanded ? 'rotate-180' : ''}`} />
            </span>
          </div>
        </div>

        {isManager && (
          <div className="flex flex-col sm:flex-row gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => onTogglePin(item.id)}
              title={item.isPinned ? 'Unpin' : 'Pin'}
              className={`p-2 rounded-lg transition ${
                item.isPinned
                  ? 'text-amber-500 bg-amber-500/10 hover:bg-amber-500/20'
                  : 'text-slate-400 hover:text-amber-500 hover:bg-amber-500/10'
              }`}
            >
              {item.isPinned ? <PinOff className="w-4 h-4" /> : <Pin className="w-4 h-4" />}
            </button>
            <button
              onClick={() => onDelete(item.id)}
              title="Delete"
              className="p-2 rounded-lg text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-500/10 transition"
            >
              <Trash2 className="w-4 h-4" />
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-sm p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Gradient header */}
        <div className="relative bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 p-5 sm:p-6 text-white">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 rounded-full bg-black/20 hover:bg-black/40 text-white/80 hover:text-white transition"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-3 pr-10">
            <div className="w-11 h-11 rounded-2xl bg-white/15 border border-white/20 flex items-center justify-center shrink-0">
              <Megaphone className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold">New Announcement</h2>
              <p className="text-xs text-white/80">Shared with everyone in the company</p>
            </div>
          </div>
        </div>

        <div className="p-5 sm:p-6 space-y-4 overflow-y-auto">
          <div>
            <label className={LABEL_CLS}>Title <span className="text-rose-500">*</span></label>
            <input
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="Announcement title…"
              className={INPUT_CLS}
            />
          </div>

          <div>
            <label className={LABEL_CLS}>Category</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {Object.entries(CATEGORY_CONFIG).map(([c, cfg]) => {
                const Icon = cfg.icon;
                const active = form.category === c;
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, category: c }))}
                    className={`inline-flex items-center justify-center gap-1.5 px-2 py-2 rounded-xl text-xs font-semibold border transition ${
                      active
                        ? `${cfg.badge} shadow-sm`
                        : 'bg-white dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-600'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" /> {c}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className={LABEL_CLS}>Content <span className="text-rose-500">*</span></label>
            <textarea
              value={form.content}
              onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
              placeholder="Write your announcement…"
              rows={5}
              className={`${INPUT_CLS} resize-none`}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end">
            <div>
              <label className={LABEL_CLS}>Expires On (optional)</label>
              <DatePicker
                value={form.expiresAt?.slice(0, 10) ?? ''}
                onChange={v => setForm((f) => ({ ...f, expiresAt: v ? v + 'T00:00:00Z' : null }))}
              />
            </div>
            <button
              type="button"
              onClick={() => setForm((f) => ({ ...f, isPinned: !f.isPinned }))}
              className="flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700"
            >
              <span className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300">
                <Pin className="w-4 h-4 text-amber-500" /> Pin to top
              </span>
              <span className={`relative w-9 h-5 rounded-full transition ${form.isPinned ? 'bg-amber-500' : 'bg-slate-300 dark:bg-slate-700'}`}>
                <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${form.isPinned ? 'left-[18px]' : 'left-0.5'}`} />
              </span>
            </button>
          </div>
        </div>

        <div className="p-4 sm:p-5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/60 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!form.title.trim() || !form.content.trim() || createMutation.isPending}
            className="flex-1 inline-flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-500/20 transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            {createMutation.isPending ? 'Posting…' : 'Post Announcement'}
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
  const { confirm } = useConfirm();
  const isManager = user?.role === 'Manager';
  const [showCreate, setShowCreate] = useState(false);
  const [filter, setFilter] = useState<string>('All');

  const { data, isLoading } = useQuery<AnnouncementsResponse>({
    queryKey: ['announcements'],
    queryFn:  () => announcementsApi.getAll().then((r) => r.data),
    refetchOnWindowFocus: true,
  });

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

  const handleDelete = async (id: number) => {
    const ok = await confirm('This announcement will be removed for everyone.', {
      title:       'Delete Announcement?',
      confirmText: 'Yes, delete',
      danger:      true,
    });
    if (ok) deleteMutation.mutate(id);
  };

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

  const unread = data?.unreadCount ?? 0;

  const renderCard = (item: Announcement) => (
    <AnnouncementCard
      key={item.id}
      item={item}
      isManager={isManager}
      onMarkRead={(id) => markReadMutation.mutate(id)}
      onTogglePin={(id) => togglePinMutation.mutate(id)}
      onDelete={handleDelete}
    />
  );

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
      {/* ── Page Header ── */}
      <PageHeader
        title="Announcements"
        description="Company-wide updates from management."
        breadcrumbs={[
          { label: 'Workspace', href: '/' },
          { label: 'Communication' },
          { label: 'Announcements' },
        ]}
        badge={unread > 0
          ? { label: `${unread} unread`, variant: 'blue', icon: <Bell className="w-3 h-3" /> }
          : { label: 'All read', variant: 'emerald', icon: <CheckCheck className="w-3 h-3" /> }}
        actions={
          <>
            {unread > 0 && (
              <button
                onClick={() => markAllReadMutation.mutate()}
                disabled={markAllReadMutation.isPending}
                className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-blue-600 dark:text-blue-400 hover:bg-blue-500/10 transition disabled:opacity-50"
              >
                {markAllReadMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCheck className="w-4 h-4" />}
                Mark all read
              </button>
            )}
            {isManager && (
              <button
                onClick={() => setShowCreate(true)}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-500/20 transition"
              >
                <Plus className="w-4 h-4" /> New Post
              </button>
            )}
          </>
        }
        className="!mb-0"
      />

      {/* ── Stats ── */}
      <div className="grid grid-cols-3 gap-4">
        <StatCard title="Total"  value={allItems.length}           icon={Layers} color="slate" loading={isLoading} />
        <StatCard title="Unread" value={unread}                    icon={Bell}   color="blue"  loading={isLoading} />
        <StatCard title="Pinned" value={data?.pinned.length ?? 0}  icon={Pin}    color="amber" loading={isLoading} />
      </div>

      {/* ── Category filter ── */}
      <div className="flex flex-wrap gap-2">
        {categories.map((cat) => {
          const cfg = CATEGORY_CONFIG[cat];
          const Icon = cfg?.icon ?? LayoutGrid;
          const count = cat === 'All' ? allItems.length : allItems.filter(a => a.category === cat).length;
          const active = filter === cat;
          return (
            <button
              key={cat}
              onClick={() => setFilter(cat)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition ${
                active
                  ? cat === 'All'
                    ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-transparent'
                    : cfg.badge
                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-600'
              }`}
            >
              <Icon className="w-3.5 h-3.5" /> {cat}
              <span className="opacity-60">{count}</span>
            </button>
          );
        })}
      </div>

      {/* ── Loading ── */}
      {isLoading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 bg-slate-100 dark:bg-slate-800/60 rounded-2xl animate-pulse" />
          ))}
        </div>
      )}

      {/* ── Empty ── */}
      {!isLoading && filtered.length === 0 && (
        <div className="text-center py-16 px-4 rounded-3xl border-2 border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
            <Inbox className="w-7 h-7 text-blue-500" />
          </div>
          <p className="text-base font-bold text-slate-900 dark:text-white mt-3">
            {allItems.length === 0 ? 'No announcements yet' : `No ${filter.toLowerCase()} announcements`}
          </p>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {isManager ? 'Post the first company-wide update.' : 'Check back soon for updates from management.'}
          </p>
        </div>
      )}

      {/* ── Pinned ── */}
      {!isLoading && pinnedFiltered.length > 0 && (
        <section className="space-y-3">
          <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400">
            <Pin className="w-3.5 h-3.5" /> Pinned
          </p>
          {pinnedFiltered.map(renderCard)}
        </section>
      )}

      {/* ── Regular ── */}
      {!isLoading && regularFiltered.length > 0 && (
        <section className="space-y-3">
          {pinnedFiltered.length > 0 && (
            <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              <Clock className="w-3.5 h-3.5" /> Recent
            </p>
          )}
          {regularFiltered.map(renderCard)}
        </section>
      )}

      {showCreate && <CreateModal onClose={() => setShowCreate(false)} />}
    </div>
  );
};