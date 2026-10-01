// ─────────────────────────────────────────────────────────────────────────────
//  Phone / browser push notifications — the browser side.
//  The service worker (public/push-sw.js) shows them; the server (api/push/*)
//  keeps one subscription per device and sends every bell notification and
//  chat messages while the app is closed.
// ─────────────────────────────────────────────────────────────────────────────
import { pushApi } from '../services/api';

export type PushState =
  | 'unsupported'      // this browser can't do push at all
  | 'needs-install'    // iPhone / iPad: works only from the Home Screen app
  | 'blocked'          // notifications were refused in the browser settings
  | 'off'
  | 'on';

const isIos = () => /iPad|iPhone|iPod/.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const isStandalone = () => window.matchMedia?.('(display-mode: standalone)').matches ||
  (navigator as unknown as { standalone?: boolean }).standalone === true;

const supported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

/** "Android · Chrome", "iPhone · Safari", "Windows · Edge" … shown in the device list */
export function describeDevice(): string {
  const ua = navigator.userAgent;
  const os = /Android/.test(ua) ? 'Android' : isIos() ? (/iPad/.test(ua) ? 'iPad' : 'iPhone')
    : /Windows/.test(ua) ? 'Windows' : /Mac OS X/.test(ua) ? 'Mac' : /Linux/.test(ua) ? 'Linux' : 'Device';
  const browser = /Edg\//.test(ua) ? 'Edge' : /SamsungBrowser/.test(ua) ? 'Samsung Internet' : /Firefox\//.test(ua) ? 'Firefox'
    : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : 'Browser';
  return `${os} · ${browser}`;
}

function keyBytes(base64url: string): Uint8Array {
  const b64 = base64url.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(base64url.length / 4) * 4, '=');
  return Uint8Array.from(atob(b64), c => c.charCodeAt(0));
}

const sameKey = (a: ArrayBuffer | null | undefined, b: Uint8Array) =>
  !!a && a.byteLength === b.length && new Uint8Array(a).every((v, i) => v === b[i]);

async function registration() {
  return navigator.serviceWorker.ready;
}

async function sendToServer(sub: PushSubscription) {
  const json = sub.toJSON();
  await pushApi.subscribe({
    endpoint: sub.endpoint,
    keys: { p256dh: json.keys?.p256dh ?? '', auth: json.keys?.auth ?? '' },
    device: describeDevice(),
  });
}

export async function getPushState(): Promise<PushState> {
  if (!supported()) return isIos() && !isStandalone() ? 'needs-install' : 'unsupported';
  if (Notification.permission === 'denied') return 'blocked';
  const reg = await registration();
  const sub = await reg.pushManager.getSubscription();
  return sub && Notification.permission === 'granted' ? 'on' : 'off';
}

/** Ask permission (must follow a tap), subscribe this device and tell the server */
export async function enablePush(): Promise<PushState> {
  if (!supported()) return getPushState();
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return permission === 'denied' ? 'blocked' : 'off';

  const reg = await registration();
  const key = keyBytes((await pushApi.config()).data.publicKey);
  let sub = await reg.pushManager.getSubscription();
  if (sub && !sameKey(sub.options.applicationServerKey, key)) { await sub.unsubscribe(); sub = null; }   // server key changed
  sub ??= await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key as BufferSource });
  await sendToServer(sub);
  return 'on';
}

export async function disablePush(): Promise<PushState> {
  if (!supported()) return getPushState();
  const sub = await (await registration()).pushManager.getSubscription();
  if (sub) {
    await pushApi.unsubscribe(sub.endpoint).catch(() => { /* still stop locally */ });
    await sub.unsubscribe();
  }
  return getPushState();
}

/**
 * After sign-in: if this device already gets pushes, make sure they go to the person
 * signed in now (a shared PC may have been used by someone else before).
 */
export async function syncPushOwner(): Promise<void> {
  try {
    if (!supported() || Notification.permission !== 'granted') return;
    const sub = await (await registration()).pushManager.getSubscription();
    if (sub) await sendToServer(sub);
  } catch { /* best effort */ }
}

/** On sign-out: this device stops getting the signed-out person's notifications */
export async function forgetPushOnSignOut(): Promise<void> {
  try {
    if (!supported()) return;
    const reg = await Promise.race([registration(), new Promise<null>(r => setTimeout(() => r(null), 1500))]);
    const sub = reg ? await reg.pushManager.getSubscription() : null;
    if (sub) await pushApi.unsubscribe(sub.endpoint);
  } catch { /* best effort */ }
}
