import { useState, useRef, useEffect, KeyboardEvent } from "react";
import { Message, MessageHistory, SuggestedAction } from "../types/chat";
import { aiChatApi } from "../services/api";

interface ContextSummary {
  isCheckedIn: boolean;
  checkInTime: string | null;
  isCheckedOut: boolean;
  checkOutTime: string | null;
  totalWorkMinutes: number;
  tasksCount: number;
  completedTasksCount: number;
  isOnBreak: boolean;
  activeBreakType: string | null;
  dayStatus: string;
}

const PROMPT_CATEGORIES = [
  {
    category: "⚡ Smart Actions",
    prompts: [
      { label: "➕ Create Quick Task", text: 'Create task: "Review and merge pull request" with High priority' },
      { label: "🕒 Check in for today", text: "Check me in for today" },
      { label: "🏠 Apply for WFH", text: "Apply for WFH today" },
      { label: "📝 Draft EOD report", text: "Draft my EOD report for today" },
    ],
  },
  {
    category: "📊 Live Day Analysis",
    prompts: [
      { label: "📋 What tasks did I log?", text: "What tasks did I log today and their statuses?" },
      { label: "⏱ How long have I worked?", text: "How many hours have I worked today so far?" },
      { label: "📅 Any meetings today?", text: "Do I have any meetings or 1-on-1s scheduled today?" },
      { label: "🏖 Check leave status", text: "What are my recent leave and WFH requests?" },
    ],
  },
];

const INITIAL_MESSAGE: Message = {
  id: "init",
  role: "assistant",
  content:
    "Hi! 👋 I'm your **Daily Tracker Copilot**.\n\nI have **live access to your day** (attendance, tasks, breaks, meetings & leaves). Ask me anything about your schedule or have me execute actions for you!",
  timestamp: new Date(),
};

const AssistantMessage = ({ content }: { content: string }) => {
  const renderInline = (text: string) => {
    const parts = text.split(/(\*\*[^*]+\*\*)/g);
    return parts.map((part, i) =>
      part.startsWith("**") && part.endsWith("**") ? (
        <strong key={i} className="text-white font-semibold">
          {part.slice(2, -2)}
        </strong>
      ) : (
        <span key={i}>{part}</span>
      )
    );
  };

  return (
    <div className="space-y-1.5 text-sm leading-relaxed text-slate-200">
      {content.split("\n").map((line, idx) => {
        const trimmed = line.trim();
        if (!trimmed) return <div key={idx} className="h-1" />;
        if (trimmed.startsWith("• ") || trimmed.startsWith("- ")) {
          return (
            <div key={idx} className="flex items-start gap-2">
              <span className="text-blue-400 mt-0.5 shrink-0 text-xs leading-5">●</span>
              <span>{renderInline(trimmed.slice(2))}</span>
            </div>
          );
        }
        return <p key={idx}>{renderInline(trimmed)}</p>;
      })}
    </div>
  );
};

const TypingIndicator = () => (
  <div className="flex justify-start items-end gap-2">
    <div className="w-7 h-7 bg-blue-600/20 border border-blue-500/30 rounded-full flex items-center justify-center shrink-0 text-sm">
      🤖
    </div>
    <div className="bg-slate-800 border border-slate-700 rounded-2xl rounded-bl-none px-4 py-3">
      <div className="flex gap-1 items-center">
        {[0, 150, 300].map((delay) => (
          <span
            key={delay}
            className="w-2 h-2 bg-blue-400 rounded-full animate-bounce"
            style={{ animationDelay: `${delay}ms` }}
          />
        ))}
      </div>
    </div>
  </div>
);

const ActionCard = ({
  action,
  onExecute,
}: {
  action: SuggestedAction;
  onExecute: (act: SuggestedAction) => void;
}) => {
  const [executed, setExecuted] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    setLoading(true);
    await onExecute(action);
    setLoading(false);
    setExecuted(true);
  };

  return (
    <div className="mt-2.5 p-3 rounded-xl bg-slate-900/90 border border-blue-500/40 shadow-md">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-base">⚡</span>
          <div>
            <p className="text-xs font-semibold text-white">{action.title}</p>
            <p className="text-[11px] text-slate-400">Ready to execute automatically</p>
          </div>
        </div>
        <button
          onClick={handleClick}
          disabled={executed || loading}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
            executed
              ? "bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 cursor-default"
              : "bg-blue-600 hover:bg-blue-500 text-white shadow active:scale-95"
          }`}
        >
          {loading ? "Executing..." : executed ? "✓ Done" : "Confirm"}
        </button>
      </div>
    </div>
  );
};

const ChatBubble = ({
  msg,
  onExecuteAction,
}: {
  msg: Message;
  onExecuteAction: (act: SuggestedAction) => void;
}) => {
  const isUser = msg.role === "user";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"} items-end gap-2`}>
      {!isUser && (
        <div className="w-7 h-7 bg-gradient-to-tr from-blue-600 to-indigo-500 rounded-full flex items-center justify-center shrink-0 text-sm shadow">
          🤖
        </div>
      )}
      <div
        className={`max-w-[82%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed ${
          isUser
            ? "bg-blue-600 text-white rounded-br-none shadow-md"
            : "bg-slate-800/95 border border-slate-700 text-slate-200 rounded-bl-none shadow-sm"
        }`}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap">{msg.content}</p>
        ) : (
          <>
            <AssistantMessage content={msg.content} />
            {msg.actions && msg.actions.length > 0 && (
              <div className="space-y-1.5">
                {msg.actions.map((act) => (
                  <ActionCard key={act.id} action={act} onExecute={onExecuteAction} />
                ))}
              </div>
            )}
          </>
        )}
        <p className={`text-[10px] mt-1.5 ${isUser ? "text-blue-200 text-right" : "text-slate-500"}`}>
          {msg.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </p>
      </div>
    </div>
  );
};

export const AiChatWidget = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([INITIAL_MESSAGE]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [contextSummary, setContextSummary] = useState<ContextSummary | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const fetchSummary = async () => {
    try {
      const res = await aiChatApi.getContextSummary();
      if (res.data.success) {
        setContextSummary(res.data.summary);
      }
    } catch {
      // Non-blocking fallback
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchSummary();
      inputRef.current?.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const showQuickPrompts = messages.length === 1 && messages[0].id === "init" && !isLoading;

  const handleSend = async (overrideText?: string) => {
    const trimmed = (overrideText ?? input).trim();
    if (!trimmed || isLoading) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: "user",
      content: trimmed,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!overrideText) setInput("");
    setIsLoading(true);
    setError(null);

    const history: MessageHistory[] = messages
      .filter((m) => m.id !== "init")
      .map((m) => ({ role: m.role, content: m.content }));

    try {
      const res = await aiChatApi.sendMessage(trimmed, history);
      if (res.data.success) {
        const assistantMsg: Message = {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: res.data.reply,
          actions: res.data.actions,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, assistantMsg]);
      } else {
        setError(res.data.error || "Failed to get response");
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || "Connection error. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleExecuteAction = async (action: SuggestedAction) => {
    try {
      const res = await aiChatApi.executeAction(action.type, action.payload);
      if (res.data.success) {
        const confirmMsg: Message = {
          id: Date.now().toString(),
          role: "assistant",
          content: `✅ **Success**: ${res.data.message}`,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, confirmMsg]);
        fetchSummary(); // Refresh live status
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || "Failed to execute action.");
    }
  };

  const toggleVoiceInput = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setError("Speech recognition is not supported in this browser.");
      return;
    }

    if (isListening) {
      setIsListening(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = "en-US";

      recognition.onstart = () => setIsListening(true);
      recognition.onend = () => setIsListening(false);
      recognition.onerror = () => setIsListening(false);
      recognition.onresult = (e: any) => {
        const transcript = e.results[0][0].transcript;
        if (transcript) {
          setInput(transcript);
          handleSend(transcript);
        }
      };

      recognition.start();
    } catch {
      setIsListening(false);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleClear = () => {
    setMessages([INITIAL_MESSAGE]);
    setError(null);
  };

  return (
    <>
      {/* ── Floating toggle button ── */}
      <div className="fixed bottom-6 right-6 z-50">
        <button
          onClick={() => setIsOpen((prev) => !prev)}
          className="relative group p-3.5 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 text-white shadow-xl hover:shadow-blue-500/25 transition-all duration-300 hover:scale-105 active:scale-95"
          aria-label="Toggle AI Copilot"
        >
          {isOpen ? (
            <span className="text-xl">✕</span>
          ) : (
            <>
              <span className="text-2xl">🤖</span>
              <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500 border-2 border-slate-900"></span>
              </span>
            </>
          )}
        </button>
      </div>

      {/* ── Chat Modal Window ── */}
      {isOpen && (
        <div className="fixed bottom-24 right-6 z-50 w-96 sm:w-[420px] max-h-[620px] h-[580px] bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-5 duration-200">
          {/* Header */}
          <div className="px-4 py-3 bg-slate-800/80 border-b border-slate-700/80 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-blue-600/30 border border-blue-400/40 flex items-center justify-center text-base">
                🤖
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">Daily Tracker Copilot</h3>
                <p className="text-[11px] text-emerald-400 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span> Live Context Connected
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={handleClear}
                title="Clear conversation"
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700/60 transition text-xs"
              >
                Clear
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700/60 transition text-sm"
              >
                ✕
              </button>
            </div>
          </div>

          {/* ── Real-Time Context Sync Pill Banner ── */}
          <div className="px-3.5 py-1.5 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between text-[11px] text-slate-300">
            <div className="flex items-center gap-1.5 truncate">
              {contextSummary?.isCheckedIn ? (
                <span className="text-emerald-400 font-medium">
                  🟢 In: {contextSummary.checkInTime}
                </span>
              ) : (
                <span className="text-amber-400 font-medium">⚪ Not Checked In</span>
              )}
              <span>•</span>
              <span>📋 {contextSummary?.tasksCount ?? 0} tasks</span>
              {contextSummary?.isOnBreak && (
                <>
                  <span>•</span>
                  <span className="text-amber-300">☕ On Break</span>
                </>
              )}
            </div>
            <button
              onClick={fetchSummary}
              title="Refresh live context"
              className="text-slate-400 hover:text-blue-400 transition"
            >
              ↻
            </button>
          </div>

          {/* Messages Body */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-slate-900/60">
            {messages.map((m) => (
              <ChatBubble key={m.id} msg={m} onExecuteAction={handleExecuteAction} />
            ))}

            {isLoading && <TypingIndicator />}

            {/* Quick Prompts */}
            {showQuickPrompts && (
              <div className="mt-3 space-y-3 pt-2">
                {PROMPT_CATEGORIES.map((cat) => (
                  <div key={cat.category}>
                    <p className="text-[11px] font-semibold text-slate-400 mb-1.5 px-0.5">{cat.category}</p>
                    <div className="grid grid-cols-2 gap-1.5">
                      {cat.prompts.map((p) => (
                        <button
                          key={p.label}
                          onClick={() => handleSend(p.text)}
                          className="text-left px-2.5 py-2 rounded-xl bg-slate-800/80 hover:bg-blue-600/20 border border-slate-700/80 hover:border-blue-500/50 text-[11px] text-slate-300 hover:text-white transition group"
                        >
                          <span className="line-clamp-1">{p.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {error && (
              <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex justify-between items-center">
                <span>{error}</span>
                <button onClick={() => setError(null)} className="text-rose-400 hover:text-white">✕</button>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input Footer */}
          <div className="p-3 bg-slate-800/80 border-t border-slate-700/80">
            <div className="relative flex items-center">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask about tasks, check-in, leaves..."
                disabled={isLoading}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-3.5 pr-20 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition disabled:opacity-50"
              />
              <div className="absolute right-1.5 flex items-center gap-1">
                <button
                  type="button"
                  onClick={toggleVoiceInput}
                  disabled={isLoading}
                  className={`p-1.5 rounded-lg text-xs transition ${
                    isListening
                      ? "bg-rose-500/20 text-rose-400 animate-pulse border border-rose-500/40"
                      : "text-slate-400 hover:text-white hover:bg-slate-800"
                  }`}
                  title="Voice input"
                >
                  🎙️
                </button>
                <button
                  type="button"
                  onClick={() => handleSend()}
                  disabled={isLoading || !input.trim()}
                  className="p-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs disabled:opacity-40 disabled:hover:bg-blue-600 transition"
                >
                  ➤
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default AiChatWidget;