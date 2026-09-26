// ─────────────────────────────────────────────────────────────────────────────
//  FILE: ui/src/components/chat/ChatDock.tsx
//  Floating chat bubble + right-side chat panel (Messenger style)
//
//  ✅ Bubble sits above the AI Help button, bottom-right, on every page
//  ✅ Live unread badge (only messages from others, never your own)
//  ✅ Panel = the full chat UI in single-column mode (list → conversation)
//  ✅ Expand → opens /chat?c=<id> on the same conversation
//  ✅ Esc / ✕ closes · full-screen on phones · hidden on the /chat page
//  ✅ Chat UI is lazy-loaded the first time the panel opens
// ─────────────────────────────────────────────────────────────────────────────

import { lazy, Suspense, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { MessageCircle, Maximize2, X, Loader2 } from 'lucide-react';
import { useChat, AI_WIDGET_EVENT } from '../../context/ChatContext';

const ChatWorkspace = lazy(() =>
  import('../../pages/Chatpage').then(m => ({ default: m.ChatWorkspace }))
);

const iconBtn =
  'w-9 h-9 rounded-xl flex items-center justify-center text-slate-500 dark:text-slate-400 ' +
  'hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white transition';

export const ChatDock = () => {
  const { totalUnread, dock, openDock, closeDock } = useChat();
  const location = useLocation();
  const navigate = useNavigate();
  const [aiOpen, setAiOpen] = useState(false);
  const [currentConv, setCurrentConv] = useState<number | null>(null);

  const onChatPage = location.pathname.startsWith('/chat');

  // Hide the bubble while the AI assistant panel is open (same corner)
  useEffect(() => {
    const onAi = (e: Event) => setAiOpen(!!(e as CustomEvent<boolean>).detail);
    window.addEventListener(AI_WIDGET_EVENT, onAi);
    return () => window.removeEventListener(AI_WIDGET_EVENT, onAi);
  }, []);

  useEffect(() => {
    if (!dock.open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeDock(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dock.open, closeDock]);

  if (onChatPage) return null;

  const badge = totalUnread > 99 ? '99+' : String(totalUnread);

  const headerActions = (
    <>
      <button
        type="button"
        onClick={() => navigate(currentConv ? `/chat?c=${currentConv}` : '/chat')}
        className={`${iconBtn} hidden md:flex`}
        title="Open full chat"
        aria-label="Open full chat"
      >
        <Maximize2 className="w-4 h-4" />
      </button>
      <button type="button" onClick={closeDock} className={iconBtn} title="Close (Esc)" aria-label="Close chat">
        <X className="w-5 h-5" />
      </button>
    </>
  );

  return (
    <>
      {/* ── Bubble ─────────────────────────────────────────────────────── */}
      {!dock.open && !aiOpen && (
        <button
          type="button"
          onClick={() => openDock()}
          className="fixed z-50 right-4 bottom-36 md:right-6 md:bottom-[5.5rem] w-14 h-14 rounded-full
                     bg-gradient-to-br from-blue-600 via-indigo-600 to-violet-600 text-white
                     shadow-xl shadow-indigo-500/30 hover:scale-105 active:scale-95 transition-all duration-200
                     flex items-center justify-center"
          aria-label={totalUnread > 0 ? `Open chat, ${totalUnread} unread` : 'Open chat'}
          title="Messages"
        >
          <MessageCircle className="w-6 h-6" />
          {totalUnread > 0 && (
            <span className="absolute -top-1 -right-1 flex">
              <span className="absolute inset-0 rounded-full bg-rose-500 opacity-60 animate-ping" aria-hidden />
              <span className="relative min-w-[22px] h-[22px] px-1.5 rounded-full bg-rose-500 text-white
                               text-[11px] font-bold flex items-center justify-center ring-2 ring-white dark:ring-slate-950">
                {badge}
              </span>
            </span>
          )}
        </button>
      )}

      {/* ── Panel ──────────────────────────────────────────────────────── */}
      {dock.open && (
        <div
          role="dialog"
          aria-label="Chat"
          className="fixed z-[60] inset-0 md:inset-auto md:bottom-6 md:right-6 md:w-[400px] md:h-[640px] md:max-h-[calc(100vh-3rem)]
                     bg-white dark:bg-slate-950 md:border md:border-slate-200 md:dark:border-slate-800 md:rounded-3xl
                     shadow-2xl overflow-hidden flex flex-col animate-in fade-in slide-in-from-bottom-5 duration-200"
        >
          <Suspense
            fallback={
              <div className="flex-1 flex items-center justify-center text-slate-400">
                <Loader2 className="w-6 h-6 animate-spin" />
              </div>
            }
          >
            <ChatWorkspace
              variant="dock"
              initialConversationId={dock.conversationId}
              onConversationChange={setCurrentConv}
              headerActions={headerActions}
            />
          </Suspense>
        </div>
      )}
    </>
  );
};

export default ChatDock;
