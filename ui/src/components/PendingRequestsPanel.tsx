import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { wfhApi } from '../services/api';
import { WFHRequest } from '../types';
import { useState } from 'react';
import Swal from 'sweetalert2';

export const PendingRequestsPanel = () => {
  const qc = useQueryClient();
  const [noteMap, setNoteMap] = useState<Record<number, string>>({});
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const { data: pending = [], isLoading } = useQuery<WFHRequest[]>({
    queryKey: ['pendingWFH'],
    queryFn: () => wfhApi.getPending(),
    refetchInterval: 30000,
  });

  // ================= APPROVE =================
  const approveMutation = useMutation({
    mutationFn: ({ id, note }: { id: number; note?: string }) =>
      wfhApi.approve(id, note),

    onSuccess: (data, variables) => {
      // Remove instantly from UI
      qc.setQueryData<WFHRequest[]>(['pendingWFH'], (old) =>
        old ? old.filter(r => r.id !== variables.id) : []
      );

      qc.invalidateQueries({ queryKey: ['teamStatus'] });

      Swal.fire({
        title: 'Approved!',
        text: data.message,
        icon: 'success',
        background: 'rgb(15, 23, 42)',
        color: '#ffffff',
        iconColor: '#10b981',
        timer: 2000,
        showConfirmButton: false
      });

      setExpandedId(null);
      setNoteMap({});
    },

    onError: (err: any) => {
      Swal.fire({
        title: 'Approval Failed',
        text: err.response?.data?.message || 'Failed to approve',
        icon: 'error',
        background: 'rgb(15, 23, 42)',
        color: '#ffffff',
        confirmButtonColor: '#3b82f6'
      });
    }
  });

  // ================= REJECT =================
  const rejectMutation = useMutation({
    mutationFn: ({ id, note }: { id: number; note?: string }) =>
      wfhApi.reject(id, note),

    onSuccess: (_, variables) => {
      qc.setQueryData<WFHRequest[]>(['pendingWFH'], (old) =>
        old ? old.filter(r => r.id !== variables.id) : []
      );

      qc.invalidateQueries({ queryKey: ['teamStatus'] });

      Swal.fire({
        title: 'Rejected',
        text: 'The request has been rejected.',
        icon: 'success',
        background: 'rgb(15, 23, 42)',
        color: '#ffffff',
        iconColor: '#ef4444',
        timer: 2000,
        showConfirmButton: false
      });

      setExpandedId(null);
      setNoteMap({});
    },

    onError: (err: any) => {
      Swal.fire({
        title: 'Rejection Failed',
        text: err.response?.data?.message || 'Failed to reject',
        icon: 'error',
        background: 'rgb(15, 23, 42)',
        color: '#ffffff',
        confirmButtonColor: '#3b82f6'
      });
    }
  });

  if (isLoading)
    return <div className="h-32 bg-slate-800 rounded-2xl animate-pulse" />;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-sm">
            ⏳
          </div>
          <p className="font-semibold text-white text-sm">Pending Requests</p>
        </div>

        {pending.length > 0 && (
          <span className="text-xs font-bold text-amber-400 bg-amber-500/10 border border-amber-500/30 px-2.5 py-1 rounded-xl">
            {pending.length} pending
          </span>
        )}
      </div>

      {/* Empty State */}
      {pending.length === 0 ? (
        <div className="py-10 text-center text-slate-500 text-sm">
          <p className="text-3xl mb-2">✅</p>
          No pending requests from your team
        </div>
      ) : (
        <div className="divide-y divide-slate-800/60">
          {pending.map(req => (
            <div key={req.id} className="p-4">
              {/* Request Info */}
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-sm font-bold text-slate-300">
                  {req.employeeName.charAt(0)}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-white text-sm font-semibold">
                      {req.employeeName}
                    </p>

                    <span className={`text-xs px-2 py-0.5 rounded-lg font-medium border ${
                      req.requestType === 'WFH'
                        ? 'bg-blue-500/10 border-blue-500/30 text-blue-400'
                        : 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                    }`}>
                      {req.requestType === 'WFH'
                        ? '🏠 WFH'
                        : `🌗 Half Day${req.halfDaySlot ? ` · ${req.halfDaySlot}` : ''}`}
                    </span>
                  </div>

                  <p className="text-slate-400 text-xs mt-1">
                    📅 {new Date(req.requestDate).toLocaleDateString()}
                  </p>

                  <p className="text-slate-500 text-xs mt-1 italic">
                    "{req.reason}"
                  </p>
                </div>

                <button
                  onClick={() =>
                    setExpandedId(expandedId === req.id ? null : req.id)
                  }
                  className="text-xs text-slate-500 hover:text-slate-300"
                >
                  {expandedId === req.id ? '▲' : '▼'}
                </button>
              </div>

              {/* Expanded Section */}
              {expandedId === req.id && (
                <div className="mt-3 space-y-3">
                  <textarea
                    value={noteMap[req.id] ?? ''}
                    onChange={e =>
                      setNoteMap(m => ({
                        ...m,
                        [req.id]: e.target.value
                      }))
                    }
                    placeholder="Optional note for the employee..."
                    rows={2}
                    className="w-full bg-slate-800 border border-slate-700 text-white text-xs rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  />

                  <div className="flex gap-2">
                    <button
                      onClick={async () => {
                        const result = await Swal.fire({
                          title: 'Approve Request?',
                          text: 'This employee will be marked as approved.',
                          icon: 'question',
                          background: 'rgb(15, 23, 42)',
                          color: '#ffffff',
                          iconColor: '#10b981',
                          showCancelButton: true,
                          confirmButtonColor: '#10b981',
                          cancelButtonColor: '#94a3b8',
                          confirmButtonText: 'Yes, approve',
                          cancelButtonText: 'Cancel'
                        });

                        if (!result.isConfirmed) return;

                        approveMutation.mutate({
                          id: req.id,
                          note: noteMap[req.id]
                        });
                      }}
                      disabled={approveMutation.isPending}
                      className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold rounded-xl transition"
                    >
                      ✅ Approve
                    </button>

                    <button
                      onClick={async () => {
                        const result = await Swal.fire({
                          title: 'Reject Request?',
                          text: noteMap[req.id]?.trim()
                            ? 'Are you sure you want to reject this request?'
                            : 'Reject without a note?',
                          icon: 'warning',
                          background: 'rgb(15, 23, 42)',
                          color: '#ffffff',
                          iconColor: '#ef4444',
                          showCancelButton: true,
                          confirmButtonColor: '#ef4444',
                          cancelButtonColor: '#94a3b8',
                          confirmButtonText: 'Yes, reject',
                          cancelButtonText: 'Cancel'
                        });

                        if (!result.isConfirmed) return;

                        rejectMutation.mutate({
                          id: req.id,
                          note: noteMap[req.id]
                        });
                      }}
                      disabled={rejectMutation.isPending}
                      className="flex-1 py-2.5 bg-red-600/20 hover:bg-red-600/40 border border-red-500/30 text-red-400 text-sm font-semibold rounded-xl transition"
                    >
                      ❌ Reject
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};