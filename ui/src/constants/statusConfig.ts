// Shared attendance / request status styles (used by StatusPill).
// Each entry carries light + dark Tailwind classes.
export const STATUS_CONFIG: Record<string, { color: string; bg: string; border: string; icon: string; label: string }> = {
  'Present':        { color: 'text-emerald-700 dark:text-emerald-400', bg: 'bg-emerald-500/10',                 border: 'border-emerald-500/30',                 icon: '🏢', label: 'Present' },
  'WFH':            { color: 'text-blue-700 dark:text-blue-400',       bg: 'bg-blue-500/10',                    border: 'border-blue-500/30',                    icon: '🏠', label: 'Work From Home' },
  'HalfDay':        { color: 'text-amber-700 dark:text-amber-400',     bg: 'bg-amber-500/10',                   border: 'border-amber-500/30',                   icon: '🌗', label: 'Half Day' },
  'Not Checked In': { color: 'text-slate-600 dark:text-slate-400',     bg: 'bg-slate-100 dark:bg-slate-800/50', border: 'border-slate-200 dark:border-slate-700', icon: '⏳', label: 'Not Checked In' },
  'Absent':         { color: 'text-rose-700 dark:text-rose-400',       bg: 'bg-rose-500/10',                    border: 'border-rose-500/30',                    icon: '❌', label: 'Absent' },
  'Pending':        { color: 'text-amber-700 dark:text-amber-400',     bg: 'bg-amber-500/10',                   border: 'border-amber-500/30',                   icon: '⏳', label: 'Pending' },
  'Approved':       { color: 'text-emerald-700 dark:text-emerald-400', bg: 'bg-emerald-500/10',                 border: 'border-emerald-500/30',                 icon: '✅', label: 'Approved' },
  'Rejected':       { color: 'text-rose-700 dark:text-rose-400',       bg: 'bg-rose-500/10',                    border: 'border-rose-500/30',                    icon: '❌', label: 'Rejected' },
  'Cancelled':      { color: 'text-slate-500 dark:text-slate-400',     bg: 'bg-slate-100 dark:bg-slate-800',    border: 'border-slate-200 dark:border-slate-700', icon: '🚫', label: 'Cancelled' },
};
