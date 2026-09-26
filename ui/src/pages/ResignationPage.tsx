import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { resignationApi } from '../services/api';
import { useAuth } from '../context/Authcontext';
import { useToast } from '../context/ToastContext';
import type {
  ResignationDto,
  ResignationSummaryDto,
  ReviewResignationDto,
  CompleteExitDto,
} from '../types';
import { PageHeader } from '../components/ui/PageHeader';
import { StatCard } from '../components/ui/StatCard';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import {
  LogOut,
  Calendar,
  Clock,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  FileText,
  X,
  ShieldAlert,
  ClipboardList} from 'lucide-react';

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtDate(iso?: string) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

const STATUS_META: Record<
  string,
  { label: string; text: string; bg: string; border: string; dot: string }
> = {
  Pending: {
    label: 'Pending Review',
    text: 'text-amber-700 dark:text-amber-400',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/25',
    dot: 'bg-amber-500',
  },
  Accepted: {
    label: 'Notice Period Active',
    text: 'text-blue-700 dark:text-blue-400',
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/25',
    dot: 'bg-blue-500',
  },
  Rejected: {
    label: 'Declined',
    text: 'text-rose-700 dark:text-rose-400',
    bg: 'bg-rose-500/10',
    border: 'border-rose-500/25',
    dot: 'bg-rose-500',
  },
  Completed: {
    label: 'Exit Finalized',
    text: 'text-emerald-700 dark:text-emerald-400',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/25',
    dot: 'bg-emerald-500',
  },
};

function StatusBadge({ status }: { status: string }) {
  const m = STATUS_META[status] ?? STATUS_META.Pending;
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${m.bg} ${m.border} ${m.text}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${m.dot}`} />
      <span>{m.label}</span>
    </span>
  );
}

// ─── Submit Resignation Form (Employee) ──────────────────────────────────────
function SubmitResignationForm({ onSuccess }: { onSuccess: () => void }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [reason, setReason] = useState('');
  const [lastDay, setLastDay] = useState('');
  const [confirmed, setConfirmed] = useState(false);

  const mutation = useMutation({
    mutationFn: () =>
      resignationApi.submit({
        reason,
        requestedLastDay: new Date(lastDay).toISOString(),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-resignation'] });
      toast.success(
        'Resignation tendered successfully. Your reporting manager has been notified.'
      );
      onSuccess();
    },
    onError: (e: any) =>
      toast.error(
        e?.response?.data?.message ?? 'Failed to submit resignation request.'
      ),
  });

  const inputCls =
    'w-full bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-500 transition-colors';

  return (
    <Card className="max-w-xl mx-auto border-rose-500/30 shadow-lg overflow-hidden">
      <CardHeader className="p-6 border-b border-slate-200/80 dark:border-slate-800 bg-rose-500/5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center flex-shrink-0">
            <LogOut className="w-5 h-5" />
          </div>
          <div>
            <CardTitle className="text-base font-bold text-slate-900 dark:text-white">
              Tender Formal Resignation
            </CardTitle>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Initiates your offboarding protocol and transmits notice to management.
            </p>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-6 space-y-4">
        <div>
          <label className="block text-slate-700 dark:text-slate-300 text-xs mb-1.5 font-bold uppercase tracking-wider">
            Statement of Resignation & Reason *
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={4}
            placeholder="Detail your reasons for leaving, career transition notes, or personal circumstances…"
            className={`${inputCls} resize-none leading-relaxed`}
          />
        </div>

        <div>
          <label className="block text-slate-700 dark:text-slate-300 text-xs mb-1.5 font-bold uppercase tracking-wider">
            Proposed Final Working Day *
          </label>
          <input
            type="date"
            value={lastDay}
            onChange={(e) => setLastDay(e.target.value)}
            min={new Date(Date.now() + 86400000).toISOString().split('T')[0]}
            className={inputCls}
          />
          <p className="text-[11px] text-slate-400 mt-1">
            Subject to contractual notice period validation with HR and team lead.
          </p>
        </div>

        {/* Legal acknowledgment */}
        <div className="p-4 rounded-2xl bg-rose-500/5 border border-rose-500/20">
          <label className="flex items-start gap-3 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
              className="mt-1 h-4 w-4 rounded border-slate-300 text-rose-600 focus:ring-rose-500"
            />
            <span className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed font-medium">
              I acknowledge that submitting this formal declaration commences the official exit timeline and cannot be revoked without executive management concurrence.
            </span>
          </label>
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={onSuccess}
            className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs sm:text-sm font-semibold transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => mutation.mutate()}
            disabled={
              mutation.isPending || !reason.trim() || !lastDay || !confirmed
            }
            className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-500 disabled:opacity-40 text-white rounded-xl text-xs sm:text-sm font-semibold transition shadow-sm shadow-rose-500/20 cursor-pointer"
          >
            {mutation.isPending ? 'Submitting…' : 'Submit Resignation'}
          </button>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── My Resignation Card (Employee) ──────────────────────────────────────────
function MyResignationCard({
  r,
  onWithdraw,
}: {
  r: ResignationDto;
  onWithdraw: () => void;
}) {
  const { toast } = useToast();
  const qc = useQueryClient();

  const withdrawMut = useMutation({
    mutationFn: () => resignationApi.withdraw(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-resignation'] });
      toast.success('Resignation successfully withdrawn.');
      onWithdraw();
    },
    onError: (e: any) =>
      toast.error(e?.response?.data?.message ?? 'Failed to withdraw resignation.'),
  });

  return (
    <Card className="max-w-xl mx-auto border-slate-200/80 dark:border-slate-800 shadow-md overflow-hidden">
      <CardHeader className="p-6 border-b border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center flex-shrink-0">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <CardTitle className="text-base font-bold text-slate-900 dark:text-white">
                Active Resignation Dossier
              </CardTitle>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Filed on {fmtDate(r.submittedAt)}
              </p>
            </div>
          </div>
          <StatusBadge status={r.status} />
        </div>
      </CardHeader>

      <CardContent className="p-6 space-y-4">
        {/* Timeline Details */}
        <div className="grid grid-cols-2 gap-3 text-xs sm:text-sm">
          <div className="bg-slate-50 dark:bg-slate-950/60 p-3 rounded-2xl border border-slate-200/80 dark:border-slate-800">
            <span className="text-slate-500 block text-xs font-medium">Requested Last Day</span>
            <span className="text-slate-900 dark:text-white font-bold block mt-1">
              {fmtDate(r.requestedLastDay)}
            </span>
          </div>

          <div className="bg-slate-50 dark:bg-slate-950/60 p-3 rounded-2xl border border-slate-200/80 dark:border-slate-800">
            <span className="text-slate-500 block text-xs font-medium">Official Approved Date</span>
            <span className="text-blue-600 dark:text-blue-400 font-bold block mt-1">
              {fmtDate(r.noticePeriodEndDate)}
            </span>
          </div>
        </div>

        {r.noticeDaysRemaining !== undefined &&
          r.noticeDaysRemaining !== null &&
          r.status === 'Accepted' && (
            <div
              className={`p-3.5 rounded-2xl border flex items-center justify-between text-xs sm:text-sm ${
                r.noticeDaysRemaining <= 7
                  ? 'bg-rose-500/10 border-rose-500/25 text-rose-700 dark:text-rose-400'
                  : 'bg-blue-500/10 border-blue-500/25 text-blue-700 dark:text-blue-400'
              }`}
            >
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4" />
                <span className="font-semibold">Notice Period Countdown:</span>
              </div>
              <span className="font-extrabold text-sm sm:text-base">
                {r.noticeDaysRemaining} day{r.noticeDaysRemaining !== 1 ? 's' : ''} remaining
              </span>
            </div>
          )}

        {/* Reason summary */}
        <div>
          <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
            Submitted Reason
          </h4>
          <p className="text-slate-800 dark:text-slate-200 text-xs sm:text-sm bg-slate-50 dark:bg-slate-950/60 rounded-2xl p-4 border border-slate-200/80 dark:border-slate-800 whitespace-pre-wrap leading-relaxed">
            {r.reason}
          </p>
        </div>

        {/* Manager feedback note */}
        {r.reviewNote && (
          <div>
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
              Management Review Note {r.reviewedByName ? `· ${r.reviewedByName}` : ''}
            </h4>
            <p
              className={`text-xs sm:text-sm rounded-2xl p-4 border leading-relaxed ${
                r.status === 'Rejected'
                  ? 'bg-rose-500/10 border-rose-500/25 text-rose-800 dark:text-rose-200'
                  : 'bg-slate-50 dark:bg-slate-950/60 border-slate-200/80 dark:border-slate-800 text-slate-800 dark:text-slate-200'
              }`}
            >
              {r.reviewNote}
            </p>
          </div>
        )}

        {/* Exit checklist progress */}
        {r.status === 'Accepted' && r.checklistItems.length > 0 && (
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between text-xs sm:text-sm">
              <span className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <ClipboardList className="w-4 h-4 text-blue-500" />
                <span>Exit Checklist Handover Progress</span>
              </span>
              <span className="text-xs font-semibold text-slate-500">
                {r.checklistItems.filter((i) => i.isCompleted).length} of{' '}
                {r.checklistItems.length} items
              </span>
            </div>

            <div className="space-y-2">
              {r.checklistItems.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center gap-2.5 p-2.5 bg-slate-50 dark:bg-slate-950/60 rounded-xl border border-slate-200/80 dark:border-slate-800 text-xs"
                >
                  <span
                    className={
                      item.isCompleted ? 'text-emerald-500' : 'text-slate-400'
                    }
                  >
                    {item.isCompleted ? (
                      <CheckCircle2 className="w-4 h-4" />
                    ) : (
                      <span className="w-4 h-4 rounded-full border border-slate-300 dark:border-slate-600 block" />
                    )}
                  </span>
                  <span
                    className={
                      item.isCompleted
                        ? 'line-through text-slate-400 font-medium'
                        : 'text-slate-800 dark:text-slate-200 font-medium'
                    }
                  >
                    {item.task}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Withdrawal action */}
        {r.status === 'Pending' && (
          <div className="pt-2 border-t border-slate-200/80 dark:border-slate-800">
            <button
              type="button"
              onClick={() => withdrawMut.mutate()}
              disabled={withdrawMut.isPending}
              className="w-full py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs sm:text-sm font-semibold transition cursor-pointer"
            >
              {withdrawMut.isPending
                ? 'Withdrawing…'
                : 'Withdraw Resignation Request'}
            </button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Review Modal (Manager) ───────────────────────────────────────────────────
function ReviewModal({
  r,
  onClose,
}: {
  r: ResignationDto;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [decision, setDecision] = useState<'Accepted' | 'Rejected'>('Accepted');
  const [note, setNote] = useState('');
  const [officialDate, setOfficialDate] = useState(
    r.requestedLastDay ? r.requestedLastDay.split('T')[0] : ''
  );

  const mutation = useMutation({
    mutationFn: () => {
      const payload: ReviewResignationDto = {
        decision,
        reviewNote: note.trim() || undefined,
        noticePeriodEndDate:
          decision === 'Accepted'
            ? new Date(officialDate).toISOString()
            : undefined,
      };
      return resignationApi.review(r.id, payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['resignations'] });
      qc.invalidateQueries({ queryKey: ['resignation-summary'] });
      toast.success(`Resignation ${decision.toLowerCase()} successfully`);
      onClose();
    },
    onError: (e: any) =>
      toast.error(e?.response?.data?.message ?? 'Failed to review resignation.'),
  });

  const inputCls =
    'w-full bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Evaluate Resignation
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {r.employeeName} · {r.designation}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-slate-900 dark:hover:text-white flex items-center justify-center transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="bg-slate-50 dark:bg-slate-950/60 rounded-2xl p-3.5 border border-slate-200/80 dark:border-slate-800 text-xs">
            <span className="text-slate-400 uppercase font-bold text-[10px] tracking-wider block mb-1">
              Employee's statement
            </span>
            <p className="text-slate-800 dark:text-slate-200 leading-relaxed font-medium">
              "{r.reason}"
            </p>
          </div>

          <div>
            <label className="block text-slate-700 dark:text-slate-300 text-xs mb-2 font-bold uppercase tracking-wider">
              Management Decision *
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setDecision('Accepted')}
                className={`py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition border cursor-pointer ${
                  decision === 'Accepted'
                    ? 'bg-blue-600 border-blue-600 text-white shadow-sm shadow-blue-500/20'
                    : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Accept Resignation
              </button>
              <button
                type="button"
                onClick={() => setDecision('Rejected')}
                className={`py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition border cursor-pointer ${
                  decision === 'Rejected'
                    ? 'bg-rose-600 border-rose-600 text-white shadow-sm shadow-rose-500/20'
                    : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Decline Request
              </button>
            </div>
          </div>

          {decision === 'Accepted' && (
            <div>
              <label className="block text-slate-700 dark:text-slate-300 text-xs mb-1.5 font-bold uppercase tracking-wider">
                Official Last Working Day *
              </label>
              <input
                type="date"
                value={officialDate}
                onChange={(e) => setOfficialDate(e.target.value)}
                className={inputCls}
              />
              <p className="text-slate-400 text-[11px] mt-1">
                Requested date: {fmtDate(r.requestedLastDay)}
              </p>
            </div>
          )}

          <div>
            <label className="block text-slate-700 dark:text-slate-300 text-xs mb-1.5 font-bold uppercase tracking-wider">
              Management Remarks & Stipulations
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              placeholder={
                decision === 'Rejected'
                  ? 'State reasoning or retention discussions…'
                  : 'Handover requirements, notice period details, etc…'
              }
              className={`${inputCls} resize-none`}
            />
          </div>
        </div>

        <div className="flex gap-3 px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-950/20">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs sm:text-sm font-semibold transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => mutation.mutate()}
            disabled={
              mutation.isPending || (decision === 'Accepted' && !officialDate)
            }
            className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs sm:text-sm font-semibold transition disabled:opacity-40 shadow-sm shadow-blue-500/20 cursor-pointer"
          >
            {mutation.isPending ? 'Confirming…' : `Confirm ${decision}`}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Complete Exit Modal (Manager) ────────────────────────────────────────────
function CompleteExitModal({
  r,
  onClose,
}: {
  r: ResignationDto;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [exitDate, setExitDate] = useState(
    r.noticePeriodEndDate ? r.noticePeriodEndDate.split('T')[0] : ''
  );
  const [finalNote, setFinalNote] = useState('');
  const unchecked = r.checklistItems.filter((i) => !i.isCompleted);

  const mutation = useMutation({
    mutationFn: () =>
      resignationApi.completeExit(r.id, {
        exitDate: new Date(exitDate).toISOString(),
        finalNote: finalNote.trim() || undefined,
      } as CompleteExitDto),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['resignations'] });
      qc.invalidateQueries({ queryKey: ['resignation-summary'] });
      toast.success(
        'Exit protocol finalized. Employee account has been archived and access revoked.'
      );
      onClose();
    },
    onError: (e: any) =>
      toast.error(e?.response?.data?.message ?? 'Failed to finalize employee exit.'),
  });

  const inputCls =
    'w-full bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-colors';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Finalize Employee Exit
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {r.employeeName} · {r.designation}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-slate-900 dark:hover:text-white flex items-center justify-center transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {unchecked.length > 0 && (
            <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/25 text-amber-700 dark:text-amber-400 text-xs flex items-center gap-2.5">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span>
                {unchecked.length} handover item{unchecked.length !== 1 ? 's' : ''} remain uncompleted on checklist.
              </span>
            </div>
          )}

          <div>
            <label className="block text-slate-700 dark:text-slate-300 text-xs mb-1.5 font-bold uppercase tracking-wider">
              Official Exit Date *
            </label>
            <input
              type="date"
              value={exitDate}
              onChange={(e) => setExitDate(e.target.value)}
              className={inputCls}
            />
          </div>

          <div>
            <label className="block text-slate-700 dark:text-slate-300 text-xs mb-1.5 font-bold uppercase tracking-wider">
              Exit Record Notes & References
            </label>
            <textarea
              value={finalNote}
              onChange={(e) => setFinalNote(e.target.value)}
              rows={3}
              placeholder="Asset returns, severance reference, or farewell remarks…"
              className={`${inputCls} resize-none`}
            />
          </div>

          <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/25 text-rose-700 dark:text-rose-400 text-xs flex items-start gap-2.5">
            <ShieldAlert className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span className="leading-relaxed">
              <strong>Account Deactivation Warning:</strong> Completing this operation immediately archives the employee's security identity and revokes application access credentials.
            </span>
          </div>
        </div>

        <div className="flex gap-3 px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-950/20">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs sm:text-sm font-semibold transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || !exitDate}
            className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs sm:text-sm font-semibold transition disabled:opacity-40 shadow-sm shadow-emerald-500/20 cursor-pointer"
          >
            {mutation.isPending ? 'Finalizing…' : 'Complete Offboarding'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Resignation Detail Card (Manager) ───────────────────────────────────────
function ResignationDetailCard({
  r,
  onReview,
  onComplete,
}: {
  r: ResignationDto;
  onReview: (r: ResignationDto) => void;
  onComplete: (r: ResignationDto) => void;
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [newTask, setNewTask] = useState('');

  const toggleMut = useMutation({
    mutationFn: (itemId: number) => resignationApi.toggleChecklistItem(itemId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['resignations'] }),
    onError: () => toast.error('Failed to update checklist item.'),
  });

  const addMut = useMutation({
    mutationFn: () => resignationApi.addChecklistItem(r.id, newTask.trim()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['resignations'] });
      setNewTask('');
    },
    onError: () => toast.error('Failed to add checklist item.'),
  });

  const deleteMut = useMutation({
    mutationFn: (itemId: number) => resignationApi.deleteChecklistItem(itemId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['resignations'] }),
    onError: () => toast.error('Failed to remove checklist item.'),
  });

  const completedCount = r.checklistItems.filter((i) => i.isCompleted).length;
  const totalCount = r.checklistItems.length;

  return (
    <Card className="border-slate-200/80 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 transition-all shadow-sm flex flex-col justify-between">
      <CardContent className="p-5 space-y-4 flex-1 flex flex-col justify-between">
        <div className="space-y-3.5">
          {/* Header */}
          <div className="flex items-start justify-between gap-3">
            <div>
              <h4 className="text-slate-900 dark:text-white font-bold text-sm leading-snug">
                {r.employeeName}
              </h4>
              <p className="text-slate-500 dark:text-slate-400 text-xs mt-0.5 font-medium">
                {r.designation}
                {r.department ? ` · ${r.department}` : ''}
              </p>
            </div>
            <StatusBadge status={r.status} />
          </div>

          {/* Key Dates Badge Grid */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="bg-slate-50 dark:bg-slate-950/60 p-2.5 rounded-xl border border-slate-200/80 dark:border-slate-800">
              <span className="text-slate-400 block text-[10px] uppercase font-bold">
                Tendered
              </span>
              <span className="text-slate-800 dark:text-slate-200 font-semibold block mt-0.5">
                {fmtDate(r.submittedAt)}
              </span>
            </div>
            <div className="bg-slate-50 dark:bg-slate-950/60 p-2.5 rounded-xl border border-slate-200/80 dark:border-slate-800">
              <span className="text-slate-400 block text-[10px] uppercase font-bold">
                Requested Last Day
              </span>
              <span className="text-slate-800 dark:text-slate-200 font-semibold block mt-0.5">
                {fmtDate(r.requestedLastDay)}
              </span>
            </div>

            {r.noticePeriodEndDate && (
              <div
                className={`p-2.5 rounded-xl border col-span-2 flex items-center justify-between ${
                  (r.noticeDaysRemaining ?? 99) <= 7
                    ? 'bg-rose-500/10 border-rose-500/25 text-rose-700 dark:text-rose-400'
                    : 'bg-blue-500/10 border-blue-500/25 text-blue-700 dark:text-blue-400'
                }`}
              >
                <div>
                  <span className="text-[10px] uppercase font-bold block">
                    Official Release Date
                  </span>
                  <span className="font-bold text-xs block mt-0.5">
                    {fmtDate(r.noticePeriodEndDate)}
                  </span>
                </div>
                {r.noticeDaysRemaining !== undefined &&
                  r.noticeDaysRemaining !== null && (
                    <span className="text-xs font-extrabold px-2 py-0.5 rounded-lg bg-white/40 dark:bg-black/20">
                      {r.noticeDaysRemaining}d remaining
                    </span>
                  )}
              </div>
            )}
          </div>

          {/* Reason */}
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
              Stated Reason
            </span>
            <p className="text-slate-700 dark:text-slate-300 text-xs bg-slate-50 dark:bg-slate-950/60 rounded-xl p-3 border border-slate-200/80 dark:border-slate-800 line-clamp-2 leading-relaxed">
              "{r.reason}"
            </p>
          </div>

          {/* Checklist (only when Accepted) */}
          {r.status === 'Accepted' && (
            <div className="space-y-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-900 dark:text-white">
                  Handover Checklist
                </span>
                <span className="text-[11px] font-semibold text-slate-500">
                  {completedCount} / {totalCount}
                </span>
              </div>

              {totalCount > 0 && (
                <div className="h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                    style={{ width: `${(completedCount / totalCount) * 100}%` }}
                  />
                </div>
              )}

              <div className="space-y-1.5 max-h-36 overflow-y-auto">
                {r.checklistItems.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-2 group text-xs py-1"
                  >
                    <button
                      type="button"
                      onClick={() => toggleMut.mutate(item.id)}
                      disabled={toggleMut.isPending}
                      className="cursor-pointer text-slate-400 hover:text-emerald-500 transition"
                    >
                      {item.isCompleted ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                      ) : (
                        <span className="w-3.5 h-3.5 rounded-md border border-slate-300 dark:border-slate-600 block" />
                      )}
                    </button>
                    <span
                      className={`flex-1 truncate ${
                        item.isCompleted
                          ? 'line-through text-slate-400'
                          : 'text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      {item.task}
                    </span>
                    <button
                      type="button"
                      onClick={() => deleteMut.mutate(item.id)}
                      className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-rose-500 transition cursor-pointer"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>

              {/* Add item */}
              <div className="flex gap-2">
                <input
                  value={newTask}
                  onChange={(e) => setNewTask(e.target.value)}
                  onKeyDown={(e) =>
                    e.key === 'Enter' && newTask.trim() && addMut.mutate()
                  }
                  placeholder="Add item (e.g. Return laptop, revoke AWS)…"
                  className="flex-1 bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <button
                  type="button"
                  onClick={() => addMut.mutate()}
                  disabled={!newTask.trim() || addMut.isPending}
                  className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-semibold rounded-xl transition cursor-pointer disabled:opacity-40"
                >
                  + Add
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
          {r.status === 'Pending' && (
            <button
              type="button"
              onClick={() => onReview(r)}
              className="w-full py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs sm:text-sm font-semibold transition shadow-sm shadow-blue-500/20 cursor-pointer"
            >
              Review Resignation
            </button>
          )}
          {r.status === 'Accepted' && (
            <button
              type="button"
              onClick={() => onComplete(r)}
              className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs sm:text-sm font-semibold transition shadow-sm shadow-emerald-500/20 cursor-pointer"
            >
              Complete Exit Protocol
            </button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Manager View ─────────────────────────────────────────────────────────────
function ManagerResignationView() {
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [reviewTarget, setReviewTarget] = useState<ResignationDto | null>(null);
  const [completeTarget, setCompleteTarget] = useState<ResignationDto | null>(null);

  const { data: summary } = useQuery<ResignationSummaryDto>({
    queryKey: ['resignation-summary'],
    queryFn: () => resignationApi.getSummary().then((r) => r.data),
  });

  const { data: all = [], isLoading } = useQuery<ResignationDto[]>({
    queryKey: ['resignations', statusFilter],
    queryFn: () =>
      resignationApi
        .getAll(statusFilter === 'All' ? undefined : statusFilter)
        .then((r) => r.data),
  });

  const statuses = ['All', 'Pending', 'Accepted', 'Completed', 'Rejected'];

  return (
    <div className="space-y-6">
      {/* Summary KPI Cards */}
      {summary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Pending Requests"
            value={String(summary.pendingCount)}
            subtitle="Awaiting management review"
            icon={Clock}
            color="amber"
          />
          <StatCard
            title="Notice Active"
            value={String(summary.acceptedCount)}
            subtitle="Currently serving notice period"
            icon={Calendar}
            color="blue"
          />
          <StatCard
            title="Exits Finalized"
            value={String(summary.completedCount)}
            subtitle="Archived employee records"
            icon={CheckCircle2}
            color="emerald"
          />
          <StatCard
            title="Requests Declined"
            value={String(summary.rejectedCount)}
            subtitle="Retained or declined requests"
            icon={XCircle}
            color="rose"
          />
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex gap-1.5 bg-slate-100 dark:bg-slate-900 p-1 rounded-2xl border border-slate-200/80 dark:border-slate-800 w-fit text-xs">
        {statuses.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setStatusFilter(s)}
            className={`px-3.5 py-1.5 rounded-xl font-semibold transition cursor-pointer ${
              statusFilter === s
                ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            {s === 'All' ? 'All Requests' : s}
          </button>
        ))}
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl h-64 animate-pulse"
            />
          ))}
        </div>
      ) : all.length === 0 ? (
        <Card className="border-slate-200/80 dark:border-slate-800">
          <CardContent className="text-center py-20 text-slate-400 space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-blue-500/10 text-blue-500 mx-auto flex items-center justify-center">
              <LogOut className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              No {statusFilter !== 'All' ? statusFilter.toLowerCase() : ''}{' '}
              resignation records
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
              There are currently no active employee offboarding requests in this category.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {all.map((r) => (
            <ResignationDetailCard
              key={r.id}
              r={r}
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
        <CompleteExitModal
          r={completeTarget}
          onClose={() => setCompleteTarget(null)}
        />
      )}
    </div>
  );
}

// ─── Main ResignationPage ─────────────────────────────────────────────────────
export const ResignationPage: React.FC = () => {
  const { user } = useAuth();
  const isManager = user?.role === 'Manager' || user?.role === 'TeamLead';

  const { data: myResignation, isLoading } = useQuery<ResignationDto | null>({
    queryKey: ['my-resignation'],
    queryFn: () =>
      resignationApi
        .getMy()
        .then((r) => r.data)
        .catch(() => null),
    enabled: !isManager,
    retry: false,
  });

  const [showForm, setShowForm] = useState(false);

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* ── Page Header ── */}
      <PageHeader
        title={
          isManager
            ? 'Exit Management & Offboarding'
            : 'Resignation & Notice Governance'
        }
        description={
          isManager
            ? 'Oversee employee exit requests, notice periods, asset return checklists, and account archiving.'
            : 'Submit formal notice of resignation, monitor handover tasks, and track exit timeline.'
        }
        breadcrumbs={[
          { label: 'Workspace', href: '/' },
          { label: 'HR & People' },
          { label: 'Resignation & Offboarding' },
        ]}
        badge={{
          label: isManager ? 'Exit Workflow Manager' : 'Employee Exit Portal',
          variant: 'rose',
        }}
        actions={
          !isManager && !myResignation && !showForm ? (
            <button
              type="button"
              onClick={() => setShowForm(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs sm:text-sm font-semibold transition shadow-sm shadow-rose-500/20 cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              <span>Tender Resignation</span>
            </button>
          ) : undefined
        }
      />

      {/* ── Employee View ── */}
      {!isManager &&
        (isLoading ? (
          <div className="max-w-xl mx-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 h-56 animate-pulse" />
        ) : showForm ? (
          <SubmitResignationForm onSuccess={() => setShowForm(false)} />
        ) : myResignation ? (
          <MyResignationCard
            r={myResignation}
            onWithdraw={() => setShowForm(false)}
          />
        ) : (
          <Card className="border-slate-200/80 dark:border-slate-800 max-w-md mx-auto">
            <CardContent className="text-center py-16 text-slate-400 space-y-3">
              <div className="w-14 h-14 rounded-2xl bg-rose-500/10 text-rose-500 mx-auto flex items-center justify-center">
                <LogOut className="w-7 h-7" />
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                No Active Resignation Filed
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                If you intend to transition out of the organization, click "Tender Resignation" to submit formal notice to your manager.
              </p>
            </CardContent>
          </Card>
        ))}

      {/* ── Manager View ── */}
      {isManager && <ManagerResignationView />}
    </div>
  );
};

export default ResignationPage;