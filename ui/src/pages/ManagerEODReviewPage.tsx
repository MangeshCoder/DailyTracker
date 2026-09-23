import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { eodApi } from '../services/api';
import { EODReport } from '../types';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/Authcontext';
import { CheckCircle, Clock, MessageSquare, User } from 'lucide-react';

export const ManagerEODReviewPage = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [selectedReport, setSelectedReport] = useState<EODReport | null>(null);
  const [reviewComment, setReviewComment] = useState('');
  const [expandedId, setExpandedId] = useState<number | null>(null);

  // Fetch all pending EOD reports (only manager can see)
  const { data: pendingReports = [], isLoading, refetch } = useQuery({
    queryKey: ['eodPending'],
    queryFn: () => eodApi.getPending().then(r => r.data),
  });

  // Review mutation
  const reviewMutation = useMutation({
    mutationFn: (data: { reportId: number; comment: string }) =>
      eodApi.review(data.reportId, { managerComment: data.comment }),
    onSuccess: () => {
      toast.success('✅ EOD report reviewed!');
      setSelectedReport(null);
      setReviewComment('');
      qc.invalidateQueries({ queryKey: ['eodPending'] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to review report');
    },
  });

  const handleReview = () => {
    if (!selectedReport) return;
    if (!reviewComment.trim()) {
      toast.error('Please add a comment');
      return;
    }
    reviewMutation.mutate({
      reportId: selectedReport.id,
      comment: reviewComment,
    });
  };

  const getMoodEmoji = (mood: string) => {
    const moodMap: Record<string, string> = {
      'Great': '🚀',
      'Good': '😊',
      'Okay': '😐',
      'Tired': '😴',
      'Stressed': '😰',
    };
    return moodMap[mood] || '😐';
  };

  if (!user || user.role !== 'Manager') {
    return (
      <div className="p-6 text-center">
        <p className="text-red-400">⛔ Access Denied - Manager Only</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white">📋 Team EOD Report Review</h1>
        <p className="text-slate-400 text-sm mt-2">
          Review and provide feedback on your team's end-of-day reports
        </p>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <p className="text-xs text-slate-400 mb-2">Total Pending</p>
          <p className="text-2xl font-bold text-white">{pendingReports.length}</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <p className="text-xs text-slate-400 mb-2">Reviewed</p>
          <p className="text-2xl font-bold text-emerald-400">
            {pendingReports.filter((r: EODReport) => r.isReviewedByManager).length}
          </p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <p className="text-xs text-slate-400 mb-2">Awaiting Review</p>
          <p className="text-2xl font-bold text-amber-400">
            {pendingReports.filter((r: EODReport) => !r.isReviewedByManager).length}
          </p>
        </div>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-slate-400">Loading reports...</p>
          </div>
        </div>
      )}

      {/* No Reports */}
      {!isLoading && pendingReports.length === 0 && (
        <div className="text-center py-12 bg-slate-900 border border-slate-800 rounded-2xl">
          <CheckCircle className="mx-auto mb-3 text-emerald-400" size={40} />
          <p className="text-white font-semibold">All caught up!</p>
          <p className="text-slate-400 text-sm mt-1">All EOD reports have been reviewed</p>
        </div>
      )}

      {/* Reports List */}
      <div className="space-y-4">
        {pendingReports.map((report: EODReport) => (
          <div
            key={report.id}
            className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden hover:border-slate-700 transition"
          >
            {/* Report Header */}
            <div
              onClick={() => setExpandedId(expandedId === report.id ? null : report.id)}
              className="p-5 cursor-pointer hover:bg-slate-800/50 transition flex items-center justify-between"
            >
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center text-xs font-bold">
                    {report.userName.charAt(0)}
                  </div>
                  <div>
                    <p className="text-white font-semibold">{report.userName}</p>
                    <p className="text-xs text-slate-400">
                      {new Date(report.reportDate).toLocaleDateString('en-IN', {
                        weekday: 'short',
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </p>
                  </div>
                </div>
              </div>

              {/* Status Badge & Mood */}
              <div className="flex items-center gap-3">
                <span className="text-2xl">{getMoodEmoji(report.moodRating)}</span>
                {report.isReviewedByManager ? (
                  <span className="bg-emerald-500/20 text-emerald-400 text-xs px-3 py-1.5 rounded-lg border border-emerald-500/30">
                    ✅ Reviewed
                  </span>
                ) : (
                  <span className="bg-amber-500/20 text-amber-400 text-xs px-3 py-1.5 rounded-lg border border-amber-500/30">
                    ⏳ Pending
                  </span>
                )}
              </div>
            </div>

            {/* Expanded Content */}
            {expandedId === report.id && (
              <div className="border-t border-slate-800 p-5 space-y-4 bg-slate-800/30">
                {/* What Was Done */}
                <div>
                  <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                    ✅ What Was Done
                  </h4>
                  <p className="text-sm text-slate-200">{report.whatWasDone}</p>
                </div>

                {/* Blockers */}
                {report.blockers && (
                  <div>
                    <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                      🚫 Blockers
                    </h4>
                    <p className="text-sm text-slate-200">{report.blockers}</p>
                  </div>
                )}

                {/* Plan for Tomorrow */}
                {report.planForTomorrow && (
                  <div>
                    <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                      📋 Plan for Tomorrow
                    </h4>
                    <p className="text-sm text-slate-200">{report.planForTomorrow}</p>
                  </div>
                )}

                {/* Learnings */}
                {report.learnings && (
                  <div>
                    <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                      💡 Learnings
                    </h4>
                    <p className="text-sm text-slate-200">{report.learnings}</p>
                  </div>
                )}

                {/* Meta Information */}
                <div className="grid grid-cols-2 gap-3 py-3 border-t border-slate-700">
                  <div>
                    <p className="text-xs text-slate-500">Submitted At</p>
                    <p className="text-xs text-slate-300">
                      {new Date(report.submittedAt).toLocaleTimeString('en-IN')}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Mood</p>
                    <p className="text-xs text-slate-300">
                      {report.moodRating} {getMoodEmoji(report.moodRating)}
                    </p>
                  </div>
                </div>

                {/* Manager Comment */}
                {report.isReviewedByManager && report.managerComment && (
                  <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3">
                    <p className="text-xs font-semibold text-emerald-400 mb-1">Your Comment:</p>
                    <p className="text-xs text-emerald-300">{report.managerComment}</p>
                  </div>
                )}

                {/* Review Form */}
                {!report.isReviewedByManager && selectedReport?.id === report.id && (
                  <div className="border-t border-slate-700 pt-4 space-y-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-2">
                        <MessageSquare size={14} className="inline mr-1" />
                        Your Review Comment
                      </label>
                      <textarea
                        value={reviewComment}
                        onChange={(e) => setReviewComment(e.target.value)}
                        placeholder="Provide feedback or acknowledgement..."
                        rows={3}
                        className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                      />
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setSelectedReport(null);
                          setReviewComment('');
                        }}
                        className="flex-1 bg-slate-700 hover:bg-slate-600 text-white text-xs font-medium py-2 rounded-lg transition"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleReview}
                        disabled={reviewMutation.isPending || !reviewComment.trim()}
                        className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-medium py-2 rounded-lg transition flex items-center justify-center gap-1"
                      >
                        {reviewMutation.isPending ? (
                          <>
                            <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            Reviewing...
                          </>
                        ) : (
                          <>
                            <CheckCircle size={14} />
                            Submit Review
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}

                {/* Action Button */}
                {!report.isReviewedByManager && selectedReport?.id !== report.id && (
                  <button
                    onClick={() => setSelectedReport(report)}
                    className="w-full bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium py-2 rounded-lg transition"
                  >
                    📝 Review This Report
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};