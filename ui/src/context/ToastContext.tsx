import { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import { User } from '../types';

// ═══════════════════════════════════════════════════════════════════════════════
//  Feature 15: Toast Context – global toast notifications
// ═══════════════════════════════════════════════════════════════════════════════
export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
}

interface ToastContextType {
  toasts: Toast[];
  toast: {
    success: (msg: string, duration?: number) => void;
    error: (msg: string, duration?: number) => void;
    warning: (msg: string, duration?: number) => void;
    info: (msg: string, duration?: number) => void;
  };
  dismiss: (id: string) => void;
}

const ToastContext = createContext<ToastContextType>({} as ToastContextType);

export const ToastProvider = ({ children }: { children: ReactNode }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((message: string, type: ToastType, duration = 4000) => {
    const id = `toast-${Date.now()}-${Math.random()}`;
    setToasts(prev => [...prev, { id, message, type, duration }]);
    if (duration > 0) setTimeout(() => dismiss(id), duration);
  }, []);

  const dismiss = useCallback((id: string) =>
    setToasts(prev => prev.filter(t => t.id !== id)), []);

  const toast = {
    success: (msg: string, d?: number) => addToast(msg, 'success', d),
    error: (msg: string, d?: number) => addToast(msg, 'error', d),
    warning: (msg: string, d?: number) => addToast(msg, 'warning', d),
    info: (msg: string, d?: number) => addToast(msg, 'info', d),
  };

  return (
    <ToastContext.Provider value={{ toasts, toast, dismiss }}>
      {children}
    </ToastContext.Provider>
  );
};

export const useToast = () => useContext(ToastContext);