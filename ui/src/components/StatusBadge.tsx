// ═══════════════════════════════════════════════════════════════════════════════
//  Status Badge (reusable)
// ═══════════════════════════════════════════════════════════════════════════════
const STATUS_COLORS: Record<string, string> = {
  Present: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  WFH: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  HalfDay: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  Absent: 'bg-red-500/20 text-red-400 border-red-500/30',
  InProgress: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  Completed: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  Blocked: 'bg-red-500/20 text-red-400 border-red-500/30',
  OnHold: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  Pending: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  Approved: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  Rejected: 'bg-red-500/20 text-red-400 border-red-500/30',
};

export const StatusBadge = ({ status, className = '' }: { status: string; className?: string }) => (
  <span className={`text-xs px-2.5 py-1 rounded-xl font-medium border
    ${STATUS_COLORS[status] ?? 'bg-slate-700 text-slate-400 border-slate-600'} ${className}`}>
    {status}
  </span>
);