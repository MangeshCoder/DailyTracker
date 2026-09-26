// ─────────────────────────────────────────────────────────────────────────────
//  FULL REPLACEMENT of src/context/Authcontext.tsx
//  Change: login() now accepts a Partial<User> to allow updating individual
//  fields (e.g. after profile save, update name/photo in AuthContext without
//  forcing a full re-login).
// ─────────────────────────────────────────────────────────────────────────────

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import type { User } from '../types';
import { authApi } from '../services/api';

interface AuthContextType {
  user:            User | null;
  isAuthenticated: boolean;
  login:           (user: User) => void;
  updateUser:      (patch: Partial<User>) => void;   // ← NEW: partial update
  logout:          () => void;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);

  const login = useCallback((userData: User) => {
    setUser(userData);
  }, []);

  // Merge a partial update into the current user — used after profile save
  const updateUser = useCallback((patch: Partial<User>) => {
    setUser((prev) => (prev ? { ...prev, ...patch } : prev));
  }, []);

  const logout = useCallback(async () => {
    await authApi.logout();
    setUser(null);
    window.location.href = '/login';
  }, []);

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: !!user, login, updateUser, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);