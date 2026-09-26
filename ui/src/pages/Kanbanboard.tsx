// ─────────────────────────────────────────────────────────────────────────────
//  FILE: ui/src/pages/Kanbanboard.tsx
//  Task Kanban Board - Modern Design System Upgrade
//
//  Used by Taskspage.tsx (Kanban view).
//  Logic unchanged from previous version:
//  ✅ 4 columns (In Progress / Completed / Blocked / On Hold)
//  ✅ Drag a card to another column → onStatusChange(id, status)
//  ✅ Edit / delete callbacks
//  ✅ Per-task live timer (taskTimerApi start/stop) — now has a button
//     on In Progress cards (the handlers existed but were never wired up).
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useRef, useEffect } from 'react';
import { taskTimerApi } from '../services/api';
import type { TaskLog } from '../types';
import { useToast } from '../context/ToastContext';
import {
  Trash2,
  Pencil,
  RefreshCw,
  CheckCircle2,
  Ban,
  PauseOctagon,
  Clock,
  Play,
  Square,
  GripVertical,
  FolderOpen,
  Hash,
} from 'lucide-react';

// ═══════════════════════════════════════════════════════════════════════════════
//  Columns + priority styles
// ═══════════════════════════════════════════════════════════════════════════════

const COLUMNS: { id: string; label: string; icon: React.ElementType; head: string; body: string; over: string }[] = [
  {
    id: 'InProgress', label: 'In Progress', icon: RefreshCw,
    head: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
    body: 'bg-blue-500/[0.03] border-blue-500/20',
    over: 'ring-2 ring-blue-500/50 bg-blue-500/10',
  },
  {
    id: 'Completed', label: 'Completed', icon: CheckCircle2,
    head: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
    body: 'bg-emerald-500/[0.03] border-emerald-500/20',
    over: 'ring-2 ring-emerald-500/50 bg-emerald-500/10',
  },
  {
    id: 'Blocked', label: 'Blocked', icon: Ban,
    head: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20',
    body: 'bg-rose-500/[0.03] border-rose-500/20',
    over: 'ring-2 ring-rose-500/50 bg-rose-500/10',
  },
  {
    id: 'OnHold', label: 'On Hold', icon: PauseOctagon,
    head: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
    body: 'bg-amber-500/[0.03] border-amber-500/20',
    over: 'ring-2 ring-amber-500/50 bg-amber-500/10',
  },
];

const PRIORITY_BORDER: Record<string, string> = {
  High:   'border-l-rose-500',
  Medium: 'border-l-amber-500',
  Low:    'border-l-slate-300 dark:border-l-slate-600',
};

const PRIORITY_CHIP: Record<string, string> = {
  High:   'bg-rose-500/10 text-rose-600 dark:text-rose-400',
  Medium: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  Low:    'bg-slate-500/10 text-slate-600 dark:text-slate-400',
};

interface KanbanProps {
  tasks: TaskLog[];
  onEdit: (task: TaskLog) => void;
  onDelete: (id: number) => void;
  onStatusChange: (id: number, status: string) => void;
}

export const KanbanBoard = ({
  tasks,
  onEdit,
  onDelete,
  onStatusChange
}: KanbanProps) => {
  const { toast } = useToast();
  const dragTaskRef = useRef<TaskLog | null>(null);
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);
  const [activeTimerId, setActiveTimerId] = useState<number | null>(null);
  const [timerSeconds, setTimerSeconds] = useState<number>(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Clear the interval if the board unmounts while a timer is running
  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); }, []);

  // Drag handlers
  const onDragStart = (task: TaskLog) => { dragTaskRef.current = task; };

  const onDrop = (columnId: string) => {
    const task = dragTaskRef.current;
    if (task && task.status !== columnId) {
      onStatusChange(task.id, columnId);
    }
    dragTaskRef.current = null;
    setDragOverCol(null);
  };

  // Per-task live timer
  const startTimer = async (taskId: number) => {
    try {
      await taskTimerApi.start(taskId);
      setActiveTimerId(taskId);
      setTimerSeconds(0);
      timerRef.current = setInterval(() => setTimerSeconds(s => s + 1), 1000);
      toast.success('Timer started!');
    } catch { toast.error('Failed to start timer'); }
  };

  const stopTimer = async (taskId: number) => {
    try {
      await taskTimerApi.stop(taskId);
      if (timerRef.current) clearInterval(timerRef.current);
      setActiveTimerId(null);
      setTimerSeconds(0);
      toast.success('Timer stopped — time added to task!');
    } catch { toast.error('Failed to stop timer'); }
  };

  const pad = (n: number) => n.toString().padStart(2, '0');
  const formatTimer = (s: number) => `${pad(Math.floor(s / 60))}:${pad(s % 60)}`;

  const grouped = COLUMNS.reduce((acc, col) => {
    acc[col.id] = tasks.filter(t => t.status === col.id);
    return acc;
  }, {} as Record<string, TaskLog[]>);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
      {COLUMNS.map(col => {
        const Icon = col.icon;
        const items = grouped[col.id] ?? [];
        const isOver = dragOverCol === col.id;
        return (
          <div
            key={col.id}
            className={`rounded-2xl border p-3 min-h-[240px] flex flex-col transition ${col.body} ${isOver ? col.over : ''}`}
            onDragOver={e => { e.preventDefault(); if (dragOverCol !== col.id) setDragOverCol(col.id); }}
            onDragLeave={e => {
              if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOverCol(null);
            }}
            onDrop={() => onDrop(col.id)}
          >
            {/* Column header */}
            <div className="flex items-center justify-between px-1 mb-3">
              <div className="flex items-center gap-2">
                <div className={`p-1.5 rounded-lg border ${col.head}`}>
                  <Icon className="w-3.5 h-3.5" />
                </div>
                <span className="text-sm font-bold text-slate-900 dark:text-white">{col.label}</span>
              </div>
              <span className="text-[11px] font-bold min-w-[22px] text-center px-1.5 py-0.5 rounded-full bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                {items.length}
              </span>
            </div>

            {/* Task cards */}
            <div className="space-y-2 flex-1">
              {items.map(task => {
                const timing = activeTimerId === task.id;
                return (
                  <div
                    key={task.id}
                    draggable
                    onDragStart={() => onDragStart(task)}
                    onDragEnd={() => setDragOverCol(null)}
                    className={`group rounded-xl p-3 cursor-grab active:cursor-grabbing bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 border-l-[3px] shadow-sm hover:shadow-md hover:-translate-y-0.5 transition ${
                      PRIORITY_BORDER[task.priority] ?? PRIORITY_BORDER.Low
                    } ${timing ? 'ring-2 ring-blue-500/40' : ''}`}
                  >
                    <div className="flex items-start gap-1.5">
                      <GripVertical className="w-3.5 h-3.5 mt-0.5 text-slate-300 dark:text-slate-600 shrink-0" />
                      <p className="text-sm font-semibold text-slate-900 dark:text-white leading-snug flex-1 min-w-0">{task.taskTitle}</p>
                    </div>

                    {task.tags && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {task.tags.split(',').map(tag => (
                          <span key={tag} className="inline-flex items-center gap-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                            <Hash className="w-2.5 h-2.5" />{tag.trim()}
                          </span>
                        ))}
                      </div>
                    )}

                    <div className="flex items-center justify-between gap-2 mt-2.5">
                      <div className="flex items-center gap-1.5 min-w-0">
                        {task.projectName && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400 truncate max-w-[110px]">
                            <FolderOpen className="w-3 h-3 shrink-0" /> <span className="truncate">{task.projectName}</span>
                          </span>
                        )}
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${PRIORITY_CHIP[task.priority] ?? PRIORITY_CHIP.Low}`}>
                          {task.priority}
                        </span>
                      </div>
                      <span className="inline-flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400 shrink-0">
                        <Clock className="w-3 h-3" /> {task.timeSpentMinutes}m
                      </span>
                    </div>

                    {/* Actions */}
                    <div className={`flex items-center justify-between gap-1 mt-2.5 pt-2.5 border-t border-slate-100 dark:border-slate-800 transition ${
                      timing ? 'opacity-100' : 'sm:opacity-0 sm:group-hover:opacity-100'
                    }`}>
                      {task.status === 'InProgress' ? (
                        timing ? (
                          <button
                            onClick={() => stopTimer(task.id)}
                            className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2 py-1 rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400 hover:bg-rose-500/20 transition"
                            title="Stop timer and add time to task"
                          >
                            <Square className="w-3 h-3 fill-current" />
                            <span className="tabular-nums">{formatTimer(timerSeconds)}</span>
                          </button>
                        ) : (
                          <button
                            onClick={() => startTimer(task.id)}
                            disabled={activeTimerId !== null}
                            className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-lg text-blue-600 dark:text-blue-400 hover:bg-blue-500/10 transition disabled:opacity-40 disabled:cursor-not-allowed"
                            title={activeTimerId !== null ? 'Another timer is running' : 'Start timer'}
                          >
                            <Play className="w-3 h-3 fill-current" /> Timer
                          </button>
                        )
                      ) : <span />}
                      <div className="flex items-center gap-0.5">
                        <button
                          onClick={() => onEdit(task)}
                          title="Edit task"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-500/10 transition"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => onDelete(task.id)}
                          title="Delete task"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-500/10 transition"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}

              {items.length === 0 && (
                <div className={`flex flex-col items-center justify-center text-center py-8 rounded-xl border-2 border-dashed text-xs font-medium transition ${
                  isOver
                    ? 'border-current text-slate-600 dark:text-slate-300'
                    : 'border-slate-200 dark:border-slate-800 text-slate-400 dark:text-slate-500'
                }`}>
                  <Icon className="w-5 h-5 mb-1.5 opacity-60" />
                  Drop tasks here
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
