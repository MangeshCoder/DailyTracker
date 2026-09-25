import React from 'react';

export type StatusType =
  | 'Approved'
  | 'Completed'
  | 'Present'
  | 'Active'
  | 'Success'
  | 'Reviewed'
  | 'Pending'
  | 'InProgress'
  | 'In Progress'
  | 'OnHold'
  | 'On Hold'
  | 'HalfDay'
  | 'Half Day'
  | 'Rejected'
  | 'Blocked'
  | 'Absent'
  | 'Cancelled'
  | 'High'
  | 'Critical'
  | 'WFH'
  | 'Remote'
  | 'Medium'
  | 'Low'
  | 'Draft'
  | 'Archived'
  | 'Not Checked In'
  | string;

export interface StatusBadgeProps {
  status: StatusType;
  label?: string;
  size?: 'xs' | 'sm' | 'md';
  showDot?: boolean;
  className?: string;
}

interface StatusStyle {
  bg: string;
  text: string;
  border: string;
  dot: string;
  label?: string;
}

const STATUS_STYLE_MAP: Record<string, StatusStyle> = {
  approved: {
    bg: 'bg-emerald-500/10 dark:bg-emerald-500/15',
    text: 'text-emerald-700 dark:text-emerald-300 font-semibold',
    border: 'border-emerald-500/25',
    dot: 'bg-emerald-500',
  },
  completed: {
    bg: 'bg-emerald-500/10 dark:bg-emerald-500/15',
    text: 'text-emerald-700 dark:text-emerald-300 font-semibold',
    border: 'border-emerald-500/25',
    dot: 'bg-emerald-500',
  },
  present: {
    bg: 'bg-emerald-500/10 dark:bg-emerald-500/15',
    text: 'text-emerald-700 dark:text-emerald-300 font-semibold',
    border: 'border-emerald-500/25',
    dot: 'bg-emerald-500',
  },
  active: {
    bg: 'bg-emerald-500/10 dark:bg-emerald-500/15',
    text: 'text-emerald-700 dark:text-emerald-300 font-semibold',
    border: 'border-emerald-500/25',
    dot: 'bg-emerald-500',
  },
  reviewed: {
    bg: 'bg-emerald-500/10 dark:bg-emerald-500/15',
    text: 'text-emerald-700 dark:text-emerald-300 font-semibold',
    border: 'border-emerald-500/25',
    dot: 'bg-emerald-500',
  },
  inprogress: {
    bg: 'bg-blue-500/10 dark:bg-blue-500/15',
    text: 'text-blue-700 dark:text-blue-300 font-semibold',
    border: 'border-blue-500/25',
    dot: 'bg-blue-500 animate-pulse',
    label: 'In Progress',
  },
  'in progress': {
    bg: 'bg-blue-500/10 dark:bg-blue-500/15',
    text: 'text-blue-700 dark:text-blue-300 font-semibold',
    border: 'border-blue-500/25',
    dot: 'bg-blue-500 animate-pulse',
    label: 'In Progress',
  },
  pending: {
    bg: 'bg-amber-500/10 dark:bg-amber-500/15',
    text: 'text-amber-700 dark:text-amber-300 font-semibold',
    border: 'border-amber-500/25',
    dot: 'bg-amber-500',
  },
  onhold: {
    bg: 'bg-amber-500/10 dark:bg-amber-500/15',
    text: 'text-amber-700 dark:text-amber-300 font-semibold',
    border: 'border-amber-500/25',
    dot: 'bg-amber-500',
    label: 'On Hold',
  },
  halfday: {
    bg: 'bg-amber-500/10 dark:bg-amber-500/15',
    text: 'text-amber-700 dark:text-amber-300 font-semibold',
    border: 'border-amber-500/25',
    dot: 'bg-amber-500',
    label: 'Half Day',
  },
  rejected: {
    bg: 'bg-rose-500/10 dark:bg-rose-500/15',
    text: 'text-rose-700 dark:text-rose-300 font-semibold',
    border: 'border-rose-500/25',
    dot: 'bg-rose-500',
  },
  blocked: {
    bg: 'bg-rose-500/10 dark:bg-rose-500/15',
    text: 'text-rose-700 dark:text-rose-300 font-semibold',
    border: 'border-rose-500/25',
    dot: 'bg-rose-500',
  },
  absent: {
    bg: 'bg-rose-500/10 dark:bg-rose-500/15',
    text: 'text-rose-700 dark:text-rose-300 font-semibold',
    border: 'border-rose-500/25',
    dot: 'bg-rose-500',
  },
  cancelled: {
    bg: 'bg-slate-500/10 dark:bg-slate-500/15',
    text: 'text-slate-600 dark:text-slate-400 font-semibold',
    border: 'border-slate-500/20',
    dot: 'bg-slate-400',
  },
  high: {
    bg: 'bg-rose-500/10 dark:bg-rose-500/15',
    text: 'text-rose-700 dark:text-rose-300 font-semibold',
    border: 'border-rose-500/25',
    dot: 'bg-rose-500',
  },
  wfh: {
    bg: 'bg-sky-500/10 dark:bg-sky-500/15',
    text: 'text-sky-700 dark:text-sky-300 font-semibold',
    border: 'border-sky-500/25',
    dot: 'bg-sky-500',
    label: 'WFH',
  },
  medium: {
    bg: 'bg-amber-500/10 dark:bg-amber-500/15',
    text: 'text-amber-700 dark:text-amber-300 font-semibold',
    border: 'border-amber-500/25',
    dot: 'bg-amber-500',
  },
  low: {
    bg: 'bg-slate-500/10 dark:bg-slate-500/15',
    text: 'text-slate-600 dark:text-slate-400 font-medium',
    border: 'border-slate-500/20',
    dot: 'bg-slate-400',
  },
  draft: {
    bg: 'bg-slate-500/10 dark:bg-slate-500/15',
    text: 'text-slate-600 dark:text-slate-400 font-medium',
    border: 'border-slate-500/20',
    dot: 'bg-slate-400',
  },
};

const DEFAULT_STYLE: StatusStyle = {
  bg: 'bg-slate-500/10 dark:bg-slate-500/15',
  text: 'text-slate-600 dark:text-slate-400 font-medium',
  border: 'border-slate-500/20',
  dot: 'bg-slate-400',
};

const SIZE_STYLES = {
  xs: 'text-[11px] px-2 py-0.5 gap-1.5',
  sm: 'text-xs px-2.5 py-1 gap-1.5',
  md: 'text-sm px-3 py-1.5 gap-2',
};

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  label,
  size = 'sm',
  showDot = true,
  className = '',
}) => {
  const normalized = (status || '').toLowerCase().replace(/[\s_-]/g, '');
  const config = STATUS_STYLE_MAP[normalized] || STATUS_STYLE_MAP[status?.toLowerCase()] || DEFAULT_STYLE;
  const displayLabel = label || config.label || status;

  return (
    <span
      className={`inline-flex items-center rounded-full border tracking-wide transition-all ${
        SIZE_STYLES[size]
      } ${config.bg} ${config.text} ${config.border} ${className}`}
    >
      {showDot && (
        <span
          className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${config.dot}`}
          aria-hidden="true"
        />
      )}
      <span className="truncate">{displayLabel}</span>
    </span>
  );
};