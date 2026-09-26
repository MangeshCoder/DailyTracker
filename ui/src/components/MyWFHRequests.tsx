import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Home, Sun, Calendar, UserCheck, MessageSquare, Ban } from 'lucide-react';
import Swal from 'sweetalert2';
import { wfhApi } from '../services/api';
import type { WFHRequest } from '../types';
import { StatusBadge, FilterBar, Card } from './ui';

export const MyWFHRequests: React.FC = () => {
  const qc = useQueryClient();
  const [filter, setFilter] = useState('All');
  const [search, setSearch] = useState('');

  const { data: rawRequests, isLoading } = useQuery({
    queryKey: ['myWFHRequests'],
    queryFn: async () => {
      try {
        const res = await wfhApi.getMy();
        return res;
      } catch (err) {
        console.warn('Could not load user WFH requests', err);
        return [];
      }
    },
  });

  const requests: WFHRequest[] = useMemo(() => {
    if (!rawRequests) return [];
    if (Array.isArray(rawRequests)) return rawRequests;
    if (Array.isArray((rawRequests as any)?.data)) return (rawRequests as any).data;
    if (Array.isArray((rawRequests as any)?.requests)) return (rawRequests as any).requests;
    return [];
  }, [rawRequests]);

  const cancelMutation = useMutation({
    mutationFn: (id: number) => wfhApi.cancel(id),
    onSuccess: (_, id) => {
      qc.setQueryData<WFHRequest[]>(['myWFHRequests'], (old) =>
        Array.isArray(old)
          ? old.map((r) => (r.id === id ? { ...r, status: 'Cancelled' } : r))
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
        showConfirmButton: false,
      });
    },
    onError: (err: any) => {
      Swal.fire({
        title: 'Cancellation Failed',
        text: err.response?.data?.message || 'Failed to cancel request',
        icon: 'error',
        background: 'rgb(15, 23, 42)',
        color: '#ffffff',
        confirmButtonColor: '#3b82f6',
      });
    },
  });

  const filteredRequests = useMemo(() => {
    return requests.filter((req) => {
      if (!req) return false;
      if (filter !== 'All' && req.status !== filter) return false;
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      const reasonStr = (req.reason || '').toLowerCase();
      const typeStr = (req.requestType || 'WFH').toLowerCase();
      const reviewerStr = (req.reviewedByName || '').toLowerCase();
      return reasonStr.includes(q) || typeStr.includes(q) || reviewerStr.includes(q);
    });
  }, [requests, filter, search]);

  const filterOptions = [
    { key: 'All', label: 'All Requests', count: requests.length },
    { key: 'Pending', label: 'Pending', count: requests.filter((r) => r?.status === 'Pending').length },
    { key: 'Approved', label: 'Approved', count: requests.filter((r) => r?.status === 'Approved').length },
    { key: 'Rejected', label: 'Rejected', count: requests.filter((r) => r?.status === 'Rejected').length },
  ];

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[...Array(3)].map((_, i) => (
          <div
            key={i}
            className="h-28 bg-slate-100 dark:bg-slate-800/60 rounded-2xl animate-pulse"
          />
        ))}
      </div>
    );
  }

  if (requests.length === 0) {
    return (
      <div className="text-center py-16 px-4 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/40">
        <div className="w-14 h-14 rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400 mx-auto flex items-center justify-center mb-3">
          <Calendar className="w-7 h-7" />
        </div>
        <h3 className="text-base font-bold text-slate-900 dark:text-white">No requests found</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
          You haven't submitted any WFH or Half Day requests yet. Switch to the New Request tab to get started.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <FilterBar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search requests by reason or approver..."
        filters={filterOptions}
        activeFilter={filter}
        onFilterChange={setFilter}
      />

      {filteredRequests.length === 0 ? (
        <div className="text-center py-12 px-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">No requests match this filter</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Try selecting another filter pill above.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredRequests.map((req) => {
            if (!req) return null;
            const isPending = req.status === 'Pending';
            const isHalfDay = req.requestType === 'HalfDay' || !!(req as any).halfDaySlot;

            const dateLabel = req.requestDate
              ? new Date(req.requestDate).toLocaleDateString('en-US', {
                  weekday: 'long',
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })
              : 'Date not specified';

            return (
              <Card
                key={req.id}
                className="overflow-hidden hover:border-slate-300 dark:hover:border-slate-700 transition"
              >
                <div className="p-5">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                    <div className="flex items-start gap-3.5 min-w-0">
                      <div
                        className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${
                          !isHalfDay
                            ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20'
                            : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                        }`}
                      >
                        {!isHalfDay ? (
                          <Home className="w-5 h-5" />
                        ) : (
                          <Sun className="w-5 h-5" />
                        )}
                      </div>

                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                            {!isHalfDay
                              ? 'Work From Home'
                              : `Half Day (${req.halfDaySlot || 'Shift'})`}
                          </h4>
                          <StatusBadge status={req.status || 'Pending'} size="xs" />
                        </div>

                        <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5 font-medium">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          <span>{dateLabel}</span>
                        </p>
                      </div>
                    </div>

                    {isPending && (
                      <button
                        type="button"
                        onClick={async () => {
                          const result = await Swal.fire({
                            title: 'Cancel Request?',
                            text: 'Are you sure you want to cancel this pending attendance request?',
                            icon: 'warning',
                            background: 'rgb(15, 23, 42)',
                            color: '#ffffff',
                            iconColor: '#ef4444',
                            showCancelButton: true,
                            confirmButtonColor: '#ef4444',
                            cancelButtonColor: '#94a3b8',
                            confirmButtonText: 'Yes, cancel it',
                            cancelButtonText: 'Keep request',
                          });

                          if (!result.isConfirmed) return;
                          cancelMutation.mutate(req.id);
                        }}
                        disabled={cancelMutation.isPending}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-rose-600 dark:text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 transition self-start sm:self-auto"
                      >
                        <Ban className="w-3.5 h-3.5" />
                        <span>Cancel Request</span>
                      </button>
                    )}
                  </div>

                  {req.reason && (
                    <div className="mt-3.5 pt-3.5 border-t border-slate-100 dark:border-slate-800/80">
                      <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                        {req.reason}
                      </p>
                    </div>
                  )}

                  {req.reviewedByName && (
                    <div className="mt-3.5 pt-3.5 border-t border-slate-100 dark:border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                        <UserCheck className="w-3.5 h-3.5 text-emerald-500" />
                        <span>
                          Reviewed by{' '}
                          <strong className="text-slate-800 dark:text-slate-200">
                            {req.reviewedByName}
                          </strong>
                          {req.reviewedAt && (
                            <>
                              {' '}
                              on{' '}
                              {new Date(req.reviewedAt).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                              })}
                            </>
                          )}
                        </span>
                      </div>

                      {req.reviewNote && (
                        <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400 italic bg-slate-50 dark:bg-slate-800/50 px-2.5 py-1 rounded-lg">
                          <MessageSquare className="w-3 h-3 text-slate-400" />
                          <span>"{req.reviewNote}"</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};