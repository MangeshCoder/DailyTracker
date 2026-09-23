import { useState, useEffect } from 'react';
import { Power } from "lucide-react";
import { managerApi, authApi, downloadBlob } from '../services/api';
import { ManagerTeamDaily, TeamMonthlyStats, UserAttendanceSummary, AttendanceDay, UserDailyActivity, User, ManagerUserDto } from '../types';
import { SupportMediaDisplay } from '../components/SupportMediaDisplay';
import { useConfirm } from '../hooks/useConfirm';
import { DatePicker } from '../components/DatePicker';
import { useNavigate } from 'react-router-dom';

const statusBadge = (status: string) => {
  const map: Record<string, string> = {
    Present:  'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30',
    WFH:      'bg-blue-500/20 text-blue-400 border border-blue-500/30',
    HalfDay:  'bg-amber-500/20 text-amber-400 border border-amber-500/30',
    Absent:   'bg-red-500/20 text-red-400 border border-red-500/30',
    Weekend:  'bg-orange-500/20 text-orange-400 border border-orange-500/30',  // ← FIX
    Holiday:  'bg-violet-500/20 text-violet-400 border border-violet-500/30',  // ← FIX
    Future:   'bg-slate-800/50 text-slate-600',
  };
  return map[status] ?? 'bg-slate-700 text-slate-400';
};

const attendanceColor = (pct: number) => {
  if (pct >= 90) return 'text-emerald-400';
  if (pct >= 75) return 'text-amber-400';
  return 'text-red-400';
};

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
    <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-5">
      <h4 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
        <span className="text-blue-400">📥</span> Download Report
      </h4>
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div>
          <label className="block text-xs text-slate-400 mb-1">From</label>
          {/* <input type="date" value={from} onChange={e => setFrom(e.target.value)}
            className="w-full bg-slate-900 border border-slate-600 text-white text-sm rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" /> */}
            <DatePicker value={from} onChange={setFrom} />
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">To</label>
          {/* <input type="date" value={to} onChange={e => setTo(e.target.value)}
            className="w-full bg-slate-900 border border-slate-600 text-white text-sm rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" /> */}
            <DatePicker value={to} onChange={setTo} />
        </div>
      </div>
      <div className="flex gap-2 mb-4">
        {(['pdf', 'docx'] as const).map(f => (
          <button key={f} onClick={() => setFormat(f)}
            className={`flex-1 py-2 rounded-xl text-sm font-medium transition ${
              format === f ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-400 hover:text-white'
            }`}>
            {f === 'pdf' ? '🌐 HTML/PDF' : '📄 Word (.docx)'}
          </button>
        ))}
      </div>
      <button onClick={handleDownload} disabled={loading}
        className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold py-2.5 rounded-xl text-sm transition">
        {loading ? 'Generating...' : `Download ${format.toUpperCase()} Report`}
      </button>
      {format === 'pdf' && (
        <p className="text-xs text-slate-500 mt-2 text-center">Opens as HTML → use browser Print → Save as PDF</p>
      )}
    </div>
  );
};

// ─── Member Card (daily view) ─────────────────────────────────────────────────

const MemberCard = ({ member, onExpand }: {
  member: UserDailyActivity;
  onExpand: (m: UserDailyActivity) => void;
}) => (
  <div onClick={() => onExpand(member)}
    className="bg-slate-900 border border-slate-800 rounded-2xl p-4 hover:border-blue-500/40 cursor-pointer transition group">
    <div className="flex items-center gap-3 mb-3">
      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center text-sm font-bold flex-shrink-0">
        {member.user.fullName.charAt(0)}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-white font-medium text-sm truncate">{member.user.fullName}</p>
        <p className="text-slate-500 text-xs">{member.user.role}</p>
      </div>
      <span className={`text-xs px-2.5 py-1 rounded-xl font-medium ${statusBadge(member.dayStatus)}`}>
        {member.dayStatus}
      </span>
    </div>
    <div className="grid grid-cols-4 gap-2 text-center">
      {[
        { l: 'In',    v: member.checkInTime  ?? '--', c: 'text-white' },
        { l: 'Out',   v: member.checkOutTime ?? '--', c: 'text-white' },
        { l: 'Work',  v: member.workHours,             c: 'text-blue-400' },
        { l: 'Tasks', v: `${member.tasksCompleted}/${member.tasksTotal}`, c: 'text-emerald-400' },
      ].map(i => (
        <div key={i.l} className="bg-slate-800/60 rounded-xl p-2">
          <p className="text-xs text-slate-500">{i.l}</p>
          <p className={`text-xs font-medium ${i.c}`}>{i.v}</p>
        </div>
      ))}
    </div>
    {member.isOnBreak && (
      <div className="mt-2 flex items-center gap-1.5 text-xs text-amber-400">
        <span className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-pulse" />
        On {member.activeBreakType} Break
      </div>
    )}
    {member.supportGiven > 0 && (
      <p className="text-xs text-violet-400 mt-1">🤝 Helped {member.supportGiven} developer{member.supportGiven > 1 ? 's' : ''}</p>
    )}
  </div>
);

// ─── Attendance Calendar ──────────────────────────────────────────────────────
// FIX: Added WeekendWorked (orange) and Holiday / HolidayWorked (violet) colors.
// Smart color key: if DayStatus is "Weekend" but CheckIn is set → orange (worked).
// If DayStatus is "Holiday" but CheckIn is set → bright violet (worked).

const AttendanceCalendar = ({ days }: { days: AttendanceDay[] }) => {
  const calColors: Record<string, string> = {
    Present:       'bg-emerald-500 text-white',
    WFH:           'bg-blue-500 text-white',
    HalfDay:       'bg-amber-500 text-white',
    Absent:        'bg-red-500/30 text-red-300',
    Weekend:       'bg-slate-800 text-slate-600',           // weekend, no check-in
    WeekendWorked: 'bg-orange-500 text-white',               // ← FIX: Sat/Sun with check-in
    Holiday:       'bg-violet-500/30 text-violet-300',       // ← FIX: holiday, no check-in
    HolidayWorked: 'bg-violet-600 text-white',               // ← FIX: holiday with check-in
    Future:        'bg-slate-900 text-slate-700',
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
          // Determine which color key to use
          let colorKey = day.status;
          if (day.status === 'Weekend' && day.checkIn) colorKey = 'WeekendWorked';
          if (day.status === 'Holiday' && day.checkIn) colorKey = 'HolidayWorked';

          // Tooltip: for Holiday with no check-in, CheckIn stores the holiday name
          const tooltipSuffix = day.status === 'Holiday' && !day.checkIn && day.checkIn
            ? ` — ${day.checkIn}`
            : day.checkIn ? ` | In: ${day.checkIn}` : '';

          return (
            <div key={day.date}
              title={`${new Date(day.date).toDateString()} — ${day.status}${tooltipSuffix}${day.checkOut ? ` Out: ${day.checkOut}` : ''}`}
              className={`aspect-square flex items-center justify-center rounded-lg text-xs font-medium cursor-default transition hover:scale-110 ${calColors[colorKey] ?? 'bg-slate-800 text-slate-500'}`}>
              {new Date(day.date).getDate()}
            </div>
          );
        })}
      </div>
      {/* Legend */}
      <div className="flex flex-wrap gap-3 mt-4">
        {[
          { c: 'bg-emerald-500',    l: 'Present'          },
          { c: 'bg-blue-500',       l: 'WFH'              },
          { c: 'bg-amber-500',      l: 'Half Day'         },
          { c: 'bg-red-500/50',     l: 'Absent'           },
          { c: 'bg-slate-700',      l: 'Weekend'          },
          { c: 'bg-orange-500',     l: 'Weekend (worked)' },
          { c: 'bg-violet-500/50',  l: 'Holiday'          },
          { c: 'bg-violet-600',     l: 'Holiday (worked)' },
        ].map(item => (
          <span key={item.l} className="flex items-center gap-1.5 text-xs text-slate-400">
            <span className={`w-3 h-3 rounded ${item.c}`} />{item.l}
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

  const tabs: { key: Tab; label: string; icon: string }[] = [
    { key: 'daily',      label: 'Daily Activity', icon: '📋' },
    { key: 'monthly',    label: 'Monthly Stats',  icon: '📊' },
    { key: 'attendance', label: 'Attendance',     icon: '📅' },
    { key: 'User',       label: 'User Management',icon: '👥' },
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Manager Dashboard</h1>
        <p className="text-slate-400 text-sm mt-1">Monitor your team's activity, attendance & productivity</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 bg-slate-900 border border-slate-800 rounded-2xl p-1.5 w-fit">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition ${
              tab === t.key ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/25' : 'text-slate-400 hover:text-white'
            }`}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* ─── DAILY TAB ─────────────────────────────────────────────────────── */}
      {tab === 'daily' && (
        <div>
          <div className="flex items-center gap-4 mb-5">
            {/* <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)}
              className="bg-slate-800 border border-slate-700 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" /> */}
              <DatePicker value={selectedDate} onChange={setSelectedDate} />
            {teamDaily && (
              <div className="flex gap-3">
                <span className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-4 py-2 rounded-xl text-sm font-medium">
                  ✅ {teamDaily.checkedIn} Checked In
                </span>
                <span className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-2 rounded-xl text-sm font-medium">
                  ❌ {teamDaily.notCheckedIn} Not In
                </span>
                <span className="bg-slate-800 border border-slate-700 text-slate-400 px-4 py-2 rounded-xl text-sm">
                  👥 {teamDaily.totalMembers} Total
                </span>
              </div>
            )}
          </div>
          {loading ? (
            <div className="flex justify-center py-16">
              <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {teamDaily?.members.map(member => (
                <MemberCard key={member.user.id} member={member} onExpand={setExpandedMember} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ─── MONTHLY TAB ───────────────────────────────────────────────────── */}
      {tab === 'monthly' && (
        <div>
          <div className="flex items-center gap-3 mb-5">
            <select value={selectedMonth} onChange={e => setSelectedMonth(+e.target.value)}
              className="bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              {Array.from({ length: 12 }, (_, i) => (
                <option key={i + 1} value={i + 1}>{new Date(2024, i, 1).toLocaleString('default', { month: 'long' })}</option>
              ))}
            </select>
            <select value={selectedYear} onChange={e => setSelectedYear(+e.target.value)}
              className="bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            {teamMonthly && (
              <div className="flex gap-3 ml-2">
                <div className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-2 text-center">
                  <p className="text-xs text-slate-500">Team Avg</p>
                  <p className={`text-lg font-bold ${attendanceColor(teamMonthly.teamAverageAttendance)}`}>{teamMonthly.teamAverageAttendance}%</p>
                </div>
                <div className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-2 text-center">
                  <p className="text-xs text-slate-500">Tasks Done</p>
                  <p className="text-lg font-bold text-violet-400">{teamMonthly.teamTotalTasksCompleted}</p>
                </div>
                <div className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-2 text-center">
                  <p className="text-xs text-slate-500">Support Logs</p>
                  <p className="text-lg font-bold text-amber-400">{teamMonthly.teamTotalSupportLogs}</p>
                </div>
              </div>
            )}
          </div>
          {loading ? (
            <div className="flex justify-center py-16">
              <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-800">
                    <th className="text-left px-5 py-4 text-slate-400 font-semibold">Team Member</th>
                    <th className="text-center px-4 py-4 text-slate-400 font-semibold">Attendance</th>
                    <th className="text-center px-4 py-4 text-slate-400 font-semibold">Present</th>
                    <th className="text-center px-4 py-4 text-slate-400 font-semibold">WFH</th>
                    <th className="text-center px-4 py-4 text-slate-400 font-semibold">Absent</th>
                    <th className="text-center px-4 py-4 text-orange-400 font-semibold">Weekend</th>
                    <th className="text-center px-4 py-4 text-violet-400 font-semibold">Holiday</th>
                    <th className="text-center px-4 py-4 text-slate-400 font-semibold">Work Hours</th>
                    <th className="text-center px-4 py-4 text-slate-400 font-semibold">Report</th>
                  </tr>
                </thead>
                <tbody>
                  {teamMonthly?.members.map(member => (
                    <tr key={member.user.id} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center text-xs font-bold">
                            {member.user.fullName.charAt(0)}
                          </div>
                          <div>
                            <p className="text-white font-medium">{member.user.fullName}</p>
                            <p className="text-slate-500 text-xs">{member.user.role}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <div className="flex flex-col items-center gap-1">
                          <span className={`text-lg font-bold ${attendanceColor(member.attendancePercentage)}`}>
                            {member.attendancePercentage}%
                          </span>
                          <div className="w-16 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${member.attendancePercentage >= 90 ? 'bg-emerald-500' : member.attendancePercentage >= 75 ? 'bg-amber-500' : 'bg-red-500'}`}
                              style={{ width: `${member.attendancePercentage}%` }} />
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-center text-emerald-400 font-semibold">
                        {member.daysPresent + member.daysWFH + member.daysHalfDay}
                        <span className="text-slate-600 font-normal">/{member.workingDaysInMonth}</span>
                      </td>
                      <td className="px-4 py-4 text-center text-blue-400">{member.daysWFH}</td>
                      <td className="px-4 py-4 text-center text-red-400">{member.daysAbsent}</td>
                      <td className="px-4 py-4 text-center text-orange-400 font-semibold">
                        {(member.daysWeekend ?? 0) > 0 ? member.daysWeekend : '—'}
                      </td>
                      <td className="px-4 py-4 text-center text-violet-400 font-semibold">
                        {(member.daysHoliday ?? 0) > 0 ? member.daysHoliday : '—'}
                      </td>
                      <td className="px-4 py-4 text-center text-blue-400 font-medium">{member.totalWorkHours}</td>
                      <td className="px-4 py-4 text-center">
                        <div className="flex flex-col gap-1">
                        <button
                          onClick={() => navigate(`/manager/user/${member.user.id}`)}
                          className="text-xs bg-slate-700 hover:bg-slate-600 text-slate-300 border border-slate-600 px-3 py-1.5 rounded-lg transition"
                        >
                          👤 Details
                        </button>
                        <button
                          onClick={() => setSelectedUserForReport(member.user)}
                          className="text-xs bg-blue-600/20 hover:bg-blue-600/40 text-blue-400 border border-blue-500/30 px-3 py-1.5 rounded-lg transition"
                        >
                          📥 Report
                        </button>
                      </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ─── ATTENDANCE TAB ────────────────────────────────────────────────── */}
      {tab === 'attendance' && (
        <div>
          <div className="flex items-center gap-3 mb-5">
            <select value={selectedMonth} onChange={e => setSelectedMonth(+e.target.value)}
              className="bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              {Array.from({ length: 12 }, (_, i) => (
                <option key={i + 1} value={i + 1}>{new Date(2024, i, 1).toLocaleString('default', { month: 'long' })}</option>
              ))}
            </select>
            <select value={selectedYear} onChange={e => setSelectedYear(+e.target.value)}
              className="bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>

          {loading ? (
            <div className="flex justify-center py-16">
              <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {teamMonthly?.members.map(member => (
                <div key={member.user.id}
                  className="bg-slate-900 border border-slate-800 rounded-2xl p-5 hover:border-slate-700 transition">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center text-sm font-bold">
                      {member.user.fullName.charAt(0)}
                    </div>
                    <div className="flex-1">
                      <p className="text-white font-medium text-sm">{member.user.fullName}</p>
                      <p className="text-slate-500 text-xs">{member.user.email}</p>
                    </div>
                  </div>

                  {/* Progress bar — now includes Weekend + Holiday segments */}
                  <div className="flex items-center gap-3 mb-4">
                    <div className="flex-1 h-2.5 bg-slate-800 rounded-full overflow-hidden flex">
                      <div className="bg-emerald-500 h-full" style={{ width: `${(member.daysPresent / member.workingDaysInMonth) * 100}%` }} />
                      <div className="bg-blue-500 h-full"    style={{ width: `${(member.daysWFH     / member.workingDaysInMonth) * 100}%` }} />
                      <div className="bg-amber-500 h-full"   style={{ width: `${(member.daysHalfDay / member.workingDaysInMonth) * 100}%` }} />
                      <div className="bg-orange-500 h-full"  style={{ width: `${((member.daysWeekend ?? 0) / member.workingDaysInMonth) * 100}%` }} />
                      <div className="bg-violet-500 h-full"  style={{ width: `${((member.daysHoliday ?? 0) / member.workingDaysInMonth) * 100}%` }} />
                      <div className="bg-red-500 h-full"     style={{ width: `${(member.daysAbsent  / member.workingDaysInMonth) * 100}%` }} />
                    </div>
                    <span className={`text-lg font-bold ${attendanceColor(member.attendancePercentage)}`}>
                      {member.attendancePercentage}%
                    </span>
                  </div>

                  {/* Stat boxes — always show 4 core, conditionally show Weekend + Holiday */}
                  <div className="grid grid-cols-4 gap-1.5 text-center text-xs mb-2">
                    <div className="bg-emerald-500/10 rounded-lg py-2">
                      <p className="text-emerald-400 font-bold">{member.daysPresent}</p>
                      <p className="text-slate-500">Office</p>
                    </div>
                    <div className="bg-blue-500/10 rounded-lg py-2">
                      <p className="text-blue-400 font-bold">{member.daysWFH}</p>
                      <p className="text-slate-500">WFH</p>
                    </div>
                    <div className="bg-amber-500/10 rounded-lg py-2">
                      <p className="text-amber-400 font-bold">{member.daysHalfDay}</p>
                      <p className="text-slate-500">Half</p>
                    </div>
                    <div className="bg-red-500/10 rounded-lg py-2">
                      <p className="text-red-400 font-bold">{member.daysAbsent}</p>
                      <p className="text-slate-500">Absent</p>
                    </div>
                  </div>

                  {/* Weekend + Holiday boxes — only shown when > 0 */}
                  {((member.daysWeekend ?? 0) > 0 || (member.daysHoliday ?? 0) > 0) && (
                    <div className="grid grid-cols-2 gap-1.5 text-center text-xs mb-2">
                      {(member.daysWeekend ?? 0) > 0 && (
                        <div className="bg-orange-500/10 rounded-lg py-2">
                          <p className="text-orange-400 font-bold">{member.daysWeekend}</p>
                          <p className="text-slate-500">Weekend</p>
                        </div>
                      )}
                      {(member.daysHoliday ?? 0) > 0 && (
                        <div className="bg-violet-500/10 rounded-lg py-2">
                          <p className="text-violet-400 font-bold">{member.daysHoliday}</p>
                          <p className="text-slate-500">Holiday</p>
                        </div>
                      )}
                    </div>
                  )}

                 <div className="flex gap-2 mt-3">
                    <button
                      onClick={() => navigate(`/manager/user/${member.user.id}`)}
                      className="flex-1 bg-violet-600/20 hover:bg-violet-600/30 text-violet-400 text-xs py-2 rounded-xl transition border border-violet-500/20">
                      👤 View Details
                    </button>
                    <button onClick={() => setSelectedUserForReport(member.user)}
                      className="flex-1 bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 text-xs py-2 rounded-xl transition border border-blue-500/20">
                      📥 Report
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ─── USER MANAGEMENT TAB ───────────────────────────────────────────── */}
      {tab === 'User' && (
        <div>
          {loadingUsers ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
            </div>
          ) : (
            <div className="p-4">
              <h2 className="text-xl font-bold text-white mb-4">User Management</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {users.map(user => (
                  <div key={user.id} className="bg-slate-800/60 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center font-bold text-xs">
                          {user.fullName.charAt(0)}
                        </div>
                        <span className="text-white font-medium">{user.fullName}</span>
                      </div>
                      <button onClick={() => handleToggleUser(user.id)}
                        className={`px-3 py-1 rounded-lg text-xs ${user.isActive ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                        {user.isActive ? 'Active' : 'Inactive'}
                      </button>
                    </div>
                    <div className="space-y-1">
                      <p className="text-slate-400 text-sm">{user.email}</p>
                      <span className={`inline-block px-2 py-1 text-xs rounded-md font-medium ${
                        user.role === 'Manager' ? 'bg-purple-500/20 text-purple-400'
                        : user.role === 'Admin' ? 'bg-yellow-500/20 text-yellow-400'
                        : 'bg-blue-500/20 text-blue-400'
                      }`}>{user.role}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─── Expanded Member Modal ──────────────────────────────────────────── */}
      {expandedMember && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-2xl w-full max-h-[85vh] overflow-y-auto">
            <div className="p-5 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center font-bold">
                  {expandedMember.user.fullName.charAt(0)}
                </div>
                <div>
                  <p className="text-white font-semibold">{expandedMember.user.fullName}</p>
                  <p className="text-slate-400 text-xs">{expandedMember.user.role}</p>
                </div>
              </div>
              <button onClick={() => setExpandedMember(null)}
                className="text-slate-400 hover:text-white p-2 rounded-xl hover:bg-slate-800 transition">✕</button>
            </div>
            <div className="p-5">
              <div className="grid grid-cols-3 gap-3 mb-5">
                {[
                  { l: 'Check In',     v: expandedMember.checkInTime  ?? '--', c: 'text-emerald-400' },
                  { l: 'Check Out',    v: expandedMember.checkOutTime ?? '--', c: 'text-red-400'     },
                  { l: 'Work Hours',   v: expandedMember.workHours,             c: 'text-blue-400'   },
                  { l: 'Break Time',   v: `${expandedMember.totalBreakMinutes}m`, c: 'text-amber-400' },
                  { l: 'Tasks Done',   v: `${expandedMember.tasksCompleted}/${expandedMember.tasksTotal}`, c: 'text-violet-400' },
                  { l: 'Support Given',v: expandedMember.supportGiven.toString(), c: 'text-pink-400' },
                ].map(item => (
                  <div key={item.l} className="bg-slate-800/60 rounded-xl p-3 text-center">
                    <p className="text-xs text-slate-500 mb-1">{item.l}</p>
                    <p className={`font-bold ${item.c}`}>{item.v}</p>
                  </div>
                ))}
              </div>
              {expandedMember.tasks.length > 0 && (
                <div className="mb-4">
                  <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Tasks</h4>
                  <div className="space-y-1.5">
                    {expandedMember.tasks.map(t => (
                      <div key={t.id} className="flex items-center gap-2 bg-slate-800/40 rounded-xl px-3 py-2">
                        <span className="text-sm">{t.status === 'Completed' ? '✅' : t.status === 'Blocked' ? '🚫' : '🔄'}</span>
                        <span className="text-sm text-white flex-1 truncate">{t.taskTitle}</span>
                        {t.projectName && <span className="text-xs text-slate-500">{t.projectName}</span>}
                        <span className="text-xs text-slate-500">{t.timeSpentMinutes}m</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {expandedMember.supportLogs.length > 0 && (
                <div className="mb-4">
                  <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Support Logs</h4>
                  <div className="space-y-1.5">
                    {expandedMember.supportLogs.map(s => (
                      <div key={s.id} className="bg-slate-800/40 rounded-xl px-3 py-2">
                        <p className="text-sm text-white">🤝 {s.supportedDeveloperName}</p>
                        <p className="text-xs text-slate-400 mt-0.5">{s.issueDescription}</p>
                        <p className="text-xs text-slate-500 mt-0.5">{s.timeSpentMinutes}m · {s.supportType}</p>
                        {s.media && s.media.length > 0 && <SupportMediaDisplay media={s.media} />}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <DownloadReport userId={expandedMember.user.id} userName={expandedMember.user.fullName} isManager={true} />
            </div>
          </div>
        </div>
      )}

      {/* ─── Report Download Modal ──────────────────────────────────────────── */}
      {selectedUserForReport && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md">
            <div className="p-5 border-b border-slate-800 flex items-center justify-between">
              <h3 className="text-white font-semibold">Download Report — {selectedUserForReport.fullName}</h3>
              <button onClick={() => setSelectedUserForReport(null)}
                className="text-slate-400 hover:text-white p-2 rounded-xl hover:bg-slate-800 transition">✕</button>
            </div>
            <div className="p-5">
              <DownloadReport userId={selectedUserForReport.id} userName={selectedUserForReport.fullName} isManager={true} />
            </div>
          </div>
        </div>
      )}

      {/* ─── Attendance Calendar Modal ──────────────────────────────────────── */}
      {showCalendar && calendarUser && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg">
            <div className="p-5 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-white font-semibold">{calendarUser.user.fullName}'s Calendar</h3>
                <p className="text-slate-400 text-xs">{monthName} {selectedYear}</p>
              </div>
              <button onClick={() => setShowCalendar(false)}
                className="text-slate-400 hover:text-white p-2 rounded-xl hover:bg-slate-800 transition">✕</button>
            </div>
            <div className="p-5">
              <AttendanceCalendar days={userCalendar} />
              <div className="grid grid-cols-4 gap-2 mt-5">
                {[
                  { l: 'Attendance', v: `${calendarUser.attendancePercentage}%`, c: attendanceColor(calendarUser.attendancePercentage) },
                  { l: 'Work Hours', v: calendarUser.totalWorkHours,              c: 'text-blue-400'   },
                  { l: 'Tasks Done', v: calendarUser.totalTasksCompleted.toString(), c: 'text-violet-400' },
                  { l: 'Support',    v: calendarUser.totalSupportGiven.toString(),   c: 'text-amber-400' },
                ].map(s => (
                  <div key={s.l} className="bg-slate-800/50 rounded-xl p-3 text-center">
                    <p className={`font-bold ${s.c}`}>{s.v}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{s.l}</p>
                  </div>
                ))}
              </div>
              {/* Weekend + Holiday summary in calendar modal */}
              {((calendarUser.daysWeekend ?? 0) > 0 || (calendarUser.daysHoliday ?? 0) > 0) && (
                <div className="grid grid-cols-2 gap-2 mt-2">
                  {(calendarUser.daysWeekend ?? 0) > 0 && (
                    <div className="bg-orange-500/10 rounded-xl p-3 text-center">
                      <p className="text-orange-400 font-bold">{calendarUser.daysWeekend}</p>
                      <p className="text-xs text-slate-500 mt-0.5">Weekend days worked</p>
                    </div>
                  )}
                  {(calendarUser.daysHoliday ?? 0) > 0 && (
                    <div className="bg-violet-500/10 rounded-xl p-3 text-center">
                      <p className="text-violet-400 font-bold">{calendarUser.daysHoliday}</p>
                      <p className="text-xs text-slate-500 mt-0.5">Holiday days worked</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};