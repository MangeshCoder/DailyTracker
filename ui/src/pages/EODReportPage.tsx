import { useQuery, useMutation } from '@tanstack/react-query';
import { eodApi, aiChatApi  } from '../services/api';
import { CreateEODReportDto, EODReport } from '../types';
import { useToast } from '../context/ToastContext';
import { CheckCircle, Clock, AlertCircle } from 'lucide-react';
import { useState, useEffect } from 'react';
import axios from 'axios';

const MOODS = [
  { value: 'Great', emoji: '🚀', label: 'Great - Productive Day!' },
  { value: 'Good', emoji: '😊', label: 'Good - On Track' },
  { value: 'Okay', emoji: '😐', label: 'Okay - Normal Day' },
  { value: 'Tired', emoji: '😴', label: 'Tired - Exhausted' },
  { value: 'Stressed', emoji: '😰', label: 'Stressed - Challenging' },
];

export const EODReportPage = () => {
  const [form, setForm] = useState<CreateEODReportDto>({
    whatWasDone: '',
    blockers: '',
    planForTomorrow: '',
    learnings: '',
    moodRating: 'Good',
  });

  const { toast } = useToast();

  // Fetch today's EOD report
  const { data: todayReport, isLoading: isFetching, refetch } = useQuery({
    queryKey: ['eodToday'],
    queryFn: () => eodApi.getToday().then(r => r.data),
  });

    useEffect(() => {
    if (todayReport) {
        setForm({
        whatWasDone: todayReport.whatWasDone,
        blockers: todayReport.blockers || '',
        planForTomorrow: todayReport.planForTomorrow || '',
        learnings: todayReport.learnings || '',
        moodRating: todayReport.moodRating,
        });
    }
    }, [todayReport]);

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
      toast.error('What you accomplished is required');
      return;
    }
    submit.mutate();
  };

  const formatISTTime = (dateString?: string) => {
    if (!dateString) return "--:--";

    // Force treat backend time as UTC
    const utcDate = new Date(dateString + "Z");

    return utcDate.toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
      timeZone: "Asia/Kolkata",
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
  const [isGenerating, setIsGenerating] = useState(false);

  // Check if session storage has an AI draft passed from AiChatWidget
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
        toast.success('✨ Form filled with today’s accomplishments and tasks!');
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
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white">📝 End of Day Report</h1>
          <p className="text-slate-400 text-sm mt-2">
            Reflect on your day and plan for tomorrow — takes 2 minutes
          </p>
        </div>
        {!isReviewed && (
          <button
            type="button"
            onClick={handleAiGenerate}
            disabled={isGenerating}
            className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-sm font-semibold px-4 py-2.5 rounded-xl shadow-lg shadow-blue-500/20 active:scale-95 transition-all"
          >
            <span>✨</span>
            <span>{isGenerating ? 'Generating Draft...' : 'Auto-Generate with AI'}</span>
          </button>     
        )}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Form - Left */}
        <div className="lg:col-span-2 space-y-6">
          {/* Status Banner */}
            {isUpdating && !isReviewed && (
            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-4">
                <div className="flex items-center gap-3">
                <CheckCircle className="text-emerald-400" size={20} />
                <div>
                    <p className="text-emerald-400 font-medium">Already Submitted Today</p>
                    <p className="text-emerald-300 text-xs mt-1">
                    You can update your report anytime before review
                    </p>
                </div>
                </div>
            </div>
            )}

            {isReviewed && (
            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-2xl p-4">
                <div className="flex items-center gap-3">
                <Clock className="text-yellow-400" size={20} />
                <div>
                    <p className="text-yellow-400 font-medium">Manager Reviewed</p>
                    <p className="text-yellow-300 text-xs mt-1">
                    This report has been reviewed and is now locked.
                    </p>
                </div>
                </div>
            </div>
            )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Accomplishments */}
                  <button
                  type="button"
                  onClick={handleClearForm}
                  className="text-xs text-slate-400 hover:text-amber-400 px-2.5 py-1 rounded-lg border border-slate-700 hover:border-amber-500/50 transition"
                  title="Clear all inputs"
                >
                  🧹 Clear Form
                </button>
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
              <label className="block text-sm font-semibold text-white mb-3">
                ✅ What did you accomplish today? <span className="text-red-400">*</span>
              </label>
              <textarea
                value={form.whatWasDone}
                onChange={(e) => setForm({ ...form, whatWasDone: e.target.value })}
                placeholder="List your key accomplishments, features completed, bugs fixed, etc..."
                rows={4}
                disabled={isReviewed}
                className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
              <p className="text-xs text-slate-500 mt-2">
                {form.whatWasDone.length} / 500 characters
              </p>
            </div>

            {/* Blockers */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
              <label className="block text-sm font-semibold text-white mb-3">
                🚫 Any blockers or issues?
              </label>
              <textarea
                value={form.blockers || ''}
                onChange={(e) => setForm({ ...form, blockers: e.target.value })}
                placeholder="What blocked you today? Any bugs, dependencies, or challenges..."
                rows={3}
                disabled={isReviewed}
                className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>

            {/* Plan for Tomorrow */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
              <label className="block text-sm font-semibold text-white mb-3">
                📋 Plan for tomorrow?
              </label>
              <textarea
                value={form.planForTomorrow || ''}
                onChange={(e) => setForm({ ...form, planForTomorrow: e.target.value })}
                placeholder="What will you work on tomorrow? What are your priorities..."
                rows={3}
                disabled={isReviewed}
                className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>

            {/* Learnings */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
              <label className="block text-sm font-semibold text-white mb-3">
                💡 Learnings?
              </label>
              <textarea
                value={form.learnings || ''}
                onChange={(e) => setForm({ ...form, learnings: e.target.value })}
                placeholder="Something new you learned today, best practices, insights..."
                rows={3}
                disabled={isReviewed}
                className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>

            {/* Mood Selector */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
              <label className="block text-sm font-semibold text-white mb-4">
                😊 How was your mood today?
              </label>
              <div className="grid grid-cols-5 gap-2">
                {MOODS.map((mood) => (
                    <button
                    key={mood.value}
                    type="button"
                    disabled={isReviewed}
                    onClick={() => setForm({ ...form, moodRating: mood.value })}
                    className={`flex flex-col items-center justify-center py-4 rounded-xl border-2 transition ${
                        form.moodRating === mood.value
                        ? 'border-blue-500 bg-blue-500/20'
                        : 'border-slate-700 bg-slate-800 hover:border-slate-600'
                    } ${isReviewed ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                    <span className="text-3xl mb-1">{mood.emoji}</span>
                    <span className="text-xs text-slate-400">{mood.label.split(' ')[0]}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Submit Buttons */}
            <div className="flex gap-3">
              <button
                type="submit"
                disabled={isSubmitting || !form.whatWasDone.trim() || isReviewed}
                className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition flex items-center justify-center gap-2"
              >
                {isSubmitting && (
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                )}
                {isSubmitting
                  ? 'Submitting...'
                  : isUpdating
                  ? '📝 Update Report'
                  : '✅ Submit Report'}
              </button>
            </div>
          </form>
        </div>

        {/* Info Box - Right Sidebar */}
        <div className="lg:col-span-1">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 sticky top-6">
            <h3 className="text-sm font-semibold text-white mb-4">📋 Today's Status</h3>

            {isFetching ? (
              <div className="flex items-center justify-center h-20">
                <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : todayReport ? (
              <div className="space-y-3">
                <div>
                  <p className="text-xs text-slate-400 mb-1">Status</p>
                  <p className="text-emerald-400 font-semibold text-sm">✅ Submitted</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 mb-1">Submitted At</p>
                  <p className="text-white text-sm">
                    {formatISTTime(todayReport.submittedAt)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 mb-1">Mood</p>
                  <p className="text-white text-sm">
                    {todayReport.moodRating}
                  </p>
                </div>
              </div>
            ) : (
              <div className="text-center py-6">
                <AlertCircle className="mx-auto mb-2 text-amber-400" size={24} />
                <p className="text-slate-300 text-xs">No report submitted yet</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};