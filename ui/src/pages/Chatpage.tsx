import { useState, useEffect, useRef, useCallback, KeyboardEvent } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ChatMessage, ConversationSummary, UserChatProfile, ConversationDetail } from '../types/index';
import { authApi, chatApi } from '../services/api';
import { useChatHub } from './useChatHub';
import { useConfirm } from '../hooks/useConfirm';

// ─────────────────────────────────────────────────────────────────────────────
const parseUtcDate = (iso: string): Date => {
  if (!iso) return new Date();
  // If string has no 'Z' at end AND no +HH:MM/-HH:MM offset → it's a .NET
  // naive DateTime string. Append 'Z' to tell JS to treat it as UTC.
  if (!iso.endsWith('Z') && !/[+-]\d{2}:?\d{2}$/.test(iso)) {
    return new Date(iso + 'Z');
  }
  return new Date(iso);
};

const formatTime = (iso: string) =>
  // ❌ Was: new Date(iso) — parsed .NET naive strings as local time (wrong offset)
  // ✅ Now: parseUtcDate(iso) — always interprets ambiguous strings as UTC first
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
    status === 'Online' ? 'bg-emerald-400' :
    status === 'Busy'   ? 'bg-amber-400'   : 'bg-slate-600';
  return <span className={`block w-2.5 h-2.5 rounded-full ring-2 ring-slate-900 ${color}`} />;
};

const Avatar = ({
  name, size = 'md', isGroup = false
}: { name: string; size?: 'sm' | 'md' | 'lg'; isGroup?: boolean }) => {
  const sizes = { sm: 'w-8 h-8 text-xs', md: 'w-10 h-10 text-sm', lg: 'w-12 h-12 text-base' };
  const initial = isGroup ? '👥' : name.charAt(0).toUpperCase();
  const bg = isGroup ? 'bg-violet-600/30 border-violet-500/30' : 'bg-blue-600/30 border-blue-500/30';
  return (
    <div className={`${sizes[size]} rounded-full border flex items-center justify-center font-semibold text-white flex-shrink-0 ${bg}`}>
      {initial}
    </div>
  );
};

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
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
          <h3 className="text-white font-semibold text-base">New Chat</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-xl">×</button>
        </div>
        <div className="flex px-5 pt-4 gap-2">
          {(['direct', 'group'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-1.5 rounded-xl text-sm font-medium transition ${
                tab === t ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
              }`}>
              {t === 'direct' ? '💬 Direct Message' : '👥 Group Chat'}
            </button>
          ))}
        </div>
        {tab === 'group' && (
          <div className="px-5 pt-4">
            <input placeholder="Group name..." value={groupName}
              onChange={e => setGroupName(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-slate-600" />
          </div>
        )}
        <div className="px-5 pt-3">
          <input placeholder="Search people..." value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-slate-600" />
        </div>
        {tab === 'group' && selected.length > 0 && (
          <div className="px-5 pt-2 flex flex-wrap gap-1.5">
            {selected.map(id => {
              const u = users.find(u => u.id === id);
              return u ? (
                <span key={id} className="text-xs bg-blue-600/20 border border-blue-500/30 text-blue-300 px-2 py-1 rounded-lg flex items-center gap-1">
                  {u.fullName}
                  <button onClick={() => toggleUser(id)} className="text-blue-400 hover:text-white">×</button>
                </span>
              ) : null;
            })}
          </div>
        )}
        <div className="overflow-y-auto max-h-64 mx-5 my-3 rounded-xl border border-slate-800">
          {filtered.length === 0 && (
            <p className="text-slate-500 text-sm text-center py-6">No users found</p>
          )}
          {filtered.map(u => (
            <button key={u.id}
              className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-slate-800/60 transition text-left"
              onClick={() => {
                if (tab === 'direct') { onOpenDirect(u.id); onClose(); }
                else toggleUser(u.id);
              }}>
              <div className="relative">
                <Avatar name={u.fullName} size="sm" />
                <div className="absolute -bottom-0.5 -right-0.5"><OnlineDot status={u.onlineStatus} /></div>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm font-medium truncate">{u.fullName}</p>
                <p className="text-slate-500 text-xs truncate">{u.role}</p>
              </div>
              {tab === 'group' && (
                <div className={`w-4 h-4 rounded border-2 flex-shrink-0 flex items-center justify-center ${
                  selected.includes(u.id) ? 'bg-blue-600 border-blue-600' : 'border-slate-600'
                }`}>
                  {selected.includes(u.id) && <span className="text-white text-[10px]">✓</span>}
                </div>
              )}
            </button>
          ))}
        </div>
        {tab === 'group' && (
          <div className="px-5 pb-4">
            <button
              disabled={!groupName.trim() || selected.length < 1}
              onClick={() => { onCreateGroup(groupName, selected); onClose(); }}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-xl transition">
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
    <div className="flex flex-col h-full bg-slate-950 border-r border-slate-800">
      <div className="px-4 py-4 border-b border-slate-800 flex-shrink-0">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <h2 className="text-white font-bold text-base">Messages</h2>
            {totalUnread > 0 && (
              <span className="text-xs bg-blue-600 text-white px-2 py-0.5 rounded-full font-bold">
                {totalUnread > 99 ? '99+' : totalUnread}
              </span>
            )}
          </div>
          <button onClick={onNewChat} title="New chat"
            className="w-8 h-8 bg-blue-600 hover:bg-blue-500 text-white rounded-xl flex items-center justify-center text-lg transition">
            +
          </button>
        </div>
        <input placeholder="Search conversations..." value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full bg-slate-800/60 border border-slate-700 text-white rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-slate-600" />
      </div>
      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 && (
          <div className="text-center py-10">
            <p className="text-3xl mb-2">💬</p>
            <p className="text-slate-500 text-sm">No conversations yet</p>
            <p className="text-slate-600 text-xs mt-1">Tap + to start one</p>
          </div>
        )}
        {filtered.map(conv => (
          <button key={conv.id} onClick={() => onSelect(conv.id)}
            className={`w-full flex items-center gap-3 px-4 py-3.5 hover:bg-slate-800/40 transition text-left border-b border-slate-800/30 ${
              selectedId === conv.id ? 'bg-slate-800/60 border-l-2 border-l-blue-500' : ''
            }`}>
            <div className="relative flex-shrink-0">
              <Avatar name={conv.displayName} size="md" isGroup={conv.type === 'Group'} />
              {conv.type === 'Direct' && (
                <div className="absolute -bottom-0.5 -right-0.5"><OnlineDot /></div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <p className={`text-sm truncate ${conv.unreadCount > 0 ? 'text-white font-semibold' : 'text-slate-300'}`}>
                  {conv.displayName}
                </p>
                {conv.lastMessageAt && (
                  <p className="text-xs text-slate-600 flex-shrink-0 ml-2">{formatTime(conv.lastMessageAt)}</p>
                )}
              </div>
              <div className="flex items-center justify-between mt-0.5">
                <p className="text-xs text-slate-500 truncate flex-1">
                  {conv.lastMessagePreview ?? (conv.type === 'Group' ? `${conv.memberCount} members` : 'No messages yet')}
                </p>
                {conv.unreadCount > 0 && (
                  <span className="ml-2 text-xs bg-blue-600 text-white rounded-full w-5 h-5 flex items-center justify-center font-bold flex-shrink-0">
                    {conv.unreadCount > 9 ? '9+' : conv.unreadCount}
                  </span>
                )}
              </div>
            </div>
          </button>
        ))}
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
        <span className="text-xs text-slate-500 bg-slate-800/50 px-3 py-1 rounded-full">{message.content}</span>
      </div>
    );
  }

  const emojis = ['👍', '❤️', '😂', '😮', '😢', '🔥'];

  return (
    <div className={`flex items-end gap-2 group ${isOwn ? 'flex-row-reverse' : 'flex-row'} mb-1`}>
      {!isOwn && (
        <div className="flex-shrink-0 mb-1">
          <div className="w-7 h-7 rounded-full bg-blue-600/30 border border-blue-500/30 flex items-center justify-center text-xs font-bold text-white">
            {message.senderInitial}
          </div>
        </div>
      )}
      <div className={`relative max-w-xs lg:max-w-md xl:max-w-lg ${isOwn ? 'items-end' : 'items-start'} flex flex-col`}>
        {!isOwn && <p className="text-xs text-slate-500 mb-1 px-1">{message.senderName}</p>}
        {message.replyTo && (
          <div className={`mb-1 px-3 py-1.5 rounded-xl border-l-2 border-blue-500 bg-slate-800/70 w-full ${isOwn ? 'text-right' : ''}`}>
            <p className="text-blue-400 text-xs font-medium">{message.replyTo.senderName}</p>
            <p className="text-slate-400 text-xs truncate">{message.replyTo.contentPreview}</p>
          </div>
        )}
        <div className={`relative px-4 py-2.5 rounded-2xl text-sm leading-relaxed shadow-sm ${
          isOwn ? 'bg-blue-600 text-white rounded-br-md' : 'bg-slate-800 text-slate-100 rounded-bl-md border border-slate-700'
        } ${message.isDeleted ? 'opacity-60 italic' : ''}`}>
          {message.content}
          {message.isEdited && !message.isDeleted && (
            <span className="text-xs opacity-50 ml-2">(edited)</span>
          )}
        </div>
        {message.reactions.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {message.reactions.map(r => (
              <button key={r.emoji} onClick={() => onReact(message.id, r.emoji)}
                className={`text-xs px-2 py-0.5 rounded-full border flex items-center gap-1 transition ${
                  r.userIds.includes(currentUserId)
                    ? 'bg-blue-600/30 border-blue-500/50 text-blue-300'
                    : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500'
                }`}>
                {r.emoji} <span className="tabular-nums">{r.count}</span>
              </button>
            ))}
          </div>
        )}
        <p className={`text-xs mt-1 px-1 ${isOwn ? 'text-right text-blue-300/60' : 'text-slate-600'}`}>
          {formatTime(message.sentAt)}
          {isOwn && message.readByUserIds.length > 1 && <span className="ml-1 text-blue-300/50">✓✓</span>}
        </p>
        {!message.isDeleted && (
          <div ref={menuRef}
            className={`absolute ${isOwn ? 'left-0' : 'right-0'} -top-3 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1`}>
            <div className="relative">
              <button onClick={() => setShowEmojiPicker(p => !p)}
                className="w-6 h-6 bg-slate-700 hover:bg-slate-600 rounded-full text-xs flex items-center justify-center text-slate-300">
                😊
              </button>
              {showEmojiPicker && (
                <div className={`absolute bottom-7 ${isOwn ? 'right-0' : 'left-0'} bg-slate-800 border border-slate-700 rounded-xl px-2 py-1.5 flex gap-1 shadow-xl z-10`}>
                  {emojis.map(e => (
                    <button key={e} onClick={() => { onReact(message.id, e); setShowEmojiPicker(false); }}
                      className="text-lg hover:scale-125 transition-transform">{e}</button>
                  ))}
                </div>
              )}
            </div>
            <button onClick={() => onReply(message)}
              className="w-6 h-6 bg-slate-700 hover:bg-slate-600 rounded-full text-xs flex items-center justify-center text-slate-300">
              ↩
            </button>
            {isOwn && (
              <div className="relative">
                <button onClick={() => setShowMenu(p => !p)}
                  className="w-6 h-6 bg-slate-700 hover:bg-slate-600 rounded-full text-xs flex items-center justify-center text-slate-300">
                  ⋮
                </button>
                {showMenu && (
                  <div className="absolute right-0 bottom-7 bg-slate-800 border border-slate-700 rounded-xl overflow-hidden shadow-xl z-10 w-28">
                    <button onClick={() => { onEdit(message); setShowMenu(false); }}
                      className="w-full text-left px-3 py-2 text-xs text-slate-300 hover:bg-slate-700 transition">
                      ✏️ Edit
                    </button>
                    <button onClick={() => { onDelete(message.id); setShowMenu(false); }}
                      className="w-full text-left px-3 py-2 text-xs text-red-400 hover:bg-slate-700 transition">
                      🗑️ Delete
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
  onRemoveMember: (uid: number) => void;
}) => {
  const isAdmin = detail.myRole === 'Admin';
  return (
    <div className="w-64 flex-shrink-0 bg-slate-950 border-l border-slate-800 flex flex-col">
      <div className="flex items-center justify-between px-4 py-4 border-b border-slate-800">
        <p className="text-white font-semibold text-sm">Group Info</p>
        <button onClick={onClose} className="text-slate-500 hover:text-white">×</button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div className="text-center">
          <div className="w-16 h-16 rounded-2xl bg-violet-600/20 border border-violet-500/30 flex items-center justify-center text-2xl mx-auto mb-2">👥</div>
          <p className="text-white font-semibold">{detail.groupName}</p>
          <p className="text-slate-500 text-xs">{detail.members.length} members</p>
        </div>
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Members</p>
            {isAdmin && (
              <button onClick={onAddMembers} className="text-xs text-blue-400 hover:text-blue-300">+ Add</button>
            )}
          </div>
          <div className="space-y-2">
            {detail.members.map(m => (
              <div key={m.userId} className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-xs font-bold text-slate-300">
                  {m.fullName.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white text-xs font-medium truncate">
                    {m.fullName}
                    {m.userId === currentUserId && <span className="text-slate-500 ml-1">(you)</span>}
                  </p>
                  <p className="text-slate-600 text-xs">{m.role}</p>
                </div>
                {isAdmin && m.userId !== currentUserId && (
                  <button onClick={() => window.confirm(`Remove ${m.fullName}?`) && onRemoveMember(m.userId)}
                    className="text-slate-600 hover:text-red-400 text-xs">✕</button>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="p-4 border-t border-slate-800">
        <button onClick={onLeave}
          className="w-full py-2 text-xs text-red-400 border border-red-500/20 hover:bg-red-500/10 rounded-xl transition">
          🚪 Leave Group
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
    <div className="border-t border-slate-800 bg-slate-950 px-4 py-3 flex-shrink-0">
      {(replyTo || editingMessage) && (
        <div className="mb-2 flex items-center gap-2 bg-slate-800/60 rounded-xl px-3 py-2 border-l-2 border-blue-500">
          <div className="flex-1 min-w-0">
            <p className="text-blue-400 text-xs font-medium">
              {editingMessage ? '✏️ Editing message' : `↩ Replying to ${replyTo?.senderName}`}
            </p>
            <p className="text-slate-400 text-xs truncate">
              {editingMessage ? editingMessage.content : replyTo?.content}
            </p>
          </div>
          <button onClick={() => { onCancelReply(); onCancelEdit(); }}
            className="text-slate-500 hover:text-white text-lg">×</button>
        </div>
      )}
      <div className="flex items-end gap-3">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={disabled ? 'Select a conversation...' : 'Type a message... (Shift+Enter for new line)'}
          disabled={disabled}
          rows={1}
          className="flex-1 bg-slate-800 border border-slate-700 text-white rounded-2xl px-4 py-3 text-sm resize-none
            focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
            placeholder:text-slate-600 disabled:opacity-40 disabled:cursor-not-allowed
            min-h-[44px] max-h-32 overflow-y-auto"
          onInput={e => {
            const el = e.target as HTMLTextAreaElement;
            el.style.height = 'auto';
            el.style.height = Math.min(el.scrollHeight, 128) + 'px';
          }}
        />
        <button onClick={handleSubmit} disabled={!value.trim() || disabled}
          className="w-11 h-11 flex-shrink-0 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed
            text-white rounded-2xl flex items-center justify-center text-lg transition shadow-lg">
          {editingMessage ? '✓' : '➤'}
        </button>
      </div>
      <p className="text-xs text-slate-700 mt-1 text-center">Enter to send · Shift+Enter for new line · Esc to cancel</p>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
//  Conversation View
//
//  ✅ FIXED: No longer calls useChatHub() itself.
//     Receives `messages` and `setMessages` as props from ChatPage.
//     This ensures there is exactly ONE SignalR connection for the whole page.
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
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [editingMessage, setEditingMessage] = useState<ChatMessage | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [showGroupInfo, setShowGroupInfo] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  // These come from the parent's useChatHub — passed via context/callback
  // We retrieve them from the parent scope via the prop pattern below
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
    // Reset UI state on conversation switch
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

  // ✅ FIXED: onSuccess now adds the returned message to state IMMEDIATELY
  // Instead of waiting for SignalR to broadcast the message back.
  // The message object returned by the API is the source of truth.
  const sendMutation = useMutation({
    mutationFn: (data: { content: string; replyToId?: number }) =>
      chatApi.sendMessage({
        conversationId,
        content: data.content,
        replyToMessageId: data.replyToId,
      }),
    onSuccess: (newMessage: ChatMessage) => {
      // ✅ Add directly to state — no waiting for SignalR
      setMessages(prev => {
        // Deduplicate: SignalR might also send this message back
        // (it will when the sender is also in the group).
        // If the ID already exists, skip to prevent duplicates.
        if (prev.some(m => m.id === newMessage.id)) return prev;
        return [...prev, newMessage];
      });
      setReplyTo(null);
      // ✅ BUG 2 FIX (same as onMessage): patch cache directly instead of
      // invalidateQueries to avoid mid-click DOM replacement in the sidebar.
      qc.setQueryData<ConversationSummary[]>(['conversations'], (old) => {
        if (!old) return old;
        const updated = old.map(c => {
          if (c.id !== conversationId) return c;
          return {
            ...c,
            lastMessageAt: newMessage.sentAt,
            lastMessagePreview: newMessage.content ?? '',
            // Sender's own conversation — unread stays 0 (they just sent it)
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

  const isGroup = detail?.type === 'Group';
  const conversationTitle = isGroup
    ? detail?.groupName ?? 'Group Chat'
    : detail?.members.find(m => m.userId !== currentUserId)?.fullName ?? '';

  const groupedMessages = groupMessagesByDate(messages);

  return (
    <div className="flex flex-1 min-w-0 h-full">
      <div className="flex flex-col flex-1 min-w-0 h-full">
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-slate-800 bg-slate-950 flex-shrink-0">
          <button onClick={onBack} className="text-slate-400 hover:text-white md:hidden mr-1">←</button>
          <Avatar name={conversationTitle} isGroup={isGroup} size="md" />
          <div className="flex-1 min-w-0">
            <p className="text-white font-semibold text-sm truncate">{conversationTitle}</p>
            <p className="text-slate-500 text-xs">
              {typingUsers.size > 0 ? 'Typing...' : isGroup ? `${detail?.members.length ?? '?'} members` : 'Direct message'}
            </p>
          </div>
          {isGroup && (
            <button onClick={() => setShowGroupInfo(p => !p)} title="Group info"
              className={`w-8 h-8 rounded-xl flex items-center justify-center text-sm transition ${
                showGroupInfo ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'
              }`}>
              👥
            </button>
          )}
        </div>

        {/* Messages */}
        <div ref={messagesContainerRef}
          className="flex-1 overflow-y-auto px-4 py-4 space-y-1"
          onScroll={e => { if ((e.target as HTMLDivElement).scrollTop < 100) loadMore(); }}>
          {loadingMore && (
            <div className="text-center py-2 text-slate-500 text-xs">Loading earlier messages...</div>
          )}
          {groupedMessages.map(group => (
            <div key={group.date}>
              <div className="flex items-center gap-3 my-4">
                <div className="flex-1 h-px bg-slate-800" />
                <span className="text-xs text-slate-600 bg-slate-900 px-3">{group.date}</span>
                <div className="flex-1 h-px bg-slate-800" />
              </div>
              {group.messages.map(msg => (
                <MessageBubble
                  key={msg.id}
                  message={msg}
                  isOwn={msg.senderId !== null && msg.senderId === currentUserId}
                  currentUserId={currentUserId}
                  onReply={setReplyTo}
                  onEdit={setEditingMessage}
                  onDelete={id => { if (window.confirm('Delete this message?')) deleteMutation.mutate(id); }}
                  onReact={(id, emoji) => reactMutation.mutate({ id, emoji })}
                />
              ))}
            </div>
          ))}
          {typingUsers.size > 0 && (
            <div className="flex items-center gap-2 px-2 mt-2">
              <div className="flex gap-1">
                {[0, 150, 300].map(d => (
                  <span key={d} className="w-2 h-2 bg-slate-400 rounded-full animate-bounce"
                    style={{ animationDelay: `${d}ms` }} />
                ))}
              </div>
              <p className="text-slate-500 text-xs">Someone is typing...</p>
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
          onLeave={() => { if (window.confirm('Leave this group?')) leaveMutation.mutate(); }}
          onAddMembers={() => { /* TODO: open add members modal */ }}
          onRemoveMember={uid => chatApi.removeMember(conversationId, uid)
            .then(() => qc.invalidateQueries({ queryKey: ['convDetail', conversationId] }))}
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
import { createContext, useContext } from 'react';

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
//  MAIN CHAT PAGE  —  The single source of truth
//
//  ✅ useChatHub is called ONCE here only.
//  ✅ messages state lives here and is passed down to ConversationView.
//  ✅ typingUsers state lives here.
//  ✅ All SignalR events are handled here and update shared state.
// ─────────────────────────────────────────────────────────────────────────────
export const ChatPage = () => {
  const qc = useQueryClient();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [showNewChat, setShowNewChat] = useState(false);
  const { confirm } = useConfirm();

  // ── Shared state owned by ChatPage ──────────────────────────────────────
  // messages is keyed by conversationId so switching convs is instant
  const [messagesMap, setMessagesMap] = useState<Record<number, ChatMessage[]>>({});
  const [typingUsers, setTypingUsers] = useState<Set<number>>(new Set());

  // Helper: get/set messages for a specific conversation
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

    // ✅ FIXED: onMessage now deduplicates by ID.
    // This prevents double-rendering when sendMutation.onSuccess AND
    // SignalR both add the same message (sender's own message).
    onMessage: (msg) => {
      setMessagesMap(prev => {
        const current = prev[msg.conversationId] ?? [];
        // Deduplicate: if this message ID already exists (added by onSuccess), skip
        if (current.some(m => m.id === msg.id)) return prev;
        return { ...prev, [msg.conversationId]: [...current, msg] };
      });

      // ─────────────────────────────────────────────────────────────────────
      //  ✅ BUG 2 FIX — Clicking a conversation in the sidebar does nothing
      //
      //  ROOT CAUSE:
      //    The original code called qc.invalidateQueries({ queryKey: ['conversations'] })
      //    on every incoming SignalR message.
      //
      //    invalidateQueries marks the cache as stale and triggers a background
      //    HTTP refetch of the entire conversations list. When the refetch
      //    response arrives, React re-renders ConversationSidebar and REPLACES
      //    all <button> elements with brand-new DOM nodes.
      //
      //    A browser click = mousedown + mouseup on the SAME DOM node.
      //    If a re-render happens between mousedown and mouseup, the button
      //    element is swapped out. mouseup lands on a different DOM node →
      //    browser drops the click → onClick is never called → setSelectedId
      //    is never called → the chat window never opens.
      //
      //    This is exactly why "click somewhere else, come back, click again"
      //    works: by then the refetch is complete and there's no pending
      //    re-render that can interrupt the click.
      //
      //  FIX:
      //    Use qc.setQueryData to update the conversations cache DIRECTLY
      //    and SYNCHRONOUSLY — no network request, no DOM node replacement.
      //    React will re-render the sidebar but only update props on existing
      //    DOM nodes (changing text/className), not replace the buttons.
      //    The DOM elements stay stable → clicks are never swallowed.
      //
      //    Only fall back to invalidateQueries for genuinely new conversations
      //    that don't exist in the cache yet (can't patch what isn't there).
      // ─────────────────────────────────────────────────────────────────────
      const cachedConvs = qc.getQueryData<ConversationSummary[]>(['conversations']);
      const existsInCache = cachedConvs?.some(c => c.id === msg.conversationId);

      if (existsInCache) {
        // ✅ Patch in-memory cache directly — stable DOM, clicks never lost
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
          // Keep list sorted by most recent message, same as server ordering
          return [...updated].sort((a, b) => {
            const ta = a.lastMessageAt ? parseUtcDate(a.lastMessageAt).getTime() : 0;
            const tb = b.lastMessageAt ? parseUtcDate(b.lastMessageAt).getTime() : 0;
            return tb - ta;
          });
        });
      } else {
        // Brand-new conversation not yet in cache — full refetch needed to get
        // its display name, type, member list etc. User hasn't seen it yet
        // so there's nothing they can be clicking on yet.
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
      setTypingUsers(new Set()); // Clear typing state from previous conv
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

  // Provide hub actions to ConversationView without prop drilling
  const hubActions: ChatHubActions = { sendTyping, stopTyping, markRead };

  return (
    <ChatHubActionsContext.Provider value={hubActions}>
      <div className="flex h-full bg-slate-950">
        {/* Sidebar */}
        <div className={`w-72 flex-shrink-0 ${selectedId ? 'hidden md:flex' : 'flex'} flex-col h-full`}>
          {isLoading ? (
            <div className="p-4 space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-14 bg-slate-800 rounded-2xl animate-pulse" />
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
            <div className="flex-1 flex items-center justify-center bg-slate-950/50">
              <div className="text-center">
                <div className="text-6xl mb-4">💬</div>
                <h3 className="text-white text-xl font-semibold">Your Messages</h3>
                <p className="text-slate-500 text-sm mt-2 max-w-xs">
                  Select a conversation from the sidebar or start a new one
                </p>
                <button onClick={() => setShowNewChat(true)}
                  className="mt-5 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-semibold transition">
                  Start a New Chat
                </button>
              </div>
            </div>
          )}
        </div>

        {/* New Chat Modal */}
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