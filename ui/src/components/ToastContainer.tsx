import { useEffect, useState, ReactNode } from 'react';
import { useToast } from '../context/ToastContext';

// ═══════════════════════════════════════════════════════════════════════════════
//  Feature 15: Toast Notification UI
// ═══════════════════════════════════════════════════════════════════════════════
export const ToastContainer = () => {
  const { toasts, dismiss } = useToast();

  const icons: Record<string, string> = {
    success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️'
  };

  const colors: Record<string, string> = {
    success: 'border-l-4 border-emerald-500 bg-emerald-500/10 text-emerald-100',
    error: 'border-l-4 border-red-500 bg-red-500/10 text-red-100',
    warning: 'border-l-4 border-amber-500 bg-amber-500/10 text-amber-100',
    info: 'border-l-4 border-blue-500 bg-blue-500/10 text-blue-100',
  };

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-2 max-w-sm w-full">
      {toasts.map(t => (
        <div
          key={t.id}
          className={`flex items-start gap-3 px-4 py-3 rounded-xl backdrop-blur-md shadow-2xl
            border border-white/10 animate-slide-in-right ${colors[t.type]}`}
        >
          <span className="text-base flex-shrink-0 mt-0.5">{icons[t.type]}</span>
          <p className="text-sm font-medium flex-1 leading-snug">{t.message}</p>
          <button onClick={() => dismiss(t.id)}
            className="text-white/40 hover:text-white/80 transition text-lg leading-none">×</button>
        </div>
      ))}
    </div>
  );
};