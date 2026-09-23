import React, { useState, useEffect, useRef, KeyboardEvent } from "react";
import { useNavigate } from "react-router-dom";
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

const getPromptCategories = (isCheckedIn: boolean) => {
  if (!isCheckedIn) {
    return [
      {
        category: "⚡ Attendance Actions",
        prompts: [
          { label: "🕒 Check in for today", text: "Check me in for today" },
          { label: "🏠 Apply for WFH", text: "Apply for WFH" },
          { label: "🏖 Apply for Leave", text: "Apply for casual leave" },
          { label: "📅 Check meetings", text: "Do I have any meetings or 1-on-1s scheduled today?" },
        ],
      },
    ];
  }

  return [
    {
      category: "⚡ Smart Actions",
      prompts: [
        { label: "➕ Add New Task", text: "Create task" },
        { label: "☕ Take a Break", text: "Start break" },
        { label: "📝 Draft EOD Report", text: "Draft my EOD report for today" },
        { label: "🏖 Show Leave History", text: "Show my recent leaves" },
      ],
    },
    {
      category: "📊 Live Day Analysis",
      prompts: [
        { label: "📋 Today's tasks", text: "What tasks did I log today and their statuses?" },
        { label: "⏱ Hours worked", text: "How many hours have I worked today so far?" },
        { label: "📅 Meetings", text: "Do I have any meetings scheduled today?" },
        { label: "🏖 Leave status", text: "Show my recent leaves" },
      ],
    },
  ];
};

const INITIAL_MESSAGE: Message = {
  id: "init",
  role: "assistant",
  content:
    "👋 Hello! I am your **Daily Tracker Copilot**. I have live access to your attendance, tasks, breaks, and meetings.\n\nHow can I help you today?",
  timestamp: new Date(),
};

// ── Interactive Action Card ──────────────────────────────────────────────────
const ActionCard = ({
  action,
  onExecute,
  onNavigate,
}: {
  action: SuggestedAction;
  onExecute: (act: SuggestedAction) => void;
  onNavigate: (path: string) => void;
}) => {
  const [executed, setExecuted] = useState(false);
  const [loading, setLoading] = useState(false);

  // Leave Form State
  const [fromDate, setFromDate] = useState(
    action.payload?.fromDate || new Date().toISOString().split("T")[0]
  );
  const [toDate, setToDate] = useState(
    action.payload?.toDate || new Date().toISOString().split("T")[0]
  );
  const [leaveType, setLeaveType] = useState(action.payload?.leaveType || "Casual");
  const [reason, setReason] = useState(action.payload?.reason || "");

  // WFH Form State
  const [wfhDate, setWfhDate] = useState(
    action.payload?.requestDate || new Date().toISOString().split("T")[0]
  );

  const getActionIcon = () => {
    switch (action.type) {
      case "CREATE_TASK": return "➕";
      case "START_BREAK": return action.payload?.breakType === "Lunch" ? "🍱" : "☕";
      case "END_BREAK": return "▶️";
      case "APPLY_LEAVE": return "🏖";
      case "APPLY_WFH": return "🏠";
      case "CHECK_IN": return "🕒";
      case "CHECK_OUT": return "🚪";
      case "NAVIGATE": return "↗️";
      default: return "⚡";
    }
  };

  const handleConfirm = async () => {
    setLoading(true);

    if (action.type === "APPLY_LEAVE") {
      action.payload = {
        ...action.payload,
        fromDate,
        toDate,
        leaveType,
        reason: reason || "Applied via AI Copilot",
      };
    } else if (action.type === "APPLY_WFH") {
      action.payload = {
        ...action.payload,
        requestDate: wfhDate,
        reason: reason || "Requested via AI Copilot",
      };
    }

    await onExecute(action);
    setLoading(false);
    setExecuted(true);
  };

  // If this is a navigation action (e.g. Open Task Form, Open EOD Page)
if (action.type === "NAVIGATE") {
    const handleNavClick = async () => {
      if (action.payload?.path === "/eod-reports") {
        try {
          const res = await aiChatApi.getEodDraft();
          if (res.data.success && res.data.draft) {
            sessionStorage.setItem("pending_eod_draft", JSON.stringify(res.data.draft));
          }
        } catch {
          // Proceed anyway
        }
      }
      onNavigate(action.payload?.path || "/tasks");
    };

    return (
      <div className="mt-2.5 p-3 rounded-xl bg-slate-900/95 border border-indigo-500/40 shadow-md">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-lg">📝</span>
            <div>
              <p className="text-xs font-semibold text-white">{action.title}</p>
              <p className="text-[11px] text-slate-400">Prefills draft into official form</p>
            </div>
          </div>
          <button
            onClick={handleNavClick}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-indigo-600 hover:bg-indigo-500 text-white shadow transition-all active:scale-95"
          >
            Review & Submit ↗
          </button>
        </div>
      </div>
    );
  }

  // Interactive Date Selector for Leave
  if (action.type === "APPLY_LEAVE") {
    return (
      <div className="mt-2.5 p-3 rounded-xl bg-slate-900/95 border border-emerald-500/40 shadow-md space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-base">🏖</span>
            <p className="text-xs font-semibold text-white">Apply for Leave</p>
          </div>
          <button
            onClick={() => onNavigate("/leave")}
            className="text-[10px] text-emerald-400 hover:underline"
          >
            Open Full Leave Page ↗
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs">
          <div>
            <label className="text-[10px] text-slate-400 block mb-0.5">From Date</label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg p-1 text-slate-200 text-xs"
            />
          </div>
          <div>
            <label className="text-[10px] text-slate-400 block mb-0.5">To Date</label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg p-1 text-slate-200 text-xs"
            />
          </div>
        </div>

        <div className="flex gap-2 text-xs">
          <select
            value={leaveType}
            onChange={(e) => setLeaveType(e.target.value)}
            className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-slate-200 text-xs"
          >
            <option value="Casual">Casual</option>
            <option value="Sick">Sick</option>
            <option value="Earned">Earned</option>
          </select>
          <input
            type="text"
            placeholder="Reason (optional)"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-slate-200 text-xs"
          />
        </div>

        <div className="flex justify-end">
          <button
            onClick={handleConfirm}
            disabled={executed || loading}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              executed
                ? "bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 cursor-default"
                : "bg-emerald-600 hover:bg-emerald-500 text-white shadow"
            }`}
          >
            {loading ? "Submitting..." : executed ? "✓ Leave Submitted" : "Confirm Leave"}
          </button>
        </div>
      </div>
    );
  }

  // Interactive Date Selector for WFH
  if (action.type === "APPLY_WFH") {
    return (
      <div className="mt-2.5 p-3 rounded-xl bg-slate-900/95 border border-purple-500/40 shadow-md space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-base">🏠</span>
            <p className="text-xs font-semibold text-white">Apply for WFH</p>
          </div>
          <button
            onClick={() => onNavigate("/request")}
            className="text-[10px] text-purple-400 hover:underline"
          >
            Open Full WFH Page ↗
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs">
          <div>
            <label className="text-[10px] text-slate-400 block mb-0.5">Date</label>
            <input
              type="date"
              value={wfhDate}
              onChange={(e) => setWfhDate(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg p-1 text-slate-200 text-xs"
            />
          </div>
          <div>
            <label className="text-[10px] text-slate-400 block mb-0.5">Reason</label>
            <input
              type="text"
              placeholder="Reason (optional)"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg p-1 text-slate-200 text-xs"
            />
          </div>
        </div>

        <div className="flex justify-end">
          <button
            onClick={handleConfirm}
            disabled={executed || loading}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              executed
                ? "bg-purple-600/30 text-purple-300 border border-purple-500/40 cursor-default"
                : "bg-purple-600 hover:bg-purple-500 text-white shadow"
            }`}
          >
            {loading ? "Submitting..." : executed ? "✓ WFH Submitted" : "Confirm WFH"}
          </button>
        </div>
      </div>
    );
  }

  // Standard Action (Break, Check-in, Check-out)
  return (
    <div className="mt-2 p-2.5 rounded-xl bg-slate-900/90 border border-blue-500/40 shadow-md">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-base">{getActionIcon()}</span>
          <div>
            <p className="text-xs font-semibold text-white">{action.title}</p>
            <p className="text-[10px] text-slate-400">Ready to execute automatically</p>
          </div>
        </div>
        <button
          onClick={handleConfirm}
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

const AssistantMessage = ({ content }: { content: string }) => {
  return (
    <div className="space-y-1 text-xs">
      {content.split("\n").map((line, i) => {
        if (!line.trim()) return <div key={i} className="h-1" />;
        const boldParsed = line.split(/(\*\*.*?\*\*|\*.*?\*)/g).map((part, j) => {
          if (part.startsWith("**") && part.endsWith("**")) {
            return (
              <strong key={j} className="text-white font-semibold">
                {part.slice(2, -2)}
              </strong>
            );
          }
          if (part.startsWith("*") && part.endsWith("*")) {
            return (
              <em key={j} className="text-blue-300 font-normal">
                {part.slice(1, -1)}
              </em>
            );
          }
          return part;
        });

        if (line.trim().startsWith("•") || line.trim().startsWith("-")) {
          return (
            <div key={i} className="flex items-start gap-1.5 ml-1">
              <span className="text-blue-400 font-bold shrink-0">•</span>
              <span className="text-slate-300">{boldParsed}</span>
            </div>
          );
        }

        return (
          <p key={i} className="text-slate-300">
            {boldParsed}
          </p>
        );
      })}
    </div>
  );
};

const ChatBubble = ({
  msg,
  onExecuteAction,
  onNavigate,
}: {
  msg: Message;
  onExecuteAction: (act: SuggestedAction) => void;
  onNavigate: (path: string) => void;
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
        className={`max-w-[85%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed ${
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
              <div className="space-y-1.5 mt-2">
                {msg.actions.map((act, index) => (
                  <ActionCard
                    key={`${act.type}-${index}`}
                    action={act}
                    onExecute={onExecuteAction}
                    onNavigate={onNavigate}
                  />
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
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([INITIAL_MESSAGE]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
        fetchSummary();
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || "Failed to execute action.");
    }
  };

  const handleNavigate = (path: string) => {
    setIsOpen(false);
    navigate(path);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <>
      {/* Floating Trigger Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 z-50 p-3.5 bg-gradient-to-tr from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-full shadow-2xl hover:scale-105 active:scale-95 transition-all duration-200 group flex items-center gap-2"
          aria-label="Open AI Assistant"
        >
          <span className="text-xl">🤖</span>
          <span className="text-xs font-medium pr-1 hidden sm:inline">AI Copilot</span>
        </button>
      )}

      {/* Chat Window */}
      {isOpen && (
        <div className="fixed bottom-5 right-5 z-50 w-[94vw] sm:w-[440px] h-[640px] max-h-[86vh] flex flex-col bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-5 duration-200">
          {/* Header */}
          <div className="px-4 py-3 bg-slate-800/90 border-b border-slate-700 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-base shadow">
                🤖
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">Daily Tracker Copilot</h3>
                <p className="text-[10px] text-emerald-400 flex items-center gap-1 font-medium">
                  <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
                  Live Context Connected
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setMessages([INITIAL_MESSAGE])}
                className="text-slate-400 hover:text-slate-200 text-xs px-2 py-1 rounded hover:bg-slate-700/60 transition"
              >
                Clear
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-700 transition"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Live Context Banner */}
          <div className="px-4 py-2 bg-slate-950/60 border-b border-slate-800/80 flex items-center justify-between text-[11px] text-slate-300 overflow-x-auto">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1">
                {contextSummary?.isCheckedIn ? (
                  <span className="text-emerald-400 font-medium">
                    🟢 In: {contextSummary.checkInTime}
                  </span>
                ) : (
                  <span className="text-slate-400">⚪ Not Checked In</span>
                )}
              </span>
              <span>•</span>
              <span className="text-blue-400">{contextSummary?.tasksCount ?? 0} tasks</span>
              {contextSummary?.isOnBreak && (
                <>
                  <span>•</span>
                  <span className="text-amber-400 font-medium">
                    ☕ On {contextSummary.activeBreakType || "Break"}
                  </span>
                </>
              )}
            </div>
            <button
              onClick={fetchSummary}
              className="text-slate-400 hover:text-slate-200 text-xs ml-2"
              title="Refresh status"
            >
              ↻
            </button>
          </div>

          {/* Warning Banner if Not Checked In */}
          {!contextSummary?.isCheckedIn && (
            <div className="mx-4 mt-3 p-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[11px] flex items-center gap-2">
              <span>⚠️</span>
              <span>Please <strong>Check In</strong> to start logging tasks and breaks today.</span>
            </div>
          )}

          {/* Messages Body */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-slate-900/60">
            {messages.map((m) => (
              <ChatBubble
                key={m.id}
                msg={m}
                onExecuteAction={handleExecuteAction}
                onNavigate={handleNavigate}
              />
            ))}

            {isLoading && (
              <div className="flex items-center gap-2 text-slate-400 text-xs italic">
                <span className="w-2 h-2 bg-blue-500 rounded-full animate-ping" />
                Copilot is thinking...
              </div>
            )}

            {/* Quick Prompts */}
            {showQuickPrompts && (
              <div className="mt-3 space-y-3 pt-2">
                {getPromptCategories(!!contextSummary?.isCheckedIn).map((cat) => (
                  <div key={cat.category}>
                    <p className="text-[11px] font-semibold text-slate-400 mb-1.5 px-0.5">
                      {cat.category}
                    </p>
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
              <div className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs">
                {error}
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input Footer */}
          <div className="p-3 bg-slate-800/90 border-t border-slate-700">
            <div className="flex items-center gap-2 bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 focus-within:border-blue-500 transition">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask about hours, leaves, or say 'take a break'..."
                className="flex-1 bg-transparent text-sm text-white placeholder-slate-500 focus:outline-none"
              />
              <button
                onClick={() => handleSend()}
                disabled={!input.trim() || isLoading}
                className="p-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white rounded-lg transition"
              >
                ➤
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};