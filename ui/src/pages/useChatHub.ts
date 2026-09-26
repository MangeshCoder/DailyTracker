import { useEffect, useRef } from 'react';
import { useChat, type ChatHubCallbacks } from '../context/ChatContext';

// ─────────────────────────────────────────────────────────────────────────────
//  useChatHub — subscribe to chat events from the app-wide connection
//
//  The SignalR connection now lives in ChatContext (one per app, mounted in
//  Layout) so the floating chat bubble and the /chat page share it. This hook
//  only registers callbacks; they're kept in a ref so they always see the
//  latest component state without re-subscribing.
// ─────────────────────────────────────────────────────────────────────────────

export type { ChatHubCallbacks };

export const useChatHub = (callbacks: ChatHubCallbacks) => {
  const chat = useChat();
  const cbRef = useRef(callbacks);
  cbRef.current = callbacks;

  const { subscribe } = chat;
  useEffect(() => subscribe(cbRef), [subscribe]);

  return {
    sendTyping: chat.sendTyping,
    stopTyping: chat.stopTyping,
    markRead: chat.markRead,
    joinConversation: chat.joinConversation,
    connectionState: chat.connectionState,
  };
};
