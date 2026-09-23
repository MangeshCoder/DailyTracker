// ─────────────────────────────────────────────────────────────────────────────
//  FILE 9:  frontend/src/pages/ResignationPage.tsx
//  ACTION:  CREATE as a new file
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { resignationApi } from '../services/api';
import { useAuth } from '../context/Authcontext';
import { useToast } from '../context/ToastContext';
import type {
  ResignationDto, ResignationSummaryDto,
  ReviewResignationDto, CompleteExitDto,
} from '../types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(iso?: string) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  Pending:   { label: 'Pending',   color: 'text-yellow-400', bg: 'bg-yellow-500/20 border-yellow-500/30' },
  Accepted:  { label: 'Accepted',  color: 'text-blue-400',   bg: 'bg-blue-500/20 border-blue-500/30'     },
  Rejected:  { label: 'Rejected',  color: 'text-red-400',    bg: 'bg-red-500/20 border-red-500/30'       },
  Completed: { label: 'Completed', color: 'text-green-400',  bg: 'bg-green-500/20 border-green-500/30'   },
};

function StatusBadge({ status }: { status: string }) {
  const m = STATUS_META[status] ?? STATUS_META.Pending;
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${m.bg} ${m.color}`}>
      {m.label}
    </span>
  );
}

// ─── Submit Resignation Form (Employee) ──────────────────────────────────────

function SubmitResignationForm({ onSuccess }: { onSuccess: () => void }) {
  const { toast }   = useToast();
  const qc          = useQueryClient();
  const [reason,    setReason]    = useState('');
  const [lastDay,   setLastDay]   = useState('');
  const [confirmed, setConfirmed] = useState(false);

  const mutation = useMutation({
    mutationFn: () => resignationApi.submit({
      reason,
      requestedLastDay: new Date(lastDay).toISOString(),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-resignation'] });
      toast.success('Resignation submitted. Your manager has been notified.');
      onSuccess();
    },
    onError: (e: any) =>
      toast.error(e?.response?.data?.message ?? 'Failed to submit resignation.'),
  });

  const inputCls = 'w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-red-500 transition-colors';

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 space-y-5 max-w-lg mx-auto">
      <div className="flex items-center gap-3">
        <span className="text-3xl">📝</span>
        <div>
          <h2 className="text-white font-semibold text-lg">Submit Resignation</h2>
          <p className="text-slate-400 text-xs mt-0.5">This will be sent to your manager for review</p>
        </div>
      </div>

      <div>
        <label className="block text-slate-400 text-xs mb-1.5 font-medium">Reason *</label>
        <textarea
          value={reason}
          onChange={e => setReason(e.target.value)}
          rows={4}
          placeholder="Please explain your reason for resignation…"
          className={`${inputCls} resize-none`}
        />
      </div>

      <div>
        <label className="block text-slate-400 text-xs mb-1.5 font-medium">Requested Last Working Day *</label>
        <input
          type="date"
          value={lastDay}
          onChange={e => setLastDay(e.target.value)}
          min={new Date(Date.now() + 86400000).toISOString().split('T')[0]}
          className={inputCls}
        />
      </div>

      {/* Confirmation checkbox */}
      <label className="flex items-start gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={confirmed}
          onChange={e => setConfirmed(e.target.checked)}
          className="mt-0.5 accent-red-500"
        />
        <span className="text-slate-400 text-sm">
          I understand that submitting this resignation will notify my manager and begin the exit process. This action cannot be undone once accepted.
        </span>
      </label>

      <button
        onClick={() => mutation.mutate()}
        disabled={mutation.isPending || !reason.trim() || !lastDay || !confirmed}
        className="w-full py-2.5 bg-red-600 hover:bg-red-500 disabled:opacity-40 text-white rounded-xl text-sm font-semibold transition-colors"
      >
        {mutation.isPending ? 'Submitting…' : 'Submit Resignation'}
      </button>
    </div>
  );
}

// ─── My Resignation Card (Employee) ──────────────────────────────────────────

function MyResignationCard({ r, onWithdraw }: { r: ResignationDto; onWithdraw: () => void }) {
  const { toast }  = useToast();
  const qc         = useQueryClient();

  const withdrawMut = useMutation({
    mutationFn: () => resignationApi.withdraw(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-resignation'] });
      toast.success('Resignation withdrawn.');
      onWithdraw();
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Failed to withdraw.'),
  });

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 max-w-lg mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-3xl">📋</span>
          <div>
            <h2 className="text-white font-semibold text-lg">Your Resignation</h2>
            <p className="text-slate-400 text-xs">Submitted {fmtDate(r.submittedAt)}</p>
          </div>
        </div>
        <StatusBadge status={r.status} />
      </div>

      <div className="space-y-3 text-sm">
        <div className="flex justify-between">
          <span className="text-slate-400">Requested Last Day</span>
          <span className="text-white font-medium">{fmtDate(r.requestedLastDay)}</span>
        </div>
        {r.noticePeriodEndDate && (
          <div className="flex justify-between">
            <span className="text-slate-400">Official Last Day</span>
            <span className="text-blue-400 font-medium">{fmtDate(r.noticePeriodEndDate)}</span>
          </div>
        )}
        {r.noticeDaysRemaining !== undefined && r.noticeDaysRemaining !== null && (
          <div className={`flex justify-between px-3 py-2 rounded-lg ${
            r.noticeDaysRemaining <= 7 ? 'bg-red-500/10 border border-red-500/20' : 'bg-blue-500/10 border border-blue-500/20'
          }`}>
            <span className="text-slate-400">Days Remaining</span>
            <span className={`font-bold ${r.noticeDaysRemaining <= 7 ? 'text-red-400' : 'text-blue-400'}`}>
              {r.noticeDaysRemaining} day{r.noticeDaysRemaining !== 1 ? 's' : ''}
            </span>
          </div>
        )}
      </div>

      <div className="border-t border-slate-700 pt-4 space-y-2">
        <p className="text-slate-400 text-xs font-medium">Your Reason</p>
        <p className="text-slate-300 text-sm bg-slate-900/60 rounded-lg px-3 py-2">{r.reason}</p>
      </div>

      {r.reviewNote && (
        <div className="border-t border-slate-700 pt-4 space-y-2">
          <p className="text-slate-400 text-xs font-medium">
            Manager Note {r.reviewedByName ? `— ${r.reviewedByName}` : ''}
          </p>
          <p className={`text-sm px-3 py-2 rounded-lg ${
            r.status === 'Rejected' ? 'bg-red-500/10 text-red-300' : 'bg-slate-900/60 text-slate-300'
          }`}>{r.reviewNote}</p>
        </div>
      )}

      {r.status === 'Pending' && (
        <button
          onClick={() => withdrawMut.mutate()}
          disabled={withdrawMut.isPending}
          className="w-full py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-xl text-sm font-medium transition-colors"
        >
          {withdrawMut.isPending ? 'Withdrawing…' : '↩ Withdraw Resignation'}
        </button>
      )}

      {r.status === 'Accepted' && r.checklistItems.length > 0 && (
        <div className="border-t border-slate-700 pt-4 space-y-3">
          <p className="text-white font-medium text-sm">Exit Checklist Progress</p>
          <div className="space-y-2">
            {r.checklistItems.map(item => (
              <div key={item.id} className="flex items-center gap-2.5 text-sm">
                <span className={item.isCompleted ? 'text-green-400' : 'text-slate-600'}>
                  {item.isCompleted ? '✅' : '⬜'}
                </span>
                <span className={item.isCompleted ? 'text-slate-400 line-through' : 'text-slate-300'}>
                  {item.task}
                </span>
              </div>
            ))}
          </div>
          <div className="bg-slate-900/60 rounded-lg px-3 py-2 text-xs text-slate-400">
            {r.checklistItems.filter(i => i.isCompleted).length} / {r.checklistItems.length} tasks completed
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Review Modal (Manager) ───────────────────────────────────────────────────

function ReviewModal({ r, onClose }: { r: ResignationDto; onClose: () => void }) {
  const { toast } = useToast();
  const qc        = useQueryClient();
  const [decision,      setDecision]      = useState<'Accepted' | 'Rejected'>('Accepted');
  const [note,          setNote]          = useState('');
  const [officialDate,  setOfficialDate]  = useState(
    r.requestedLastDay ? r.requestedLastDay.split('T')[0] : ''
  );

  const mutation = useMutation({
    mutationFn: () => {
      const payload: ReviewResignationDto = {
        decision,
        reviewNote: note.trim() || undefined,
        noticePeriodEndDate: decision === 'Accepted'
          ? new Date(officialDate).toISOString()
          : undefined,
      };
      return resignationApi.review(r.id, payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['resignations'] });
      qc.invalidateQueries({ queryKey: ['resignation-summary'] });
      toast.success(`Resignation ${decision.toLowerCase()} successfully.`);
      onClose();
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Failed to review.'),
  });

  const inputCls = 'w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500 transition-colors';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
          <h2 className="text-white font-semibold">Review Resignation — {r.employeeName}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-xl">✕</button>
        </div>

        <div className="p-6 space-y-4">
          {/* Employee reason */}
          <div className="bg-slate-800 rounded-lg p-3 text-sm text-slate-300">
            <p className="text-slate-500 text-xs mb-1">Employee's reason:</p>
            {r.reason}
          </div>

          {/* Decision */}
          <div>
            <label className="block text-slate-400 text-xs mb-2 font-medium">Decision *</label>
            <div className="flex gap-2">
              {(['Accepted', 'Rejected'] as const).map(d => (
                <button key={d} onClick={() => setDecision(d)}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors border ${
                    decision === d
                      ? d === 'Accepted'
                        ? 'bg-blue-600 border-blue-500 text-white'
                        : 'bg-red-600 border-red-500 text-white'
                      : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500'
                  }`}>
                  {d === 'Accepted' ? '✅ Accept' : '❌ Reject'}
                </button>
              ))}
            </div>
          </div>

          {/* Official last day — only when accepting */}
          {decision === 'Accepted' && (
            <div>
              <label className="block text-slate-400 text-xs mb-1.5 font-medium">Official Last Day *</label>
              <input type="date" value={officialDate}
                onChange={e => setOfficialDate(e.target.value)} className={inputCls} />
              <p className="text-slate-500 text-xs mt-1">
                Requested: {fmtDate(r.requestedLastDay)}
              </p>
            </div>
          )}

          {/* Note */}
          <div>
            <label className="block text-slate-400 text-xs mb-1.5 font-medium">
              Note {decision === 'Rejected' ? '(explain reason)' : '(optional)'}
            </label>
            <textarea value={note} onChange={e => setNote(e.target.value)} rows={3}
              placeholder="Add a note for the employee…"
              className={`${inputCls} resize-none`} />
          </div>
        </div>

        <div className="flex gap-3 px-6 py-4 border-t border-slate-700">
          <button onClick={onClose} className="flex-1 py-2 rounded-lg border border-slate-600 text-slate-300 hover:bg-slate-800 text-sm font-medium transition-colors">
            Cancel
          </button>
          <button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || (decision === 'Accepted' && !officialDate)}
            className="flex-1 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors disabled:opacity-40"
          >
            {mutation.isPending ? 'Saving…' : `Confirm ${decision}`}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Complete Exit Modal (Manager) ────────────────────────────────────────────

function CompleteExitModal({ r, onClose }: { r: ResignationDto; onClose: () => void }) {
  const { toast } = useToast();
  const qc        = useQueryClient();
  const [exitDate,   setExitDate]   = useState(
    r.noticePeriodEndDate ? r.noticePeriodEndDate.split('T')[0] : ''
  );
  const [finalNote,  setFinalNote]  = useState('');
  const unchecked = r.checklistItems.filter(i => !i.isCompleted);

  const mutation = useMutation({
    mutationFn: () => resignationApi.completeExit(r.id, {
      exitDate:  new Date(exitDate).toISOString(),
      finalNote: finalNote.trim() || undefined,
    } as CompleteExitDto),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['resignations'] });
      qc.invalidateQueries({ queryKey: ['resignation-summary'] });
      toast.success('Exit process completed. Employee account has been deactivated.');
      onClose();
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Failed to complete exit.'),
  });

  const inputCls = 'w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500 transition-colors';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
          <h2 className="text-white font-semibold">Complete Exit — {r.employeeName}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-xl">✕</button>
        </div>

        <div className="p-6 space-y-4">
          {unchecked.length > 0 && (
            <div className="bg-orange-500/10 border border-orange-500/30 rounded-xl p-3 text-sm text-orange-300">
              ⚠️ {unchecked.length} checklist item{unchecked.length !== 1 ? 's' : ''} still pending. You can still complete the exit.
            </div>
          )}

          <div>
            <label className="block text-slate-400 text-xs mb-1.5 font-medium">Final Exit Date *</label>
            <input type="date" value={exitDate}
              onChange={e => setExitDate(e.target.value)} className={inputCls} />
          </div>

          <div>
            <label className="block text-slate-400 text-xs mb-1.5 font-medium">Final Note (optional)</label>
            <textarea value={finalNote} onChange={e => setFinalNote(e.target.value)} rows={3}
              placeholder="Any farewell notes or comments…"
              className={`${inputCls} resize-none`} />
          </div>

          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 text-xs text-red-300">
            ⚠️ This will <strong>deactivate</strong> the employee's account. They will no longer be able to log in.
          </div>
        </div>

        <div className="flex gap-3 px-6 py-4 border-t border-slate-700">
          <button onClick={onClose} className="flex-1 py-2 rounded-lg border border-slate-600 text-slate-300 hover:bg-slate-800 text-sm font-medium transition-colors">
            Cancel
          </button>
          <button onClick={() => mutation.mutate()} disabled={mutation.isPending || !exitDate}
            className="flex-1 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-sm font-medium transition-colors disabled:opacity-40">
            {mutation.isPending ? 'Processing…' : '✅ Complete Exit'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Resignation Detail Card (Manager) ───────────────────────────────────────

function ResignationDetailCard({ r, onReview, onComplete }: {
  r: ResignationDto;
  onReview:   (r: ResignationDto) => void;
  onComplete: (r: ResignationDto) => void;
}) {
  const { toast } = useToast();
  const qc        = useQueryClient();
  const [newTask, setNewTask] = useState('');

  const toggleMut = useMutation({
    mutationFn: (itemId: number) => resignationApi.toggleChecklistItem(itemId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['resignations'] }),
    onError: () => toast.error('Failed to update checklist.'),
  });

  const addMut = useMutation({
    mutationFn: () => resignationApi.addChecklistItem(r.id, newTask.trim()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['resignations'] });
      setNewTask('');
    },
    onError: () => toast.error('Failed to add item.'),
  });

  const deleteMut = useMutation({
    mutationFn: (itemId: number) => resignationApi.deleteChecklistItem(itemId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['resignations'] }),
    onError: () => toast.error('Failed to delete item.'),
  });

  const completedCount = r.checklistItems.filter(i => i.isCompleted).length;
  const totalCount     = r.checklistItems.length;

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-2xl p-5 space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-white font-semibold">{r.employeeName}</p>
          <p className="text-slate-400 text-xs mt-0.5">
            {r.designation}{r.department ? ` · ${r.department}` : ''}
          </p>
        </div>
        <StatusBadge status={r.status} />
      </div>

      {/* Key dates */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="bg-slate-900/60 rounded-lg px-3 py-2">
          <p className="text-slate-500">Submitted</p>
          <p className="text-slate-300 font-medium mt-0.5">{fmtDate(r.submittedAt)}</p>
        </div>
        <div className="bg-slate-900/60 rounded-lg px-3 py-2">
          <p className="text-slate-500">Req. Last Day</p>
          <p className="text-slate-300 font-medium mt-0.5">{fmtDate(r.requestedLastDay)}</p>
        </div>
        {r.noticePeriodEndDate && (
          <div className={`rounded-lg px-3 py-2 col-span-2 ${
            (r.noticeDaysRemaining ?? 99) <= 7
              ? 'bg-red-500/10 border border-red-500/20'
              : 'bg-blue-500/10 border border-blue-500/20'
          }`}>
            <p className="text-slate-500 text-xs">Official Last Day</p>
            <div className="flex items-center justify-between mt-0.5">
              <p className="text-blue-400 font-semibold">{fmtDate(r.noticePeriodEndDate)}</p>
              {r.noticeDaysRemaining !== undefined && r.noticeDaysRemaining !== null && (
                <span className={`font-bold text-sm ${
                  r.noticeDaysRemaining <= 7 ? 'text-red-400' : 'text-blue-300'
                }`}>
                  {r.noticeDaysRemaining}d left
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Reason */}
      <div>
        <p className="text-slate-400 text-xs font-medium mb-1.5">Reason</p>
        <p className="text-slate-300 text-sm bg-slate-900/60 rounded-lg px-3 py-2 line-clamp-3">{r.reason}</p>
      </div>

      {/* Checklist (only when Accepted) */}
      {r.status === 'Accepted' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-white text-sm font-medium">Exit Checklist</p>
            <span className="text-xs text-slate-400">{completedCount}/{totalCount}</span>
          </div>

          {/* Progress bar */}
          {totalCount > 0 && (
            <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-green-500 rounded-full transition-all"
                style={{ width: `${(completedCount / totalCount) * 100}%` }}
              />
            </div>
          )}

          <div className="space-y-1.5 max-h-48 overflow-y-auto">
            {r.checklistItems.map(item => (
              <div key={item.id} className="flex items-center gap-2 group">
                <button
                  onClick={() => toggleMut.mutate(item.id)}
                  disabled={toggleMut.isPending}
                  className="shrink-0 text-lg leading-none"
                >
                  {item.isCompleted ? '✅' : '⬜'}
                </button>
                <span className={`text-xs flex-1 ${item.isCompleted ? 'line-through text-slate-500' : 'text-slate-300'}`}>
                  {item.task}
                </span>
                <button
                  onClick={() => deleteMut.mutate(item.id)}
                  className="opacity-0 group-hover:opacity-100 text-slate-600 hover:text-red-400 text-xs transition-all"
                >✕</button>
              </div>
            ))}
          </div>

          {/* Add custom item */}
          <div className="flex gap-2">
            <input
              value={newTask}
              onChange={e => setNewTask(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && newTask.trim() && addMut.mutate()}
              placeholder="Add checklist item…"
              className="flex-1 bg-slate-900/60 border border-slate-700 rounded-lg px-3 py-1.5 text-white text-xs focus:outline-none focus:border-blue-500"
            />
            <button
              onClick={() => addMut.mutate()}
              disabled={!newTask.trim() || addMut.isPending}
              className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg text-xs transition-colors disabled:opacity-40"
            >+ Add</button>
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-2 pt-1">
        {r.status === 'Pending' && (
          <button
            onClick={() => onReview(r)}
            className="flex-1 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-medium transition-colors"
          >
            Review
          </button>
        )}
        {r.status === 'Accepted' && (
          <button
            onClick={() => onComplete(r)}
            className="flex-1 py-2 bg-green-600 hover:bg-green-500 text-white rounded-xl text-sm font-medium transition-colors"
          >
            Complete Exit
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Manager View ─────────────────────────────────────────────────────────────

function ManagerResignationView() {
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [reviewTarget,  setReviewTarget]  = useState<ResignationDto | null>(null);
  const [completeTarget, setCompleteTarget] = useState<ResignationDto | null>(null);

  const { data: summary } = useQuery<ResignationSummaryDto>({
    queryKey: ['resignation-summary'],
    queryFn:  () => resignationApi.getSummary().then(r => r.data),
  });

  const { data: all = [], isLoading } = useQuery<ResignationDto[]>({
    queryKey: ['resignations', statusFilter],
    queryFn:  () => resignationApi.getAll(
      statusFilter === 'All' ? undefined : statusFilter
    ).then(r => r.data),
  });

  const statuses = ['All', 'Pending', 'Accepted', 'Completed', 'Rejected'];

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Pending',   value: summary.pendingCount,   icon: '⏳', color: 'text-yellow-400' },
            { label: 'Accepted',  value: summary.acceptedCount,  icon: '✅', color: 'text-blue-400'   },
            { label: 'Completed', value: summary.completedCount, icon: '🎓', color: 'text-green-400'  },
            { label: 'Rejected',  value: summary.rejectedCount,  icon: '❌', color: 'text-red-400'    },
          ].map(s => (
            <div key={s.label} className="bg-slate-800 border border-slate-700 rounded-xl p-4 flex items-center gap-3">
              <span className="text-2xl">{s.icon}</span>
              <div>
                <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                <p className="text-slate-400 text-xs">{s.label}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex gap-1.5 flex-wrap">
        {statuses.map(s => (
          <button key={s} onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors border ${
              statusFilter === s
                ? 'bg-blue-600 border-blue-500 text-white'
                : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500'
            }`}>
            {s}
          </button>
        ))}
      </div>

      {/* Cards grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-slate-800 border border-slate-700 rounded-2xl p-5 h-64 animate-pulse" />
          ))}
        </div>
      ) : all.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-5xl mb-3">📭</div>
          <p className="text-slate-400 font-medium">No {statusFilter !== 'All' ? statusFilter.toLowerCase() : ''} resignations</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {all.map(r => (
            <ResignationDetailCard
              key={r.id} r={r}
              onReview={setReviewTarget}
              onComplete={setCompleteTarget}
            />
          ))}
        </div>
      )}

      {reviewTarget && (
        <ReviewModal r={reviewTarget} onClose={() => setReviewTarget(null)} />
      )}
      {completeTarget && (
        <CompleteExitModal r={completeTarget} onClose={() => setCompleteTarget(null)} />
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function ResignationPage() {
  const { user }  = useAuth();
  const isManager = user?.role === 'Manager' || user?.role === 'TeamLead';

  const { data: myResignation, isLoading } = useQuery<ResignationDto | null>({
    queryKey: ['my-resignation'],
    queryFn:  () =>
      resignationApi.getMy()
        .then(r => r.data)
        .catch(() => null),   // 404 → no active resignation, that's fine
    enabled:  !isManager,
    retry:    false,
  });

  const [showForm, setShowForm] = useState(false);

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">
            {isManager ? '🚪 Resignation & Exit Management' : '📝 Resignation'}
          </h1>
          <p className="text-slate-400 text-sm mt-0.5">
            {isManager
              ? 'Review, accept, and manage employee exit process'
              : 'Submit or manage your resignation letter'}
          </p>
        </div>

        {/* Employee can submit only if no active resignation and not showing form */}
        {!isManager && !myResignation && !showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-xl text-sm font-semibold transition-colors shadow-lg shadow-red-600/20"
          >
            + Submit Resignation
          </button>
        )}
      </div>

      {/* ── Employee View ────────────────────────────────────────────────────── */}
      {!isManager && (
        isLoading ? (
          <div className="max-w-lg mx-auto bg-slate-800 border border-slate-700 rounded-2xl p-6 h-48 animate-pulse" />
        ) : showForm ? (
          <SubmitResignationForm onSuccess={() => setShowForm(false)} />
        ) : myResignation ? (
          <MyResignationCard
            r={myResignation}
            onWithdraw={() => setShowForm(false)}
          />
        ) : (
          <div className="text-center py-16 max-w-md mx-auto space-y-4">
            <div className="text-6xl">👋</div>
            <h2 className="text-white font-semibold text-xl">No Active Resignation</h2>
            <p className="text-slate-400 text-sm">
              If you wish to resign, click the button above to submit your resignation letter. Your manager will review it.
            </p>
          </div>
        )
      )}

      {/* ── Manager View ─────────────────────────────────────────────────────── */}
      {isManager && <ManagerResignationView />}
    </div>
  );
}