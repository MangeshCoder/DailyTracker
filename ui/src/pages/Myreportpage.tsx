// ─────────────────────────────────────────────────────────────────────────────
//  FILE: ui/src/pages/Myreportpage.tsx
//  My Report - Modern Design System Upgrade
//
//  Route: /my-report
//  Logic unchanged from previous version:
//  ✅ Date range (from/to) + quick ranges → personal report
//  ✅ 8 summary stats + daily breakdown
//  ✅ Download as PDF (HTML) or Word (.docx)
//  ✅ Attendance calendar by month/year (weekend/holiday "worked" colours)
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect } from 'react';
import { reportApi, downloadBlob } from '../services/api';
import type { UserFullReport, AttendanceDay } from '../types';
import { useAuth } from '../context/Authcontext';
import { DatePicker } from '../components/DatePicker';
import { PageHeader } from '../components/ui/PageHeader';
import { StatCard } from '../components/ui/StatCard';
import { Card, CardContent } from '../components/ui/Card';
import {
  Percent,
  Timer,
  ListChecks,
  LifeBuoy,
  UserCheck,
  Gauge,
  ClipboardList,
  CalendarDays,
  CalendarRange,
  Download,
  FileText,
  Globe,
  Loader2,
  Info,
  Lock,
  Clock,
  Coffee,
  ChevronDown,
  Inbox,
  Zap,
} from 'lucide-react';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_CHIP: Record<string, string> = {
  Present: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
  WFH:     'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
  HalfDay: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
  Absent:  'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20',
};

const SELECT_CLS =
  'appearance-none bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white ' +
  'rounded-lg pl-2.5 pr-7 py-1.5 text-xs font-semibold cursor-pointer ' +
  'focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition';

const START_YEAR = 2024;
const YEARS = Array.from({ length: new Date().getFullYear() - START_YEAR + 1 }, (_, i) => START_YEAR + i);

// ─── Attendance Calendar (reusable) ──────────────────────────────────────────

const AttendanceCalendar = ({ days }: { days: AttendanceDay[] }) => {
  const calColors: Record<string, string> = {
    Present:       'bg-emerald-500 text-white',
    WFH:           'bg-blue-500 text-white',
    HalfDay:       'bg-amber-500 text-white',
    Absent:        'bg-rose-500/20 text-rose-600 dark:text-rose-300',
    Weekend:       'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-600',
    WeekendWorked: 'bg-orange-500 text-white',
    Holiday:       'bg-violet-500/20 text-violet-600 dark:text-violet-300',
    HolidayWorked: 'bg-violet-600 text-white',
    Future:        'bg-slate-50 dark:bg-slate-900 text-slate-300 dark:text-slate-700',
  };

  return (
    <div>
      <div className="grid grid-cols-7 gap-1 mb-1">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
          <div key={d} className="text-center text-[10px] font-semibold uppercase text-slate-500 dark:text-slate-400 py-1">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {days.length > 0 && Array.from({ length: new Date(days[0].date).getDay() }).map((_, i) => (
          <div key={`e-${i}`} />
        ))}
        {days.map(day => {
          // Weekend/Holiday with a check-in → the employee actually worked that day
          let colorKey = day.status;
          if (day.status === 'Weekend' && day.checkIn) colorKey = 'WeekendWorked';
          if (day.status === 'Holiday' && day.checkIn) colorKey = 'HolidayWorked';

          const title = day.status === 'Holiday' && !day.checkIn
            ? `${new Date(day.date).toDateString()} — Holiday`
            : `${new Date(day.date).toDateString()} — ${day.status}${day.checkIn ? ` | In: ${day.checkIn}` : ''}`;

          return (
            <div
              key={day.date}
              title={title}
              className={`aspect-square flex items-center justify-center rounded-lg text-xs font-semibold cursor-default hover:scale-110 transition ${calColors[colorKey] ?? 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}
            >
              {new Date(day.date).getDate()}
            </div>
          );
        })}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1.5 mt-4">
        {[
          { c: 'bg-emerald-500',   l: 'Present'          },
          { c: 'bg-blue-500',      l: 'WFH'              },
          { c: 'bg-amber-500',     l: 'Half Day'         },
          { c: 'bg-rose-500/40',   l: 'Absent'           },
          { c: 'bg-slate-300 dark:bg-slate-700', l: 'Weekend' },
          { c: 'bg-orange-500',    l: 'Weekend (worked)' },
          { c: 'bg-violet-500/40', l: 'Holiday'          },
          { c: 'bg-violet-600',    l: 'Holiday (worked)' },
        ].map(i => (
          <span key={i.l} className="flex items-center gap-1.5 text-[11px] text-slate-600 dark:text-slate-400">
            <span className={`w-2.5 h-2.5 rounded ${i.c}`} />{i.l}
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

  const quickRanges = [
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
  ];

  const pct = report?.attendancePercentage ?? 0;
  const pctColor: 'emerald' | 'amber' | 'rose' = pct >= 90 ? 'emerald' : pct >= 75 ? 'amber' : 'rose';
  const statsLoading = loading && !report;

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* ── Page Header ── */}
      <PageHeader
        title="My Report"
        description="Your personal attendance & productivity report."
        breadcrumbs={[
          { label: 'Workspace', href: '/' },
          { label: 'Reports' },
          { label: 'My Report' },
        ]}
        badge={{ label: 'Only you can see this', variant: 'slate', icon: <Lock className="w-3 h-3" /> }}
        className="!mb-0"
      />

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* ── Left: range + stats + breakdown ── */}
        <div className="xl:col-span-2 space-y-6">
          {/* Date range */}
          <Card>
            <CardContent>
              <div className="flex items-center gap-2.5 mb-4">
                <div className="p-2 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                  <CalendarRange className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">Date Range</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Report updates automatically when dates change</p>
                </div>
                {loading && <Loader2 className="w-4 h-4 text-blue-500 animate-spin ml-auto" />}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">From</label>
                  <DatePicker value={from} onChange={setFrom} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">To</label>
                  <DatePicker value={to} onChange={setTo} />
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mr-1">
                  <Zap className="w-3.5 h-3.5" /> Quick
                </span>
                {quickRanges.map(q => (
                  <button
                    key={q.label}
                    onClick={q.action}
                    className="text-xs font-semibold px-3 py-1.5 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-blue-500/10 hover:text-blue-600 dark:hover:text-blue-400 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-blue-500/30 transition"
                  >
                    {q.label}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard title="Attendance"      value={`${pct}%`}                          icon={Percent}       color={pctColor} loading={statsLoading} />
            <StatCard title="Total Work"      value={report?.totalWorkHours ?? '0h'}     icon={Timer}         color="blue"     loading={statsLoading} />
            <StatCard title="Tasks Done"      value={report?.totalTasksCompleted ?? 0}   icon={ListChecks}    color="purple"   loading={statsLoading} />
            <StatCard title="Support Given"   value={report?.totalSupportGiven ?? 0}     icon={LifeBuoy}      color="amber"    loading={statsLoading} />
            <StatCard title="Days Present"    value={report?.daysPresent ?? 0}           icon={UserCheck}     color="emerald"  loading={statsLoading} />
            <StatCard title="Avg Daily Hours" value={`${report?.averageDailyHours ?? 0}h`} icon={Gauge}       color="indigo"   loading={statsLoading} />
            <StatCard title="Tasks Logged"    value={report?.totalTasksLogged ?? 0}      icon={ClipboardList} color="rose"     loading={statsLoading} />
            <StatCard title="Working Days"    value={report?.totalWorkingDays ?? 0}      icon={CalendarDays}  color="slate"    loading={statsLoading} />
          </div>

          {/* Daily breakdown */}
          {report && (
            <Card className="overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                  <ClipboardList className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">Daily Breakdown</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{report.dailyEntries.length} days</p>
                </div>
              </div>

              {report.dailyEntries.length === 0 ? (
                <div className="text-center py-12 px-4">
                  <Inbox className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-600" />
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 mt-2">No activity in this range</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
                  {report.dailyEntries.map(entry => (
                    <div key={entry.date} className="px-5 py-4 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition">
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                        <p className="text-sm font-bold text-slate-900 dark:text-white">
                          {new Date(entry.date).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}
                        </p>
                        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${STATUS_CHIP[entry.dayStatus] ?? 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20'}`}>
                          {entry.dayStatus}
                        </span>
                        <div className="flex flex-wrap items-center gap-3 ml-auto text-xs text-slate-500 dark:text-slate-400">
                          <span className="inline-flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> {entry.checkIn} → {entry.checkOut}</span>
                          {entry.breakMinutes > 0 && (
                            <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400"><Coffee className="w-3.5 h-3.5" /> {entry.breakMinutes}m</span>
                          )}
                          <span className="font-bold text-blue-600 dark:text-blue-400">{entry.workHours}</span>
                        </div>
                      </div>
                      {entry.tasksSummary.length > 0 && (
                        <div className="mt-2.5 pl-3 border-l-2 border-slate-200 dark:border-slate-700 space-y-0.5">
                          {entry.tasksSummary.map((t, i) => (
                            <p key={i} className="text-xs text-slate-600 dark:text-slate-400">{t}</p>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </Card>
          )}
        </div>

        {/* ── Right: download + calendar ── */}
        <div className="space-y-6">
          {/* Download */}
          <Card className="relative overflow-hidden">
            <div className="absolute -top-16 -right-16 w-40 h-40 bg-gradient-to-br from-blue-500/15 to-transparent rounded-full blur-2xl pointer-events-none" />
            <CardContent className="relative z-10">
              <div className="flex items-center gap-2.5 mb-4">
                <div className="p-2 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                  <Download className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">Download My Report</h3>
              </div>
              <div className="grid grid-cols-2 gap-2 p-1 mb-4 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                {(['pdf', 'docx'] as const).map(f => (
                  <button
                    key={f}
                    onClick={() => setFormat(f)}
                    className={`inline-flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-semibold transition ${
                      format === f
                        ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-sm'
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    {f === 'pdf' ? <Globe className="w-4 h-4" /> : <FileText className="w-4 h-4" />}
                    {f === 'pdf' ? 'PDF' : 'Word'}
                  </button>
                ))}
              </div>
              <button
                onClick={handleDownload}
                disabled={!!downloading}
                className="w-full inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold py-3 rounded-xl shadow-md shadow-blue-500/20 transition disabled:opacity-50"
              >
                {downloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                {downloading ? 'Generating…' : `Download ${format.toUpperCase()}`}
              </button>
              {format === 'pdf' && (
                <p className="flex items-center justify-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400 mt-2.5">
                  <Info className="w-3.5 h-3.5" /> Opens in browser → Print → Save as PDF
                </p>
              )}
            </CardContent>
          </Card>

          {/* Attendance Calendar */}
          <Card>
            <CardContent>
              <div className="flex items-center justify-between gap-2 mb-4">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shrink-0">
                    <CalendarDays className="w-4 h-4" />
                  </div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white truncate">Attendance</h3>
                </div>
                <div className="flex gap-1.5 shrink-0">
                  <div className="relative">
                    <select value={month} onChange={e => setMonth(+e.target.value)} className={SELECT_CLS}>
                      {Array.from({ length: 12 }, (_, i) => (
                        <option key={i + 1} value={i + 1}>
                          {new Date(2024, i, 1).toLocaleString('default', { month: 'short' })}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                  <div className="relative">
                    <select value={year} onChange={e => setYear(+e.target.value)} className={SELECT_CLS}>
                      {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                    <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                </div>
              </div>
              {calLoading ? (
                <div className="grid grid-cols-7 gap-1">
                  {Array.from({ length: 35 }).map((_, i) => (
                    <div key={i} className="aspect-square rounded-lg bg-slate-100 dark:bg-slate-800/60 animate-pulse" />
                  ))}
                </div>
              ) : (
                <AttendanceCalendar days={calDays} />
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};