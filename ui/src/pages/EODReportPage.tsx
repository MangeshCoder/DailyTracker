import React, { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import axios from 'axios';
import {
  FileText,
  Sparkles,
  CheckCircle2,
  Clock,
  AlertCircle,
  RotateCcw,
  Send,
  Calendar,
  ShieldCheck,
  Check
} from 'lucide-react';
import { eodApi, aiChatApi } from '../services/api';
import { CreateEODReportDto } from '../types';
import { useToast } from '../context/ToastContext';
import { PageHeader, Card, CardContent, StatusBadge } from '../components/ui';

const MOODS = [
  { value: 'Great', emoji: '🚀', label: 'Great', desc: 'Productive Day' },
  { value: 'Good', emoji: '😊', label: 'Good', desc: 'On Track' },
  { value: 'Okay', emoji: '😐', label: 'Okay', desc: 'Normal Day' },
  { value: 'Tired', emoji: '😴', label: 'Tired', desc: 'Exhausted' },
  { value: 'Stressed', emoji: '😰', label: 'Stressed', desc: 'Challenging' },
];

export const EODReportPage: React.FC = () => {
  const [form, setForm] = useState<CreateEODReportDto>({
    whatWasDone: '',
    blockers: '',
    planForTomorrow: '',
    learnings: '',
    moodRating: 'Good',
  });

  const { toast } = useToast();
  const [isGenerating, setIsGenerating] = useState(false);

  const { data: todayReport, isLoading: isFetching, refetch } = useQuery({
    queryKey: ['eodToday'],
    queryFn: () => eodApi.getToday().then(r => r.data),
  });

  useEffect(() => {
    const hasPendingAiDraft = sessionStorage.getItem('pending_eod_draft');
    if (todayReport && !hasPendingAiDraft) {
      setForm({
        whatWasDone: todayReport.whatWasDone,
        blockers: todayReport.blockers || '',
        planForTomorrow: todayReport.planForTomorrow || '',
        learnings: todayReport.learnings || '',
        moodRating: todayReport.moodRating,
      });
    }
  }, [todayReport]);

  useEffect(() => {
    const savedDraft = sessionStorage.getItem('pending_eod_draft');
    if (savedDraft) {
      try {
        const parsed = JSON.parse(savedDraft);
        setForm((prev) => ({
          ...prev,
          whatWasDone: parsed.whatWasDone || prev.whatWasDone,
          blockers: parsed.blockers || prev.blockers,
          planForTomorrow: parsed.planForTomorrow || prev.planForTomorrow,
          learnings: parsed.learnings || prev.learnings,
          moodRating: parsed.moodRating || prev.moodRating,
        }));
        toast.success('✨ AI EOD Draft applied to form!');
        sessionStorage.removeItem('pending_eod_draft');
      } catch {
        // Ignore
      }
    }
  }, [toast]);

  const submit = useMutation({
    mutationFn: () => eodApi.submit(form),
    onSuccess: () => {
      toast.success('✅ EOD report submitted! Great work today 🎉');
      refetch();
    },
    onError: (error: unknown) => {
      let message = 'Failed to submit EOD report.';
      if (axios.isAxiosError(error)) {
        message =
          error.response?.data?.message ||
          error.response?.data?.title ||
          error.message;
      } else if (error instanceof Error) {
        message = error.message;
      }
      toast.error(`${message}`);
    },
  });

  const isSubmitting = submit.isPending;
  const isUpdating = !!todayReport;
  const isReviewed = !!todayReport?.isReviewedByManager;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.whatWasDone.trim()) {
      toast.error('Please specify what you accomplished today.');
      return;
    }
    submit.mutate();
  };

  const formatISTTime = (dateString?: string) => {
    if (!dateString) return '--:--';
    const utcDate = new Date(dateString + 'Z');
    return utcDate.toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
      timeZone: 'Asia/Kolkata',
    });
  };

  const handleClearForm = () => {
    setForm({
      whatWasDone: '',
      blockers: '',
      planForTomorrow: '',
      learnings: '',
      moodRating: 'Good',
    });
    toast.info('Form fields cleared.');
  };

  const handleAiGenerate = async () => {
    setIsGenerating(true);
    try {
      const res = await aiChatApi.getEodDraft();
      if (res.data.success && res.data.draft) {
        setForm((prev) => ({
          ...prev,
          whatWasDone: res.data.draft.whatWasDone || prev.whatWasDone,
          blockers: res.data.draft.blockers || prev.blockers,
          planForTomorrow: res.data.draft.planForTomorrow || prev.planForTomorrow,
          learnings: res.data.draft.learnings || prev.learnings,
          moodRating: res.data.draft.moodRating || prev.moodRating,
        }));
        toast.success('✨ Form populated with today’s activities & tasks!');
      } else {
        toast.error(res.data.message || 'Could not generate draft. Please ensure you are checked in.');
      }
    } catch {
      toast.error('Failed to generate AI EOD draft.');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
      <PageHeader
        title="End of Day Report"
        description="Reflect on your accomplishments, log blockers, and define tomorrow's focus in under 2 minutes."
        badge={{
          label: todayReport ? (isReviewed ? 'Manager Reviewed' : 'Submitted Today') : 'Pending Today',
          variant: todayReport ? (isReviewed ? 'purple' : 'emerald') : 'amber',
          icon: <FileText className="w-3.5 h-3.5" />,
        }}
        breadcrumbs={[
          { label: 'Workspace', href: '/' },
          { label: 'EOD Report' },
        ]}
        actions={
          <div className="flex items-center gap-2">
            {!isReviewed && (
              <>
                <button
                  type="button"
                  onClick={handleClearForm}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition"
                  title="Clear inputs"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reset</span>
                </button>

                <button
                  type="button"
                  onClick={handleAiGenerate}
                  disabled={isGenerating}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50 shadow-md shadow-blue-500/20 active:scale-95 transition-all"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{isGenerating ? 'Drafting with AI...' : 'Auto-Generate Draft'}</span>
                </button>
              </>
            )}
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        <div className="lg:col-span-2 space-y-5">
          {isUpdating && !isReviewed && (
            <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="text-sm font-bold text-emerald-700 dark:text-emerald-400">
                  Report Submitted for Today
                </h4>
                <p className="text-xs text-emerald-600/90 dark:text-emerald-400/80 mt-0.5 leading-relaxed">
                  You can modify and update your answers at any point until your manager completes the formal review.
                </p>
              </div>
            </div>
          )}

          {isReviewed && (
            <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/25 flex items-start gap-3">
              <ShieldCheck className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="text-sm font-bold text-amber-700 dark:text-amber-400">
                  Manager Review Completed & Locked
                </h4>
                <p className="text-xs text-amber-600/90 dark:text-amber-400/80 mt-0.5 leading-relaxed">
                  Your supervisor has evaluated this report. Submissions are now archived in read-only mode.
                </p>
              </div>
            </div>
          )}

          <Card>
            <CardContent className="p-5 sm:p-7">
              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                      What did you accomplish today? <span className="text-rose-500">*</span>
                    </label>
                    <span className="text-xs text-slate-400">{form.whatWasDone.length} / 500</span>
                  </div>
                  <textarea
                    rows={4}
                    value={form.whatWasDone}
                    maxLength={500}
                    disabled={isReviewed}
                    onChange={(e) => setForm({ ...form, whatWasDone: e.target.value })}
                    placeholder="Key features deployed, bugs resolved, customer meetings attended, or pull requests submitted..."
                    className="w-full px-4 py-3 rounded-xl text-sm bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition resize-none disabled:opacity-60"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                      Any blockers or bottlenecks?
                    </label>
                    <span className="text-xs text-slate-400">Optional</span>
                  </div>
                  <textarea
                    rows={3}
                    value={form.blockers || ''}
                    disabled={isReviewed}
                    onChange={(e) => setForm({ ...form, blockers: e.target.value })}
                    placeholder="Dependencies on other teams, CI/CD pipeline failures, specification ambiguities..."
                    className="w-full px-4 py-3 rounded-xl text-sm bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition resize-none disabled:opacity-60"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                      Plan & Focus for Tomorrow
                    </label>
                    <span className="text-xs text-slate-400">Optional</span>
                  </div>
                  <textarea
                    rows={3}
                    value={form.planForTomorrow || ''}
                    disabled={isReviewed}
                    onChange={(e) => setForm({ ...form, planForTomorrow: e.target.value })}
                    placeholder="Top 3 priorities, meetings scheduled, components to deliver..."
                    className="w-full px-4 py-3 rounded-xl text-sm bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition resize-none disabled:opacity-60"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                      Key Takeaways & Learnings
                    </label>
                    <span className="text-xs text-slate-400">Optional</span>
                  </div>
                  <textarea
                    rows={3}
                    value={form.learnings || ''}
                    disabled={isReviewed}
                    onChange={(e) => setForm({ ...form, learnings: e.target.value })}
                    placeholder="New architectural insight, technology tip, or process improvement..."
                    className="w-full px-4 py-3 rounded-xl text-sm bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition resize-none disabled:opacity-60"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-3">
                    How was your work energy today?
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                    {MOODS.map((mood) => {
                      const isSelected = form.moodRating === mood.value;
                      return (
                        <button
                          key={mood.value}
                          type="button"
                          disabled={isReviewed}
                          onClick={() => setForm({ ...form, moodRating: mood.value })}
                          className={`p-3 rounded-2xl border-2 flex flex-col items-center justify-center transition-all ${
                            isSelected
                              ? 'border-blue-600 bg-blue-50/50 dark:bg-blue-500/10 shadow-xs scale-102'
                              : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 hover:border-slate-300 dark:hover:border-slate-700'
                          } ${isReviewed ? 'opacity-60 cursor-not-allowed' : ''}`}
                        >
                          <span className="text-2xl sm:text-3xl mb-1">{mood.emoji}</span>
                          <span
                            className={`text-xs font-bold ${
                              isSelected
                                ? 'text-blue-600 dark:text-blue-400'
                                : 'text-slate-800 dark:text-slate-200'
                            }`}
                          >
                            {mood.label}
                          </span>
                          <span className="text-[10px] text-slate-400 truncate max-w-full">
                            {mood.desc}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {!isReviewed && (
                  <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
                    <button
                      type="submit"
                      disabled={isSubmitting || !form.whatWasDone.trim()}
                      className="w-full py-3.5 px-4 rounded-xl font-semibold text-sm text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-blue-500/20 active:scale-[0.99] transition-all flex items-center justify-center gap-2"
                    >
                      {isSubmitting ? (
                        <>
                          <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          <span>Submitting EOD Report...</span>
                        </>
                      ) : (
                        <>
                          <Send className="w-4 h-4" />
                          <span>
                            {isUpdating ? 'Update Today’s Report' : 'Submit End of Day Report'}
                          </span>
                        </>
                      )}
                    </button>
                  </div>
                )}
              </form>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4 lg:sticky lg:top-6">
          <Card>
            <CardContent className="p-5 sm:p-6 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-blue-500" />
                  <span>Today's EOD Status</span>
                </h3>
                <StatusBadge
                  status={todayReport ? (isReviewed ? 'Reviewed' : 'Completed') : 'Pending'}
                  size="xs"
                />
              </div>

              {isFetching ? (
                <div className="flex items-center justify-center py-8">
                  <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : todayReport ? (
                <div className="space-y-3.5 text-xs">
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60">
                    <p className="text-slate-500 dark:text-slate-400 font-medium">Logged Timestamp</p>
                    <p className="text-slate-900 dark:text-white font-bold text-sm mt-0.5">
                      {formatISTTime(todayReport.submittedAt)} IST
                    </p>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60">
                    <p className="text-slate-500 dark:text-slate-400 font-medium">Work Energy Rating</p>
                    <p className="text-slate-900 dark:text-white font-bold text-sm mt-0.5 flex items-center gap-1.5">
                      <span>{MOODS.find(m => m.value === todayReport.moodRating)?.emoji || '✨'}</span>
                      <span>{todayReport.moodRating}</span>
                    </p>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60">
                    <p className="text-slate-500 dark:text-slate-400 font-medium">Review Status</p>
                    <p className="text-slate-900 dark:text-white font-bold text-sm mt-0.5 flex items-center gap-1.5">
                      {isReviewed ? (
                        <>
                          <Check className="w-4 h-4 text-emerald-500" />
                          <span>Reviewed by Supervisor</span>
                        </>
                      ) : (
                        <>
                          <Clock className="w-4 h-4 text-amber-500" />
                          <span>Pending Supervisor Review</span>
                        </>
                      )}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="text-center py-6">
                  <div className="w-10 h-10 rounded-full bg-amber-500/10 text-amber-500 mx-auto flex items-center justify-center mb-2">
                    <AlertCircle className="w-5 h-5" />
                  </div>
                  <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                    No Report Filed Today
                  </p>
                  <p className="text-[11px] text-slate-400 mt-1 max-w-[200px] mx-auto">
                    Fill in your deliverables on the left and submit before ending your workday.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-blue-50/50 to-indigo-50/50 dark:from-slate-900/60 dark:to-blue-950/20">
            <CardContent className="p-5 space-y-2.5">
              <h4 className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Pro Tip</span>
              </h4>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Click <strong>"Auto-Generate Draft"</strong> to instantly convert your logged tasks and attendance punches into a structured EOD report.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};
export default EODReportPage;