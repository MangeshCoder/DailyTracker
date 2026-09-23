import React, { useState, useEffect, useRef, KeyboardEvent } from "react";
import { useNavigate } from "react-router-dom";
import {
  Mic,
  MicOff,
  Maximize2,
  Minimize2,
  RotateCw,
  Send,
  X,
  Coffee,
  CheckCircle2,
  ChevronRight,
  Edit2,
  AlertCircle,
  Check
} from "lucide-react";
import { Message, MessageHistory, SuggestedAction } from "../types/chat";
import { aiChatApi } from "../services/api";
import { useToast } from "../context/ToastContext";

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

// ── Interactive Rich Action Card with Editable Previews ─────────────────────
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
  const [isEditing, setIsEditing] = useState(false);

  // Form states for editable action previews
  // 1. Task State
  const [taskTitle, setTaskTitle] = useState(action.payload?.taskTitle || action.title || "New Task");
  const [taskMinutes, setTaskMinutes] = useState<number>(action.payload?.timeSpentMinutes || 30);
  const [taskPriority, setTaskPriority] = useState(action.payload?.priority || "Medium");
  const [taskStatus, setTaskStatus] = useState(action.payload?.status || "Completed");

  // 2. Break State
  const [breakType, setBreakType] = useState(action.payload?.breakType || "Tea");

  // 3. Leave Form State
  const [fromDate, setFromDate] = useState(
    action.payload?.fromDate || new Date().toISOString().split("T")[0]
  );
  const [toDate, setToDate] = useState(
    action.payload?.toDate || new Date().toISOString().split("T")[0]
  );
  const [leaveType, setLeaveType] = useState(action.payload?.leaveType || "Casual");
  const [leaveReason, setLeaveReason] = useState(action.payload?.reason || "");

  // 4. WFH Form State
  const [wfhDate, setWfhDate] = useState(
    action.payload?.requestDate || new Date().toISOString().split("T")[0]
  );
  const [wfhReason, setWfhReason] = useState(action.payload?.reason || "");

  const handleConfirm = async () => {
    setLoading(true);

    const updatedPayload = { ...action.payload };

    if (action.type === "CREATE_TASK") {
      updatedPayload.taskTitle = taskTitle.trim() || "New Task";
      updatedPayload.timeSpentMinutes = Number(taskMinutes) || 30;
      updatedPayload.priority = taskPriority;
    } else if (action.type === "UPDATE_TASK_STATUS") {
      updatedPayload.taskTitle = taskTitle.trim();
      updatedPayload.status = taskStatus;
    } else if (action.type === "START_BREAK") {
      updatedPayload.breakType = breakType;
    } else if (action.type === "APPLY_LEAVE") {
      updatedPayload.fromDate = fromDate;
      updatedPayload.toDate = toDate;
      updatedPayload.leaveType = leaveType;
      updatedPayload.reason = leaveReason || "Applied via AI Copilot";
    } else if (action.type === "APPLY_WFH") {
      updatedPayload.requestDate = wfhDate;
      updatedPayload.reason = wfhReason || "Requested via AI Copilot";
    }

    const finalAction: SuggestedAction = {
      ...action,
      payload: updatedPayload,
    };

    await onExecute(finalAction);
    setLoading(false);
    setExecuted(true);
  };

  // If already executed
  if (executed) {
    return (
      <div className="mt-2.5 p-2.5 rounded-xl bg-emerald-950/30 border border-emerald-500/40 text-emerald-300 text-xs flex items-center gap-2 shadow-sm">
        <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
        <span className="font-medium">
          ✓ Action Executed: <strong>{action.title}</strong>
        </span>
      </div>
    );
  }

  // ── Navigation Action (e.g. Open EOD Report, Tasks) ──
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
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-indigo-600 hover:bg-indigo-500 text-white shadow transition-all active:scale-95 flex items-center gap-1"
          >
            <span>Review & Submit</span>
            <ChevronRight size={13} />
          </button>
        </div>
      </div>
    );
  }

  // ── 1. Create Task Preview with Editable Fields ──
  if (action.type === "CREATE_TASK") {
    return (
      <div className="mt-2.5 p-3.5 rounded-xl bg-slate-900/95 border border-blue-500/40 shadow-lg space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center text-xs font-bold">
              ➕
            </div>
            <div>
              <p className="text-xs font-semibold text-white">Create & Log Task</p>
              <p className="text-[10px] text-blue-400">Review & customize before creating</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsEditing(!isEditing)}
            className="text-[11px] text-slate-400 hover:text-blue-400 flex items-center gap-1 transition"
          >
            <Edit2 size={11} />
            <span>{isEditing ? "Done" : "Edit"}</span>
          </button>
        </div>

        <div className="space-y-2 text-xs">
          <div>
            <label className="text-[10px] text-slate-400 block mb-1">Task Title</label>
            <input
              type="text"
              value={taskTitle}
              onChange={(e) => setTaskTitle(e.target.value)}
              placeholder="e.g. Implement user authentication"
              className="w-full bg-slate-800 border border-slate-700 focus:border-blue-500 rounded-lg px-2.5 py-1.5 text-white text-xs outline-none transition"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-slate-400 block mb-1">Time Spent (minutes)</label>
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  min="5"
                  max="480"
                  step="5"
                  value={taskMinutes}
                  onChange={(e) => setTaskMinutes(Number(e.target.value))}
                  className="w-full bg-slate-800 border border-slate-700 focus:border-blue-500 rounded-lg px-2.5 py-1 text-white text-xs outline-none transition"
                />
                <span className="text-[11px] text-slate-400">min</span>
              </div>
            </div>

            <div>
              <label className="text-[10px] text-slate-400 block mb-1">Priority</label>
              <select
                value={taskPriority}
                onChange={(e) => setTaskPriority(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 focus:border-blue-500 rounded-lg px-2 py-1 text-white text-xs outline-none transition"
              >
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
              </select>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-800">
          <button
            onClick={handleConfirm}
            disabled={loading || !taskTitle.trim()}
            className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white shadow-md active:scale-95 transition flex items-center gap-1.5"
          >
            {loading ? (
              <span className="inline-block w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Check size={13} />
            )}
            <span>{loading ? "Creating..." : "Confirm & Log Task"}</span>
          </button>
        </div>
      </div>
    );
  }

  // ── 2. Update Task Status Preview ──
  if (action.type === "UPDATE_TASK_STATUS") {
    return (
      <div className="mt-2.5 p-3.5 rounded-xl bg-slate-900/95 border border-purple-500/40 shadow-lg space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-base">🔄</span>
            <div>
              <p className="text-xs font-semibold text-white">Update Task Status</p>
              <p className="text-[10px] text-purple-400">Review new task state</p>
            </div>
          </div>
        </div>

        <div className="space-y-2 text-xs">
          <div>
            <label className="text-[10px] text-slate-400 block mb-1">Target Task</label>
            <input
              type="text"
              value={taskTitle}
              onChange={(e) => setTaskTitle(e.target.value)}
              placeholder="Task name or keyword"
              className="w-full bg-slate-800 border border-slate-700 focus:border-purple-500 rounded-lg px-2.5 py-1.5 text-white text-xs outline-none"
            />
          </div>

          <div>
            <label className="text-[10px] text-slate-400 block mb-1">New Status</label>
            <div className="grid grid-cols-3 gap-1.5">
              {(["Completed", "InProgress", "Pending"] as const).map((st) => (
                <button
                  type="button"
                  key={st}
                  onClick={() => setTaskStatus(st)}
                  className={`px-2 py-1 rounded-lg text-xs font-medium border transition ${
                    taskStatus === st
                      ? "bg-purple-600/30 border-purple-500 text-purple-200"
                      : "bg-slate-800 border-slate-700 text-slate-400 hover:text-white"
                  }`}
                >
                  {st === "Completed" ? "✅ Completed" : st === "InProgress" ? "⚡ In Progress" : "⏳ Pending"}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end pt-1 border-t border-slate-800">
          <button
            onClick={handleConfirm}
            disabled={loading}
            className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white shadow active:scale-95 transition"
          >
            {loading ? "Updating..." : "Update Status"}
          </button>
        </div>
      </div>
    );
  }

  // ── 3. Start Break Preview ──
  if (action.type === "START_BREAK") {
    const breakOptions = [
      { type: "Tea", emoji: "☕", label: "Tea Break (15m)" },
      { type: "Lunch", emoji: "🍱", label: "Lunch Break (45m)" },
      { type: "Bio", emoji: "🚻", label: "Bio Break (10m)" },
      { type: "Other", emoji: "💬", label: "Personal Break" },
    ];

    return (
      <div className="mt-2.5 p-3.5 rounded-xl bg-slate-900/95 border border-amber-500/40 shadow-lg space-y-3">
        <div className="flex items-center gap-2">
          <span className="text-base">☕</span>
          <div>
            <p className="text-xs font-semibold text-white">Start a Break</p>
            <p className="text-[10px] text-amber-400">Select break type before confirming</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-1.5 text-xs">
          {breakOptions.map((b) => (
            <button
              key={b.type}
              type="button"
              onClick={() => setBreakType(b.type)}
              className={`p-2 rounded-lg border text-left flex items-center gap-1.5 transition ${
                breakType === b.type
                  ? "bg-amber-500/20 border-amber-500/60 text-amber-200"
                  : "bg-slate-800 border-slate-700 text-slate-400 hover:text-white"
              }`}
            >
              <span>{b.emoji}</span>
              <span className="text-[11px] font-medium">{b.label}</span>
            </button>
          ))}
        </div>

        <div className="flex items-center justify-end pt-1 border-t border-slate-800">
          <button
            onClick={handleConfirm}
            disabled={loading}
            className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white shadow active:scale-95 transition flex items-center gap-1.5"
          >
            {loading ? (
              <span className="inline-block w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Coffee size={13} />
            )}
            <span>{loading ? "Starting..." : `Start ${breakType} Break`}</span>
          </button>
        </div>
      </div>
    );
  }

  // ── 4. Apply Leave Preview ──
  if (action.type === "APPLY_LEAVE") {
    return (
      <div className="mt-2.5 p-3.5 rounded-xl bg-slate-900/95 border border-emerald-500/40 shadow-lg space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-base">🏖</span>
            <div>
              <p className="text-xs font-semibold text-white">Apply for Leave</p>
              <p className="text-[10px] text-emerald-400">Editable preview</p>
            </div>
          </div>
          <button
            onClick={() => onNavigate("/leave")}
            className="text-[10px] text-emerald-400 hover:underline flex items-center gap-0.5"
          >
            <span>Open Leave Page</span>
            <ChevronRight size={11} />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs">
          <div>
            <label className="text-[10px] text-slate-400 block mb-1">From Date</label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 focus:border-emerald-500 rounded-lg p-1.5 text-slate-200 text-xs outline-none"
            />
          </div>
          <div>
            <label className="text-[10px] text-slate-400 block mb-1">To Date</label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 focus:border-emerald-500 rounded-lg p-1.5 text-slate-200 text-xs outline-none"
            />
          </div>
        </div>

        <div className="flex gap-2 text-xs">
          <select
            value={leaveType}
            onChange={(e) => setLeaveType(e.target.value)}
            className="bg-slate-800 border border-slate-700 focus:border-emerald-500 rounded-lg px-2.5 py-1.5 text-slate-200 text-xs outline-none"
          >
            <option value="Casual">Casual Leave</option>
            <option value="Sick">Sick Leave</option>
            <option value="Earned">Earned Leave</option>
          </select>
          <input
            type="text"
            placeholder="Reason (optional)"
            value={leaveReason}
            onChange={(e) => setLeaveReason(e.target.value)}
            className="flex-1 bg-slate-800 border border-slate-700 focus:border-emerald-500 rounded-lg px-2.5 py-1.5 text-slate-200 text-xs outline-none"
          />
        </div>

        <div className="flex justify-end pt-1 border-t border-slate-800">
          <button
            onClick={handleConfirm}
            disabled={loading}
            className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white shadow active:scale-95 transition flex items-center gap-1"
          >
            {loading ? "Submitting..." : "Confirm Leave"}
          </button>
        </div>
      </div>
    );
  }

  // ── 5. Apply WFH Preview ──
  if (action.type === "APPLY_WFH") {
    return (
      <div className="mt-2.5 p-3.5 rounded-xl bg-slate-900/95 border border-purple-500/40 shadow-lg space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-base">🏠</span>
            <div>
              <p className="text-xs font-semibold text-white">Apply for WFH</p>
              <p className="text-[10px] text-purple-400">Editable preview</p>
            </div>
          </div>
          <button
            onClick={() => onNavigate("/request")}
            className="text-[10px] text-purple-400 hover:underline flex items-center gap-0.5"
          >
            <span>Open WFH Page</span>
            <ChevronRight size={11} />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs">
          <div>
            <label className="text-[10px] text-slate-400 block mb-1">Request Date</label>
            <input
              type="date"
              value={wfhDate}
              onChange={(e) => setWfhDate(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 focus:border-purple-500 rounded-lg p-1.5 text-slate-200 text-xs outline-none"
            />
          </div>
          <div>
            <label className="text-[10px] text-slate-400 block mb-1">Reason</label>
            <input
              type="text"
              placeholder="Reason for WFH"
              value={wfhReason}
              onChange={(e) => setWfhReason(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 focus:border-purple-500 rounded-lg p-1.5 text-slate-200 text-xs outline-none"
            />
          </div>
        </div>

        <div className="flex justify-end pt-1 border-t border-slate-800">
          <button
            onClick={handleConfirm}
            disabled={loading}
            className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white shadow active:scale-95 transition"
          >
            {loading ? "Submitting..." : "Confirm WFH"}
          </button>
        </div>
      </div>
    );
  }

  // ── Standard Action (Check-in, Check-out, End Break) ──
  const getActionIcon = () => {
    switch (action.type) {
      case "CHECK_IN": return "🕒";
      case "CHECK_OUT": return "🚪";
      case "END_BREAK": return "▶️";
      default: return "⚡";
    }
  };

  return (
    <div className="mt-2.5 p-3 rounded-xl bg-slate-900/90 border border-blue-500/40 shadow-md">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <span className="text-xl">{getActionIcon()}</span>
          <div>
            <p className="text-xs font-semibold text-white">{action.title}</p>
            <p className="text-[10px] text-slate-400">Ready to execute automatically</p>
          </div>
        </div>
        <button
          onClick={handleConfirm}
          disabled={loading}
          className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white shadow active:scale-95 transition"
        >
          {loading ? "Executing..." : "Confirm"}
        </button>
      </div>
    </div>
  );
};

const AssistantMessage = ({ content }: { content: string }) => {
  return (
    <div className="space-y-1.5 text-xs leading-relaxed">
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
    <div className={`flex ${isUser ? "justify-end" : "justify-start"} items-end gap-2.5`}>
      {!isUser && (
        <div className="w-7 h-7 bg-gradient-to-tr from-blue-600 to-indigo-500 rounded-xl flex items-center justify-center shrink-0 text-sm shadow-md">
          🤖
        </div>
      )}
      <div
        className={`max-w-[88%] px-4 py-3 rounded-2xl text-sm leading-relaxed ${
          isUser
            ? "bg-blue-600 text-white rounded-br-none shadow-md"
            : "bg-slate-800/95 border border-slate-700/80 text-slate-200 rounded-bl-none shadow-sm"
        }`}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap">{msg.content}</p>
        ) : (
          <>
            <AssistantMessage content={msg.content} />
            {msg.actions && msg.actions.length > 0 && (
              <div className="space-y-2 mt-2.5">
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
  const { toast } = useToast();

  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false); // ⚡ Expandable / Fullscreen mode
  const [messages, setMessages] = useState<Message[]>([INITIAL_MESSAGE]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshingSummary, setIsRefreshingSummary] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [contextSummary, setContextSummary] = useState<ContextSummary | null>(null);

  // 🎙️ Voice-to-Text Speech Recognition States
  const [isListening, setIsListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const recognitionRef = useRef<any>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Check browser SpeechRecognition support on mount
  useEffect(() => {
    const SpeechClass =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    setSpeechSupported(!!SpeechClass);
  }, []);

  const fetchSummary = async () => {
    setIsRefreshingSummary(true);
    try {
      const res = await aiChatApi.getContextSummary();
      if (res.data.success) {
        setContextSummary(res.data.summary);
      }
    } catch {
      // Non-blocking fallback
    } finally {
      setIsRefreshingSummary(false);
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

  // Clean up speech recognition when unmounting or closing
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {
          // ignore
        }
      }
    };
  }, []);

  // 🎙️ Toggle Speech Recognition
  const toggleListening = () => {
    if (!speechSupported) {
      toast.warning("Speech recognition is not supported in this browser. Please try Chrome or Edge.");
      return;
    }

    if (isListening) {
      try {
        recognitionRef.current?.stop();
      } catch {
        // ignore
      }
      setIsListening(false);
      toast.info("Microphone turned off");
      return;
    }

    try {
      const SpeechClass =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      const recognition = new SpeechClass();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = "en-US";

      recognition.onstart = () => {
        setIsListening(true);
        toast.info("🎙️ Listening... speak hands-free");
      };

      recognition.onresult = (event: any) => {
        const transcript = Array.from(event.results)
          .map((result: any) => result[0].transcript)
          .join("");
        setInput(transcript);
      };

      recognition.onerror = (event: any) => {
        console.warn("Speech recognition error:", event.error);
        setIsListening(false);
        if (event.error === "not-allowed") {
          toast.error("Microphone permission was denied. Please allow microphone access.");
        } else if (event.error !== "no-speech") {
          toast.error(`Speech recognition error: ${event.error}`);
        }
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      console.error(err);
      setIsListening(false);
      toast.error("Could not start voice recognition.");
    }
  };

  const showQuickPrompts = messages.length === 1 && messages[0].id === "init" && !isLoading;

  const handleSend = async (overrideText?: string) => {
    if (isListening && recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
      setIsListening(false);
    }

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
        toast.success(res.data.message);
        fetchSummary();
      }
    } catch (err: any) {
      const errMsg = err?.response?.data?.message || "Failed to execute action.";
      setError(errMsg);
      toast.error(errMsg);
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

  // Helper for live context badge text
  const getLiveContextPill = () => {
    if (!contextSummary) {
      return {
        badgeClass: "bg-slate-800/80 border-slate-700 text-slate-300",
        dotClass: "bg-slate-400",
        text: "⚪ Synced: Loading day status...",
      };
    }

    if (contextSummary.isCheckedIn) {
      const checkInStr = contextSummary.checkInTime ? `Checked in at ${contextSummary.checkInTime}` : "Checked in";
      const tasksStr = `${contextSummary.tasksCount} ${contextSummary.tasksCount === 1 ? "Task" : "Tasks"} Logged`;
      const breakStr = contextSummary.isOnBreak ? ` · ☕ ${contextSummary.activeBreakType || "Break"}` : "";

      return {
        badgeClass: "bg-emerald-500/10 border-emerald-500/30 text-emerald-300",
        dotClass: "bg-emerald-400 animate-pulse",
        text: `🟢 Synced: ${checkInStr} · ${tasksStr}${breakStr}`,
      };
    }

    return {
      badgeClass: "bg-amber-500/10 border-amber-500/30 text-amber-300",
      dotClass: "bg-amber-400",
      text: "⚪ Synced: Not Checked In · Click to check in",
    };
  };

  const liveBadge = getLiveContextPill();

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
          <span className="text-xs font-semibold pr-1 hidden sm:inline tracking-wide">
            AI Copilot
          </span>
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
        </button>
      )}

      {/* Fullscreen Backdrop when expanded */}
      {isOpen && isExpanded && (
        <div
          onClick={() => setIsExpanded(false)}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 transition-opacity animate-in fade-in"
        />
      )}

      {/* Chat Window Container */}
      {isOpen && (
        <div
          className={`fixed z-50 flex flex-col bg-slate-900 border border-slate-700/90 rounded-2xl shadow-2xl overflow-hidden transition-all duration-300 ${
            isExpanded
              ? "inset-3 sm:inset-6 md:inset-8 lg:max-w-5xl lg:mx-auto"
              : "bottom-5 right-5 w-[94vw] sm:w-[460px] h-[660px] max-h-[88vh]"
          } animate-in fade-in slide-in-from-bottom-5`}
        >
          {/* Header */}
          <div className="px-4 py-3 bg-slate-800/95 border-b border-slate-700 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-base shadow">
                🤖
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-white">Daily Tracker Copilot</h3>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 font-medium border border-blue-500/30">
                    Live
                  </span>
                </div>
                <p className="text-[10px] text-slate-400">
                  Real-time attendance, tasks & EOD assistant
                </p>
              </div>
            </div>

            {/* Header Controls: Expand, Clear, Close */}
            <div className="flex items-center gap-1">
              {/* ⚡ Expandable / Fullscreen Mode Toggle */}
              <button
                type="button"
                onClick={() => setIsExpanded(!isExpanded)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700/80 transition"
                title={isExpanded ? "Collapse to Widget" : "Expand to Full Window"}
              >
                {isExpanded ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
              </button>

              <button
                type="button"
                onClick={() => setMessages([INITIAL_MESSAGE])}
                className="text-slate-400 hover:text-slate-200 text-xs px-2 py-1 rounded-lg hover:bg-slate-700/60 transition"
                title="Clear chat messages"
              >
                Clear
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  setIsExpanded(false);
                }}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700/80 transition"
                title="Close chat"
              >
                <X size={17} />
              </button>
            </div>
          </div>

          {/* 🟢 Live Context Badge Bar */}
          <div className="px-3.5 py-2 bg-slate-950/80 border-b border-slate-800/80 flex items-center justify-between text-[11px] gap-2">
            <div
              className={`flex items-center gap-2 px-3 py-1 rounded-full border text-xs font-medium tracking-wide transition-all ${liveBadge.badgeClass}`}
            >
              <span className={`w-2 h-2 rounded-full shrink-0 ${liveBadge.dotClass}`} />
              <span className="truncate">{liveBadge.text}</span>
            </div>

            <button
              type="button"
              onClick={fetchSummary}
              disabled={isRefreshingSummary}
              className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-blue-300 px-2 py-1 rounded-lg hover:bg-slate-800 transition shrink-0"
              title="Refresh live context"
            >
              <RotateCw size={12} className={isRefreshingSummary ? "animate-spin text-blue-400" : ""} />
              <span className="hidden sm:inline">Sync</span>
            </button>
          </div>

          {/* Warning Banner if Not Checked In */}
          {!contextSummary?.isCheckedIn && (
            <div className="mx-4 mt-3 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <AlertCircle size={15} className="shrink-0" />
                <span>You have not checked in yet today.</span>
              </div>
              <button
                type="button"
                onClick={() => handleSend("Check me in for today")}
                className="text-[11px] font-semibold bg-amber-600 hover:bg-amber-500 text-white px-2.5 py-1 rounded-lg transition shrink-0"
              >
                Check In Now
              </button>
            </div>
          )}

          {/* Messages Body */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-900/60">
            {messages.map((m) => (
              <ChatBubble
                key={m.id}
                msg={m}
                onExecuteAction={handleExecuteAction}
                onNavigate={handleNavigate}
              />
            ))}

            {isLoading && (
              <div className="flex items-center gap-2 text-slate-400 text-xs italic pl-2">
                <span className="w-2 h-2 bg-blue-500 rounded-full animate-ping" />
                <span>Copilot is analyzing your live data...</span>
              </div>
            )}

            {/* Quick Prompts */}
            {showQuickPrompts && (
              <div className="mt-4 space-y-3 pt-2">
                {getPromptCategories(!!contextSummary?.isCheckedIn).map((cat) => (
                  <div key={cat.category}>
                    <p className="text-[11px] font-semibold text-slate-400 mb-1.5 px-0.5 uppercase tracking-wider">
                      {cat.category}
                    </p>
                    <div className={`grid ${isExpanded ? "grid-cols-2 md:grid-cols-4" : "grid-cols-2"} gap-2`}>
                      {cat.prompts.map((p) => (
                        <button
                          key={p.label}
                          onClick={() => handleSend(p.text)}
                          className="text-left px-3 py-2.5 rounded-xl bg-slate-800/90 hover:bg-blue-600/20 border border-slate-700/80 hover:border-blue-500/50 text-xs text-slate-300 hover:text-white transition group shadow-sm flex items-center justify-between"
                        >
                          <span className="line-clamp-1">{p.label}</span>
                          <span className="text-slate-500 group-hover:text-blue-400 transition text-[10px]">
                            →
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {error && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs flex items-center gap-2">
                <AlertCircle size={15} className="shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Active Listening Soundwave Banner */}
          {isListening && (
            <div className="px-4 py-2 bg-red-500/15 border-t border-red-500/30 flex items-center justify-between text-xs text-red-300 animate-pulse">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
                <span className="font-medium">🎙️ Listening... speak hands-free now</span>
              </div>
              <button
                type="button"
                onClick={toggleListening}
                className="text-[10px] underline hover:text-white"
              >
                Stop
              </button>
            </div>
          )}

          {/* Input Footer */}
          <div className="p-3 bg-slate-800/95 border-t border-slate-700">
            <div className="flex items-center gap-2 bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500/30 transition">
              {/* 🎙️ Voice-to-Text Button */}
              <button
                type="button"
                onClick={toggleListening}
                className={`p-1.5 rounded-lg transition-all relative ${
                  isListening
                    ? "bg-red-600 text-white shadow-lg shadow-red-500/30 ring-2 ring-red-400"
                    : "text-slate-400 hover:text-blue-400 hover:bg-slate-800"
                }`}
                title={isListening ? "Stop listening" : "Voice update (Web Speech)"}
              >
                {isListening ? <MicOff size={16} /> : <Mic size={16} />}
              </button>

              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={
                  isListening
                    ? "Listening to your voice..."
                    : "Ask about hours, log tasks, or 'take a break'..."
                }
                className="flex-1 bg-transparent text-sm text-white placeholder-slate-500 focus:outline-none"
              />

              <button
                type="button"
                onClick={() => handleSend()}
                disabled={!input.trim() || isLoading}
                className="p-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white rounded-lg transition active:scale-95 shadow"
                title="Send message"
              >
                <Send size={15} />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default AiChatWidget;