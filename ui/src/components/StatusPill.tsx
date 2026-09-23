import { STATUS_CONFIG } from "../constants/statusConfig";

export const StatusPill = ({ status, size = 'sm' }: { status: string; size?: 'xs' | 'sm' }) => {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG['Not Checked In'];
  return (
    <span className={`inline-flex items-center gap-1.5 font-medium border rounded-xl
      ${size === 'xs' ? 'text-xs px-2 py-0.5' : 'text-xs px-2.5 py-1'}
      ${cfg.bg} ${cfg.border} ${cfg.color}`}>
      <span>{cfg.icon}</span>
      {cfg.label}
    </span>
  );
};