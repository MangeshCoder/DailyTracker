import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { wfhApi } from '../services/api';
import { WFHRequest } from '../types';
import { Card, CardHeader, CardTitle, CardContent } from './ui/Card';
import { StatusBadge } from './ui/StatusBadge';
import {
  Clock,
  Home,
  SunMedium,
  CheckCircle2,
  XCircle,
  Calendar,
  MessageSquare,
  Search,
  Filter,
  Check,
  X,
  AlertCircle,
  User,
  Sparkles
} from 'lucide-react';
import Swal from 'sweetalert2';

const QUICK_NOTES = [
  'Approved. Please remain active and reachable during core hours.',
  'Approved. Keep the team updated on standup deliverables.',
  'Approved for specified half-day shift.',
  'Please connect with lead regarding sprint dependencies.',
];

function formatDate(iso: string) {
  if (!iso) return '--';
  const d = new Date(iso);
  return d.toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function getRelativeDateLabel(iso: string) {
  if (!iso) return '';
  const target = new Date(iso);
  const today = new Date();
  target.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);

  const diffDays = Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Tomorrow';
  if (diffDays > 1 && diffDays <= 7) return `In ${diffDays} days`;
  if (diffDays < 0) return `${Math.abs(diffDays)} days ago`;
  return '';
}

export const PendingRequestsPanel: React.FC = () => {
  const qc = useQueryClient();
  const [noteMap, setNoteMap] = useState<Record<number, string>>({});
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'WFH' | 'HalfDay'>('all');

  const { data: pending = [], isLoading } = useQuery<WFHRequest[]>({
    queryKey: ['pendingWFH'],
    queryFn: () => wfhApi.getPending(),
    refetchInterval: 30000,
  });

  // ================= APPROVE MUTATION =================
  const approveMutation = useMutation({
    mutationFn: ({ id, note }: { id: number; note?: string }) =>
      wfhApi.approve(id, note),

    onSuccess: (data, variables) => {
      // Remove instantly from UI cache
      qc.setQueryData<WFHRequest[]>(['pendingWFH'], (old) =>
        old ? old.filter((r) => r.id !== variables.id) : []
      );
      qc.invalidateQueries({ queryKey: ['teamStatus'] });
      qc.invalidateQueries({ queryKey: ['team-monthly'] });

      Swal.fire({
        title: 'Request Approved!',
        text: data?.message || 'The application has been officially signed off.',
        icon: 'success',
        background: 'rgb(15, 23, 42)',
        color: '#ffffff',
        iconColor: '#10b981',
        timer: 2000,
        showConfirmButton: false,
      });

      setExpandedId(null);
      setNoteMap((prev) => {
        const next = { ...prev };
        delete next[variables.id];
        return next;
      });
    },

    onError: (err: any) => {
      Swal.fire({
        title: 'Approval Failed',
        text: err.response?.data?.message || 'Failed to approve request',
        icon: 'error',
        background: 'rgb(15, 23, 42)',
        color: '#ffffff',
        confirmButtonColor: '#3b82f6',
      });
    },
  });

  // ================= REJECT MUTATION =================
  const rejectMutation = useMutation({
    mutationFn: ({ id, note }: { id: number; note?: string }) =>
      wfhApi.reject(id, note),

    onSuccess: (_, variables) => {
      qc.setQueryData<WFHRequest[]>(['pendingWFH'], (old) =>
        old ? old.filter((r) => r.id !== variables.id) : []
      );
      qc.invalidateQueries({ queryKey: ['teamStatus'] });
      qc.invalidateQueries({ queryKey: ['team-monthly'] });

      Swal.fire({
        title: 'Request Denied',
        text: 'The request has been rejected with the provided review notes.',
        icon: 'info',
        background: 'rgb(15, 23, 42)',
        color: '#ffffff',
        iconColor: '#ef4444',
        timer: 2000,
        showConfirmButton: false,
      });

      setExpandedId(null);
      setNoteMap((prev) => {
        const next = { ...prev };
        delete next[variables.id];
        return next;
      });
    },

    onError: (err: any) => {
      Swal.fire({
        title: 'Rejection Failed',
        text: err.response?.data?.message || 'Failed to reject request',
        icon: 'error',
        background: 'rgb(15, 23, 42)',
        color: '#ffffff',
        confirmButtonColor: '#3b82f6',
      });
    },
  });

  // Filtered requests
  const filteredPending = useMemo(() => {
    return pending.filter((req) => {
      if (typeFilter !== 'all' && req.requestType !== typeFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = req.employeeName?.toLowerCase().includes(q);
        const matchesReason = req.reason?.toLowerCase().includes(q);
        return matchesName || matchesReason;
      }
      return true;
    });
  }, [pending, typeFilter, searchQuery]);

  if (isLoading) {
    return (
      <Card className="border-slate-200/80 dark:border-slate-800">
        <CardContent className="p-6 space-y-4">
          <div className="h-6 bg-slate-200 dark:bg-slate-800 rounded w-44 animate-pulse" />
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-28 bg-slate-100 dark:bg-slate-800/60 rounded-2xl animate-pulse"
            />
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-slate-200/80 dark:border-slate-800 shadow-sm overflow-hidden">
      {/* ── Panel Header ── */}
      <CardHeader className="border-b border-slate-200/80 dark:border-slate-800 pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <CardTitle className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span>Pending Approval Queue</span>
                {pending.length > 0 && (
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/25 text-amber-600 dark:text-amber-400">
                    {pending.length} awaiting
                  </span>
                )}
              </CardTitle>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Review and act on submitted Work-From-Home and Half-Day shift applications.
              </p>
            </div>
          </div>

          {/* Quick Filters */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex gap-1 bg-slate-100 dark:bg-slate-900 p-1 rounded-xl border border-slate-200/80 dark:border-slate-800 text-xs">
              {(['all', 'WFH', 'HalfDay'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTypeFilter(t)}
                  className={`px-3 py-1 rounded-lg font-semibold transition cursor-pointer ${
                    typeFilter === t
                      ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {t === 'all' ? 'All' : t === 'WFH' ? '🏡 WFH' : '⛅ Half Day'}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Search input if multiple pending */}
        {pending.length > 3 && (
          <div className="relative mt-3">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search pending by member name or reason..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white text-xs rounded-xl pl-9 pr-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        )}
      </CardHeader>

      {/* ── Content ── */}
      <CardContent className="p-4 sm:p-5">
        {filteredPending.length === 0 ? (
          <div className="text-center py-16 text-slate-400 space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-500 mx-auto flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              {pending.length === 0 ? 'All Caught Up!' : 'No Matching Requests'}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
              {pending.length === 0
                ? 'There are no pending WFH or Half-Day passes awaiting supervisor approval.'
                : 'Try adjusting your search criteria or clearing active filters.'}
            </p>
          </div>
        ) : (
          <div className="space-y-3.5">
            {filteredPending.map((req) => {
              const isExpanded = expandedId === req.id;
              const isWFH = req.requestType === 'WFH';
              const relativeLabel = getRelativeDateLabel(req.requestDate);

              return (
                <div
                  key={req.id}
                  className={`border rounded-2xl p-4 sm:p-5 transition-all duration-200 bg-white dark:bg-slate-900/60 ${
                    isExpanded
                      ? 'border-blue-500/40 ring-1 ring-blue-500/10 shadow-md'
                      : 'border-slate-200/80 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700/80 shadow-sm'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                    {/* Left: Employee info & details */}
                    <div className="flex items-start gap-3.5 flex-1 min-w-0">
                      <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center text-sm font-bold shadow-sm shadow-blue-500/20 flex-shrink-0">
                        {req.employeeName.charAt(0).toUpperCase()}
                      </div>

                      <div className="space-y-1.5 flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-bold text-slate-900 dark:text-white text-sm sm:text-base truncate">
                            {req.employeeName}
                          </h4>

                          {/* Request badge */}
                          <span
                            className={`inline-flex items-center gap-1 text-xs px-2.5 py-0.5 rounded-full font-semibold border ${
                              isWFH
                                ? 'bg-blue-500/10 border-blue-500/25 text-blue-700 dark:text-blue-300'
                                : 'bg-amber-500/10 border-amber-500/25 text-amber-700 dark:text-amber-300'
                            }`}
                          >
                            <span>{isWFH ? '🏡' : '⛅'}</span>
                            <span>{isWFH ? 'Work From Home' : `Half Day (${req.halfDaySlot || 'Shift'})`}</span>
                          </span>

                          {/* Relative Date Pill */}
                          {relativeLabel && (
                            <span className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                              {relativeLabel}
                            </span>
                          )}
                        </div>

                        {/* Date details */}
                        <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-slate-400 inline" />
                          <span className="font-medium text-slate-700 dark:text-slate-300">
                            {formatDate(req.requestDate)}
                          </span>
                        </p>

                        {/* Reason bubble */}
                        {req.reason && (
                          <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-950/60 p-3 rounded-xl border border-slate-100 dark:border-slate-800/80 leading-relaxed italic">
                            "{req.reason}"
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Right: Quick action buttons */}
                    <div className="flex items-center gap-2 flex-shrink-0 self-end sm:self-center">
                      <button
                        type="button"
                        onClick={() => setExpandedId(isExpanded ? null : req.id)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition cursor-pointer flex items-center gap-1.5 ${
                          isExpanded
                            ? 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700'
                            : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200/80 dark:border-slate-800 hover:border-slate-300'
                        }`}
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        <span>{isExpanded ? 'Close Drawer' : 'Review & Remarks'}</span>
                      </button>
                    </div>
                  </div>

                  {/* ── Expandable Review / Action Drawer ── */}
                  {isExpanded && (
                    <div className="mt-4 pt-4 border-t border-slate-200/80 dark:border-slate-800 space-y-3.5 animate-in fade-in duration-200">
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                            Supervisor Feedback / Review Note (Optional)
                          </label>
                          <span className="text-[11px] text-slate-400">
                            {(noteMap[req.id] ?? '').length} / 300
                          </span>
                        </div>
                        <textarea
                          value={noteMap[req.id] ?? ''}
                          onChange={(e) =>
                            setNoteMap((m) => ({
                              ...m,
                              [req.id]: e.target.value,
                            }))
                          }
                          placeholder="Add instructions, client handover notes, or reasons for decision..."
                          rows={2}
                          maxLength={300}
                          className="w-full bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white text-xs sm:text-sm rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none transition"
                        />
                      </div>

                      {/* Quick Presets */}
                      <div>
                        <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 block mb-1">
                          Quick Note Suggestions:
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {QUICK_NOTES.map((tmpl) => (
                            <button
                              key={tmpl}
                              type="button"
                              onClick={() =>
                                setNoteMap((m) => ({
                                  ...m,
                                  [req.id]: tmpl,
                                }))
                              }
                              className="text-[11px] px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 transition cursor-pointer"
                            >
                              + {tmpl}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Decision Buttons */}
                      <div className="flex items-center gap-3 pt-2">
                        <button
                          type="button"
                          onClick={async () => {
                            const result = await Swal.fire({
                              title: 'Approve Application?',
                              text: `Approve ${req.requestType} for ${req.employeeName} on ${formatDate(req.requestDate)}?`,
                              icon: 'question',
                              background: 'rgb(15, 23, 42)',
                              color: '#ffffff',
                              iconColor: '#10b981',
                              showCancelButton: true,
                              confirmButtonColor: '#10b981',
                              cancelButtonColor: '#64748b',
                              confirmButtonText: 'Yes, Approve Request',
                              cancelButtonText: 'Cancel',
                            });

                            if (!result.isConfirmed) return;

                            approveMutation.mutate({
                              id: req.id,
                              note: noteMap[req.id]?.trim() || undefined,
                            });
                          }}
                          disabled={approveMutation.isPending}
                          className="flex-1 inline-flex items-center justify-center gap-2 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs sm:text-sm font-semibold rounded-xl transition shadow-sm shadow-emerald-500/20 cursor-pointer"
                        >
                          <Check className="w-4 h-4" />
                          <span>{approveMutation.isPending ? 'Approving...' : 'Approve Request'}</span>
                        </button>

                        <button
                          type="button"
                          onClick={async () => {
                            const hasNote = Boolean(noteMap[req.id]?.trim());
                            const result = await Swal.fire({
                              title: 'Reject Application?',
                              text: hasNote
                                ? `Reject ${req.requestType} for ${req.employeeName} with review note?`
                                : `Are you sure you want to reject this request without providing a note?`,
                              icon: 'warning',
                              background: 'rgb(15, 23, 42)',
                              color: '#ffffff',
                              iconColor: '#ef4444',
                              showCancelButton: true,
                              confirmButtonColor: '#ef4444',
                              cancelButtonColor: '#64748b',
                              confirmButtonText: 'Yes, Reject Request',
                              cancelButtonText: 'Cancel',
                            });

                            if (!result.isConfirmed) return;

                            rejectMutation.mutate({
                              id: req.id,
                              note: noteMap[req.id]?.trim() || undefined,
                            });
                          }}
                          disabled={rejectMutation.isPending}
                          className="flex-1 inline-flex items-center justify-center gap-2 py-2.5 bg-rose-600/10 hover:bg-rose-600/20 border border-rose-500/30 disabled:opacity-50 text-rose-600 dark:text-rose-400 text-xs sm:text-sm font-semibold rounded-xl transition cursor-pointer"
                        >
                          <X className="w-4 h-4" />
                          <span>{rejectMutation.isPending ? 'Rejecting...' : 'Reject Request'}</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default PendingRequestsPanel;