import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { reviewApi, managerApi } from '../services/api';
import { useAuth } from '../context/Authcontext';
import { useToast } from '../context/ToastContext';
import type {
  ReviewCycleDto,
  PerformanceReviewDto,
  ReviewStatus,
  CycleType,
  SubmitSelfAssessmentDto,
  SubmitManagerReviewDto,
  CreateReviewCycleDto,
} from '../types';
import { COMPETENCIES, RATING_LABELS } from '../types';
import { DatePicker } from '../components/DatePicker';
import { PageHeader } from '../components/ui/PageHeader';
import { StatCard } from '../components/ui/StatCard';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import {
  Target,
  Award,
  CheckCircle2,
  Clock,
  UserCheck,
  ChevronLeft,
  ChevronRight,
  Plus,
  Search,
  X,
  BarChart3,
  FileText,
  AlertCircle,
  Layers} from 'lucide-react';

// ─── Constants ────────────────────────────────────────────────────────────────
const BACKEND_ORIGIN = 'https://localhost:7096';

const STATUS_CFG: Record<
  ReviewStatus,
  { label: string; text: string; bg: string; border: string; dot: string }
> = {
  Pending: {
    label: 'Pending Assessment',
    text: 'text-slate-600 dark:text-slate-400',
    bg: 'bg-slate-100 dark:bg-slate-800',
    border: 'border-slate-200 dark:border-slate-700',
    dot: 'bg-slate-400',
  },
  SelfAssessment: {
    label: 'Self Submitted',
    text: 'text-amber-700 dark:text-amber-400',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/25',
    dot: 'bg-amber-500',
  },
  ManagerReview: {
    label: 'Under Manager Review',
    text: 'text-blue-700 dark:text-blue-400',
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/25',
    dot: 'bg-blue-500',
  },
  Completed: {
    label: 'Review Finalized',
    text: 'text-emerald-700 dark:text-emerald-400',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/25',
    dot: 'bg-emerald-500',
  },
};

const RATING_COLORS = [
  '',
  'text-rose-600 dark:text-rose-400',
  'text-orange-600 dark:text-orange-400',
  'text-amber-600 dark:text-amber-400',
  'text-blue-600 dark:text-blue-400',
  'text-emerald-600 dark:text-emerald-400',
];

const RATING_BG = [
  '',
  'bg-rose-500 text-white',
  'bg-orange-500 text-white',
  'bg-amber-500 text-white',
  'bg-blue-500 text-white',
  'bg-emerald-500 text-white',
];

const CYCLE_TYPES: { value: CycleType; label: string }[] = [
  { value: 'Quarterly', label: 'Quarterly (90-Day Cycle)' },
  { value: 'HalfYearly', label: 'Half-Yearly (Mid-Year Evaluation)' },
  { value: 'Annual', label: 'Annual Appraisal' },
  { value: 'Custom', label: 'Custom Review Sprint' },
];

// ─── Small Helpers ────────────────────────────────────────────────────────────
const Avatar: React.FC<{
  src?: string | null;
  name: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
}> = ({ src, name, size = 'sm' }) => {
  const map = {
    xs: 'w-6 h-6 text-[10px]',
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 text-sm font-bold',
    lg: 'w-14 h-14 text-lg font-extrabold',
  };
  const initials = name
    .split(' ')
    .filter(Boolean)
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const resolved = src
    ? src.startsWith('http')
      ? src
      : `${BACKEND_ORIGIN}${src}`
    : null;

  if (resolved) {
    return (
      <img
        src={resolved}
        alt={name}
        className={`${map[size]} rounded-2xl object-cover flex-shrink-0 shadow-sm`}
      />
    );
  }
  return (
    <div
      className={`${map[size]} rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600
      flex items-center justify-center font-bold text-white flex-shrink-0 shadow-sm shadow-indigo-500/20`}
    >
      {initials || 'U'}
    </div>
  );
};

const RatingStars: React.FC<{
  value: number;
  onChange?: (v: number) => void;
  readonly?: boolean;
}> = ({ value, onChange, readonly = false }) => (
  <div className="flex items-center gap-1.5">
    {[1, 2, 3, 4, 5].map((n) => (
      <button
        key={n}
        type="button"
        disabled={readonly}
        onClick={() => onChange?.(n)}
        className={`text-xl transition leading-none ${
          readonly
            ? 'cursor-default'
            : 'cursor-pointer hover:scale-125 focus:outline-none'
        } ${
          n <= value
            ? 'text-amber-400 drop-shadow-[0_2px_4px_rgba(251,191,36,0.3)]'
            : 'text-slate-200 dark:text-slate-700'
        }`}
      >
        ★
      </button>
    ))}
    {value > 0 && (
      <span className={`text-xs font-bold ml-1.5 ${RATING_COLORS[value]}`}>
        {RATING_LABELS[value]}
      </span>
    )}
  </div>
);

const ScoreBadge: React.FC<{ score: number }> = ({ score }) => (
  <div
    className={`w-7 h-7 sm:w-8 sm:h-8 rounded-xl flex items-center justify-center font-bold text-xs sm:text-sm shadow-sm
    ${RATING_BG[score] || 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'}`}
  >
    {score}
  </div>
);

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

// ─── Competency Bar Chart ───────────────────────────────────────────────────
const CompetencyChart: React.FC<{
  ratings: PerformanceReviewDto['ratings'];
}> = ({ ratings }) => {
  if (!ratings.length) return null;
  return (
    <div className="space-y-4">
      {COMPETENCIES.map((c) => {
        const r = ratings.find((rt) => rt.competency === c.key);
        if (!r) return null;
        const pct = (r.score / 5) * 100;
        return (
          <div
            key={c.key}
            className="p-3.5 bg-slate-50 dark:bg-slate-950/50 rounded-2xl border border-slate-200/80 dark:border-slate-800"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-slate-800 dark:text-slate-200 text-xs sm:text-sm font-semibold flex items-center gap-2">
                <span>{c.icon}</span>
                <span>{c.label}</span>
              </span>
              <div className="flex items-center gap-2.5">
                <span className={`text-xs font-bold ${RATING_COLORS[r.score]}`}>
                  {RATING_LABELS[r.score]}
                </span>
                <ScoreBadge score={r.score} />
              </div>
            </div>
            <div className="h-2 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  RATING_BG[r.score]?.split(' ')[0] ?? 'bg-blue-500'
                }`}
                style={{ width: `${pct}%` }}
              />
            </div>
            {r.comment && (
              <p className="text-slate-500 dark:text-slate-400 text-xs mt-2 italic pl-2 border-l-2 border-slate-300 dark:border-slate-700">
                "{r.comment}"
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
};

// ─── Review Detail Modal ──────────────────────────────────────────────────────
const ReviewDetailModal: React.FC<{
  review: PerformanceReviewDto;
  isManager: boolean;
  onClose: () => void;
}> = ({ review, isManager, onClose }) => {
  const { toast } = useToast();
  const qc = useQueryClient();

  const [tab, setTab] = useState<'self' | 'manager' | 'competencies'>('self');

  // Self-assessment form state
  const [selfForm, setSelfForm] = useState({
    selfAssessmentText: review.selfAssessmentText ?? '',
    selfRating: review.selfRating ?? 3,
    achievements: review.achievements ?? '',
    improvements: review.improvements ?? '',
    goals: review.goals ?? '',
  });

  // Manager review form state
  const [managerForm, setManagerForm] = useState({
    managerFeedback: review.managerFeedback ?? '',
    overallRating: review.overallRating ?? 3,
    strengthsNote: review.strengthsNote ?? '',
    developmentNote: review.developmentNote ?? '',
    ratings: COMPETENCIES.map((c) => ({
      competency: c.key,
      score: review.ratings.find((r) => r.competency === c.key)?.score ?? 3,
      comment: review.ratings.find((r) => r.competency === c.key)?.comment ?? '',
    })),
  });

  const selfMut = useMutation({
    mutationFn: (d: SubmitSelfAssessmentDto) =>
      reviewApi.submitSelfAssessment(review.id, d),
    onSuccess: () => {
      toast.success('Self-assessment submitted successfully');
      qc.invalidateQueries({ queryKey: ['myReviews'] });
      qc.invalidateQueries({ queryKey: ['reviewCycles'] });
      onClose();
    },
    onError: () => toast.error('Failed to submit self-assessment'),
  });

  const managerMut = useMutation({
    mutationFn: (d: SubmitManagerReviewDto) =>
      reviewApi.submitManagerReview(review.id, d),
    onSuccess: () => {
      toast.success('Manager evaluation successfully recorded');
      qc.invalidateQueries({ queryKey: ['teamReviews'] });
      qc.invalidateQueries({ queryKey: ['reviewCycles'] });
      onClose();
    },
    onError: () => toast.error('Failed to submit manager evaluation'),
  });

  const canEditSelf =
    !isManager &&
    (review.status === 'Pending' || review.status === 'SelfAssessment');
  const canEditManager = isManager && review.status === 'SelfAssessment';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-slate-200 dark:border-slate-800 flex-shrink-0 bg-slate-50/50 dark:bg-slate-950/40">
          <div className="flex items-start gap-3.5 justify-between">
            <div className="flex items-center gap-3.5">
              <Avatar
                src={review.revieweePhoto}
                name={review.revieweeName}
                size="md"
              />
              <div>
                <p className="text-slate-900 dark:text-white font-bold text-base">
                  {review.revieweeName}
                </p>
                <p className="text-slate-500 dark:text-slate-400 text-xs">
                  {review.revieweeRole}
                </p>
                <p className="text-slate-400 text-[11px] mt-0.5">
                  {review.cycleTitle} · {formatDate(review.cycleStart)} –{' '}
                  {formatDate(review.cycleEnd)}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <span
                className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${STATUS_CFG[review.status].bg} ${STATUS_CFG[review.status].border} ${STATUS_CFG[review.status].text}`}
              >
                {STATUS_CFG[review.status].label}
              </span>
              <button
                type="button"
                onClick={onClose}
                className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-slate-900 dark:hover:text-white flex items-center justify-center transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Overall ratings row */}
          {(review.selfRating || review.overallRating) && (
            <div className="flex flex-wrap gap-5 mt-4 pt-3 border-t border-slate-200/80 dark:border-slate-800">
              {review.selfRating && (
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-slate-500 font-medium">Self Score:</span>
                  <RatingStars value={review.selfRating} readonly />
                </div>
              )}
              {review.overallRating && (
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-slate-500 font-medium">Manager Score:</span>
                  <RatingStars value={review.overallRating} readonly />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 bg-slate-50/20 dark:bg-slate-950/20 px-4 sm:px-6 gap-2 flex-shrink-0">
          {[
            { key: 'self', label: 'Self Assessment' },
            { key: 'manager', label: 'Manager Evaluation' },
            { key: 'competencies', label: 'Core Competencies' },
          ].map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key as typeof tab)}
              className={`py-3 px-3 text-xs sm:text-sm font-semibold transition border-b-2 cursor-pointer ${
                tab === t.key
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4">
          {/* SELF ASSESSMENT TAB */}
          {tab === 'self' && (
            <div className="space-y-4">
              {canEditSelf ? (
                <>
                  <div className="bg-slate-50 dark:bg-slate-950/60 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block mb-2">
                      Overall Self-Rating *
                    </label>
                    <RatingStars
                      value={selfForm.selfRating}
                      onChange={(v) =>
                        setSelfForm((f) => ({ ...f, selfRating: v }))
                      }
                    />
                  </div>

                  {[
                    {
                      key: 'selfAssessmentText',
                      label: 'Comprehensive Self-Assessment *',
                      ph: 'Reflect upon your deliverables, initiatives, and contributions during this review cycle…',
                    },
                    {
                      key: 'achievements',
                      label: 'Key Accomplishments & Wins',
                      ph: 'What significant goals or milestones did you meet or exceed?',
                    },
                    {
                      key: 'improvements',
                      label: 'Growth Opportunities & Bottlenecks',
                      ph: 'Where did you face friction, and how do you plan to sharpen your impact?',
                    },
                    {
                      key: 'goals',
                      label: 'Proposed Objectives for Next Cycle',
                      ph: 'What specific targets or skills do you intend to tackle?',
                    },
                  ].map((f) => (
                    <div key={f.key}>
                      <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block mb-1.5">
                        {f.label}
                      </label>
                      <textarea
                        value={(selfForm as any)[f.key]}
                        onChange={(e) =>
                          setSelfForm((s) => ({
                            ...s,
                            [f.key]: e.target.value,
                          }))
                        }
                        rows={3}
                        placeholder={f.ph}
                        className="w-full bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 rounded-2xl px-3.5 py-2.5 text-xs sm:text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                      />
                    </div>
                  ))}

                  <button
                    type="button"
                    onClick={() => selfMut.mutate(selfForm)}
                    disabled={
                      !selfForm.selfAssessmentText.trim() || selfMut.isPending
                    }
                    className="w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-xs sm:text-sm font-semibold rounded-2xl transition shadow-sm shadow-blue-500/20 cursor-pointer"
                  >
                    {selfMut.isPending
                      ? 'Submitting Evaluation…'
                      : 'Submit Self-Assessment'}
                  </button>
                </>
              ) : review.selfAssessmentText ? (
                <div className="space-y-4">
                  <div className="bg-slate-50 dark:bg-slate-950/60 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800">
                    <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                      Self Assigned Rating
                    </p>
                    <RatingStars value={review.selfRating ?? 0} readonly />
                  </div>

                  {[
                    {
                      label: 'Comprehensive Self-Assessment',
                      value: review.selfAssessmentText,
                    },
                    {
                      label: 'Key Accomplishments',
                      value: review.achievements,
                    },
                    {
                      label: 'Growth Opportunities',
                      value: review.improvements,
                    },
                    {
                      label: 'Goals for Next Cycle',
                      value: review.goals,
                    },
                  ].map(
                    (f) =>
                      f.value && (
                        <div key={f.label}>
                          <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                            {f.label}
                          </p>
                          <p className="text-slate-800 dark:text-slate-200 text-xs sm:text-sm bg-slate-50 dark:bg-slate-950/60 rounded-2xl p-4 border border-slate-200/80 dark:border-slate-800 whitespace-pre-wrap leading-relaxed">
                            {f.value}
                          </p>
                        </div>
                      )
                  )}

                  {review.selfSubmittedAt && (
                    <p className="text-slate-400 text-xs">
                      Submitted on {formatDate(review.selfSubmittedAt)}
                    </p>
                  )}
                </div>
              ) : (
                <div className="text-center py-12 text-slate-400 text-xs sm:text-sm space-y-2">
                  <Clock className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-600" />
                  <p>
                    {isManager
                      ? 'The employee has not submitted their self-assessment yet.'
                      : 'Complete and submit your self-assessment form above.'}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* MANAGER REVIEW TAB */}
          {tab === 'manager' && (
            <div className="space-y-4">
              {isManager && canEditManager ? (
                <>
                  <div className="bg-slate-50 dark:bg-slate-950/60 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block mb-2">
                      Overall Manager Performance Rating *
                    </label>
                    <RatingStars
                      value={managerForm.overallRating}
                      onChange={(v) =>
                        setManagerForm((f) => ({ ...f, overallRating: v }))
                      }
                    />
                  </div>

                  {[
                    {
                      key: 'managerFeedback',
                      label: 'Overall Performance Synthesis *',
                      ph: 'Provide executive evaluation on deliverables, teamwork, leadership, and operational execution…',
                    },
                    {
                      key: 'strengthsNote',
                      label: 'Key Strengths & Notable Impact',
                      ph: 'What stand-out contributions elevate their performance?',
                    },
                    {
                      key: 'developmentNote',
                      label: 'Development Plan & Next Milestones',
                      ph: 'Specific areas for mentoring, technical upskilling, or workflow adjustments…',
                    },
                  ].map((f) => (
                    <div key={f.key}>
                      <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block mb-1.5">
                        {f.label}
                      </label>
                      <textarea
                        value={(managerForm as any)[f.key]}
                        onChange={(e) =>
                          setManagerForm((s) => ({
                            ...s,
                            [f.key]: e.target.value,
                          }))
                        }
                        rows={3}
                        placeholder={f.ph}
                        className="w-full bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 rounded-2xl px-3.5 py-2.5 text-xs sm:text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                      />
                    </div>
                  ))}

                  <button
                    type="button"
                    onClick={() => managerMut.mutate(managerForm)}
                    disabled={
                      !managerForm.managerFeedback.trim() || managerMut.isPending
                    }
                    className="w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-xs sm:text-sm font-semibold rounded-2xl transition shadow-sm shadow-blue-500/20 cursor-pointer"
                  >
                    {managerMut.isPending
                      ? 'Recording Appraisal…'
                      : 'Submit Manager Review'}
                  </button>
                </>
              ) : review.managerFeedback ? (
                <div className="space-y-4">
                  <div className="bg-slate-50 dark:bg-slate-950/60 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800">
                    <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                      Manager Appraisal Rating
                    </p>
                    <RatingStars value={review.overallRating ?? 0} readonly />
                  </div>

                  {[
                    {
                      label: 'Manager Assessment & Synthesis',
                      value: review.managerFeedback,
                    },
                    {
                      label: 'Demonstrated Strengths',
                      value: review.strengthsNote,
                    },
                    {
                      label: 'Targeted Development Areas',
                      value: review.developmentNote,
                    },
                  ].map(
                    (f) =>
                      f.value && (
                        <div key={f.label}>
                          <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                            {f.label}
                          </p>
                          <p className="text-slate-800 dark:text-slate-200 text-xs sm:text-sm bg-slate-50 dark:bg-slate-950/60 rounded-2xl p-4 border border-slate-200/80 dark:border-slate-800 whitespace-pre-wrap leading-relaxed">
                            {f.value}
                          </p>
                        </div>
                      )
                  )}

                  {review.managerSubmittedAt && (
                    <p className="text-slate-400 text-xs">
                      Evaluated by {review.reviewerName} on{' '}
                      {formatDate(review.managerSubmittedAt)}
                    </p>
                  )}
                </div>
              ) : (
                <div className="text-center py-12 text-slate-400 text-xs sm:text-sm space-y-2">
                  <UserCheck className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-600" />
                  <p>
                    {isManager
                      ? review.status === 'Pending'
                        ? 'Awaiting employee self-assessment before appraisal can begin.'
                        : 'Submit your management evaluation using the form.'
                      : 'Your reporting manager has not finalized their review yet.'}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* COMPETENCIES TAB */}
          {tab === 'competencies' && (
            <div className="space-y-4">
              {isManager && canEditManager ? (
                <div className="space-y-3.5">
                  {COMPETENCIES.map((c, i) => (
                    <div
                      key={c.key}
                      className="p-4 bg-slate-50 dark:bg-slate-950/60 rounded-2xl border border-slate-200/80 dark:border-slate-800 space-y-2.5"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-base">{c.icon}</span>
                        <p className="text-slate-900 dark:text-white text-xs sm:text-sm font-bold">
                          {c.label}
                        </p>
                      </div>
                      <RatingStars
                        value={managerForm.ratings[i].score}
                        onChange={(v) =>
                          setManagerForm((f) => ({
                            ...f,
                            ratings: f.ratings.map((r, idx) =>
                              idx === i ? { ...r, score: v } : r
                            ),
                          }))
                        }
                      />
                      <input
                        value={managerForm.ratings[i].comment}
                        onChange={(e) =>
                          setManagerForm((f) => ({
                            ...f,
                            ratings: f.ratings.map((r, idx) =>
                              idx === i ? { ...r, comment: e.target.value } : r
                            ),
                          }))
                        }
                        placeholder="Add constructive notes or observable metrics…"
                        className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                  ))}
                  <p className="text-slate-500 text-xs text-center pt-2">
                    Scores will commit automatically when you submit the Manager Evaluation tab.
                  </p>
                </div>
              ) : review.ratings.length > 0 ? (
                <CompetencyChart ratings={review.ratings} />
              ) : (
                <div className="text-center py-12 text-slate-400 text-xs sm:text-sm space-y-2">
                  <BarChart3 className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-600" />
                  <p>
                    Core competency benchmarks will appear once the manager review is recorded.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── Create Cycle Modal ───────────────────────────────────────────────────────
const CreateCycleModal: React.FC<{
  allUsers: { id: number; fullName: string }[];
  onClose: () => void;
}> = ({ allUsers, onClose }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [form, setForm] = useState<CreateReviewCycleDto>({
    title: '',
    description: '',
    cycleType: 'Quarterly',
    startDate: '',
    endDate: '',
    selfAssessmentDueDate: '',
    revieweeIds: [],
  });
  const [search, setSearch] = useState('');

  const createMut = useMutation({
    mutationFn: (d: object) => reviewApi.createCycle(d),
    onSuccess: () => {
      toast.success('Appraisal review cycle scheduled successfully');
      qc.invalidateQueries({ queryKey: ['reviewCycles'] });
      onClose();
    },
    onError: () => toast.error('Failed to create review cycle'),
  });

  const eligible = allUsers.filter(
    (u) =>
      u.id !== user?.id &&
      u.fullName.toLowerCase().includes(search.toLowerCase())
  );

  const toggle = (id: number) =>
    setForm((f) => ({
      ...f,
      revieweeIds: f.revieweeIds.includes(id)
        ? f.revieweeIds.filter((x) => x !== id)
        : [...f.revieweeIds, id],
    }));

  const selectAll = () => {
    setForm((f) => ({
      ...f,
      revieweeIds: eligible.map((u) => u.id),
    }));
  };

  const clearAll = () => {
    setForm((f) => ({
      ...f,
      revieweeIds: [],
    }));
  };

  const handleSubmit = () => {
    if (!form.title.trim() || !form.startDate || !form.endDate) {
      toast.error('Title, start date, and end date are required');
      return;
    }
    if (form.revieweeIds.length === 0) {
      toast.error('Please assign at least one employee to this review cycle');
      return;
    }
    createMut.mutate({
      ...form,
      selfAssessmentDueDate: form.selfAssessmentDueDate || undefined,
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-950/40 flex-shrink-0">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Launch Appraisal Review Cycle
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Define the cadence and assign eligible team members.
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

        {/* Form Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4">
          <div>
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block mb-1.5">
              Cycle Title *
            </label>
            <input
              value={form.title}
              onChange={(e) =>
                setForm((f) => ({ ...f, title: e.target.value }))
              }
              placeholder="e.g. Q3 2026 Engineering Performance Review"
              className="w-full bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block mb-1.5">
                Appraisal Cadence
              </label>
              <select
                value={form.cycleType}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    cycleType: e.target.value as CycleType,
                  }))
                }
                className="w-full bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm font-medium text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {CYCLE_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block mb-1.5">
                Self-Assessment Deadline
              </label>
              <DatePicker
                value={form.selfAssessmentDueDate ?? ''}
                onChange={(v) =>
                  setForm((f) => ({ ...f, selfAssessmentDueDate: v }))
                }
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block mb-1.5">
                Evaluation Window Start *
              </label>
              <DatePicker
                value={form.startDate}
                onChange={(v) => setForm((f) => ({ ...f, startDate: v }))}
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block mb-1.5">
                Evaluation Window End *
              </label>
              <DatePicker
                value={form.endDate}
                onChange={(v) => setForm((f) => ({ ...f, endDate: v }))}
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block mb-1.5">
              Context & Objectives
            </label>
            <textarea
              value={form.description ?? ''}
              onChange={(e) =>
                setForm((f) => ({ ...f, description: e.target.value }))
              }
              rows={2}
              placeholder="Outline objectives, expectations, and focus criteria for this cycle…"
              className="w-full bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2 text-xs sm:text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          {/* Employee multi-select */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                Assigned Team Members ({form.revieweeIds.length} chosen)
              </label>
              <div className="flex gap-2 text-[11px]">
                <button
                  type="button"
                  onClick={selectAll}
                  className="text-blue-600 hover:underline font-semibold cursor-pointer"
                >
                  Select All
                </button>
                <span className="text-slate-300 dark:text-slate-700">·</span>
                <button
                  type="button"
                  onClick={clearAll}
                  className="text-slate-500 hover:underline font-semibold cursor-pointer"
                >
                  Clear
                </button>
              </div>
            </div>

            <div className="relative mb-2">
              <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-400 pointer-events-none" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search eligible team members…"
                className="w-full bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 rounded-xl pl-8 pr-3.5 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="max-h-40 overflow-y-auto space-y-1.5 p-1 border border-slate-200 dark:border-slate-800 rounded-2xl bg-slate-50/50 dark:bg-slate-950/40">
              {eligible.map((u) => {
                const sel = form.revieweeIds.includes(u.id);
                return (
                  <div
                    key={u.id}
                    onClick={() => toggle(u.id)}
                    className={`flex items-center gap-2.5 px-3 py-2 rounded-xl cursor-pointer transition border select-none ${
                      sel
                        ? 'bg-blue-500/10 border-blue-500/30 text-blue-900 dark:text-blue-100 font-semibold'
                        : 'bg-white dark:bg-slate-900 border-slate-200/60 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-700'
                    }`}
                  >
                    <div
                      className={`w-4 h-4 rounded-md border flex items-center justify-center flex-shrink-0 ${
                        sel
                          ? 'bg-blue-600 border-blue-600 text-white'
                          : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800'
                      }`}
                    >
                      {sel && <CheckCircle2 className="w-3 h-3" />}
                    </div>
                    <Avatar name={u.fullName} size="xs" />
                    <span className="text-xs">{u.fullName}</span>
                  </div>
                );
              })}
              {eligible.length === 0 && (
                <p className="text-center py-4 text-xs text-slate-400">
                  No matching team members found.
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-5 sm:p-6 border-t border-slate-200 dark:border-slate-800 flex gap-3 bg-slate-50/30 dark:bg-slate-950/20 flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold rounded-xl text-xs sm:text-sm hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={createMut.isPending}
            className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-xs sm:text-sm font-semibold rounded-xl transition shadow-sm shadow-blue-500/20 cursor-pointer"
          >
            {createMut.isPending ? 'Scheduling…' : 'Launch Review Cycle'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Cycle Card ───────────────────────────────────────────────────────────────
const CycleCard: React.FC<{
  cycle: ReviewCycleDto;
  isManager: boolean;
  onClick: () => void;
}> = ({ cycle, isManager, onClick }) => {
  const progress =
    cycle.totalReviews > 0
      ? Math.round((cycle.completedCount / cycle.totalReviews) * 100)
      : 0;

  return (
    <Card
      onClick={onClick}
      className="border-slate-200/80 dark:border-slate-800 hover:border-blue-500/50 dark:hover:border-blue-500/50 transition-all cursor-pointer group shadow-sm hover:shadow-md"
    >
      <CardContent className="p-5 sm:p-6 space-y-4">
        {/* Top row */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <span className="text-[10px] font-bold tracking-wider uppercase text-blue-600 dark:text-blue-400 bg-blue-500/10 px-2.5 py-0.5 rounded-full border border-blue-500/20">
              {cycle.cycleType}
            </span>
            <h3 className="text-base font-bold text-slate-900 dark:text-white mt-1.5 truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition">
              {cycle.title}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {formatDate(cycle.startDate)} – {formatDate(cycle.endDate)}
            </p>
          </div>
          <span
            className={`text-xs font-semibold px-2.5 py-1 rounded-full border flex-shrink-0 ${
              cycle.status === 'Active'
                ? 'text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/25'
                : 'text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700'
            }`}
          >
            {cycle.status}
          </span>
        </div>

        {/* Employee View Pill */}
        {!isManager && cycle.myReview && (
          <div
            className={`flex items-center gap-2 p-2.5 rounded-xl border ${STATUS_CFG[cycle.myReview.status].bg} ${STATUS_CFG[cycle.myReview.status].border}`}
          >
            <span
              className={`w-2 h-2 rounded-full flex-shrink-0 ${STATUS_CFG[cycle.myReview.status].dot}`}
            />
            <span
              className={`text-xs font-semibold ${STATUS_CFG[cycle.myReview.status].text}`}
            >
              My Review: {STATUS_CFG[cycle.myReview.status].label}
            </span>
            {cycle.myReview.overallRating && (
              <span className="ml-auto flex items-center gap-1">
                <RatingStars value={cycle.myReview.overallRating} readonly />
              </span>
            )}
          </div>
        )}

        {/* Manager View Mini Velocity */}
        {isManager && (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="bg-slate-50 dark:bg-slate-950/60 p-2 rounded-xl border border-slate-200/80 dark:border-slate-800">
                <p className="text-base font-bold text-slate-600 dark:text-slate-400">
                  {cycle.pendingCount}
                </p>
                <p className="text-[10px] text-slate-400 font-semibold uppercase">Pending</p>
              </div>
              <div className="bg-slate-50 dark:bg-slate-950/60 p-2 rounded-xl border border-slate-200/80 dark:border-slate-800">
                <p className="text-base font-bold text-amber-600 dark:text-amber-400">
                  {cycle.selfSubmittedCount}
                </p>
                <p className="text-[10px] text-slate-400 font-semibold uppercase">Self Done</p>
              </div>
              <div className="bg-slate-50 dark:bg-slate-950/60 p-2 rounded-xl border border-slate-200/80 dark:border-slate-800">
                <p className="text-base font-bold text-emerald-600 dark:text-emerald-400">
                  {cycle.completedCount}
                </p>
                <p className="text-[10px] text-slate-400 font-semibold uppercase">Finalized</p>
              </div>
            </div>

            {cycle.totalReviews > 0 && (
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500 font-medium">Cycle Completion</span>
                  <span className="text-slate-900 dark:text-white font-bold">{progress}%</span>
                </div>
                <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-blue-600 to-indigo-500 rounded-full transition-all duration-500"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs text-slate-500">
          <span>By {cycle.createdByName}</span>
          {cycle.selfAssessmentDueDate && (
            <span className="text-amber-600 dark:text-amber-400 font-medium">
              Due {formatDate(cycle.selfAssessmentDueDate)}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

// ─── Cycle Detail View ────────────────────────────────────────────────────────
const CycleDetailView: React.FC<{
  cycle: ReviewCycleDto;
  isManager: boolean;
  onBack: () => void;
}> = ({ cycle, isManager, onBack }) => {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [selectedReview, setSelectedReview] = useState<PerformanceReviewDto | null>(null);

  const { data: teamReviews = [] } = useQuery<PerformanceReviewDto[]>({
    queryKey: ['teamReviews', cycle.id],
    queryFn: () => reviewApi.getTeamReviews(cycle.id).then((r) => r.data),
    enabled: isManager,
  });

  const { data: myReview } = useQuery<PerformanceReviewDto | null>({
    queryKey: ['myReview', cycle.myReview?.id],
    queryFn: () =>
      cycle.myReview
        ? reviewApi.getReview(cycle.myReview.id).then((r) => r.data)
        : Promise.resolve(null),
    enabled: !isManager && !!cycle.myReview,
  });

  const closeMut = useMutation({
    mutationFn: () => reviewApi.closeCycle(cycle.id),
    onSuccess: () => {
      toast.success('Review cycle closed');
      qc.invalidateQueries({ queryKey: ['reviewCycles'] });
      onBack();
    },
    onError: () => toast.error('Failed to close review cycle'),
  });

  const reviews = isManager ? teamReviews : myReview ? [myReview] : [];

  return (
    <div className="space-y-6">
      {/* Top action bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white rounded-xl text-xs sm:text-sm font-semibold transition shadow-sm cursor-pointer"
        >
          <ChevronLeft className="w-4 h-4" />
          <span>Back to All Cycles</span>
        </button>

        {isManager && cycle.status === 'Active' && (
          <button
            type="button"
            onClick={() => closeMut.mutate()}
            disabled={closeMut.isPending}
            className="px-4 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:text-rose-600 dark:hover:text-rose-400 rounded-xl text-xs font-semibold transition cursor-pointer"
          >
            {closeMut.isPending ? 'Closing…' : 'Close Cycle'}
          </button>
        )}
      </div>

      {/* Hero card for cycle details */}
      <Card className="border-slate-200/80 dark:border-slate-800 bg-gradient-to-br from-slate-900 to-slate-950 text-white shadow-md overflow-hidden">
        <CardContent className="p-6 sm:p-7">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-blue-400">
                {cycle.cycleType} Appraisal Session
              </span>
              <h2 className="text-2xl sm:text-3xl font-bold mt-1">
                {cycle.title}
              </h2>
              <p className="text-xs sm:text-sm text-slate-400 mt-1">
                Active timeline: {formatDate(cycle.startDate)} through {formatDate(cycle.endDate)}
                {cycle.selfAssessmentDueDate && (
                  <span> · Self submissions due {formatDate(cycle.selfAssessmentDueDate)}</span>
                )}
              </p>
              {cycle.description && (
                <p className="text-xs sm:text-sm text-slate-300 mt-3 max-w-2xl">
                  {cycle.description}
                </p>
              )}
            </div>

            <div className="bg-white/5 border border-white/10 rounded-2xl p-4 text-center min-w-[160px]">
              <span className="text-xs text-slate-400 block font-medium">Cycle Status</span>
              <span className="text-lg font-bold text-emerald-400 block mt-0.5">
                {cycle.status}
              </span>
              <span className="text-[11px] text-slate-400 block mt-0.5">
                {cycle.totalReviews} Total Participants
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Reviews list */}
      <Card className="border-slate-200/80 dark:border-slate-800 shadow-sm overflow-hidden">
        <CardHeader className="p-4 sm:p-5 border-b border-slate-200/80 dark:border-slate-800">
          <CardTitle className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <FileText className="w-4 h-4 text-blue-500" />
            <span>Assigned Candidate Dossiers</span>
          </CardTitle>
        </CardHeader>

        <CardContent className="p-0">
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {reviews.map((r) => (
              <div
                key={r.id}
                onClick={() => setSelectedReview(r)}
                className="p-4 flex items-center gap-3.5 hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition cursor-pointer select-none"
              >
                <Avatar src={r.revieweePhoto} name={r.revieweeName} size="sm" />
                <div className="flex-1 min-w-0">
                  <p className="text-slate-900 dark:text-slate-100 text-xs sm:text-sm font-bold truncate">
                    {r.revieweeName}
                  </p>
                  <p className="text-slate-400 text-[11px] truncate">
                    {r.revieweeRole}
                  </p>
                </div>

                <div className="flex items-center gap-3 flex-shrink-0">
                  {r.overallRating && (
                    <div className="hidden sm:block">
                      <RatingStars value={r.overallRating} readonly />
                    </div>
                  )}
                  <span
                    className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${STATUS_CFG[r.status].bg} ${STATUS_CFG[r.status].border} ${STATUS_CFG[r.status].text}`}
                  >
                    {STATUS_CFG[r.status].label}
                  </span>
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                </div>
              </div>
            ))}

            {reviews.length === 0 && (
              <div className="text-center py-16 text-slate-400 text-xs sm:text-sm">
                No active employee dossiers registered in this review cycle.
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Review details modal */}
      {selectedReview && (
        <ReviewDetailModal
          review={selectedReview}
          isManager={isManager}
          onClose={() => setSelectedReview(null)}
        />
      )}
    </div>
  );
};

// ─── Main PerformanceReviewPage ───────────────────────────────────────────────
export const PerformanceReviewPage: React.FC = () => {
  const { user } = useAuth();
  const isManager = user?.role === 'Manager' || user?.role === 'TeamLead';

  const [selectedCycle, setSelectedCycle] = useState<ReviewCycleDto | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [filterStatus, setFilterStatus] = useState<'all' | 'Active' | 'Closed'>('all');

  const { data: allUsersRaw } = useQuery({
    queryKey: ['users-simple'],
    queryFn: () => managerApi.getAllUsers().then((r) => r.data),
    staleTime: 300_000,
    enabled: isManager,
  });
  const allUsers: { id: number; fullName: string }[] = allUsersRaw ?? [];

  const { data: cycles = [], isLoading } = useQuery<ReviewCycleDto[]>({
    queryKey: ['reviewCycles'],
    queryFn: () => reviewApi.getCycles().then((r) => r.data),
    staleTime: 30_000,
  });

  const filtered = useMemo(
    () =>
      filterStatus === 'all'
        ? cycles
        : cycles.filter((c) => c.status === filterStatus),
    [cycles, filterStatus]
  );

  const stats = useMemo(
    () => ({
      total: cycles.length,
      active: cycles.filter((c) => c.status === 'Active').length,
      myPending: cycles.filter((c) => c.myReview?.status === 'Pending').length,
      completed: cycles.filter((c) => c.myReview?.status === 'ManagerReview').length,
    }),
    [cycles]
  );

  if (selectedCycle) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto">
        <CycleDetailView
          cycle={selectedCycle}
          isManager={isManager}
          onBack={() => setSelectedCycle(null)}
        />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* ── Page Header ── */}
      <PageHeader
        title="Performance & Appraisals"
        description="Structured performance appraisal cycles, self-evaluations, core competency rubrics, and manager feedback governance."
        breadcrumbs={[
          { label: 'Workspace', href: '/' },
          { label: 'HR & People' },
          { label: 'Performance Reviews' },
        ]}
        badge={{ label: 'Competency Framework 2.0', variant: 'blue' }}
        actions={
          isManager ? (
            <button
              type="button"
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs sm:text-sm font-semibold transition shadow-sm shadow-blue-500/20 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>New Review Cycle</span>
            </button>
          ) : undefined
        }
      />

      {/* ── KPI Stats Row ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {isManager ? (
          <>
            <StatCard
              title="Total Cycles"
              value={String(stats.total)}
              subtitle="All scheduled review seasons"
              icon={Layers}
              color="blue"
            />
            <StatCard
              title="Active Windows"
              value={String(stats.active)}
              subtitle="Currently accepting submissions"
              icon={Clock}
              color="emerald"
            />
            <StatCard
              title="Total Assessments"
              value={String(cycles.reduce((n, c) => n + c.totalReviews, 0))}
              subtitle="Assigned candidate dossiers"
              icon={FileText}
              color="purple"
            />
            <StatCard
              title="Finalized Reviews"
              value={String(cycles.reduce((n, c) => n + c.completedCount, 0))}
              subtitle="Manager evaluations logged"
              icon={CheckCircle2}
              color="amber"
            />
          </>
        ) : (
          <>
            <StatCard
              title="Total Cycles"
              value={String(stats.total)}
              subtitle="Available review campaigns"
              icon={Layers}
              color="blue"
            />
            <StatCard
              title="Active Cycles"
              value={String(stats.active)}
              subtitle="Open for self-assessment"
              icon={Clock}
              color="emerald"
            />
            <StatCard
              title="Action Required"
              value={String(stats.myPending)}
              subtitle="Pending self evaluation"
              icon={AlertCircle}
              color="amber"
            />
            <StatCard
              title="Appraisals Received"
              value={String(stats.completed)}
              subtitle="Manager reviews completed"
              icon={Award}
              color="purple"
            />
          </>
        )}
      </div>

      {/* ── Filter Controls ── */}
      <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-900 p-1 rounded-2xl border border-slate-200/80 dark:border-slate-800 w-fit text-xs">
        {(['all', 'Active', 'Closed'] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setFilterStatus(s)}
            className={`px-3.5 py-1.5 rounded-xl font-semibold transition cursor-pointer ${
              filterStatus === s
                ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            {s === 'all' ? 'All Review Cycles' : `${s} Cycles`}
          </button>
        ))}
      </div>

      {/* ── Cycles Grid ── */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl h-48 animate-pulse"
            />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card className="border-slate-200/80 dark:border-slate-800">
          <CardContent className="text-center py-20 text-slate-400 space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-blue-500/10 text-blue-500 mx-auto flex items-center justify-center">
              <Target className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              No Review Cycles Found
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
              {isManager
                ? 'Schedule a new review cycle to gather performance assessments across your department.'
                : 'Your reporting manager has not scheduled an active performance cycle yet.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {filtered.map((c) => (
            <CycleCard
              key={c.id}
              cycle={c}
              isManager={isManager}
              onClick={() => setSelectedCycle(c)}
            />
          ))}
        </div>
      )}

      {/* Create Cycle Modal */}
      {showCreateModal && (
        <CreateCycleModal
          allUsers={allUsers}
          onClose={() => setShowCreateModal(false)}
        />
      )}
    </div>
  );
};

export default PerformanceReviewPage;