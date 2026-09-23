import { useState, useEffect } from 'react';
// import { reportApi, downloadBlob } from '../../services/api';
import { reportApi,downloadBlob } from '../services/api';
// import { UserFullReport, AttendanceDay } from '../../types';
import { UserFullReport,AttendanceDay } from '../types';
import { useAuth } from '../context/Authcontext';
import { DatePicker } from '../components/DatePicker';

// ─── Attendance Calendar (reusable) ──────────────────────────────────────────

const AttendanceCalendar = ({ days }: { days: AttendanceDay[] }) => {
    const calColors: Record<string, string> = {
    Present:  'bg-emerald-500 text-white',
    WFH:      'bg-blue-500 text-white',
    HalfDay:  'bg-amber-500 text-white',
    Absent:   'bg-red-500/30 text-red-300',
    Weekend:  'bg-slate-800 text-slate-600',          // weekend, no check-in
    WeekendWorked: 'bg-orange-500 text-white',         // ← NEW: Sat/Sun with check-in
    Holiday:  'bg-violet-500/40 text-violet-200',      // ← NEW: holiday, no check-in
    HolidayWorked: 'bg-violet-600 text-white',         // ← NEW: holiday with check-in
    Future:   'bg-slate-900 text-slate-700',
  };

  return (
    <div>
      <div className="grid grid-cols-7 gap-1 mb-1">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
          <div key={d} className="text-center text-xs text-slate-500 py-1">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {days.length > 0 && Array.from({ length: new Date(days[0].date).getDay() }).map((_, i) => (
          <div key={`e-${i}`} />
        ))}
        {days.map(day => {
          // For Weekend/Holiday status, if checkIn is populated
          // the employee actually worked that day — use the "Worked" variant
          let colorKey = day.status;
          if (day.status === 'Weekend' && day.checkIn) colorKey = 'WeekendWorked';
          if (day.status === 'Holiday' && day.checkIn) colorKey = 'HolidayWorked';
 
          const title = day.status === 'Holiday' && !day.checkIn
            ? `${new Date(day.date).toDateString()} — Holiday${day.checkIn ? ` (${day.checkIn})` : ''}`
            : `${new Date(day.date).toDateString()} — ${day.status}${day.checkIn ? ` | In: ${day.checkIn}` : ''}`;
 
          return (
            <div key={day.date}
              title={title}
              className={`aspect-square flex items-center justify-center rounded-lg text-xs font-medium cursor-default hover:scale-110 transition ${calColors[colorKey] ?? 'bg-slate-800 text-slate-500'}`}>
              {new Date(day.date).getDate()}
            </div>
          );
        })}
      </div>
      <div className="flex flex-wrap gap-3 mt-3">
           {[
        { c: 'bg-emerald-500',       l: 'Present'          },
        { c: 'bg-blue-500',          l: 'WFH'              },
        { c: 'bg-amber-500',         l: 'Half Day'         },
        { c: 'bg-red-500/50',        l: 'Absent'           },
        { c: 'bg-slate-700',         l: 'Weekend'          },
        { c: 'bg-orange-500',        l: 'Weekend (worked)' },  // ← NEW
        { c: 'bg-violet-500/40',     l: 'Holiday'          },  // ← NEW
        { c: 'bg-violet-600',        l: 'Holiday (worked)' },  // ← NEW
      ].map(i => (
        <span key={i.l} className="flex items-center gap-1.5 text-xs text-slate-400">
          <span className={`w-3 h-3 rounded ${i.c}`} />{i.l}
        </span>
      ))}
      </div>
    </div>
  );
};

// ─── My Report Page ───────────────────────────────────────────────────────────

export const MyReportPage = () => {
  const { user } = useAuth();
  const currentMonth = new Date().getMonth() + 1;
  const currentYear = new Date().getFullYear();

  const [from, setFrom] = useState(() => {
    const d = new Date(); d.setDate(1);
    return d.toISOString().split('T')[0];
  });
  const [to, setTo] = useState(new Date().toISOString().split('T')[0]);
  const [report, setReport] = useState<UserFullReport | null>(null);
  const [calDays, setCalDays] = useState<AttendanceDay[]>([]);
  const [month, setMonth] = useState(currentMonth);
  const [year, setYear] = useState(currentYear);
  const [loading, setLoading] = useState(false);
  const [calLoading, setCalLoading] = useState(false);
  const [downloading, setDownloading] = useState('');
  const [format, setFormat] = useState<'pdf' | 'docx'>('pdf');

  const loadReport = async () => {
    setLoading(true);
    try {
      const res = await reportApi.getMyReport(from, to);
      setReport(res.data);
    } finally {
      setLoading(false);
    }
  };

  const loadCalendar = async () => {
    setCalLoading(true);
    try {
      const res = await reportApi.getMyCalendar(month, year);
      setCalDays(res.data);
    } finally {
      setCalLoading(false);
    }
  };

  useEffect(() => { loadReport(); }, [from, to]);
  useEffect(() => { loadCalendar(); }, [month, year]);

  const handleDownload = async () => {
    setDownloading(format);
    try {
      const res = await reportApi.downloadMyReport(format, from, to);
      const ext = format === 'docx' ? 'docx' : 'html';
      const name = `MyReport_${user?.fullName?.replace(/\s/g, '_')}_${from}_${to}.${ext}`;
      downloadBlob(res.data, name);
    } finally {
      setDownloading('');
    }
  };

  const pct = report?.attendancePercentage ?? 0;
  const pctColor = pct >= 90 ? 'text-emerald-400' : pct >= 75 ? 'text-amber-400' : 'text-red-400';

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">My Report</h1>
        <p className="text-slate-400 text-sm mt-1">
          Your personal attendance & productivity report — only you can see this
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Left: Report + Download */}
        <div className="xl:col-span-2 space-y-5">
          {/* Date range selector */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
            <h3 className="text-sm font-semibold text-slate-300 mb-4">Select Date Range</h3>
            <div className="flex flex-wrap gap-3 mb-4">
              <div>
                <label className="block text-xs text-slate-400 mb-1">From</label>
                {/* <input type="date" value={from} onChange={e => setFrom(e.target.value)}
                  className="bg-slate-800 border border-slate-700 text-white text-sm rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500" /> */}
                  <DatePicker value={from} onChange={setFrom} />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">To</label>
                {/* <input type="date" value={to} onChange={e => setTo(e.target.value)}
                  className="bg-slate-800 border border-slate-700 text-white text-sm rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500" /> */}
                  <DatePicker value={to} onChange={setTo} />
              </div>
            </div>

            {/* Quick ranges */}
            <div className="flex flex-wrap gap-2">
              {[
                { label: 'This Month', action: () => {
                  const d = new Date(); d.setDate(1);
                  setFrom(d.toISOString().split('T')[0]);
                  setTo(new Date().toISOString().split('T')[0]);
                }},
                { label: 'Last Month', action: () => {
                  const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - 1);
                  const end = new Date(d.getFullYear(), d.getMonth() + 1, 0);
                  setFrom(d.toISOString().split('T')[0]);
                  setTo(end.toISOString().split('T')[0]);
                }},
                { label: 'Last 7 Days', action: () => {
                  const d = new Date(); d.setDate(d.getDate() - 7);
                  setFrom(d.toISOString().split('T')[0]);
                  setTo(new Date().toISOString().split('T')[0]);
                }},
                { label: 'Last 30 Days', action: () => {
                  const d = new Date(); d.setDate(d.getDate() - 30);
                  setFrom(d.toISOString().split('T')[0]);
                  setTo(new Date().toISOString().split('T')[0]);
                }},
              ].map(q => (
                <button key={q.label} onClick={q.action}
                  className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 px-3 py-1.5 rounded-lg transition">
                  {q.label}
                </button>
              ))}
            </div>
          </div>

          {/* Stats */}
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : report && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 text-center">
                  <p className={`text-3xl font-bold ${pctColor}`}>{report.attendancePercentage}%</p>
                  <p className="text-xs text-slate-500 mt-1">Attendance</p>
                </div>
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 text-center">
                  <p className="text-3xl font-bold text-blue-400">{report.totalWorkHours}</p>
                  <p className="text-xs text-slate-500 mt-1">Total Work</p>
                </div>
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 text-center">
                  <p className="text-3xl font-bold text-violet-400">{report.totalTasksCompleted}</p>
                  <p className="text-xs text-slate-500 mt-1">Tasks Done</p>
                </div>
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 text-center">
                  <p className="text-3xl font-bold text-amber-400">{report.totalSupportGiven}</p>
                  <p className="text-xs text-slate-500 mt-1">Support Given</p>
                </div>
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 text-center">
                  <p className="text-3xl font-bold text-emerald-400">{report.daysPresent}</p>
                  <p className="text-xs text-slate-500 mt-1">Days Present</p>
                </div>
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 text-center">
                  <p className="text-3xl font-bold text-cyan-400">{report.averageDailyHours}h</p>
                  <p className="text-xs text-slate-500 mt-1">Avg Daily Hours</p>
                </div>
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 text-center">
                  <p className="text-3xl font-bold text-pink-400">{report.totalTasksLogged}</p>
                  <p className="text-xs text-slate-500 mt-1">Tasks Logged</p>
                </div>
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 text-center">
                  <p className="text-3xl font-bold text-slate-300">{report.totalWorkingDays}</p>
                  <p className="text-xs text-slate-500 mt-1">Working Days</p>
                </div>
              </div>

              {/* Daily entries */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
                <div className="p-4 border-b border-slate-800">
                  <h3 className="text-sm font-semibold text-white">Daily Breakdown</h3>
                </div>
                <div className="divide-y divide-slate-800/50">
                  {report.dailyEntries.map(entry => {
                    const statusC: Record<string, string> = {
                      Present: 'bg-emerald-500/20 text-emerald-400',
                      WFH: 'bg-blue-500/20 text-blue-400',
                      HalfDay: 'bg-amber-500/20 text-amber-400',
                      Absent: 'bg-red-500/20 text-red-400',
                    };
                    return (
                      <div key={entry.date} className="p-4 hover:bg-slate-800/30 transition">
                        <div className="flex items-center gap-3 mb-2">
                          <p className="text-white font-medium text-sm">
                            {new Date(entry.date).toLocaleDateString('en-IN', {
                              weekday: 'short', day: 'numeric', month: 'short'
                            })}
                          </p>
                          <span className={`text-xs px-2 py-0.5 rounded-lg ${statusC[entry.dayStatus] ?? 'bg-slate-700 text-slate-400'}`}>
                            {entry.dayStatus}
                          </span>
                          <span className="text-xs text-blue-400 font-medium ml-auto">{entry.workHours}</span>
                          <span className="text-xs text-slate-500">{entry.checkIn} → {entry.checkOut}</span>
                          {entry.breakMinutes > 0 && (
                            <span className="text-xs text-amber-400">☕ {entry.breakMinutes}m</span>
                          )}
                        </div>
                        {entry.tasksSummary.length > 0 && (
                          <div className="ml-2 space-y-0.5">
                            {entry.tasksSummary.map((t, i) => (
                              <p key={i} className="text-xs text-slate-400">• {t}</p>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Right: Calendar + Download */}
        <div className="space-y-5">
          {/* Download */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
            <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
              📥 Download My Report
            </h3>
            <div className="flex gap-2 mb-4">
              {(['pdf', 'docx'] as const).map(f => (
                <button key={f} onClick={() => setFormat(f)}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition ${
                    format === f ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'
                  }`}>
                  {f === 'pdf' ? '🌐 PDF' : '📄 Word'}
                </button>
              ))}
            </div>
            <button onClick={handleDownload} disabled={!!downloading}
              className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold py-3 rounded-xl text-sm transition">
              {downloading ? 'Generating...' : `Download ${format.toUpperCase()}`}
            </button>
            {format === 'pdf' && (
              <p className="text-xs text-slate-500 mt-2 text-center">Opens in browser → Print → Save as PDF</p>
            )}
          </div>

          {/* Attendance Calendar */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-white">Attendance Calendar</h3>
              <div className="flex gap-2">
                <select value={month} onChange={e => setMonth(+e.target.value)}
                  className="bg-slate-800 border border-slate-700 text-white text-xs rounded-lg px-2 py-1.5 focus:outline-none">
                  {Array.from({ length: 12 }, (_, i) => (
                    <option key={i + 1} value={i + 1}>
                      {new Date(2024, i, 1).toLocaleString('default', { month: 'short' })}
                    </option>
                  ))}
                </select>
                <select value={year} onChange={e => setYear(+e.target.value)}
                  className="bg-slate-800 border border-slate-700 text-white text-xs rounded-lg px-2 py-1.5 focus:outline-none">
                  {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
            </div>
            {calLoading ? (
              <div className="flex justify-center py-8">
                <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <AttendanceCalendar days={calDays} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};