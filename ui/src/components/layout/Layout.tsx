// ─────────────────────────────────────────────────────────────────────────────
//  FILE 4:  frontend/src/components/layout/Layout.tsx
//  ACTION:  REPLACE entire file
//
//  What changed vs original:
//  1. Added `mobileOpen` state — controls slide-in drawer on mobile
//  2. Desktop sidebar: unchanged (collapsed/expanded logic kept exactly)
//  3. Mobile: sidebar is HIDDEN by default (translate-x-[-100%])
//             when hamburger tapped → translates to x-0 (slides in)
//             dark overlay behind drawer closes it on tap
//  4. Mobile top bar: shows hamburger + logo + notification bell
//  5. Mobile bottom bar: 5 quick-access nav links (Dashboard, Tasks, Leave, Notifications, Profile)
//  6. Main content: on mobile gets `pb-16` padding so content isn't hidden behind bottom bar
//  7. All original desktop functionality (collapse, floating popup, sections, badges) kept intact
// ─────────────────────────────────────────────────────────────────────────────

import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../../context/Authcontext';
import { useTheme } from '../../context/ThemeContext';
import { NotificationBell } from '../../pages/Dashboardwidgets';
import { Suspense, useState, useRef, useEffect } from 'react';
import { SkeletonDashboard } from '../Skeleton';
import { announcementsApi, notifApi } from '../../services/api';
import { useQuery } from '@tanstack/react-query';

export const Layout = () => {
  const { user, logout } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const [collapsed, setCollapsed]       = useState(false);
  const [mobileOpen, setMobileOpen]     = useState(false);  // ← NEW: mobile drawer
  const [profileOpen, setProfileOpen]   = useState(false);
  const profileRef  = useRef<HTMLDivElement>(null);
  const [openSections, setOpenSections] = useState<string[]>(['General']);
  const [floatingSection, setFloatingSection] = useState<string | null>(null);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const isManager  = user?.role === 'Manager';

  const toggleSection = (title: string) => {
    setOpenSections((prev) =>
      prev.includes(title) ? prev.filter((t) => t !== title) : [...prev, title]
    );
  };

  // Announcement unread badge
  const { data: unreadData } = useQuery({
    queryKey:        ['announcementUnread'],
    queryFn:         () => announcementsApi.getUnreadCount().then((r) => r.data),
    refetchInterval: 60_000,
  });
  const announcementUnread: number = unreadData?.count ?? 0;

  // Notification unread badge (for nav item + mobile bottom bar)
  const { data: notifCountData } = useQuery({
    queryKey:        ['notifCount'],
    queryFn:         () => notifApi.getCount().then(r => r.data.count as number),
    refetchInterval: 30_000,
  });
  const notifUnread: number = notifCountData ?? 0;

  // Close floating section when clicking outside sidebar
  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (sidebarRef.current && !sidebarRef.current.contains(e.target as Node))
        setFloatingSection(null);
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  // Close profile dropdown when clicking outside
  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node))
        setProfileOpen(false);
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  // Close mobile drawer on route change (user tapped a link)
  // We rely on NavLink's onClick for this — see closeMobile below
  const closeMobile = () => setMobileOpen(false);

  // ═══════════════════════════════════════════════════════════════════════════
  // NAV SECTIONS (unchanged from original)
  // ═══════════════════════════════════════════════════════════════════════════
  const navSections = [
    {
      title: 'General',
      icon: '🏠',
      items: [
        { to: '/',              label: 'Dashboard',     icon: '🏠', exact: true },
        { to: '/analytics',     label: 'Analytics',     icon: '📊' },
        { to: '/history',       label: 'History',       icon: '📅' },
        { to: '/chat',          label: 'Messages',      icon: '💬' },
        { to: '/kudos',         label: 'Kudos',         icon: '🏆' },
        { to: '/face-setup',    label: 'Face Setup',    icon: '📷' },
        { to: '/announcements', label: 'Announcements', icon: '📢', badge: announcementUnread },
        { to: '/notifications', label: 'Notifications', icon: '🔔', badge: notifUnread },
        { to: '/profile',       label: 'My Profile',    icon: '👤' },
      ],
    },
    {
      title: 'Work Management',
      icon: '📋',
      items: [
        { to: '/tasks',          label: 'Tasks',        icon: '✅' },
        { to: '/meetings',       label: 'Meeting Log',  icon: '🤝' },
        { to: '/reviews',        label: 'Performance',  icon: '🎯' },
        { to: '/training',       label: 'Training',     icon: '📚' },
        { to: '/overtime',       label: 'Overtime',     icon: '⏱️' },
        { to: '/eod-reports',    label: 'EOD Reports',  icon: '📝' },
        { to: '/my-eod-reviews', label: 'My Reviews',   icon: '📌' },
        { to: '/my-report',      label: 'My Report',    icon: '📥' },
        { to: '/Goals',          label: 'Goals',        icon: '🎯' },
        { to: '/Goal history',   label: 'Goal History', icon: '📈' },
        { to: '/support',        label: 'Support',      icon: '🤝' },
      ],
    },
    {
      title: 'HR & Requests',
      icon: '🧑',
      items: [
        { to: '/leave',          label: 'Leave',          icon: '🗓️' },
        { to: '/request',        label: 'WFH Requests',   icon: '🏡' },
        { to: '/wfh-summary',    label: 'WFH Summary',    icon: '🏠' },
        { to: '/payroll',        label: 'Payroll',        icon: '💰' },
        { to: '/documents',      label: 'Documents',      icon: '📄' },
        { to: '/team/directory', label: 'Directory',      icon: '👥' },
        { to: '/team/calendar',  label: 'Team Calendar',  icon: '📅' },
        { to: '/resignation',    label: 'Resignation',    icon: '🚪' },
      ],
    },
    {
      title: 'System',
      icon: '⚙️',
      items: [
        { to: '/security', label: 'Security (2FA)', icon: '🔐' },
      ],
    },
  ];

  const managerSection = {
    title: 'Manager',
    icon: '👨‍💼',
    items: [
      { to: '/manager',                label: 'Team Dashboard',      icon: '📋' },
      { to: '/manager/assign-role',    label: 'Assign Roles',        icon: '👥' },
      { to: '/manager/face-setup/:userId',     label: 'Face Setup',          icon: '📷' },
      { to: '/manager/eod-reviews',    label: 'EOD Reviews',         icon: '📝' },
      { to: '/manager/wfh-dashboard',  label: 'Employee Requests', icon: '🗓️' },
      { to: '/manager/support-assignments', label: 'Support Assignments', icon: '🔧' },
    ],
  };

  // ── Reusable nav item renderer used inside both desktop and mobile drawer ───
  const renderNavItems = (
    items: typeof navSections[0]['items'],
    isManagerItems = false
  ) =>
    items.map((item) => (
      <NavLink
        key={item.to}
        to={item.to}
        end={(item as any).exact}
        onClick={closeMobile}
        className={({ isActive }) =>
          `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition
          ${isActive
            ? isManagerItems
              ? 'bg-violet-600/20 text-violet-400'
              : 'bg-blue-600/20 text-blue-400'
            : isDark
            ? 'text-slate-400 hover:bg-slate-800'
            : 'text-slate-600 hover:bg-slate-200'
          }`
        }
      >
        <span>{item.icon}</span>
        {item.label}
        {'badge' in item && (item as any).badge > 0 && (
          <span className="ml-auto bg-blue-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center leading-none">
            {(item as any).badge > 99 ? '99+' : (item as any).badge}
          </span>
        )}
      </NavLink>
    ));

  // ── Section accordion (shared between desktop expanded + mobile drawer) ─────
  const renderSection = (section: typeof navSections[0], isManagerSec = false) => {
    const isOpen = openSections.includes(section.title);
    return (
      <div key={section.title}>
        <button
          onClick={() => toggleSection(section.title)}
          className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-semibold
            ${isManagerSec
              ? isDark ? 'text-violet-400 hover:bg-slate-800' : 'text-violet-600 hover:bg-slate-200'
              : isDark ? 'text-slate-400 hover:bg-slate-800' : 'text-slate-600 hover:bg-slate-200'
            }`}
        >
          <div className="flex items-center gap-2">
            <span>{section.icon}</span>
            {section.title}
          </div>
          <span className="flex flex-col justify-center items-center gap-[3px]">
            <span className={`h-[2px] w-4 bg-current transition-all duration-300 ${isOpen ? 'rotate-45 translate-y-[5px]' : ''}`} />
            <span className={`h-[2px] w-4 bg-current transition-all duration-300 ${isOpen ? 'opacity-0' : ''}`} />
            <span className={`h-[2px] w-4 bg-current transition-all duration-300 ${isOpen ? '-rotate-45 -translate-y-[5px]' : ''}`} />
          </span>
        </button>

        {isOpen && (
          <div className="ml-6 mt-1 space-y-1">
            {renderNavItems(section.items, isManagerSec)}
          </div>
        )}
      </div>
    );
  };

  // ════════════════════════════════════════════════════════════════════════════
  // RENDER
  // ════════════════════════════════════════════════════════════════════════════
  return (
    <div className={`flex h-screen overflow-hidden ${isDark ? 'bg-slate-950 text-white' : 'bg-slate-100 text-slate-900'}`}>

      {/* ══════════════════════════════════════════════════════════════════════
          MOBILE: Dark overlay — tap to close drawer
      ══════════════════════════════════════════════════════════════════════ */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-30 md:hidden"
          onClick={closeMobile}
        />
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          SIDEBAR
          Desktop: fixed width, collapsible (unchanged behaviour)
          Mobile:  hidden off-screen by default, slides in when mobileOpen=true
      ══════════════════════════════════════════════════════════════════════ */}
      <aside
        ref={sidebarRef}
        className={`
          fixed md:relative inset-y-0 left-0 z-40
          flex flex-col flex-shrink-0 border-r
          transition-all duration-300
          ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}

          /* Desktop: respect collapsed state */
          md:w-${collapsed ? '20' : '64'}

          /* Mobile: always full-width drawer, toggled by translateX */
          w-72
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        `}
      >
        {/* ── Logo Section ───────────────────────────────────────────────── */}
        <div className="p-2 border-b border-slate-800/50 text-center relative">
          {/* Desktop collapse button */}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="hidden md:flex absolute top-2 right-2 w-7 h-7 items-center justify-center rounded-md hover:bg-slate-700 transition"
            title={collapsed ? 'Expand' : 'Collapse'}
          >
            <svg className={`w-4 h-4 transition-transform ${collapsed ? 'rotate-180' : ''}`}
              fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          {/* Mobile close button */}
          <button
            onClick={closeMobile}
            className="md:hidden absolute top-2 right-2 w-7 h-7 flex items-center justify-center rounded-md hover:bg-slate-700 transition"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          {/* Logo */}
          <div className={`${collapsed ? 'w-12 h-12 hidden md:flex' : 'h-16'} mx-auto mb-2 bg-white rounded-lg flex items-center justify-center shadow-md overflow-hidden transition-all duration-300`}>
            <img src="/montcrest_software_pvt_ltd_cover.jpg" alt="Montcrest Software"
              className="w-full h-full object-contain p-2" />
          </div>

          {/* System name — hidden when collapsed on desktop */}
          {(!collapsed) && (
            <p className="font-bold text-lg text-white tracking-wide">EMS System</p>
          )}
        </div>

        {/* ── Navigation Menu ─────────────────────────────────────────────── */}
        <nav className="flex-1 p-2 overflow-y-auto space-y-2">

          {/* Desktop expanded: accordion sections */}
          <div className="hidden md:block">
            {!collapsed && (
              <>
                {navSections.map(s => renderSection(s))}
                {isManager && renderSection(managerSection, true)}
              </>
            )}

            {/* Desktop collapsed: icon-only buttons with floating popup */}
            {collapsed && (
              <>
                {[...navSections, ...(isManager ? [managerSection] : [])].map((section) => (
                  <div key={section.title}>
                    <button
                      onClick={() => setFloatingSection(floatingSection === section.title ? null : section.title)}
                      className={`w-full flex items-center justify-center px-3 py-2 rounded-lg text-sm font-semibold
                        ${isDark ? 'text-slate-400 hover:bg-slate-800' : 'text-slate-600 hover:bg-slate-200'}`}
                    >
                      <span>{section.icon}</span>
                    </button>

                    {floatingSection === section.title && (
                      <div className="absolute left-20 mt-2 w-52 bg-slate-900 border border-slate-700 rounded-xl shadow-xl p-2 z-50">
                        {section.items.map((item) => (
                          <NavLink
                            key={item.to}
                            to={item.to}
                            end={(item as any).exact}
                            onClick={() => setFloatingSection(null)}
                            className={({ isActive }) =>
                              `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition
                              ${isActive ? 'bg-blue-600/20 text-blue-400' : 'text-slate-400 hover:bg-slate-800'}`
                            }
                          >
                            <span>{item.icon}</span>
                            {item.label}
                            {'badge' in item && (item as any).badge > 0 && (
                              <span className="ml-auto bg-blue-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center leading-none">
                                {(item as any).badge > 99 ? '99+' : (item as any).badge}
                              </span>
                            )}
                          </NavLink>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </>
            )}
          </div>

          {/* Mobile drawer: always show full accordion (never collapsed) */}
          <div className="md:hidden">
            {navSections.map(s => renderSection(s))}
            {isManager && renderSection(managerSection, true)}
          </div>
        </nav>

        {/* ── User Profile Section ─────────────────────────────────────────── */}
        <div ref={profileRef} className="p-3 border-t border-slate-800/50 relative">
          <div
            onClick={() => setProfileOpen(!profileOpen)}
            className={`flex items-center gap-2 px-2 mb-2 cursor-pointer rounded-xl
              hover:bg-slate-800/50 transition ${collapsed ? 'md:justify-center' : ''}`}
          >
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center text-sm font-bold flex-shrink-0">
              {user?.fullName?.charAt(0).toUpperCase()}
            </div>

            {/* Show name always in mobile drawer, hide when desktop-collapsed */}
            <div className={`min-w-0 flex-1 ${collapsed ? 'md:hidden' : ''}`}>
              <p className="text-xs font-medium truncate text-white">{user?.fullName}</p>
              <p className="text-xs text-slate-500">{user?.role}</p>
            </div>

            {!collapsed && (
              <div onClick={(e) => e.stopPropagation()}>
                <NotificationBell />
              </div>
            )}
          </div>

          {profileOpen && (
            <div className={`absolute ${collapsed ? 'left-16' : 'left-3'} bottom-16 w-44 bg-slate-900 border border-slate-700 rounded-xl shadow-xl p-2 z-50`}>
              <button
                onClick={() => { toggleTheme(); setProfileOpen(false); }}
                className="w-full flex items-center gap-2 text-xs py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition mb-1"
              >
                {isDark ? '☀️ Light Mode' : '🌙 Dark Mode'}
              </button>
              <button
                onClick={() => { logout(); setProfileOpen(false); }}
                className="w-full flex items-center gap-2 text-xs py-2 px-3 rounded-xl bg-slate-800 hover:bg-red-500/20 text-slate-400 hover:text-red-400 transition"
              >
                🚪 Sign Out
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* ══════════════════════════════════════════════════════════════════════
          RIGHT SIDE: top bar (mobile only) + main content + bottom nav (mobile)
      ══════════════════════════════════════════════════════════════════════ */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* ── Mobile Top Bar ──────────────────────────────────────────────────
            Visible ONLY on mobile (md:hidden).
            Desktop users use the sidebar header.                            */}
        <header className={`
          md:hidden flex items-center justify-between px-4 py-3 border-b z-20 flex-shrink-0
          ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}
        `}>
          {/* Hamburger */}
          <button
            onClick={() => setMobileOpen(true)}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
            aria-label="Open menu"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          {/* App name */}
          <p className="font-bold text-white text-base tracking-wide">EMS</p>

          {/* Notification bell (top-right on mobile) */}
          <NotificationBell />
        </header>

        {/* ── Main content area ───────────────────────────────────────────────
            pb-16 on mobile leaves room above the bottom nav bar             */}
        <main className="flex-1 overflow-y-auto pb-16 md:pb-0">
          <Suspense fallback={<SkeletonDashboard />}>
            <Outlet />
          </Suspense>
        </main>

        {/* ── Mobile Bottom Navigation Bar ────────────────────────────────────
            5 most-used shortcuts. Visible ONLY on mobile (md:hidden).
            Safe-area-inset-bottom handles iPhone home indicator area.       */}
        <nav className={`
          md:hidden fixed bottom-0 left-0 right-0 z-20
          flex items-center justify-around
          px-2 pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))]
          border-t
          ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}
        `}>
          {[
            { to: '/',              icon: '🏠', label: 'Home',    exact: true },
            { to: '/tasks',         icon: '✅', label: 'Tasks'              },
            { to: '/leave',         icon: '🗓️', label: 'Leave'              },
            { to: '/notifications', icon: '🔔', label: 'Alerts',  badge: notifUnread },
            { to: '/profile',       icon: '👤', label: 'Profile'            },
          ].map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={(item as any).exact}
              className={({ isActive }) =>
                `relative flex flex-col items-center gap-0.5 px-3 py-1 rounded-xl transition text-[10px] font-medium
                ${isActive ? 'text-blue-400' : 'text-slate-500'}`
              }
            >
              <span className="text-xl leading-none">{item.icon}</span>
              {item.label}
              {/* Unread badge on Alerts tab */}
              {'badge' in item && (item as any).badge > 0 && (
                <span className="absolute top-0 right-1 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                  {(item as any).badge > 9 ? '9+' : (item as any).badge}
                </span>
              )}
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  );
};