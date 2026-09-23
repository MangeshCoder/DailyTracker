// ═══════════════════════════════════════════════════════════════════════════════
//  Empty State

import { ReactNode } from "react";

// ═══════════════════════════════════════════════════════════════════════════════
export const EmptyState = ({
  icon = '📭', title, message, action
}: {
  icon?: string;
  title: string;
  message: string;
  action?: ReactNode;
}) => (
  <div className="flex flex-col items-center justify-center py-16 text-center">
    <div className="text-5xl mb-4">{icon}</div>
    <h3 className="text-white font-semibold text-lg mb-2">{title}</h3>
    <p className="text-slate-500 text-sm max-w-xs mb-6">{message}</p>
    {action}
  </div>
);