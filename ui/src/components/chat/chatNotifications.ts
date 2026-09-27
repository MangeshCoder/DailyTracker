// ─────────────────────────────────────────────────────────────────────────────
//  Desktop (browser) notifications for chat — kept tiny because ChatContext
//  (loaded on every page) imports it. The toggle button lives in ChatExtras.
// ─────────────────────────────────────────────────────────────────────────────

export const DESKTOP_NOTIFY_PREF_KEY = 'chat.desktopNotifications';

export const desktopNotificationsSupported = () => typeof window !== 'undefined' && 'Notification' in window;

export const desktopNotificationsEnabled = () => {
  if (!desktopNotificationsSupported() || Notification.permission !== 'granted') return false;
  try { return localStorage.getItem(DESKTOP_NOTIFY_PREF_KEY) !== 'off'; } catch { return true; }
};

export const showDesktopNotification = (title: string, body: string, tag: string, onClick: () => void) => {
  if (!desktopNotificationsEnabled()) return;
  try {
    const n = new Notification(title, { body, tag, icon: '/icons/icon-192.png' });
    n.onclick = () => { window.focus(); onClick(); n.close(); };
  } catch { /* some browsers only allow notifications from a service worker */ }
};
