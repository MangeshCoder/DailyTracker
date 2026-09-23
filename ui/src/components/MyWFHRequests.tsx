import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { wfhApi } from '../services/api'; 
import { WFHRequest } from '../types'; 
import { StatusPill } from './StatusPill';
import { useState } from 'react';
import Swal from 'sweetalert2';

export const MyWFHRequests = () => {
  const qc = useQueryClient();
  const { data: requests = [], isLoading } = useQuery<WFHRequest[]>({
    queryKey: ['myWFHRequests'],
    queryFn: () => wfhApi.getMy(),
  });

const cancelMutation = useMutation({
  mutationFn: (id: number) => wfhApi.cancel(id),

  onSuccess: (_, id) => {
    // Update correct query key
    qc.setQueryData<WFHRequest[]>(['myWFHRequests'], (old) =>
      old
        ? old.map(r =>
            r.id === id ? { ...r, status: 'Cancelled' } : r
          )
        : []
    );

    Swal.fire({
      title: 'Cancelled',
      text: 'Your request has been cancelled.',
      icon: 'success',
      background: 'rgb(15, 23, 42)',
      color: '#ffffff',
      iconColor: '#3b82f6',
      timer: 2000,
      showConfirmButton: false
    });
  },

  onError: (err: any) => {
    Swal.fire({
      title: 'Cancellation Failed',
      text: err.response?.data?.message || 'Failed to cancel request',
      icon: 'error',
      background: 'rgb(15, 23, 42)',
      color: '#ffffff',
      confirmButtonColor: '#3b82f6'
    });
  }
});

  if (isLoading) return (
    <div className="space-y-3">
      {[...Array(3)].map((_, i) => <div key={i} className="h-20 bg-slate-800 rounded-2xl animate-pulse" />)}
    </div>
  );

  if (requests.length === 0) return (
    <div className="text-center py-12 bg-slate-900 border border-dashed border-slate-700 rounded-2xl">
      <div className="text-4xl mb-3">📋</div>
      <p className="text-white font-medium">No requests yet</p>
      <p className="text-slate-500 text-sm mt-1">Submit a WFH or Half Day request above</p>
    </div>
  );

  return (
    <div className="space-y-3">
      {requests.map(req => (
        <div key={req.id}
          className="bg-slate-900 border border-slate-800 rounded-2xl p-4 hover:border-slate-700 transition">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0 ${
                req.requestType === 'WFH' ? 'bg-blue-500/10' : 'bg-amber-500/10'
              }`}>
                {req.requestType === 'WFH' ? '🏠' : '🌗'}
              </div>
              <div>
                <p className="text-white text-sm font-semibold">
                  {req.requestType === 'WFH' ? 'Work From Home' : `Half Day${req.halfDaySlot ? ` · ${req.halfDaySlot}` : ''}`}
                </p>
                <p className="text-slate-400 text-xs mt-0.5">
                  📅 {new Date(req.requestDate).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                </p>
              </div>
            </div>
            <StatusPill status={req.status} />
          </div>

          {/* Reason */}
          <p className="text-slate-500 text-xs mt-3 pl-13">{req.reason}</p>

          {/* Review info */}
          {req.reviewedByName && (
            <div className="mt-3 pt-3 border-t border-slate-800 flex items-center justify-between">
              <p className="text-xs text-slate-500">
                Reviewed by <span className="text-slate-300">{req.reviewedByName}</span>
                {req.reviewedAt && ` · ${new Date(req.reviewedAt).toLocaleDateString()}`}
              </p>
              {req.reviewNote && (
                <p className="text-xs text-slate-400 italic">"{req.reviewNote}"</p>
              )}
            </div>
          )}

          {/* Cancel button for pending */}
          {req.status === 'Pending' && (
            <div className="mt-3 flex justify-end">
              <button
                onClick={async () => {
                  const result = await Swal.fire({
                    title: 'Cancel Request?',
                    text: 'Are you sure you want to cancel this request?',
                    icon: 'warning',
                    background: 'rgb(15, 23, 42)',
                    color: '#ffffff',
                    iconColor: '#ef4444',
                    showCancelButton: true,
                    confirmButtonColor: '#ef4444',
                    cancelButtonColor: '#94a3b8',
                    confirmButtonText: 'Yes, cancel it',
                    cancelButtonText: 'Keep request'
                  });

                  if (!result.isConfirmed) return;

                  cancelMutation.mutate(req.id);
                }}
                disabled={cancelMutation.isPending}
                className="text-xs text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 px-3 py-1.5 rounded-lg transition"
              >
                Cancel Request
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
};