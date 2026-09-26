// ─────────────────────────────────────────────────────────────────────────────
//  FILE: ui/src/pages/FaceSetupTeamPage.tsx
//  Manager Face Setup — pick a team member (route: /manager/face-setup)
//
//  ✅ Lists active users with their face-registration status
//  ✅ Search + All / Pending / Registered filter
//  ✅ "Register" / "Re-register" → /manager/face-setup/:userId
//     (your own row goes to /face-setup)
// ─────────────────────────────────────────────────────────────────────────────

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { managerApi } from '../services/api';
import type { User } from '../types';
import { useAuth } from '../context/Authcontext';
import { PageHeader } from '../components/ui/PageHeader';
import { StatCard } from '../components/ui/StatCard';
import { Card, CardContent } from '../components/ui/Card';
import { Skeleton } from '../components/Skeleton';
import {
  ScanFace,
  Search,
  Users,
  CheckCircle2,
  Clock,
  ArrowRight,
  RotateCcw,
  AlertTriangle,
} from 'lucide-react';

type TeamUser = User & { faceRegistered?: boolean };
type Filter = 'all' | 'pending' | 'registered';

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all',        label: 'All' },
  { key: 'pending',    label: 'Not registered' },
  { key: 'registered', label: 'Registered' },
];

const initials = (name: string) =>
  name.split(' ').filter(Boolean).slice(0, 2).map(p => p[0]?.toUpperCase()).join('') || '?';

export const FaceSetupTeamPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('all');

  const { data, isLoading, isError, refetch } = useQuery<TeamUser[]>({
    queryKey: ['managerUsers'],
    queryFn: () => managerApi.getAllUsers().then(r => r.data),
  });

  const members = useMemo(
    () => (data ?? []).filter(u => u.isActive).sort((a, b) => a.fullName.localeCompare(b.fullName)),
    [data],
  );

  const registeredCount = members.filter(m => m.faceRegistered).length;

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return members.filter(m => {
      if (filter === 'registered' && !m.faceRegistered) return false;
      if (filter === 'pending' && m.faceRegistered) return false;
      return !q || m.fullName.toLowerCase().includes(q) || m.email.toLowerCase().includes(q);
    });
  }, [members, search, filter]);

  const openSetup = (m: TeamUser) =>
    navigate(m.id === user?.id ? '/face-setup' : `/manager/face-setup/${m.id}`);

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      <PageHeader
        title="Team Face Setup"
        description="Register or update face profiles used for verified check-in."
        breadcrumbs={[
          { label: 'Workspace', href: '/' },
          { label: 'Manager', href: '/manager' },
          { label: 'Face Setup' },
        ]}
        badge={{ label: 'Manager', variant: 'purple', icon: <ScanFace className="w-3 h-3" /> }}
        className="!mb-0"
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard title="Active members" value={members.length} icon={Users} color="blue" loading={isLoading} />
        <StatCard title="Registered" value={registeredCount} icon={CheckCircle2} color="emerald" loading={isLoading} />
        <StatCard title="Not registered" value={members.length - registeredCount} icon={Clock} color="amber" loading={isLoading} />
      </div>

      <Card>
        <CardContent className="p-0">
          {/* Toolbar */}
          <div className="flex flex-col sm:flex-row gap-3 sm:items-center justify-between p-4 border-b border-slate-100 dark:border-slate-800">
            <div className="relative w-full sm:max-w-xs">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search name or email…"
                className="w-full pl-9 pr-3 py-2.5 rounded-xl text-sm bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800/70 self-start sm:self-auto">
              {FILTERS.map(f => (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => setFilter(f.key)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                    filter === f.key
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* List */}
          {isLoading ? (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 p-4">
                  <Skeleton className="w-10 h-10 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-3.5 w-40" />
                    <Skeleton className="h-3 w-56" />
                  </div>
                  <Skeleton className="h-8 w-24 rounded-xl" />
                </div>
              ))}
            </div>
          ) : isError ? (
            <div className="text-center py-12 space-y-3">
              <AlertTriangle className="w-8 h-8 mx-auto text-rose-400" />
              <p className="text-sm text-slate-500 dark:text-slate-400">Couldn't load team members.</p>
              <button
                type="button"
                onClick={() => refetch()}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white transition"
              >
                <RotateCcw className="w-3.5 h-3.5" /> Try again
              </button>
            </div>
          ) : visible.length === 0 ? (
            <div className="text-center py-12 text-sm text-slate-500 dark:text-slate-400">
              <Users className="w-8 h-8 mx-auto mb-2 text-slate-300 dark:text-slate-600" />
              No members match this filter.
            </div>
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {visible.map(m => (
                <li key={m.id} className="flex items-center gap-3 p-4 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
                  <div className="w-10 h-10 shrink-0 rounded-full bg-gradient-to-br from-blue-600 via-indigo-600 to-violet-600 text-white text-sm font-bold flex items-center justify-center">
                    {initials(m.fullName)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                      {m.fullName}
                      {m.id === user?.id && <span className="ml-1.5 text-xs font-medium text-slate-400">(you)</span>}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                      {m.email} · {m.role}
                    </p>
                  </div>
                  <span
                    className={`hidden sm:inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${
                      m.faceRegistered
                        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                        : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
                    }`}
                  >
                    {m.faceRegistered ? <CheckCircle2 className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                    {m.faceRegistered ? 'Registered' : 'Not registered'}
                  </span>
                  <button
                    type="button"
                    onClick={() => openSetup(m)}
                    className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition ${
                      m.faceRegistered
                        ? 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                        : 'bg-blue-600 hover:bg-blue-500 text-white shadow-sm shadow-blue-500/20'
                    }`}
                  >
                    {m.faceRegistered ? 'Re-register' : 'Register'}
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default FaceSetupTeamPage;
