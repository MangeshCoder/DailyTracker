// ─────────────────────────────────────────────────────────────────────────────
//  FILE: ui/src/pages/Managerdashboardpage.tsx
//  Manager Dashboard - Modern Design System Upgrade
//
//  Logic unchanged from previous version:
//  ✅ Daily Activity   — team daily status by date, member detail modal
//  ✅ Monthly Stats    — attendance table, details + report download
//  ✅ Attendance       — per-member attendance cards
//  ✅ User Management  — activate / deactivate users
//  ✅ Report download  — HTML/PDF or Word (.docx) for a date range
//  ✅ Attendance calendar modal (now reachable via "Calendar" button)
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useMemo } from 'react';
import { managerApi, downloadBlob } from '../services/api';
import type {
  ManagerTeamDaily,
  TeamMonthlyStats,
  UserAttendanceSummary,
  AttendanceDay,
  UserDailyActivity,
  User,
  ManagerUserDto,
} from '../types';
import { SupportMediaDisplay } from '../components/SupportMediaDisplay';
import { useConfirm } from '../hooks/useConfirm';
import { DatePicker } from '../components/DatePicker';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '../components/ui/PageHeader';
import { StatCard } from '../components/ui/StatCard';
import { Card, CardContent } from '../components/ui/Card';
import {
  ClipboardList,
  BarChart3,
  CalendarDays,
  Users,
  UserCheck,
  UserX,
  UserCog,
  Download,
  FileText,
  Globe,
  Loader2,
  X,
  Clock,
  Timer,
  Coffee,
  ListChecks,
  LifeBuoy,
  CheckCircle2,
  Ban,
  RefreshCw,
  PauseOctagon,
  ChevronDown,
  Eye,
  Search,
  Percent,
  Shield,
  Mail,
  Info,
  CalendarRange,
} from 'lucide-react';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_BADGE: Record<string, string> = {
  Present: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
  WFH:     'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
  HalfDay: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
  Absent:  'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20',
  Weekend: 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20',
  Holiday: 'bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20',
  Future:  'bg-slate-500/5 text-slate-400 dark:text-slate-600 border-slate-500/10',
};
const statusBadge = (status: string) =>
  STATUS_BADGE[status] ?? 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20';

const attendanceColor = (pct: number) => {
  if (pct >= 90) return 'text-emerald-600 dark:text-emerald-400';
  if (pct >= 75) return 'text-amber-600 dark:text-amber-400';
  return 'text-rose-600 dark:text-rose-400';
};

const attendanceBar = (pct: number) =>
  pct >= 90 ? 'bg-emerald-500' : pct >= 75 ? 'bg-amber-500' : 'bg-rose-500';

const TASK_ICON: Record<string, { icon: React.ElementType; cls: string }> = {
  Completed:  { icon: CheckCircle2, cls: 'text-emerald-500' },
  Blocked:    { icon: Ban,          cls: 'text-rose-500' },
  OnHold:     { icon: PauseOctagon, cls: 'text-amber-500' },
  InProgress: { icon: RefreshCw,    cls: 'text-blue-500' },
};

const SELECT_CLS =
  'appearance-none bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white ' +
  'rounded-xl pl-3.5 pr-9 py-2.5 text-sm font-medium cursor-pointer ' +
  'focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition';

const START_YEAR = 2024;
const YEARS = Array.from(
  { length: new Date().getFullYear() - START_YEAR + 1 },
  (_, i) => START_YEAR + i,
);

const Avatar = ({ name, size = 'md' }: { name: string; size?: 'sm' | 'md' | 'lg' }) => {
  const sz = size === 'sm' ? 'w-8 h-8 text-xs' : size === 'lg' ? 'w-12 h-12 text-base' : 'w-10 h-10 text-sm';
  return (
    <div className={`${sz} rounded-full bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center font-bold text-white shrink-0`}>
      {name.charAt(0)}
    </div>
  );
};

const Spinner = () => (
  <div className="flex justify-center py-16">
    <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
  </div>
);

const EmptyBlock = ({ icon: Icon, title, text }: { icon: React.ElementType; title: string; text?: string }) => (
  <div className="text-center py-14 px-4 rounded-3xl border-2 border-dashed border-slate-200 dark:border-slate-800">
    <Icon className="w-9 h-9 mx-auto text-slate-300 dark:text-slate-600" />
    <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 mt-3">{title}</p>
    {text && <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{text}</p>}
  </div>
);

// ─── Modal Shell ──────────────────────────────────────────────────────────────

const ModalShell = ({
  onClose, maxWidth = 'max-w-lg', header, children,
}: {
  onClose: () => void; maxWidth?: string; header: React.ReactNode; children: React.ReactNode;
}) => (
  <div
    className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-sm p-4 animate-in fade-in duration-200"
    onClick={onClose}
  >
    <div
      className={`bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full ${maxWidth} shadow-2xl overflow-hidden flex flex-col max-h-[90vh]`}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="relative bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 p-5 sm:p-6 text-white">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-full bg-black/20 hover:bg-black/40 text-white/80 hover:text-white transition"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>
        <div className="pr-10">{header}</div>
      </div>
      <div className="p-5 sm:p-6 overflow-y-auto flex-1">{children}</div>
    </div>
  </div>
);

// ─── Month / Year Picker ──────────────────────────────────────────────────────

const MonthYearPicker = ({
  month, year, onMonth, onYear,
}: {
  month: number; year: number; onMonth: (m: number) => void; onYear: (y: number) => void;
}) => (
  <div className="flex items-center gap-2">
    <div className="relative">
      <select value={month} onChange={e => onMonth(+e.target.value)} className={SELECT_CLS}>
        {Array.from({ length: 12 }, (_, i) => (
          <option key={i + 1} value={i + 1}>
            {new Date(2024, i, 1).toLocaleString('default', { month: 'long' })}
          </option>
        ))}
      </select>
      <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
    </div>
    <div className="relative">
      <select value={year} onChange={e => onYear(+e.target.value)} className={SELECT_CLS}>
        {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
      </select>
      <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
    </div>
  </div>
);

// ─── Report Download Widget ───────────────────────────────────────────────────

const DownloadReport = ({
  userId, userName, isManager
}: { userId: number; userName: string; isManager: boolean }) => {
  const [from, setFrom] = useState(() => {
    const d = new Date(); d.setDate(1);
    return d.toISOString().split('T')[0];
  });
  const [to, setTo]         = useState(new Date().toISOString().split('T')[0]);
  const [format, setFormat] = useState<'pdf' | 'docx'>('pdf');
  const [loading, setLoading] = useState(false);

  const handleDownload = async () => {
    setLoading(true);
    try {
      let res;
      if (isManager) {
        res = await managerApi.downloadUserReport(userId, format, from, to);
      } else {
        const { reportApi } = await import('../services/api');
        res = await reportApi.downloadMyReport(format, from, to);
      }
      const ext  = format === 'docx' ? 'docx' : 'html';
      const name = `Report_${userName.replace(/\s/g, '_')}_${from}_to_${to}.${ext}`;
      downloadBlob(res.data, name);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 sm:p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
      <h4 className="text-sm font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
        <span className="p-1.5 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
          <Download className="w-3.5 h-3.5" />
        </span>
        Download Report
      </h4>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <div>
          <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">From</label>
          <DatePicker value={from} onChange={setFrom} />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">To</label>
          <DatePicker value={to} onChange={setTo} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 p-1 mb-4 rounded-xl bg-slate-200/60 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
        {(['pdf', 'docx'] as const).map(f => (
          <button
            key={f}
            type="button"
            onClick={() => setFormat(f)}
            className={`inline-flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs sm:text-sm font-semibold transition ${
              format === f
                ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-sm'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white'
            }`}
          >
            {f === 'pdf' ? <Globe className="w-4 h-4" /> : <FileText className="w-4 h-4" />}
            {f === 'pdf' ? 'HTML / PDF' : 'Word (.docx)'}
          </button>
        ))}
      </div>

      <button
        onClick={handleDownload}
        disabled={loading}
        className="w-full inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold py-2.5 rounded-xl shadow-md shadow-blue-500/20 transition disabled:opacity-50"
      >
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
        {loading ? 'Generating…' : `Download ${format.toUpperCase()} Report`}
      </button>
      {format === 'pdf' && (
        <p className="flex items-center justify-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400 mt-2.5">
          <Info className="w-3.5 h-3.5" /> Opens as HTML → use browser Print → Save as PDF
        </p>
      )}
    </div>
  );
};

// ─── Member Card (daily view) ─────────────────────────────────────────────────

const MemberCard = ({ member, onExpand }: {
  member: UserDailyActivity;
  onExpand: (m: UserDailyActivity) => void;
}) => (
  <Card hover onClick={() => onExpand(member)} className="p-4 cursor-pointer group">
    <div className="flex items-center gap-3 mb-4">
      <Avatar name={member.user.fullName} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-slate-900 dark:text-white truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition">
          {member.user.fullName}
        </p>
        <p className="text-xs text-slate-500 dark:text-slate-400">{member.user.role}</p>
      </div>
      <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border shrink-0 ${statusBadge(member.dayStatus)}`}>
        {member.dayStatus}
      </span>
    </div>

    <div className="grid grid-cols-4 gap-2 text-center">
      {[
        { l: 'In',    v: member.checkInTime  ?? '--', c: 'text-slate-900 dark:text-white' },
        { l: 'Out',   v: member.checkOutTime ?? '--', c: 'text-slate-900 dark:text-white' },
        { l: 'Work',  v: member.workHours,             c: 'text-blue-600 dark:text-blue-400' },
        { l: 'Tasks', v: `${member.tasksCompleted}/${member.tasksTotal}`, c: 'text-emerald-600 dark:text-emerald-400' },
      ].map(i => (
        <div key={i.l} className="rounded-xl p-2 bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">{i.l}</p>
          <p className={`text-xs font-bold mt-0.5 truncate ${i.c}`}>{i.v}</p>
        </div>
      ))}
    </div>

    {(member.isOnBreak || member.supportGiven > 0) && (
      <div className="flex flex-wrap items-center gap-2 mt-3">
        {member.isOnBreak && (
          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
            <span className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-pulse" />
            On {member.activeBreakType} Break
          </span>
        )}
        {member.supportGiven > 0 && (
          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-violet-500/10 text-violet-600 dark:text-violet-400 border border-violet-500/20">
            <LifeBuoy className="w-3 h-3" />
            Helped {member.supportGiven} developer{member.supportGiven > 1 ? 's' : ''}
          </span>
        )}
      </div>
    )}
  </Card>
);

// ─── Attendance Calendar ──────────────────────────────────────────────────────
// Smart color key: "Weekend" with a check-in → orange (worked).
// "Holiday" with a check-in → bright violet (worked).

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
          <div key={d} className="text-center text-[11px] font-semibold uppercase text-slate-500 dark:text-slate-400 py-1">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {days.length > 0 && Array.from({ length: new Date(days[0].date).getDay() }).map((_, i) => (
          <div key={`e-${i}`} />
        ))}
        {days.map(day => {
          let colorKey = day.status;
          if (day.status === 'Weekend' && day.checkIn) colorKey = 'WeekendWorked';
          if (day.status === 'Holiday' && day.checkIn) colorKey = 'HolidayWorked';

          const tooltipSuffix = day.checkIn ? ` | In: ${day.checkIn}` : '';

          return (
            <div
              key={day.date}
              title={`${new Date(day.date).toDateString()} — ${day.status}${tooltipSuffix}${day.checkOut ? ` Out: ${day.checkOut}` : ''}`}
              className={`aspect-square flex items-center justify-center rounded-lg text-xs font-semibold cursor-default transition hover:scale-110 ${calColors[colorKey] ?? 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}
            >
              {new Date(day.date).getDate()}
            </div>
          );
        })}
      </div>
      {/* Legend */}
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
        ].map(item => (
          <span key={item.l} className="flex items-center gap-1.5 text-[11px] text-slate-600 dark:text-slate-400">
            <span className={`w-2.5 h-2.5 rounded ${item.c}`} />{item.l}
          </span>
        ))}
      </div>
    </div>
  );
};

// ─── Main Manager Dashboard Page ──────────────────────────────────────────────

type Tab = 'daily' | 'monthly' | 'attendance' | 'User';

export const ManagerDashboardPage = () => {
  const [tab, setTab]                       = useState<Tab>('daily');
  const navigate = useNavigate();
  const [teamDaily, setTeamDaily]           = useState<ManagerTeamDaily | null>(null);
  const [teamMonthly, setTeamMonthly]       = useState<TeamMonthlyStats | null>(null);
  const [selectedDate, setSelectedDate]     = useState(new Date().toISOString().split('T')[0]);
  const [selectedMonth, setSelectedMonth]   = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear]     = useState(new Date().getFullYear());
  const [loading, setLoading]               = useState(false);
  const [expandedMember, setExpandedMember] = useState<UserDailyActivity | null>(null);
  const [selectedUserForReport, setSelectedUserForReport] = useState<User | null>(null);
  const [userCalendar, setUserCalendar]     = useState<AttendanceDay[]>([]);
  const [calendarUser, setCalendarUser]     = useState<UserAttendanceSummary | null>(null);
  const [showCalendar, setShowCalendar]     = useState(false);
  const [users, setUsers]                   = useState<ManagerUserDto[]>([]);
  const [loadingUsers, setLoadingUsers]     = useState(false);
  const [userSearch, setUserSearch]         = useState('');
  const { alert } = useConfirm();

  const loadDaily = async () => {
    setLoading(true);
    try {
      const res = await managerApi.getTeamDaily(selectedDate);
      setTeamDaily(res.data);
    } finally { setLoading(false); }
  };

  const handleToggleUser = async (userId: number) => {
    try {
      await managerApi.toggleUserStatus(userId);
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, isActive: !u.isActive } : u));
    } catch (err: any) {
      await alert(err.response?.data?.message || 'Error updating status', 'error');
    }
  };

  const loadMonthly = async () => {
    setLoading(true);
    try {
      const res = await managerApi.getTeamMonthly(selectedMonth, selectedYear);
      setTeamMonthly(res.data);
    } finally { setLoading(false); }
  };

  useEffect(() => {
    if (tab === 'daily') loadDaily();
    else if (tab === 'monthly' || tab === 'attendance') loadMonthly();
  }, [tab, selectedDate, selectedMonth, selectedYear]);

  const openUserCalendar = async (member: UserAttendanceSummary) => {
    setCalendarUser(member);
    const res = await managerApi.getUserCalendar(member.user.id, selectedMonth, selectedYear);
    setUserCalendar(res.data);
    setShowCalendar(true);
  };

  const fetchUsers = async () => {
    try {
      setLoadingUsers(true);
      const res = await managerApi.getAllUsers();
      setUsers(res.data);
    } catch { console.error('Failed to fetch users'); }
    finally { setLoadingUsers(false); }
  };

  useEffect(() => { fetchUsers(); }, []);

  const monthName = new Date(selectedYear, selectedMonth - 1, 1)
    .toLocaleString('default', { month: 'long' });

  const onBreakCount = teamDaily?.members.filter(m => m.isOnBreak).length ?? 0;
  const activeUsers  = users.filter(u => u.isActive).length;

  const filteredUsers = useMemo(() => {
    const q = userSearch.trim().toLowerCase();
    if (!q) return users;
    return users.filter(u =>
      u.fullName.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      u.role.toLowerCase().includes(q),
    );
  }, [users, userSearch]);

  const tabs: { key: Tab; label: string; icon: React.ElementType }[] = [
    { key: 'daily',      label: 'Daily Activity',  icon: ClipboardList },
    { key: 'monthly',    label: 'Monthly Stats',   icon: BarChart3 },
    { key: 'attendance', label: 'Attendance',      icon: CalendarDays },
    { key: 'User',       label: 'User Management', icon: UserCog },
  ];

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* ── Page Header ── */}
      <PageHeader
        title="Manager Dashboard"
        description="Monitor your team's activity, attendance & productivity."
        breadcrumbs={[
          { label: 'Workspace', href: '/' },
          { label: 'Management' },
          { label: 'Manager Dashboard' },
        ]}
        badge={{ label: `${users.length} Members`, variant: 'purple', icon: <Users className="w-3 h-3" /> }}
        className="!mb-0"
      />

      {/* ── Tabs ── */}
      <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
        <div className="inline-flex gap-1 p-1.5 rounded-2xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          {tabs.map(t => {
            const Icon = t.icon;
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold whitespace-nowrap transition ${
                  active
                    ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-sm'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Icon className="w-4 h-4" />
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ─── DAILY TAB ─────────────────────────────────────────────────────── */}
      {tab === 'daily' && (
        <div className="space-y-6">
          <Card>
            <CardContent className="!py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                  <CalendarDays className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-900 dark:text-white">Team Activity</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Select a date to view check-ins & tasks</p>
                </div>
              </div>
              <div className="sm:w-56">
                <DatePicker value={selectedDate} onChange={setSelectedDate} />
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard title="Checked In"  value={teamDaily?.checkedIn ?? 0}    subtitle="Present today"      icon={UserCheck} color="emerald" loading={loading && !teamDaily} />
            <StatCard title="Not In"      value={teamDaily?.notCheckedIn ?? 0} subtitle="Not checked in yet" icon={UserX}     color="rose"    loading={loading && !teamDaily} />
            <StatCard title="On Break"    value={onBreakCount}                  subtitle="Right now"          icon={Coffee}    color="amber"   loading={loading && !teamDaily} />
            <StatCard title="Total Team"  value={teamDaily?.totalMembers ?? 0} subtitle="Members"            icon={Users}     color="blue"    loading={loading && !teamDaily} />
          </div>

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {[1, 2, 3, 4, 5, 6].map(i => (
                <div key={i} className="h-40 rounded-2xl bg-slate-100 dark:bg-slate-800/60 animate-pulse" />
              ))}
            </div>
          ) : !teamDaily?.members.length ? (
            <EmptyBlock icon={Users} title="No team activity" text="No members found for this date." />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {teamDaily.members.map(member => (
                <MemberCard key={member.user.id} member={member} onExpand={setExpandedMember} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ─── MONTHLY TAB ───────────────────────────────────────────────────── */}
      {tab === 'monthly' && (
        <div className="space-y-6">
          <Card>
            <CardContent className="!py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                  <BarChart3 className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-900 dark:text-white">Monthly Stats</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{monthName} {selectedYear}</p>
                </div>
              </div>
              <MonthYearPicker month={selectedMonth} year={selectedYear} onMonth={setSelectedMonth} onYear={setSelectedYear} />
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatCard title="Team Avg Attendance" value={`${teamMonthly?.teamAverageAttendance ?? 0}%`} icon={Percent}    color="emerald" loading={loading && !teamMonthly} />
            <StatCard title="Tasks Done"          value={teamMonthly?.teamTotalTasksCompleted ?? 0}      icon={ListChecks} color="purple"  loading={loading && !teamMonthly} />
            <StatCard title="Support Logs"        value={teamMonthly?.teamTotalSupportLogs ?? 0}         icon={LifeBuoy}   color="amber"   loading={loading && !teamMonthly} />
          </div>

          {loading ? (
            <Spinner />
          ) : !teamMonthly?.members.length ? (
            <EmptyBlock icon={BarChart3} title="No monthly data" text={`No attendance records for ${monthName} ${selectedYear}.`} />
          ) : (
            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[900px]">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-800/40 border-b border-slate-200 dark:border-slate-800">
                      {[
                        { l: 'Team Member', a: 'text-left pl-5' },
                        { l: 'Attendance',  a: 'text-center' },
                        { l: 'Present',     a: 'text-center' },
                        { l: 'WFH',         a: 'text-center' },
                        { l: 'Absent',      a: 'text-center' },
                        { l: 'Weekend',     a: 'text-center' },
                        { l: 'Holiday',     a: 'text-center' },
                        { l: 'Work Hours',  a: 'text-center' },
                        { l: 'Actions',     a: 'text-center pr-5' },
                      ].map(h => (
                        <th key={h.l} className={`px-4 py-3.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 ${h.a}`}>
                          {h.l}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                    {teamMonthly.members.map(member => (
                      <tr key={member.user.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition">
                        <td className="pl-5 pr-4 py-3.5">
                          <div className="flex items-center gap-3">
                            <Avatar name={member.user.fullName} size="sm" />
                            <div className="min-w-0">
                              <p className="font-semibold text-slate-900 dark:text-white truncate">{member.user.fullName}</p>
                              <p className="text-xs text-slate-500 dark:text-slate-400">{member.user.role}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="flex flex-col items-center gap-1.5">
                            <span className={`text-base font-bold ${attendanceColor(member.attendancePercentage)}`}>
                              {member.attendancePercentage}%
                            </span>
                            <div className="w-16 h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                              <div className={`h-full rounded-full ${attendanceBar(member.attendancePercentage)}`}
                                style={{ width: `${member.attendancePercentage}%` }} />
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3.5 text-center font-semibold text-emerald-600 dark:text-emerald-400">
                          {member.daysPresent + member.daysWFH + member.daysHalfDay}
                          <span className="text-slate-400 dark:text-slate-600 font-normal">/{member.workingDaysInMonth}</span>
                        </td>
                        <td className="px-4 py-3.5 text-center font-medium text-blue-600 dark:text-blue-400">{member.daysWFH}</td>
                        <td className="px-4 py-3.5 text-center font-medium text-rose-600 dark:text-rose-400">{member.daysAbsent}</td>
                        <td className="px-4 py-3.5 text-center font-semibold text-orange-600 dark:text-orange-400">
                          {(member.daysWeekend ?? 0) > 0 ? member.daysWeekend : <span className="text-slate-300 dark:text-slate-600">—</span>}
                        </td>
                        <td className="px-4 py-3.5 text-center font-semibold text-violet-600 dark:text-violet-400">
                          {(member.daysHoliday ?? 0) > 0 ? member.daysHoliday : <span className="text-slate-300 dark:text-slate-600">—</span>}
                        </td>
                        <td className="px-4 py-3.5 text-center font-semibold text-slate-900 dark:text-white">{member.totalWorkHours}</td>
                        <td className="pl-4 pr-5 py-3.5">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => navigate(`/manager/user/${member.user.id}`)}
                              title="View details"
                              className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 transition"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setSelectedUserForReport(member.user)}
                              title="Download report"
                              className="p-2 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 dark:text-blue-400 border border-blue-500/20 transition"
                            >
                              <Download className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </div>
      )}

      {/* ─── ATTENDANCE TAB ────────────────────────────────────────────────── */}
      {tab === 'attendance' && (
        <div className="space-y-6">
          <Card>
            <CardContent className="!py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  <CalendarRange className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-900 dark:text-white">Attendance Overview</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{monthName} {selectedYear}</p>
                </div>
              </div>
              <MonthYearPicker month={selectedMonth} year={selectedYear} onMonth={setSelectedMonth} onYear={setSelectedYear} />
            </CardContent>
          </Card>

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-60 rounded-2xl bg-slate-100 dark:bg-slate-800/60 animate-pulse" />
              ))}
            </div>
          ) : !teamMonthly?.members.length ? (
            <EmptyBlock icon={CalendarDays} title="No attendance data" text={`No records for ${monthName} ${selectedYear}.`} />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {teamMonthly.members.map(member => {
                const wd = member.workingDaysInMonth || 1;
                return (
                  <Card key={member.user.id} hover className="p-5">
                    <div className="flex items-center gap-3 mb-4">
                      <Avatar name={member.user.fullName} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{member.user.fullName}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{member.user.email}</p>
                      </div>
                      <span className={`text-xl font-extrabold ${attendanceColor(member.attendancePercentage)}`}>
                        {member.attendancePercentage}%
                      </span>
                    </div>

                    {/* Stacked progress bar */}
                    <div className="h-2.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden flex mb-4">
                      <div className="bg-emerald-500 h-full" style={{ width: `${(member.daysPresent / wd) * 100}%` }} />
                      <div className="bg-blue-500 h-full"    style={{ width: `${(member.daysWFH     / wd) * 100}%` }} />
                      <div className="bg-amber-500 h-full"   style={{ width: `${(member.daysHalfDay / wd) * 100}%` }} />
                      <div className="bg-orange-500 h-full"  style={{ width: `${((member.daysWeekend ?? 0) / wd) * 100}%` }} />
                      <div className="bg-violet-500 h-full"  style={{ width: `${((member.daysHoliday ?? 0) / wd) * 100}%` }} />
                      <div className="bg-rose-500 h-full"    style={{ width: `${(member.daysAbsent  / wd) * 100}%` }} />
                    </div>

                    <div className="grid grid-cols-4 gap-1.5 text-center mb-2">
                      {[
                        { v: member.daysPresent, l: 'Office', c: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' },
                        { v: member.daysWFH,     l: 'WFH',    c: 'bg-blue-500/10 text-blue-600 dark:text-blue-400' },
                        { v: member.daysHalfDay, l: 'Half',   c: 'bg-amber-500/10 text-amber-600 dark:text-amber-400' },
                        { v: member.daysAbsent,  l: 'Absent', c: 'bg-rose-500/10 text-rose-600 dark:text-rose-400' },
                      ].map(s => (
                        <div key={s.l} className={`rounded-xl py-2 ${s.c}`}>
                          <p className="text-sm font-bold">{s.v}</p>
                          <p className="text-[10px] font-medium text-slate-500 dark:text-slate-400">{s.l}</p>
                        </div>
                      ))}
                    </div>

                    {((member.daysWeekend ?? 0) > 0 || (member.daysHoliday ?? 0) > 0) && (
                      <div className="grid grid-cols-2 gap-1.5 text-center mb-2">
                        {(member.daysWeekend ?? 0) > 0 && (
                          <div className="rounded-xl py-2 bg-orange-500/10 text-orange-600 dark:text-orange-400">
                            <p className="text-sm font-bold">{member.daysWeekend}</p>
                            <p className="text-[10px] font-medium text-slate-500 dark:text-slate-400">Weekend</p>
                          </div>
                        )}
                        {(member.daysHoliday ?? 0) > 0 && (
                          <div className="rounded-xl py-2 bg-violet-500/10 text-violet-600 dark:text-violet-400">
                            <p className="text-sm font-bold">{member.daysHoliday}</p>
                            <p className="text-[10px] font-medium text-slate-500 dark:text-slate-400">Holiday</p>
                          </div>
                        )}
                      </div>
                    )}

                    <div className="grid grid-cols-3 gap-2 mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                      <button
                        onClick={() => openUserCalendar(member)}
                        className="inline-flex items-center justify-center gap-1.5 text-xs font-semibold py-2 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 transition"
                      >
                        <CalendarDays className="w-3.5 h-3.5" /> Calendar
                      </button>
                      <button
                        onClick={() => navigate(`/manager/user/${member.user.id}`)}
                        className="inline-flex items-center justify-center gap-1.5 text-xs font-semibold py-2 rounded-xl bg-violet-500/10 hover:bg-violet-500/20 text-violet-600 dark:text-violet-400 border border-violet-500/20 transition"
                      >
                        <Eye className="w-3.5 h-3.5" /> Details
                      </button>
                      <button
                        onClick={() => setSelectedUserForReport(member.user)}
                        className="inline-flex items-center justify-center gap-1.5 text-xs font-semibold py-2 rounded-xl bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 dark:text-blue-400 border border-blue-500/20 transition"
                      >
                        <Download className="w-3.5 h-3.5" /> Report
                      </button>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ─── USER MANAGEMENT TAB ───────────────────────────────────────────── */}
      {tab === 'User' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatCard title="Total Users" value={users.length}                icon={Users}     color="blue"    loading={loadingUsers} />
            <StatCard title="Active"      value={activeUsers}                 icon={UserCheck} color="emerald" loading={loadingUsers} />
            <StatCard title="Inactive"    value={users.length - activeUsers}  icon={UserX}     color="rose"    loading={loadingUsers} />
          </div>

          <Card>
            <CardContent className="!py-4">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  value={userSearch}
                  onChange={e => setUserSearch(e.target.value)}
                  placeholder="Search by name, email or role…"
                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400 rounded-xl pl-10 pr-10 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition"
                />
                {userSearch && (
                  <button
                    onClick={() => setUserSearch('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded text-slate-400 hover:text-slate-700 dark:hover:text-white"
                    aria-label="Clear search"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </CardContent>
          </Card>

          {loadingUsers ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3, 4, 5, 6].map(i => (
                <div key={i} className="h-32 rounded-2xl bg-slate-100 dark:bg-slate-800/60 animate-pulse" />
              ))}
            </div>
          ) : filteredUsers.length === 0 ? (
            <EmptyBlock icon={Search} title="No users found" text={userSearch ? 'Try a different search term.' : undefined} />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredUsers.map(user => (
                <Card key={user.id} className={`p-4 ${!user.isActive ? 'opacity-75' : ''}`}>
                  <div className="flex items-start gap-3">
                    <Avatar name={user.fullName} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{user.fullName}</p>
                      <p className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                        <Mail className="w-3 h-3 shrink-0" /> {user.email}
                      </p>
                      <span className={`inline-flex items-center gap-1 mt-2 text-[11px] font-semibold px-2 py-0.5 rounded-full border ${
                        user.role === 'Manager'
                          ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20'
                          : user.role === 'Admin'
                            ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
                            : user.role === 'TeamLead'
                              ? 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20'
                              : 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20'
                      }`}>
                        <Shield className="w-3 h-3" /> {user.role}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-100 dark:border-slate-800">
                    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold ${
                      user.isActive ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${user.isActive ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                      {user.isActive ? 'Active' : 'Inactive'}
                    </span>
                    <button
                      onClick={() => handleToggleUser(user.id)}
                      title={user.isActive ? 'Deactivate user' : 'Activate user'}
                      className={`relative w-10 h-6 rounded-full transition ${user.isActive ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-700'}`}
                    >
                      <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${
                        user.isActive ? 'left-5' : 'left-1'
                      }`} />
                    </button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ─── Expanded Member Modal ──────────────────────────────────────────── */}
      {expandedMember && (
        <ModalShell
          onClose={() => setExpandedMember(null)}
          maxWidth="max-w-2xl"
          header={
            <div className="flex items-center gap-4">
              <div className="ring-4 ring-white/20 rounded-full">
                <Avatar name={expandedMember.user.fullName} size="lg" />
              </div>
              <div className="min-w-0">
                <h2 className="text-lg sm:text-xl font-bold truncate">{expandedMember.user.fullName}</h2>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-white/80">{expandedMember.user.role}</span>
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-white/15 border border-white/20">
                    {expandedMember.dayStatus}
                  </span>
                </div>
              </div>
            </div>
          }
        >
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
            {[
              { l: 'Check In',      v: expandedMember.checkInTime  ?? '--',          i: Clock,      c: 'text-emerald-600 dark:text-emerald-400' },
              { l: 'Check Out',     v: expandedMember.checkOutTime ?? '--',          i: Clock,      c: 'text-rose-600 dark:text-rose-400' },
              { l: 'Work Hours',    v: expandedMember.workHours,                     i: Timer,      c: 'text-blue-600 dark:text-blue-400' },
              { l: 'Break Time',    v: `${expandedMember.totalBreakMinutes}m`,       i: Coffee,     c: 'text-amber-600 dark:text-amber-400' },
              { l: 'Tasks Done',    v: `${expandedMember.tasksCompleted}/${expandedMember.tasksTotal}`, i: ListChecks, c: 'text-violet-600 dark:text-violet-400' },
              { l: 'Support Given', v: expandedMember.supportGiven.toString(),       i: LifeBuoy,   c: 'text-pink-600 dark:text-pink-400' },
            ].map(item => {
              const Icon = item.i;
              return (
                <div key={item.l} className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                  <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                    <Icon className="w-3.5 h-3.5" /> {item.l}
                  </p>
                  <p className={`text-base font-bold ${item.c}`}>{item.v}</p>
                </div>
              );
            })}
          </div>

          {expandedMember.tasks.length > 0 && (
            <div className="mb-5">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                Tasks ({expandedMember.tasks.length})
              </h4>
              <div className="space-y-1.5">
                {expandedMember.tasks.map(t => {
                  const ti = TASK_ICON[t.status] ?? TASK_ICON.InProgress;
                  const TIcon = ti.icon;
                  return (
                    <div key={t.id} className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                      <TIcon className={`w-4 h-4 shrink-0 ${ti.cls}`} />
                      <span className="text-sm font-medium text-slate-900 dark:text-white flex-1 truncate">{t.taskTitle}</span>
                      {t.projectName && <span className="hidden sm:inline text-xs text-slate-500 dark:text-slate-400 truncate max-w-[140px]">{t.projectName}</span>}
                      <span className="text-xs text-slate-500 dark:text-slate-400 shrink-0">{t.timeSpentMinutes}m</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {expandedMember.supportLogs.length > 0 && (
            <div className="mb-5">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                Support Logs ({expandedMember.supportLogs.length})
              </h4>
              <div className="space-y-1.5">
                {expandedMember.supportLogs.map(s => (
                  <div key={s.id} className="px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                    <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-900 dark:text-white">
                      <LifeBuoy className="w-3.5 h-3.5 text-violet-500" /> {s.supportedDeveloperName}
                    </p>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">{s.issueDescription}</p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-500 mt-1">{s.timeSpentMinutes}m · {s.supportType}</p>
                    {s.media && s.media.length > 0 && <SupportMediaDisplay media={s.media} />}
                  </div>
                ))}
              </div>
            </div>
          )}

          <DownloadReport userId={expandedMember.user.id} userName={expandedMember.user.fullName} isManager={true} />
        </ModalShell>
      )}

      {/* ─── Report Download Modal ──────────────────────────────────────────── */}
      {selectedUserForReport && (
        <ModalShell
          onClose={() => setSelectedUserForReport(null)}
          maxWidth="max-w-md"
          header={
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-white/15 border border-white/20 flex items-center justify-center shrink-0">
                <Download className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h3 className="text-lg font-bold">Download Report</h3>
                <p className="text-xs text-white/80 truncate">{selectedUserForReport.fullName}</p>
              </div>
            </div>
          }
        >
          <DownloadReport userId={selectedUserForReport.id} userName={selectedUserForReport.fullName} isManager={true} />
        </ModalShell>
      )}

      {/* ─── Attendance Calendar Modal ──────────────────────────────────────── */}
      {showCalendar && calendarUser && (
        <ModalShell
          onClose={() => setShowCalendar(false)}
          maxWidth="max-w-lg"
          header={
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-white/15 border border-white/20 flex items-center justify-center shrink-0">
                <CalendarDays className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h3 className="text-lg font-bold truncate">{calendarUser.user.fullName}'s Calendar</h3>
                <p className="text-xs text-white/80">{monthName} {selectedYear}</p>
              </div>
            </div>
          }
        >
          <AttendanceCalendar days={userCalendar} />

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-5">
            {[
              { l: 'Attendance', v: `${calendarUser.attendancePercentage}%`,       c: attendanceColor(calendarUser.attendancePercentage) },
              { l: 'Work Hours', v: calendarUser.totalWorkHours,                    c: 'text-blue-600 dark:text-blue-400' },
              { l: 'Tasks Done', v: calendarUser.totalTasksCompleted.toString(),    c: 'text-violet-600 dark:text-violet-400' },
              { l: 'Support',    v: calendarUser.totalSupportGiven.toString(),      c: 'text-amber-600 dark:text-amber-400' },
            ].map(s => (
              <div key={s.l} className="p-3 rounded-xl text-center bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                <p className={`text-base font-bold ${s.c}`}>{s.v}</p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{s.l}</p>
              </div>
            ))}
          </div>

          {((calendarUser.daysWeekend ?? 0) > 0 || (calendarUser.daysHoliday ?? 0) > 0) && (
            <div className="grid grid-cols-2 gap-2 mt-2">
              {(calendarUser.daysWeekend ?? 0) > 0 && (
                <div className="p-3 rounded-xl text-center bg-orange-500/10 border border-orange-500/20">
                  <p className="text-base font-bold text-orange-600 dark:text-orange-400">{calendarUser.daysWeekend}</p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Weekend days worked</p>
                </div>
              )}
              {(calendarUser.daysHoliday ?? 0) > 0 && (
                <div className="p-3 rounded-xl text-center bg-violet-500/10 border border-violet-500/20">
                  <p className="text-base font-bold text-violet-600 dark:text-violet-400">{calendarUser.daysHoliday}</p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Holiday days worked</p>
                </div>
              )}
            </div>
          )}
        </ModalShell>
      )}
    </div>
  );
};
