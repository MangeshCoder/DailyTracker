// ─────────────────────────────────────────────────────────────────────────────
//  FULL REPLACEMENT of src/context/Authcontext.tsx
//  Change: login() now accepts a Partial<User> to allow updating individual
//  fields (e.g. after profile save, update name/photo in AuthContext without
//  forcing a full re-login).
// ─────────────────────────────────────────────────────────────────────────────

import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import type { User } from '../types';
import { authApi } from '../services/api';
import { forgetPushOnSignOut } from '../utils/push';

interface AuthContextType {
  user:            User | null;
  isAuthenticated: boolean;
  /** false while the saved session is being restored after a page reload */
  ready:           boolean;
  login:           (user: User) => void;
  updateUser:      (patch: Partial<User>) => void;   // ← NEW: partial update
  logout:          () => void;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  // After a reload / new tab: the login cookie is still there, so ask who we are
  // (the API refreshes an expired access token by itself). No cookie → login page.
  useEffect(() => {
    let cancelled = false;
    authApi.me()
      .then(me => { if (!cancelled && me) setUser(prev => prev ?? me); })
      .catch(() => { /* not signed in */ })
      .finally(() => { if (!cancelled) setReady(true); });
    return () => { cancelled = true; };
  }, []);

  const login = useCallback((userData: User) => {
    setUser(userData);
  }, []);

  // Merge a partial update into the current user — used after profile save
  const updateUser = useCallback((patch: Partial<User>) => {
    setUser((prev) => (prev ? { ...prev, ...patch } : prev));
  }, []);

  const logout = useCallback(async () => {
    await forgetPushOnSignOut();   // this device stops getting this person's push notifications
    await authApi.logout();
    setUser(null);
    window.location.href = '/login';
  }, []);

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: !!user, ready, login, updateUser, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);