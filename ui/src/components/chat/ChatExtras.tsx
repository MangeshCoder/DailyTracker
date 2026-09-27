// ─────────────────────────────────────────────────────────────────────────────
//  FILE: ui/src/components/chat/ChatExtras.tsx
//  Chat extras — used by the chat page and the chat panel
//
//  ✅ MessageText        — @mention highlighting, clickable links, search hits
//  ✅ findMentionQuery / MentionPicker — "@" autocomplete in the composer
//  ✅ PinnedBar          — pinned messages strip + list (jump / unpin)
//  ✅ SearchPanel        — search inside a conversation, jump to a result
//  ✅ Desktop notifications — opt-in toggle + helper used by ChatContext
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { chatApi } from '../../services/api';
import type { ChatMessage } from '../../types';
import { Pin, PinOff, Search, X, Loader2, Bell, BellOff, ChevronDown } from 'lucide-react';
import { DESKTOP_NOTIFY_PREF_KEY as PREF_KEY, desktopNotificationsSupported, desktopNotificationsEnabled } from './chatNotifications';

// ── Text rendering ───────────────────────────────────────────────────────────
const URL_RE = /(https?:\/\/[^\s<>"']+[^\s<>"'.,;:!?)\]])/g;
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Renders message text safely (React escapes everything) with:
 *   • @Name highlighted for mentioned members (stronger when it's you)
 *   • http(s) links clickable (open in a new tab)
 *   • optional search term highlight
 */
export const MessageText = ({
  text, mentionNames = [], myName, highlight, onDark = false,
}: {
  text: string;
  mentionNames?: string[];
  myName?: string;
  highlight?: string;
  onDark?: boolean;
}) => {
  const parts = useMemo(() => {
    const tokens: string[] = [];
    if (mentionNames.length) tokens.push(...mentionNames.map(n => '@' + escapeRe(n)));
    const hl = highlight?.trim();
    if (hl && hl.length >= 2) tokens.push(escapeRe(hl));
    const re = tokens.length ? new RegExp(`(${tokens.sort((a, b) => b.length - a.length).join('|')})`, 'gi') : null;

    const out: ReactNode[] = [];
    let key = 0;
    for (const chunk of text.split(URL_RE)) {
      if (/^https?:\/\//.test(chunk)) {
        out.push(
          <a key={key++} href={chunk} target="_blank" rel="noopener noreferrer"
             className={`underline underline-offset-2 break-all ${onDark ? 'text-white' : 'text-blue-600 dark:text-blue-400'}`}
             onClick={e => e.stopPropagation()}>
            {chunk}
          </a>
        );
        continue;
      }
      if (!re) { out.push(chunk); continue; }
      for (const piece of chunk.split(re)) {
        if (!piece) continue;
        const isMention = piece.startsWith('@') && mentionNames.some(n => ('@' + n).toLowerCase() === piece.toLowerCase());
        if (isMention) {
          const isMe = myName && ('@' + myName).toLowerCase() === piece.toLowerCase();
          out.push(
            <span key={key++} className={`font-semibold rounded px-0.5 ${
              onDark ? 'bg-white/20 text-white'
              : isMe ? 'bg-amber-400/25 text-amber-800 dark:text-amber-300'
              : 'text-blue-600 dark:text-blue-400'
            }`}>{piece}</span>
          );
        } else if (hl && piece.toLowerCase() === hl.toLowerCase()) {
          out.push(<mark key={key++} className="bg-yellow-300/70 dark:bg-yellow-500/40 text-inherit rounded px-0.5">{piece}</mark>);
        } else {
          out.push(piece);
        }
      }
    }
    return out;
  }, [text, mentionNames, myName, highlight, onDark]);

  return <>{parts}</>;
};

// ── @mention autocomplete ─────────────────────────────────────────────────────
export interface MentionCandidate { id: number; name: string }

/** If the caret is right after "@something", return where it starts and the query */
export const findMentionQuery = (value: string, caret: number): { start: number; query: string } | null => {
  const before = value.slice(0, caret);
  const at = before.lastIndexOf('@');
  if (at < 0) return null;
  if (at > 0 && !/\s/.test(before[at - 1])) return null;         // e.g. emails: a@b
  const query = before.slice(at + 1);
  if (query.length > 30 || /\n/.test(query) || /\s{2,}/.test(query)) return null;
  return { start: at, query };
};

export const filterCandidates = (all: MentionCandidate[], query: string) => {
  const q = query.trim().toLowerCase();
  return all
    .filter(c => !q || c.name.toLowerCase().split(' ').some(w => w.startsWith(q)) || c.name.toLowerCase().startsWith(q))
    .slice(0, 6);
};

export const MentionPicker = ({
  items, activeIndex, onPick, onHover,
}: {
  items: MentionCandidate[];
  activeIndex: number;
  onPick: (c: MentionCandidate) => void;
  onHover: (i: number) => void;
}) => (
  <div role="listbox" aria-label="Mention someone"
       className="absolute bottom-full left-0 mb-2 w-64 max-w-[90vw] z-30 p-1 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-2xl animate-in fade-in slide-in-from-bottom-1 duration-100">
    <p className="px-2.5 pt-1.5 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">Mention</p>
    {items.map((c, i) => (
      <button
        key={c.id}
        type="button"
        role="option"
        aria-selected={i === activeIndex}
        onMouseDown={e => { e.preventDefault(); onPick(c); }}   // keep textarea focus
        onMouseEnter={() => onHover(i)}
        className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-left text-sm transition ${
          i === activeIndex ? 'bg-blue-500/10 text-blue-700 dark:text-blue-300' : 'text-slate-700 dark:text-slate-200'
        }`}
      >
        <span className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">
          {c.name.charAt(0).toUpperCase()}
        </span>
        <span className="truncate font-medium">{c.name}</span>
      </button>
    ))}
    <p className="px-2.5 pt-1 pb-1 text-[10px] text-slate-400">↑ ↓ to choose · Enter to insert · Esc to close</p>
  </div>
);

// ── Pinned messages ───────────────────────────────────────────────────────────
export const pinnedPreview = (m: ChatMessage) =>
  m.messageType === 'Image' ? (m.content ? `📷 ${m.content}` : '📷 Photo')
  : m.messageType === 'File' ? `📎 ${m.attachmentName ?? 'File'}`
  : m.messageType === 'Poll' ? `📊 ${m.poll?.question ?? m.content}`
  : m.content;

export const usePinned = (conversationId: number) =>
  useQuery<ChatMessage[]>({
    queryKey: ['pinned', conversationId],
    queryFn: () => chatApi.getPinned(conversationId),
    staleTime: 30_000,
  });

export const PinnedBar = ({
  conversationId, onJump, onUnpin,
}: {
  conversationId: number;
  onJump: (messageId: number) => void;
  onUnpin: (messageId: number) => void;
}) => {
  const { data: pinned = [] } = usePinned(conversationId);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  if (pinned.length === 0) return null;
  const latest = pinned[0];

  return (
    <div ref={ref} className="relative flex-shrink-0 border-b border-slate-200 dark:border-slate-800 bg-amber-50/70 dark:bg-amber-500/5">
      <div className="flex items-center gap-2 px-4 py-2">
        <Pin className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 flex-shrink-0 -rotate-45" />
        <button type="button" onClick={() => onJump(latest.id)} className="flex-1 min-w-0 text-left" title="Go to pinned message">
          <p className="text-[11px] font-bold text-amber-700 dark:text-amber-400">
            Pinned{pinned.length > 1 ? ` · ${pinned.length}` : ''}
          </p>
          <p className="text-xs text-slate-600 dark:text-slate-300 truncate">
            <span className="font-semibold">{latest.senderName}:</span> {pinnedPreview(latest)}
          </p>
        </button>
        {pinned.length > 1 && (
          <button type="button" onClick={() => setOpen(o => !o)} aria-expanded={open}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 dark:text-amber-400 hover:underline flex-shrink-0">
            All <ChevronDown className={`w-3.5 h-3.5 transition ${open ? 'rotate-180' : ''}`} />
          </button>
        )}
      </div>

      {open && (
        <div className="absolute left-2 right-2 top-full mt-1 z-20 max-h-72 overflow-y-auto p-1 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-2xl">
          {pinned.map(m => (
            <div key={m.id} className="flex items-start gap-2 p-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/60">
              <button type="button" onClick={() => { setOpen(false); onJump(m.id); }} className="flex-1 min-w-0 text-left">
                <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">{m.senderName}</p>
                <p className="text-sm text-slate-800 dark:text-slate-100 line-clamp-2 break-words">{pinnedPreview(m)}</p>
              </button>
              <button type="button" onClick={() => onUnpin(m.id)} title="Unpin"
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-500/10 transition flex-shrink-0">
                <PinOff className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ── Search inside a conversation ──────────────────────────────────────────────
export const SearchPanel = ({
  conversationId, overlay, onClose, onJump, formatTime,
}: {
  conversationId: number;
  overlay: boolean;
  onClose: () => void;
  onJump: (messageId: number, term: string) => void;
  formatTime: (iso: string) => string;
}) => {
  const [q, setQ] = useState('');
  const [debounced, setDebounced] = useState('');
  useEffect(() => { const t = setTimeout(() => setDebounced(q.trim()), 300); return () => clearTimeout(t); }, [q]);

  const { data: results = [], isFetching } = useQuery<ChatMessage[]>({
    queryKey: ['chatSearch', conversationId, debounced],
    queryFn: () => chatApi.search(conversationId, debounced),
    enabled: debounced.length >= 2,
  });

  return (
    <div className={`${overlay ? 'absolute inset-0 z-10' : 'w-80 flex-shrink-0 border-l border-slate-200 dark:border-slate-800'} bg-white dark:bg-slate-950 flex flex-col`}>
      <div className="flex items-center gap-2 px-3 py-3 border-b border-slate-200 dark:border-slate-800">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            autoFocus
            value={q}
            onChange={e => setQ(e.target.value)}
            onKeyDown={e => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } }}
            placeholder="Search this chat…"
            className="w-full pl-9 pr-3 py-2 rounded-xl text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <button type="button" onClick={onClose} aria-label="Close search"
                className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {debounced.length < 2 ? (
          <p className="text-xs text-slate-500 dark:text-slate-400 text-center py-10">Type at least 2 letters to search messages and file names</p>
        ) : isFetching && results.length === 0 ? (
          <div className="flex justify-center py-10 text-slate-400"><Loader2 className="w-5 h-5 animate-spin" /></div>
        ) : results.length === 0 ? (
          <p className="text-xs text-slate-500 dark:text-slate-400 text-center py-10">No messages match “{debounced}”</p>
        ) : (
          <>
            <p className="px-2 pb-1 text-[11px] font-semibold text-slate-400">{results.length}{results.length === 50 ? '+' : ''} result{results.length === 1 ? '' : 's'}</p>
            {results.map(m => (
              <button
                key={m.id}
                type="button"
                onClick={() => onJump(m.id, debounced)}
                className="w-full text-left p-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800/60 transition"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 truncate">{m.senderName}</p>
                  <p className="text-[10px] text-slate-400 flex-shrink-0">{formatTime(m.sentAt)}</p>
                </div>
                <p className="text-sm text-slate-800 dark:text-slate-100 line-clamp-3 break-words mt-0.5">
                  <MessageText text={m.messageType === 'File' ? `📎 ${m.attachmentName}` : m.content} highlight={debounced} />
                </p>
              </button>
            ))}
          </>
        )}
      </div>
    </div>
  );
};

// ── Desktop (browser) notifications ──────────────────────────────────────────
/** Bell toggle for the chat list header */
export const DesktopNotifyToggle = () => {
  const supported = desktopNotificationsSupported();
  const [enabled, setEnabled] = useState(desktopNotificationsEnabled);
  if (!supported) return null;

  const toggle = async () => {
    if (enabled) {
      try { localStorage.setItem(PREF_KEY, 'off'); } catch { /* ignore */ }
      setEnabled(false);
      return;
    }
    const permission = Notification.permission === 'default' ? await Notification.requestPermission() : Notification.permission;
    if (permission === 'granted') {
      try { localStorage.setItem(PREF_KEY, 'on'); } catch { /* ignore */ }
      setEnabled(true);
    } else {
      alert('Notifications are blocked for this site. Allow them in your browser’s site settings (the icon left of the address bar), then try again.');
    }
  };

  return (
    <button
      type="button"
      onClick={toggle}
      title={enabled ? 'Desktop notifications on — click to turn off' : 'Get desktop notifications for new messages'}
      aria-pressed={enabled}
      className={`w-9 h-9 rounded-xl flex items-center justify-center transition ${
        enabled ? 'text-blue-600 dark:text-blue-400 bg-blue-500/10' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
      }`}
    >
      {enabled ? <Bell className="w-4 h-4" /> : <BellOff className="w-4 h-4" />}
    </button>
  );
};

