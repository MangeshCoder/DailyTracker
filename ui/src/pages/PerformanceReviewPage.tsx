import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { reviewApi, managerApi } from '../services/api';
import { useAuth } from '../context/Authcontext';
import { useToast } from '../context/ToastContext';
import type {
  ReviewCycleDto, PerformanceReviewDto, ReviewStatus,
  CycleType, SubmitSelfAssessmentDto, SubmitManagerReviewDto,
  CreateReviewCycleDto,
} from '../types';
import { COMPETENCIES, RATING_LABELS } from '../types';
import { DatePicker } from '../components/DatePicker';

// ─── Constants ────────────────────────────────────────────────────────────────
const BACKEND_ORIGIN = 'https://localhost:7096';

const STATUS_CFG: Record<ReviewStatus, { label: string; dot: string; text: string; bg: string }> = {
  Pending:        { label: 'Pending',         dot: 'bg-slate-500',   text: 'text-slate-400',   bg: 'bg-slate-700/40 border-slate-600/30'      },
  SelfAssessment: { label: 'Self Submitted',  dot: 'bg-amber-500',   text: 'text-amber-400',   bg: 'bg-amber-500/10 border-amber-500/30'      },
  ManagerReview:  { label: 'Under Review',    dot: 'bg-blue-500',    text: 'text-blue-400',    bg: 'bg-blue-500/10 border-blue-500/30'        },
  Completed:      { label: 'Completed',       dot: 'bg-emerald-500', text: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/30'  },
};

const RATING_COLORS = ['', 'text-rose-400', 'text-orange-400', 'text-amber-400', 'text-blue-400', 'text-emerald-400'];
const RATING_BG     = ['', 'bg-rose-500',   'bg-orange-500',   'bg-amber-500',   'bg-blue-500',   'bg-emerald-500'  ];

const CYCLE_TYPES: { value: CycleType; label: string }[] = [
  { value: 'Quarterly',   label: 'Quarterly'    },
  { value: 'HalfYearly',  label: 'Half-Yearly'  },
  { value: 'Annual',      label: 'Annual'       },
  { value: 'Custom',      label: 'Custom'       },
];

// ─── Small Helpers ────────────────────────────────────────────────────────────
const Avatar = ({ src, name, size = 'sm' }: { src?: string | null; name: string; size?: 'xs' | 'sm' | 'md' | 'lg' }) => {
  const map = { xs: 'w-6 h-6 text-[10px]', sm: 'w-8 h-8 text-xs', md: 'w-10 h-10 text-sm', lg: 'w-14 h-14 text-lg' };
  const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  const resolved = src ? (src.startsWith('http') ? src : `${BACKEND_ORIGIN}${src}`) : null;
  if (resolved)
    return <img src={resolved} alt={name} className={`${map[size]} rounded-full object-cover flex-shrink-0`} />;
  return (
    <div className={`${map[size]} rounded-full bg-gradient-to-br from-blue-500 to-violet-600
      flex items-center justify-center font-bold text-white flex-shrink-0`}>
      {initials}
    </div>
  );
};

const RatingStars = ({
  value, onChange, readonly = false,
}: { value: number; onChange?: (v: number) => void; readonly?: boolean }) => (
  <div className="flex gap-1">
    {[1, 2, 3, 4, 5].map(n => (
      <button
        key={n}
        type="button"
        disabled={readonly}
        onClick={() => onChange?.(n)}
        className={`text-xl transition ${readonly ? 'cursor-default' : 'cursor-pointer hover:scale-110'}
          ${n <= value ? 'text-amber-400' : 'text-slate-700'}`}
      >★</button>
    ))}
    {value > 0 && (
      <span className={`text-xs self-center ml-1 ${RATING_COLORS[value]}`}>
        {RATING_LABELS[value]}
      </span>
    )}
  </div>
);

const ScoreBadge = ({ score }: { score: number }) => (
  <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-white text-sm
    ${RATING_BG[score]}`}>
    {score}
  </div>
);

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

// ─── Competency Radar (simple bar chart) ─────────────────────────────────────
const CompetencyChart = ({ ratings }: { ratings: PerformanceReviewDto['ratings'] }) => {
  if (!ratings.length) return null;
  return (
    <div className="space-y-3">
      {COMPETENCIES.map(c => {
        const r = ratings.find(rt => rt.competency === c.key);
        if (!r) return null;
        const pct = (r.score / 5) * 100;
        return (
          <div key={c.key}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-slate-300 text-xs">{c.icon} {c.label}</span>
              <div className="flex items-center gap-2">
                <span className={`text-xs font-semibold ${RATING_COLORS[r.score]}`}>
                  {RATING_LABELS[r.score]}
                </span>
                <ScoreBadge score={r.score} />
              </div>
            </div>
            <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${RATING_BG[r.score]}`}
                style={{ width: `${pct}%` }}
              />
            </div>
            {r.comment && (
              <p className="text-slate-500 text-xs mt-1 italic">"{r.comment}"</p>
            )}
          </div>
        );
      })}
    </div>
  );
};

// ─── Review Detail Modal ──────────────────────────────────────────────────────
const ReviewDetailModal = ({
  review, isManager, onClose,
}: { review: PerformanceReviewDto; isManager: boolean; onClose: () => void }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [tab, setTab] = useState<'self' | 'manager' | 'competencies'>('self');

  // Self-assessment form state
  const [selfForm, setSelfForm] = useState({
    selfAssessmentText: review.selfAssessmentText ?? '',
    selfRating:         review.selfRating ?? 3,
    achievements:       review.achievements ?? '',
    improvements:       review.improvements ?? '',
    goals:              review.goals ?? '',
  });

  // Manager review form state
  const [managerForm, setManagerForm] = useState({
    managerFeedback: review.managerFeedback ?? '',
    overallRating:   review.overallRating ?? 3,
    strengthsNote:   review.strengthsNote ?? '',
    developmentNote: review.developmentNote ?? '',
    ratings: COMPETENCIES.map(c => ({
      competency: c.key,
      score: review.ratings.find(r => r.competency === c.key)?.score ?? 3,
      comment: review.ratings.find(r => r.competency === c.key)?.comment ?? '',
    })),
  });

  const selfMut = useMutation({
    mutationFn: (d: SubmitSelfAssessmentDto) => reviewApi.submitSelfAssessment(review.id, d),
    onSuccess: () => {
      toast.success('Self-assessment submitted!');
      qc.invalidateQueries({ queryKey: ['myReviews'] });
      qc.invalidateQueries({ queryKey: ['reviewCycles'] });
      onClose();
    },
    onError: () => toast.error('Failed to submit self-assessment'),
  });

  const managerMut = useMutation({
    mutationFn: (d: SubmitManagerReviewDto) => reviewApi.submitManagerReview(review.id, d),
    onSuccess: () => {
      toast.success('Manager review submitted!');
      qc.invalidateQueries({ queryKey: ['teamReviews'] });
      qc.invalidateQueries({ queryKey: ['reviewCycles'] });
      onClose();
    },
    onError: () => toast.error('Failed to submit manager review'),
  });

  const canEditSelf    = !isManager && review.status === 'Pending' || review.status === 'SelfAssessment';
  const canEditManager = isManager  && review.status === 'SelfAssessment';
  const isReadOnly     = review.status === 'ManagerReview' || review.status === 'Completed';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onClose}>
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl max-h-[92vh]
        flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex-shrink-0">
          <div className="flex items-start gap-3 justify-between">
            <div className="flex items-center gap-3">
              <Avatar src={review.revieweePhoto} name={review.revieweeName} size="md" />
              <div>
                <p className="text-white font-bold">{review.revieweeName}</p>
                <p className="text-slate-400 text-xs">{review.revieweeRole}</p>
                <p className="text-slate-500 text-xs mt-0.5">
                  {review.cycleTitle} · {formatDate(review.cycleStart)} – {formatDate(review.cycleEnd)}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border
                ${STATUS_CFG[review.status].bg} ${STATUS_CFG[review.status].text}`}>
                {STATUS_CFG[review.status].label}
              </span>
              <button onClick={onClose} className="text-slate-500 hover:text-white text-xl">✕</button>
            </div>
          </div>

          {/* Overall ratings row */}
          {(review.selfRating || review.overallRating) && (
            <div className="flex gap-4 mt-3 pt-3 border-t border-slate-800">
              {review.selfRating && (
                <div className="flex items-center gap-2">
                  <span className="text-slate-500 text-xs">Self Rating:</span>
                  <RatingStars value={review.selfRating} readonly />
                </div>
              )}
              {review.overallRating && (
                <div className="flex items-center gap-2">
                  <span className="text-slate-500 text-xs">Manager Rating:</span>
                  <RatingStars value={review.overallRating} readonly />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-800 flex-shrink-0">
          {[
            { key: 'self',         label: 'Self Assessment' },
            { key: 'manager',      label: 'Manager Review'  },
            { key: 'competencies', label: 'Ratings'         },
          ].map(t => (
            <button key={t.key} onClick={() => setTab(t.key as typeof tab)}
              className={`px-5 py-3 text-sm font-medium transition border-b-2
                ${tab === t.key ? 'border-blue-500 text-white' : 'border-transparent text-slate-400 hover:text-white'}`}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">

          {/* SELF ASSESSMENT TAB */}
          {tab === 'self' && (
            <div className="space-y-4">
              {/* Editable if employee and status allows */}
              {!isManager && !isReadOnly ? (
                <>
                  <div>
                    <label className="text-xs text-slate-400 font-medium block mb-1">
                      Overall Self Rating *
                    </label>
                    <RatingStars
                      value={selfForm.selfRating}
                      onChange={v => setSelfForm(f => ({ ...f, selfRating: v }))}
                    />
                  </div>
                  {[
                    { key: 'selfAssessmentText', label: 'Self Assessment *', ph: 'Describe your overall performance this period…' },
                    { key: 'achievements',        label: 'Key Achievements',  ph: 'What went well? What are you proud of?' },
                    { key: 'improvements',        label: 'Areas to Improve',  ph: 'What could you have done better?' },
                    { key: 'goals',               label: 'Goals for Next Period', ph: 'What do you want to focus on next?' },
                  ].map(f => (
                    <div key={f.key}>
                      <label className="text-xs text-slate-400 font-medium block mb-1">{f.label}</label>
                      <textarea
                        value={(selfForm as any)[f.key]}
                        onChange={e => setSelfForm(s => ({ ...s, [f.key]: e.target.value }))}
                        rows={3}
                        placeholder={f.ph}
                        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5
                          text-sm text-slate-200 placeholder-slate-500 focus:outline-none
                          focus:ring-2 focus:ring-blue-500 resize-none"
                      />
                    </div>
                  ))}
                  <button
                    onClick={() => selfMut.mutate(selfForm)}
                    disabled={!selfForm.selfAssessmentText.trim() || selfMut.isPending}
                    className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40
                      text-white text-sm font-semibold rounded-xl transition">
                    {selfMut.isPending ? 'Submitting…' : 'Submit Self-Assessment'}
                  </button>
                </>
              ) : review.selfAssessmentText ? (
                // Read-only view
                <div className="space-y-4">
                  <div>
                    <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Self Rating</p>
                    <RatingStars value={review.selfRating ?? 0} readonly />
                  </div>
                  {[
                    { label: 'Self Assessment',    value: review.selfAssessmentText },
                    { label: 'Key Achievements',   value: review.achievements       },
                    { label: 'Areas to Improve',   value: review.improvements       },
                    { label: 'Goals Next Period',  value: review.goals              },
                  ].map(f => f.value && (
                    <div key={f.label}>
                      <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">{f.label}</p>
                      <p className="text-slate-300 text-sm bg-slate-800/40 rounded-xl p-3 whitespace-pre-wrap">
                        {f.value}
                      </p>
                    </div>
                  ))}
                  {review.selfSubmittedAt && (
                    <p className="text-slate-600 text-xs">
                      Submitted {formatDate(review.selfSubmittedAt)}
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-slate-600 text-sm italic text-center py-8">
                  {isManager ? 'Employee has not submitted their self-assessment yet.' : 'Complete your self-assessment above.'}
                </p>
              )}
            </div>
          )}

          {/* MANAGER REVIEW TAB */}
          {tab === 'manager' && (
            <div className="space-y-4">
              {isManager && canEditManager ? (
                <>
                  <div>
                    <label className="text-xs text-slate-400 font-medium block mb-1">
                      Overall Rating *
                    </label>
                    <RatingStars
                      value={managerForm.overallRating}
                      onChange={v => setManagerForm(f => ({ ...f, overallRating: v }))}
                    />
                  </div>
                  {[
                    { key: 'managerFeedback', label: 'Overall Feedback *',   ph: 'Your overall assessment of this employee…' },
                    { key: 'strengthsNote',   label: 'Strengths',            ph: 'What are their key strengths?' },
                    { key: 'developmentNote', label: 'Development Areas',    ph: 'What should they focus on developing?' },
                  ].map(f => (
                    <div key={f.key}>
                      <label className="text-xs text-slate-400 font-medium block mb-1">{f.label}</label>
                      <textarea
                        value={(managerForm as any)[f.key]}
                        onChange={e => setManagerForm(s => ({ ...s, [f.key]: e.target.value }))}
                        rows={3} placeholder={f.ph}
                        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5
                          text-sm text-slate-200 placeholder-slate-500 focus:outline-none
                          focus:ring-2 focus:ring-blue-500 resize-none"
                      />
                    </div>
                  ))}
                  <button
                    onClick={() => managerMut.mutate(managerForm)}
                    disabled={!managerForm.managerFeedback.trim() || managerMut.isPending}
                    className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40
                      text-white text-sm font-semibold rounded-xl transition">
                    {managerMut.isPending ? 'Submitting…' : 'Submit Manager Review'}
                  </button>
                </>
              ) : review.managerFeedback ? (
                <div className="space-y-4">
                  <div>
                    <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Overall Rating</p>
                    <RatingStars value={review.overallRating ?? 0} readonly />
                  </div>
                  {[
                    { label: 'Overall Feedback',   value: review.managerFeedback  },
                    { label: 'Strengths',           value: review.strengthsNote    },
                    { label: 'Development Areas',   value: review.developmentNote  },
                  ].map(f => f.value && (
                    <div key={f.label}>
                      <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">{f.label}</p>
                      <p className="text-slate-300 text-sm bg-slate-800/40 rounded-xl p-3 whitespace-pre-wrap">
                        {f.value}
                      </p>
                    </div>
                  ))}
                  {review.managerSubmittedAt && (
                    <p className="text-slate-600 text-xs">
                      Reviewed by {review.reviewerName} on {formatDate(review.managerSubmittedAt)}
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-slate-600 text-sm italic text-center py-8">
                  {isManager
                    ? review.status === 'Pending'
                      ? 'Waiting for employee to submit their self-assessment first.'
                      : 'Use this tab to submit your review.'
                    : 'Your manager has not submitted their review yet.'}
                </p>
              )}
            </div>
          )}

          {/* COMPETENCY RATINGS TAB */}
          {tab === 'competencies' && (
            <div className="space-y-5">
              {isManager && canEditManager ? (
                // Editable competency ratings
                <div className="space-y-4">
                  {COMPETENCIES.map((c, i) => (
                    <div key={c.key} className="bg-slate-800/40 rounded-xl p-4 border border-slate-700/50">
                      <div className="flex items-center gap-2 mb-2">
                        <span>{c.icon}</span>
                        <p className="text-slate-200 text-sm font-medium">{c.label}</p>
                      </div>
                      <RatingStars
                        value={managerForm.ratings[i].score}
                        onChange={v => setManagerForm(f => ({
                          ...f,
                          ratings: f.ratings.map((r, idx) => idx === i ? { ...r, score: v } : r),
                        }))}
                      />
                      <input
                        value={managerForm.ratings[i].comment}
                        onChange={e => setManagerForm(f => ({
                          ...f,
                          ratings: f.ratings.map((r, idx) => idx === i ? { ...r, comment: e.target.value } : r),
                        }))}
                        placeholder="Optional comment…"
                        className="w-full mt-2 bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5
                          text-xs text-slate-300 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                  ))}
                  <p className="text-slate-500 text-xs text-center">
                    Save ratings by clicking "Submit Manager Review" in the Manager Review tab.
                  </p>
                </div>
              ) : review.ratings.length > 0 ? (
                <CompetencyChart ratings={review.ratings} />
              ) : (
                <p className="text-slate-600 text-sm italic text-center py-8">
                  Competency ratings will appear here once the manager submits their review.
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── Create Cycle Modal ───────────────────────────────────────────────────────
const CreateCycleModal = ({
  allUsers, onClose,
}: { allUsers: { id: number; fullName: string }[]; onClose: () => void }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [form, setForm] = useState<CreateReviewCycleDto>({
    title: '', description: '', cycleType: 'Quarterly',
    startDate: '', endDate: '', selfAssessmentDueDate: '',
    revieweeIds: [],
  });
  const [search, setSearch] = useState('');

  const createMut = useMutation({
    mutationFn: (d: object) => reviewApi.createCycle(d),
    onSuccess: () => {
      toast.success('Review cycle created!');
      qc.invalidateQueries({ queryKey: ['reviewCycles'] });
      onClose();
    },
    onError: () => toast.error('Failed to create review cycle'),
  });

  const eligible = allUsers.filter(u =>
    u.id !== user?.id &&
    u.fullName.toLowerCase().includes(search.toLowerCase())
  );

  const toggle = (id: number) =>
    setForm(f => ({
      ...f,
      revieweeIds: f.revieweeIds.includes(id)
        ? f.revieweeIds.filter(x => x !== id)
        : [...f.revieweeIds, id],
    }));

  const handleSubmit = () => {
    if (!form.title.trim() || !form.startDate || !form.endDate) {
      toast.error('Title, start date and end date are required');
      return;
    }
    if (form.revieweeIds.length === 0) {
      toast.error('Select at least one employee to review');
      return;
    }
    createMut.mutate({
      ...form,
      selfAssessmentDueDate: form.selfAssessmentDueDate || undefined,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onClose}>
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg max-h-[92vh]
        flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>

        <div className="p-5 border-b border-slate-800 flex items-center justify-between flex-shrink-0">
          <h2 className="text-white font-bold">Create Review Cycle</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-white text-xl">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <div>
            <label className="text-xs text-slate-400 font-medium block mb-1">Title *</label>
            <input value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              placeholder="e.g. Q1 2025 Performance Review"
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5
                text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-400 font-medium block mb-1">Type</label>
              <select value={form.cycleType}
                onChange={e => setForm(f => ({ ...f, cycleType: e.target.value as CycleType }))}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5
                  text-sm text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500">
                {CYCLE_TYPES.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-400 font-medium block mb-1">
                Self-Assessment Due
              </label>
              <DatePicker value={form.selfAssessmentDueDate ?? ''}
                onChange={v => setForm(f => ({ ...f, selfAssessmentDueDate: v }))} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-400 font-medium block mb-1">Start Date *</label>
              <DatePicker value={form.startDate}
                onChange={v => setForm(f => ({ ...f, startDate: v }))} />
            </div>
            <div>
              <label className="text-xs text-slate-400 font-medium block mb-1">End Date *</label>
              <DatePicker value={form.endDate}
                onChange={v => setForm(f => ({ ...f, endDate: v }))} />
            </div>
          </div>

          <div>
            <label className="text-xs text-slate-400 font-medium block mb-1">Description</label>
            <textarea value={form.description ?? ''}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              rows={2} placeholder="Optional context for this review cycle…"
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5
                text-sm text-slate-200 placeholder-slate-500 focus:outline-none
                focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          <div>
            <label className="text-xs text-slate-400 font-medium block mb-1">
              Select Employees to Review{form.revieweeIds.length > 0 && ` (${form.revieweeIds.length} selected)`}
            </label>
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search employees…"
              className="w-full mb-2 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2
                text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <div className="max-h-40 overflow-y-auto space-y-1">
              {eligible.map(u => {
                const sel = form.revieweeIds.includes(u.id);
                return (
                  <div key={u.id} onClick={() => toggle(u.id)}
                    className={`flex items-center gap-2.5 px-3 py-2 rounded-xl cursor-pointer transition border
                      ${sel ? 'bg-blue-600/15 border-blue-500/30' : 'bg-slate-800/50 border-transparent hover:border-slate-600'}`}>
                    <div className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0
                      ${sel ? 'bg-blue-600 border-blue-600' : 'border-slate-600'}`}>
                      {sel && <span className="text-white text-[10px]">✓</span>}
                    </div>
                    <Avatar name={u.fullName} size="xs" />
                    <span className="text-slate-300 text-sm">{u.fullName}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="p-5 border-t border-slate-800 flex gap-3 flex-shrink-0">
          <button onClick={onClose}
            className="flex-1 py-2.5 bg-slate-800 text-slate-400 rounded-xl text-sm hover:text-white transition">
            Cancel
          </button>
          <button onClick={handleSubmit} disabled={createMut.isPending}
            className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40
              text-white text-sm font-semibold rounded-xl transition">
            {createMut.isPending ? 'Creating…' : 'Create Cycle'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Cycle Card ───────────────────────────────────────────────────────────────
const CycleCard = ({
  cycle, isManager, onClick,
}: { cycle: ReviewCycleDto; isManager: boolean; onClick: () => void }) => {
  const progress = cycle.totalReviews > 0
    ? Math.round((cycle.completedCount / cycle.totalReviews) * 100)
    : 0;

  return (
    <div onClick={onClick}
      className="bg-slate-900 border border-slate-800 rounded-2xl p-5 cursor-pointer
        hover:border-slate-600 transition-all">

      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="min-w-0">
          <p className="text-white font-semibold truncate">{cycle.title}</p>
          <p className="text-slate-500 text-xs mt-0.5">
            {cycle.cycleType} · {formatDate(cycle.startDate)} – {formatDate(cycle.endDate)}
          </p>
        </div>
        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border flex-shrink-0
          ${cycle.status === 'Active'
            ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30'
            : 'text-slate-400 bg-slate-700/40 border-slate-600/30'}`}>
          {cycle.status}
        </span>
      </div>

      {/* Employee: show my review status */}
      {!isManager && cycle.myReview && (
        <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border mb-3
          ${STATUS_CFG[cycle.myReview.status].bg}`}>
          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${STATUS_CFG[cycle.myReview.status].dot}`} />
          <span className={`text-xs font-medium ${STATUS_CFG[cycle.myReview.status].text}`}>
            My Review: {STATUS_CFG[cycle.myReview.status].label}
          </span>
          {cycle.myReview.overallRating && (
            <span className="ml-auto">
              <RatingStars value={cycle.myReview.overallRating} readonly />
            </span>
          )}
        </div>
      )}

      {/* Manager: show progress */}
      {isManager && (
        <>
          <div className="flex gap-3 mb-3 text-xs">
            {[
              { label: 'Pending',    count: cycle.pendingCount,       color: 'text-slate-400'   },
              { label: 'Self Done',  count: cycle.selfSubmittedCount, color: 'text-amber-400'   },
              { label: 'Completed',  count: cycle.completedCount,     color: 'text-emerald-400' },
            ].map(s => (
              <div key={s.label} className="flex-1 bg-slate-800/50 rounded-xl p-2 text-center">
                <p className={`font-bold text-lg ${s.color}`}>{s.count}</p>
                <p className="text-slate-600 text-[10px]">{s.label}</p>
              </div>
            ))}
          </div>
          {cycle.totalReviews > 0 && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-slate-600 text-xs">Progress</span>
                <span className="text-slate-400 text-xs">{progress}%</span>
              </div>
              <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 rounded-full transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}
        </>
      )}

      <p className="text-slate-600 text-xs mt-3">
        Created by {cycle.createdByName}
        {cycle.selfAssessmentDueDate && (
          <span> · Due {formatDate(cycle.selfAssessmentDueDate)}</span>
        )}
      </p>
    </div>
  );
};

// ─── Cycle Detail View ────────────────────────────────────────────────────────
const CycleDetailView = ({
  cycle, isManager, onBack,
}: { cycle: ReviewCycleDto; isManager: boolean; onBack: () => void }) => {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [selectedReview, setSelectedReview] = useState<PerformanceReviewDto | null>(null);

  const { data: teamReviews = [] } = useQuery<PerformanceReviewDto[]>({
    queryKey: ['teamReviews', cycle.id],
    queryFn: () => reviewApi.getTeamReviews(cycle.id).then(r => r.data),
    enabled: isManager,
  });

  const { data: myReview } = useQuery<PerformanceReviewDto | null>({
    queryKey: ['myReview', cycle.myReview?.id],
    queryFn: () => cycle.myReview
      ? reviewApi.getReview(cycle.myReview.id).then(r => r.data)
      : Promise.resolve(null),
    enabled: !isManager && !!cycle.myReview,
  });

  const closeMut = useMutation({
    mutationFn: () => reviewApi.closeCycle(cycle.id),
    onSuccess: () => { toast.success('Cycle closed'); qc.invalidateQueries({ queryKey: ['reviewCycles'] }); onBack(); },
    onError: () => toast.error('Failed to close cycle'),
  });

  const reviews = isManager ? teamReviews : (myReview ? [myReview] : []);

  return (
    <div>
      {/* Back + header */}
      <div className="flex items-center gap-3 mb-5">
        <button onClick={onBack}
          className="text-slate-400 hover:text-white transition text-sm flex items-center gap-1">
          ← Back
        </button>
        <div className="flex-1 min-w-0">
          <h2 className="text-white font-bold text-lg truncate">{cycle.title}</h2>
          <p className="text-slate-400 text-xs">
            {cycle.cycleType} · {formatDate(cycle.startDate)} – {formatDate(cycle.endDate)}
          </p>
        </div>
        {isManager && cycle.status === 'Active' && (
          <button
            onClick={() => closeMut.mutate()}
            disabled={closeMut.isPending}
            className="px-4 py-2 bg-slate-800 border border-slate-700 text-slate-300
              hover:text-white rounded-xl text-xs transition">
            Close Cycle
          </button>
        )}
      </div>

      {/* Reviews list */}
      <div className="space-y-3">
        {reviews.map(r => (
          <div key={r.id}
            onClick={() => setSelectedReview(r)}
            className="bg-slate-900 border border-slate-800 rounded-2xl p-4 cursor-pointer
              hover:border-slate-600 transition-all flex items-center gap-3">
            <Avatar src={r.revieweePhoto} name={r.revieweeName} size="sm" />
            <div className="flex-1 min-w-0">
              <p className="text-white font-medium text-sm">{r.revieweeName}</p>
              <p className="text-slate-500 text-xs">{r.revieweeRole}</p>
            </div>
            <div className="flex items-center gap-3 flex-shrink-0">
              {r.overallRating && <RatingStars value={r.overallRating} readonly />}
              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border
                ${STATUS_CFG[r.status].bg} ${STATUS_CFG[r.status].text}`}>
                {STATUS_CFG[r.status].label}
              </span>
              <span className="text-slate-600 text-sm">›</span>
            </div>
          </div>
        ))}
        {reviews.length === 0 && (
          <p className="text-slate-600 text-sm italic text-center py-10">
            No reviews in this cycle yet.
          </p>
        )}
      </div>

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

// ─── Main Page ────────────────────────────────────────────────────────────────
export const PerformanceReviewPage = () => {
  const { user } = useAuth();
  const isManager = user?.role === 'Manager' || user?.role === 'TeamLead';

  const [selectedCycle, setSelectedCycle] = useState<ReviewCycleDto | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [filterStatus, setFilterStatus] = useState<'all' | 'Active' | 'Closed'>('all');

  const { data: allUsersRaw } = useQuery({
    queryKey: ['users-simple'],
    queryFn: () => managerApi.getAllUsers().then(r => r.data),
    staleTime: 300_000,
    enabled: isManager,
  });
  const allUsers: { id: number; fullName: string }[] = allUsersRaw ?? [];

  const { data: cycles = [], isLoading } = useQuery<ReviewCycleDto[]>({
    queryKey: ['reviewCycles'],
    queryFn: () => reviewApi.getCycles().then(r => r.data),
    staleTime: 30_000,
  });

  const filtered = useMemo(() =>
    filterStatus === 'all' ? cycles : cycles.filter(c => c.status === filterStatus),
    [cycles, filterStatus]
  );

  const stats = useMemo(() => ({
    total:     cycles.length,
    active:    cycles.filter(c => c.status === 'Active').length,
    myPending: cycles.filter(c => c.myReview?.status === 'Pending').length,
    completed: cycles.filter(c => c.myReview?.status === 'ManagerReview').length,
  }), [cycles]);

  if (selectedCycle) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <CycleDetailView
          cycle={selectedCycle}
          isManager={isManager}
          onBack={() => setSelectedCycle(null)}
        />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Performance Reviews 🎯</h1>
          <p className="text-slate-400 text-sm mt-1">
            {isManager
              ? 'Create review cycles and provide feedback to your team'
              : 'Submit your self-assessments and view manager feedback'}
          </p>
        </div>
        {isManager && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500
              text-white text-sm font-semibold rounded-xl transition shadow-lg shadow-blue-500/20">
            + New Review Cycle
          </button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {(isManager ? [
          { label: 'Total Cycles',   value: stats.total,     color: 'text-white'        },
          { label: 'Active',         value: stats.active,    color: 'text-emerald-400'  },
          { label: 'Total Reviews',  value: cycles.reduce((n, c) => n + c.totalReviews, 0),    color: 'text-blue-400'  },
          { label: 'Completed',      value: cycles.reduce((n, c) => n + c.completedCount, 0),  color: 'text-violet-400'},
        ] : [
          { label: 'Total Cycles',   value: stats.total,     color: 'text-white'       },
          { label: 'Active',         value: stats.active,    color: 'text-emerald-400' },
          { label: 'Action Needed',  value: stats.myPending, color: 'text-amber-400'   },
          { label: 'Reviews Received', value: stats.completed, color: 'text-blue-400'  },
        ]).map(s => (
          <div key={s.label} className="bg-slate-900 border border-slate-800 rounded-2xl px-4 py-3">
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-slate-500 text-xs mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filter */}
      <div className="flex items-center gap-2 mb-4">
        <div className="flex rounded-xl overflow-hidden border border-slate-700">
          {(['all', 'Active', 'Closed'] as const).map(s => (
            <button key={s} onClick={() => setFilterStatus(s)}
              className={`px-4 py-1.5 text-xs font-medium transition
                ${filterStatus === s ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'}`}>
              {s === 'all' ? 'All' : s}
            </button>
          ))}
        </div>
      </div>

      {/* Cycles grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-slate-900 border border-slate-800 rounded-2xl h-44 animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed border-slate-800 rounded-2xl">
          <div className="text-4xl mb-3">🎯</div>
          <p className="text-slate-300 font-semibold">No review cycles yet</p>
          <p className="text-slate-500 text-sm mt-1">
            {isManager ? 'Create your first review cycle to get started' : 'Your manager will create a review cycle for you'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {filtered.map(c => (
            <CycleCard
              key={c.id}
              cycle={c}
              isManager={isManager}
              onClick={() => setSelectedCycle(c)}
            />
          ))}
        </div>
      )}

      {showCreateModal && (
        <CreateCycleModal allUsers={allUsers} onClose={() => setShowCreateModal(false)} />
      )}
    </div>
  );
};