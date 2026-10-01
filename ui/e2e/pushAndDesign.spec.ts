// ─────────────────────────────────────────────────────────────────────────────
//  1 Oct 2026: the colour design follows the account, and phone push
//  notifications can be turned on from the Notifications page.
//  (Headless browsers can't reach a real push service, so the browser's
//  PushManager is replaced by a stand-in that behaves like Chrome's.)
// ─────────────────────────────────────────────────────────────────────────────
import { test, expect, type Page } from '@playwright/test';
import { FakeBackend } from './fakeBackend';

test.use({ viewport: { width: 1366, height: 900 } });

const posts = (page: Page, path: string) => {
  const bodies: unknown[] = [];
  page.on('request', r => { if (r.method() !== 'GET' && r.url().includes(`/api${path}`)) bodies.push(r.postDataJSON()); });
  return bodies;
};

test('the design saved on the account is used after signing in, and a new pick is saved', async ({ page }) => {
  const fake = new FakeBackend(page);
  fake.me = { ...fake.me, uiDesign: 'purple' } as typeof fake.me;
  const saved = posts(page, '/profile/me/design');
  await fake.install();
  await fake.login();

  await expect(page.locator('html')).toHaveAttribute('data-design', 'purple');   // this browser had never picked one

  await page.getByTitle('Account & Documentation Menu').click();
  await page.getByRole('button', { name: 'Original Blue', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-design', 'blue');
  await expect.poll(() => saved).toEqual([{ design: 'blue' }]);
});

test('turning on phone notifications subscribes this device and a test can be sent', async ({ page }) => {
  // stand-in for Notification permission + PushManager (what Chrome on a phone does)
  await page.addInitScript(() => {
    let permission: NotificationPermission = 'default';
    Object.defineProperty(Notification, 'permission', { get: () => permission });
    Notification.requestPermission = async () => (permission = 'granted');
    let current: unknown = null;
    const fakeSub = (key: BufferSource) => ({
      endpoint: 'https://fcm.googleapis.com/fcm/send/device-1',
      options: { applicationServerKey: key instanceof ArrayBuffer ? key : (key as Uint8Array).buffer },
      toJSON: () => ({ endpoint: 'https://fcm.googleapis.com/fcm/send/device-1', keys: { p256dh: 'BPUB', auth: 'AUTH' } }),
      unsubscribe: async () => { current = null; return true; },
    });
    const pushManager = {
      getSubscription: async () => current,
      subscribe: async (o: PushSubscriptionOptionsInit) => (current = fakeSub(o.applicationServerKey as BufferSource)),
    };
    Object.defineProperty(navigator.serviceWorker, 'ready', { get: () => Promise.resolve({ pushManager }) });
  });

  const fake = new FakeBackend(page);
  const devices: unknown[] = [];
  fake.answer = (path, method) => {
    if (path === '/push/config') return { publicKey: 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U' };
    if (path === '/push/devices') return devices;
    if (path === '/push/subscribe' && method === 'POST') { devices.splice(0, 1, { id: 1, device: 'Linux · Chrome', createdAt: new Date().toISOString() }); return { message: 'ok' }; }
    if (path === '/push/test') return { sent: 1, message: 'Test sent to 1 device(s).' };
    return undefined;
  };
  const subscribed = posts(page, '/push/subscribe');
  await fake.install();
  await fake.login();
  await fake.navigate('/notifications');

  const card = page.getByTestId('push-card');
  await expect(card.getByText('Phone notifications')).toBeVisible();
  await card.getByRole('button', { name: 'Turn on' }).click();

  await expect(card.getByRole('button', { name: 'Turn off' })).toBeVisible();
  await expect.poll(() => subscribed).toEqual([
    { endpoint: 'https://fcm.googleapis.com/fcm/send/device-1', keys: { p256dh: 'BPUB', auth: 'AUTH' }, device: expect.stringContaining('·') },
  ]);
  await expect(card.getByText('Linux · Chrome')).toBeVisible();                   // listed under "Your devices"

  await card.getByRole('button', { name: 'Send test' }).click();
  await expect(page.getByText('Test sent to 1 device(s).')).toBeVisible();
});

test('if notifications are blocked, the card says how to allow them instead of a button', async ({ page }) => {
  await page.addInitScript(() => { Object.defineProperty(Notification, 'permission', { get: () => 'denied' }); });
  const fake = new FakeBackend(page);
  await fake.install();
  await fake.login();
  await fake.navigate('/notifications');

  const card = page.getByTestId('push-card');
  await expect(card.getByText(/Notifications are blocked for this site/)).toBeVisible();
  await expect(card.getByRole('button', { name: 'Turn on' })).toHaveCount(0);
});
