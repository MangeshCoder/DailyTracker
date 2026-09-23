// ─────────────────────────────────────────────────────────────────────────────
//  FILE 5:  frontend/src/components/pwa/PWAUpdatePrompt.tsx
//  ACTION:  CREATE new file (new folder: src/components/pwa/)
//
//  What this does:
//  When the service worker detects a new version of the app has been deployed,
//  it shows a small toast at the bottom of the screen:
//    "New version available — Update now"
//  User taps it → page reloads to the new version.
//  Without this, users on mobile may run an old cached version for hours.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';

export function PWAUpdatePrompt() {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(r) {
      // Check for updates every 60 seconds (catches deploys quickly)
      r && setInterval(() => r.update(), 60_000);
    },
  });

  const [dismissed, setDismissed] = useState(false);

  // Reset dismissed if a new update comes in
  useEffect(() => {
    if (needRefresh) setDismissed(false);
  }, [needRefresh]);

  if (!needRefresh || dismissed) return null;

  return (
    <div className="fixed bottom-20 md:bottom-4 left-1/2 -translate-x-1/2 z-[9999]
                    flex items-center gap-3 px-4 py-3
                    bg-blue-600 text-white rounded-2xl shadow-2xl
                    animate-in slide-in-from-bottom-4 duration-300
                    max-w-sm w-[calc(100%-2rem)]">
      <span className="text-xl shrink-0">🆕</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold">New version available</p>
        <p className="text-xs text-blue-200">Tap update to get the latest features</p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={() => updateServiceWorker(true)}
          className="px-3 py-1.5 bg-white text-blue-600 text-xs font-bold rounded-lg hover:bg-blue-50 transition"
        >
          Update
        </button>
        <button
          onClick={() => setDismissed(true)}
          className="p-1 text-blue-200 hover:text-white transition"
          aria-label="Dismiss"
        >
          ✕
        </button>
      </div>
    </div>
  );
}