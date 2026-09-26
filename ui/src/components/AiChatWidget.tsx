// ─────────────────────────────────────────────────────────────────────────────
//  FILE: ui/src/components/AiChatWidget.tsx
//  AI Copilot Widget - Modern Design System Upgrade (styling only)
//
//  Logic unchanged from previous version:
//  ✅ Floating button → chat window (compact / expanded)
//  ✅ Live context pill (check-in, tasks, break) + sync
//  ✅ Gemini chat with editable action cards (task, status, break, leave, WFH, navigate)
//  ✅ Check-in / check-out fast path with face verify + geofence
//  ✅ Voice input (Web Speech API)
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useRef, type KeyboardEvent } from "react";
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
  Check,
  Bot,
  Sparkles,
  Plus,
  RefreshCw,
  Palmtree,
  Home,
  FileText,
  Clock,
  LogOut,
  Play,
  Zap,
  Eraser,
  Loader2,
  LogIn,
} from "lucide-react";
import type { Message, MessageHistory, SuggestedAction } from "../types/chat";
import { aiChatApi, dailyLogApi } from "../services/api";
import { useToast } from "../context/ToastContext";
import { FaceVerifyModal } from "./FaceVerifyModal";
import { useGeolocation } from "../context/useGeolocation";
import type { FaceVerifyResult } from "../hooks/useFaceRecognition";

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

// ─── Shared styles for action cards ──────────────────────────────────────────
const CARD_CLS = "mt-2.5 p-3.5 rounded-xl bg-white dark:bg-slate-900/95 border shadow-sm space-y-3";
const FIELD_CLS =
  "w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 " +
  "text-slate-900 dark:text-white text-xs outline-none transition dark:[color-scheme:dark]";
const LABEL_CLS = "text-[10px] font-semibold text-slate-500 dark:text-slate-400 block mb-1";
const FOOTER_CLS = "flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800";
const CHOICE_OFF =
  "bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white";

const CardHead = ({
  icon: Icon, tone, title, subtitle, right,
}: {
  icon: React.ElementType; tone: string; title: string; subtitle: string; right?: React.ReactNode;
}) => (
  <div className="flex items-center justify-between gap-2">
    <div className="flex items-center gap-2 min-w-0">
      <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${tone}`}>
        <Icon size={14} />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-bold text-slate-900 dark:text-white truncate">{title}</p>
        <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">{subtitle}</p>
      </div>
    </div>
    {right}
  </div>
);

const Spin = () => <Loader2 size={13} className="animate-spin" />;

// ── Interactive Rich Action Card with Editable Previews ─────────────────────
const ActionCard = ({
  action,
  onExecute,
  onNavigate,
}: {
  action: SuggestedAction;
  onExecute: (act: SuggestedAction) => Promise<boolean | void> | boolean | void;
  onNavigate: (path: string, payload?: any) => void;
}) => {
  const { toast } = useToast();
  const [executed, setExecuted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  // Form states for editable action previews
  const [taskTitle, setTaskTitle] = useState(action.payload?.taskTitle || action.title || "New Task");
  const [taskMinutes, setTaskMinutes] = useState<number>(action.payload?.timeSpentMinutes || 30);
  const [taskPriority, setTaskPriority] = useState(action.payload?.priority || "Medium");
  const [taskStatus, setTaskStatus] = useState(action.payload?.status || "Completed");

  const [breakType, setBreakType] = useState(action.payload?.breakType || "Tea");

  const [fromDate, setFromDate] = useState(
    action.payload?.fromDate || new Date().toISOString().split("T")[0]
  );
  const [toDate, setToDate] = useState(
    action.payload?.toDate || new Date().toISOString().split("T")[0]
  );
  const [leaveType, setLeaveType] = useState(action.payload?.leaveType || "Casual");
  const [leaveReason, setLeaveReason] = useState(action.payload?.reason || "");

  const [wfhDate, setWfhDate] = useState(
    action.payload?.requestDate || new Date().toISOString().split("T")[0]
  );
  const [wfhRequestType, setWfhRequestType] = useState(
    action.payload?.requestType || "WFH"
  );
  const [wfhHalfDaySlot, setWfhHalfDaySlot] = useState(
    action.payload?.halfDaySlot || "Morning"
  );
  const [wfhReason, setWfhReason] = useState(action.payload?.reason || "");

  const handleConfirm = async () => {
    if (action.type === "APPLY_LEAVE") {
      if (fromDate > toDate) {
        toast.error("From Date cannot be after To Date.");
        return;
      }
    }

    if (action.type === "APPLY_WFH") {
      const todayStr = new Date().toISOString().split("T")[0];
      if (wfhDate < todayStr) {
        toast.error("Cannot submit a WFH request for past dates.");
        return;
      }
    }

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
      updatedPayload.requestType = wfhRequestType;
      updatedPayload.requestDate = wfhDate;
      updatedPayload.halfDaySlot = wfhRequestType === "HalfDay" ? wfhHalfDaySlot : undefined;
      updatedPayload.reason = wfhReason || "Requested via AI Copilot";
    }

    const finalAction: SuggestedAction = {
      ...action,
      payload: updatedPayload,
    };

    const res = await onExecute(finalAction);
    setLoading(false);
    if (res !== false) {
      setExecuted(true);
    }
  };

  if (executed) {
    return (
      <div className="mt-2.5 p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-xs flex items-center gap-2">
        <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
        <span className="font-medium">
          Action executed: <strong>{action.title}</strong>
        </span>
      </div>
    );
  }

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
      onNavigate(action.payload?.path || "/tasks", action.payload);
    };

    return (
      <div className={`${CARD_CLS} border-indigo-500/40`}>
        <CardHead
          icon={FileText}
          tone="bg-indigo-500/10 text-indigo-600 dark:text-indigo-400"
          title={action.title}
          subtitle="Prefills draft into official form"
          right={
            <button
              onClick={handleNavClick}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow transition active:scale-95 flex items-center gap-1 shrink-0"
            >
              Review & Submit <ChevronRight size={13} />
            </button>
          }
        />
      </div>
    );
  }

  if (action.type === "CREATE_TASK") {
    return (
      <div className={`${CARD_CLS} border-blue-500/40`}>
        <CardHead
          icon={Plus}
          tone="bg-blue-500/10 text-blue-600 dark:text-blue-400"
          title="Create & Log Task"
          subtitle="Review & customize before creating"
          right={
            <button
              type="button"
              onClick={() => setIsEditing(!isEditing)}
              className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 flex items-center gap-1 transition shrink-0"
            >
              <Edit2 size={11} />
              {isEditing ? "Done" : "Edit"}
            </button>
          }
        />

        <div className="space-y-2 text-xs">
          <div>
            <label className={LABEL_CLS}>Task Title</label>
            <input
              type="text"
              value={taskTitle}
              onChange={(e) => setTaskTitle(e.target.value)}
              placeholder="e.g. Implement user authentication"
              className={`${FIELD_CLS} focus:border-blue-500`}
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={LABEL_CLS}>Time Spent (minutes)</label>
              <input
                type="number"
                min="5"
                max="480"
                step="5"
                value={taskMinutes}
                onChange={(e) => setTaskMinutes(Number(e.target.value))}
                className={`${FIELD_CLS} focus:border-blue-500`}
              />
            </div>
            <div>
              <label className={LABEL_CLS}>Priority</label>
              <select
                value={taskPriority}
                onChange={(e) => setTaskPriority(e.target.value)}
                className={`${FIELD_CLS} focus:border-blue-500`}
              >
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
              </select>
            </div>
          </div>
        </div>

        <div className={FOOTER_CLS}>
          <button
            onClick={handleConfirm}
            disabled={loading || !taskTitle.trim()}
            className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white shadow transition active:scale-95 flex items-center gap-1.5"
          >
            {loading ? <Spin /> : <Check size={13} />}
            {loading ? "Creating..." : "Confirm & Log Task"}
          </button>
        </div>
      </div>
    );
  }

  if (action.type === "UPDATE_TASK_STATUS") {
    return (
      <div className={`${CARD_CLS} border-violet-500/40`}>
        <CardHead
          icon={RefreshCw}
          tone="bg-violet-500/10 text-violet-600 dark:text-violet-400"
          title="Update Task Status"
          subtitle="Review new task state"
        />

        <div className="space-y-2 text-xs">
          <div>
            <label className={LABEL_CLS}>Target Task</label>
            <input
              type="text"
              value={taskTitle}
              onChange={(e) => setTaskTitle(e.target.value)}
              placeholder="Task name or keyword"
              className={`${FIELD_CLS} focus:border-violet-500`}
            />
          </div>
          <div>
            <label className={LABEL_CLS}>New Status</label>
            <div className="grid grid-cols-3 gap-1.5">
              {(["Completed", "InProgress", "Pending"] as const).map((st) => (
                <button
                  type="button"
                  key={st}
                  onClick={() => setTaskStatus(st)}
                  className={`px-2 py-1.5 rounded-lg text-[11px] font-semibold border transition ${
                    taskStatus === st
                      ? "bg-violet-500/15 border-violet-500 text-violet-700 dark:text-violet-300"
                      : CHOICE_OFF
                  }`}
                >
                  {st === "Completed" ? "Completed" : st === "InProgress" ? "In Progress" : "Pending"}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className={FOOTER_CLS}>
          <button
            onClick={handleConfirm}
            disabled={loading}
            className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white shadow transition active:scale-95 flex items-center gap-1.5"
          >
            {loading && <Spin />}
            {loading ? "Updating..." : "Update Status"}
          </button>
        </div>
      </div>
    );
  }

  if (action.type === "START_BREAK") {
    const breakOptions = [
      { type: "Tea", emoji: "☕", label: "Tea Break (15m)" },
      { type: "Lunch", emoji: "🍱", label: "Lunch Break (45m)" },
      { type: "Bio", emoji: "🚻", label: "Bio Break (10m)" },
      { type: "Other", emoji: "💬", label: "Personal Break" },
    ];

    return (
      <div className={`${CARD_CLS} border-amber-500/40`}>
        <CardHead
          icon={Coffee}
          tone="bg-amber-500/10 text-amber-600 dark:text-amber-400"
          title="Start a Break"
          subtitle="Select break type before confirming"
        />

        <div className="grid grid-cols-2 gap-1.5 text-xs">
          {breakOptions.map((b) => (
            <button
              key={b.type}
              type="button"
              onClick={() => setBreakType(b.type)}
              className={`p-2 rounded-lg border text-left flex items-center gap-1.5 transition ${
                breakType === b.type
                  ? "bg-amber-500/15 border-amber-500/60 text-amber-800 dark:text-amber-200"
                  : CHOICE_OFF
              }`}
            >
              <span>{b.emoji}</span>
              <span className="text-[11px] font-semibold">{b.label}</span>
            </button>
          ))}
        </div>

        <div className={FOOTER_CLS}>
          <button
            onClick={handleConfirm}
            disabled={loading}
            className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-white shadow transition active:scale-95 flex items-center gap-1.5"
          >
            {loading ? <Spin /> : <Coffee size={13} />}
            {loading ? "Starting..." : `Start ${breakType} Break`}
          </button>
        </div>
      </div>
    );
  }

  if (action.type === "APPLY_LEAVE") {
    return (
      <div className={`${CARD_CLS} border-emerald-500/40`}>
        <CardHead
          icon={Palmtree}
          tone="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
          title="Apply for Leave"
          subtitle="Editable preview (entitlement validated)"
          right={
            <button
              onClick={() => onNavigate("/leave")}
              className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-0.5 shrink-0"
            >
              Leave Page <ChevronRight size={11} />
            </button>
          }
        />

        <div className="grid grid-cols-2 gap-2 text-xs">
          <div>
            <label className={LABEL_CLS}>From Date</label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => {
                const val = e.target.value;
                setFromDate(val);
                if (toDate < val) {
                  setToDate(val);
                }
              }}
              className={`${FIELD_CLS} focus:border-emerald-500`}
            />
          </div>
          <div>
            <label className={LABEL_CLS}>To Date</label>
            <input
              type="date"
              min={fromDate}
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className={`${FIELD_CLS} focus:border-emerald-500`}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
          <div>
            <label className={LABEL_CLS}>Leave Type</label>
            <select
              value={leaveType}
              onChange={(e) => setLeaveType(e.target.value)}
              className={`${FIELD_CLS} focus:border-emerald-500`}
            >
              <option value="Casual">Casual Leave (12d/yr)</option>
              <option value="Sick">Sick Leave (7d/yr)</option>
              <option value="Earned">Earned Leave (15d/yr)</option>
              <option value="CompOff">Comp Off</option>
              <option value="Unpaid">Unpaid Leave</option>
            </select>
          </div>
          <div>
            <label className={LABEL_CLS}>Reason</label>
            <input
              type="text"
              placeholder="Reason (optional)"
              value={leaveReason}
              onChange={(e) => setLeaveReason(e.target.value)}
              className={`${FIELD_CLS} focus:border-emerald-500`}
            />
          </div>
        </div>

        <div className={FOOTER_CLS}>
          <button
            onClick={handleConfirm}
            disabled={loading}
            className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white shadow transition active:scale-95 flex items-center gap-1.5"
          >
            {loading ? <Spin /> : <Check size={13} />}
            {loading ? "Submitting..." : "Confirm Leave"}
          </button>
        </div>
      </div>
    );
  }

  if (action.type === "APPLY_WFH") {
    const todayStr = new Date().toISOString().split("T")[0];
    return (
      <div className={`${CARD_CLS} border-violet-500/40`}>
        <CardHead
          icon={Home}
          tone="bg-violet-500/10 text-violet-600 dark:text-violet-400"
          title={`Apply for ${wfhRequestType === "HalfDay" ? "Half Day WFH" : "WFH"}`}
          subtitle="Validated with manager notification"
          right={
            <button
              onClick={() => onNavigate("/request")}
              className="text-[10px] font-semibold text-violet-600 dark:text-violet-400 hover:underline flex items-center gap-0.5 shrink-0"
            >
              WFH Page <ChevronRight size={11} />
            </button>
          }
        />

        <div className="grid grid-cols-2 gap-2 text-xs">
          <div>
            <label className={LABEL_CLS}>Type</label>
            <select
              value={wfhRequestType}
              onChange={(e) => setWfhRequestType(e.target.value)}
              className={`${FIELD_CLS} focus:border-violet-500`}
            >
              <option value="WFH">Full Day WFH</option>
              <option value="HalfDay">Half Day WFH</option>
            </select>
          </div>
          <div>
            <label className={LABEL_CLS}>Request Date</label>
            <input
              type="date"
              min={todayStr}
              value={wfhDate}
              onChange={(e) => setWfhDate(e.target.value)}
              className={`${FIELD_CLS} focus:border-violet-500`}
            />
          </div>
        </div>

        {wfhRequestType === "HalfDay" && (
          <div className="text-xs">
            <label className={LABEL_CLS}>Half Day Slot</label>
            <div className="grid grid-cols-2 gap-2">
              {(["Morning", "Afternoon"] as const).map((slot) => (
                <button
                  type="button"
                  key={slot}
                  onClick={() => setWfhHalfDaySlot(slot)}
                  className={`py-1.5 px-2 rounded-lg border text-[11px] font-semibold text-center transition ${
                    wfhHalfDaySlot === slot
                      ? "bg-violet-500/15 border-violet-500 text-violet-700 dark:text-violet-300"
                      : CHOICE_OFF
                  }`}
                >
                  {slot === "Morning" ? "🌅 Morning" : "🌇 Afternoon"}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="text-xs">
          <label className={LABEL_CLS}>Reason</label>
          <input
            type="text"
            placeholder="Reason for WFH"
            value={wfhReason}
            onChange={(e) => setWfhReason(e.target.value)}
            className={`${FIELD_CLS} focus:border-violet-500`}
          />
        </div>

        <div className={FOOTER_CLS}>
          <button
            onClick={handleConfirm}
            disabled={loading}
            className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white shadow transition active:scale-95 flex items-center gap-1.5"
          >
            {loading ? <Spin /> : <Check size={13} />}
            {loading ? "Submitting..." : `Confirm ${wfhRequestType === "HalfDay" ? "Half Day" : "WFH"}`}
          </button>
        </div>
      </div>
    );
  }

  const ActionIcon =
    action.type === "CHECK_IN" ? LogIn :
    action.type === "CHECK_OUT" ? LogOut :
    action.type === "END_BREAK" ? Play : Zap;

  return (
    <div className={`${CARD_CLS} border-blue-500/40`}>
      <CardHead
        icon={ActionIcon}
        tone="bg-blue-500/10 text-blue-600 dark:text-blue-400"
        title={action.title}
        subtitle="Ready to execute automatically"
        right={
          <button
            onClick={handleConfirm}
            disabled={loading}
            className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white shadow transition active:scale-95 flex items-center gap-1.5 shrink-0"
          >
            {loading && <Spin />}
            {loading ? "Executing..." : "Confirm"}
          </button>
        }
      />
    </div>
  );
};

const AssistantMessage = ({ content }: { content: string }) => {
  return (
    <div className="space-y-1.5 text-[13px] leading-relaxed">
      {content.split("\n").map((line, i) => {
        if (!line.trim()) return <div key={i} className="h-1" />;
        const boldParsed = line.split(/(\*\*.*?\*\*|\*.*?\*)/g).map((part, j) => {
          if (part.startsWith("**") && part.endsWith("**")) {
            return (
              <strong key={j} className="text-slate-900 dark:text-white font-semibold">
                {part.slice(2, -2)}
              </strong>
            );
          }
          if (part.startsWith("*") && part.endsWith("*")) {
            return (
              <em key={j} className="text-blue-600 dark:text-blue-300 font-normal">
                {part.slice(1, -1)}
              </em>
            );
          }
          return part;
        });

        if (line.trim().startsWith("•") || line.trim().startsWith("-")) {
          return (
            <div key={i} className="flex items-start gap-1.5 ml-1">
              <span className="text-blue-500 font-bold shrink-0">•</span>
              <span className="text-slate-700 dark:text-slate-300">{boldParsed}</span>
            </div>
          );
        }

        return (
          <p key={i} className="text-slate-700 dark:text-slate-300">
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
  onExecuteAction: (act: SuggestedAction) => Promise<boolean | void> | boolean | void;
  onNavigate: (path: string) => void;
}) => {
  const isUser = msg.role === "user";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"} items-end gap-2.5`}>
      {!isUser && (
        <div className="w-8 h-8 bg-gradient-to-br from-blue-600 via-indigo-600 to-violet-600 rounded-xl flex items-center justify-center shrink-0 text-white shadow-md">
          <Bot size={16} />
        </div>
      )}
      <div
        className={`max-w-[88%] px-4 py-3 rounded-2xl text-sm leading-relaxed ${
          isUser
            ? "bg-blue-600 text-white rounded-br-md shadow-md shadow-blue-500/20"
            : "bg-white dark:bg-slate-800/95 border border-slate-200 dark:border-slate-700/80 text-slate-800 dark:text-slate-200 rounded-bl-md shadow-sm"
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
        <p className={`text-[10px] mt-1.5 ${isUser ? "text-blue-100 text-right" : "text-slate-400 dark:text-slate-500"}`}>
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
  const [isExpanded, setIsExpanded] = useState(false);
  const [messages, setMessages] = useState<Message[]>([INITIAL_MESSAGE]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshingSummary, setIsRefreshingSummary] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [contextSummary, setContextSummary] = useState<ContextSummary | null>(null);

  // Face Verification & Geolocation for AI Assistant Check-In/Out
  const [showFaceVerify, setShowFaceVerify] = useState(false);
  const [pendingAttendanceAction, setPendingAttendanceAction] = useState<"checkin" | "checkout" | null>(null);
  const geo = useGeolocation();

  // Voice-to-Text Speech Recognition
  const [isListening, setIsListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const recognitionRef = useRef<any>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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
      const baselineText = input.trim();
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
        setInput(baselineText ? `${baselineText} ${transcript}` : transcript);
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

  // ── Face Verification Completion Flow (Check In & Check Out) ──
  const handleFaceVerifyComplete = async (_faceResult: FaceVerifyResult | null) => {
    setShowFaceVerify(false);
    const actionType = pendingAttendanceAction;
    setPendingAttendanceAction(null);

    if (!actionType) return;

    try {
      setIsLoading(true);

      // 1. Get GPS coordinates (geofencing check)
      const coords = await geo.requestLocation();
      const isWFH = contextSummary?.dayStatus === "WFH" || contextSummary?.dayStatus === "HalfDay";

      if (!coords && !isWFH) {
        if (geo.status === "denied") {
          toast.error("📍 Location permission denied. Please allow location access in your browser settings.");
        } else if (geo.status === "outside") {
          toast.error(`📍 ${geo.errorMessage || "You are outside the office geofence. If working from home, apply for WFH first."}`);
        } else {
          toast.error("📍 Could not acquire your GPS location. Please try again.");
        }
        setIsLoading(false);
        return;
      }

      // 2. Perform CheckIn or CheckOut via DailyLog service
      if (actionType === "checkin") {
        await dailyLogApi.checkIn({
          dayStatus: "Present",
          latitude: coords?.latitude,
          longitude: coords?.longitude,
          notes: "Checked in via AI Copilot with Face Verify",
        });

        toast.success("Successfully checked in with face verification!");
        const checkInMsg: Message = {
          id: Date.now().toString(),
          role: "assistant",
          content: `✅ **Checked In**: Face verified! Checked in for today at ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}. Have a great day!`,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, checkInMsg]);
      } else if (actionType === "checkout") {
        await dailyLogApi.checkOut({
          latitude: coords?.latitude,
          longitude: coords?.longitude,
          notes: "Checked out via AI Copilot with Face Verify",
        });

        toast.success("Successfully checked out with face verification!");
        const checkOutMsg: Message = {
          id: Date.now().toString(),
          role: "assistant",
          content: `🚪 **Checked Out**: Face verified! Checked out for today at ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}. Great job today!`,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, checkOutMsg]);
      }

      // 3. Refresh AI context pill & notify dashboard/other components
      await fetchSummary();
      window.dispatchEvent(new Event("daily_log_updated"));
    } catch (err: any) {
      const errMsg = err?.response?.data?.message || err?.message || "Attendance action failed. Please try again.";
      setError(errMsg);
      toast.error(errMsg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleExecuteAction = async (action: SuggestedAction): Promise<boolean | void> => {
    // Check-In: open face verify screen
    if (action.type === "CHECK_IN") {
      if (contextSummary?.isCheckedIn) {
        toast.warning("You are already checked in for today.");
        return;
      }
      setPendingAttendanceAction("checkin");
      setShowFaceVerify(true);
      return;
    }

    // Check-Out: open face verify screen
    if (action.type === "CHECK_OUT") {
      if (!contextSummary?.isCheckedIn) {
        toast.warning("You must check in before checking out.");
        return;
      }
      if (contextSummary?.isCheckedOut) {
        toast.warning("You have already checked out for today.");
        return;
      }
      setPendingAttendanceAction("checkout");
      setShowFaceVerify(true);
      return;
    }

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
        if (action.type === "APPLY_LEAVE") {
          window.dispatchEvent(new Event("leave_applied"));
        }
        if (action.type === "APPLY_WFH") {
          window.dispatchEvent(new Event("wfh_applied"));
        }
        return true;
      }
      return false;
    } catch (err: any) {
      const errMsg = err?.response?.data?.message || "Failed to execute action.";
      setError(errMsg);
      toast.error(errMsg);
      return false;
    }
  };

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

    const lower = trimmed.toLowerCase();

    // Fast path for Check In → face verify modal immediately
    if (
      lower.includes("check in") ||
      lower.includes("check me in") ||
      lower.includes("clock in") ||
      lower.includes("clock me in") ||
      lower.includes("check-in")
    ) {
      if (contextSummary?.isCheckedIn) {
        toast.warning("You are already checked in for today.");
        return;
      }
      if (!overrideText) setInput("");
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          role: "user",
          content: trimmed,
          timestamp: new Date(),
        },
      ]);
      handleExecuteAction({
        id: "checkin-" + Date.now(),
        type: "CHECK_IN",
        title: "Check In for Today",
        payload: { dayStatus: "Present" },
      });
      return;
    }

    // Fast path for Check Out → face verify modal immediately
    if (
      lower.includes("check out") ||
      lower.includes("check me out") ||
      lower.includes("clock out") ||
      lower.includes("clock me out") ||
      lower.includes("check-out")
    ) {
      if (!contextSummary?.isCheckedIn) {
        toast.warning("You must check in before checking out.");
        return;
      }
      if (contextSummary?.isCheckedOut) {
        toast.warning("You have already checked out for today.");
        return;
      }
      if (!overrideText) setInput("");
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          role: "user",
          content: trimmed,
          timestamp: new Date(),
        },
      ]);
      handleExecuteAction({
        id: "checkout-" + Date.now(),
        type: "CHECK_OUT",
        title: "Check Out for Today",
        payload: {},
      });
      return;
    }

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

  const handleNavigate = (path: string, payload?: any) => {
    setIsOpen(false);
    navigate(path, { state: payload?.action === "open_add_modal" ? { openAddModal: true } : payload });
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const getLiveContextPill = () => {
    if (!contextSummary) {
      return {
        badgeClass: "bg-slate-100 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300",
        dotClass: "bg-slate-400",
        text: "Syncing day status…",
      };
    }

    if (contextSummary.isCheckedIn) {
      const checkInStr = contextSummary.checkInTime ? `In at ${contextSummary.checkInTime}` : "Checked in";
      const tasksStr = `${contextSummary.tasksCount} ${contextSummary.tasksCount === 1 ? "task" : "tasks"}`;
      const breakStr = contextSummary.isOnBreak ? ` · On ${contextSummary.activeBreakType || "break"}` : "";

      return {
        badgeClass: "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300",
        dotClass: "bg-emerald-500 animate-pulse",
        text: `${checkInStr} · ${tasksStr}${breakStr}`,
      };
    }

    return {
      badgeClass: "bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-300",
      dotClass: "bg-amber-500",
      text: "Not checked in yet",
    };
  };

  const liveBadge = getLiveContextPill();

  return (
    <>
      {/* Floating Trigger Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 z-50 pl-3.5 pr-4 py-3 bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 hover:brightness-110 text-white rounded-full shadow-xl shadow-indigo-500/30 hover:scale-105 active:scale-95 transition-all duration-200 flex items-center gap-2"
          aria-label="Open AI Assistant"
        >
          <Sparkles size={18} />
          <span className="text-xs font-bold hidden sm:inline tracking-wide">AI Help</span>
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
        </button>
      )}

      {/* Backdrop when expanded */}
      {isOpen && isExpanded && (
        <div
          onClick={() => setIsExpanded(false)}
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-40 transition-opacity animate-in fade-in"
        />
      )}

      {/* Face Verification Screen for AI Copilot Check-In / Check-Out */}
      {showFaceVerify && pendingAttendanceAction && (
        <FaceVerifyModal
          action={pendingAttendanceAction === "checkin" ? "CheckIn" : "CheckOut"}
          isWFH={contextSummary?.dayStatus === "WFH"}
          onSuccess={handleFaceVerifyComplete}
          onCancel={() => {
            setShowFaceVerify(false);
            setPendingAttendanceAction(null);
          }}
        />
      )}

      {/* Chat Window */}
      {isOpen && (
        <div
          className={`fixed z-50 flex flex-col bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden transition-all duration-300 ${
            isExpanded
              ? "inset-3 sm:inset-6 md:inset-8 lg:max-w-5xl lg:mx-auto"
              : "bottom-5 right-5 w-[94vw] sm:w-[460px] h-[660px] max-h-[88vh]"
          } animate-in fade-in slide-in-from-bottom-5`}
        >
          {/* Gradient header */}
          <div className="relative px-4 py-3.5 bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 text-white flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-white/15 border border-white/20 flex items-center justify-center shrink-0">
                <Bot size={18} />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold truncate">Daily Tracker Copilot</h3>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/20 border border-white/25 font-semibold">
                    Live
                  </span>
                </div>
                <p className="text-[11px] text-white/75 truncate">Attendance, tasks & EOD assistant</p>
              </div>
            </div>

            <div className="flex items-center gap-0.5 shrink-0">
              <button
                type="button"
                onClick={() => setIsExpanded(!isExpanded)}
                className="p-2 rounded-lg text-white/80 hover:text-white hover:bg-white/15 transition"
                title={isExpanded ? "Collapse to Widget" : "Expand to Full Window"}
              >
                {isExpanded ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
              </button>
              <button
                type="button"
                onClick={() => setMessages([INITIAL_MESSAGE])}
                className="p-2 rounded-lg text-white/80 hover:text-white hover:bg-white/15 transition"
                title="Clear chat messages"
              >
                <Eraser size={16} />
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  setIsExpanded(false);
                }}
                className="p-2 rounded-lg text-white/80 hover:text-white hover:bg-white/15 transition"
                title="Close chat"
              >
                <X size={17} />
              </button>
            </div>
          </div>

          {/* Live context bar */}
          <div className="px-3.5 py-2 bg-slate-50 dark:bg-slate-950/60 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2">
            <div className={`flex items-center gap-2 px-3 py-1 rounded-full border text-[11px] font-semibold min-w-0 ${liveBadge.badgeClass}`}>
              <span className={`w-2 h-2 rounded-full shrink-0 ${liveBadge.dotClass}`} />
              <Clock size={11} className="shrink-0 opacity-70" />
              <span className="truncate">{liveBadge.text}</span>
            </div>
            <button
              type="button"
              onClick={fetchSummary}
              disabled={isRefreshingSummary}
              className="flex items-center gap-1 text-[11px] font-semibold text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 px-2 py-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition shrink-0"
              title="Refresh live context"
            >
              <RotateCw size={12} className={isRefreshingSummary ? "animate-spin text-blue-500" : ""} />
              <span className="hidden sm:inline">Sync</span>
            </button>
          </div>

          {/* Not-checked-in banner */}
          {!contextSummary?.isCheckedIn && (
            <div className="mx-4 mt-3 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-300 text-xs flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <AlertCircle size={15} className="shrink-0" />
                <span className="font-medium">You have not checked in yet today.</span>
              </div>
              <button
                type="button"
                onClick={() =>
                  handleExecuteAction({
                    id: "checkin-banner-" + Date.now(),
                    type: "CHECK_IN",
                    title: "Check In for Today",
                    payload: { dayStatus: "Present" },
                  })
                }
                className="inline-flex items-center gap-1 text-[11px] font-semibold bg-amber-500 hover:bg-amber-400 text-white px-2.5 py-1.5 rounded-lg transition shrink-0 shadow active:scale-95"
              >
                <LogIn size={12} /> Check In
              </button>
            </div>
          )}

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/60 dark:bg-slate-900/60">
            {messages.map((m) => (
              <ChatBubble
                key={m.id}
                msg={m}
                onExecuteAction={handleExecuteAction}
                onNavigate={handleNavigate}
              />
            ))}

            {isLoading && (
              <div className="flex items-end gap-2.5">
                <div className="w-8 h-8 bg-gradient-to-br from-blue-600 via-indigo-600 to-violet-600 rounded-xl flex items-center justify-center shrink-0 text-white">
                  <Bot size={16} />
                </div>
                <div className="px-4 py-3 rounded-2xl rounded-bl-md bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center gap-2">
                  <div className="flex gap-1">
                    {[0, 150, 300].map(d => (
                      <span key={d} className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: `${d}ms` }} />
                    ))}
                  </div>
                  <span className="text-xs text-slate-500 dark:text-slate-400">Analyzing your live data…</span>
                </div>
              </div>
            )}

            {/* Quick prompts */}
            {showQuickPrompts && (
              <div className="space-y-4 pt-1">
                {getPromptCategories(!!contextSummary?.isCheckedIn).map((cat) => (
                  <div key={cat.category}>
                    <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-2 px-0.5 uppercase tracking-wider">
                      {cat.category}
                    </p>
                    <div className={`grid ${isExpanded ? "grid-cols-2 md:grid-cols-4" : "grid-cols-2"} gap-2`}>
                      {cat.prompts.map((p) => (
                        <button
                          key={p.label}
                          onClick={() => handleSend(p.text)}
                          className="group text-left px-3 py-2.5 rounded-xl bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/80 hover:border-blue-500/50 hover:bg-blue-500/5 text-xs font-medium text-slate-700 dark:text-slate-300 hover:text-blue-700 dark:hover:text-white shadow-sm transition flex items-center justify-between gap-1"
                        >
                          <span className="line-clamp-1">{p.label}</span>
                          <ChevronRight size={12} className="shrink-0 text-slate-400 group-hover:text-blue-500 transition" />
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {error && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle size={15} className="shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Listening banner */}
          {isListening && (
            <div className="px-4 py-2 bg-rose-500/10 border-t border-rose-500/30 flex items-center justify-between text-xs text-rose-700 dark:text-rose-300">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                <span className="font-semibold">Listening… speak hands-free now</span>
              </div>
              <button
                type="button"
                onClick={toggleListening}
                className="text-[11px] font-semibold underline hover:no-underline"
              >
                Stop
              </button>
            </div>
          )}

          {/* Input */}
          <div className="p-3 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-2xl pl-2 pr-1.5 py-1.5 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20 transition">
              <button
                type="button"
                onClick={toggleListening}
                className={`p-2 rounded-xl transition-all ${
                  isListening
                    ? "bg-rose-600 text-white shadow-lg shadow-rose-500/30 ring-2 ring-rose-400"
                    : "text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                }`}
                title={isListening ? "Stop listening" : "Voice input"}
              >
                {isListening ? <MicOff size={16} /> : <Mic size={16} />}
              </button>

              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={isListening ? "Listening to your voice..." : "Ask about hours, log tasks, or 'take a break'..."}
                className="flex-1 min-w-0 bg-transparent text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none"
              />

              <button
                type="button"
                onClick={() => handleSend()}
                disabled={!input.trim() || isLoading}
                className="p-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white rounded-xl transition active:scale-95 shadow-md shadow-blue-500/20"
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