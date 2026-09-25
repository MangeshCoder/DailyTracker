import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { eodApi } from '../services/api';
import { EODReport } from '../types';
import { useAuth } from '../context/Authcontext';
import { PageHeader } from '../components/ui/PageHeader';
import { StatCard } from '../components/ui/StatCard';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { StatusBadge } from '../components/ui/StatusBadge';
import {
  ClipboardList,
  CheckCircle2,
  Clock,
  MessageSquare,
  AlertCircle,
  AlertTriangle,
  Smile,
  Calendar,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Search,
  Filter
} from 'lucide-react';

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

export const MyEODReviewsPage: React.FC = () => {
  const { user } = useAuth();
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'reviewed' | 'pending'>('all');

  // Fetch all my EOD reports (with manager reviews)
  const { data: reports = [], isLoading } = useQuery<EODReport[]>({
    queryKey: ['myEODReports'],
    queryFn: () => eodApi.getHistory(30).then((r) => r.data),
  });

  const reviewedReports = useMemo(
    () => reports.filter((r) => r.isReviewedByManager),
    [reports]
  );
  const pendingReports = useMemo(
    () => reports.filter((r) => !r.isReviewedByManager),
    [reports]
  );

  const positiveMoodCount = useMemo(() => {
    return reports.filter(
      (r) => r.moodRating === 'Great' || r.moodRating === 'Good'
    ).length;
  }, [reports]);

  const positiveMoodPct =
    reports.length > 0 ? Math.round((positiveMoodCount / reports.length) * 100) : 0;

  // Filtered reports
  const filteredReports = useMemo(() => {
    return reports.filter((r) => {
      if (statusFilter === 'reviewed' && !r.isReviewedByManager) return false;
      if (statusFilter === 'pending' && r.isReviewedByManager) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesWork = r.whatWasDone?.toLowerCase().includes(q);
        const matchesBlockers = r.blockers?.toLowerCase().includes(q);
        const matchesPlan = r.planForTomorrow?.toLowerCase().includes(q);
        const matchesFeedback = r.managerComment?.toLowerCase().includes(q);
        return matchesWork || matchesBlockers || matchesPlan || matchesFeedback;
      }
      return true;
    });
  }, [reports, statusFilter, searchQuery]);

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* ── Page Header ── */}
      <PageHeader
        title="My Daily EOD Reports"
        description="View your past End-of-Day submissions, track submission consistency, and read supervisor coaching feedback."
        breadcrumbs={[
          { label: 'Workspace', href: '/' },
          { label: 'Activity & Reports' },
          { label: 'My EOD Reports' },
        ]}
        badge={{ label: 'Past 30 Days History', variant: 'blue' }}
      />

      {/* ── KPI Stat Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Reports Submitted"
          value={reports.length}
          subtitle="Past 30 calendar days"
          icon={ClipboardList}
          color="blue"
        />
        <StatCard
          title="Reviewed by Manager"
          value={reviewedReports.length}
          subtitle="Signed off with feedback"
          icon={CheckCircle2}
          color="emerald"
        />
        <StatCard
          title="Awaiting Review"
          value={pendingReports.length}
          subtitle="In supervisor queue"
          icon={Clock}
          color="amber"
        />
        <StatCard
          title="Positive Mood Rate"
          value={`${positiveMoodPct}%`}
          subtitle="Self-reported satisfaction"
          icon={Smile}
          color="purple"
        />
      </div>

      {/* ── Search & Filter Controls ── */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white/70 dark:bg-slate-900/60 p-3 rounded-2xl border border-slate-200/80 dark:border-slate-800 backdrop-blur-sm">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search through past tasks, blockers, or manager comments..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white text-xs sm:text-sm rounded-xl pl-9 pr-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-900 p-1 rounded-xl border border-slate-200/80 dark:border-slate-800">
          {(['all', 'reviewed', 'pending'] as const).map((s) => (
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
              {s === 'all' ? 'All Logs' : s === 'reviewed' ? '✅ Reviewed' : '⏳ Pending'}
            </button>
          ))}
        </div>
      </div>

      {/* ── Loading Skeleton ── */}
      {isLoading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl h-24 animate-pulse"
            />
          ))}
        </div>
      )}

      {/* ── Empty State ── */}
      {!isLoading && filteredReports.length === 0 && (
        <Card className="border-slate-200/80 dark:border-slate-800">
          <CardContent className="text-center py-20 text-slate-400 space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-blue-500/10 text-blue-500 mx-auto flex items-center justify-center">
              <ClipboardList className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              {reports.length === 0 ? 'No EOD Reports Logged Yet' : 'No Matching Reports Found'}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
              {reports.length === 0
                ? 'Submit your daily report in the EOD Report tab at the end of each working day.'
                : 'Try adjusting your search criteria or changing active filters.'}
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

          return (
            <Card
              key={report.id}
              className={`border transition-all duration-200 overflow-hidden shadow-sm ${
                isExpanded
                  ? 'border-blue-500/40 ring-1 ring-blue-500/10'
                  : 'border-slate-200/80 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700/80'
              }`}
            >
              {/* Header Bar */}
              <div
                onClick={() => setExpandedId(isExpanded ? null : report.id)}
                className="p-4 sm:p-5 cursor-pointer hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition flex items-center justify-between gap-4"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="w-10 h-10 rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center text-sm font-bold flex-shrink-0">
                    <Calendar className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-slate-900 dark:text-white text-sm sm:text-base">
                        {new Date(report.reportDate).toLocaleDateString('en-IN', {
                          weekday: 'long',
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </span>
                      {hasBlocker && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-600 dark:text-rose-400 bg-rose-500/10 border border-rose-500/20 px-2 py-0.5 rounded-full">
                          <AlertTriangle className="w-3 h-3" />
                          <span>Blocker Noted</span>
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Submitted: {formatISTDate(report.submittedAt)}
                    </p>
                  </div>
                </div>

                {/* Right Badges */}
                <div className="flex items-center gap-3 flex-shrink-0">
                  <div
                    className={`hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-semibold border ${mood.bg} ${mood.text}`}
                  >
                    <span>{mood.emoji}</span>
                    <span>{mood.label}</span>
                  </div>

                  <StatusBadge
                    status={report.isReviewedByManager ? 'Approved' : 'Pending'}
                    className={report.isReviewedByManager ? '!bg-emerald-500/10 !text-emerald-600 dark:!text-emerald-400 !border-emerald-500/20' : ''}
                  />

                  <div className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition">
                    {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                  </div>
                </div>
              </div>

              {/* Collapsed Snippet */}
              {!isExpanded && (
                <div className="px-5 pb-4 pt-0 text-xs text-slate-600 dark:text-slate-400 line-clamp-1 border-t border-slate-100 dark:border-slate-800/80 pt-2 bg-slate-50/30 dark:bg-slate-900/20">
                  <span className="font-semibold text-slate-700 dark:text-slate-300">Done:</span> {report.whatWasDone}
                </div>
              )}

              {/* Expanded Body */}
              {isExpanded && (
                <div className="border-t border-slate-200/80 dark:border-slate-800 p-5 sm:p-6 space-y-5 bg-slate-50/40 dark:bg-slate-950/40">
                  {/* Accomplished */}
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                      <span>What You Accomplished</span>
                    </h4>
                    <p className="text-xs sm:text-sm text-slate-800 dark:text-slate-200 leading-relaxed bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 whitespace-pre-wrap">
                      {report.whatWasDone}
                    </p>
                  </div>

                  {/* Blockers */}
                  {report.blockers && (
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400 mb-2 flex items-center gap-1.5">
                        <AlertTriangle className="w-4 h-4 text-rose-500" />
                        <span>Impediments / Blockers Faced</span>
                      </h4>
                      <p className="text-xs sm:text-sm text-rose-900 dark:text-rose-200 leading-relaxed bg-rose-500/10 p-4 rounded-2xl border border-rose-500/25 whitespace-pre-wrap">
                        {report.blockers}
                      </p>
                    </div>
                  )}

                  {/* Plan Tomorrow & Learnings */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {report.planForTomorrow && (
                      <div>
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-1.5">
                          <Clock className="w-4 h-4 text-blue-500" />
                          <span>Tomorrow's Plan</span>
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
                          <span>Key Learnings</span>
                        </h4>
                        <p className="text-xs sm:text-sm text-slate-800 dark:text-slate-200 leading-relaxed bg-white dark:bg-slate-900 p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-800 whitespace-pre-wrap min-h-[70px]">
                          {report.learnings}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Manager Feedback */}
                  {report.isReviewedByManager && report.managerComment ? (
                    <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-4.5 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                          <MessageSquare className="w-4 h-4" />
                          <span>Supervisor Feedback:</span>
                        </span>
                        <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md">
                          Audited
                        </span>
                      </div>
                      <p className="text-xs sm:text-sm text-emerald-950 dark:text-emerald-200 italic pl-5 leading-relaxed">
                        "{report.managerComment}"
                      </p>
                    </div>
                  ) : (
                    <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-3.5 flex items-center gap-2.5 text-xs text-amber-700 dark:text-amber-400">
                      <Clock className="w-4 h-4 flex-shrink-0" />
                      <span>This report is currently in the manager queue awaiting audit review.</span>
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

export default MyEODReviewsPage;