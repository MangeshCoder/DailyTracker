// ─────────────────────────────────────────────────────────────────────────────
//  Forgotten check-out (30 Sep 2026): the dashboard asks about the day the app
//  closed — one click to confirm, or send the real finish time; the manager
//  approves it on Employee Requests next to leave and WFH.
// ─────────────────────────────────────────────────────────────────────────────
import { test, expect, type Page } from '@playwright/test';
import { FakeBackend } from './fakeBackend';

test.use({ viewport: { width: 1366, height: 900 } });

const closedDay = {
  logId: 41, logDate: '2026-09-29T00:00:00', checkInTime: '2026-09-29T03:30:00Z', checkOutTime: '2026-09-29T17:00:00Z',
  basis: 'LastActivity', workMinutes: 750, latestAllowed: '2026-09-29T23:30:00Z',
};
const correction = {
  logId: 41, userId: 3, userName: 'Priya Dev', logDate: '2026-09-29T00:00:00', checkInTime: '2026-09-29T03:30:00Z',
  autoCheckOutTime: '2026-09-29T12:30:00Z', requestedCheckOut: '2026-09-29T15:30:00Z', basis: 'NormalDay',
  reason: 'Stayed for the release', isOwn: false,
};

async function signIn(page: Page, role: string) {
  const fake = new FakeBackend(page);
  fake.me = { ...fake.me, role };
  const sent: { url: string; method: string; body: unknown }[] = [];
  let answered = false;
  fake.answer = (path, method) => {
    if (path === '/dailylog/auto-checkout') return answered ? null : closedDay;
    if (/^\/dailylog\/41\/(auto-checkout\/confirm|checkout-correction)$/.test(path) && method === 'POST') { answered = true; return { message: 'ok' }; }
    if (path === '/dailylog/checkout-corrections/pending') return sent.some(s => s.url.includes('/review')) ? [] : [correction];
    if (path === '/dailylog/41/checkout-correction/review') return { message: 'ok' };
    if (path === '/wfh-requests/team-status')
      return { date: '', dateLabel: '', totalMembers: 0, presentCount: 0, wfhCount: 0, halfDayCount: 0,
               notCheckedInCount: 0, onLeaveCount: 0, pendingRequestsCount: 0, members: [] };
    return undefined;
  };
  page.on('request', r => {
    if (r.url().includes('/api/dailylog/') && ['POST', 'PUT'].includes(r.method()))
      sent.push({ url: r.url(), method: r.method(), body: r.postData() ? r.postDataJSON() : null });
  });
  await fake.install();
  await fake.login();
  return { fake, sent };
}

test('the dashboard asks about a forgotten check-out and "That\'s right" confirms it in one click', async ({ page }) => {
  const { sent } = await signIn(page, 'Developer');
  const notice = page.getByRole('region', { name: 'Forgotten check-out' });
  await expect(notice).toContainText("You didn't check out on");
  await expect(notice).toContainText('your last activity');
  await expect(notice).toContainText('12h 30m');

  await notice.getByRole('button', { name: "That's right" }).click();
  await expect(notice).toHaveCount(0);
  expect(sent.map(s => s.url)).toEqual([expect.stringContaining('/api/dailylog/41/auto-checkout/confirm')]);
});

test('the employee sends the real finish time with a reason', async ({ page }) => {
  const { sent } = await signIn(page, 'Developer');
  const notice = page.getByRole('region', { name: 'Forgotten check-out' });
  await notice.getByRole('button', { name: 'I finished at a different time' }).click();
  const send = notice.getByRole('button', { name: 'Send to manager' });
  await expect(send).toBeDisabled();                                  // a reason is required
  await notice.getByLabel('Why (for your manager)').fill('Stayed for the release');
  await send.click();

  await expect(notice).toHaveCount(0);
  const post = sent.find(s => s.url.includes('/checkout-correction'))!;
  expect(post.body).toMatchObject({ reason: 'Stayed for the release' });
  expect(typeof (post.body as { checkOutTime: string }).checkOutTime).toBe('string');
});

test('a team lead approves a check-out correction on Employee Requests', async ({ page }) => {
  const { fake, sent } = await signIn(page, 'TeamLead');
  await fake.navigate('/manager/wfh-dashboard');
  await page.getByRole('button', { name: /Pending Queue/ }).click();

  const card = page.getByTestId('correction-41');
  await expect(card).toContainText('Priya Dev');
  await expect(card).toContainText('Stayed for the release');
  await expect(card).toContainText('Says finished');
  await card.getByRole('textbox').fill('OK');
  await card.getByRole('button', { name: 'Approve' }).click();

  await expect.poll(() => sent.filter(s => s.url.includes('/review')).length).toBe(1);
  expect(sent.find(s => s.url.includes('/review'))!.body).toEqual({ status: 'Approved', note: 'OK' });
  await expect(page.getByText('No check-out corrections waiting.')).toBeVisible();
});

test('a live notification pops up once (the bell is on the page twice)', async ({ page }) => {
  const { fake } = await signIn(page, 'Developer');
  await fake.notify({ title: '✅ Check-out corrected', message: 'Your hours were updated.', type: 'Success' });
  await expect(page.getByText('✅ Check-out corrected: Your hours were updated.')).toHaveCount(1);
  await page.waitForTimeout(800);
  await expect(page.getByText('✅ Check-out corrected: Your hours were updated.')).toHaveCount(1);
});
