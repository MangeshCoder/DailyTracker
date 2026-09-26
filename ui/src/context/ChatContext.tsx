// ─────────────────────────────────────────────────────────────────────────────
//  FILE: ui/src/context/ChatContext.tsx
//  One chat connection for the whole app (mounted in Layout)
//
//  ✅ Single SignalR connection to /hubs/chat — built from VITE_API_URL like
//     the notification hub (the old relative '/hubs/chat' hit the Vite dev
//     server, so real-time chat and "mark as read" never reached the API)
//  ✅ Unread counts: only messages from OTHER people count, and never for the
//     conversation you're currently looking at
//  ✅ Mark-as-read goes through REST (reliable, even while the socket is still
//     connecting) and is re-sent when new messages arrive in the open chat,
//     so counts stay correct after logout / login
//  ✅ Handles the server's 'JoinConversation' event (new direct chats started
//     by someone else now arrive live)
//  ✅ Presence (who is online), total unread badge, "(n)" in the tab title
//  ✅ Chat dock (floating bubble panel) open/close state
// ─────────────────────────────────────────────────────────────────────────────

import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
  type ReactNode,
} from 'react';
import type { HubConnection } from '@microsoft/signalr';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocation } from 'react-router-dom';
import { chatApi } from '../services/api';
import type { ChatMessage, ConversationSummary, UserChatProfile } from '../types';
import { useAuth } from './Authcontext';
import { useToast } from './ToastContext';
import { getHubBaseUrl } from './SignalRContext';

export type ChatConnectionState = 'connecting' | 'connected' | 'reconnecting' | 'disconnected';

export interface ChatHubCallbacks {
  onMessage?: (message: ChatMessage) => void;
  onMessageEdited?: (message: ChatMessage) => void;
  onMessageDeleted?: (data: { messageId: number }) => void;
  onReactionUpdated?: (data: { messageId: number; emoji: string; reactionCounts: Record<string, number> }) => void;
  onUserTyping?: (data: { conversationId: number; userId: number }) => void;
  onUserStoppedTyping?: (data: { conversationId: number; userId: number }) => void;
  onConversationRead?: (data: { conversationId: number; userId: number; readAt: string }) => void;
  onAddedToGroup?: (data: { conversationId: number; groupName?: string }) => void;
  onRemovedFromGroup?: (data: { conversationId: number }) => void;
  onMembersAdded?: (data: { conversationId: number; addedUserIds: number[] }) => void;
  onMemberLeft?: (data: { conversationId: number; userId: number }) => void;
  onGroupInfoUpdated?: (data: { conversationId: number; groupName?: string }) => void;
}

type Listener = { current: ChatHubCallbacks };

interface ChatContextValue {
  connectionState: ChatConnectionState;
  conversations: ConversationSummary[];
  conversationsLoading: boolean;
  totalUnread: number;
  isOnline: (userId?: number | null) => boolean;
  subscribe: (listener: Listener) => () => void;
  sendTyping: (conversationId: number) => void;
  stopTyping: (conversationId: number) => void;
  markRead: (conversationId: number) => void;
  joinConversation: (conversationId: number) => void;
  setActiveConversation: (conversationId: number | null) => void;
  dock: { open: boolean; conversationId: number | null };
  openDock: (conversationId?: number | null) => void;
  closeDock: () => void;
}

const noop = () => {};
const ChatContext = createContext<ChatContextValue>({
  connectionState: 'disconnected',
  conversations: [],
  conversationsLoading: false,
  totalUnread: 0,
  isOnline: () => false,
  subscribe: () => noop,
  sendTyping: noop,
  stopTyping: noop,
  markRead: noop,
  joinConversation: noop,
  setActiveConversation: noop,
  dock: { open: false, conversationId: null },
  openDock: noop,
  closeDock: noop,
});

// .NET sends naive UTC timestamps (no 'Z') — treat them as UTC
export const parseUtcDate = (iso?: string): Date => {
  if (!iso) return new Date(0);
  return new Date(!iso.endsWith('Z') && !/[+-]\d{2}:?\d{2}$/.test(iso) ? iso + 'Z' : iso);
};

const sortByLatest = (list: ConversationSummary[]) =>
  [...list].sort((a, b) => parseUtcDate(b.lastMessageAt).getTime() - parseUtcDate(a.lastMessageAt).getTime());

const previewOf = (msg: ChatMessage) =>
  msg.isDeleted ? 'This message was deleted.'
  : msg.content ? msg.content
  : msg.attachmentName ? `📎 ${msg.attachmentName}`
  : '';

// Other floating widgets (AI Help) listen to this to avoid overlapping panels
export const CHAT_DOCK_EVENT = 'chat-dock:toggle';
export const AI_WIDGET_EVENT = 'ai-widget:toggle';

export const ChatProvider = ({ children }: { children: ReactNode }) => {
  const { user, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const location = useLocation();

  const [connectionState, setConnectionState] = useState<ChatConnectionState>('disconnected');
  const [presence, setPresence] = useState<Record<number, boolean>>({});
  const [dock, setDock] = useState<{ open: boolean; conversationId: number | null }>({ open: false, conversationId: null });

  const connRef = useRef<HubConnection | null>(null);
  const listenersRef = useRef(new Set<Listener>());
  const activeRef = useRef<number | null>(null);
  const userIdRef = useRef<number | null>(user?.id ?? null);
  const readTimers = useRef(new Map<number, ReturnType<typeof setTimeout>>());
  const uiRef = useRef({ dockOpen: false, onChatPage: false });
  const toastRef = useRef(toast);   // toast object is re-created every render
  toastRef.current = toast;

  userIdRef.current = user?.id ?? null;
  uiRef.current = { dockOpen: dock.open, onChatPage: location.pathname.startsWith('/chat') };

  // ── Conversations (shared cache key with the chat UI) ────────────────────
  const { data: conversations = [], isLoading: conversationsLoading } = useQuery<ConversationSummary[]>({
    queryKey: ['conversations'],
    queryFn: chatApi.getConversations,
    enabled: isAuthenticated,
    refetchInterval: 60_000,   // safety net; live updates come over SignalR
  });

  // Seed presence from the users list, then keep it live from hub events
  const { data: chatUsers } = useQuery<UserChatProfile[]>({
    queryKey: ['chatUsers'],
    queryFn: chatApi.getUsers,
    enabled: isAuthenticated,
    staleTime: 5 * 60_000,
  });
  useEffect(() => {
    if (!chatUsers) return;
    setPresence(prev => {
      const next = { ...prev };
      for (const u of chatUsers) if (!(u.id in next)) next[u.id] = u.onlineStatus === 'Online';
      return next;
    });
  }, [chatUsers]);

  const totalUnread = useMemo(
    () => conversations.reduce((sum, c) => sum + (c.unreadCount || 0), 0),
    [conversations],
  );

  const emit = useCallback(<K extends keyof ChatHubCallbacks>(event: K, data: Parameters<NonNullable<ChatHubCallbacks[K]>>[0]) => {
    listenersRef.current.forEach(l => (l.current[event] as ((d: typeof data) => void) | undefined)?.(data));
  }, []);

  const patchConversation = useCallback((id: number, patch: (c: ConversationSummary) => ConversationSummary) => {
    qc.setQueryData<ConversationSummary[]>(['conversations'], old => old?.map(c => (c.id === id ? patch(c) : c)));
  }, [qc]);

  // ── Mark as read (REST, debounced per conversation) ──────────────────────
  const markRead = useCallback((conversationId: number) => {
    patchConversation(conversationId, c => ({ ...c, unreadCount: 0 }));
    const timers = readTimers.current;
    clearTimeout(timers.get(conversationId));
    timers.set(conversationId, setTimeout(() => {
      timers.delete(conversationId);
      chatApi.markRead(conversationId).catch(() => { /* next refetch shows the true count */ });
    }, 300));
  }, [patchConversation]);


  // ── Hub connection lifecycle ──────────────────────────────────────────────
  useEffect(() => {
    if (!isAuthenticated) return;
    let disposed = false;

    (async () => {
      const { HubConnectionBuilder, LogLevel } = await import('@microsoft/signalr');
      if (disposed) return;

      const conn = new HubConnectionBuilder()
        .withUrl(`${getHubBaseUrl()}/hubs/chat`, { withCredentials: true })
        .withAutomaticReconnect([0, 2000, 5000, 10000, 30000])
        .configureLogging(LogLevel.Warning)
        .build();
      connRef.current = conn;

      conn.on('ReceiveMessage', (msg: ChatMessage) => {
        const fromOther = msg.senderId !== userIdRef.current;
        const viewing = activeRef.current === msg.conversationId && document.visibilityState === 'visible';
        const cached = qc.getQueryData<ConversationSummary[]>(['conversations']);

        if (cached?.some(c => c.id === msg.conversationId)) {
          qc.setQueryData<ConversationSummary[]>(['conversations'], old => old && sortByLatest(old.map(c =>
            c.id !== msg.conversationId ? c : {
              ...c,
              lastMessageAt: msg.sentAt,
              lastMessagePreview: previewOf(msg),
              unreadCount: viewing ? 0 : fromOther ? (c.unreadCount || 0) + 1 : c.unreadCount,
            })));
        } else {
          qc.invalidateQueries({ queryKey: ['conversations'] });
        }

        if (fromOther && viewing) markRead(msg.conversationId);
        if (fromOther && !viewing && !uiRef.current.dockOpen && !uiRef.current.onChatPage) {
          const text = previewOf(msg);
          toastRef.current.info(`💬 ${msg.senderName}: ${text.length > 60 ? text.slice(0, 60) + '…' : text}`, 4000);
        }
        emit('onMessage', msg);
      });

      conn.on('MessageEdited', (msg: ChatMessage) => emit('onMessageEdited', msg));
      conn.on('MessageDeleted', (d) => emit('onMessageDeleted', d));
      conn.on('ReactionUpdated', (d) => emit('onReactionUpdated', d));
      conn.on('UserTyping', (d) => emit('onUserTyping', d));
      conn.on('UserStoppedTyping', (d) => emit('onUserStoppedTyping', d));

      conn.on('ConversationRead', (d: { conversationId: number; userId: number; readAt: string }) => {
        // Only MY reads (e.g. from another tab/device) clear MY badge
        if (d.userId === userIdRef.current) patchConversation(d.conversationId, c => ({ ...c, unreadCount: 0 }));
        emit('onConversationRead', d);
      });

      // Server asks us to subscribe to a conversation created after we connected
      conn.on('JoinConversation', (conversationId: number) => {
        conn.invoke('JoinConversation', conversationId).catch(() => {});
        qc.invalidateQueries({ queryKey: ['conversations'] });
      });
      conn.on('AddedToGroup', (d: { conversationId: number; groupName?: string }) => {
        conn.invoke('JoinConversation', d.conversationId).catch(() => {});
        qc.invalidateQueries({ queryKey: ['conversations'] });
        emit('onAddedToGroup', d);
      });
      conn.on('RemovedFromGroup', (d: { conversationId: number }) => {
        qc.invalidateQueries({ queryKey: ['conversations'] });
        emit('onRemovedFromGroup', d);
      });
      conn.on('MembersAdded', (d) => {
        qc.invalidateQueries({ queryKey: ['convDetail', d.conversationId] });
        emit('onMembersAdded', d);
      });
      conn.on('MemberLeft', (d) => {
        qc.invalidateQueries({ queryKey: ['convDetail', d.conversationId] });
        emit('onMemberLeft', d);
      });
      conn.on('MemberRemoved', (d: { conversationId: number }) => {
        qc.invalidateQueries({ queryKey: ['convDetail', d.conversationId] });
      });
      conn.on('GroupInfoUpdated', (d) => {
        qc.invalidateQueries({ queryKey: ['conversations'] });
        qc.invalidateQueries({ queryKey: ['convDetail', d.conversationId] });
        emit('onGroupInfoUpdated', d);
      });

      conn.on('UserOnline', (d: { userId: number }) => setPresence(p => ({ ...p, [d.userId]: true })));
      conn.on('UserOffline', (d: { userId: number }) => setPresence(p => ({ ...p, [d.userId]: false })));

      conn.onreconnecting(() => setConnectionState('reconnecting'));
      conn.onreconnected(() => {
        setConnectionState('connected');
        // Catch up on anything missed while offline
        qc.invalidateQueries({ queryKey: ['conversations'] });
      });
      conn.onclose(() => setConnectionState('disconnected'));

      setConnectionState('connecting');
      try {
        await conn.start();
        if (!disposed) setConnectionState('connected');
      } catch (err) {
        console.warn('Chat connection failed', err);
        if (!disposed) setConnectionState('disconnected');
      }
    })();

    return () => {
      disposed = true;
      connRef.current?.stop().catch(() => {});
      connRef.current = null;
      setConnectionState('disconnected');
    };
  }, [isAuthenticated, qc, emit, markRead, patchConversation]);

  // ── Keep the open conversation read ───────────────────────────────────────
  // Covers messages that arrived while the tab was hidden and refetches that
  // still report unread for the chat you're looking at.
  useEffect(() => {
    const active = activeRef.current;
    if (active == null || document.visibilityState !== 'visible') return;
    if (conversations.some(c => c.id === active && c.unreadCount > 0)) markRead(active);
  }, [conversations, markRead]);

  useEffect(() => {
    const onVisible = () => {
      const active = activeRef.current;
      if (active == null || document.visibilityState !== 'visible') return;
      const cached = qc.getQueryData<ConversationSummary[]>(['conversations']);
      if (cached?.some(c => c.id === active && c.unreadCount > 0)) markRead(active);
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    };
  }, [qc, markRead]);

  // ── "(3) Montcrest EMS" in the browser tab ────────────────────────────────
  useEffect(() => {
    const base = document.title.replace(/^\(\d+\+?\)\s*/, '');
    document.title = totalUnread > 0 ? `(${totalUnread > 99 ? '99+' : totalUnread}) ${base}` : base;
  }, [totalUnread]);

  // ── Dock (floating chat panel) ─────────────────────────────────────────────
  const openDock = useCallback((conversationId: number | null = null) => {
    setDock({ open: true, conversationId });
    window.dispatchEvent(new CustomEvent(CHAT_DOCK_EVENT, { detail: true }));
  }, []);
  const closeDock = useCallback(() => {
    setDock(d => ({ ...d, open: false }));
    window.dispatchEvent(new CustomEvent(CHAT_DOCK_EVENT, { detail: false }));
  }, []);

  // Opening the AI assistant closes the chat panel (they share the corner)
  useEffect(() => {
    const onAi = (e: Event) => { if ((e as CustomEvent<boolean>).detail) closeDock(); };
    window.addEventListener(AI_WIDGET_EVENT, onAi);
    return () => window.removeEventListener(AI_WIDGET_EVENT, onAi);
  }, [closeDock]);

  // Close the panel when navigating to the full chat page
  useEffect(() => {
    if (location.pathname.startsWith('/chat') && dock.open) closeDock();
  }, [location.pathname, dock.open, closeDock]);

  // ── Public API ────────────────────────────────────────────────────────────
  const subscribe = useCallback((listener: Listener) => {
    listenersRef.current.add(listener);
    return () => { listenersRef.current.delete(listener); };
  }, []);

  const invoke = useCallback((method: string, conversationId: number) => {
    const conn = connRef.current;
    if (conn && conn.state === 'Connected') conn.invoke(method, conversationId).catch(() => {});
  }, []);

  const sendTyping = useCallback((id: number) => invoke('StartTyping', id), [invoke]);
  const stopTyping = useCallback((id: number) => invoke('StopTyping', id), [invoke]);
  const joinConversation = useCallback((id: number) => invoke('JoinConversation', id), [invoke]);

  const setActiveConversation = useCallback((id: number | null) => {
    activeRef.current = id;
    if (id != null && document.visibilityState === 'visible') markRead(id);
  }, [markRead]);

  const isOnline = useCallback((id?: number | null) => (id != null ? !!presence[id] : false), [presence]);

  const value = useMemo<ChatContextValue>(() => ({
    connectionState, conversations, conversationsLoading, totalUnread, isOnline,
    subscribe, sendTyping, stopTyping, markRead, joinConversation,
    setActiveConversation, dock, openDock, closeDock,
  }), [connectionState, conversations, conversationsLoading, totalUnread, isOnline,
      subscribe, sendTyping, stopTyping, markRead, joinConversation,
      setActiveConversation, dock, openDock, closeDock]);

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
};

export const useChat = () => useContext(ChatContext);
