// ─────────────────────────────────────────────────────────────────────────────
//  FILE: ui/src/components/NotificationBell.tsx
//  Notification bell + dropdown used in Layout (SignalR toasts,
//  mark read, mark all read, open full inbox)
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notifApi } from '../services/api';
import type { AppNotification } from '../types';
import { useToast } from '../context/ToastContext';
import { useSignalR } from '../context/SignalRContext';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Bell,
  CheckCircle2,
  AlertTriangle,
  Info,
  BellRing,
  Inbox,
  ArrowRight,
  CheckCheck,
  PartyPopper,
} from 'lucide-react';

// ═══════════════════════════════════════════════════════════════════════════════
//  Notification Bell with dropdown
// ═══════════════════════════════════════════════════════════════════════════════

const NOTIF_ICON: Record<string, { icon: React.ElementType; cls: string }> = {
  Success:  { icon: CheckCircle2,  cls: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' },
  Warning:  { icon: AlertTriangle, cls: 'bg-amber-500/10 text-amber-600 dark:text-amber-400' },
  Info:     { icon: Info,          cls: 'bg-blue-500/10 text-blue-600 dark:text-blue-400' },
  Reminder: { icon: BellRing,      cls: 'bg-violet-500/10 text-violet-600 dark:text-violet-400' },
};

export const NotificationBell = () => {
  const [open, setOpen] = useState(false);
  const { onEvent } = useSignalR();
  const { toast } = useToast();
  const qc = useQueryClient();
  const popupRef = useRef<HTMLDivElement>(null);
  const location = useLocation();
  const navigate = useNavigate();

  const { data: countData } = useQuery({
    queryKey: ['notifCount'],
    queryFn: () => notifApi.getCount().then(r => r.data.count as number),
    refetchInterval: 30_000
  });

  const { data: notifications } = useQuery<AppNotification[]>({
    queryKey: ['notifications'],
    queryFn: () => notifApi.getAll().then(r => r.data),
    enabled: open,
  });

  const markRead = useMutation({
    mutationFn: (id: number) => notifApi.markRead(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifCount'] });
      qc.invalidateQueries({ queryKey: ['notifications'] });
    }
  });

  const markAll = useMutation({
    mutationFn: () => notifApi.markAllRead(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifCount'] });
      qc.invalidateQueries({ queryKey: ['notifications'] });
    }
  });

  // Listen for real-time notifications
  useEffect(() => {
    const off = onEvent('ReceiveNotification', (data: unknown) => {
      const n = data as { title: string; message: string; type: string };
      if (n.type === 'Success') toast.success(`${n.title}: ${n.message}`);
      else if (n.type === 'Warning') toast.warning(`${n.title}: ${n.message}`);
      else toast.info(`${n.title}: ${n.message}`);

      qc.invalidateQueries({ queryKey: ['notifCount'] });
      qc.invalidateQueries({ queryKey: ['notifications'] });
    });
    return () => off();
  }, [onEvent, toast, qc]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  useEffect(() => {
    setOpen(false);
  }, [location]);

  return (
    <div ref={popupRef} className="relative">
      <button
        onClick={() => setOpen(!open)}
        aria-label="Notifications"
        className={`relative p-2 rounded-xl transition ${
          open
            ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
            : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
        }`}
      >
        <Bell className="w-5 h-5" />
        {!!countData && countData > 0 && (
          <span className="absolute top-0.5 right-0.5 min-w-[16px] h-4 px-1 bg-rose-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center ring-2 ring-white dark:ring-slate-900">
            {countData > 9 ? '9+' : countData}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed left-4 sm:left-10 top-4 w-[calc(100vw-2rem)] sm:w-96 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl z-[9999] overflow-hidden">
          <div className="flex items-center justify-between px-4 pt-4 pb-3">
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">Notifications</h4>
              {!!countData && countData > 0 && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400">
                  {countData} new
                </span>
              )}
            </div>
            <button
              onClick={() => markAll.mutate()}
              className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-500 transition"
            >
              <CheckCheck className="w-3.5 h-3.5" /> Mark all read
            </button>
          </div>

          <button
            onClick={() => { setOpen(false); navigate('/notifications'); }}
            className="w-full flex items-center justify-between px-4 py-2.5 border-y border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors text-xs font-semibold"
          >
            <span className="inline-flex items-center gap-1.5"><Inbox className="w-3.5 h-3.5" /> Open full inbox</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>

          <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/80">
            {notifications?.length === 0 ? (
              <div className="text-center py-10">
                <PartyPopper className="w-8 h-8 mx-auto text-emerald-500" />
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 mt-2">All caught up!</p>
              </div>
            ) : (
              notifications?.map(n => {
                const meta = NOTIF_ICON[n.type] ?? NOTIF_ICON.Info;
                const Icon = meta.icon;
                return (
                  <div
                    key={n.id}
                    onClick={() => { if (!n.isRead) markRead.mutate(n.id); }}
                    className={`flex gap-3 px-4 py-3 cursor-pointer transition ${
                      n.isRead
                        ? 'opacity-60 hover:bg-slate-50 dark:hover:bg-slate-800/40'
                        : 'bg-blue-50/60 dark:bg-blue-500/5 hover:bg-blue-50 dark:hover:bg-blue-500/10'
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${meta.cls}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-900 dark:text-white">{n.title}</p>
                      <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5 line-clamp-2">{n.message}</p>
                      <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">
                        {new Date(n.createdAt).toLocaleTimeString()}
                      </p>
                    </div>
                    {!n.isRead && <div className="w-2 h-2 bg-blue-500 rounded-full mt-1.5 flex-shrink-0" />}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};
