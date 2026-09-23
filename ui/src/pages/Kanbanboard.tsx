import { useState, useRef } from 'react';
import { tasksApi,taskTimerApi } from '../services/api';
import { TaskLog } from '../types';
import { useToast } from '../context/ToastContext';
import { StatusBadge } from '../components/StatusBadge';
import { Trash2 } from 'lucide-react';

// ═══════════════════════════════════════════════════════════════════════════════
//  Feature 3: Kanban Board with drag-and-drop
// ═══════════════════════════════════════════════════════════════════════════════

const COLUMNS: { id: string; label: string; color: string; icon: string }[] = [
  { id: 'InProgress', label: 'In Progress', color: 'border-blue-500/30 bg-blue-500/5', icon: '🔄' },
  { id: 'Completed', label: 'Completed', color: 'border-emerald-500/30 bg-emerald-500/5', icon: '✅' },
  { id: 'Blocked', label: 'Blocked', color: 'border-red-500/30 bg-red-500/5', icon: '🚫' },
  { id: 'OnHold', label: 'On Hold', color: 'border-amber-500/30 bg-amber-500/5', icon: '⏸️' },
];

const PRIORITY_COLORS: Record<string, string> = {
  High: 'border-l-2 border-red-500',
  Medium: 'border-l-2 border-amber-500',
  Low: 'border-l-2 border-slate-600',
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
  const [activeTimerId, setActiveTimerId] = useState<number | null>(null);
  const [timerSeconds, setTimerSeconds] = useState<number>(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);


  // Drag handlers
  const onDragStart = (task: TaskLog) => { dragTaskRef.current = task; };

  const onDrop = (columnId: string) => {
    const task = dragTaskRef.current;
    if (task && task.status !== columnId) {
      onStatusChange(task.id, columnId);
    }
    dragTaskRef.current = null;
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
      {COLUMNS.map(col => (
        <div
          key={col.id}
          className={`rounded-2xl border p-4 min-h-[200px] ${col.color}`}
          onDragOver={e => e.preventDefault()}
          onDrop={() => onDrop(col.id)}
        >
          {/* Column header */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span>{col.icon}</span>
              <span className="text-sm font-semibold text-white">{col.label}</span>
            </div>
            <span className="text-xs bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full">
              {grouped[col.id]?.length ?? 0}
            </span>
          </div>

          {/* Task cards */}
          <div className="space-y-2">
            {grouped[col.id]?.map(task => (
              <div
                key={task.id}
                draggable
                onDragStart={() => onDragStart(task)}
                className={`bg-slate-900 rounded-xl p-3 cursor-grab active:cursor-grabbing
                  hover:border-slate-600 border border-slate-800 transition group
                  ${PRIORITY_COLORS[task.priority]}`}
              >
                {/* Task title */}
                <p className="text-sm text-white font-medium leading-snug mb-1.5">{task.taskTitle}</p>

                {/* Tags */}
                {task.tags && (
                  <div className="flex flex-wrap gap-1 mb-2">
                    {task.tags.split(',').map(tag => (
                      <span key={tag} className="text-[10px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded">
                        #{tag.trim()}
                      </span>
                    ))}
                  </div>
                )}

                {/* Meta row */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {task.projectName && (
                      <span className="text-[10px] text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded">
                        {task.projectName}
                      </span>
                    )}
                    <span className="text-[10px] text-slate-500">
                      {task.priority === 'High' ? '🔴' : task.priority === 'Medium' ? '🟡' : '🟢'}
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-500">{task.timeSpentMinutes}m</span>
                </div>

                {/* Timer row */}
                <div className="flex items-center gap-1 mt-2 opacity-0 group-hover:opacity-100 transition">
                  <button onClick={() => onEdit(task)}
                    className="text-xs text-slate-400 hover:text-blue-400 px-1.5 py-1 rounded-lg hover:bg-slate-800 transition">
                    ✏️
                  </button>
                  <button
                     onClick={() => onDelete(task.id)}
                     className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition">
                     <Trash2 size={16} />
                   </button>
                </div>
              </div>
            ))}

            {grouped[col.id]?.length === 0 && (
              <div className="text-center py-6 border-2 border-dashed border-slate-800 rounded-xl text-slate-600 text-xs">
                Drop tasks here
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

