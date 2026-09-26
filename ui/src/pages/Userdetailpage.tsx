// ─────────────────────────────────────────────────────────────────────────────
//  FILE: ui/src/pages/Userdetailpage.tsx
//  Employee Detail (Manager) - Modern Design System Upgrade
//
//  Route: /manager/user/:userId
//  Logic unchanged from previous version:
//  ✅ Loads attendance summary, calendar and full report for the user
//  ✅ Report period (from/to) + calendar month/year filters
//  ✅ Overview / Calendar / Report tabs
//  ✅ Download report as PDF (HTML) or Word (.docx)
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { managerApi, downloadBlob } from '../services/api';
import type { UserAttendanceSummary, AttendanceDay, UserFullReport } from '../types';
import { DatePicker } from '../components/DatePicker';
import { PageHeader } from '../components/ui/PageHeader';
import { StatCard } from '../components/ui/StatCard';
import { Card, CardContent } from '../components/ui/Card';
import {
  ArrowLeft,
  FileText,
  FileDown,
  Loader2,
  BarChart3,
  CalendarDays,
  ClipboardList,
  ChevronDown,
  RefreshCw,
  CalendarRange,
  UserCheck,
  Timer,
  ListChecks,
  LifeBuoy,
  Coffee,
  Clock,
  CheckCircle2,
  Ban,
  RefreshCcw,
  StickyNote,
  Mail,
  Home,
  Inbox,
} from 'lucide-react';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_CHIP: Record<string, string> = {
  Present: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
  WFH:     'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
  HalfDay: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
  Absent:  'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20',
};
const statusChip = (s: string) =>
  STATUS_CHIP[s] ?? 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20';

const SELECT_CLS =
  'appearance-none bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white ' +
  'rounded-xl pl-3.5 pr-9 py-2.5 text-sm font-medium cursor-pointer ' +
  'focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition';

const START_YEAR = 2024;
const YEARS = Array.from({ length: new Date().getFullYear() - START_YEAR + 1 }, (_, i) => START_YEAR + i);

const fullMonths = ['January','February','March','April','May','June','July','August','September','October','November','December'];

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
    Present: { bg: 'bg-emerald-500/10 border-emerald-500/30', text: 'text-emerald-700 dark:text-emerald-400', dot: 'bg-emerald-500' },
    WFH:     { bg: 'bg-blue-500/10 border-blue-500/30',       text: 'text-blue-700 dark:text-blue-400',       dot: 'bg-blue-500' },
    HalfDay: { bg: 'bg-amber-500/10 border-amber-500/30',     text: 'text-amber-700 dark:text-amber-400',     dot: 'bg-amber-500' },
    Absent:  { bg: 'bg-rose-500/10 border-rose-500/25',       text: 'text-rose-700 dark:text-rose-400',       dot: 'bg-rose-500' },
    Weekend: { bg: 'bg-slate-100 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700/40', text: 'text-slate-400 dark:text-slate-600', dot: 'bg-slate-300 dark:bg-slate-600' },
    Future:  { bg: 'bg-slate-50 dark:bg-slate-900/40 border-slate-100 dark:border-slate-800/40',  text: 'text-slate-300 dark:text-slate-700', dot: 'bg-slate-200 dark:bg-slate-700' },
  };

  const weekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  // Pad grid: find what weekday the 1st of the month falls on
  const firstDay = new Date(year, month - 1, 1).getDay();
  const offset = firstDay === 0 ? 6 : firstDay - 1; // Mon=0 offset
  const padded = [...Array(offset).fill(null), ...days];

  return (
    <div>
      <div className="grid grid-cols-7 gap-1.5 mb-2">
        {weekDays.map(d => (
          <div key={d} className="text-center text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 py-1">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1.5">
        {padded.map((day, i) => {
          if (!day) return <div key={`pad-${i}`} />;
          const s = statusStyle[day.status] ?? statusStyle.Absent;
          const d = new Date(day.date);
          const isToday = d.toDateString() === new Date().toDateString();

          return (
            <div
              key={day.date}
              className={`border rounded-xl p-1.5 sm:p-2 min-h-[52px] transition hover:scale-[1.03] ${s.bg} ${isToday ? 'ring-2 ring-blue-500' : ''}`}
              title={`${d.toDateString()} — ${day.status}${day.checkIn ? ` | In: ${day.checkIn}` : ''}${day.checkOut ? ` | Out: ${day.checkOut}` : ''}${day.tasksCompleted ? ` | Tasks: ${day.tasksCompleted}` : ''}`}
            >
              <div className="flex items-center justify-between">
                <span className={`text-xs font-bold ${s.text}`}>{d.getDate()}</span>
                <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
              </div>
              {day.status !== 'Weekend' && day.status !== 'Future' && day.status !== 'Absent' && (
                <p className="hidden sm:block text-[10px] text-slate-500 dark:text-slate-400 mt-1 truncate">{day.workHours}</p>
              )}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-5">
        {Object.entries(statusStyle).filter(([k]) => k !== 'Future').map(([status, style]) => (
          <div key={status} className="flex items-center gap-1.5">
            <span className={`w-2.5 h-2.5 rounded-full ${style.dot}`} />
            <span className="text-xs text-slate-600 dark:text-slate-400">{status}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

// ─── Attendance Ring ──────────────────────────────────────────────────────────

const AttendanceRing = ({ pct, label }: { pct: number; label: string }) => {
  const r = 34;
  const c = 2 * Math.PI * r;
  const color = pct >= 90 ? '#10b981' : pct >= 75 ? '#f59e0b' : '#f43f5e';
  const textCls = pct >= 90 ? 'text-emerald-600 dark:text-emerald-400' : pct >= 75 ? 'text-amber-600 dark:text-amber-400' : 'text-rose-600 dark:text-rose-400';

  return (
    <Card className="p-5 flex flex-col items-center justify-center">
      <div className="relative w-24 h-24 mb-3">
        <svg className="w-24 h-24 -rotate-90" viewBox="0 0 80 80">
          <circle cx="40" cy="40" r={r} fill="none" strokeWidth="8" className="stroke-slate-200 dark:stroke-slate-800" />
          <circle
            cx="40" cy="40" r={r} fill="none"
            stroke={color}
            strokeWidth="8"
            strokeDasharray={`${c}`}
            strokeDashoffset={`${c * (1 - Math.min(pct, 100) / 100)}`}
            strokeLinecap="round"
            className="transition-all duration-700"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={`text-xl font-extrabold ${textCls}`}>{pct}%</span>
        </div>
      </div>
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Attendance</p>
      <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{label}</p>
    </Card>
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

  if (loading && !attendance) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
        <div className="h-24 bg-slate-100 dark:bg-slate-800/60 rounded-2xl animate-pulse" />
        <div className="h-20 bg-slate-100 dark:bg-slate-800/60 rounded-2xl animate-pulse" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-36 bg-slate-100 dark:bg-slate-800/60 rounded-2xl animate-pulse" />)}
        </div>
      </div>
    );
  }

  const user = attendance?.user;
  const fmtShort = (d: string) =>
    new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

  const tabs = [
    { key: 'overview' as const, label: 'Overview', icon: BarChart3 },
    { key: 'calendar' as const, label: 'Calendar', icon: CalendarDays },
    { key: 'report'   as const, label: 'Report',   icon: ClipboardList },
  ];

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* ── Page Header ── */}
      <PageHeader
        title={user?.fullName ?? 'Employee'}
        description={`${user?.role ?? ''}${user?.email ? ` · ${user.email}` : ''}`}
        breadcrumbs={[
          { label: 'Workspace', href: '/' },
          { label: 'Manager Dashboard', href: '/manager' },
          { label: user?.fullName ?? 'Employee' },
        ]}
        actions={
          <>
            <button
              onClick={() => navigate('/manager')}
              className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition"
            >
              <ArrowLeft className="w-4 h-4" /> Back
            </button>
            <button
              onClick={() => handleDownload('pdf')}
              disabled={!!downloading}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold bg-rose-600 hover:bg-rose-500 text-white shadow-md shadow-rose-500/20 transition disabled:opacity-50"
            >
              {downloading === 'pdf' ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
              PDF
            </button>
            <button
              onClick={() => handleDownload('docx')}
              disabled={!!downloading}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-500/20 transition disabled:opacity-50"
            >
              {downloading === 'docx' ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
              Word
            </button>
          </>
        }
        className="!mb-0"
      >
        {user && (
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center text-lg font-bold text-white shadow-md">
              {user.fullName.charAt(0)}
            </div>
            <span className="inline-flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
              <Mail className="w-3.5 h-3.5" /> {user.email}
            </span>
          </div>
        )}
      </PageHeader>

      {/* ── Filters ── */}
      <Card>
        <CardContent className="!py-4">
          <div className="flex flex-col xl:flex-row xl:items-end gap-4">
            <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">
                  <CalendarRange className="w-3.5 h-3.5" /> Report From
                </label>
                <DatePicker value={fromDate} onChange={setFromDate} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">Report To</label>
                <DatePicker value={toDate} onChange={setToDate} />
              </div>
            </div>

            <div className="hidden xl:block w-px h-10 bg-slate-200 dark:bg-slate-800" />

            <div>
              <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">
                <CalendarDays className="w-3.5 h-3.5" /> Calendar Month
              </label>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <select value={month} onChange={e => setMonth(parseInt(e.target.value))} className={SELECT_CLS}>
                    {fullMonths.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
                  </select>
                  <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
                <div className="relative">
                  <select value={year} onChange={e => setYear(parseInt(e.target.value))} className={SELECT_CLS}>
                    {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                  <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
                <button
                  onClick={loadData}
                  disabled={loading}
                  title="Refresh"
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-500/20 transition disabled:opacity-60"
                >
                  <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                  Apply
                </button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Tabs ── */}
      <div className="inline-flex gap-1 p-1.5 rounded-2xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
        {tabs.map(t => {
          const Icon = t.icon;
          return (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition ${
                activeTab === t.key
                  ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Icon className="w-4 h-4" /> {t.label}
            </button>
          );
        })}
      </div>

      {/* ── OVERVIEW TAB ──────────────────────────────────────────────────────── */}
      {activeTab === 'overview' && attendance && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="col-span-2 lg:col-span-1">
              <AttendanceRing pct={attendance.attendancePercentage} label={`${fullMonths[month - 1]} ${year}`} />
            </div>

            <Card className="p-5">
              <div className="flex items-start justify-between">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Days Present</p>
                <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  <UserCheck className="w-4 h-4" />
                </div>
              </div>
              <p className="text-3xl font-extrabold text-slate-900 dark:text-white mt-1">{attendance.daysPresent}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">of {attendance.workingDaysInMonth} working days</p>
              <div className="flex flex-wrap gap-1.5 mt-3">
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400">
                  <Home className="w-3 h-3" /> WFH {attendance.daysWFH}
                </span>
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400">
                  Half {attendance.daysHalfDay}
                </span>
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400">
                  Absent {attendance.daysAbsent}
                </span>
              </div>
            </Card>

            <StatCard
              title="Work Hours"
              value={attendance.totalWorkHours}
              subtitle={`Avg ${attendance.averageDailyHours}h / day`}
              icon={Timer}
              color="blue"
            />
            <StatCard
              title="Tasks Completed"
              value={attendance.totalTasksCompleted}
              subtitle={`Support given ${attendance.totalSupportGiven} times`}
              icon={ListChecks}
              color="purple"
            />
          </div>

          {/* Recent activity table */}
          {fullReport && fullReport.dailyEntries.length > 0 ? (
            <Card className="overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                  <Clock className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">Recent Activity</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{fullReport.dailyEntries.length} days logged · showing latest 15</p>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[720px]">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-800/40 border-b border-slate-200 dark:border-slate-800">
                      {['Date', 'Status', 'Check In', 'Check Out', 'Work Hours', 'Tasks', 'Support'].map(h => (
                        <th key={h} className="text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                    {fullReport.dailyEntries.slice().reverse().slice(0, 15).map(entry => (
                      <tr key={entry.date} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition">
                        <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white whitespace-nowrap">
                          {new Date(entry.date).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${statusChip(entry.dayStatus)}`}>
                            {entry.dayStatus}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{entry.checkIn}</td>
                        <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{entry.checkOut}</td>
                        <td className="px-4 py-3 font-semibold text-blue-600 dark:text-blue-400">{entry.workHours}</td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{entry.tasksSummary.length} task(s)</td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{entry.supportSummary.length} log(s)</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          ) : (
            <div className="text-center py-12 rounded-3xl border-2 border-dashed border-slate-200 dark:border-slate-800">
              <Inbox className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-600" />
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 mt-2">No activity in this report period</p>
            </div>
          )}
        </div>
      )}

      {/* ── CALENDAR TAB ──────────────────────────────────────────────────────── */}
      {activeTab === 'calendar' && (
        <Card>
          <CardContent>
            <div className="flex items-center gap-2.5 mb-5">
              <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                <CalendarDays className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Attendance Calendar — {fullMonths[month - 1]} {year}
              </h3>
            </div>
            <AttendanceCalendar days={calendar} month={month} year={year} />
          </CardContent>
        </Card>
      )}

      {/* ── REPORT TAB ────────────────────────────────────────────────────────── */}
      {activeTab === 'report' && fullReport && (
        <div className="space-y-4">
          {/* Summary banner */}
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 p-5 sm:p-6 text-white shadow-lg">
            <div className="absolute -top-16 -right-16 w-48 h-48 bg-white/10 rounded-full blur-2xl pointer-events-none" />
            <p className="text-xs font-semibold uppercase tracking-wider text-white/70">Report Period</p>
            <p className="text-lg font-bold mt-0.5">
              {fmtShort(fullReport.fromDate)} – {fmtShort(fullReport.toDate)}
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
              {[
                { l: 'Attendance', v: `${fullReport.attendancePercentage}%` },
                { l: 'Work Hours', v: fullReport.totalWorkHours },
                { l: 'Tasks',      v: `${fullReport.totalTasksCompleted}/${fullReport.totalTasksLogged}` },
                { l: 'Support',    v: fullReport.totalSupportGiven.toString() },
              ].map(s => (
                <div key={s.l} className="rounded-2xl bg-white/10 border border-white/15 px-3 py-2.5">
                  <p className="text-[11px] text-white/70">{s.l}</p>
                  <p className="text-lg font-bold">{s.v}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Daily entries */}
          {fullReport.dailyEntries.slice().reverse().map(entry => (
            <Card key={entry.date} className="p-4 sm:p-5">
              <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
                <div className="flex items-center gap-2.5">
                  <p className="text-sm font-bold text-slate-900 dark:text-white">
                    {new Date(entry.date).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
                  </p>
                  <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${statusChip(entry.dayStatus)}`}>
                    {entry.dayStatus}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                  <span className="inline-flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> {entry.checkIn} → {entry.checkOut}</span>
                  <span className="font-bold text-blue-600 dark:text-blue-400">{entry.workHours}</span>
                  <span className="inline-flex items-center gap-1"><Coffee className="w-3.5 h-3.5" /> {entry.breakMinutes}m</span>
                </div>
              </div>

              {entry.tasksSummary.length > 0 && (
                <div className="mb-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">Tasks</p>
                  <div className="space-y-1">
                    {entry.tasksSummary.map((t, i) => {
                      const Icon = t.startsWith('[Completed]') ? CheckCircle2 : t.startsWith('[Blocked]') ? Ban : RefreshCcw;
                      const cls = t.startsWith('[Completed]') ? 'text-emerald-500' : t.startsWith('[Blocked]') ? 'text-rose-500' : 'text-blue-500';
                      return (
                        <p key={i} className="flex items-start gap-2 text-xs text-slate-700 dark:text-slate-300 pl-3 border-l-2 border-slate-200 dark:border-slate-700">
                          <Icon className={`w-3.5 h-3.5 shrink-0 mt-0.5 ${cls}`} /> {t}
                        </p>
                      );
                    })}
                  </div>
                </div>
              )}

              {entry.supportSummary.length > 0 && (
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">Support Given</p>
                  <div className="space-y-1">
                    {entry.supportSummary.map((s, i) => (
                      <p key={i} className="flex items-start gap-2 text-xs text-slate-700 dark:text-slate-300 pl-3 border-l-2 border-violet-300 dark:border-violet-700">
                        <LifeBuoy className="w-3.5 h-3.5 shrink-0 mt-0.5 text-violet-500" /> {s}
                      </p>
                    ))}
                  </div>
                </div>
              )}

              {entry.notes && (
                <p className="flex items-start gap-1.5 text-xs italic text-slate-500 dark:text-slate-400 mt-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                  <StickyNote className="w-3.5 h-3.5 shrink-0 mt-0.5" /> {entry.notes}
                </p>
              )}
            </Card>
          ))}

          {fullReport.dailyEntries.length === 0 && (
            <div className="text-center py-12 rounded-3xl border-2 border-dashed border-slate-200 dark:border-slate-800">
              <Inbox className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-600" />
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 mt-2">No activity logged in this date range.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};