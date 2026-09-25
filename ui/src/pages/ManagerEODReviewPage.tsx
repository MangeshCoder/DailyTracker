import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { eodApi } from '../services/api';
import { EODReport } from '../types';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/Authcontext';
import { PageHeader } from '../components/ui/PageHeader';
import { StatCard } from '../components/ui/StatCard';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { StatusBadge } from '../components/ui/StatusBadge';
import {
  ClipboardCheck,
  Clock,
  CheckCircle2,
  AlertTriangle,
  MessageSquare,
  Search,
  Filter,
  Smile,
  Send,
  Sparkles,
  ChevronDown,
  ChevronUp,
  ShieldAlert,
  Calendar,
  User,
  Check,
  X
} from 'lucide-react';

const QUICK_FEEDBACK_TEMPLATES = [
  'Great work! Approved without changes.',
  'Well structured report. Keep up the high velocity!',
  'Please connect with the team on blockers discussed.',
  'Good progress. Let us sync tomorrow during standup.',
  'Reviewed and acknowledged.',
];

const MOOD_DATA: Record<string, { emoji: string; label: string; bg: string; text: string }> = {
  Great: { emoji: '🚀', label: 'Great', bg: 'bg-emerald-500/10 dark:bg-emerald-500/15', text: 'text-emerald-700 dark:text-emerald-300 border-emerald-500/25' },
  Good: { emoji: '😊', label: 'Good', bg: 'bg-blue-500/10 dark:bg-blue-500/15', text: 'text-blue-700 dark:text-blue-300 border-blue-500/25' },
  Okay: { emoji: '😐', label: 'Okay', bg: 'bg-amber-500/10 dark:bg-amber-500/15', text: 'text-amber-700 dark:text-amber-300 border-amber-500/25' },
  Tired: { emoji: '😴', label: 'Tired', bg: 'bg-purple-500/10 dark:bg-purple-500/15', text: 'text-purple-700 dark:text-purple-300 border-purple-500/25' },
  Stressed: { emoji: '😰', label: 'Stressed', bg: 'bg-rose-500/10 dark:bg-rose-500/15', text: 'text-rose-700 dark:text-rose-300 border-rose-500/25' },
};

function formatISTDate(dateString?: string) {
  if (!dateString) return '--';
  const d = new Date(dateString.endsWith('Z') ? dateString : dateString + 'Z');
  return isNaN(d.getTime())
    ? dateString
    : d.toLocaleDateString('en-IN', {
        weekday: 'short',
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
}

export const ManagerEODReviewPage: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [selectedReport, setSelectedReport] = useState<EODReport | null>(null);
  const [reviewComment, setReviewComment] = useState('');
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'reviewed'>('all');
  const [hasBlockersOnly, setHasBlockersOnly] = useState(false);

  // Fetch pending / all reviewable EOD reports
  const { data: reports = [], isLoading, refetch } = useQuery<EODReport[]>({
    queryKey: ['eodPending'],
    queryFn: () => eodApi.getPending().then((r) => r.data),
  });

  // Review mutation
  const reviewMutation = useMutation({
    mutationFn: (data: { reportId: number; comment: string }) =>
      eodApi.review(data.reportId, { managerComment: data.comment }),
    onSuccess: () => {
      toast.success('EOD report successfully audited and feedback sent! 🎉');
      setSelectedReport(null);
      setReviewComment('');
      qc.invalidateQueries({ queryKey: ['eodPending'] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to review EOD report');
    },
  });

  const handleReview = () => {
    if (!selectedReport) return;
    if (!reviewComment.trim()) {
      toast.error('Please enter a feedback or review note');
      return;
    }
    reviewMutation.mutate({
      reportId: selectedReport.id,
      comment: reviewComment.trim(),
    });
  };

  // Metrics
  const totalReports = reports.length;
  const reviewedCount = reports.filter((r) => r.isReviewedByManager).length;
  const pendingCount = reports.filter((r) => !r.isReviewedByManager).length;
  const blockersCount = reports.filter((r) => Boolean(r.blockers && r.blockers.trim().length > 0)).length;

  // Filtered reports
  const filteredReports = useMemo(() => {
    return reports.filter((r) => {
      // Status filter
      if (statusFilter === 'pending' && r.isReviewedByManager) return false;
      if (statusFilter === 'reviewed' && !r.isReviewedByManager) return false;

      // Blockers toggle
      if (hasBlockersOnly && (!r.blockers || !r.blockers.trim())) return false;

      // Text query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = r.userName?.toLowerCase().includes(q);
        const matchesWork = r.whatWasDone?.toLowerCase().includes(q);
        const matchesBlockers = r.blockers?.toLowerCase().includes(q);
        const matchesPlan = r.planForTomorrow?.toLowerCase().includes(q);
        return matchesName || matchesWork || matchesBlockers || matchesPlan;
      }
      return true;
    });
  }, [reports, statusFilter, hasBlockersOnly, searchQuery]);

  if (!user || (user.role !== 'Manager' && user.role !== 'TeamLead')) {
    return (
      <div className="p-6 max-w-xl mx-auto my-12">
        <Card className="border-rose-200 dark:border-rose-900/60 shadow-md">
          <CardContent className="p-8 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-500 mx-auto flex items-center justify-center">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Supervisor Access Required
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
              This auditing interface is restricted to Department Managers and Team Leads to review team daily reports.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* ── Page Header ── */}
      <PageHeader
        title="Team EOD Report Review"
        description="Audit daily employee submissions, evaluate achievements, unblock critical issues, and supply constructive feedback."
        breadcrumbs={[
          { label: 'Workspace', href: '/' },
          { label: 'Management' },
          { label: 'EOD Reviews' },
        ]}
        badge={{ label: 'Supervisor Oversight Active', variant: 'purple' }}
        actions={
          <button
            type="button"
            onClick={() => refetch()}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition cursor-pointer shadow-sm"
          >
            <Clock className="w-4 h-4 text-blue-500" />
            <span>Refresh Queue</span>
          </button>
        }
      />

      {/* ── KPI Stat Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Reports"
          value={totalReports}
          subtitle="Cumulative daily logs"
          icon={ClipboardCheck}
          color="blue"
        />
        <StatCard
          title="Awaiting Review"
          value={pendingCount}
          subtitle="Requires supervisor sign-off"
          icon={Clock}
          color="amber"
        />
        <StatCard
          title="Audited Reports"
          value={reviewedCount}
          subtitle="Feedback provided"
          icon={CheckCircle2}
          color="emerald"
        />
        <StatCard
          title="Blockers Flagged"
          value={blockersCount}
          subtitle="Submissions needing assistance"
          icon={AlertTriangle}
          color="rose"
        />
      </div>

      {/* ── Search & Filter Controls ── */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white/70 dark:bg-slate-900/60 p-3 rounded-2xl border border-slate-200/80 dark:border-slate-800 backdrop-blur-sm">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by employee name, tasks, blockers, or tomorrow's plans..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white text-xs sm:text-sm rounded-xl pl-9 pr-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex gap-1 bg-slate-100 dark:bg-slate-900 p-1 rounded-xl border border-slate-200/80 dark:border-slate-800">
            {(['all', 'pending', 'reviewed'] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                  statusFilter === s
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {s === 'all' ? 'All' : s === 'pending' ? '⏳ Pending' : '✅ Reviewed'}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setHasBlockersOnly(!hasBlockersOnly)}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition cursor-pointer flex items-center gap-1.5 ${
              hasBlockersOnly
                ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30 ring-2 ring-rose-500/20'
                : 'bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:border-slate-300'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>With Blockers</span>
          </button>
        </div>
      </div>

      {/* ── Loading State ── */}
      {isLoading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl h-28 animate-pulse"
            />
          ))}
        </div>
      )}

      {/* ── Empty State ── */}
      {!isLoading && filteredReports.length === 0 && (
        <Card className="border-slate-200/80 dark:border-slate-800">
          <CardContent className="text-center py-20 text-slate-400 space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-500 mx-auto flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              {reports.length === 0 ? 'All Caught Up!' : 'No Matching Reports Found'}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
              {reports.length === 0
                ? 'Every submitted EOD report has been reviewed and acknowledged.'
                : 'Try adjusting your search keywords or clearing active filters.'}
            </p>
          </CardContent>
        </Card>
      )}

      {/* ── Reports List ── */}
      <div className="space-y-4">
        {filteredReports.map((report) => {
          const isExpanded = expandedId === report.id;
          const mood = MOOD_DATA[report.moodRating] ?? MOOD_DATA.Okay;
          const hasBlocker = Boolean(report.blockers && report.blockers.trim().length > 0);
          const isBeingReviewed = selectedReport?.id === report.id;

          return (
            <Card
              key={report.id}
              className={`border transition-all duration-200 overflow-hidden shadow-sm ${
                hasBlocker && !report.isReviewedByManager
                  ? 'border-rose-300/80 dark:border-rose-900/60 shadow-rose-500/5'
                  : 'border-slate-200/80 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700/80'
              }`}
            >
              {/* Header / Summary Bar */}
              <div
                onClick={() => setExpandedId(isExpanded ? null : report.id)}
                className="p-4 sm:p-5 cursor-pointer hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition flex items-center justify-between gap-4"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center text-sm font-bold shadow-sm shadow-blue-500/20 flex-shrink-0">
                    {report.userName.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-slate-900 dark:text-white text-sm sm:text-base truncate">
                        {report.userName}
                      </span>
                      {hasBlocker && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-600 dark:text-rose-400 bg-rose-500/10 border border-rose-500/20 px-2 py-0.5 rounded-full">
                          <AlertTriangle className="w-3 h-3" />
                          <span>Blocker Reported</span>
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2 mt-0.5">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-slate-400" />
                        {new Date(report.reportDate).toLocaleDateString('en-IN', {
                          weekday: 'short',
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </span>
                      <span>·</span>
                      <span>Submitted: {formatISTDate(report.submittedAt)}</span>
                    </p>
                  </div>
                </div>

                {/* Right badges & toggle */}
                <div className="flex items-center gap-3 flex-shrink-0">
                  {/* Mood Badge */}
                  <div
                    className={`hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-semibold border ${mood.bg} ${mood.text}`}
                    title={`Self-Reported Mood: ${mood.label}`}
                  >
                    <span>{mood.emoji}</span>
                    <span>{mood.label}</span>
                  </div>

                  {/* Status Badge */}
                  <StatusBadge
                    status={report.isReviewedByManager ? 'Approved' : 'Pending'}
                    className={report.isReviewedByManager ? '!bg-emerald-500/10 !text-emerald-600 dark:!text-emerald-400 !border-emerald-500/20' : ''}
                  />

                  <div className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition">
                    {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                  </div>
                </div>
              </div>

              {/* Collapsed Preview snippet if not expanded */}
              {!isExpanded && (
                <div className="px-5 pb-4 pt-0 text-xs text-slate-600 dark:text-slate-400 line-clamp-1 border-t border-slate-100 dark:border-slate-800/80 pt-2 bg-slate-50/30 dark:bg-slate-900/20">
                  <span className="font-semibold text-slate-700 dark:text-slate-300">Accomplished:</span> {report.whatWasDone}
                </div>
              )}

              {/* Expanded Details */}
              {isExpanded && (
                <div className="border-t border-slate-200/80 dark:border-slate-800 p-5 sm:p-6 space-y-5 bg-slate-50/40 dark:bg-slate-950/40">
                  {/* Section 1: Accomplishments */}
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                      <span>What Was Accomplished Today</span>
                    </h4>
                    <p className="text-xs sm:text-sm text-slate-800 dark:text-slate-200 leading-relaxed bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 whitespace-pre-wrap">
                      {report.whatWasDone}
                    </p>
                  </div>

                  {/* Section 2: Blockers */}
                  {report.blockers && (
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400 mb-2 flex items-center gap-1.5">
                        <AlertTriangle className="w-4 h-4 text-rose-500" />
                        <span>Impediments & Blockers</span>
                      </h4>
                      <p className="text-xs sm:text-sm text-rose-900 dark:text-rose-200 leading-relaxed bg-rose-500/10 p-4 rounded-2xl border border-rose-500/25 whitespace-pre-wrap">
                        {report.blockers}
                      </p>
                    </div>
                  )}

                  {/* Section 3: Plan for Tomorrow & Learnings */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {report.planForTomorrow && (
                      <div>
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-1.5">
                          <Clock className="w-4 h-4 text-blue-500" />
                          <span>Tomorrow's Roadmap</span>
                        </h4>
                        <p className="text-xs sm:text-sm text-slate-800 dark:text-slate-200 leading-relaxed bg-white dark:bg-slate-900 p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-800 whitespace-pre-wrap min-h-[70px]">
                          {report.planForTomorrow}
                        </p>
                      </div>
                    )}

                    {report.learnings && (
                      <div>
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-1.5">
                          <Sparkles className="w-4 h-4 text-purple-500" />
                          <span>Key Learnings & Insights</span>
                        </h4>
                        <p className="text-xs sm:text-sm text-slate-800 dark:text-slate-200 leading-relaxed bg-white dark:bg-slate-900 p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-800 whitespace-pre-wrap min-h-[70px]">
                          {report.learnings}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Section 4: Existing Manager Feedback */}
                  {report.isReviewedByManager && report.managerComment && (
                    <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-4 space-y-1">
                      <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                        <MessageSquare className="w-3.5 h-3.5" />
                        <span>Manager Audit & Remarks:</span>
                      </p>
                      <p className="text-xs sm:text-sm text-emerald-950 dark:text-emerald-200 italic pl-5">
                        "{report.managerComment}"
                      </p>
                    </div>
                  )}

                  {/* Section 5: Review Action Drawer */}
                  {!report.isReviewedByManager && isBeingReviewed && (
                    <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-3.5 animate-in fade-in duration-200">
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                            Supervisor Feedback & Coaching Notes <span className="text-rose-500">*</span>
                          </label>
                          <span className="text-[11px] text-slate-400">
                            {reviewComment.length} / 500
                          </span>
                        </div>
                        <textarea
                          value={reviewComment}
                          onChange={(e) => setReviewComment(e.target.value)}
                          placeholder="Provide constructive feedback, acknowledge task velocity, or offer guidance on blockers..."
                          rows={3}
                          maxLength={500}
                          className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white rounded-2xl px-4 py-3 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none transition"
                        />
                      </div>

                      {/* Quick Template Chips */}
                      <div>
                        <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 block mb-1.5">
                          Quick Presets:
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {QUICK_FEEDBACK_TEMPLATES.map((tmpl) => (
                            <button
                              key={tmpl}
                              type="button"
                              onClick={() => setReviewComment(tmpl)}
                              className="text-[11px] px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 transition cursor-pointer"
                            >
                              + {tmpl}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Buttons */}
                      <div className="flex items-center justify-end gap-2.5 pt-2">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedReport(null);
                            setReviewComment('');
                          }}
                          className="px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={handleReview}
                          disabled={reviewMutation.isPending || !reviewComment.trim()}
                          className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition shadow-md shadow-blue-500/20"
                        >
                          <Send className="w-3.5 h-3.5" />
                          <span>
                            {reviewMutation.isPending ? 'Submitting Review...' : 'Submit Audit & Feedback'}
                          </span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Trigger Review Button */}
                  {!report.isReviewedByManager && !isBeingReviewed && (
                    <div className="pt-2 flex justify-end">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedReport(report);
                          setReviewComment('');
                        }}
                        className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition shadow-md shadow-blue-500/20 cursor-pointer"
                      >
                        <MessageSquare className="w-4 h-4" />
                        <span>Audit & Provide Feedback</span>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
};

export default ManagerEODReviewPage;