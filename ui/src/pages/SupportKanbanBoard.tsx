// ─────────────────────────────────────────────────────────────────────────────
//  FILE: ui/src/pages/SupportKanbanBoard.tsx
//  Support Kanban Board - Modern Design System Upgrade
//
//  Used by Supportpage.tsx (Kanban view).
//  Logic unchanged: one column per support type, count + total time per
//  column, delete via onDelete (confirm dialog lives in Supportpage).
// ─────────────────────────────────────────────────────────────────────────────

import type { SupportLog } from '../types';
import { SupportMediaDisplay } from '../components/SupportMediaDisplay';
import {
  Wrench,
  Code2,
  Bug,
  Rocket,
  HelpCircle,
  Trash2,
  Timer,
  Clock,
  CheckCircle2,
  UserCheck,
  ArrowRight,
  Inbox,
} from 'lucide-react';

interface Props {
  logs: SupportLog[];
  onDelete: (id: number) => void;
}

type SupportType =
  | 'Technical'
  | 'CodeReview'
  | 'Debugging'
  | 'Deployment'
  | 'Other';

const columns: SupportType[] = [
  'Technical',
  'CodeReview',
  'Debugging',
  'Deployment',
  'Other',
];

const COLUMN_META: Record<SupportType, { label: string; icon: React.ElementType; gradient: string }> = {
  Technical:  { label: 'Technical',   icon: Wrench,     gradient: 'from-blue-600 to-indigo-600' },
  CodeReview: { label: 'Code Review', icon: Code2,      gradient: 'from-violet-600 to-fuchsia-600' },
  Debugging:  { label: 'Debugging',   icon: Bug,        gradient: 'from-rose-600 to-orange-500' },
  Deployment: { label: 'Deployment',  icon: Rocket,     gradient: 'from-emerald-600 to-teal-600' },
  Other:      { label: 'Other',       icon: HelpCircle, gradient: 'from-slate-500 to-slate-700' },
};

const formatISTTime = (dateString?: string) => {
  if (!dateString) return '--:--';
  // Force treat backend time as UTC
  const utcDate = new Date(dateString + 'Z');
  return utcDate.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    timeZone: 'Asia/Kolkata',
  });
};

export const SupportKanbanBoard = ({ logs, onDelete }: Props) => {
  const formatTime = (minutes: number) => {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${h > 0 ? `${h}h ` : ''}${m}m`;
  };

  return (
    <div className="pb-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        {columns.map((column) => {
          const meta = COLUMN_META[column];
          const Icon = meta.icon;
          const columnLogs = logs.filter((l) => l.supportType === column);
          const totalMinutes = columnLogs.reduce((sum, l) => sum + l.timeSpentMinutes, 0);

          return (
            <div
              key={column}
              className="flex flex-col rounded-2xl overflow-hidden bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 shadow-sm"
            >
              {/* Column header */}
              <div className={`bg-gradient-to-r ${meta.gradient} p-4 text-white`}>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="p-1.5 rounded-lg bg-white/15 border border-white/20 shrink-0">
                      <Icon className="w-4 h-4" />
                    </div>
                    <h3 className="text-sm font-bold truncate">{meta.label}</h3>
                  </div>
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-white/20 shrink-0">
                    {columnLogs.length}
                  </span>
                </div>
                <p className="inline-flex items-center gap-1 text-[11px] text-white/80 mt-2">
                  <Timer className="w-3 h-3" /> {formatTime(totalMinutes)} total
                </p>
              </div>

              {/* Cards */}
              <div className="p-3 space-y-2.5 overflow-y-auto max-h-[65vh] flex-1">
                {columnLogs.length === 0 ? (
                  <div className="flex flex-col items-center justify-center text-center py-8 rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-800 text-xs text-slate-400 dark:text-slate-500">
                    <Inbox className="w-5 h-5 mb-1.5 opacity-60" />
                    No support logs yet
                  </div>
                ) : (
                  columnLogs.map((log) => (
                    <div
                      key={log.id}
                      className="group rounded-xl p-3.5 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md hover:border-slate-300 dark:hover:border-slate-700 transition"
                    >
                      {/* Header */}
                      <div className="flex justify-between items-start gap-2 mb-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-[11px] font-bold text-white shrink-0">
                            {log.supportedDeveloperName.charAt(0)}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{log.supportedDeveloperName}</p>
                            <p className="flex items-center gap-1 text-[10px] text-slate-500 dark:text-slate-400 truncate">
                              by {log.supportEngineerName} <ArrowRight className="w-2.5 h-2.5" />
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() => onDelete(log.id)}
                          title="Delete log"
                          className="p-1 rounded-lg text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-500/10 sm:opacity-0 sm:group-hover:opacity-100 transition shrink-0"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Issue */}
                      <p className="text-xs text-slate-600 dark:text-slate-400 mb-3 line-clamp-3">
                        {log.issueDescription}
                      </p>

                      {/* Resolution */}
                      {log.resolution && (
                        <div className="flex items-start gap-1.5 px-2 py-1.5 mb-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-px" />
                          <p className="text-[11px] text-emerald-700 dark:text-emerald-300 line-clamp-3">{log.resolution}</p>
                        </div>
                      )}

                      {/* Media */}
                      {log.media && log.media.length > 0 && (
                        <div className="mb-3">
                          <SupportMediaDisplay media={log.media} />
                        </div>
                      )}

                      {/* Footer */}
                      <div className="flex justify-between items-center gap-2 pt-2.5 border-t border-slate-100 dark:border-slate-800 text-[11px]">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold">
                          <Timer className="w-3 h-3" /> {formatTime(log.timeSpentMinutes)}
                        </span>
                        <div className="flex items-center gap-1.5">
                          {log.wasAssigned && (
                            <UserCheck className="w-3.5 h-3.5 text-amber-500" aria-label="Manager assigned" />
                          )}
                          <span className="inline-flex items-center gap-1 text-slate-500 dark:text-slate-400">
                            <Clock className="w-3 h-3" /> {formatISTTime(log.supportedAt)}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};