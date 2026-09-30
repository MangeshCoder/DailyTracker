// ─────────────────────────────────────────────────────────────────────────────
//  FILE: ui/src/utils/session.ts
//  How long a sign-in lasts on this browser.
//   • "Trust this device" ticked  → stays signed in (personal laptop / phone)
//   • not ticked                  → ends when the browser closes (server side) and
//                                   after IDLE_LIMIT_MS without any activity (here)
// ─────────────────────────────────────────────────────────────────────────────

export const IDLE_LIMIT_MS = 30 * 60 * 1000;   // 30 minutes

const TRUSTED_KEY = 'dt.trustedDevice';
const LAST_ACTIVE_KEY = 'dt.lastActive';

const read = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const write = (k: string, v: string | null) => {
  try { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch { /* storage blocked */ }
};

/** Called right after a successful sign-in */
export function startSession(trusted: boolean) {
  write(TRUSTED_KEY, trusted ? '1' : null);
  markActive();
}

export const isTrustedDevice = () => read(TRUSTED_KEY) === '1';

/** Shared by every open tab, so activity in one tab keeps the others signed in too */
export function markActive(at = Date.now()) { write(LAST_ACTIVE_KEY, String(at)); }

export function lastActive(): number {
  const v = Number(read(LAST_ACTIVE_KEY));
  return Number.isFinite(v) && v > 0 ? v : Date.now();
}
