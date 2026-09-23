import { useState, useRef, useEffect, KeyboardEvent } from "react";
import { Message, MessageHistory, SuggestedAction } from "../types/chat";
import { aiChatApi } from "../services/api";

// ─────────────────────────────────────────────────────────────────────────────
//  Quick-Prompt Categories
// ─────────────────────────────────────────────────────────────────────────────
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
    category: "📊 Data & Status",
    prompts: [
      { label: "📋 Today's tasks", text: "What tasks did I log today?" },
      { label: "⏱ Work hours", text: "How many hours have I logged today?" },
      { label: "🏖 Leave balance", text: "What is my annual leave balance?" },
      { label: "📈 Productivity check", text: "Give me an analytics summary of my week" },
    ],
  },
];

const INITIAL_MESSAGE: Message = {
  id: "init",
  role: "assistant",
  content: "Hi! 👋 I'm your upgraded **Daily Tracker Copilot**.\n\nI can **execute real actions** for you (create tasks, clock in/out, apply WFH, draft EODs) and analyze your productivity. How can I help you right now?",
  timestamp: new Date(),
};

const AssistantMessage = ({ content }: { content: string }) => {
  const renderInline = (text: string) => {
    const parts = text.split(/(\*\*[^*]+\*\*)/g);
    return parts.map((part, i) =>
      part.startsWith("**") && part.endsWith("**")
        ? <strong key={i} className="text-white font-semibold">{part.slice(2, -2)}</strong>
        : <span key={i}>{part}</span>
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

const AiChatWidget = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([INITIAL_MESSAGE]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isListening, setIsListening] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const showQuickPrompts = messages.length === 1 && messages[0].id === "init" && !isLoading;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  useEffect(() => {
    if (isOpen) inputRef.current?.focus();
  }, [isOpen]);

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
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || "Failed to execute action.");
    }
  };

  // Web Speech API voice input
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
      <button
        onClick={() => setIsOpen((o) => !o)}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 bg-gradient-to-tr from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 active:scale-95 text-white rounded-full shadow-2xl flex items-center justify-center transition-all duration-200 border border-blue-400/30"
        aria-label="Toggle AI Assistant"
      >
        {isOpen ? (
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <div className="relative">
            <span className="text-xl">🤖</span>
            <span className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-400 rounded-full ring-2 ring-slate-900 animate-pulse" />
          </div>
        )}
      </button>

      {/* ── Chat panel ── */}
      {isOpen && (
        <div className="fixed bottom-24 right-4 sm:right-6 z-50 w-[92vw] sm:w-[420px] h-[600px] max-h-[80vh] bg-slate-900 rounded-2xl shadow-2xl flex flex-col border border-slate-700 overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-3.5 flex items-center gap-3 flex-shrink-0">
            <div className="w-9 h-9 bg-white/20 backdrop-blur rounded-full flex items-center justify-center text-lg shrink-0 shadow">
              🤖
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <p className="font-semibold text-sm text-white">Daily Tracker Copilot</p>
                <span className="text-[10px] bg-white/20 text-white px-1.5 py-0.5 rounded-full font-medium">Pro</span>
              </div>
              <p className="text-xs text-blue-100">Live data + Action execution</p>
            </div>
            <button
              onClick={handleClear}
              title="Clear chat"
              className="text-blue-200 hover:text-white transition-colors p-1.5 rounded-lg hover:bg-white/10"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                />
              </svg>
            </button>
          </div>

          {/* Error banner */}
          {error && (
            <div className="bg-red-950/80 border-b border-red-800/40 px-3 py-2 flex items-center gap-2 flex-shrink-0 text-red-300 text-xs">
              <span>⚠️ {error}</span>
              <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-200">
                ✕
              </button>
            </div>
          )}

          {/* Messages container */}
          <div className="flex-1 overflow-y-auto px-3.5 py-3 space-y-3.5 bg-slate-950">
            {messages.map((msg) => (
              <ChatBubble key={msg.id} msg={msg} onExecuteAction={handleExecuteAction} />
            ))}

            {/* Categorized Quick Prompts */}
            {showQuickPrompts && (
              <div className="pt-2 space-y-3">
                {PROMPT_CATEGORIES.map((cat) => (
                  <div key={cat.category}>
                    <p className="text-slate-500 font-medium text-[11px] uppercase tracking-wider mb-1.5 px-0.5">
                      {cat.category}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {cat.prompts.map((qp) => (
                        <button
                          key={qp.text}
                          onClick={() => handleSend(qp.text)}
                          className="text-xs px-2.5 py-1.5 rounded-xl bg-slate-900 border border-slate-700
                                     text-slate-300 hover:bg-slate-800 hover:text-white hover:border-blue-500/50
                                     active:scale-95 transition-all duration-150 text-left"
                        >
                          {qp.label}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {isLoading && <TypingIndicator />}
            <div ref={messagesEndRef} />
          </div>

          {/* Input bar */}
          <div className="px-3 py-3 border-t border-slate-800 flex gap-2 items-center bg-slate-900 flex-shrink-0">
            <button
              onClick={toggleVoiceInput}
              title={isListening ? "Listening... click to stop" : "Voice input"}
              className={`p-2 rounded-xl transition-all ${
                isListening
                  ? "bg-red-500/20 text-red-400 border border-red-500/40 animate-pulse"
                  : "bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700"
              }`}
            >
              🎤
            </button>
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder='e.g. "Create task: Design landing page" or "Draft my EOD"'
              disabled={isLoading}
              className="flex-1 text-sm bg-slate-800 border border-slate-700 text-white rounded-xl px-3.5 py-2
                         outline-none placeholder:text-slate-500
                         focus:border-blue-500 focus:ring-1 focus:ring-blue-500
                         disabled:opacity-40 disabled:cursor-not-allowed transition"
            />
            <button
              onClick={() => handleSend()}
              disabled={isLoading || !input.trim()}
              className="w-10 h-10 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-600
                         text-white rounded-xl flex items-center justify-center transition-colors shrink-0 shadow"
              aria-label="Send"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default AiChatWidget;