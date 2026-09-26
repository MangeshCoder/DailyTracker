import { useEffect, useRef, useCallback } from 'react';
import * as signalR from '@microsoft/signalr';
import type { ChatMessage } from '../types';

// ─────────────────────────────────────────────────────────────────────────────
//  useChatHub  —  ONE instance only, mounted at the ChatPage level
//
//  ⚠️  IMPORTANT: Call this hook ONCE in your component tree (in ChatPage).
//      Calling it in multiple components creates multiple WebSocket connections
//      and causes messages to be received on one connection but state to live
//      in another — resulting in messages not appearing until re-fetch.
//
//  How it works:
//    • Creates a single SignalR connection on mount, destroys it on unmount
//    • withAutomaticReconnect() handles network drops transparently
//    • All callbacks are stored in a ref so they always see latest closures
//      without the effect needing to re-run
//    • Returns connRef (for invoking hub methods) + helper functions
// ─────────────────────────────────────────────────────────────────────────────

interface ChatHubCallbacks {
  onMessage?: (message: ChatMessage) => void;
  onMessageEdited?: (message: ChatMessage) => void;
  onMessageDeleted?: (data: { messageId: number }) => void;
  onReactionUpdated?: (data: {
    messageId: number;
    emoji: string;
    reactionCounts: Record<string, number>;
  }) => void;
  onUserTyping?: (data: { conversationId: number; userId: number }) => void;
  onUserStoppedTyping?: (data: { conversationId: number; userId: number }) => void;
  onConversationRead?: (data: {
    conversationId: number;
    userId: number;
    readAt: string;
  }) => void;
  onUserOnline?: (data: { userId: number }) => void;
  onUserOffline?: (data: { userId: number }) => void;
  onAddedToGroup?: (data: { conversationId: number; groupName?: string }) => void;
  onRemovedFromGroup?: (data: { conversationId: number }) => void;
  onMembersAdded?: (data: { conversationId: number; addedUserIds: number[] }) => void;
  onMemberLeft?: (data: { conversationId: number; userId: number }) => void;
  onGroupInfoUpdated?: (data: { conversationId: number; groupName?: string }) => void;
  onConnectionChange?: (
    state: 'connecting' | 'connected' | 'reconnecting' | 'disconnected'
  ) => void;
}

export const useChatHub = (callbacks: ChatHubCallbacks) => {
  const connRef = useRef<signalR.HubConnection | null>(null);

  // ── Store callbacks in a ref ────────────────────────────────────────────
  // This lets the effect run only once while callbacks always see fresh state.
  // Every render updates cbRef.current, so onMessage etc. always close over
  // the latest messages/selectedId without triggering a reconnect.
  const cbRef = useRef(callbacks);
  cbRef.current = callbacks;

  useEffect(() => {
    // ── Build connection ────────────────────────────────────────────────────
    const connection = new signalR.HubConnectionBuilder()
      .withUrl('/hubs/chat', {
        withCredentials: true, // cookie-based auth
      })
      .withAutomaticReconnect([0, 2000, 5000, 10000, 30000])
      .configureLogging(signalR.LogLevel.Warning)
      .build();

    connRef.current = connection;

    // ── Register all server → client events ─────────────────────────────────
    // Each handler just forwards to cbRef.current so it always calls the
    // latest version of the callback provided by the parent component.

    connection.on('ReceiveMessage', (msg: ChatMessage) => {
      cbRef.current.onMessage?.(msg);
    });

    connection.on('MessageEdited', (msg: ChatMessage) => {
      cbRef.current.onMessageEdited?.(msg);
    });

    connection.on('MessageDeleted', (data: { messageId: number }) => {
      cbRef.current.onMessageDeleted?.(data);
    });

    connection.on('ReactionUpdated', (data: any) => {
      cbRef.current.onReactionUpdated?.(data);
    });

    connection.on('UserTyping', (data: any) => {
      cbRef.current.onUserTyping?.(data);
    });

    connection.on('UserStoppedTyping', (data: any) => {
      cbRef.current.onUserStoppedTyping?.(data);
    });

    connection.on('ConversationRead', (data: any) => {
      cbRef.current.onConversationRead?.(data);
    });

    connection.on('UserOnline', (data: any) => {
      cbRef.current.onUserOnline?.(data);
    });

    connection.on('UserOffline', (data: any) => {
      cbRef.current.onUserOffline?.(data);
    });

    connection.on('AddedToGroup', (data: any) => {
      // When the server adds this user to a group, immediately join
      // the SignalR group so future messages are received
      connection.invoke('JoinConversation', data.conversationId).catch(console.error);
      cbRef.current.onAddedToGroup?.(data);
    });

    connection.on('RemovedFromGroup', (data: any) => {
      cbRef.current.onRemovedFromGroup?.(data);
    });

    connection.on('MembersAdded', (data: any) => {
      cbRef.current.onMembersAdded?.(data);
    });

    connection.on('MemberLeft', (data: any) => {
      cbRef.current.onMemberLeft?.(data);
    });

    connection.on('GroupInfoUpdated', (data: any) => {
      cbRef.current.onGroupInfoUpdated?.(data);
    });

    // ── Connection lifecycle events ──────────────────────────────────────────
    connection.onreconnecting(() => {
      cbRef.current.onConnectionChange?.('reconnecting');
    });

    connection.onreconnected(() => {
      cbRef.current.onConnectionChange?.('connected');
    });

    connection.onclose(() => {
      cbRef.current.onConnectionChange?.('disconnected');
    });

    // ── Start ────────────────────────────────────────────────────────────────
    cbRef.current.onConnectionChange?.('connecting');

    connection
      .start()
      .then(() => {
        cbRef.current.onConnectionChange?.('connected');
      })
      .catch((err) => {
        console.error('ChatHub connection failed:', err);
        cbRef.current.onConnectionChange?.('disconnected');
      });

    // ── Cleanup: stop connection when ChatPage unmounts ──────────────────────
    return () => {
      connection.stop().catch(console.error);
    };
  }, []); // ← Empty array: one connection for the lifetime of ChatPage

  // ── Client → Server helpers ───────────────────────────────────────────────
  // These are stable references (useCallback with []) that ConversationView
  // can call safely without re-render loops.

  const sendTyping = useCallback((conversationId: number) => {
    connRef.current?.invoke('StartTyping', conversationId).catch(() => {});
  }, []);

  const stopTyping = useCallback((conversationId: number) => {
    connRef.current?.invoke('StopTyping', conversationId).catch(() => {});
  }, []);

  const markRead = useCallback((conversationId: number) => {
    connRef.current?.invoke('MarkRead', conversationId).catch(() => {});
  }, []);

  const joinConversation = useCallback((conversationId: number) => {
  connRef.current?.invoke('JoinConversation', conversationId).catch(() => {});
    }, []);

    const leaveConversation = useCallback((conversationId: number) => {
    connRef.current?.invoke('LeaveConversation', conversationId).catch(() => {});
    }, []);

  return { connRef, sendTyping, stopTyping, markRead, joinConversation, leaveConversation };
};