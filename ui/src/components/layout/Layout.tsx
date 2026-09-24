// ─────────────────────────────────────────────────────────────────────────────
//  FILE: frontend/src/components/layout/Layout.tsx
//  Sidebar System & Docs, User Profile Dropdown, Documentation Hub & Mobile Nav
// ─────────────────────────────────────────────────────────────────────────────

import { NavLink, Outlet, useNavigate } from 'react-router-dom';
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
  const navigate = useNavigate();

  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);
  const [openSections, setOpenSections] = useState<string[]>(['General', 'System & Docs']);
  const [floatingSection, setFloatingSection] = useState<string | null>(null);
  const sidebarRef = useRef<HTMLDivElement>(null);
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
      if (sidebarRef.current && !sidebarRef.current.contains(e.target as Node)) {
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

  const closeMobile = () => setMobileOpen(false);

  // ═══════════════════════════════════════════════════════════════════════════
  // NAV SECTIONS
  // ═══════════════════════════════════════════════════════════════════════════
  const navSections = [
    {
      title: 'General',
      icon: '🏠',
      items: [
        { to: '/', label: 'Dashboard', icon: '🏠', exact: true },
        { to: '/analytics', label: 'Analytics', icon: '📊' },
        { to: '/history', label: 'History', icon: '📅' },
        { to: '/chat', label: 'Messages', icon: '💬' },
        { to: '/kudos', label: 'Kudos', icon: '🏆' },
        { to: '/face-setup', label: 'Face Setup', icon: '📷' },
        { to: '/announcements', label: 'Announcements', icon: '📢', badge: announcementUnread },
        { to: '/notifications', label: 'Notifications', icon: '🔔', badge: notifUnread },
        { to: '/profile', label: 'My Profile', icon: '👤' },
      ],
    },
    {
      title: 'Work Management',
      icon: '📋',
      items: [
        { to: '/tasks', label: 'Tasks', icon: '✅' },
        { to: '/meetings', label: 'Meeting Log', icon: '🤝' },
        { to: '/reviews', label: 'Performance', icon: '🎯' },
        { to: '/training', label: 'Training', icon: '📚' },
        { to: '/overtime', label: 'Overtime', icon: '⏱️' },
        { to: '/eod-reports', label: 'EOD Reports', icon: '📝' },
        { to: '/my-eod-reviews', label: 'My Reviews', icon: '📌' },
        { to: '/my-report', label: 'My Report', icon: '📥' },
        { to: '/goals', label: 'Goals', icon: '🎯' },
        { to: '/goal-history', label: 'Goal History', icon: '📈' },
        { to: '/support', label: 'Support', icon: '🤝' },
      ],
    },
    {
      title: 'HR & Requests',
      icon: '🧑',
      items: [
        { to: '/leave', label: 'Leave', icon: '🗓️' },
        { to: '/request', label: 'WFH Requests', icon: '🏡' },
        { to: '/wfh-summary', label: 'WFH Summary', icon: '🏠' },
        { to: '/payroll', label: 'Payroll', icon: '💰' },
        { to: '/documents', label: 'Documents', icon: '📄' },
        { to: '/team/directory', label: 'Directory', icon: '👥' },
        { to: '/team/calendar', label: 'Team Calendar', icon: '📅' },
        { to: '/resignation', label: 'Resignation', icon: '🚪' },
      ],
    },
    {
      title: 'System & Docs',
      icon: '⚙️',
      items: [
        { to: '/guide', label: 'Feature Manual & Hub', icon: '📖' },
        {
          to: '/DailyTracker_v2_Feature_Guide.pdf',
          label: 'PDF Guide (English)',
          icon: '📥',
          isDownload: true,
          downloadName: 'DailyTracker_v2_Feature_Guide.pdf',
          badgeLabel: '40P',
        },
        {
          to: '/DailyTracker_v2_Feature_Guide_Marathi.pdf',
          label: 'मराठी मार्गदर्शिका (MR)',
          icon: '📥',
          isDownload: true,
          downloadName: 'DailyTracker_v2_Feature_Guide_Marathi.pdf',
          badgeLabel: '१५P',
        },
        { to: '/security', label: 'Security & 2FA', icon: '🔐' },
      ],
    },
  ];

  const managerSection = {
    title: 'Manager',
    icon: '👨‍💼',
    items: [
      { to: '/manager', label: 'Team Dashboard', icon: '📋' },
      { to: '/manager/assign-role', label: 'Assign Roles', icon: '👥' },
      { to: '/manager/face-setup/:userId', label: 'Face Setup', icon: '📷' },
      { to: '/manager/eod-reviews', label: 'EOD Reviews', icon: '📝' },
      { to: '/manager/wfh-dashboard', label: 'Employee Requests', icon: '🗓️' },
      { to: '/manager/support-assignments', label: 'Support Assignments', icon: '🔧' },
    ],
  };

  // ── Reusable nav item renderer ─────────────────────────────────────────────
  const renderNavItems = (
    items: typeof navSections[0]['items'],
    isManagerItems = false
  ) =>
    items.map((item) => {
      if ((item as any).isDownload) {
        const downloadName = (item as any).downloadName || 'DailyTracker_v2_Feature_Guide.pdf';
        const badgeLabel = (item as any).badgeLabel || 'PDF';
        const downloadUrl = `${item.to}?download=true`;
        return (
          <a
            key={item.to}
            href={downloadUrl}
            download={downloadName}
            target="_blank"
            rel="noopener noreferrer"
            onClick={closeMobile}
            className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition ${
              isDark
                ? 'text-emerald-400 hover:bg-emerald-500/10'
                : 'text-emerald-600 hover:bg-emerald-50'
            }`}
          >
            <span>{item.icon}</span>
            <span className="truncate">{item.label}</span>
            <span className={`ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded leading-none flex-shrink-0 ${
              isDark ? 'bg-emerald-500/20 text-emerald-400' : 'bg-emerald-100 text-emerald-700'
            }`}>
              {badgeLabel}
            </span>
          </a>
        );
      }
      return (
        <NavLink
          key={item.to}
          to={item.to}
          end={(item as any).exact}
          onClick={closeMobile}
          className={({ isActive }) =>
            `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition font-medium
            ${isActive
              ? isManagerItems
                ? isDark ? 'bg-violet-600/20 text-violet-400' : 'bg-violet-100 text-violet-700 font-semibold'
                : isDark ? 'bg-blue-600/20 text-blue-400' : 'bg-blue-100 text-blue-700 font-semibold'
              : isDark
              ? 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`
          }
        >
          <span>{item.icon}</span>
          <span className="truncate">{item.label}</span>
          {'badge' in item && Number((item as any).badge) > 0 && (
            <span className="ml-auto bg-blue-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center leading-none">
              {(item as any).badge > 99 ? '99+' : (item as any).badge}
            </span>
          )}
        </NavLink>
      );
    });

  // ── Section accordion ───────────────────────────────────────────────────────
  const renderSection = (section: typeof navSections[0], isManagerSec = false) => {
    const isOpen = openSections.includes(section.title);
    return (
      <div key={section.title} className="mb-1">
        <button
          type="button"
          onClick={() => toggleSection(section.title)}
          className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition
            ${isManagerSec
              ? isDark ? 'text-violet-400 hover:bg-slate-800' : 'text-violet-700 hover:bg-violet-50'
              : isDark ? 'text-slate-400 hover:bg-slate-800' : 'text-slate-600 hover:bg-slate-100'
            }`}
        >
          <div className="flex items-center gap-2">
            <span>{section.icon}</span>
            <span>{section.title}</span>
          </div>
          <span className="flex flex-col justify-center items-center gap-[3px]">
            <span className={`h-[2px] w-3.5 bg-current transition-all duration-300 ${isOpen ? 'rotate-45 translate-y-[5px]' : ''}`} />
            <span className={`h-[2px] w-3.5 bg-current transition-all duration-300 ${isOpen ? 'opacity-0' : ''}`} />
            <span className={`h-[2px] w-3.5 bg-current transition-all duration-300 ${isOpen ? '-rotate-45 -translate-y-[5px]' : ''}`} />
          </span>
        </button>

        {isOpen && (
          <div className="ml-3 mt-1 space-y-0.5 border-l border-slate-700/30 dark:border-slate-800 pl-2">
            {renderNavItems(section.items, isManagerSec)}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={`flex h-screen overflow-hidden ${isDark ? 'bg-slate-950 text-white' : 'bg-slate-100 text-slate-900'}`}>

      {/* ── MOBILE: Dark overlay ────────────────────────────────────────── */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-30 md:hidden backdrop-blur-xs"
          onClick={closeMobile}
        />
      )}

      {/* ── SIDEBAR ──────────────────────────────────────────────────────── */}
      <aside
        ref={sidebarRef}
        className={`
          fixed md:relative inset-y-0 left-0 z-40
          flex flex-col flex-shrink-0 border-r
          transition-all duration-300
          ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}
          ${collapsed ? 'md:w-20' : 'md:w-64'}
          w-72
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        `}
      >
        {/* ── Logo Section ───────────────────────────────────────────────── */}
        <div className={`p-3 border-b text-center relative ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
          {/* Desktop collapse button */}
          <button
            type="button"
            onClick={() => setCollapsed(!collapsed)}
            className={`hidden md:flex absolute top-3 right-2 w-7 h-7 items-center justify-center rounded-lg transition ${
              isDark ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-100 text-slate-600'
            }`}
            title={collapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
          >
            <svg
              className={`w-4 h-4 transition-transform duration-300 ${collapsed ? 'rotate-180' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          {/* Mobile close button */}
          <button
            type="button"
            onClick={closeMobile}
            className={`md:hidden absolute top-3 right-3 w-7 h-7 flex items-center justify-center rounded-lg transition ${
              isDark ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-100 text-slate-600'
            }`}
            aria-label="Close menu"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          {/* Logo image */}
          <div className={`${collapsed ? 'w-10 h-10' : 'h-12 w-auto'} mx-auto mb-1.5 bg-white rounded-xl flex items-center justify-center shadow-xs overflow-hidden transition-all duration-300`}>
            <img
              src="/montcrest_software_pvt_ltd_cover.jpg"
              alt="Montcrest Software"
              className="w-full h-full object-contain p-1"
            />
          </div>

          {/* System brand name */}
          {!collapsed && (
            <div>
              <p className={`font-bold text-sm tracking-wide ${isDark ? 'text-white' : 'text-slate-900'}`}>
                Montcrest EMS
              </p>
              <p className="text-[10px] text-blue-500 font-semibold uppercase tracking-wider">
                DailyTracker v2
              </p>
            </div>
          )}
        </div>

        {/* ── Navigation Menu ─────────────────────────────────────────────── */}
        <nav className="flex-1 p-2 overflow-y-auto space-y-1">
          {/* Desktop expanded: accordion sections */}
          <div className="hidden md:block">
            {!collapsed && (
              <>
                {navSections.map((s) => renderSection(s))}
                {isManager && renderSection(managerSection, true)}
              </>
            )}

            {/* Desktop collapsed: icon-only buttons with floating popup */}
            {collapsed && (
              <div className="space-y-2 pt-1">
                {[...navSections, ...(isManager ? [managerSection] : [])].map((section) => (
                  <div key={section.title} className="relative">
                    <button
                      type="button"
                      onClick={() => setFloatingSection(floatingSection === section.title ? null : section.title)}
                      className={`w-full flex items-center justify-center p-2.5 rounded-xl transition ${
                        floatingSection === section.title
                          ? 'bg-blue-600 text-white shadow-sm'
                          : isDark
                          ? 'text-slate-400 hover:bg-slate-800 hover:text-white'
                          : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                      }`}
                      title={section.title}
                    >
                      <span className="text-lg">{section.icon}</span>
                    </button>

                    {floatingSection === section.title && (
                      <div className={`absolute left-16 top-0 w-60 rounded-xl shadow-xl p-2 z-50 border ${
                        isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'
                      }`}>
                        <div className={`px-2 py-1.5 mb-1 border-b font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 ${
                          isDark ? 'border-slate-800 text-slate-300' : 'border-slate-100 text-slate-700'
                        }`}>
                          <span>{section.icon}</span>
                          <span>{section.title}</span>
                        </div>
                        <div className="space-y-0.5">
                          {section.items.map((item) => {
                            if ((item as any).isDownload) {
                              const downloadName = (item as any).downloadName || 'DailyTracker_v2_Feature_Guide.pdf';
                              const downloadUrl = `${item.to}?download=true`;
                              return (
                                <a
                                  key={item.to}
                                  href={downloadUrl}
                                  download={downloadName}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={() => setFloatingSection(null)}
                                  className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium transition ${
                                    isDark ? 'text-emerald-400 hover:bg-emerald-500/10' : 'text-emerald-600 hover:bg-emerald-50'
                                  }`}
                                >
                                  <span>{item.icon}</span>
                                  <span className="truncate">{item.label}</span>
                                </a>
                              );
                            }
                            return (
                              <NavLink
                                key={item.to}
                                to={item.to}
                                end={(item as any).exact}
                                onClick={() => setFloatingSection(null)}
                                className={({ isActive }) =>
                                  `flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs transition ${
                                    isActive
                                      ? 'bg-blue-600 text-white font-medium'
                                      : isDark
                                      ? 'text-slate-300 hover:bg-slate-800'
                                      : 'text-slate-600 hover:bg-slate-100'
                                  }`
                                }
                              >
                                <span>{item.icon}</span>
                                <span className="truncate">{item.label}</span>
                                {'badge' in item && Number((item as any).badge) > 0 && (
                                  <span className="ml-auto bg-blue-500 text-white text-[9px] font-bold px-1.5 py-0.2 rounded-full">
                                    {(item as any).badge}
                                  </span>
                                )}
                              </NavLink>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Mobile drawer: always show full accordion */}
          <div className="md:hidden">
            {navSections.map((s) => renderSection(s))}
            {isManager && renderSection(managerSection, true)}
          </div>
        </nav>

        {/* ── User Profile Section ─────────────────────────────────────────── */}
        <div ref={profileRef} className={`p-3 border-t relative ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
          <div
            onClick={() => setProfileOpen(!profileOpen)}
            className={`flex items-center gap-2.5 p-2 cursor-pointer rounded-xl transition ${
              isDark ? 'hover:bg-slate-800/70' : 'hover:bg-slate-100'
            } ${collapsed ? 'md:justify-center' : ''}`}
            title="Account & Documentation Menu"
          >
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-sm font-bold text-white shadow-xs shrink-0">
              {user?.fullName ? user.fullName.charAt(0).toUpperCase() : 'U'}
            </div>

            {/* User name & role info */}
            <div className={`min-w-0 flex-1 ${collapsed ? 'md:hidden' : ''}`}>
              <p className={`text-xs font-semibold truncate ${isDark ? 'text-white' : 'text-slate-900'}`}>
                {user?.fullName || 'User'}
              </p>
              <div className="flex items-center gap-1.5">
                <span className={`inline-block w-1.5 h-1.5 rounded-full ${isManager ? 'bg-violet-500' : 'bg-emerald-500'}`} />
                <p className="text-[11px] text-slate-400 truncate">{user?.role || 'Employee'}</p>
              </div>
            </div>

            {!collapsed && (
              <div onClick={(e) => e.stopPropagation()} className="ml-auto">
                <NotificationBell />
              </div>
            )}
          </div>

          {/* Profile Dropdown Hub */}
          {profileOpen && (
            <div
              className={`absolute ${
                collapsed ? 'left-16 bottom-2' : 'left-3 right-3 bottom-16'
              } w-64 rounded-2xl shadow-2xl p-2.5 z-50 border transition-all ${
                isDark
                  ? 'bg-slate-900 border-slate-700 text-slate-200'
                  : 'bg-white border-slate-200 text-slate-800'
              }`}
            >
              {/* User header details */}
              <div className={`px-2.5 py-2 mb-2 rounded-xl border ${
                isDark ? 'bg-slate-800/60 border-slate-700/60' : 'bg-slate-50 border-slate-100'
              }`}>
                <p className="text-xs font-bold truncate">{user?.fullName || 'Signed In'}</p>
                <p className="text-[11px] text-slate-400 truncate">{user?.email || 'user@montcrest.com'}</p>
                <div className="mt-1 flex items-center gap-1">
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                    isManager
                      ? 'bg-violet-500/20 text-violet-400 border border-violet-500/30'
                      : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                  }`}>
                    {user?.role || 'Staff'}
                  </span>
                </div>
              </div>

              {/* Navigation and Documentation links */}
              <div className="space-y-1">
                <button
                  type="button"
                  onClick={() => {
                    navigate('/profile');
                    setProfileOpen(false);
                    closeMobile();
                  }}
                  className={`w-full flex items-center gap-2 text-xs py-2 px-2.5 rounded-xl font-medium transition ${
                    isDark ? 'hover:bg-slate-800 text-slate-300' : 'hover:bg-slate-100 text-slate-700'
                  }`}
                >
                  <span>👤</span>
                  <span>My Profile & Stats</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    navigate('/guide');
                    setProfileOpen(false);
                    closeMobile();
                  }}
                  className={`w-full flex items-center gap-2 text-xs py-2 px-2.5 rounded-xl font-medium transition ${
                    isDark
                      ? 'bg-blue-500/10 text-blue-400 hover:bg-blue-500/20'
                      : 'bg-blue-50 text-blue-600 hover:bg-blue-100'
                  }`}
                >
                  <span>📖</span>
                  <span>Documentation Hub</span>
                  <span className="ml-auto text-[10px] bg-blue-500/20 px-1.5 py-0.5 rounded">v2.0</span>
                </button>

                <a
                  href="/DailyTracker_v2_Feature_Guide.pdf?download=true"
                  download="DailyTracker_v2_Feature_Guide.pdf"
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setProfileOpen(false)}
                  className={`w-full flex items-center gap-2 text-xs py-2 px-2.5 rounded-xl font-medium transition ${
                    isDark ? 'hover:bg-emerald-500/10 text-emerald-400' : 'hover:bg-emerald-50 text-emerald-600'
                  }`}
                >
                  <span>📥</span>
                  <span>PDF Guide (English)</span>
                  <span className="ml-auto text-[10px] text-slate-400">40P</span>
                </a>

                <a
                  href="/DailyTracker_v2_Feature_Guide_Marathi.pdf?download=true"
                  download="DailyTracker_v2_Feature_Guide_Marathi.pdf"
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setProfileOpen(false)}
                  className={`w-full flex items-center gap-2 text-xs py-2 px-2.5 rounded-xl font-medium transition ${
                    isDark ? 'hover:bg-emerald-500/10 text-emerald-400' : 'hover:bg-emerald-50 text-emerald-600'
                  }`}
                >
                  <span>🇮🇳</span>
                  <span>मराठी मार्गदर्शिका (PDF)</span>
                  <span className="ml-auto text-[10px] text-slate-400">१५P</span>
                </a>

                <button
                  type="button"
                  onClick={() => {
                    navigate('/security');
                    setProfileOpen(false);
                    closeMobile();
                  }}
                  className={`w-full flex items-center gap-2 text-xs py-2 px-2.5 rounded-xl font-medium transition ${
                    isDark ? 'hover:bg-slate-800 text-slate-300' : 'hover:bg-slate-100 text-slate-700'
                  }`}
                >
                  <span>🔐</span>
                  <span>Security & 2FA Setup</span>
                </button>
              </div>

              {/* Preferences & Sign Out */}
              <div className={`mt-2 pt-2 border-t space-y-1 ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
                <button
                  type="button"
                  onClick={() => {
                    toggleTheme();
                    setProfileOpen(false);
                  }}
                  className={`w-full flex items-center gap-2 text-xs py-2 px-2.5 rounded-xl font-medium transition ${
                    isDark ? 'hover:bg-slate-800 text-slate-300' : 'hover:bg-slate-100 text-slate-700'
                  }`}
                >
                  <span>{isDark ? '☀️' : '🌙'}</span>
                  <span>{isDark ? 'Light Theme' : 'Dark Theme'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    logout();
                    setProfileOpen(false);
                  }}
                  className="w-full flex items-center gap-2 text-xs py-2 px-2.5 rounded-xl font-semibold text-rose-500 hover:bg-rose-500/10 transition"
                >
                  <span>🚪</span>
                  <span>Sign Out</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </aside>

      {/* ── RIGHT MAIN CONTAINER ────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* ── Mobile Top Header ─────────────────────────────────────────── */}
        <header className={`
          md:hidden flex items-center justify-between px-4 py-3 border-b z-20 flex-shrink-0
          ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}
        `}>
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className={`p-2 rounded-xl transition ${
              isDark ? 'text-slate-400 hover:text-white hover:bg-slate-800' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
            aria-label="Open navigation drawer"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          <div className="flex items-center gap-2">
            <img
              src="/montcrest_software_pvt_ltd_cover.jpg"
              alt="Logo"
              className="w-6 h-6 object-contain rounded"
            />
            <span className="font-bold text-sm tracking-wide">DailyTracker v2</span>
          </div>

          <div className="flex items-center gap-1">
            <NavLink
              to="/guide"
              className={`p-2 rounded-xl text-xs font-semibold ${
                isDark ? 'text-blue-400 hover:bg-slate-800' : 'text-blue-600 hover:bg-blue-50'
              }`}
              title="Docs Hub"
            >
              📖
            </NavLink>
            <NotificationBell />
          </div>
        </header>

        {/* ── Main Content Area ─────────────────────────────────────────── */}
        <main className="flex-1 overflow-y-auto pb-16 md:pb-0">
          <Suspense fallback={<SkeletonDashboard />}>
            <Outlet />
          </Suspense>
        </main>

        {/* ── Mobile Bottom Navigation Bar ──────────────────────────────── */}
        <nav className={`
          md:hidden fixed bottom-0 left-0 right-0 z-20
          flex items-center justify-around
          px-2 pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))]
          border-t shadow-lg
          ${isDark ? 'bg-slate-900/95 border-slate-800 backdrop-blur-md' : 'bg-white/95 border-slate-200 backdrop-blur-md'}
        `}>
          {[
            { to: '/', icon: '🏠', label: 'Home', exact: true },
            { to: '/tasks', icon: '✅', label: 'Tasks' },
            { to: '/leave', icon: '🗓️', label: 'Leave' },
            { to: '/guide', icon: '📖', label: 'Docs' },
            { to: '/notifications', icon: '🔔', label: 'Alerts', badge: notifUnread },
            { to: '/profile', icon: '👤', label: 'Profile' },
          ].map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={(item as any).exact}
              className={({ isActive }) =>
                `relative flex flex-col items-center gap-0.5 px-2.5 py-1 rounded-xl transition text-[10px] font-medium
                ${isActive
                  ? 'text-blue-500 font-bold'
                  : isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-slate-900'
                }`
              }
            >
              <span className="text-lg leading-none">{item.icon}</span>
              <span>{item.label}</span>
              {'badge' in item && Number((item as any).badge) > 0 && (
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