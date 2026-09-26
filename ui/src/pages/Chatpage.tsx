// ─────────────────────────────────────────────────────────────────────────────
//  FILE: ui/src/pages/Chatpage.tsx
//  Team Chat - Modern Design System Upgrade (styling only)
//
//  Logic unchanged from previous version:
//  ✅ ONE SignalR connection (useChatHub called once in ChatPage)
//  ✅ messages keyed by conversation, de-duplicated by id
//  ✅ Sidebar cache patched with setQueryData (keeps clicks from being lost)
//  ✅ Direct + group chats, replies, edit, delete, reactions, typing, read receipts
//  UI: native window.confirm() replaced with the themed useConfirm dialog.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useRef, useCallback, createContext, useContext, type KeyboardEvent } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { ChatMessage, ConversationSummary, UserChatProfile, ConversationDetail } from '../types/index';
import { authApi, chatApi } from '../services/api';
import { useChatHub } from './useChatHub';
import { useConfirm } from '../hooks/useConfirm';
import {
  MessageSquare,
  MessagesSquare,
  Plus,
  Search,
  X,
  Users,
  UserRound,
  ArrowLeft,
  Reply,
  Pencil,
  Trash2,
  MoreVertical,
  SmilePlus,
  SendHorizontal,
  Check,
  CheckCheck,
  LogOut,
  UserPlus,
  Loader2,
  Info,
} from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
const parseUtcDate = (iso: string): Date => {
  if (!iso) return new Date();
  // .NET naive DateTime strings (no Z / offset) are UTC — append 'Z'
  if (!iso.endsWith('Z') && !/[+-]\d{2}:?\d{2}$/.test(iso)) {
    return new Date(iso + 'Z');
  }
  return new Date(iso);
};

const formatTime = (iso: string) =>
  parseUtcDate(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

const formatDate = (iso: string) => {
  const d = parseUtcDate(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const groupMessagesByDate = (messages: ChatMessage[]) => {
  const groups: { date: string; messages: ChatMessage[] }[] = [];
  for (const msg of messages) {
    const dateLabel = formatDate(msg.sentAt);
    const last = groups[groups.length - 1];
    if (last && last.date === dateLabel) last.messages.push(msg);
    else groups.push({ date: dateLabel, messages: [msg] });
  }
  return groups;
};

// ─────────────────────────────────────────────────────────────────────────────
//  Small shared UI components
// ─────────────────────────────────────────────────────────────────────────────

const OnlineDot = ({ status }: { status?: string }) => {
  const color =
    status === 'Online' ? 'bg-emerald-500' :
    status === 'Busy'   ? 'bg-amber-500'   : 'bg-slate-300 dark:bg-slate-600';
  return <span className={`block w-2.5 h-2.5 rounded-full ring-2 ring-white dark:ring-slate-950 ${color}`} />;
};

const Avatar = ({
  name, size = 'md', isGroup = false
}: { name: string; size?: 'sm' | 'md' | 'lg'; isGroup?: boolean }) => {
  const sizes = { sm: 'w-8 h-8 text-xs', md: 'w-10 h-10 text-sm', lg: 'w-12 h-12 text-base' };
  const iconSize = { sm: 'w-4 h-4', md: 'w-5 h-5', lg: 'w-6 h-6' };
  const bg = isGroup
    ? 'bg-gradient-to-br from-violet-500 to-fuchsia-500'
    : 'bg-gradient-to-br from-blue-500 to-indigo-600';
  return (
    <div className={`${sizes[size]} rounded-full flex items-center justify-center font-bold text-white flex-shrink-0 ${bg}`}>
      {isGroup ? <Users className={iconSize[size]} /> : name.charAt(0).toUpperCase()}
    </div>
  );
};

const INPUT_CLS =
  'w-full bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white ' +
  'placeholder:text-slate-400 dark:placeholder:text-slate-500 rounded-xl text-sm ' +
  'focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition';

// ─────────────────────────────────────────────────────────────────────────────
//  New Chat Modal
// ─────────────────────────────────────────────────────────────────────────────
const NewChatModal = ({
  onClose, onOpenDirect, onCreateGroup
}: {
  onClose: () => void;
  onOpenDirect: (userId: number) => void;
  onCreateGroup: (name: string, members: number[]) => void;
}) => {
  const [tab, setTab] = useState<'direct' | 'group'>('direct');
  const [search, setSearch] = useState('');
  const [groupName, setGroupName] = useState('');
  const [selected, setSelected] = useState<number[]>([]);

  const { data: users = [] } = useQuery<UserChatProfile[]>({
    queryKey: ['chatUsers'],
    queryFn: chatApi.getUsers,
  });

  const filtered = users.filter(u =>
    u.fullName.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase())
  );

  const toggleUser = (id: number) =>
    setSelected(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);

  return (
    <div
      className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Gradient header */}
        <div className="relative bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 p-5 text-white">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 rounded-full bg-black/20 hover:bg-black/40 text-white/80 hover:text-white transition"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-3 pr-10">
            <div className="w-11 h-11 rounded-2xl bg-white/15 border border-white/20 flex items-center justify-center shrink-0">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold">New Chat</h3>
              <p className="text-xs text-white/80">Message a teammate or start a group</p>
            </div>
          </div>
        </div>

        <div className="p-5 space-y-3 flex-shrink-0">
          <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
            {(['direct', 'group'] as const).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`inline-flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-semibold transition ${
                  tab === t
                    ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {t === 'direct' ? <UserRound className="w-4 h-4" /> : <Users className="w-4 h-4" />}
                {t === 'direct' ? 'Direct Message' : 'Group Chat'}
              </button>
            ))}
          </div>

          {tab === 'group' && (
            <input
              placeholder="Group name..."
              value={groupName}
              onChange={e => setGroupName(e.target.value)}
              className={`${INPUT_CLS} px-3.5 py-2.5`}
            />
          )}

          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              placeholder="Search people..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className={`${INPUT_CLS} pl-9 pr-3.5 py-2.5`}
            />
          </div>

          {tab === 'group' && selected.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {selected.map(id => {
                const u = users.find(u => u.id === id);
                return u ? (
                  <span key={id} className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-700 dark:text-blue-300">
                    {u.fullName}
                    <button onClick={() => toggleUser(id)} className="hover:text-rose-500" aria-label={`Remove ${u.fullName}`}>
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ) : null;
              })}
            </div>
          )}
        </div>

        <div className="overflow-y-auto flex-1 mx-5 mb-4 rounded-2xl border border-slate-200 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800/80">
          {filtered.length === 0 && (
            <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-8">No users found</p>
          )}
          {filtered.map(u => {
            const isSel = selected.includes(u.id);
            return (
              <button
                key={u.id}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 text-left transition ${
                  isSel ? 'bg-blue-500/5' : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                }`}
                onClick={() => {
                  if (tab === 'direct') { onOpenDirect(u.id); onClose(); }
                  else toggleUser(u.id);
                }}
              >
                <div className="relative">
                  <Avatar name={u.fullName} size="sm" />
                  <div className="absolute -bottom-0.5 -right-0.5"><OnlineDot status={u.onlineStatus} /></div>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">{u.fullName}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{u.role}</p>
                </div>
                {tab === 'group' && (
                  <div className={`w-5 h-5 rounded-md border-2 flex-shrink-0 flex items-center justify-center transition ${
                    isSel ? 'bg-blue-600 border-blue-600' : 'border-slate-300 dark:border-slate-600'
                  }`}>
                    {isSel && <Check className="w-3.5 h-3.5 text-white" />}
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {tab === 'group' && (
          <div className="px-5 pb-5 flex-shrink-0">
            <button
              disabled={!groupName.trim() || selected.length < 1}
              onClick={() => { onCreateGroup(groupName, selected); onClose(); }}
              className="w-full inline-flex items-center justify-center gap-2 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-xl shadow-md shadow-blue-500/20 transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Users className="w-4 h-4" />
              Create Group ({selected.length} {selected.length === 1 ? 'member' : 'members'})
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
//  Conversation Sidebar
// ─────────────────────────────────────────────────────────────────────────────
const ConversationSidebar = ({
  conversations, selectedId, onSelect, onNewChat
}: {
  conversations: ConversationSummary[];
  selectedId: number | null;
  onSelect: (id: number) => void;
  onNewChat: () => void;
}) => {
  const [search, setSearch] = useState('');
  const filtered = conversations.filter(c =>
    c.displayName.toLowerCase().includes(search.toLowerCase())
  );
  const totalUnread = conversations.reduce((sum, c) => sum + c.unreadCount, 0);

  return (
    <div className="flex flex-col h-full w-full bg-white dark:bg-slate-950 border-r border-slate-200 dark:border-slate-800">
      <div className="px-4 py-4 border-b border-slate-200 dark:border-slate-800 flex-shrink-0">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Messages</h2>
            {totalUnread > 0 && (
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-blue-600 text-white">
                {totalUnread > 99 ? '99+' : totalUnread}
              </span>
            )}
          </div>
          <button
            onClick={onNewChat}
            title="New chat"
            className="w-9 h-9 bg-blue-600 hover:bg-blue-500 text-white rounded-xl flex items-center justify-center shadow-md shadow-blue-500/20 transition"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            placeholder="Search conversations..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className={`${INPUT_CLS} pl-9 pr-3 py-2 !text-xs bg-slate-50 dark:bg-slate-900`}
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
        {filtered.length === 0 && (
          <div className="text-center py-12 px-4">
            <MessagesSquare className="w-9 h-9 mx-auto text-slate-300 dark:text-slate-600" />
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 mt-3">No conversations yet</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Tap + to start one</p>
          </div>
        )}
        {filtered.map(conv => {
          const active = selectedId === conv.id;
          const unread = conv.unreadCount > 0;
          return (
            <button
              key={conv.id}
              onClick={() => onSelect(conv.id)}
              className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl text-left transition ${
                active
                  ? 'bg-blue-500/10 ring-1 ring-blue-500/30'
                  : 'hover:bg-slate-100 dark:hover:bg-slate-800/50'
              }`}
            >
              <div className="relative flex-shrink-0">
                <Avatar name={conv.displayName} size="md" isGroup={conv.type === 'Group'} />
                {conv.type === 'Direct' && (
                  <div className="absolute -bottom-0.5 -right-0.5"><OnlineDot /></div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p className={`text-sm truncate ${
                    unread ? 'font-bold text-slate-900 dark:text-white' : 'font-medium text-slate-700 dark:text-slate-300'
                  }`}>
                    {conv.displayName}
                  </p>
                  {conv.lastMessageAt && (
                    <p className={`text-[11px] flex-shrink-0 ${unread ? 'text-blue-600 dark:text-blue-400 font-semibold' : 'text-slate-400 dark:text-slate-500'}`}>
                      {formatTime(conv.lastMessageAt)}
                    </p>
                  )}
                </div>
                <div className="flex items-center justify-between gap-2 mt-0.5">
                  <p className={`text-xs truncate flex-1 ${unread ? 'text-slate-700 dark:text-slate-300' : 'text-slate-500 dark:text-slate-400'}`}>
                    {conv.lastMessagePreview ?? (conv.type === 'Group' ? `${conv.memberCount} members` : 'No messages yet')}
                  </p>
                  {unread && (
                    <span className="min-w-[20px] h-5 px-1.5 text-[11px] bg-blue-600 text-white rounded-full flex items-center justify-center font-bold flex-shrink-0">
                      {conv.unreadCount > 9 ? '9+' : conv.unreadCount}
                    </span>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
//  Message Bubble
// ─────────────────────────────────────────────────────────────────────────────
const MessageBubble = ({
  message, isOwn, currentUserId, onReply, onEdit, onDelete, onReact
}: {
  message: ChatMessage;
  isOwn: boolean;
  currentUserId: number;
  onReply: (msg: ChatMessage) => void;
  onEdit: (msg: ChatMessage) => void;
  onDelete: (id: number) => void;
  onReact: (id: number, emoji: string) => void;
}) => {
  const [showMenu, setShowMenu] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) {
        setShowMenu(false);
        setShowEmojiPicker(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  if (message.messageType === 'System') {
    return (
      <div className="flex justify-center my-2">
        <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800/60 px-3 py-1 rounded-full">
          <Info className="w-3 h-3" /> {message.content}
        </span>
      </div>
    );
  }

  const emojis = ['👍', '❤️', '😂', '😮', '😢', '🔥'];
  const actionBtn =
    'w-7 h-7 rounded-full flex items-center justify-center bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 ' +
    'text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 shadow-sm transition';

  return (
    <div className={`flex items-end gap-2 group ${isOwn ? 'flex-row-reverse' : 'flex-row'} mb-1.5`}>
      {!isOwn && (
        <div className="flex-shrink-0 mb-5">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-xs font-bold text-white">
            {message.senderInitial}
          </div>
        </div>
      )}
      <div className={`relative max-w-[78%] sm:max-w-md xl:max-w-lg ${isOwn ? 'items-end' : 'items-start'} flex flex-col`}>
        {!isOwn && <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1 px-1">{message.senderName}</p>}

        {message.replyTo && (
          <div className={`mb-1 px-3 py-1.5 rounded-xl border-l-2 border-blue-500 bg-slate-100 dark:bg-slate-800/70 w-full ${isOwn ? 'text-right' : ''}`}>
            <p className="text-blue-600 dark:text-blue-400 text-[11px] font-semibold">{message.replyTo.senderName}</p>
            <p className="text-slate-500 dark:text-slate-400 text-xs truncate">{message.replyTo.contentPreview}</p>
          </div>
        )}

        <div className={`relative px-4 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap break-words ${
          isOwn
            ? 'bg-blue-600 text-white rounded-br-md shadow-md shadow-blue-500/20'
            : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-bl-md border border-slate-200 dark:border-slate-700 shadow-sm'
        } ${message.isDeleted ? 'opacity-60 italic' : ''}`}>
          {message.content}
          {message.isEdited && !message.isDeleted && (
            <span className="text-[11px] opacity-60 ml-2">(edited)</span>
          )}
        </div>

        {message.reactions.length > 0 && (
          <div className={`flex flex-wrap gap-1 mt-1 ${isOwn ? 'justify-end' : ''}`}>
            {message.reactions.map(r => (
              <button
                key={r.emoji}
                onClick={() => onReact(message.id, r.emoji)}
                className={`text-xs px-2 py-0.5 rounded-full border flex items-center gap-1 transition ${
                  r.userIds.includes(currentUserId)
                    ? 'bg-blue-500/10 border-blue-500/40 text-blue-700 dark:text-blue-300'
                    : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-500'
                }`}
              >
                {r.emoji} <span className="tabular-nums font-semibold">{r.count}</span>
              </button>
            ))}
          </div>
        )}

        <p className={`inline-flex items-center gap-1 text-[11px] mt-1 px-1 ${isOwn ? 'self-end text-slate-400 dark:text-slate-500' : 'text-slate-400 dark:text-slate-500'}`}>
          {formatTime(message.sentAt)}
          {isOwn && (message.readByUserIds.length > 1
            ? <CheckCheck className="w-3.5 h-3.5 text-blue-500" />
            : <Check className="w-3.5 h-3.5" />)}
        </p>

        {!message.isDeleted && (
          <div
            ref={menuRef}
            className={`absolute ${isOwn ? 'left-0' : 'right-0'} -top-3.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity flex items-center gap-1 z-10`}
          >
            <div className="relative">
              <button onClick={() => setShowEmojiPicker(p => !p)} className={actionBtn} title="React">
                <SmilePlus className="w-3.5 h-3.5" />
              </button>
              {showEmojiPicker && (
                <div className={`absolute bottom-9 ${isOwn ? 'right-0' : 'left-0'} bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full px-2 py-1.5 flex gap-1 shadow-xl z-10`}>
                  {emojis.map(e => (
                    <button
                      key={e}
                      onClick={() => { onReact(message.id, e); setShowEmojiPicker(false); }}
                      className="text-lg hover:scale-125 transition-transform"
                    >
                      {e}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button onClick={() => onReply(message)} className={actionBtn} title="Reply">
              <Reply className="w-3.5 h-3.5" />
            </button>
            {isOwn && (
              <div className="relative">
                <button onClick={() => setShowMenu(p => !p)} className={actionBtn} title="More">
                  <MoreVertical className="w-3.5 h-3.5" />
                </button>
                {showMenu && (
                  <div className="absolute right-0 bottom-9 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden shadow-xl z-10 w-32 py-1">
                    <button
                      onClick={() => { onEdit(message); setShowMenu(false); }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition"
                    >
                      <Pencil className="w-3.5 h-3.5" /> Edit
                    </button>
                    <button
                      onClick={() => { onDelete(message.id); setShowMenu(false); }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 transition"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Delete
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
//  Group Info Panel
// ─────────────────────────────────────────────────────────────────────────────
const GroupInfoPanel = ({
  detail, currentUserId, onClose, onLeave, onAddMembers, onRemoveMember
}: {
  detail: ConversationDetail;
  currentUserId: number;
  onClose: () => void;
  onLeave: () => void;
  onAddMembers: () => void;
  onRemoveMember: (uid: number, name: string) => void;
}) => {
  const isAdmin = detail.myRole === 'Admin';
  return (
    <div className="w-72 flex-shrink-0 bg-white dark:bg-slate-950 border-l border-slate-200 dark:border-slate-800 flex flex-col">
      <div className="flex items-center justify-between px-4 py-4 border-b border-slate-200 dark:border-slate-800">
        <p className="text-sm font-bold text-slate-900 dark:text-white">Group Info</p>
        <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition" aria-label="Close group info">
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        <div className="text-center">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center text-white mx-auto mb-3 shadow-md">
            <Users className="w-7 h-7" />
          </div>
          <p className="text-base font-bold text-slate-900 dark:text-white">{detail.groupName}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">{detail.members.length} members</p>
        </div>
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Members</p>
            {isAdmin && (
              <button onClick={onAddMembers} className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-500">
                <UserPlus className="w-3.5 h-3.5" /> Add
              </button>
            )}
          </div>
          <div className="space-y-1">
            {detail.members.map(m => (
              <div key={m.userId} className="flex items-center gap-2.5 p-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/40">
                <Avatar name={m.fullName} size="sm" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                    {m.fullName}
                    {m.userId === currentUserId && <span className="text-slate-400 dark:text-slate-500 font-normal ml-1">(you)</span>}
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">{m.role}</p>
                </div>
                {isAdmin && m.userId !== currentUserId && (
                  <button
                    onClick={() => onRemoveMember(m.userId, m.fullName)}
                    title={`Remove ${m.fullName}`}
                    className="p-1 rounded-lg text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-500/10 transition"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="p-4 border-t border-slate-200 dark:border-slate-800">
        <button
          onClick={onLeave}
          className="w-full inline-flex items-center justify-center gap-2 py-2.5 text-sm font-semibold text-rose-600 dark:text-rose-400 border border-rose-500/30 hover:bg-rose-500/10 rounded-xl transition"
        >
          <LogOut className="w-4 h-4" /> Leave Group
        </button>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
//  Message Input Bar
// ─────────────────────────────────────────────────────────────────────────────
const MessageInput = ({
  onSend, onTyping, onStopTyping, replyTo, onCancelReply, editingMessage, onCancelEdit, disabled = false
}: {
  onSend: (content: string, replyToId?: number) => void;
  onTyping: () => void;
  onStopTyping: () => void;
  replyTo: ChatMessage | null;
  onCancelReply: () => void;
  editingMessage: ChatMessage | null;
  onCancelEdit: () => void;
  disabled?: boolean;
}) => {
  const [value, setValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const typingTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (editingMessage) {
      setValue(editingMessage.content);
      textareaRef.current?.focus();
    }
  }, [editingMessage]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setValue(e.target.value);
    onTyping();
    if (typingTimeout.current) clearTimeout(typingTimeout.current);
    typingTimeout.current = setTimeout(onStopTyping, 2000);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(); }
    if (e.key === 'Escape') { onCancelReply(); onCancelEdit(); }
  };

  const handleSubmit = () => {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed, replyTo?.id);
    setValue('');
    onStopTyping();
    if (typingTimeout.current) clearTimeout(typingTimeout.current);
  };

  return (
    <div className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-3 sm:px-4 py-3 flex-shrink-0">
      {(replyTo || editingMessage) && (
        <div className="mb-2 flex items-center gap-2 rounded-xl px-3 py-2 border-l-2 border-blue-500 bg-blue-500/5">
          {editingMessage ? <Pencil className="w-4 h-4 text-blue-500 shrink-0" /> : <Reply className="w-4 h-4 text-blue-500 shrink-0" />}
          <div className="flex-1 min-w-0">
            <p className="text-blue-600 dark:text-blue-400 text-xs font-semibold">
              {editingMessage ? 'Editing message' : `Replying to ${replyTo?.senderName}`}
            </p>
            <p className="text-slate-500 dark:text-slate-400 text-xs truncate">
              {editingMessage ? editingMessage.content : replyTo?.content}
            </p>
          </div>
          <button
            onClick={() => { onCancelReply(); onCancelEdit(); }}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            aria-label="Cancel"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
      <div className="flex items-end gap-2">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={disabled ? 'Select a conversation...' : 'Type a message...'}
          disabled={disabled}
          rows={1}
          className="flex-1 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-2xl px-4 py-3 text-sm resize-none
            focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500
            placeholder:text-slate-400 dark:placeholder:text-slate-500 disabled:opacity-40 disabled:cursor-not-allowed
            min-h-[46px] max-h-32 overflow-y-auto"
          onInput={e => {
            const el = e.target as HTMLTextAreaElement;
            el.style.height = 'auto';
            el.style.height = Math.min(el.scrollHeight, 128) + 'px';
          }}
        />
        <button
          onClick={handleSubmit}
          disabled={!value.trim() || disabled}
          title={editingMessage ? 'Save edit' : 'Send'}
          className="w-[46px] h-[46px] flex-shrink-0 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl flex items-center justify-center shadow-md shadow-blue-500/20 transition disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none"
        >
          {editingMessage ? <Check className="w-5 h-5" /> : <SendHorizontal className="w-5 h-5" />}
        </button>
      </div>
      <p className="hidden sm:block text-[11px] text-slate-400 dark:text-slate-600 mt-1.5 text-center">
        Enter to send · Shift+Enter for new line · Esc to cancel
      </p>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
//  Conversation View
//  Receives `messages` and `setMessages` from ChatPage (single SignalR connection).
// ─────────────────────────────────────────────────────────────────────────────
const ConversationView = ({
  conversationId,
  currentUserId,
  messages,
  setMessages,
  typingUsers,
  onBack,
}: {
  conversationId: number;
  currentUserId: number;
  messages: ChatMessage[];
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  typingUsers: Set<number>;
  onBack: () => void;
}) => {
  const qc = useQueryClient();
  const { confirm } = useConfirm();
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [editingMessage, setEditingMessage] = useState<ChatMessage | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [showGroupInfo, setShowGroupInfo] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  const { sendTyping, stopTyping, markRead } = useChatHubActions();

  const { data: detail } = useQuery<ConversationDetail>({
    queryKey: ['convDetail', conversationId],
    queryFn: () => chatApi.getConversationDetail(conversationId),
  });

  // Load initial messages when conversation changes
  useEffect(() => {
    setMessages([]);
    setHasMore(true);
    chatApi.getMessages(conversationId, 50).then(msgs => {
      setMessages(msgs);
      setHasMore(msgs.length === 50);
    });
    markRead(conversationId);
    qc.setQueryData(['conversations'], (old: any) =>
      old?.map((c: any) =>
        c.id === conversationId ? { ...c, unreadCount: 0 } : c
      )
    );
    setReplyTo(null);
    setEditingMessage(null);
    setShowGroupInfo(false);
  }, [conversationId]);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const loadMore = useCallback(async () => {
    if (!hasMore || loadingMore || messages.length === 0) return;
    setLoadingMore(true);
    const oldest = messages[0]?.id;
    const older = await chatApi.getMessages(conversationId, 50, oldest);
    setMessages(prev => [...older, ...prev]);
    setHasMore(older.length === 50);
    setLoadingMore(false);
  }, [hasMore, loadingMore, messages, conversationId]);

  // Add the API-returned message immediately (SignalR echo is de-duplicated)
  const sendMutation = useMutation({
    mutationFn: (data: { content: string; replyToId?: number }) =>
      chatApi.sendMessage({
        conversationId,
        content: data.content,
        replyToMessageId: data.replyToId,
      }),
    onSuccess: (newMessage: ChatMessage) => {
      setMessages(prev => {
        if (prev.some(m => m.id === newMessage.id)) return prev;
        return [...prev, newMessage];
      });
      setReplyTo(null);
      // Patch cache directly (no refetch) so sidebar DOM stays stable
      qc.setQueryData<ConversationSummary[]>(['conversations'], (old) => {
        if (!old) return old;
        const updated = old.map(c => {
          if (c.id !== conversationId) return c;
          return {
            ...c,
            lastMessageAt: newMessage.sentAt,
            lastMessagePreview: newMessage.content ?? '',
            unreadCount: 0,
          };
        });
        return [...updated].sort((a, b) => {
          const ta = a.lastMessageAt ? parseUtcDate(a.lastMessageAt).getTime() : 0;
          const tb = b.lastMessageAt ? parseUtcDate(b.lastMessageAt).getTime() : 0;
          return tb - ta;
        });
      });
    },
  });

  const editMutation = useMutation({
    mutationFn: ({ id, content }: { id: number; content: string }) =>
      chatApi.editMessage(id, content),
    onSuccess: (updatedMessage: ChatMessage) => {
      setMessages(prev => prev.map(m => m.id === updatedMessage.id ? updatedMessage : m));
      setEditingMessage(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: chatApi.deleteMessage,
    onSuccess: (_: any, messageId: number) => {
      setMessages(prev => prev.map(m =>
        m.id === messageId ? { ...m, isDeleted: true, content: 'This message was deleted.' } : m
      ));
    },
  });

  const reactMutation = useMutation({
    mutationFn: ({ id, emoji }: { id: number; emoji: string }) =>
      chatApi.react(id, emoji),
  });

  const leaveMutation = useMutation({
    mutationFn: () => chatApi.leaveGroup(conversationId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['conversations'] });
      onBack();
    },
  });

  const handleSend = (content: string, replyToId?: number) => {
    if (editingMessage) {
      editMutation.mutate({ id: editingMessage.id, content });
    } else {
      sendMutation.mutate({ content, replyToId });
    }
  };

  const handleDelete = async (id: number) => {
    const ok = await confirm('This message will be deleted for everyone.', {
      title: 'Delete message?', confirmText: 'Delete', danger: true,
    });
    if (ok) deleteMutation.mutate(id);
  };

  const handleLeave = async () => {
    const ok = await confirm('You will stop receiving messages from this group.', {
      title: 'Leave this group?', confirmText: 'Leave', danger: true,
    });
    if (ok) leaveMutation.mutate();
  };

  const handleRemoveMember = async (uid: number, name: string) => {
    const ok = await confirm(`${name} will be removed from this group.`, {
      title: `Remove ${name}?`, confirmText: 'Remove', danger: true,
    });
    if (!ok) return;
    chatApi.removeMember(conversationId, uid)
      .then(() => qc.invalidateQueries({ queryKey: ['convDetail', conversationId] }));
  };

  const isGroup = detail?.type === 'Group';
  const conversationTitle = isGroup
    ? detail?.groupName ?? 'Group Chat'
    : detail?.members.find(m => m.userId !== currentUserId)?.fullName ?? '';

  const groupedMessages = groupMessagesByDate(messages);

  return (
    <div className="flex flex-1 min-w-0 h-full">
      <div className="flex flex-col flex-1 min-w-0 h-full">
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 flex-shrink-0">
          <button
            onClick={onBack}
            className="md:hidden p-1.5 -ml-1 rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            aria-label="Back to conversations"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <Avatar name={conversationTitle || '?'} isGroup={isGroup} size="md" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{conversationTitle}</p>
            <p className={`text-xs ${typingUsers.size > 0 ? 'text-emerald-600 dark:text-emerald-400 font-semibold' : 'text-slate-500 dark:text-slate-400'}`}>
              {typingUsers.size > 0 ? 'Typing…' : isGroup ? `${detail?.members.length ?? '?'} members` : 'Direct message'}
            </p>
          </div>
          {isGroup && (
            <button
              onClick={() => setShowGroupInfo(p => !p)}
              title="Group info"
              className={`w-9 h-9 rounded-xl flex items-center justify-center transition ${
                showGroupInfo
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                  : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Users className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Messages */}
        <div
          ref={messagesContainerRef}
          className="flex-1 overflow-y-auto px-3 sm:px-6 py-4 bg-slate-50 dark:bg-slate-900/40"
          onScroll={e => { if ((e.target as HTMLDivElement).scrollTop < 100) loadMore(); }}
        >
          {loadingMore && (
            <div className="flex items-center justify-center gap-2 py-2 text-xs text-slate-500 dark:text-slate-400">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading earlier messages…
            </div>
          )}
          {groupedMessages.length === 0 && !loadingMore && (
            <div className="h-full flex flex-col items-center justify-center text-center py-12">
              <div className="w-14 h-14 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                <MessageSquare className="w-7 h-7 text-blue-500" />
              </div>
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 mt-3">No messages yet</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Say hello 👋</p>
            </div>
          )}
          {groupedMessages.map(group => (
            <div key={group.date}>
              <div className="flex items-center gap-3 my-4">
                <div className="flex-1 h-px bg-slate-200 dark:bg-slate-800" />
                <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-3 py-0.5 rounded-full">
                  {group.date}
                </span>
                <div className="flex-1 h-px bg-slate-200 dark:bg-slate-800" />
              </div>
              {group.messages.map(msg => (
                <MessageBubble
                  key={msg.id}
                  message={msg}
                  isOwn={msg.senderId !== null && msg.senderId === currentUserId}
                  currentUserId={currentUserId}
                  onReply={setReplyTo}
                  onEdit={setEditingMessage}
                  onDelete={handleDelete}
                  onReact={(id, emoji) => reactMutation.mutate({ id, emoji })}
                />
              ))}
            </div>
          ))}
          {typingUsers.size > 0 && (
            <div className="flex items-center gap-2 px-2 mt-2">
              <div className="flex gap-1 px-3 py-2 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                {[0, 150, 300].map(d => (
                  <span key={d} className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: `${d}ms` }} />
                ))}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">Someone is typing…</p>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <MessageInput
          onSend={handleSend}
          onTyping={() => sendTyping(conversationId)}
          onStopTyping={() => stopTyping(conversationId)}
          replyTo={replyTo}
          onCancelReply={() => setReplyTo(null)}
          editingMessage={editingMessage}
          onCancelEdit={() => setEditingMessage(null)}
        />
      </div>

      {/* Group info panel */}
      {showGroupInfo && detail && (
        <GroupInfoPanel
          detail={detail}
          currentUserId={currentUserId}
          onClose={() => setShowGroupInfo(false)}
          onLeave={handleLeave}
          onAddMembers={() => { /* TODO: open add members modal */ }}
          onRemoveMember={handleRemoveMember}
        />
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
//  ChatHubActionsContext
//  Lets ConversationView call sendTyping/stopTyping/markRead
//  without having its own useChatHub connection.
// ─────────────────────────────────────────────────────────────────────────────
interface ChatHubActions {
  sendTyping: (conversationId: number) => void;
  stopTyping: (conversationId: number) => void;
  markRead: (conversationId: number) => void;
}

const ChatHubActionsContext = createContext<ChatHubActions>({
  sendTyping: () => {},
  stopTyping: () => {},
  markRead: () => {},
});

const useChatHubActions = () => useContext(ChatHubActionsContext);

// ─────────────────────────────────────────────────────────────────────────────
//  MAIN CHAT PAGE — the single source of truth
//  ✅ useChatHub is called ONCE here only.
//  ✅ messages + typingUsers state live here.
// ─────────────────────────────────────────────────────────────────────────────
export const ChatPage = () => {
  const qc = useQueryClient();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [showNewChat, setShowNewChat] = useState(false);

  // messages keyed by conversationId so switching convs is instant
  const [messagesMap, setMessagesMap] = useState<Record<number, ChatMessage[]>>({});
  const [typingUsers, setTypingUsers] = useState<Set<number>>(new Set());

  const getMessages = (convId: number): ChatMessage[] => messagesMap[convId] ?? [];
  const setMessages = (convId: number) =>
    (updater: React.SetStateAction<ChatMessage[]>) => {
      setMessagesMap(prev => {
        const current = prev[convId] ?? [];
        const next = typeof updater === 'function' ? updater(current) : updater;
        return { ...prev, [convId]: next };
      });
    };

  const { data: currentUser } = useQuery({
    queryKey: ['me'],
    queryFn: authApi.me,
  });
  const currentUserId = currentUser?.id ?? 0;

  const { data: conversations = [], isLoading } = useQuery<ConversationSummary[]>({
    queryKey: ['conversations'],
    queryFn: chatApi.getConversations,
    refetchInterval: 30000,
  });

  // ── Single SignalR connection for the entire ChatPage ───────────────────
  const { sendTyping, stopTyping, markRead, joinConversation } = useChatHub({

    // De-duplicates by id (sendMutation.onSuccess may have added it already)
    onMessage: (msg) => {
      setMessagesMap(prev => {
        const current = prev[msg.conversationId] ?? [];
        if (current.some(m => m.id === msg.id)) return prev;
        return { ...prev, [msg.conversationId]: [...current, msg] };
      });

      // Patch the conversations cache directly instead of invalidating it.
      // A refetch would replace sidebar <button> nodes mid-click and swallow
      // the click. Only brand-new conversations need a full refetch.
      const cachedConvs = qc.getQueryData<ConversationSummary[]>(['conversations']);
      const existsInCache = cachedConvs?.some(c => c.id === msg.conversationId);

      if (existsInCache) {
        qc.setQueryData<ConversationSummary[]>(['conversations'], (old) => {
          if (!old) return old;
          const updated = old.map(c => {
            if (c.id !== msg.conversationId) return c;
            return {
              ...c,
              lastMessageAt: msg.sentAt,
              lastMessagePreview: msg.isDeleted ? 'This message was deleted.' : (msg.content ?? ''),
              // Don't increment unread badge if this conversation is currently open
              unreadCount: selectedId === msg.conversationId ? c.unreadCount : c.unreadCount + 1,
            };
          });
          return [...updated].sort((a, b) => {
            const ta = a.lastMessageAt ? parseUtcDate(a.lastMessageAt).getTime() : 0;
            const tb = b.lastMessageAt ? parseUtcDate(b.lastMessageAt).getTime() : 0;
            return tb - ta;
          });
        });
      } else {
        qc.invalidateQueries({ queryKey: ['conversations'] });
      }
    },

    onMessageEdited: (msg) => {
      setMessagesMap(prev => {
        const current = prev[msg.conversationId] ?? [];
        return { ...prev, [msg.conversationId]: current.map(m => m.id === msg.id ? msg : m) };
      });
    },

    onMessageDeleted: ({ messageId }) => {
      setMessagesMap(prev => {
        const updated: Record<number, ChatMessage[]> = {};
        for (const [convId, msgs] of Object.entries(prev)) {
          updated[Number(convId)] = msgs.map(m =>
            m.id === messageId ? { ...m, isDeleted: true, content: 'This message was deleted.' } : m
          );
        }
        return updated;
      });
    },

    onReactionUpdated: ({ messageId, reactionCounts }) => {
      setMessagesMap(prev => {
        const updated: Record<number, ChatMessage[]> = {};
        for (const [convId, msgs] of Object.entries(prev)) {
          updated[Number(convId)] = msgs.map(m => {
            if (m.id !== messageId) return m;
            const reactions = Object.entries(reactionCounts).map(([emoji, count]) => ({
              emoji, count, userIds: []
            }));
            return { ...m, reactions };
          });
        }
        return updated;
      });
    },

    onConversationRead: ({ conversationId: cid, userId }) => {
      setMessagesMap(prev => {
        const current = prev[cid] ?? [];
        return {
          ...prev,
          [cid]: current.map(m => ({
            ...m,
            readByUserIds: m.readByUserIds.includes(userId)
              ? m.readByUserIds
              : [...m.readByUserIds, userId]
          }))
        };
      });
      qc.setQueryData(['conversations'], (old: any) =>
        old?.map((c: any) => c.id === cid ? { ...c, unreadCount: 0 } : c)
      );
    },

    onUserTyping: ({ conversationId: cid, userId }) => {
      if (cid === selectedId && userId !== currentUserId) {
        setTypingUsers(prev => new Set([...prev, userId]));
        setTimeout(() => {
          setTypingUsers(prev => { const s = new Set(prev); s.delete(userId); return s; });
        }, 3000);
      }
    },

    onUserStoppedTyping: ({ conversationId: cid, userId }) => {
      if (cid === selectedId) {
        setTypingUsers(prev => { const s = new Set(prev); s.delete(userId); return s; });
      }
    },

    onAddedToGroup: () => {
      qc.invalidateQueries({ queryKey: ['conversations'] });
    },

    onRemovedFromGroup: (data) => {
      if (data.conversationId === selectedId) setSelectedId(null);
      qc.invalidateQueries({ queryKey: ['conversations'] });
    },
  });

  // When user selects a conversation, join its SignalR group
  useEffect(() => {
    if (selectedId) {
      joinConversation(selectedId);
      setTypingUsers(new Set());
    }
  }, [selectedId]);

  const openDirectMutation = useMutation({
    mutationFn: chatApi.openDirect,
    onSuccess: (conv) => {
      qc.invalidateQueries({ queryKey: ['conversations'] });
      setSelectedId(conv.id);
    },
  });

  const createGroupMutation = useMutation({
    mutationFn: ({ name, members }: { name: string; members: number[] }) =>
      chatApi.createGroup({ groupName: name, memberIds: members }),
    onSuccess: (conv) => {
      qc.invalidateQueries({ queryKey: ['conversations'] });
      setSelectedId(conv.id);
    },
  });

  const hubActions: ChatHubActions = { sendTyping, stopTyping, markRead };

  return (
    <ChatHubActionsContext.Provider value={hubActions}>
      <div className="flex h-full bg-white dark:bg-slate-950">
        {/* Sidebar */}
        <div className={`w-full md:w-80 flex-shrink-0 ${selectedId ? 'hidden md:flex' : 'flex'} flex-col h-full`}>
          {isLoading ? (
            <div className="p-4 space-y-3 border-r border-slate-200 dark:border-slate-800 h-full">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-16 bg-slate-100 dark:bg-slate-800/60 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : (
            <ConversationSidebar
              conversations={conversations}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onNewChat={() => setShowNewChat(true)}
            />
          )}
        </div>

        {/* Main area */}
        <div className={`flex-1 min-w-0 ${!selectedId ? 'hidden md:flex' : 'flex'} h-full`}>
          {selectedId ? (
            <ConversationView
              key={selectedId}
              conversationId={selectedId}
              currentUserId={currentUserId}
              messages={getMessages(selectedId)}
              setMessages={setMessages(selectedId)}
              typingUsers={typingUsers}
              onBack={() => setSelectedId(null)}
            />
          ) : (
            <div className="flex-1 flex items-center justify-center bg-slate-50 dark:bg-slate-900/40 p-6">
              <div className="text-center max-w-sm">
                <div className="w-20 h-20 mx-auto rounded-3xl bg-gradient-to-br from-blue-600 via-indigo-600 to-violet-600 flex items-center justify-center text-white shadow-xl shadow-blue-500/20">
                  <MessagesSquare className="w-10 h-10" />
                </div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white mt-5">Your Messages</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
                  Select a conversation from the sidebar or start a new one.
                </p>
                <button
                  onClick={() => setShowNewChat(true)}
                  className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-semibold shadow-md shadow-blue-500/20 transition"
                >
                  <Plus className="w-4 h-4" /> Start a New Chat
                </button>
              </div>
            </div>
          )}
        </div>

        {showNewChat && (
          <NewChatModal
            onClose={() => setShowNewChat(false)}
            onOpenDirect={uid => openDirectMutation.mutate(uid)}
            onCreateGroup={(name, members) => createGroupMutation.mutate({ name, members })}
          />
        )}
      </div>
    </ChatHubActionsContext.Provider>
  );
};