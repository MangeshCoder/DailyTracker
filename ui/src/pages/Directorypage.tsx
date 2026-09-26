// ─────────────────────────────────────────────────────────────────────────────
//  FILE: ui/src/pages/Directorypage.tsx
//  Employee Directory Hub - Modern Design System Upgrade
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { profileApi } from '../services/api';
import type { DirectoryUser } from '../types';
import { UserAvatar, RoleBadge } from './ProfilePage';
import { PageHeader } from '../components/ui/PageHeader';
import { StatCard } from '../components/ui/StatCard';
import { Card, CardContent } from '../components/ui/Card';
import {
  Users,
  Search,
  X,
  Briefcase,
  Building,
  Mail,
  Phone,
  Calendar,
  UserCheck,
  Code,
  Shield,
  LayoutGrid,
  List,
  MessageSquare,
  ArrowUpRight,
  ChevronRight,
  Info,
} from 'lucide-react';

// ─── Constants ────────────────────────────────────────────────────────────────

const ROLES = ['Developer', 'TeamLead', 'Manager'];

const DEPTS = [
  'Engineering',
  'Design',
  'QA',
  'DevOps',
  'Product',
  'HR',
  'Finance',
  'Marketing',
];

// ─── Employee Detail Modal ────────────────────────────────────────────────────

interface EmployeeModalProps {
  userId: number;
  onClose: () => void;
}

const EmployeeModal: React.FC<EmployeeModalProps> = ({ userId, onClose }) => {
  const navigate = useNavigate();

  const { data: profile, isLoading } = useQuery({
    queryKey: ['employeeProfile', userId],
    queryFn: () => profileApi.getUser(userId).then((r) => r.data),
  });

  const joinedStr = profile?.joinDate
    ? new Date(profile.joinDate).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-sm p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {isLoading ? (
          <div className="p-8 space-y-4">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-slate-200 dark:bg-slate-800 animate-pulse" />
              <div className="flex-1 space-y-2">
                <div className="h-5 bg-slate-200 dark:bg-slate-800 rounded w-1/2 animate-pulse" />
                <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-1/3 animate-pulse" />
              </div>
            </div>
            <div className="space-y-2 pt-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-10 bg-slate-100 dark:bg-slate-800/60 rounded-xl animate-pulse" />
              ))}
            </div>
          </div>
        ) : profile ? (
          <>
            {/* Banner Header */}
            <div className="relative bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 p-6 pt-7 text-white">
              <button
                onClick={onClose}
                className="absolute top-4 right-4 p-1.5 rounded-full bg-black/20 hover:bg-black/40 text-white/80 hover:text-white transition"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="flex items-center gap-4">
                <div className="ring-4 ring-white/20 rounded-full shadow-lg shrink-0">
                  <UserAvatar
                    photoUrl={profile.profilePhotoUrl}
                    name={profile.fullName}
                    size="lg"
                  />
                </div>
                <div className="min-w-0">
                  <h2 className="text-xl font-bold truncate text-white">{profile.fullName}</h2>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <RoleBadge role={profile.role} />
                    {profile.designation && (
                      <span className="text-xs text-white/80 font-medium">
                        {profile.designation}
                      </span>
                    )}
                  </div>
                  {profile.department && (
                    <p className="text-xs text-blue-100 mt-1 flex items-center gap-1.5 font-medium">
                      <Building className="w-3 h-3 text-blue-200" />
                      <span>{profile.department}</span>
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Profile Content Body */}
            <div className="p-6 space-y-5 overflow-y-auto flex-1">
              {/* Contact Info List */}
              <div className="space-y-2.5">
                <h4 className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                  Contact Information
                </h4>

                <div className="grid grid-cols-1 gap-2 text-xs">
                  <a
                    href={`mailto:${profile.email}`}
                    className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 hover:bg-blue-50 dark:hover:bg-blue-900/20 border border-slate-100 dark:border-slate-800 transition group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="p-2 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 group-hover:bg-blue-500/20">
                        <Mail className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[11px] text-slate-400">Email Address</p>
                        <p className="font-medium text-slate-900 dark:text-white truncate">
                          {profile.email}
                        </p>
                      </div>
                    </div>
                    <ArrowUpRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-blue-600 dark:group-hover:text-blue-400" />
                  </a>

                  {profile.phone && (
                    <a
                      href={`tel:${profile.phone}`}
                      className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 border border-slate-100 dark:border-slate-800 transition group"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 group-hover:bg-emerald-500/20">
                          <Phone className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-[11px] text-slate-400">Phone</p>
                          <p className="font-medium text-slate-900 dark:text-white truncate">
                            {profile.phone}
                          </p>
                        </div>
                      </div>
                      <ArrowUpRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-emerald-600 dark:group-hover:text-emerald-400" />
                    </a>
                  )}
                </div>
              </div>

              {/* Organization & Employment */}
              <div className="space-y-2.5">
                <h4 className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                  Organization & Employment
                </h4>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  {joinedStr && (
                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                      <div className="flex items-center gap-2 text-slate-400 mb-1">
                        <Calendar className="w-3.5 h-3.5 text-indigo-500" />
                        <span>Date Joined</span>
                      </div>
                      <p className="font-medium text-slate-900 dark:text-white">{joinedStr}</p>
                    </div>
                  )}

                  {profile.managerName && (
                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                      <div className="flex items-center gap-2 text-slate-400 mb-1">
                        <UserCheck className="w-3.5 h-3.5 text-purple-500" />
                        <span>Reports To</span>
                      </div>
                      <p className="font-medium text-slate-900 dark:text-white truncate">
                        {profile.managerName}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Bio / About */}
              {profile.bio && (
                <div className="space-y-1.5">
                  <h4 className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                    About
                  </h4>
                  <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
                    {profile.bio}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer Actions */}
            <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850/50 flex items-center gap-3">
              <a
                href={`mailto:${profile.email}`}
                className="flex-1 py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition text-center shadow-md shadow-blue-600/20 flex items-center justify-center gap-2"
              >
                <Mail className="w-4 h-4" />
                <span>Send Email</span>
              </a>

              <button
                onClick={() => {
                  onClose();
                  navigate('/chat');
                }}
                className="flex-1 py-2.5 px-4 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold transition flex items-center justify-center gap-2"
              >
                <MessageSquare className="w-4 h-4" />
                <span>Direct Message</span>
              </button>
            </div>
          </>
        ) : (
          <div className="p-8 text-center text-slate-500">
            <Info className="w-8 h-8 mx-auto text-slate-400 mb-2" />
            <p className="font-medium">Could not load employee profile details.</p>
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Employee Card ─────────────────────────────────────────────────────────────

interface EmployeeCardProps {
  user: DirectoryUser;
  onClick: () => void;
}

const EmployeeCard: React.FC<EmployeeCardProps> = ({ user, onClick }) => {
  return (
    <Card
      hover
      onClick={onClick}
      className="cursor-pointer group flex flex-col justify-between overflow-hidden border-slate-200 dark:border-slate-800 transition-all duration-200"
    >
      <CardContent className="p-5 space-y-4">
        {/* Top: Avatar + Name + Role */}
        <div className="flex items-center gap-3.5">
          <div className="relative shrink-0">
            <UserAvatar
              photoUrl={user.profilePhotoUrl}
              name={user.fullName}
              size="lg"
            />
          </div>

          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
              {user.fullName}
            </h3>
            <div className="mt-1 flex items-center gap-1.5 flex-wrap">
              <RoleBadge role={user.role} />
            </div>
          </div>
        </div>

        {/* Details List */}
        <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800/80 text-xs text-slate-600 dark:text-slate-400">
          {user.designation && (
            <div className="flex items-center gap-2 truncate">
              <Briefcase className="w-3.5 h-3.5 text-blue-500 shrink-0" />
              <span className="truncate">{user.designation}</span>
            </div>
          )}

          {user.department && (
            <div className="flex items-center gap-2 truncate">
              <Building className="w-3.5 h-3.5 text-purple-500 shrink-0" />
              <span className="truncate">{user.department}</span>
            </div>
          )}

          <div className="flex items-center gap-2 truncate text-slate-500">
            <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span className="truncate">{user.email}</span>
          </div>

          {user.phone && (
            <div className="flex items-center gap-2 truncate">
              <Phone className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
              <span className="truncate">{user.phone}</span>
            </div>
          )}

          {user.managerName && (
            <div className="flex items-center gap-2 truncate text-[11px] text-slate-400">
              <UserCheck className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
              <span className="truncate">Reports to {user.managerName}</span>
            </div>
          )}
        </div>
      </CardContent>

      {/* Card Action Footer */}
      <div className="px-5 py-2.5 border-t border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-850/50 flex items-center justify-between text-xs text-slate-500 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors font-medium">
        <span>View full profile</span>
        <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
      </div>
    </Card>
  );
};

// ─── Skeleton Card Loader ─────────────────────────────────────────────────────

const SkeletonCard = () => (
  <Card className="p-5 animate-pulse space-y-4 border-slate-200 dark:border-slate-800">
    <div className="flex items-center gap-3">
      <div className="w-14 h-14 rounded-full bg-slate-200 dark:bg-slate-800 shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-3/4" />
        <div className="h-3 bg-slate-200 dark:bg-slate-800 rounded w-1/2" />
      </div>
    </div>
    <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
      <div className="h-3 bg-slate-200 dark:bg-slate-800 rounded w-4/5" />
      <div className="h-3 bg-slate-200 dark:bg-slate-800 rounded w-2/3" />
      <div className="h-3 bg-slate-200 dark:bg-slate-800 rounded w-1/2" />
    </div>
  </Card>
);

// ─── Main Directory Page Component ────────────────────────────────────────────

export const DirectoryPage: React.FC = () => {
  const [search, setSearch] = useState('');
  const [filterRole, setFilterRole] = useState('');
  const [filterDept, setFilterDept] = useState('');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

  // Query directory list with debounce capability
  const { data: users = [], isLoading } = useQuery<DirectoryUser[]>({
    queryKey: ['directory', search, filterRole, filterDept],
    queryFn: () =>
      profileApi
        .getDirectory({
          search: search || undefined,
          role: filterRole || undefined,
          department: filterDept || undefined,
        })
        .then((r) => r.data),
    staleTime: 30_000,
  });

  // Calculate role statistics
  const byRole = useMemo(() => {
    return users.reduce<Record<string, number>>((acc, u) => {
      acc[u.role] = (acc[u.role] ?? 0) + 1;
      return acc;
    }, {});
  }, [users]);

  const hasFilters = Boolean(search || filterRole || filterDept);

  const handleRoleCardClick = (role: string) => {
    setFilterRole((prev) => (prev === role ? '' : role));
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* ── Page Header ──────────────────────────────────────────────────────── */}
      <PageHeader
        title="Employee Directory"
        description="Browse team members across departments, view job roles, and connect directly with colleagues."
        badge={{
          label: 'Team & People',
          variant: 'purple',
          icon: <Users className="w-3.5 h-3.5" />,
        }}
      />

      {/* ── Role Statistics Cards ────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard
          title="Total Team"
          value={users.length}
          subtitle="Registered members"
          icon={Users}
          color="blue"
          onClick={() => setFilterRole('')}
        />
        <StatCard
          title="Developers"
          value={byRole['Developer'] ?? 0}
          subtitle={filterRole === 'Developer' ? 'Filtered active' : 'Click to filter'}
          icon={Code}
          color="emerald"
          onClick={() => handleRoleCardClick('Developer')}
        />
        <StatCard
          title="Team Leads"
          value={byRole['TeamLead'] ?? 0}
          subtitle={filterRole === 'TeamLead' ? 'Filtered active' : 'Click to filter'}
          icon={Shield}
          color="indigo"
          onClick={() => handleRoleCardClick('TeamLead')}
        />
        <StatCard
          title="Managers"
          value={byRole['Manager'] ?? 0}
          subtitle={filterRole === 'Manager' ? 'Filtered active' : 'Click to filter'}
          icon={UserCheck}
          color="purple"
          onClick={() => handleRoleCardClick('Manager')}
        />
      </div>

      {/* ── Search & Filter Controls Toolbar ─────────────────────────────────── */}
      <Card className="p-4 border-slate-200 dark:border-slate-800">
        <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
          {/* Search Input */}
          <div className="relative flex-1 min-w-[220px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, email, designation, or department…"
              className="w-full pl-9 pr-9 py-2 text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Role Filter */}
          <select
            value={filterRole}
            onChange={(e) => setFilterRole(e.target.value)}
            className="bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 min-w-[130px]"
          >
            <option value="">All Roles</option>
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>

          {/* Department Filter */}
          <select
            value={filterDept}
            onChange={(e) => setFilterDept(e.target.value)}
            className="bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 min-w-[150px]"
          >
            <option value="">All Departments</option>
            {DEPTS.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>

          {/* View mode toggle */}
          <div className="flex p-0.5 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700/80 shrink-0">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-lg transition ${
                viewMode === 'grid'
                  ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-xs'
                  : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
              }`}
              title="Grid view"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded-lg transition ${
                viewMode === 'table'
                  ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-xs'
                  : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
              }`}
              title="Table view"
            >
              <List className="w-4 h-4" />
            </button>
          </div>

          {/* Reset button */}
          {hasFilters && (
            <button
              onClick={() => {
                setSearch('');
                setFilterRole('');
                setFilterDept('');
              }}
              className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold transition"
            >
              Clear
            </button>
          )}
        </div>
      </Card>

      {/* ── Employees Display View ───────────────────────────────────────────── */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : users.length === 0 ? (
        <Card className="py-20 text-center border-dashed border-slate-200 dark:border-slate-800">
          <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-purple-50 dark:bg-purple-900/20 flex items-center justify-center text-purple-500">
            <Users className="w-7 h-7" />
          </div>
          <h3 className="text-base font-semibold text-slate-900 dark:text-white">No teammates found</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
            {hasFilters
              ? 'No employees matched your current filters. Try changing or clearing your search criteria.'
              : 'No team members found in the organization directory.'}
          </p>
          {hasFilters && (
            <button
              onClick={() => {
                setSearch('');
                setFilterRole('');
                setFilterDept('');
              }}
              className="mt-4 px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold hover:bg-slate-200 dark:hover:bg-slate-700 transition"
            >
              Reset All Filters
            </button>
          )}
        </Card>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {users.map((user) => (
            <EmployeeCard
              key={user.id}
              user={user}
              onClick={() => setSelectedId(user.id)}
            />
          ))}
        </div>
      ) : (
        /* Table / List View */
        <Card className="overflow-hidden border-slate-200 dark:border-slate-800">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-850 text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider">
                  <th className="py-3 px-4">Employee</th>
                  <th className="py-3 px-4">Role</th>
                  <th className="py-3 px-4">Designation</th>
                  <th className="py-3 px-4">Department</th>
                  <th className="py-3 px-4">Email</th>
                  <th className="py-3 px-4">Phone</th>
                  <th className="py-3 px-4">Reports To</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                {users.map((user) => (
                  <tr
                    key={user.id}
                    onClick={() => setSelectedId(user.id)}
                    className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition cursor-pointer group"
                  >
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <UserAvatar
                          photoUrl={user.profilePhotoUrl}
                          name={user.fullName}
                          size="sm"
                        />
                        <span className="font-semibold text-slate-900 dark:text-white truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                          {user.fullName}
                        </span>
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      <RoleBadge role={user.role} />
                    </td>

                    <td className="py-3 px-4 font-medium text-slate-700 dark:text-slate-300">
                      {user.designation || '—'}
                    </td>

                    <td className="py-3 px-4 text-slate-600 dark:text-slate-400">
                      {user.department || '—'}
                    </td>

                    <td className="py-3 px-4 text-slate-500">
                      <a
                        href={`mailto:${user.email}`}
                        onClick={(e) => e.stopPropagation()}
                        className="hover:text-blue-600 dark:hover:text-blue-400 hover:underline"
                      >
                        {user.email}
                      </a>
                    </td>

                    <td className="py-3 px-4 font-mono text-slate-500">
                      {user.phone ? (
                        <a
                          href={`tel:${user.phone}`}
                          onClick={(e) => e.stopPropagation()}
                          className="hover:text-emerald-600 dark:hover:text-emerald-400"
                        >
                          {user.phone}
                        </a>
                      ) : (
                        '—'
                      )}
                    </td>

                    <td className="py-3 px-4 text-slate-500">
                      {user.managerName || '—'}
                    </td>

                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedId(user.id);
                        }}
                        className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold transition"
                      >
                        Profile
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* ── Employee Detail Modal ───────────────────────────────────────────── */}
      {selectedId !== null && (
        <EmployeeModal userId={selectedId} onClose={() => setSelectedId(null)} />
      )}
    </div>
  );
};