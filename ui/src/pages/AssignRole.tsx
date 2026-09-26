// ─────────────────────────────────────────────────────────────────────────────
//  FILE: ui/src/pages/AssignRole.tsx
//  Assign Roles (Manager) - Modern Design System Upgrade
//
//  Route: /manager/assign-role
//  Logic unchanged from previous version:
//  ✅ Loads users awaiting a role (authApi.getPendingUsers)
//  ✅ Pick Developer / Team Lead / Manager → confirm modal → authApi.assignRole
//  ✅ Assigned user is removed from the list immediately
//  UI: the page's own dark-only toast replaced with the app's useToast.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useState } from 'react';
import { authApi } from '../services/api';
import { useToast } from '../context/ToastContext';
import { PageHeader } from '../components/ui/PageHeader';
import { Card } from '../components/ui/Card';
import {
  Code2,
  Compass,
  Building2,
  RefreshCw,
  X,
  Loader2,
  UserPlus,
  AlertTriangle,
  PartyPopper,
  Mail,
  CalendarDays,
  ShieldCheck,
  ArrowRight,
  Check,
} from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
//  Types
// ─────────────────────────────────────────────────────────────────────────────
interface PendingUser {
  id: number;
  fullName: string;
  email: string;
  role?: string;
  createdAt?: string;
}

type RoleOption = 'Developer' | 'TeamLead' | 'Manager';

const ROLE_CONFIG: Record<RoleOption, {
  label: string; icon: React.ElementType; chip: string; solid: string; desc: string;
}> = {
  Developer: {
    label: 'Developer',
    icon:  Code2,
    chip:  'bg-blue-500/10 border-blue-500/30 text-blue-600 dark:text-blue-400 hover:bg-blue-500/20',
    solid: 'from-blue-600 to-indigo-600',
    desc:  'Daily work: tasks, attendance, support logs and EOD reports.',
  },
  TeamLead: {
    label: 'Team Lead',
    icon:  Compass,
    chip:  'bg-violet-500/10 border-violet-500/30 text-violet-600 dark:text-violet-400 hover:bg-violet-500/20',
    solid: 'from-violet-600 to-fuchsia-600',
    desc:  'Everything a developer has, plus the manager pages for the team.',
  },
  Manager: {
    label: 'Manager',
    icon:  Building2,
    chip:  'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20',
    solid: 'from-emerald-600 to-teal-600',
    desc:  'Full management access, including approvals and user management.',
  },
};

const ROLES: RoleOption[] = ['Developer', 'TeamLead', 'Manager'];

// ─────────────────────────────────────────────────────────────────────────────
//  Confirm Modal
// ─────────────────────────────────────────────────────────────────────────────
const ConfirmModal = ({
  user,
  role,
  loading,
  onConfirm,
  onCancel,
}: {
  user: PendingUser;
  role: RoleOption;
  loading: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) => {
  const cfg = ROLE_CONFIG[role];
  const Icon = cfg.icon;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={(e) => e.target === e.currentTarget && !loading && onCancel()}
    >
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Gradient header */}
        <div className={`relative bg-gradient-to-r ${cfg.solid} p-6 text-white text-center`}>
          <button
            onClick={onCancel}
            disabled={loading}
            className="absolute top-4 right-4 p-1.5 rounded-full bg-black/20 hover:bg-black/40 text-white/80 hover:text-white transition disabled:opacity-40"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
          <div className="w-14 h-14 mx-auto rounded-2xl bg-white/15 border border-white/20 flex items-center justify-center">
            <Icon className="w-7 h-7" />
          </div>
          <h3 className="text-lg font-bold mt-3">Assign {cfg.label}</h3>
          <p className="text-xs text-white/80 mt-1">{cfg.desc}</p>
        </div>

        <div className="p-5 space-y-4">
          <div className="flex items-center gap-3 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center text-sm font-bold text-white flex-shrink-0">
              {user.fullName.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{user.fullName}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{user.email}</p>
            </div>
            <ArrowRight className="w-4 h-4 text-slate-400 shrink-0" />
            <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${cfg.chip}`}>
              {cfg.label}
            </span>
          </div>

          <p className="text-xs text-slate-500 dark:text-slate-400 text-center">
            The user can sign in with this role right after you confirm.
          </p>

          <div className="flex gap-3">
            <button
              onClick={onCancel}
              disabled={loading}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              disabled={loading}
              className="flex-1 inline-flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-500/20 transition disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              {loading ? 'Assigning…' : 'Confirm'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
//  Skeleton loader row
// ─────────────────────────────────────────────────────────────────────────────
const SkeletonRow = () => (
  <div className="flex flex-col md:flex-row md:items-center gap-4 px-5 py-4 animate-pulse">
    <div className="flex items-center gap-3 flex-1">
      <div className="w-11 h-11 rounded-full bg-slate-200 dark:bg-slate-800 flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="h-3.5 bg-slate-200 dark:bg-slate-800 rounded-lg w-36" />
        <div className="h-3 bg-slate-100 dark:bg-slate-800/60 rounded-lg w-52" />
      </div>
    </div>
    <div className="flex gap-2">
      {[1, 2, 3].map(i => <div key={i} className="h-9 w-28 bg-slate-200 dark:bg-slate-800 rounded-xl" />)}
    </div>
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
//  Main Component
// ─────────────────────────────────────────────────────────────────────────────
export const AssignRole = () => {
  const { toast } = useToast();
  const [users, setUsers] = useState<PendingUser[]>([]);
  const [fetchLoading, setFetchLoading] = useState(true);
  const [fetchError, setFetchError] = useState('');

  const [modal, setModal] = useState<{ user: PendingUser; role: RoleOption } | null>(null);
  const [assignLoading, setAssignLoading] = useState(false);

  // ── Fetch pending users ────────────────────────────────────────────────────
  const loadUsers = async () => {
    setFetchLoading(true);
    setFetchError('');
    try {
      const res = await authApi.getPendingUsers();
      setUsers(res.data);
    } catch {
      setFetchError('Failed to load users. Please try again.');
    } finally {
      setFetchLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  // ── Assign role (called from modal confirm) ────────────────────────────────
  const handleConfirm = async () => {
    if (!modal) return;
    setAssignLoading(true);
    try {
      await authApi.assignRole({ userId: modal.user.id, role: modal.role });
      setUsers((prev) => prev.filter((u) => u.id !== modal.user.id));
      toast.success(`${ROLE_CONFIG[modal.role].label} role assigned to ${modal.user.fullName}`);
      setModal(null);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to assign role. Try again.');
    } finally {
      setAssignLoading(false);
    }
  };

  const pending = users.length;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <>
      {modal && (
        <ConfirmModal
          user={modal.user}
          role={modal.role}
          loading={assignLoading}
          onConfirm={handleConfirm}
          onCancel={() => !assignLoading && setModal(null)}
        />
      )}

      <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto space-y-6">
        {/* ── Page Header ── */}
        <PageHeader
          title="Assign Roles"
          description="New sign-ups wait here until a manager gives them a role."
          breadcrumbs={[
            { label: 'Workspace', href: '/' },
            { label: 'Management' },
            { label: 'Assign Roles' },
          ]}
          badge={fetchLoading
            ? { label: 'Loading…', variant: 'slate' }
            : pending > 0
              ? { label: `${pending} pending`, variant: 'amber', icon: <UserPlus className="w-3 h-3" /> }
              : { label: 'All caught up', variant: 'emerald', icon: <Check className="w-3 h-3" /> }}
          actions={
            <button
              onClick={loadUsers}
              disabled={fetchLoading}
              className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <RefreshCw className={`w-4 h-4 ${fetchLoading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          }
          className="!mb-0"
        />

        {/* ── Role guide ── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {ROLES.map(role => {
            const cfg = ROLE_CONFIG[role];
            const Icon = cfg.icon;
            return (
              <Card key={role} className="p-4 flex items-start gap-3">
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${cfg.solid} flex items-center justify-center text-white shrink-0 shadow-md`}>
                  <Icon className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-slate-900 dark:text-white">{cfg.label}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{cfg.desc}</p>
                </div>
              </Card>
            );
          })}
        </div>

        {/* ── Pending users ── */}
        <Card className="overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Awaiting Role Assignment</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {fetchLoading ? 'Loading users…' : `${pending} user${pending !== 1 ? 's' : ''} waiting`}
              </p>
            </div>
          </div>

          {/* Error */}
          {fetchError && !fetchLoading && (
            <div className="flex flex-col items-center justify-center py-14 px-6 text-center">
              <div className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center">
                <AlertTriangle className="w-7 h-7 text-rose-500" />
              </div>
              <p className="text-base font-bold text-slate-900 dark:text-white mt-3">Something went wrong</p>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 mb-4">{fetchError}</p>
              <button
                onClick={loadUsers}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition"
              >
                <RefreshCw className="w-4 h-4" /> Try Again
              </button>
            </div>
          )}

          {/* Loading */}
          {fetchLoading && (
            <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
              {[...Array(4)].map((_, i) => <SkeletonRow key={i} />)}
            </div>
          )}

          {/* Empty */}
          {!fetchLoading && !fetchError && pending === 0 && (
            <div className="flex flex-col items-center justify-center py-14 px-6 text-center">
              <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                <PartyPopper className="w-7 h-7 text-emerald-500" />
              </div>
              <p className="text-base font-bold text-slate-900 dark:text-white mt-3">All caught up!</p>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">No users are waiting for role assignment.</p>
            </div>
          )}

          {/* List */}
          {!fetchLoading && !fetchError && pending > 0 && (
            <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
              {users.map((user) => (
                <div
                  key={user.id}
                  className="flex flex-col md:flex-row md:items-center gap-4 px-5 py-4 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="w-11 h-11 rounded-full bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center text-sm font-bold text-white flex-shrink-0">
                      {user.fullName.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{user.fullName}</p>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                        <span className="inline-flex items-center gap-1 truncate"><Mail className="w-3 h-3 shrink-0" /> {user.email}</span>
                        {user.createdAt && (
                          <span className="inline-flex items-center gap-1">
                            <CalendarDays className="w-3 h-3" />
                            Joined {new Date(user.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 md:flex items-center gap-2 flex-shrink-0">
                    {ROLES.map((role) => {
                      const cfg = ROLE_CONFIG[role];
                      const Icon = cfg.icon;
                      return (
                        <button
                          key={role}
                          onClick={() => setModal({ user, role })}
                          className={`inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-semibold transition active:scale-95 ${cfg.chip}`}
                        >
                          <Icon className="w-3.5 h-3.5" />
                          {cfg.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </>
  );
};