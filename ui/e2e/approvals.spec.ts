// ─────────────────────────────────────────────────────────────────────────────
//  Approvals polish (9 Oct 2026): WFH / half-day requests use the same card as
//  every other request — one click to approve (no drawer, no pop-up), and
//  Decline needs a note. The requests page and EOD Reviews use plain words.
// ─────────────────────────────────────────────────────────────────────────────
import { test, expect, type Page } from '@playwright/test';
import { FakeBackend } from './fakeBackend';

const inDays = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10) + 'T00:00:00'; };
const wfh = [
  { id: 21, userId: 6, employeeName: 'Priya Sharma', requestType: 'WFH', requestDate: inDays(2), requestDateLabel: '', reason: 'Plumber visit at home', status: 'Pending', requestedAt: inDays(0) },
  { id: 22, userId: 5, employeeName: 'Rahul Verma', requestType: 'HalfDay', halfDaySlot: 'Morning', requestDate: inDays(1), requestDateLabel: '', reason: 'Doctor appointment', status: 'Pending', requestedAt: inDays(0) },
];

async function openQueue(page: Page) {
  const fake = new FakeBackend(page);
  fake.me = { ...fake.me, role: 'Manager' };
  const decisions: { path: string; body: unknown }[] = [];
  const waiting = [...wfh];                                   // decided requests leave the queue, like the server
  fake.answer = (path, method) => {
    if (path === '/wfh-requests/pending') return waiting;
    if (path === '/wfh-requests/team-status')
      return { date: '2026-10-09', dateLabel: 'Today', totalMembers: 3, presentCount: 2, wfhCount: 1, halfDayCount: 0,
               notCheckedInCount: 0, onLeaveCount: 0, pendingRequestsCount: 2, members: [] };
    const m = path.match(/^\/wfh-requests\/(\d+)\/(approve|reject)$/);
    if (m && method === 'POST') { waiting.splice(waiting.findIndex(r => r.id === +m[1]), 1); return { message: 'ok' }; }
    return undefined;
  };
  page.on('request', r => {
    if (r.method() === 'POST' && /\/wfh-requests\/\d+\/(approve|reject)$/.test(r.url()))
      decisions.push({ path: new URL(r.url()).pathname, body: r.postDataJSON() });
  });
  await fake.install();
  await fake.login();
  await fake.navigate('/manager/wfh-dashboard');
  return { decisions };
}

test('a WFH request is approved in one click, with no drawer or pop-up', async ({ page }) => {
  const { decisions } = await openQueue(page);
  await expect(page.getByRole('heading', { name: 'Employee Requests', level: 1 })).toBeVisible();
  await expect(page.getByText('Live Supervisor Sync')).toHaveCount(0);
  await page.getByRole('button', { name: /Pending Queue/ }).click();

  const priya = page.getByTestId('wfh-21');
  await expect(priya).toContainText('Work from home');
  await expect(priya).toContainText('In 2 days');
  await expect(priya).toContainText('Plumber visit at home');
  await expect(page.getByTestId('wfh-22')).toContainText('Half day (morning)');
  await expect(page.getByText('2 pending').last()).toBeVisible();

  await priya.getByRole('button', { name: 'Approve' }).click();
  await expect(page.getByText('Request approved')).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);                     // no "are you sure?" pop-up
  expect(decisions).toEqual([{ path: '/api/wfh-requests/21/approve', body: {} }]);
  await expect(page.getByTestId('wfh-21')).toHaveCount(0);
});

test('declining a WFH request needs a note', async ({ page }) => {
  const { decisions } = await openQueue(page);
  await page.getByRole('button', { name: /Pending Queue/ }).click();

  const rahul = page.getByTestId('wfh-22');
  const decline = rahul.getByRole('button', { name: 'Decline' });
  await expect(decline).toBeDisabled();
  await rahul.getByRole('textbox', { name: 'Note for Rahul Verma' }).fill('Sprint demo that morning — please pick another day');
  await decline.click();

  await expect(page.getByText('Request declined')).toBeVisible();
  expect(decisions).toEqual([{ path: '/api/wfh-requests/22/reject', body: { note: 'Sprint demo that morning — please pick another day' } }]);
});

test('EOD Reviews speaks plainly', async ({ page }) => {
  const fake = new FakeBackend(page);
  fake.me = { ...fake.me, role: 'Manager' };
  fake.answer = path => (path.startsWith('/eod') || path.includes('eod') ? [] : undefined);
  await fake.install();
  await fake.login();
  await fake.navigate('/manager/eod-reviews');

  await expect(page.getByRole('heading', { name: 'EOD Reviews', level: 1 })).toBeVisible();
  await expect(page.getByText('Waiting for feedback')).toBeVisible();
  await expect(page.getByText('No EOD reports yet')).toBeVisible();
  await expect(page.getByText(/Supervisor|Audit/)).toHaveCount(0);
});
