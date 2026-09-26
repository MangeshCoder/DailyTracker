import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { teamCalendarApi } from '../services/api';
import type {
  TeamCalendarResponse,
  CalendarDay,
  CalendarMemberDay,
} from '../types';
import { PageHeader } from '../components/ui/PageHeader';
import { StatCard } from '../components/ui/StatCard';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import {
  ChevronLeft,
  ChevronRight,
  Search,
  Building2,
  Home,
  Palmtree,
  SunMedium,
  Clock,
  PartyPopper,
  Users,
  X,
  MapPin,
  CalendarDays
} from 'lucide-react';

const BACKEND_ORIGIN = 'https://localhost:7096';

// ── STATUS CONFIG ─────────────────────────────────────────────────────────────
const STATUS_CFG: Record<
  string,
  { label: string; dot: string; text: string; bg: string; border: string; badgeVariant: 'emerald' | 'blue' | 'amber' | 'rose' | 'purple' | 'slate' }
> = {
  Present: {
    label: 'In Office',
    dot: 'bg-emerald-500',
    text: 'text-emerald-700 dark:text-emerald-400',
    bg: 'bg-emerald-500/10 dark:bg-emerald-500/15',
    border: 'border-emerald-500/20',
    badgeVariant: 'emerald',
  },
  WFH: {
    label: 'Work From Home',
    dot: 'bg-blue-500',
    text: 'text-blue-700 dark:text-blue-400',
    bg: 'bg-blue-500/10 dark:bg-blue-500/15',
    border: 'border-blue-500/20',
    badgeVariant: 'blue',
  },
  HalfDay: {
    label: 'Half Day',
    dot: 'bg-amber-500',
    text: 'text-amber-700 dark:text-amber-400',
    bg: 'bg-amber-500/10 dark:bg-amber-500/15',
    border: 'border-amber-500/20',
    badgeVariant: 'amber',
  },
  Leave: {
    label: 'On Leave',
    dot: 'bg-rose-500',
    text: 'text-rose-700 dark:text-rose-400',
    bg: 'bg-rose-500/10 dark:bg-rose-500/15',
    border: 'border-rose-500/20',
    badgeVariant: 'rose',
  },
  Weekend: {
    label: 'Weekend Duty',
    dot: 'bg-orange-500',
    text: 'text-orange-700 dark:text-orange-400',
    bg: 'bg-orange-500/10 dark:bg-orange-500/15',
    border: 'border-orange-500/20',
    badgeVariant: 'amber',
  },
  Holiday: {
    label: 'Holiday Duty',
    dot: 'bg-purple-500',
    text: 'text-purple-700 dark:text-purple-400',
    bg: 'bg-purple-500/10 dark:bg-purple-500/15',
    border: 'border-purple-500/20',
    badgeVariant: 'purple',
  },
  Absent: {
    label: 'Absent',
    dot: 'bg-slate-400 dark:bg-slate-500',
    text: 'text-slate-600 dark:text-slate-400',
    bg: 'bg-slate-100 dark:bg-slate-800/60',
    border: 'border-slate-200 dark:border-slate-700',
    badgeVariant: 'slate',
  },
  Unknown: {
    label: 'Unassigned',
    dot: 'bg-slate-300 dark:bg-slate-700',
    text: 'text-slate-400',
    bg: 'bg-transparent',
    border: 'border-transparent',
    badgeVariant: 'slate',
  },
};

const getCfg = (status: string) => STATUS_CFG[status] ?? STATUS_CFG['Unknown'];

// ─── Avatar Component ─────────────────────────────────────────────────────────
const Avatar: React.FC<{
  src?: string | null;
  name: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
}> = ({ src, name, size = 'sm' }) => {
  const sizeMap = {
    xs: 'w-6 h-6 text-[10px]',
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 text-sm font-semibold',
    lg: 'w-12 h-12 text-base font-bold',
  };

  const initials = name
    .split(' ')
    .filter(Boolean)
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const resolvedSrc = src
    ? src.startsWith('http')
      ? src
      : `${BACKEND_ORIGIN}${src}`
    : null;

  if (resolvedSrc) {
    return (
      <img
        src={resolvedSrc}
        alt={name}
        className={`${sizeMap[size]} rounded-xl object-cover flex-shrink-0 shadow-sm`}
        onError={(e) => {
          (e.target as HTMLElement).style.display = 'none';
        }}
      />
    );
  }

  return (
    <div
      className={`${sizeMap[size]} rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600
      flex items-center justify-center font-bold text-white flex-shrink-0 shadow-sm shadow-blue-500/20`}
    >
      {initials || 'U'}
    </div>
  );
};

// ─── Today's Availability Panel ───────────────────────────────────────────────
const TodayPanel: React.FC<{ today: CalendarDay | undefined }> = ({ today }) => {
  const groups = useMemo(() => {
    if (!today) return {};
    const g: Record<string, CalendarMemberDay[]> = {};
    for (const member of today.members) {
      if (!g[member.status]) g[member.status] = [];
      g[member.status].push(member);
    }
    return g;
  }, [today]);

  if (!today) return null;

  const orderedStatuses = [
    'Present',
    'WFH',
    'HalfDay',
    'Leave',
    'Weekend',
    'Holiday',
    'Absent',
  ];

  return (
    <Card className="border-slate-200/80 dark:border-slate-800 shadow-sm overflow-hidden">
      <CardHeader className="p-4 sm:p-5 border-b border-slate-200/80 dark:border-slate-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <MapPin className="w-3.5 h-3.5" />
            </div>
            <CardTitle className="text-sm font-bold text-slate-900 dark:text-white">
              Today's Presence
            </CardTitle>
          </div>
          {today.isHoliday && (
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
              🎉 {today.holidayName}
            </span>
          )}
          {today.isWeekend && !today.isHoliday && (
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20">
              📅 Weekend
            </span>
          )}
        </div>
      </CardHeader>

      <CardContent className="p-4 sm:p-5 space-y-4">
        {orderedStatuses.map((status) => {
          const members = groups[status];
          if (!members?.length) return null;
          const cfg = getCfg(status);

          return (
            <div key={status} className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
                  <span className={`text-xs font-semibold ${cfg.text}`}>
                    {cfg.label}
                  </span>
                </div>
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                  {members.length}
                </span>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {members.map((m) => (
                  <div
                    key={m.userId}
                    className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800/70 border border-slate-200/80 dark:border-slate-700/60 rounded-xl px-2.5 py-1"
                    title={`${m.fullName} (${m.role})`}
                  >
                    <Avatar src={m.profilePhotoUrl} name={m.fullName} size="xs" />
                    <span className="text-slate-700 dark:text-slate-300 text-xs font-medium truncate max-w-[90px]">
                      {m.fullName.split(' ')[0]}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}

        {today.members.length === 0 && (
          <p className="text-xs text-slate-500 text-center py-4">
            No check-in or roster records found for today.
          </p>
        )}
      </CardContent>
    </Card>
  );
};

// ─── Day Detail Modal ─────────────────────────────────────────────────────────
const DayModal: React.FC<{ day: CalendarDay; onClose: () => void }> = ({
  day,
  onClose,
}) => {
  const groups = useMemo(() => {
    const g: Record<string, CalendarMemberDay[]> = {};
    for (const member of day.members) {
      if (!g[member.status]) g[member.status] = [];
      g[member.status].push(member);
    }
    return g;
  }, [day]);

  const orderedStatuses = [
    'Present',
    'WFH',
    'HalfDay',
    'Leave',
    'Weekend',
    'Holiday',
    'Absent',
    'Unknown',
  ];
  const dateObj = new Date(day.date + 'T00:00:00');

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-md shadow-2xl max-h-[85vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-950/40">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              {dateObj.toLocaleDateString('en-IN', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            </h3>
            <div className="flex items-center gap-2 mt-1">
              {day.isHoliday && (
                <span className="text-xs font-semibold text-purple-600 dark:text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded-full">
                  🎉 {day.holidayName}
                </span>
              )}
              {day.isWeekend && (
                <span className="text-xs font-semibold text-orange-600 dark:text-orange-400 bg-orange-500/10 px-2 py-0.5 rounded-full">
                  📅 Weekend
                </span>
              )}
              {day.isToday && (
                <span className="text-xs font-semibold text-blue-600 dark:text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-full">
                  ⚡ Today
                </span>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white flex items-center justify-center transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          {orderedStatuses.map((status) => {
            const members = groups[status];
            if (!members?.length) return null;
            const cfg = getCfg(status);

            return (
              <div key={status} className="space-y-2">
                <div className="flex items-center justify-between">
                  <span
                    className={`text-xs font-bold uppercase tracking-wider ${cfg.text} flex items-center gap-1.5`}
                  >
                    <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
                    <span>{cfg.label}</span>
                  </span>
                  <span className="text-xs font-semibold text-slate-400">
                    {members.length} {members.length === 1 ? 'member' : 'members'}
                  </span>
                </div>

                <div className="space-y-1.5">
                  {members.map((m) => (
                    <div
                      key={m.userId}
                      className="flex items-center gap-3 p-2.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-2xl"
                    >
                      <Avatar src={m.profilePhotoUrl} name={m.fullName} size="sm" />
                      <div className="flex-1 min-w-0">
                        <p className="text-slate-900 dark:text-slate-100 text-xs font-semibold truncate">
                          {m.fullName}
                        </p>
                        <p className="text-slate-500 text-[11px] truncate">
                          {m.role}
                          {m.status === 'Leave' && m.leaveType
                            ? ` · ${m.leaveType} Leave`
                            : ''}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}

          {day.members.length === 0 && (
            <div className="text-center py-8 text-slate-400 space-y-2">
              <CalendarDays className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-600" />
              <p className="text-xs">
                {day.isWeekend
                  ? 'No team members logged weekend duty for this date.'
                  : 'No attendance records logged for this date.'}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── Day Cell Component ───────────────────────────────────────────────────────
const DayCell: React.FC<{
  day: CalendarDay;
  filteredUserIds: Set<number> | null;
  onClick: () => void;
}> = ({ day, filteredUserIds, onClick }) => {
  const dateNum = parseInt(day.date.split('-')[2], 10);
  const isWeekend = day.isWeekend;

  const relevantMembers = filteredUserIds
    ? day.members.filter((m) => filteredUserIds.has(m.userId))
    : day.members;

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const m of relevantMembers) {
      c[m.status] = (c[m.status] ?? 0) + 1;
    }
    return c;
  }, [relevantMembers]);

  const statusOrder = [
    'Present',
    'WFH',
    'HalfDay',
    'Leave',
    'Weekend',
    'Holiday',
  ];
  const hasCheckins = relevantMembers.length > 0;

  // Weekend cell with no activity
  if (isWeekend && !hasCheckins) {
    return (
      <div className="bg-slate-50/50 dark:bg-slate-950/30 rounded-2xl p-2 sm:p-2.5 min-h-[92px] sm:min-h-[105px] border border-dashed border-slate-200/60 dark:border-slate-800/60 flex flex-col justify-between opacity-70">
        <div className="flex items-center justify-between">
          <span className="text-slate-400 dark:text-slate-600 text-xs font-semibold">
            {dateNum}
          </span>
          {day.isHoliday && <span className="text-[10px]">🎉</span>}
        </div>
        {day.isHoliday && (
          <span className="text-[9px] font-medium text-purple-600 dark:text-purple-400 truncate">
            {day.holidayName}
          </span>
        )}
      </div>
    );
  }

  // Active / Working Day cell
  return (
    <div
      onClick={onClick}
      className={`rounded-2xl p-2 sm:p-2.5 min-h-[92px] sm:min-h-[105px] flex flex-col cursor-pointer transition-all duration-150 border select-none group shadow-sm ${
        day.isToday
          ? 'bg-blue-50/60 dark:bg-blue-950/30 border-blue-500/50 ring-2 ring-blue-500/20 shadow-blue-500/5'
          : isWeekend
          ? 'bg-orange-50/50 dark:bg-orange-950/20 border-orange-300 dark:border-orange-900/60 hover:border-orange-400'
          : day.isHoliday
          ? 'bg-purple-50/50 dark:bg-purple-950/20 border-purple-300 dark:border-purple-900/60 hover:border-purple-400'
          : 'bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 hover:border-blue-400 dark:hover:border-slate-700 hover:shadow-md'
      }`}
    >
      {/* Day header */}
      <div className="flex items-center justify-between mb-1">
        <span
          className={`text-xs font-bold ${
            day.isToday
              ? 'text-blue-600 dark:text-blue-400'
              : isWeekend
              ? 'text-orange-600 dark:text-orange-400'
              : 'text-slate-800 dark:text-slate-200'
          }`}
        >
          {dateNum}
        </span>

        {day.isToday && (
          <span className="text-[9px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded-md">
            Today
          </span>
        )}
        {day.isHoliday && !day.isToday && (
          <span className="text-[10px]" title={day.holidayName || 'Holiday'}>
            🎉
          </span>
        )}
      </div>

      {/* Status pills stack */}
      <div className="flex-1 space-y-1 overflow-hidden">
        {statusOrder.map((s) => {
          const n = counts[s];
          if (!n) return null;
          const cfg = getCfg(s);

          return (
            <div
              key={s}
              className={`flex items-center gap-1 rounded-md px-1.5 py-0.5 border ${cfg.bg} ${cfg.border} text-[10px] font-semibold ${cfg.text} truncate transition group-hover:scale-[1.02]`}
            >
              <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${cfg.dot}`} />
              <span className="truncate">
                {n} {cfg.label}
              </span>
            </div>
          );
        })}
      </div>

      {/* Holiday label footer */}
      {day.isHoliday && (
        <p className="text-[9px] font-medium text-purple-600 dark:text-purple-400 mt-1 truncate">
          {day.holidayName}
        </p>
      )}
    </div>
  );
};

// ─── Main TeamCalendarPage ────────────────────────────────────────────────────
export const TeamCalendarPage: React.FC = () => {
  const now = new Date();

  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [selectedDay, setSelectedDay] = useState<CalendarDay | null>(null);
  const [searchName, setSearchName] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const { data, isLoading } = useQuery<TeamCalendarResponse>({
    queryKey: ['teamCalendar', month, year],
    queryFn: () => teamCalendarApi.get(month, year).then((r) => r.data),
    staleTime: 60_000,
  });

  const prevMonth = () => {
    if (month === 1) {
      setMonth(12);
      setYear((y) => y - 1);
    } else {
      setMonth((m) => m - 1);
    }
  };

  const nextMonth = () => {
    if (month === 12) {
      setMonth(1);
      setYear((y) => y + 1);
    } else {
      setMonth((m) => m + 1);
    }
  };

  const goToday = () => {
    setMonth(now.getMonth() + 1);
    setYear(now.getFullYear());
  };

  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(
    2,
    '0'
  )}-${String(now.getDate()).padStart(2, '0')}`;
  const todayDay = data?.days.find((d) => d.date === todayStr);

  const allMembers = useMemo(() => {
    if (!data) return [];
    const seen = new Map<number, CalendarMemberDay>();
    for (const day of data.days) {
      for (const m of day.members) {
        if (!seen.has(m.userId)) seen.set(m.userId, m);
      }
    }
    return [...seen.values()].sort((a, b) =>
      a.fullName.localeCompare(b.fullName)
    );
  }, [data]);

  const filteredUserIds = useMemo<Set<number> | null>(() => {
    let ids: Set<number> | null = null;

    if (searchName.trim()) {
      ids = new Set<number>();
      for (const m of allMembers) {
        if (m.fullName.toLowerCase().includes(searchName.toLowerCase())) {
          ids.add(m.userId);
        }
      }
    }

    if (statusFilter !== 'all') {
      const statusMatched = new Set<number>();
      for (const day of data?.days ?? []) {
        for (const m of day.members) {
          if (m.status === statusFilter) {
            if (!ids || ids.has(m.userId)) {
              statusMatched.add(m.userId);
            }
          }
        }
      }
      return statusMatched;
    }

    return ids;
  }, [allMembers, searchName, statusFilter, data]);

  // Aggregate monthly stats
  const stats = useMemo(() => {
    if (!data) return null;
    let present = 0,
      wfh = 0,
      onLeave = 0,
      absent = 0,
      halfDay = 0,
      weekend = 0,
      holiday = 0;

    for (const day of data.days) {
      for (const m of day.members) {
        if (m.status === 'Present') present++;
        else if (m.status === 'WFH') wfh++;
        else if (m.status === 'HalfDay') halfDay++;
        else if (m.status === 'Leave') onLeave++;
        else if (m.status === 'Absent') absent++;
        else if (m.status === 'Weekend') weekend++;
        else if (m.status === 'Holiday') holiday++;
      }
    }
    return { present, wfh, halfDay, onLeave, absent, weekend, holiday };
  }, [data]);

  const firstDayOfWeek = data ? new Date(year, month - 1, 1).getDay() : 0;
  const leadingBlanks = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1;

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* ── Page Header ── */}
      <PageHeader
        title="Team Attendance Calendar"
        description="Bird's-eye view of organizational presence, approved WFH schedules, half-day leaves, and company holidays."
        breadcrumbs={[
          { label: 'Workspace', href: '/' },
          { label: 'Team & Roster' },
          { label: 'Calendar' },
        ]}
        badge={{ label: 'Live Roster Sync', variant: 'blue' }}
        actions={
          <div className="flex items-center gap-1.5 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-1 rounded-2xl shadow-sm">
            <button
              type="button"
              onClick={prevMonth}
              className="w-8 h-8 flex items-center justify-center rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              title="Previous Month"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={goToday}
              className="px-3 py-1 rounded-xl text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer min-w-[120px] text-center"
            >
              {data?.label ?? `${month}/${year}`}
            </button>
            <button
              type="button"
              onClick={nextMonth}
              className="w-8 h-8 flex items-center justify-center rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              title="Next Month"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        }
      />

      {/* ── KPI Stat Cards ── */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <StatCard
            title="In Office"
            value={stats.present}
            subtitle="Present on site"
            icon={Building2}
            color="emerald"
          />
          <StatCard
            title="WFH Days"
            value={stats.wfh}
            subtitle="Remote shifts"
            icon={Home}
            color="blue"
          />
          <StatCard
            title="Half-Day"
            value={stats.halfDay}
            subtitle="Split duty passes"
            icon={SunMedium}
            color="amber"
          />
          <StatCard
            title="Leave Days"
            value={stats.onLeave}
            subtitle="Approved time off"
            icon={Palmtree}
            color="rose"
          />
          <StatCard
            title="Weekend Duty"
            value={stats.weekend}
            subtitle="Overtime / duty"
            icon={Clock}
            color="amber"
          />
          <StatCard
            title="Holiday Duty"
            value={stats.holiday}
            subtitle="Public holiday duty"
            icon={PartyPopper}
            color="purple"
          />
        </div>
      )}

      {/* ── Main Layout: Calendar Grid + Sidebar ── */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_300px] gap-6">
        {/* Calendar Area */}
        <div className="space-y-4">
          {/* Filters & Legend Bar */}
          <div className="bg-white/70 dark:bg-slate-900/60 p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-800 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 backdrop-blur-sm">
            {/* Search filter */}
            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={searchName}
                onChange={(e) => setSearchName(e.target.value)}
                placeholder="Filter calendar by member name…"
                className="w-full bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white rounded-xl pl-9 pr-8 py-2 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-slate-400"
              />
              {searchName && (
                <button
                  type="button"
                  onClick={() => setSearchName('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Quick Status Filter */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs font-semibold text-slate-500 hidden md:inline">
                Highlight:
              </span>
              <div className="flex gap-1 bg-slate-100 dark:bg-slate-950 p-1 rounded-xl border border-slate-200/80 dark:border-slate-800 text-xs">
                {[
                  { key: 'all', label: 'All' },
                  { key: 'Present', label: 'Office' },
                  { key: 'WFH', label: 'WFH' },
                  { key: 'Leave', label: 'Leave' },
                ].map((f) => (
                  <button
                    key={f.key}
                    type="button"
                    onClick={() => setStatusFilter(f.key)}
                    className={`px-2.5 py-1 rounded-lg font-semibold transition cursor-pointer ${
                      statusFilter === f.key
                        ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Interactive Legend */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-4 px-2">
            {[
              'Present',
              'WFH',
              'HalfDay',
              'Leave',
              'Weekend',
              'Holiday',
            ].map((s) => {
              const cfg = getCfg(s);
              return (
                <div key={s} className="flex items-center gap-1.5">
                  <span className={`w-2.5 h-2.5 rounded-full ${cfg.dot}`} />
                  <span className="text-slate-600 dark:text-slate-400 text-xs font-medium">
                    {cfg.label}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Weekday Column Headers */}
          <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d, idx) => (
              <div
                key={d}
                className={`text-center text-xs font-bold py-1.5 ${
                  idx >= 5
                    ? 'text-orange-500/80 dark:text-orange-400/80'
                    : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                {d}
              </div>
            ))}
          </div>

          {/* Calendar Grid */}
          {isLoading ? (
            <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
              {[...Array(35)].map((_, i) => (
                <div
                  key={i}
                  className="bg-slate-100 dark:bg-slate-900/60 rounded-2xl h-24 animate-pulse border border-slate-200/60 dark:border-slate-800/60"
                />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
              {[...Array(leadingBlanks)].map((_, i) => (
                <div
                  key={`blank-${i}`}
                  className="min-h-[92px] sm:min-h-[105px] rounded-2xl opacity-10"
                />
              ))}
              {data?.days.map((day) => (
                <DayCell
                  key={day.date}
                  day={day}
                  filteredUserIds={filteredUserIds}
                  onClick={() => {
                    if (day.members.length > 0 || day.isHoliday) {
                      setSelectedDay(day);
                    }
                  }}
                />
              ))}
            </div>
          )}
        </div>

        {/* Sidebar Roster & Presence */}
        <div className="space-y-5">
          <TodayPanel today={todayDay} />

          {/* Team Members Roster */}
          {allMembers.length > 0 && (
            <Card className="border-slate-200/80 dark:border-slate-800 shadow-sm overflow-hidden">
              <CardHeader className="p-4 sm:p-5 border-b border-slate-200/80 dark:border-slate-800">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-blue-500" />
                    <CardTitle className="text-sm font-bold text-slate-900 dark:text-white">
                      Roster Directory
                    </CardTitle>
                  </div>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                    {allMembers.length}
                  </span>
                </div>
              </CardHeader>
              <CardContent className="p-3 sm:p-4">
                <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
                  {allMembers.map((m) => {
                    const isSelected = searchName === m.fullName;

                    return (
                      <div
                        key={m.userId}
                        onClick={() =>
                          setSearchName(isSelected ? '' : m.fullName)
                        }
                        className={`flex items-center gap-2.5 p-2 rounded-xl transition cursor-pointer ${
                          isSelected
                            ? 'bg-blue-500/10 border border-blue-500/30'
                            : 'hover:bg-slate-50 dark:hover:bg-slate-800/60'
                        }`}
                      >
                        <Avatar
                          src={m.profilePhotoUrl}
                          name={m.fullName}
                          size="xs"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-slate-800 dark:text-slate-200 text-xs font-semibold truncate">
                            {m.fullName}
                          </p>
                          <p className="text-slate-400 text-[10px] truncate">
                            {m.role}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Day detail modal */}
      {selectedDay && (
        <DayModal day={selectedDay} onClose={() => setSelectedDay(null)} />
      )}
    </div>
  );
};

export default TeamCalendarPage;