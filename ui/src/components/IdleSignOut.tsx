// ─────────────────────────────────────────────────────────────────────────────
//  FILE: ui/src/components/IdleSignOut.tsx
//  Signs out a computer left alone for 30 minutes — only when the person did not
//  tick "Trust this device" (shared / office computers). Any mouse, key, touch or
//  scroll in any tab counts as activity. Nothing is shown; the login page explains.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useRef } from 'react';
import { authApi } from '../services/api';
import { IDLE_LIMIT_MS, isTrustedDevice, lastActive, markActive } from '../utils/session';

const EVENTS = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'wheel'] as const;

export const IdleSignOut = () => {
  const signingOut = useRef(false);

  useEffect(() => {
    if (isTrustedDevice()) return;

    const signOut = async () => {
      if (signingOut.current) return;
      signingOut.current = true;
      try { await authApi.logout(); } catch { /* already signed out */ }
      window.location.href = '/login?reason=idle';
    };

    const check = () => { if (Date.now() - lastActive() > IDLE_LIMIT_MS) void signOut(); };

    // record activity at most every 10 s (it's written to shared storage)
    let lastWrite = 0;
    const onActivity = () => {
      const now = Date.now();
      if (now - lastWrite > 10_000) { lastWrite = now; markActive(now); }
    };

    check();   // e.g. the computer woke up after hours with the page still open
    EVENTS.forEach(e => window.addEventListener(e, onActivity, { passive: true, capture: true }));
    const timer = window.setInterval(check, 30_000);
    const onVisible = () => { if (document.visibilityState === 'visible') check(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      EVENTS.forEach(e => window.removeEventListener(e, onActivity, { capture: true }));
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  return null;
};
