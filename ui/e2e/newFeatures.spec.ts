// ─────────────────────────────────────────────────────────────────────────────
//  Comp-off, Excel downloads and onboarding (30 Sep 2026)
// ─────────────────────────────────────────────────────────────────────────────
import { test, expect, type Page } from '@playwright/test';
import { FakeBackend } from './fakeBackend';

test.use({ viewport: { width: 1366, height: 900 } });

type Answer = (path: string, method: string) => unknown;

async function signIn(page: Page, role: string, answer: Answer) {
  const fake = new FakeBackend(page);
  fake.me = { ...fake.me, role };
  fake.answer = answer;
  const sent: { url: string; method: string; body: unknown }[] = [];
  page.on('request', r => {
    if (r.url().includes('/api/') && ['POST', 'PUT', 'DELETE'].includes(r.method()))
      sent.push({ url: r.url(), method: r.method(), body: r.postData() ? r.postDataJSON() : null });
  });
  await fake.install();
  await fake.login();
  return { fake, sent };
}

// ── Comp-off ──────────────────────────────────────────────────────────────

const myCompOff = {
  available: 1, pending: 1, used: 0, expired: 0, nextExpiry: '2026-11-19T00:00:00', minHours: 4, validDays: 60,
  credits: [
    { id: 7, userId: 1, userName: 'Me', workDate: '2026-09-27T00:00:00', occasion: 'Sunday', workMinutes: 360, state: 'Pending', expiresOn: '2026-11-26T00:00:00', isOwn: true },
    { id: 6, userId: 1, userName: 'Me', workDate: '2026-09-20T00:00:00', occasion: 'Sunday', workMinutes: 300, state: 'Available', expiresOn: '2026-11-19T00:00:00', isOwn: true },
  ],
};

test('the leave page shows comp-off earned on weekends, what is waiting and when it runs out', async ({ page }) => {
  const { fake } = await signIn(page, 'Developer', path => (path === '/compoff/my' ? myCompOff : undefined));
  await fake.navigate('/leave');
  const panel = page.getByRole('region', { name: 'Comp-off' });
  await expect(panel.getByTestId('compoff-available')).toHaveText('1');
  await expect(panel).toContainText('Waiting for approval');
  await expect(panel).toContainText('Use by 19 Nov 2026');
  await expect(panel).toContainText('runs out on 19 Nov 2026');
});

test('a manager approves comp-off on Employee Requests', async ({ page }) => {
  let decided = false;
  const { fake, sent } = await signIn(page, 'Manager', (path, method) => {
    if (path === '/compoff/pending') return decided ? [] : [{ ...myCompOff.credits[0], id: 9, userName: 'Priya Dev', isOwn: false }];
    if (path === '/compoff/9/review' && method === 'PUT') { decided = true; return { message: 'ok' }; }
    if (path === '/wfh-requests/team-status')
      return { date: '', dateLabel: '', totalMembers: 0, presentCount: 0, wfhCount: 0, halfDayCount: 0,
               notCheckedInCount: 0, onLeaveCount: 0, pendingRequestsCount: 0, members: [] };
    return undefined;
  });
  await fake.navigate('/manager/wfh-dashboard');
  await page.getByRole('button', { name: /Pending Queue/ }).click();
  const card = page.getByTestId('compoff-9');
  await expect(card).toContainText('Priya Dev');
  await expect(card).toContainText('Sunday');
  await card.getByRole('button', { name: 'Approve' }).click();
  await expect.poll(() => sent.filter(s => s.url.includes('/compoff/9/review')).length).toBe(1);
  expect(sent.find(s => s.url.includes('/compoff/9/review'))!.body).toEqual({ status: 'Approved' });
  await expect(page.getByText('No comp-off waiting.')).toBeVisible();
});

// ── Excel downloads ───────────────────────────────────────────────────────

test('"Download Excel" on the leave page saves the file the server sends', async ({ page }) => {
  const { fake } = await signIn(page, 'Developer', () => undefined);
  await page.route('**/api/leave/export**', route => route.fulfill({
    status: 200,
    headers: {
      'content-type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'content-disposition': "attachment; filename=My_Leave_2026.xlsx; filename*=UTF-8''My_Leave_2026.xlsx",
    },
    body: Buffer.from('PK fake workbook'),
  }));
  await fake.navigate('/leave');
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Download Excel' }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/Leave_\d{4}\.xlsx$/);
});

test('a failed Excel download tells the person instead of doing nothing', async ({ page }) => {
  const { fake } = await signIn(page, 'Developer', () => undefined);
  await page.route('**/api/leave/export**', route => route.fulfill({ status: 500, body: 'boom' }));
  await fake.navigate('/leave');
  await page.getByRole('button', { name: 'Download Excel' }).click();
  await expect(page.getByText('Could not create the Excel file')).toBeVisible();
});

// ── Onboarding ────────────────────────────────────────────────────────────

const plan = (over: object = {}) => ({
  id: 3, userId: 1, userName: 'Me', role: 'Developer', buddyUserId: 4, buddyName: 'Ravi Kumar',
  createdAt: '2026-09-28T04:00:00Z', completedAt: null, doneCount: 1, totalCount: 3,
  tasks: [
    { id: 11, title: 'Set up face check-in', kind: 'Face', owner: 'Employee', done: false, link: '/face-setup', canTick: false },
    { id: 12, title: 'Read the feature guide and company policies', kind: 'Manual', owner: 'Employee', done: false, canTick: true },
    { id: 13, title: 'Laptop, email and accounts ready', kind: 'Manual', owner: 'Manager', done: true, canTick: false },
  ],
  ...over,
});

test('a new joiner sees the getting-started checklist and ticks their own step', async ({ page }) => {
  let ticked = false;
  const { sent } = await signIn(page, 'Developer', (path, method) => {
    if (path === '/onboarding/my') return plan(ticked ? { doneCount: 2 } : {});
    if (path === '/onboarding/tasks/12' && method === 'PUT') { ticked = true; return plan({ doneCount: 2 }); }
    return undefined;
  });
  const card = page.getByRole('region', { name: 'Getting started' });
  await expect(card).toContainText('Your buddy is Ravi Kumar');
  await expect(card.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '33');
  await expect(card.getByRole('link', { name: 'Go' })).toHaveAttribute('href', '/face-setup');
  await expect(card.getByRole('button', { name: /Laptop/ })).toHaveCount(0);   // the manager's step

  await card.getByRole('button', { name: 'Tick Read the feature guide and company policies' }).click();
  await expect.poll(() => sent.filter(s => s.url.includes('/onboarding/tasks/12')).length).toBe(1);
  expect(sent.find(s => s.url.includes('/onboarding/tasks/12'))!.body).toEqual({ done: true });
  await expect(card.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '67');
});

test('a finished checklist is not shown on the dashboard', async ({ page }) => {
  await signIn(page, 'Developer', path => (path === '/onboarding/my' ? plan({ completedAt: '2026-09-30T05:00:00Z', doneCount: 3 }) : undefined));
  await expect(page.getByRole('heading', { name: 'Dashboard' }).or(page.locator('main')).first()).toBeVisible();
  await expect(page.getByRole('region', { name: 'Getting started' })).toHaveCount(0);
});

test('a team lead starts onboarding for a recent joiner with a buddy and sees the checklists', async ({ page }) => {
  const { fake, sent } = await signIn(page, 'TeamLead', (path, method) => {
    if (path === '/onboarding' && method === 'GET') return [plan({ userId: 6, userName: 'Priya Dev' })];
    if (path === '/onboarding/candidates') return [{ userId: 8, fullName: 'Neha Shah', role: 'Developer', joinedOn: '2026-09-25T00:00:00' }];
    if (path === '/profile/directory') return [{ id: 4, fullName: 'Ravi Kumar' }, { id: 8, fullName: 'Neha Shah' }];
    if (path === '/onboarding' && method === 'POST') return plan({ userId: 8, userName: 'Neha Shah' });
    return undefined;
  });
  await fake.navigate('/manager/onboarding');

  const card = page.getByTestId('onboarding-6');
  await expect(card).toContainText('Priya Dev');
  await expect(card).toContainText('Laptop, email and accounts ready');

  await page.getByRole('combobox', { name: 'Buddy for Neha Shah' }).click();
  await page.getByRole('option', { name: 'Ravi Kumar' }).click();
  await page.getByRole('button', { name: 'Start onboarding' }).click();
  await expect.poll(() => sent.filter(s => s.method === 'POST' && s.url.endsWith('/api/onboarding')).length).toBe(1);
  expect(sent.find(s => s.method === 'POST' && s.url.endsWith('/api/onboarding'))!.body).toEqual({ userId: 8, buddyUserId: 4 });
});
