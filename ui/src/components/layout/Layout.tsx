// ─────────────────────────────────────────────────────────────────────────────
//  FILE: frontend/src/components/layout/Layout.tsx
//  App shell in the "Dashdark" style: navy sidebar with the Montcrest mark, menu
//  search, line icons, collapsible sections, user card + account menu, phone
//  header and bottom bar.
// ─────────────────────────────────────────────────────────────────────────────

import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/Authcontext';
import { useTheme } from '../../context/ThemeContext';
import { NotificationBell } from '../NotificationBell';
import { Suspense, useState, useRef, useEffect, type ComponentType } from 'react';
import { createPortal } from 'react-dom';
import { SkeletonDashboard } from '../Skeleton';
import { announcementsApi, notifApi } from '../../services/api';
import { useQuery } from '@tanstack/react-query';
import { ErrorBoundary } from '../ErrorBoundary';
import { ChatProvider } from '../../context/ChatContext';
import { ChatDock } from '../chat/ChatDock';
import { IdleSignOut } from '../IdleSignOut';
import { GUIDE_VERSION } from '../../utils/guide';
import { BrandMark } from '../ui/Brand';
import {
  LayoutDashboard, BarChart3, History, Trophy, ScanFace, Megaphone, Bell, UserCircle,
  ListChecks, Handshake, Target, GraduationCap, Timer, FileText, ClipboardCheck, FileDown, Flag,
  TrendingUp, LifeBuoy, CalendarDays, House, Receipt, Laptop, Wallet, FolderOpen, Users,
  CalendarRange, LogOut, BookOpen, Download, ShieldCheck, Briefcase, UserCog, Compass, Wrench,
  Server, Settings, Search, ChevronDown, ChevronsLeft, Sun, Moon, X, Menu, Languages,
} from 'lucide-react';

type Icon = ComponentType<{ className?: string }>;
interface NavItem {
  to: string; label: string; icon: Icon; exact?: boolean; badge?: number;
  isDownload?: boolean; downloadName?: string; badgeLabel?: string;
}
interface NavSection { title: string; icon: Icon; items: NavItem[]; manager?: boolean }

const LayoutShell = () => {
  const { user, logout } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const navigate = useNavigate();
  // the chat page fills the screen itself (its message box sits at the bottom)
  const fullHeightPage = useLocation().pathname.startsWith('/chat');

  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [search, setSearch] = useState('');
  const profileRef = useRef<HTMLDivElement>(null);
  // every section starts collapsed (after login or a reload); click a heading to open it
  const [openSections, setOpenSections] = useState<string[]>([]);
  const [floatingSection, setFloatingSection] = useState<string | null>(null);
  // screen position of the pop-out menu (collapsed sidebar); it's drawn on top of the page,
  // outside the sidebar, so the sidebar's scroll area can't clip it
  const [floatingPos, setFloatingPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const sidebarRef = useRef<HTMLDivElement>(null);
  const floatingRef = useRef<HTMLDivElement>(null);
  const isManager = user?.role === 'Manager' || user?.role === 'TeamLead';

  const toggleSection = (title: string) => {
    setOpenSections((prev) =>
      prev.includes(title) ? prev.filter((t) => t !== title) : [...prev, title]
    );
  };

  // Announcement unread badge
  const { data: unreadData } = useQuery({
    queryKey: ['announcementUnread'],
    queryFn: () => announcementsApi.getUnreadCount().then((r) => r.data),
    refetchInterval: 60_000,
  });
  const announcementUnread: number = unreadData?.count ?? 0;

  // Notification unread badge (for nav item + mobile bottom bar)
  const { data: notifCountData } = useQuery({
    queryKey: ['notifCount'],
    queryFn: () => notifApi.getCount().then(r => r.data.count as number),
    refetchInterval: 30_000,
  });
  const notifUnread: number = notifCountData ?? 0;

  // Close floating section when clicking outside sidebar
  useEffect(() => {
    const handle = (e: MouseEvent) => {
      const t = e.target as Node;
      if (sidebarRef.current && !sidebarRef.current.contains(t) && !floatingRef.current?.contains(t)) {
        setFloatingSection(null);
      }
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  // Close profile dropdown when clicking outside
  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  const closeMobile = () => { setMobileOpen(false); setSearch(''); };

  // ═══════════════════════════════════════════════════════════════════════════
  // NAV SECTIONS
  // ═══════════════════════════════════════════════════════════════════════════
  const guideUrl = (file: string) => `/${file}?v=${GUIDE_VERSION}&download=true`;
  const navSections: NavSection[] = [
    {
      title: 'General',
      icon: LayoutDashboard,
      items: [
        { to: '/', label: 'Dashboard', icon: LayoutDashboard, exact: true },
        { to: '/analytics', label: 'Analytics', icon: BarChart3 },
        { to: '/history', label: 'History', icon: History },
        { to: '/kudos', label: 'Kudos', icon: Trophy },
        { to: '/face-setup', label: 'Face Setup', icon: ScanFace },
        { to: '/announcements', label: 'Announcements', icon: Megaphone, badge: announcementUnread },
        { to: '/notifications', label: 'Notifications', icon: Bell, badge: notifUnread },
        { to: '/profile', label: 'My Profile', icon: UserCircle },
      ],
    },
    {
      title: 'Work Management',
      icon: Briefcase,
      items: [
        { to: '/tasks', label: 'Tasks', icon: ListChecks },
        { to: '/meetings', label: 'Meeting Log', icon: Handshake },
        { to: '/reviews', label: 'Performance', icon: Target },
        { to: '/training', label: 'Training', icon: GraduationCap },
        { to: '/overtime', label: 'Overtime', icon: Timer },
        { to: '/eod-reports', label: 'EOD Reports', icon: FileText },
        { to: '/my-eod-reviews', label: 'My Reviews', icon: ClipboardCheck },
        { to: '/my-report', label: 'My Report', icon: FileDown },
        { to: '/goals', label: 'Goals', icon: Flag },
        { to: '/goal-history', label: 'Goal History', icon: TrendingUp },
        { to: '/support', label: 'Support', icon: LifeBuoy },
      ],
    },
    {
      title: 'HR & Requests',
      icon: Users,
      items: [
        { to: '/leave', label: 'Leave', icon: CalendarDays },
        { to: '/request', label: 'WFH Requests', icon: Laptop },
        { to: '/expenses', label: 'Expenses', icon: Receipt },
        { to: '/wfh-summary', label: 'WFH Summary', icon: House },
        { to: '/payroll', label: 'Payroll', icon: Wallet },
        { to: '/documents', label: 'Documents', icon: FolderOpen },
        { to: '/team/directory', label: 'Directory', icon: Users },
        { to: '/team/calendar', label: 'Team Calendar', icon: CalendarRange },
        { to: '/resignation', label: 'Resignation', icon: LogOut },
      ],
    },
    {
      title: 'System & Docs',
      icon: Settings,
      items: [
        { to: '/guide', label: 'Feature Manual & Hub', icon: BookOpen },
        {
          to: '/DailyTracker_v2_Feature_Guide.pdf', label: 'PDF Guide (English)', icon: Download,
          isDownload: true, downloadName: 'DailyTracker_v2_Feature_Guide.pdf', badgeLabel: '18P',
        },
        {
          to: '/DailyTracker_v2_Feature_Guide_Marathi.pdf', label: 'मराठी मार्गदर्शिका (MR)', icon: Languages,
          isDownload: true, downloadName: 'DailyTracker_v2_Feature_Guide_Marathi.pdf', badgeLabel: '१८P',
        },
        { to: '/security', label: 'Security & 2FA', icon: ShieldCheck },
      ],
    },
  ];

  const managerSection: NavSection = {
    title: 'Manager',
    icon: UserCog,
    manager: true,
    items: [
      { to: '/manager', label: 'Team Dashboard', icon: LayoutDashboard, exact: true },
      // role changes and EOD reviews are Manager-only (the server refuses Team Leads)
      ...(user?.role === 'Manager' ? [{ to: '/manager/assign-role', label: 'Assign Roles', icon: Users }] : []),
      { to: '/manager/face-setup', label: 'Face Setup', icon: ScanFace },
      ...(user?.role === 'Manager' ? [{ to: '/manager/eod-reviews', label: 'EOD Reviews', icon: FileText }] : []),
      { to: '/manager/wfh-dashboard', label: 'Employee Requests', icon: CalendarDays },
      { to: '/manager/onboarding', label: 'Onboarding', icon: Compass },
      { to: '/manager/support-assignments', label: 'Support Assignments', icon: Wrench },
      // error log + backups: Managers only (not Team Leads)
      ...(user?.role === 'Manager' ? [{ to: '/manager/system', label: 'System', icon: Server }] : []),
    ],
  };
  const allSections = [...navSections, ...(isManager ? [managerSection] : [])];

  // ── Menu search: a flat list of matching pages ──────────────────────────────
  const q = search.trim().toLowerCase();
  const searchHits = q
    ? allSections.flatMap(s => s.items.filter(i => i.label.toLowerCase().includes(q) || s.title.toLowerCase().includes(q))
        .map(i => ({ ...i, section: s.title, manager: s.manager })))
    : [];

  // ── One menu row (link or PDF download) ────────────────────────────────────
  const renderItem = (item: NavItem, opts: { manager?: boolean; small?: boolean; onPick?: () => void; hint?: string } = {}) => {
    const Icon = item.icon;
    const size = opts.small ? 'px-2.5 py-1.5 text-xs gap-2' : 'px-3 py-2 text-sm gap-3';
    const pick = opts.onPick ?? closeMobile;
    if (item.isDownload) {
      return (
        <a
          key={item.to}
          href={guideUrl(item.downloadName!)}
          download={item.downloadName}
          target="_blank"
          rel="noopener noreferrer"
          onClick={pick}
          className={`flex items-center rounded-lg font-medium transition ${size} text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10`}
        >
          <Icon className="w-4 h-4 flex-shrink-0" />
          <span className="truncate">{item.label}</span>
          {!opts.small && (
            <span className="ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded leading-none flex-shrink-0 bg-emerald-500/15 text-emerald-700 dark:text-emerald-400">
              {item.badgeLabel}
            </span>
          )}
        </a>
      );
    }
    return (
      <NavLink
        key={item.to}
        to={item.to}
        end={item.exact}
        onClick={pick}
        className={({ isActive }) =>
          `group relative flex items-center rounded-lg font-medium transition ${size} ${
            isActive
              ? opts.manager
                ? 'bg-violet-500/10 text-violet-700 dark:text-violet-400 font-semibold'
                : 'bg-blue-500/10 text-blue-700 dark:text-blue-400 font-semibold'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/70 hover:text-slate-900 dark:hover:text-white'
          }`
        }
      >
        {({ isActive }) => (
          <>
            {isActive && !opts.small && (
              <span className={`absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r ${opts.manager ? 'bg-violet-500' : 'bg-blue-500'}`} />
            )}
            <Icon className="w-4 h-4 flex-shrink-0" />
            <span className="truncate">{item.label}</span>
            {opts.hint && <span className="ml-auto text-[10px] text-slate-400 dark:text-slate-500 truncate">{opts.hint}</span>}
            {!opts.hint && Number(item.badge) > 0 && (
              <span className="ml-auto bg-blue-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center leading-none">
                {item.badge! > 99 ? '99+' : item.badge}
              </span>
            )}
          </>
        )}
      </NavLink>
    );
  };

  // ── Section accordion ───────────────────────────────────────────────────────
  const renderSection = (section: NavSection) => {
    const isOpen = openSections.includes(section.title);
    const Icon = section.icon;
    return (
      <div key={section.title} className="mb-1">
        <button
          type="button"
          onClick={() => toggleSection(section.title)}
          aria-expanded={isOpen}
          className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[11px] font-semibold uppercase tracking-wider transition ${
            section.manager
              ? 'text-violet-700 dark:text-violet-400 hover:bg-violet-500/10'
              : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/70 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <Icon className="w-4 h-4" />
          <span>{section.title}</span>
          <ChevronDown className={`w-4 h-4 ml-auto transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
        </button>

        {isOpen && (
          <div className="mt-1 mb-2 space-y-0.5">
            {section.items.map(i => renderItem(i, { manager: section.manager }))}
          </div>
        )}
      </div>
    );
  };

  const searchBox = (
    <div className="px-3 pt-3">
      <label className="relative block">
        <span className="sr-only">Search menu</span>
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 pointer-events-none" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          onKeyDown={e => { if (e.key === 'Escape') setSearch(''); }}
          placeholder="Search for…"
          className="w-full pl-9 pr-3 py-2 rounded-lg text-sm bg-slate-100 dark:bg-slate-900 border border-transparent dark:border-slate-800 text-slate-800 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500/50 transition"
        />
      </label>
    </div>
  );

  const menuBody = q ? (
    <div className="space-y-0.5">
      {searchHits.length === 0
        ? <p className="px-3 py-6 text-center text-xs text-slate-500 dark:text-slate-400">No page matches “{search}”.</p>
        : searchHits.map(h => renderItem(h, { manager: h.manager, hint: h.section }))}
    </div>
  ) : (
    <>{allSections.map(renderSection)}</>
  );

  const initials = (user?.fullName ?? 'U').split(' ').filter(Boolean).slice(0, 2).map(w => w[0]!.toUpperCase()).join('');
  const menuBtn = 'w-full flex items-center gap-2.5 text-xs py-2 px-2.5 rounded-lg font-medium transition';

  return (
    <div className="flex h-screen overflow-hidden bg-slate-100 text-slate-900 dark:bg-slate-950 dark:text-white">

      {/* ── MOBILE: Dark overlay ────────────────────────────────────────── */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-slate-950/70 z-[54] md:hidden backdrop-blur-sm"
          onClick={closeMobile}
        />
      )}

      {/* ── SIDEBAR ──────────────────────────────────────────────────────── */}
      <aside
        ref={sidebarRef}
        className={`
          fixed md:relative inset-y-0 left-0 ${mobileOpen ? 'z-[55] md:z-40' : 'z-40'}
          flex flex-col flex-shrink-0 border-r
          transition-all duration-300
          bg-white border-slate-200 dark:bg-slate-950 dark:border-slate-800
          ${collapsed ? 'md:w-20' : 'md:w-64'}
          w-72
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        `}
      >
        {/* ── Brand ───────────────────────────────────────────────────────── */}
        <div className={`relative flex items-center gap-3 px-4 h-16 flex-shrink-0 ${collapsed ? 'md:justify-center md:px-2' : ''}`}>
          <BrandMark className="w-9 h-9" />
          <div className={`min-w-0 ${collapsed ? 'md:hidden' : ''}`}>
            <p className="font-bold text-[15px] leading-tight tracking-tight text-slate-900 dark:text-white truncate">DailyTracker</p>
            <p className="text-[11px] leading-tight font-medium text-slate-500 dark:text-slate-400 truncate">Montcrest Software</p>
          </div>

          {/* Desktop collapse button */}
          <button
            type="button"
            onClick={() => { setCollapsed(!collapsed); setSearch(''); }}
            className={`hidden md:flex absolute top-1/2 -translate-y-1/2 w-6 h-6 items-center justify-center rounded-md border transition
              bg-white border-slate-200 text-slate-500 hover:text-slate-900 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-400 dark:hover:text-white
              ${collapsed ? '-right-3' : 'right-3'}`}
            title={collapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
          >
            <ChevronsLeft className={`w-3.5 h-3.5 transition-transform duration-300 ${collapsed ? 'rotate-180' : ''}`} />
          </button>

          {/* Mobile close button */}
          <button
            type="button"
            onClick={closeMobile}
            className="md:hidden ml-auto w-8 h-8 flex items-center justify-center rounded-lg transition text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
            aria-label="Close menu"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ── Menu search ─────────────────────────────────────────────────── */}
        <div className={collapsed ? 'md:hidden' : ''}>{searchBox}</div>

        {/* ── Navigation Menu ─────────────────────────────────────────────── */}
        <nav className="flex-1 px-3 py-3 overflow-y-auto">
          {/* Desktop expanded: accordion sections */}
          <div className="hidden md:block">
            {!collapsed && menuBody}

            {/* Desktop collapsed: icon-only buttons with floating popup */}
            {collapsed && (
              <div className="space-y-2 pt-1">
                {allSections.map((section) => {
                  const SectionIcon = section.icon;
                  return (
                    <div key={section.title} className="relative">
                      <button
                        type="button"
                        onClick={(e) => {
                          if (floatingSection === section.title) { setFloatingSection(null); return; }
                          const r = e.currentTarget.getBoundingClientRect();
                          // keep the menu on screen: shift it up if it would run past the bottom
                          const est = 56 + section.items.length * 30;
                          setFloatingPos({ left: r.right + 8, top: Math.max(8, Math.min(r.top, window.innerHeight - est - 8)) });
                          setFloatingSection(section.title);
                        }}
                        className={`w-full flex items-center justify-center p-2.5 rounded-xl transition ${
                          floatingSection === section.title
                            ? 'bg-blue-600 text-white shadow-sm shadow-blue-600/30'
                            : section.manager
                            ? 'text-violet-700 dark:text-violet-400 hover:bg-violet-500/10'
                            : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
                        }`}
                        title={section.title}
                      >
                        <SectionIcon className="w-5 h-5" />
                      </button>

                      {floatingSection === section.title && createPortal(
                        <div
                          ref={floatingRef}
                          style={{ top: floatingPos.top, left: floatingPos.left }}
                          className="fixed w-60 max-h-[calc(100vh-1rem)] overflow-y-auto rounded-xl shadow-2xl p-2 z-[9999] border bg-white border-slate-200 dark:bg-slate-900 dark:border-slate-700"
                        >
                          <div className="px-2 py-1.5 mb-1 border-b font-semibold text-[11px] uppercase tracking-wider flex items-center gap-1.5 border-slate-100 text-slate-500 dark:border-slate-800 dark:text-slate-400">
                            <SectionIcon className="w-3.5 h-3.5" />
                            <span>{section.title}</span>
                          </div>
                          <div className="space-y-0.5">
                            {section.items.map(i => renderItem(i, { manager: section.manager, small: true, onPick: () => setFloatingSection(null) }))}
                          </div>
                        </div>,
                        document.body
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Mobile drawer: always show full accordion */}
          <div className="md:hidden">{menuBody}</div>
        </nav>

        {/* ── User card ───────────────────────────────────────────────────── */}
        <div ref={profileRef} className="p-3 border-t relative border-slate-200 dark:border-slate-800">
          <div
            onClick={() => setProfileOpen(!profileOpen)}
            className={`flex items-center gap-2.5 p-2 cursor-pointer rounded-xl transition hover:bg-slate-100 dark:hover:bg-slate-900 ${collapsed ? 'md:justify-center' : ''}`}
            title="Account & Documentation Menu"
          >
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-violet-500 flex items-center justify-center text-xs font-bold text-white ring-2 ring-white dark:ring-slate-950 shrink-0">
              {initials}
            </div>

            {/* User name & role info */}
            <div className={`min-w-0 flex-1 ${collapsed ? 'md:hidden' : ''}`}>
              <p className="text-[13px] font-semibold truncate text-slate-900 dark:text-white">
                {user?.fullName || 'User'}
              </p>
              <div className="flex items-center gap-1.5">
                <span className={`inline-block w-1.5 h-1.5 rounded-full ${isManager ? 'bg-violet-500' : 'bg-emerald-500'}`} />
                <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">{user?.role || 'Employee'}</p>
              </div>
            </div>

            {!collapsed && (
              <div onClick={(e) => e.stopPropagation()} className="ml-auto">
                <NotificationBell />
              </div>
            )}
          </div>

          {/* Account menu */}
          {profileOpen && (
            <div
              className={`absolute ${
                collapsed ? 'left-16 bottom-2' : 'left-3 right-3 bottom-[4.5rem]'
              } w-64 rounded-2xl shadow-2xl p-2.5 z-50 border bg-white border-slate-200 text-slate-800 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-200`}
            >
              <div className="px-2.5 py-2 mb-2 rounded-xl border bg-slate-50 border-slate-100 dark:bg-slate-800/60 dark:border-slate-700/60">
                <p className="text-xs font-bold truncate">{user?.fullName || 'Signed In'}</p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">{user?.email || ''}</p>
                <span className={`inline-block mt-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                  isManager
                    ? 'bg-violet-500/15 text-violet-700 dark:text-violet-400 border-violet-500/30'
                    : 'bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30'
                }`}>
                  {user?.role || 'Staff'}
                </span>
              </div>

              <div className="space-y-0.5">
                <button type="button" onClick={() => { navigate('/profile'); setProfileOpen(false); closeMobile(); }}
                  className={`${menuBtn} hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300`}>
                  <UserCircle className="w-4 h-4" /><span>My Profile & Stats</span>
                </button>
                <button type="button" onClick={() => { navigate('/guide'); setProfileOpen(false); closeMobile(); }}
                  className={`${menuBtn} bg-blue-500/10 text-blue-700 dark:text-blue-400 hover:bg-blue-500/20`}>
                  <BookOpen className="w-4 h-4" /><span>Documentation Hub</span>
                  <span className="ml-auto text-[10px] bg-blue-500/20 px-1.5 py-0.5 rounded">v2.0</span>
                </button>
                <a href={guideUrl('DailyTracker_v2_Feature_Guide.pdf')} download="DailyTracker_v2_Feature_Guide.pdf"
                  target="_blank" rel="noopener noreferrer" onClick={() => setProfileOpen(false)}
                  className={`${menuBtn} hover:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400`}>
                  <Download className="w-4 h-4" /><span>PDF Guide (English)</span>
                  <span className="ml-auto text-[10px] text-slate-500 dark:text-slate-400">18P</span>
                </a>
                <a href={guideUrl('DailyTracker_v2_Feature_Guide_Marathi.pdf')} download="DailyTracker_v2_Feature_Guide_Marathi.pdf"
                  target="_blank" rel="noopener noreferrer" onClick={() => setProfileOpen(false)}
                  className={`${menuBtn} hover:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400`}>
                  <Languages className="w-4 h-4" /><span>मराठी मार्गदर्शिका (PDF)</span>
                  <span className="ml-auto text-[10px] text-slate-500 dark:text-slate-400">१८P</span>
                </a>
                <button type="button" onClick={() => { navigate('/security'); setProfileOpen(false); closeMobile(); }}
                  className={`${menuBtn} hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300`}>
                  <ShieldCheck className="w-4 h-4" /><span>Security & 2FA Setup</span>
                </button>
              </div>

              <div className="mt-2 pt-2 border-t space-y-0.5 border-slate-100 dark:border-slate-800">
                <button type="button" onClick={() => { toggleTheme(); setProfileOpen(false); }}
                  className={`${menuBtn} hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300`}>
                  {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                  <span>{isDark ? 'Light Theme' : 'Dark Theme'}</span>
                </button>
                <button type="button" onClick={() => { logout(); setProfileOpen(false); }}
                  className={`${menuBtn} font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-500/10`}>
                  <LogOut className="w-4 h-4" /><span>Sign Out</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </aside>

      {/* ── RIGHT MAIN CONTAINER ────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* ── Mobile Top Header ─────────────────────────────────────────── */}
        <header className="md:hidden flex items-center justify-between px-3 h-14 border-b z-20 flex-shrink-0 bg-white border-slate-200 dark:bg-slate-950 dark:border-slate-800">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="p-2 rounded-xl transition text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-800"
            aria-label="Open navigation drawer"
          >
            <Menu className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-2">
            <BrandMark className="w-7 h-7 rounded-lg" />
            <span className="font-bold text-sm tracking-tight">DailyTracker</span>
          </div>

          <div className="flex items-center gap-1">
            <NavLink
              to="/guide"
              className="p-2 rounded-xl text-blue-600 hover:bg-blue-500/10 dark:text-blue-400"
              title="Docs Hub"
              aria-label="Docs Hub"
            >
              <BookOpen className="w-5 h-5" />
            </NavLink>
            <NotificationBell />
          </div>
        </header>

        {/* ── Main Content Area ─────────────────────────────────────────── */}
        {/* bottom room so the last item can scroll clear of the bottom bar and the chat / AI Help buttons */}
        <main className={`flex-1 overflow-y-auto ${fullHeightPage ? 'pb-16 md:pb-0' : 'pb-40 md:pb-24'}`}>
          <ErrorBoundary>
            <Suspense fallback={<SkeletonDashboard />}>
              <Outlet />
            </Suspense>
          </ErrorBoundary>
        </main>

        {/* ── Mobile Bottom Navigation Bar ──────────────────────────────── */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 z-20 flex items-center justify-around px-2 pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] border-t shadow-lg backdrop-blur-md bg-white/95 border-slate-200 dark:bg-slate-950/95 dark:border-slate-800">
          {([
            { to: '/', icon: LayoutDashboard, label: 'Home', exact: true },
            { to: '/tasks', icon: ListChecks, label: 'Tasks' },
            { to: '/leave', icon: CalendarDays, label: 'Leave' },
            { to: '/guide', icon: BookOpen, label: 'Docs' },
            { to: '/notifications', icon: Bell, label: 'Alerts', badge: notifUnread },
            { to: '/profile', icon: UserCircle, label: 'Profile' },
          ] as NavItem[]).map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.exact}
                className={({ isActive }) =>
                  `relative flex flex-col items-center gap-1 px-2.5 py-1 rounded-xl transition text-[10px] font-medium ${
                    isActive ? 'text-blue-600 dark:text-blue-400 font-semibold' : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
                  }`
                }
              >
                <Icon className="w-5 h-5" />
                <span>{item.label}</span>
                {Number(item.badge) > 0 && (
                  <span className="absolute top-0 right-1 w-4 h-4 bg-rose-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                    {item.badge! > 9 ? '9+' : item.badge}
                  </span>
                )}
              </NavLink>
            );
          })}
        </nav>
      </div>
    </div>
  );
};

// Chat lives app-wide: one connection + the floating chat bubble / panel
export const Layout = () => (
  <ChatProvider>
    <IdleSignOut />
    <LayoutShell />
    <ChatDock />
  </ChatProvider>
);
