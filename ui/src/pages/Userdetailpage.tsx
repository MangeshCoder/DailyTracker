import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
// import { managerApi, downloadBlob } from '../../services/api';
import { managerApi, downloadBlob } from '../services/api';
// import {
//   UserAttendanceSummary,
//   AttendanceDay,
//   UserFullReport,
// } from '../../types';

import { UserAttendanceSummary,AttendanceDay,UserFullReport } from '../types';
import { DatePicker } from '../components/DatePicker';

// ─── Attendance Calendar ──────────────────────────────────────────────────────

const AttendanceCalendar = ({
  days,
  month,
  year,
}: {
  days: AttendanceDay[];
  month: number;
  year: number;
}) => {
  const statusStyle: Record<string, { bg: string; text: string; dot: string }> = {
    Present:  { bg: 'bg-emerald-500/20 border-emerald-500/40',  text: 'text-emerald-400',  dot: 'bg-emerald-400' },
    WFH:      { bg: 'bg-blue-500/20 border-blue-500/40',        text: 'text-blue-400',      dot: 'bg-blue-400' },
    HalfDay:  { bg: 'bg-amber-500/20 border-amber-500/40',      text: 'text-amber-400',     dot: 'bg-amber-400' },
    Absent:   { bg: 'bg-red-500/15 border-red-500/30',          text: 'text-red-400',       dot: 'bg-red-400' },
    Weekend:  { bg: 'bg-slate-800/50 border-slate-700/30',      text: 'text-slate-600',     dot: 'bg-slate-600' },
    Future:   { bg: 'bg-slate-800/30 border-slate-700/20',      text: 'text-slate-700',     dot: 'bg-slate-700' },
  };

  const weekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  // Pad grid: find what weekday the 1st of the month falls on
  const firstDay = new Date(year, month - 1, 1).getDay();
  const offset = firstDay === 0 ? 6 : firstDay - 1; // Mon=0 offset
  const padded = [...Array(offset).fill(null), ...days];

  return (
    <div>
      <div className="grid grid-cols-7 mb-2">
        {weekDays.map(d => (
          <div key={d} className="text-center text-xs font-semibold text-slate-500 py-1">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {padded.map((day, i) => {
          if (!day) return <div key={`pad-${i}`} />;
          const s = statusStyle[day.status] ?? statusStyle.Absent;
          const d = new Date(day.date);
          const isToday = d.toDateString() === new Date().toDateString();

          return (
            <div
              key={day.date}
              className={`border rounded-xl p-1.5 ${s.bg} ${isToday ? 'ring-2 ring-blue-500' : ''}`}
              title={`${d.toDateString()} — ${day.status}${day.checkIn ? ` | In: ${day.checkIn}` : ''}${day.checkOut ? ` | Out: ${day.checkOut}` : ''}${day.tasksCompleted ? ` | Tasks: ${day.tasksCompleted}` : ''}`}
            >
              <div className="flex items-center justify-between">
                <span className={`text-xs font-semibold ${s.text}`}>{d.getDate()}</span>
                <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
              </div>
              {day.status !== 'Weekend' && day.status !== 'Future' && day.status !== 'Absent' && (
                <p className="text-xs text-slate-500 mt-0.5 truncate">{day.workHours}</p>
              )}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 mt-4">
        {Object.entries(statusStyle).filter(([k]) => !['Future'].includes(k)).map(([status, style]) => (
          <div key={status} className="flex items-center gap-1.5">
            <span className={`w-2.5 h-2.5 rounded-full ${style.dot}`} />
            <span className="text-xs text-slate-400">{status}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

export const UserDetailPage = () => {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const uid = parseInt(userId!);

  const [attendance, setAttendance] = useState<UserAttendanceSummary | null>(null);
  const [calendar, setCalendar] = useState<AttendanceDay[]>([]);
  const [fullReport, setFullReport] = useState<UserFullReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState('');
  const [activeTab, setActiveTab] = useState<'overview' | 'calendar' | 'report'>('overview');

  // date range for report
  const today = new Date();
  const [fromDate, setFromDate] = useState(() => {
    const d = new Date(); d.setDate(1); return d.toISOString().split('T')[0];
  });
  const [toDate, setToDate] = useState(today.toISOString().split('T')[0]);
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [year, setYear] = useState(today.getFullYear());

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [attRes, calRes, repRes] = await Promise.all([
        managerApi.getUserAttendance(uid, month, year),
        managerApi.getUserCalendar(uid, month, year),
        managerApi.getUserReport(uid, fromDate, toDate),
      ]);
      setAttendance(attRes.data);
      setCalendar(calRes.data);
      setFullReport(repRes.data);
    } finally {
      setLoading(false);
    }
  }, [uid, month, year, fromDate, toDate]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleDownload = async (format: 'pdf' | 'docx') => {
    setDownloading(format);
    try {
      const res = await managerApi.downloadUserReport(uid, format, fromDate, toDate);
      const ext = format === 'docx' ? 'docx' : 'html';
      const name = `Report_${attendance?.user.fullName.replace(/ /g, '_')}_${fromDate}_to_${toDate}.${ext}`;
      downloadBlob(new Blob([res.data], {
        type: format === 'docx'
          ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
          : 'text/html'
      }), name);
    } finally {
      setDownloading('');
    }
  };

  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const fullMonths = ['January','February','March','April','May','June','July','August','September','October','November','December'];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const user = attendance?.user;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/manager')}
            className="p-2 bg-slate-800 hover:bg-slate-700 rounded-xl text-slate-400 hover:text-white transition"
          >
            ←
          </button>
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center text-xl font-bold">
            {user?.fullName.charAt(0)}
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">{user?.fullName}</h1>
            <p className="text-slate-400 text-sm">{user?.role} · {user?.email}</p>
          </div>
        </div>

        {/* Download Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleDownload('pdf')}
            disabled={!!downloading}
            className="flex items-center gap-2 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white text-sm font-medium px-4 py-2.5 rounded-xl transition shadow-lg shadow-red-500/20"
          >
            {downloading === 'pdf' ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : '📄'}
            Download PDF
          </button>
          <button
            onClick={() => handleDownload('docx')}
            disabled={!!downloading}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium px-4 py-2.5 rounded-xl transition shadow-lg shadow-blue-500/20"
          >
            {downloading === 'docx' ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : '📝'}
            Download Word
          </button>
        </div>
      </div>

      {/* Date Range Picker (for report & downloads) */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 mb-5 flex flex-wrap items-center gap-4">
        <span className="text-sm text-slate-400 font-medium">Report Period:</span>
        <div className="flex items-center gap-2">
          <label className="text-xs text-slate-500">From</label>
          {/* <input
            type="date"
            value={fromDate}
            onChange={e => setFromDate(e.target.value)}
            className="bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          /> */}
          <DatePicker value={fromDate} onChange={setFromDate} />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-slate-500">To</label>
          {/* <input
            type="date"
            value={toDate}
            onChange={e => setToDate(e.target.value)}
            className="bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          /> */}
          <DatePicker value={toDate} onChange={setToDate} />
        </div>

        <span className="text-slate-600 text-sm">|</span>
        <span className="text-sm text-slate-400 font-medium">Calendar Month:</span>

        <select
          value={month}
          onChange={e => setMonth(parseInt(e.target.value))}
          className="bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2 text-sm focus:outline-none"
        >
          {fullMonths.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
        </select>
        <select
          value={year}
          onChange={e => setYear(parseInt(e.target.value))}
          className="bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2 text-sm focus:outline-none"
        >
          {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
        </select>

        <button
          onClick={loadData}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded-xl transition"
        >
          Apply
        </button>
      </div>

      {/* Sub Tabs */}
      <div className="flex gap-2 mb-6">
        {(['overview', 'calendar', 'report'] as const).map(t => (
          <button
            key={t}
            onClick={() => setActiveTab(t)}
            className={`px-4 py-2 rounded-xl text-sm font-medium capitalize transition ${
              activeTab === t
                ? 'bg-blue-600 text-white'
                : 'bg-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            {t === 'overview' ? '📊 Overview' : t === 'calendar' ? '📅 Calendar' : '📋 Report'}
          </button>
        ))}
      </div>

      {/* ── OVERVIEW TAB ──────────────────────────────────────────────────────── */}
      {activeTab === 'overview' && attendance && (
        <div>
          {/* Attendance Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            {/* Attendance % with circular ring */}
            <div className="col-span-2 md:col-span-1 bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col items-center justify-center">
              <div className="relative w-20 h-20 mb-3">
                <svg className="w-20 h-20 -rotate-90" viewBox="0 0 80 80">
                  <circle cx="40" cy="40" r="34" fill="none" stroke="#1e293b" strokeWidth="8" />
                  <circle
                    cx="40" cy="40" r="34" fill="none"
                    stroke={attendance.attendancePercentage >= 90 ? '#10b981' : attendance.attendancePercentage >= 75 ? '#f59e0b' : '#ef4444'}
                    strokeWidth="8"
                    strokeDasharray={`${2 * Math.PI * 34}`}
                    strokeDashoffset={`${2 * Math.PI * 34 * (1 - attendance.attendancePercentage / 100)}`}
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className={`text-lg font-bold ${
                    attendance.attendancePercentage >= 90 ? 'text-emerald-400' :
                    attendance.attendancePercentage >= 75 ? 'text-amber-400' : 'text-red-400'
                  }`}>
                    {attendance.attendancePercentage}%
                  </span>
                </div>
              </div>
              <p className="text-white text-sm font-medium">Attendance</p>
              <p className="text-slate-500 text-xs">{fullMonths[month - 1]} {year}</p>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
              <p className="text-xs text-slate-400 mb-2">Days Present</p>
              <p className="text-3xl font-bold text-emerald-400">{attendance.daysPresent}</p>
              <p className="text-xs text-slate-500 mt-1">of {attendance.workingDaysInMonth} working days</p>
              <div className="mt-2 space-y-1 text-xs">
                <p className="text-blue-400">🏠 WFH: {attendance.daysWFH}</p>
                <p className="text-amber-400">½ Half Day: {attendance.daysHalfDay}</p>
                <p className="text-red-400">✗ Absent: {attendance.daysAbsent}</p>
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
              <p className="text-xs text-slate-400 mb-2">Work Hours</p>
              <p className="text-3xl font-bold text-blue-400">{attendance.totalWorkHours}</p>
              <p className="text-xs text-slate-500 mt-1">this month</p>
              <p className="text-xs text-slate-400 mt-2">Avg: <span className="text-white">{attendance.averageDailyHours}h/day</span></p>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
              <p className="text-xs text-slate-400 mb-2">Productivity</p>
              <p className="text-3xl font-bold text-violet-400">{attendance.totalTasksCompleted}</p>
              <p className="text-xs text-slate-500 mt-1">tasks completed</p>
              <p className="text-xs text-slate-400 mt-2">Support: <span className="text-amber-400">{attendance.totalSupportGiven} times</span></p>
            </div>
          </div>

          {/* Report Preview Table */}
          {fullReport && fullReport.dailyEntries.length > 0 && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
              <div className="p-4 border-b border-slate-800">
                <h3 className="text-white font-semibold">Recent Activity ({fullReport.dailyEntries.length} days logged)</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-slate-800/50">
                      <th className="text-left text-slate-500 px-4 py-3 font-medium">Date</th>
                      <th className="text-left text-slate-500 px-4 py-3 font-medium">Status</th>
                      <th className="text-left text-slate-500 px-4 py-3 font-medium">Check In</th>
                      <th className="text-left text-slate-500 px-4 py-3 font-medium">Check Out</th>
                      <th className="text-left text-slate-500 px-4 py-3 font-medium">Work Hours</th>
                      <th className="text-left text-slate-500 px-4 py-3 font-medium">Tasks</th>
                      <th className="text-left text-slate-500 px-4 py-3 font-medium">Support</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fullReport.dailyEntries.slice().reverse().slice(0, 15).map(entry => {
                      const statusColors: Record<string, string> = {
                        Present: 'text-emerald-400',
                        WFH: 'text-blue-400',
                        HalfDay: 'text-amber-400',
                        Absent: 'text-red-400',
                      };
                      return (
                        <tr key={entry.date} className="border-b border-slate-800/30 hover:bg-slate-800/20">
                          <td className="px-4 py-3 text-slate-300 font-medium">
                            {new Date(entry.date).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`font-medium ${statusColors[entry.dayStatus] ?? 'text-slate-400'}`}>
                              {entry.dayStatus}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-slate-300">{entry.checkIn}</td>
                          <td className="px-4 py-3 text-slate-300">{entry.checkOut}</td>
                          <td className="px-4 py-3 text-blue-400 font-semibold">{entry.workHours}</td>
                          <td className="px-4 py-3 text-slate-400">{entry.tasksSummary.length} task(s)</td>
                          <td className="px-4 py-3 text-slate-400">{entry.supportSummary.length} log(s)</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── CALENDAR TAB ──────────────────────────────────────────────────────── */}
      {activeTab === 'calendar' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
          <h3 className="text-white font-semibold mb-5">
            Attendance Calendar — {fullMonths[month - 1]} {year}
          </h3>
          <AttendanceCalendar days={calendar} month={month} year={year} />
        </div>
      )}

      {/* ── REPORT TAB ────────────────────────────────────────────────────────── */}
      {activeTab === 'report' && fullReport && (
        <div>
          {/* Summary Banner */}
          <div className="bg-gradient-to-r from-blue-900/40 to-violet-900/40 border border-blue-500/20 rounded-2xl p-5 mb-5">
            <div className="flex flex-wrap gap-6 text-sm">
              <div><span className="text-slate-400">Period: </span><span className="text-white font-medium">{new Date(fullReport.fromDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} – {new Date(fullReport.toDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span></div>
              <div><span className="text-slate-400">Attendance: </span><span className="text-emerald-400 font-bold">{fullReport.attendancePercentage}%</span></div>
              <div><span className="text-slate-400">Work Hours: </span><span className="text-blue-400 font-bold">{fullReport.totalWorkHours}</span></div>
              <div><span className="text-slate-400">Tasks: </span><span className="text-violet-400 font-bold">{fullReport.totalTasksCompleted}/{fullReport.totalTasksLogged}</span></div>
              <div><span className="text-slate-400">Support: </span><span className="text-amber-400 font-bold">{fullReport.totalSupportGiven}</span></div>
            </div>
          </div>

          {/* Daily entries */}
          <div className="space-y-3">
            {fullReport.dailyEntries.slice().reverse().map(entry => (
              <div key={entry.date} className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
                {/* Day header */}
                <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
                  <div className="flex items-center gap-3">
                    <p className="text-white font-semibold">
                      {new Date(entry.date).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
                    </p>
                    <span className={`text-xs px-2 py-0.5 rounded-lg font-medium ${
                      entry.dayStatus === 'Present' ? 'bg-emerald-500/20 text-emerald-400' :
                      entry.dayStatus === 'WFH' ? 'bg-blue-500/20 text-blue-400' :
                      entry.dayStatus === 'HalfDay' ? 'bg-amber-500/20 text-amber-400' :
                      'bg-red-500/20 text-red-400'
                    }`}>{entry.dayStatus}</span>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-slate-400">
                    <span>🕐 {entry.checkIn} → {entry.checkOut}</span>
                    <span className="text-blue-400 font-semibold">{entry.workHours}</span>
                    <span>☕ {entry.breakMinutes}m break</span>
                  </div>
                </div>

                {/* Tasks */}
                {entry.tasksSummary.length > 0 && (
                  <div className="mb-2">
                    <p className="text-xs text-slate-500 font-medium mb-1.5 uppercase tracking-wider">Tasks</p>
                    <div className="space-y-1">
                      {entry.tasksSummary.map((t, i) => (
                        <p key={i} className="text-xs text-slate-400 pl-3 border-l-2 border-slate-700">
                          {t.startsWith('[Completed]') ? '✅' : t.startsWith('[Blocked]') ? '🚫' : '🔄'} {t}
                        </p>
                      ))}
                    </div>
                  </div>
                )}

                {/* Support */}
                {entry.supportSummary.length > 0 && (
                  <div>
                    <p className="text-xs text-slate-500 font-medium mb-1.5 uppercase tracking-wider">Support Given</p>
                    <div className="space-y-1">
                      {entry.supportSummary.map((s, i) => (
                        <p key={i} className="text-xs text-slate-400 pl-3 border-l-2 border-violet-700">🤝 {s}</p>
                      ))}
                    </div>
                  </div>
                )}

                {/* Notes */}
                {entry.notes && (
                  <p className="text-xs text-slate-500 mt-2 italic">📝 {entry.notes}</p>
                )}
              </div>
            ))}

            {fullReport.dailyEntries.length === 0 && (
              <div className="text-center py-12 border-2 border-dashed border-slate-800 rounded-2xl">
                <p className="text-slate-400">No activity logged in this date range.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};