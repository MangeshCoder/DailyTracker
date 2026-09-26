// ─────────────────────────────────────────────────────────────────────────────
//  FILE: ui/src/components/auth/authTheme.tsx
//  Shared light/dark styles for the sign-in screens
//  (Authpages.tsx → Login + Register, ForgotPasswordPage.tsx)
//
//  Keeps the existing dark-branded design and adds a matching light theme.
//  The toggle uses the app-wide ThemeContext, so the choice carries over
//  into the app after sign-in.
// ─────────────────────────────────────────────────────────────────────────────

import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';

export const AUTH = {
  page:
    'min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100 relative overflow-hidden ' +
    'selection:bg-blue-600 selection:text-white transition-colors',
  card:
    'bg-white/90 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 sm:p-8 ' +
    'shadow-xl shadow-slate-200/60 dark:shadow-2xl dark:shadow-black/40 backdrop-blur-xl',
  heading:  'text-slate-900 dark:text-white',
  muted:    'text-slate-500 dark:text-slate-400',
  subtle:   'text-slate-400 dark:text-slate-500',
  label:    'block text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1.5',
  input:
    'w-full py-2.5 bg-white dark:bg-slate-950/70 border border-slate-300 dark:border-slate-700/80 rounded-xl ' +
    'text-slate-900 dark:text-white text-sm placeholder:text-slate-400 dark:placeholder:text-slate-500 ' +
    'focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all',
  inputIcon: 'absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 dark:text-slate-500',
  otpBox:   'p-4 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 text-center',
  otpInput:
    'w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white ' +
    'font-mono text-center text-3xl tracking-[0.4em] py-3 rounded-xl focus:border-blue-500 focus:ring-2 ' +
    'focus:ring-blue-500/20 outline-none transition-all placeholder:text-slate-300 dark:placeholder:text-slate-600',
  primaryBtn:
    'w-full py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm shadow-lg ' +
    'shadow-blue-600/25 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2',
  ghostBtn: 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors',
  link:     'font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-500 dark:hover:text-blue-300 transition-colors',
  divider:  'border-slate-200 dark:border-slate-800',
  error:    'flex items-start gap-2.5 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-700 dark:text-red-300 text-xs leading-relaxed',
  info:     'flex items-start gap-2.5 p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-700 dark:text-blue-300 text-xs leading-relaxed',
  success:  'flex items-start gap-2.5 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-xs leading-relaxed',
  segment:  'grid grid-cols-2 p-1 bg-slate-100 dark:bg-slate-950/80 rounded-xl border border-slate-200 dark:border-slate-800/80',
};

/** Ambient glows + dot grid behind the auth screens (both themes). */
export const AuthBackground = () => (
  <>
    <div className="absolute -top-40 -left-40 w-96 h-96 bg-blue-500/10 dark:bg-blue-600/15 rounded-full blur-3xl pointer-events-none" />
    <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-indigo-500/10 dark:bg-indigo-600/15 rounded-full blur-3xl pointer-events-none" />
    <div className="absolute inset-0 bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] dark:bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:28px_28px] opacity-50 dark:opacity-30 pointer-events-none" />
  </>
);

/** Small sun / moon button, fixed top-right on the auth screens. */
export const AuthThemeToggle = () => {
  const { isDark, toggleTheme } = useTheme();
  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={isDark ? 'Light mode' : 'Dark mode'}
      className="fixed top-4 right-4 z-20 p-2.5 rounded-xl bg-white/80 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 shadow-sm backdrop-blur transition"
    >
      {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
    </button>
  );
};
