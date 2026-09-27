// ─────────────────────────────────────────────────────────────────────────────
//  In-memory cache of recent chat messages (per conversation)
//
//  • Reopening a chat shows its messages instantly, then refreshes quietly
//  • loadLatest() de-duplicates requests (prefetch on hover + open share one)
//  • ChatContext keeps it updated from live events even while the chat is closed
//  • Cleared on logout
// ─────────────────────────────────────────────────────────────────────────────

import { chatApi } from '../../services/api';
import type { ChatMessage } from '../../types';

const MAX_PER_CONVERSATION = 200;
const cache = new Map<number, ChatMessage[]>();
const inflight = new Map<number, Promise<ChatMessage[]>>();
const fetchedAt = new Map<number, number>();

/**
 * Merge a freshly fetched page with what's already known. Messages that arrived
 * live while the request was in flight are kept; fetched copies win otherwise.
 */
export const mergeMessages = (fetched: ChatMessage[], current: ChatMessage[]) => {
  const byId = new Map<number, ChatMessage>();
  for (const m of current) byId.set(m.id, m);
  for (const m of fetched) byId.set(m.id, m);
  return [...byId.values()].sort((a, b) => a.id - b.id);
};

export const getCachedMessages = (conversationId: number) => cache.get(conversationId);

export const setCachedMessages = (conversationId: number, messages: ChatMessage[]) => {
  cache.set(conversationId, messages.slice(-MAX_PER_CONVERSATION));
};

/** Latest page from the server (shared if a request is already running) */
export const loadLatest = (conversationId: number): Promise<ChatMessage[]> => {
  const running = inflight.get(conversationId);
  if (running) return running;
  const p = chatApi.getMessages(conversationId, 50)
    .then(msgs => {
      setCachedMessages(conversationId, mergeMessages(msgs, cache.get(conversationId) ?? []));
      fetchedAt.set(conversationId, Date.now());
      return msgs;
    })
    .finally(() => inflight.delete(conversationId));
  inflight.set(conversationId, p);
  return p;
};

/**
 * Loaded from the server moments ago (e.g. prefetched on hover). Live events
 * keep it current since then, so opening the chat needs no second request.
 */
export const isFresh = (conversationId: number, maxAgeMs = 30_000) =>
  Date.now() - (fetchedAt.get(conversationId) ?? 0) < maxAgeMs;

/** Warm the cache (hover / panel open) — errors are ignored */
export const prefetchMessages = (conversationId: number) => {
  if (!cache.has(conversationId) && !inflight.has(conversationId))
    loadLatest(conversationId).catch(() => {});
};

/** New or edited message from the live connection */
export const applyLiveMessage = (msg: ChatMessage) => {
  const current = cache.get(msg.conversationId);
  // While history is still loading, keep the live message so the (older)
  // server snapshot is merged with it instead of hiding it
  if (current || inflight.has(msg.conversationId))
    setCachedMessages(msg.conversationId, mergeMessages([msg], current ?? []));
};

export const applyDeletedMessage = (messageId: number) => {
  for (const [id, list] of cache) {
    if (list.some(m => m.id === messageId))
      cache.set(id, list.map(m => (m.id === messageId ? { ...m, isDeleted: true, content: 'This message was deleted.' } : m)));
  }
};

export const clearChatCache = () => { cache.clear(); inflight.clear(); fetchedAt.clear(); };
