import { useEffect, useState } from "react";
import { authApi } from "../services/api";

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

type RoleOption = "Developer" | "TeamLead" | "Manager";

const ROLE_CONFIG: Record<RoleOption, { label: string; color: string; icon: string }> = {
  Developer: {
    label: "Developer",
    color: "bg-blue-600/20 border-blue-500/40 text-blue-400",
    icon: "💻",
  },
  TeamLead: {
    label: "Team Lead",
    color: "bg-violet-600/20 border-violet-500/40 text-violet-400",
    icon: "🧭",
  },
  Manager: {
    label: "Manager",
    color: "bg-emerald-600/20 border-emerald-500/40 text-emerald-400",
    icon: "🏢",
  },
};

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
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && !loading && onCancel()}
    >
      <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-sm p-6 animate-in fade-in zoom-in-95 duration-200">
        {/* Icon */}
        <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-slate-800 border border-slate-700 text-2xl mx-auto mb-4">
          {cfg.icon}
        </div>

        {/* Title */}
        <h3 className="text-white font-semibold text-lg text-center mb-1">
          Assign Role
        </h3>
        <p className="text-slate-400 text-sm text-center mb-5">
          You are about to assign{" "}
          <span className={`font-semibold px-1.5 py-0.5 rounded-lg border text-xs ${cfg.color}`}>
            {cfg.label}
          </span>{" "}
          to{" "}
          <span className="text-white font-medium">{user.fullName}</span>
        </p>

        {/* User card */}
        <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl px-4 py-3 mb-6 flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-blue-600/30 border border-blue-500/30 flex items-center justify-center text-sm font-bold text-white flex-shrink-0">
            {user.fullName.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="text-white text-sm font-medium truncate">{user.fullName}</p>
            <p className="text-slate-500 text-xs truncate">{user.email}</p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            disabled={loading}
            className="flex-1 py-2.5 rounded-xl border border-slate-600 text-slate-300 text-sm font-medium hover:bg-slate-800 transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold transition disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Assigning...
              </>
            ) : (
              "Confirm"
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
//  Toast Notification
// ─────────────────────────────────────────────────────────────────────────────
const Toast = ({
  message,
  type,
  onClose,
}: {
  message: string;
  type: "success" | "error";
  onClose: () => void;
}) => {
  useEffect(() => {
    const t = setTimeout(onClose, 3500);
    return () => clearTimeout(t);
  }, [onClose]);

  return (
    <div className="fixed top-5 right-5 z-50 flex items-center gap-3 px-4 py-3 rounded-xl border shadow-xl text-sm font-medium bg-slate-900 animate-in slide-in-from-top-2 duration-200"
      style={{
        borderColor: type === "success" ? "rgb(34 197 94 / 0.4)" : "rgb(239 68 68 / 0.4)",
        color: type === "success" ? "rgb(134 239 172)" : "rgb(252 165 165)",
      }}
    >
      <span className="text-base">{type === "success" ? "✅" : "❌"}</span>
      {message}
      <button onClick={onClose} className="ml-2 opacity-60 hover:opacity-100 text-xs">✕</button>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
//  Skeleton loader row
// ─────────────────────────────────────────────────────────────────────────────
const SkeletonRow = () => (
  <div className="flex items-center gap-4 px-5 py-4 border-b border-slate-800/60 animate-pulse">
    <div className="w-10 h-10 rounded-full bg-slate-700 flex-shrink-0" />
    <div className="flex-1 space-y-2">
      <div className="h-3.5 bg-slate-700 rounded-lg w-36" />
      <div className="h-3 bg-slate-800 rounded-lg w-52" />
    </div>
    <div className="flex gap-2">
      <div className="h-8 w-28 bg-slate-700 rounded-xl" />
      <div className="h-8 w-28 bg-slate-700 rounded-xl" />
    </div>
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
//  Main Component
// ─────────────────────────────────────────────────────────────────────────────
export const AssignRole = () => {
  const [users, setUsers] = useState<PendingUser[]>([]);
  const [fetchLoading, setFetchLoading] = useState(true);
  const [fetchError, setFetchError] = useState("");

  // Modal state
  const [modal, setModal] = useState<{
    user: PendingUser;
    role: RoleOption;
  } | null>(null);
  const [assignLoading, setAssignLoading] = useState(false);

  // Toast state
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);

  // ── Fetch pending users ────────────────────────────────────────────────────
  const loadUsers = async () => {
    setFetchLoading(true);
    setFetchError("");
    try {
      const res = await authApi.getPendingUsers();
      setUsers(res.data);
    } catch {
      setFetchError("Failed to load users. Please try again.");
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
      // Remove from list immediately
      setUsers((prev) => prev.filter((u) => u.id !== modal.user.id));
      setToast({
        message: `${modal.role} role assigned to ${modal.user.fullName}`,
        type: "success",
      });
      setModal(null);
    } catch (err: any) {
      setToast({
        message: err?.response?.data?.message || "Failed to assign role. Try again.",
        type: "error",
      });
    } finally {
      setAssignLoading(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <>
      {/* Toast */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      {/* Confirm Modal */}
      {modal && (
        <ConfirmModal
          user={modal.user}
          role={modal.role}
          loading={assignLoading}
          onConfirm={handleConfirm}
          onCancel={() => !assignLoading && setModal(null)}
        />
      )}

      {/* Page */}
      <div className="p-6 max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-white">Assign Roles</h1>
            <p className="text-slate-500 text-sm mt-0.5">
              {fetchLoading
                ? "Loading users..."
                : `${users.length} pending user${users.length !== 1 ? "s" : ""} awaiting role assignment`}
            </p>
          </div>
          <button
            onClick={loadUsers}
            disabled={fetchLoading}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 text-sm hover:bg-slate-700 hover:text-white transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <svg
              className={`w-4 h-4 ${fetchLoading ? "animate-spin" : ""}`}
              fill="none" viewBox="0 0 24 24" stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </button>
        </div>

        {/* Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">

          {/* Error state */}
          {fetchError && !fetchLoading && (
            <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
              <div className="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-2xl mb-4">⚠️</div>
              <p className="text-red-400 font-medium mb-1">Something went wrong</p>
              <p className="text-slate-500 text-sm mb-4">{fetchError}</p>
              <button
                onClick={loadUsers}
                className="px-4 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 text-sm hover:text-white hover:bg-slate-700 transition"
              >
                Try Again
              </button>
            </div>
          )}

          {/* Loading skeletons */}
          {fetchLoading && (
            <>
              {[...Array(4)].map((_, i) => <SkeletonRow key={i} />)}
            </>
          )}

          {/* Empty state */}
          {!fetchLoading && !fetchError && users.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
              <div className="w-14 h-14 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center text-2xl mb-4">✅</div>
              <p className="text-white font-medium mb-1">All caught up!</p>
              <p className="text-slate-500 text-sm">No users are waiting for role assignment.</p>
            </div>
          )}

          {/* User list */}
          {!fetchLoading && !fetchError && users.length > 0 && (
            <div>
              {/* Table header */}
              <div className="grid grid-cols-[1fr_auto] items-center px-5 py-3 border-b border-slate-800 bg-slate-950/50">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">User</p>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Assign Role</p>
              </div>

              {users.map((user, idx) => (
                <div
                  key={user.id}
                  className={`flex items-center gap-4 px-5 py-4 hover:bg-slate-800/30 transition ${
                    idx < users.length - 1 ? "border-b border-slate-800/60" : ""
                  }`}
                >
                  {/* Avatar + info */}
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="w-10 h-10 rounded-full bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-sm font-bold text-blue-300 flex-shrink-0">
                      {user.fullName.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-white text-sm font-medium truncate">{user.fullName}</p>
                      <p className="text-slate-500 text-xs truncate">{user.email}</p>
                    </div>
                  </div>

                  {/* Role buttons */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {(["Developer", "TeamLead", "Manager"] as RoleOption[]).map((role) => {
                      const cfg = ROLE_CONFIG[role];
                      return (
                        <button
                          key={role}
                          onClick={() => setModal({ user, role })}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-medium transition hover:opacity-80 active:scale-95 ${cfg.color}`}
                        >
                          <span>{cfg.icon}</span>
                          {cfg.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Role legend */}
        {!fetchLoading && users.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-3">
            {(Object.entries(ROLE_CONFIG) as [RoleOption, typeof ROLE_CONFIG[RoleOption]][]).map(([role, cfg]) => (
              <div
                key={role}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs ${cfg.color}`}
              >
                <span>{cfg.icon}</span>
                <span className="font-medium">{cfg.label}</span>
              </div>
            ))}
            <span className="text-slate-600 text-xs self-center ml-1">— Available roles to assign</span>
          </div>
        )}
      </div>
    </>
  );
};