// ─────────────────────────────────────────────────────────────────────────────
//  FILE: ui/src/components/ToastContainer.tsx
//  App toasts (useToast) — light/dark upgrade
//  Fix: text was near-white on a pale tint, unreadable in light mode.
// ─────────────────────────────────────────────────────────────────────────────

import { useToast } from '../context/ToastContext';
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from 'lucide-react';

const STYLES: Record<string, { icon: React.ElementType; accent: string; iconCls: string }> = {
  success: { icon: CheckCircle2,  accent: 'border-l-emerald-500', iconCls: 'text-emerald-500' },
  error:   { icon: XCircle,       accent: 'border-l-rose-500',    iconCls: 'text-rose-500' },
  warning: { icon: AlertTriangle, accent: 'border-l-amber-500',   iconCls: 'text-amber-500' },
  info:    { icon: Info,          accent: 'border-l-blue-500',    iconCls: 'text-blue-500' },
};

export const ToastContainer = () => {
  const { toasts, dismiss } = useToast();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-20 md:bottom-6 right-4 sm:right-6 z-[9999] flex flex-col gap-2 max-w-sm w-[calc(100%-2rem)] sm:w-full">
      {toasts.map(t => {
        const s = STYLES[t.type] ?? STYLES.info;
        const Icon = s.icon;
        return (
          <div
            key={t.id}
            role="status"
            className={`flex items-start gap-3 px-4 py-3 rounded-xl border border-l-4 shadow-xl backdrop-blur-md animate-slide-in-right
              bg-white/95 dark:bg-slate-900/95 border-slate-200 dark:border-slate-700 ${s.accent}`}
          >
            <Icon className={`w-5 h-5 shrink-0 mt-px ${s.iconCls}`} />
            <p className="text-sm font-medium flex-1 leading-snug text-slate-800 dark:text-slate-100">{t.message}</p>
            <button
              onClick={() => dismiss(t.id)}
              aria-label="Dismiss"
              className="p-0.5 rounded text-slate-400 hover:text-slate-700 dark:hover:text-white transition shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
};
