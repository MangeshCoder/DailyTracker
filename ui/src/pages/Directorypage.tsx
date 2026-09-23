import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { profileApi } from '../services/api';
import { DirectoryUser } from '../types';
import { UserAvatar, RoleBadge } from './ProfilePage';

// ─── Employee Card ─────────────────────────────────────────────────────────────
const EmployeeCard = ({ user, onClick }: { user: DirectoryUser; onClick: () => void }) => (
  <div
    onClick={onClick}
    className="bg-slate-900 border border-slate-800 rounded-2xl p-5 cursor-pointer
      hover:border-slate-600 hover:bg-slate-800/60 transition-all group"
  >
    {/* Avatar + name row */}
    <div className="flex items-center gap-3 mb-4">
      <UserAvatar
        photoUrl={user.profilePhotoUrl}
        name={user.fullName}
        size="lg"
      />
      <div className="flex-1 min-w-0">
        <p className="text-white font-semibold text-sm truncate group-hover:text-blue-400
          transition-colors">
          {user.fullName}
        </p>
        <div className="mt-1">
          <RoleBadge role={user.role} />
        </div>
      </div>
    </div>

    {/* Detail rows */}
    <div className="space-y-1.5 text-xs">
      {user.designation && (
        <div className="flex items-center gap-2 text-slate-400">
          <span>💼</span>
          <span className="truncate">{user.designation}</span>
        </div>
      )}
      {user.department && (
        <div className="flex items-center gap-2 text-slate-400">
          <span>🏢</span>
          <span className="truncate">{user.department}</span>
        </div>
      )}
      <div className="flex items-center gap-2 text-slate-500">
        <span>📧</span>
        <span className="truncate">{user.email}</span>
      </div>
      {user.phone && (
        <div className="flex items-center gap-2 text-slate-400">
          <span>📞</span>
          <span>{user.phone}</span>
        </div>
      )}
      {user.managerName && (
        <div className="flex items-center gap-2 text-slate-500">
          <span>👤</span>
          <span className="truncate">Reports to {user.managerName}</span>
        </div>
      )}
    </div>
  </div>
);

// ─── Employee Detail Modal ────────────────────────────────────────────────────
const EmployeeModal = ({
  userId,
  onClose,
}: {
  userId: number;
  onClose: () => void;
}) => {
  const { data: profile, isLoading } = useQuery({
    queryKey: ['employeeProfile', userId],
    queryFn:  () => profileApi.getUser(userId).then((r) => r.data),
  });

  const joinedStr = profile?.joinDate
    ? new Date(profile.joinDate).toLocaleDateString('en-IN', {
        day: 'numeric', month: 'long', year: 'numeric',
      })
    : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {isLoading ? (
          <div className="p-8 space-y-3">
            {[1, 2, 3].map((i) => <div key={i} className="h-10 bg-slate-800 rounded-xl animate-pulse" />)}
          </div>
        ) : profile ? (
          <>
            {/* Banner */}
            <div className="bg-gradient-to-r from-blue-600/20 to-violet-600/20 p-6 relative">
              <button
                onClick={onClose}
                className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors text-xl leading-none"
              >
                ✕
              </button>
              <div className="flex items-center gap-4">
                <UserAvatar photoUrl={profile.profilePhotoUrl} name={profile.fullName} size="lg" />
                <div>
                  <h2 className="text-white font-bold text-lg">{profile.fullName}</h2>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <RoleBadge role={profile.role} />
                    {profile.designation && (
                      <span className="text-slate-400 text-xs">{profile.designation}</span>
                    )}
                  </div>
                  {profile.department && (
                    <p className="text-slate-500 text-xs mt-1">🏢 {profile.department}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Details */}
            <div className="p-5 space-y-3">
              <div className="grid grid-cols-1 gap-2 text-sm">
                <div className="flex items-center gap-3">
                  <span className="text-slate-500 w-5">📧</span>
                  <span className="text-slate-300">{profile.email}</span>
                </div>
                {profile.phone && (
                  <div className="flex items-center gap-3">
                    <span className="text-slate-500 w-5">📞</span>
                    <span className="text-slate-300">{profile.phone}</span>
                  </div>
                )}
                {joinedStr && (
                  <div className="flex items-center gap-3">
                    <span className="text-slate-500 w-5">📅</span>
                    <span className="text-slate-300">Joined {joinedStr}</span>
                  </div>
                )}
                {profile.managerName && (
                  <div className="flex items-center gap-3">
                    <span className="text-slate-500 w-5">👤</span>
                    <span className="text-slate-300">Reports to {profile.managerName}</span>
                  </div>
                )}
              </div>

              {profile.bio && (
                <div className="pt-2 border-t border-slate-800">
                  <p className="text-xs text-slate-500 mb-1.5">About</p>
                  <p className="text-slate-300 text-sm leading-relaxed whitespace-pre-wrap">
                    {profile.bio}
                  </p>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="p-8 text-center text-slate-400">Could not load profile.</div>
        )}
      </div>
    </div>
  );
};

// ─── Skeleton cards ────────────────────────────────────────────────────────────
const SkeletonCard = () => (
  <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 animate-pulse">
    <div className="flex items-center gap-3 mb-4">
      <div className="w-16 h-16 rounded-full bg-slate-800 shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="h-4 bg-slate-800 rounded w-3/4" />
        <div className="h-3 bg-slate-800 rounded w-1/2" />
      </div>
    </div>
    <div className="space-y-2">
      {[1, 2, 3].map((i) => <div key={i} className="h-3 bg-slate-800 rounded" />)}
    </div>
  </div>
);

// ─── Main DirectoryPage ────────────────────────────────────────────────────────
const ROLES    = ['Developer', 'TeamLead', 'Manager'];
const DEPTS    = ['Engineering', 'Design', 'QA', 'DevOps', 'Product', 'HR', 'Finance', 'Marketing'];

export const DirectoryPage = () => {
  const [search, setSearch]         = useState('');
  const [filterRole, setFilterRole] = useState('');
  const [filterDept, setFilterDept] = useState('');
  const [selectedId, setSelectedId] = useState<number | null>(null);

  // Debounce search — re-fetch when user stops typing (or immediately for role/dept)
  const { data: users = [], isLoading } = useQuery<DirectoryUser[]>({
    queryKey: ['directory', search, filterRole, filterDept],
    queryFn:  () =>
      profileApi
        .getDirectory({
          search:     search     || undefined,
          role:       filterRole || undefined,
          department: filterDept || undefined,
        })
        .then((r) => r.data),
    staleTime: 30_000,
  });

  // Count by role for stats
  const byRole = users.reduce<Record<string, number>>((acc, u) => {
    acc[u.role] = (acc[u.role] ?? 0) + 1;
    return acc;
  }, {});

  const hasFilters = search || filterRole || filterDept;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Employee Directory 👥</h1>
        <p className="text-slate-400 text-sm mt-1">Find and connect with your teammates</p>
      </div>

      {/* Stats row */}
      {!isLoading && users.length > 0 && (
        <div className="flex flex-wrap gap-3 mb-5">
          <div className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 flex items-center gap-3">
            <span className="text-2xl font-bold text-white">{users.length}</span>
            <span className="text-slate-400 text-xs">Total</span>
          </div>
          {Object.entries(byRole).map(([role, count]) => (
            <div
              key={role}
              className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-3
                flex items-center gap-3 cursor-pointer hover:border-slate-600 transition-colors"
              onClick={() => setFilterRole(filterRole === role ? '' : role)}
            >
              <span className="text-xl font-bold text-white">{count}</span>
              <span className="text-slate-400 text-xs">{role}s</span>
            </div>
          ))}
        </div>
      )}

      {/* Search + filter bar */}
      <div className="flex flex-wrap gap-3 mb-6">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 text-sm">🔍</span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, email, designation…"
            className="w-full bg-slate-900 border border-slate-800 text-white rounded-xl
              pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500
              placeholder-slate-500"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500
                hover:text-white transition-colors text-sm"
            >
              ✕
            </button>
          )}
        </div>

        {/* Role filter */}
        <select
          value={filterRole}
          onChange={(e) => setFilterRole(e.target.value)}
          className="bg-slate-900 border border-slate-800 text-white rounded-xl px-3 py-2.5
            text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[130px]"
        >
          <option value="">All Roles</option>
          {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>

        {/* Department filter */}
        <select
          value={filterDept}
          onChange={(e) => setFilterDept(e.target.value)}
          className="bg-slate-900 border border-slate-800 text-white rounded-xl px-3 py-2.5
            text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[150px]"
        >
          <option value="">All Departments</option>
          {DEPTS.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>

        {/* Clear filters */}
        {hasFilters && (
          <button
            onClick={() => { setSearch(''); setFilterRole(''); setFilterDept(''); }}
            className="px-4 py-2.5 rounded-xl border border-slate-700 text-slate-400
              hover:text-white hover:border-slate-600 transition-colors text-sm"
          >
            Clear
          </button>
        )}
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : users.length === 0 ? (
        <div className="py-24 text-center">
          <p className="text-5xl mb-4">🔍</p>
          <p className="text-slate-300 font-medium">No employees found</p>
          <p className="text-slate-500 text-sm mt-2">
            {hasFilters ? 'Try adjusting your search or filters.' : 'No active employees yet.'}
          </p>
          {hasFilters && (
            <button
              onClick={() => { setSearch(''); setFilterRole(''); setFilterDept(''); }}
              className="mt-4 text-blue-400 hover:text-blue-300 text-sm transition-colors"
            >
              Clear all filters
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {users.map((user) => (
            <EmployeeCard
              key={user.id}
              user={user}
              onClick={() => setSelectedId(user.id)}
            />
          ))}
        </div>
      )}

      {/* Employee detail modal */}
      {selectedId !== null && (
        <EmployeeModal userId={selectedId} onClose={() => setSelectedId(null)} />
      )}
    </div>
  );
};