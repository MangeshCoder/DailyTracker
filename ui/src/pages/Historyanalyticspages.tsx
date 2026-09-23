import { useState, useEffect } from 'react';
// import { dailyLogApi, dashboardApi } from '../../services/api';
import { dailyLogApi, dashboardApi } from '../services/api';
// import { DailyLog, WeeklyReport } from '../../types';
import { DailyLog, WeeklyReport } from '../types';
import { SupportMediaDisplay } from '../components/SupportMediaDisplay';

// ─── History Page ─────────────────────────────────────────────────────────────

export const HistoryPage = () => {
  const [history, setHistory] = useState<DailyLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLog, setSelectedLog] = useState<DailyLog | null>(null);
  const [days, setDays] = useState(30);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const res = await dailyLogApi.getHistory(days);
        setHistory(res.data);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [days]);

  const statusColor: Record<string, string> = {
    Present: 'bg-emerald-500/20 text-emerald-400',
    WFH: 'bg-blue-500/20 text-blue-400',
    HalfDay: 'bg-amber-500/20 text-amber-400',
    Absent: 'bg-red-500/20 text-red-400',
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

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">History</h1>
          <p className="text-slate-400 text-sm mt-1">Your past activity logs</p>
        </div>
        <select
          value={days}
          onChange={e => setDays(parseInt(e.target.value))}
          className="bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2 text-sm focus:outline-none"
        >
          <option value={7}>Last 7 days</option>
          <option value={14}>Last 14 days</option>
          <option value={30}>Last 30 days</option>
          <option value={90}>Last 90 days</option>
        </select>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Log List */}
        <div className="space-y-2">
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : history.length === 0 ? (
            <div className="text-center py-12 border-2 border-dashed border-slate-800 rounded-2xl">
              <p className="text-slate-400">No history yet.</p>
            </div>
          ) : (
            history.map(log => (
              <button
                key={log.id}
                onClick={() => setSelectedLog(selectedLog?.id === log.id ? null : log)}
                className={`w-full text-left bg-slate-900 border rounded-2xl p-4 hover:border-blue-500/50 transition ${
                  selectedLog?.id === log.id ? 'border-blue-500/50 bg-blue-500/5' : 'border-slate-800'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <p className="text-white font-medium text-sm">
                    {new Date(log.logDate).toLocaleDateString('en-IN', {
                      weekday: 'long', day: 'numeric', month: 'short', year: 'numeric'
                    })}
                  </p>
                  <span className={`text-xs px-2 py-0.5 rounded-lg ${statusColor[log.dayStatus] ?? statusColor['Present']}`}>
                    {log.dayStatus}
                  </span>
                </div>
                <div className="flex gap-4 text-xs text-slate-500">
                  <span>🕐 {log.checkInTime ? formatISTTime(log.checkInTime) : '--'}</span>
                  <span>🕐 {log.checkOutTime ? formatISTTime(log.checkOutTime) : '--'}</span>
                  <span className="text-blue-400">⏱ {log.workHours}</span>
                  <span>✅ {log.tasks.filter(t => t.status === 'Completed').length} tasks</span>
                </div>
              </button>
            ))
          )}
        </div>

        {/* Detail Panel */}
        {selectedLog && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 h-fit sticky top-4">
            <h3 className="text-white font-semibold mb-4">
              {new Date(selectedLog.logDate).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
            </h3>

            <div className="grid grid-cols-2 gap-3 mb-5">
              <div className="bg-slate-800/50 rounded-xl p-3">
                <p className="text-xs text-slate-500 mb-1">Check In</p>
                <p className="text-white font-semibold">
                  {selectedLog.checkInTime ? formatISTTime(selectedLog.checkInTime) : '--'}
                </p>
              </div>
              <div className="bg-slate-800/50 rounded-xl p-3">
                <p className="text-xs text-slate-500 mb-1">Check Out</p>
                <p className="text-white font-semibold">
                  {selectedLog.checkOutTime ? formatISTTime(selectedLog.checkOutTime) : '--'}
                </p>
              </div>
              <div className="bg-slate-800/50 rounded-xl p-3">
                <p className="text-xs text-slate-500 mb-1">Work Hours</p>
                <p className="text-blue-400 font-semibold">{selectedLog.workHours}</p>
              </div>
              <div className="bg-slate-800/50 rounded-xl p-3">
                <p className="text-xs text-slate-500 mb-1">Break Time</p>
                <p className="text-amber-400 font-semibold">{selectedLog.totalBreakMinutes}m</p>
              </div>
            </div>

            {selectedLog.tasks.length > 0 && (
              <div className="mb-4">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Tasks ({selectedLog.tasks.length})</p>
                <div className="space-y-1.5">
                  {selectedLog.tasks.map(t => (
                    <div key={t.id} className="flex items-center gap-2 text-xs">
                      <span>{t.status === 'Completed' ? '✅' : '🔄'}</span>
                      <span className="text-slate-300 flex-1 truncate">{t.taskTitle}</span>
                      <span className="text-slate-500">{t.timeSpentMinutes}m</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {selectedLog.supportLogs.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Support Given</p>
                <div className="space-y-1.5">
                  {selectedLog.supportLogs.map(s => (
                    <div key={s.id} className="flex flex-col gap-1 text-xs">
                      <div className="flex items-center gap-2">
                        <span>🤝</span>
                        <span className="text-slate-300 flex-1">{s.supportedDeveloperName}</span>
                        <span className="text-slate-500">{s.timeSpentMinutes}m</span>
                      </div>
                      {s.media && s.media.length > 0 && (
                        <SupportMediaDisplay media={s.media} />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {selectedLog.notes && (
              <div className="mt-4 bg-slate-800/50 rounded-xl p-3">
                <p className="text-xs text-slate-500 mb-1">Notes</p>
                <p className="text-slate-300 text-xs">{selectedLog.notes}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Analytics Page ───────────────────────────────────────────────────────────

export const AnalyticsPage = () => {
  const [report, setReport] = useState<WeeklyReport | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await dashboardApi.getWeeklyReport();
        setReport(res.data);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const maxMins = Math.max(...(report?.days.map(d => d.totalWorkMinutes) ?? [1]), 1);

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Analytics</h1>
        <p className="text-slate-400 text-sm mt-1">Last 7 days overview</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <p className="text-slate-400 text-xs mb-1">Total Hours</p>
          <p className="text-3xl font-bold text-blue-400">
            {Math.floor((report?.totalWorkMinutes ?? 0) / 60)}h
          </p>
          <p className="text-slate-500 text-xs mt-1">this week</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <p className="text-slate-400 text-xs mb-1">Avg Daily</p>
          <p className="text-3xl font-bold text-emerald-400">
            {report?.averageDailyHours}h
          </p>
          <p className="text-slate-500 text-xs mt-1">per day</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <p className="text-slate-400 text-xs mb-1">Tasks Done</p>
          <p className="text-3xl font-bold text-violet-400">{report?.totalTasksCompleted}</p>
          <p className="text-slate-500 text-xs mt-1">completed</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <p className="text-slate-400 text-xs mb-1">Support Given</p>
          <p className="text-3xl font-bold text-amber-400">{report?.totalSupportGiven}</p>
          <p className="text-slate-500 text-xs mt-1">times helped</p>
        </div>
      </div>

      {/* Bar Chart */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
        <h3 className="text-white font-semibold mb-6">Daily Work Hours</h3>
        <div className="flex items-end gap-3 h-48">
          {report?.days.slice().reverse().map((day) => {
            const height = maxMins > 0 ? (day.totalWorkMinutes / maxMins) * 100 : 0;
            const hours = Math.floor(day.totalWorkMinutes / 60);
            const mins = day.totalWorkMinutes % 60;
            const isToday = new Date(day.logDate).toDateString() === new Date().toDateString();

            return (
              <div key={day.id} className="flex-1 flex flex-col items-center gap-2">
                <span className="text-xs text-slate-400">{hours}h{mins > 0 ? `${mins}m` : ''}</span>
                <div className="w-full flex flex-col justify-end" style={{ height: '160px' }}>
                  <div
                    className={`w-full rounded-t-lg transition-all duration-500 ${
                      isToday ? 'bg-blue-500' : 'bg-slate-700 hover:bg-slate-600'
                    }`}
                    style={{ height: `${height}%`, minHeight: '4px' }}
                  />
                </div>
                <span className="text-xs text-slate-500">
                  {new Date(day.logDate).toLocaleDateString('en-IN', { weekday: 'short' })}
                </span>
                <span className={`text-xs px-1.5 py-0.5 rounded ${
                  day.dayStatus === 'WFH' ? 'bg-blue-500/20 text-blue-400' :
                  day.dayStatus === 'Present' ? 'bg-emerald-500/20 text-emerald-400' :
                  'bg-amber-500/20 text-amber-400'
                }`}>{day.dayStatus}</span>
              </div>
            );
          })}
          {(!report?.days || report.days.length === 0) && (
            <div className="flex-1 flex items-center justify-center text-slate-500 text-sm">
              No data yet
            </div>
          )}
        </div>
      </div>

      {/* Per-day breakdown */}
      {report && report.days.length > 0 && (
        <div className="mt-4 bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <h3 className="text-white font-semibold mb-4">Day Breakdown</h3>
          <div className="space-y-2">
            {report.days.map(day => (
              <div key={day.id} className="flex items-center gap-4 py-2 border-b border-slate-800 last:border-0">
                <p className="text-slate-300 text-sm w-36 flex-shrink-0">
                  {new Date(day.logDate).toLocaleDateString('en-IN', { weekday: 'short', month: 'short', day: 'numeric' })}
                </p>
                <div className="flex-1 flex gap-4 text-xs text-slate-500">
                  <span className="text-blue-400 font-medium">{day.workHours}</span>
                  <span>✅ {day.tasks.filter(t => t.status === 'Completed').length} tasks</span>
                  <span>☕ {day.totalBreakMinutes}m break</span>
                  <span>🤝 {day.supportLogs.length} support</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};