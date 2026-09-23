import { useQuery } from '@tanstack/react-query';
import { eodApi } from '../services/api';
import { EODReport } from '../types';
import { useAuth } from '../context/Authcontext';
import { CheckCircle, Clock, MessageSquare, AlertCircle } from 'lucide-react';

export const MyEODReviewsPage = () => {
  const { user } = useAuth();

  // Fetch all my EOD reports (with manager reviews)
  const { data: reports = [], isLoading } = useQuery({
    queryKey: ['myEODReports'],
    queryFn: () => eodApi.getHistory(30).then(r => r.data),
  });

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

  const reviewedReports = reports.filter((r: EODReport) => r.isReviewedByManager);
  const pendingReports = reports.filter((r: EODReport) => !r.isReviewedByManager);

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white">📋 My EOD Reports</h1>
        <p className="text-slate-400 text-sm mt-2">
          View your submitted EOD reports and manager feedback
        </p>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <p className="text-xs text-slate-400 mb-2">Total Submitted</p>
          <p className="text-2xl font-bold text-white">{reports.length}</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <p className="text-xs text-slate-400 mb-2">Reviewed</p>
          <p className="text-2xl font-bold text-emerald-400">{reviewedReports.length}</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <p className="text-xs text-slate-400 mb-2">Pending Review</p>
          <p className="text-2xl font-bold text-amber-400">{pendingReports.length}</p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-slate-400">Loading reports...</p>
          </div>
        </div>
      ) : reports.length === 0 ? (
        <div className="text-center py-12 bg-slate-900 border border-slate-800 rounded-2xl">
          <AlertCircle className="mx-auto mb-3 text-slate-500" size={40} />
          <p className="text-white font-semibold">No EOD reports yet</p>
          <p className="text-slate-400 text-sm mt-1">Submit your first EOD report to get started</p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Reviewed Reports Section */}
          {reviewedReports.length > 0 && (
            <>
              <h2 className="text-lg font-semibold text-white flex items-center gap-2 mt-8">
                <CheckCircle size={20} className="text-emerald-400" />
                Manager Reviews ({reviewedReports.length})
              </h2>
              <div className="space-y-4">
                {reviewedReports.map((report: EODReport) => (
                  <ReportCard key={report.id} report={report} getMoodEmoji={getMoodEmoji} />
                ))}
              </div>
            </>
          )}

          {/* Pending Reviews Section */}
          {pendingReports.length > 0 && (
            <>
              <h2 className="text-lg font-semibold text-white flex items-center gap-2 mt-8">
                <Clock size={20} className="text-amber-400" />
                Awaiting Review ({pendingReports.length})
              </h2>
              <div className="space-y-4">
                {pendingReports.map((report: EODReport) => (
                  <ReportCard key={report.id} report={report} getMoodEmoji={getMoodEmoji} />
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

// Report Card Component
const ReportCard = ({ report, getMoodEmoji }: { report: EODReport; getMoodEmoji: (mood: string) => string }) => {
  const [expanded, setExpanded] = React.useState<boolean>(false);
  const formatISTDate = (dateString?: string) => {
    if (!dateString) return "--";

    const utcDate = new Date(dateString + "Z");

    return utcDate.toLocaleDateString("en-IN", {
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
      timeZone: "Asia/Kolkata",
    });
  };
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden hover:border-slate-700 transition">
      {/* Card Header */}
      <div
        onClick={() => setExpanded(!expanded)}
        className="p-5 cursor-pointer hover:bg-slate-800/50 transition flex items-center justify-between"
      >
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-1">
            <p className="text-white font-semibold">
               {new Date(report.reportDate).toLocaleDateString('en-IN', {
                 weekday: 'long', day: 'numeric', month: 'short', year: 'numeric'
               })}
            </p>
            <span className="text-2xl">{getMoodEmoji(report.moodRating)}</span>
          </div>
          <p className="text-xs text-slate-400">
            Submitted {formatISTDate(report.submittedAt)}
          </p>
        </div>

        {/* Status Badge */}
        {report.isReviewedByManager ? (
          <div className="flex items-center gap-2">
            <span className="bg-emerald-500/20 text-emerald-400 text-xs px-3 py-1.5 rounded-lg border border-emerald-500/30">
              ✅ Reviewed
            </span>
          </div>
        ) : (
          <span className="bg-amber-500/20 text-amber-400 text-xs px-3 py-1.5 rounded-lg border border-amber-500/30">
            ⏳ Pending
          </span>
        )}
      </div>

      {/* Expanded Content */}
      {expanded && (
        <div className="border-t border-slate-800 p-5 space-y-4 bg-slate-800/30">
          {/* What Was Done */}
          <div>
            <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              ✅ What You Accomplished
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

          {/* Manager Review Comment */}
          {report.isReviewedByManager && report.managerComment && (
            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 mt-4">
              <p className="text-xs font-semibold text-emerald-400 mb-2 flex items-center gap-2">
                <MessageSquare size={14} />
                Manager Review
              </p>
              <p className="text-sm text-emerald-300">{report.managerComment}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

import React from 'react';