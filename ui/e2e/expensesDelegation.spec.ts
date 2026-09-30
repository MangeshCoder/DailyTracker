// ─────────────────────────────────────────────────────────────────────────────
//  Expense claims and approval delegation (1 Oct 2026)
// ─────────────────────────────────────────────────────────────────────────────
import { test, expect, type Page } from '@playwright/test';
import { FakeBackend } from './fakeBackend';

test.use({ viewport: { width: 1366, height: 900 } });

type Answer = (path: string, method: string) => unknown;

async function signIn(page: Page, role: string, answer: Answer) {
  const fake = new FakeBackend(page);
  fake.me = { ...fake.me, role };
  fake.answer = answer;
  const sent: { url: string; method: string; body: string | null }[] = [];
  page.on('request', r => {
    if (r.url().includes('/api/') && ['POST', 'PUT', 'DELETE'].includes(r.method()))
      sent.push({ url: r.url(), method: r.method(), body: r.postData() });
  });
  await fake.install();
  await fake.login();
  return { fake, sent };
}

const claim = (over: object = {}) => ({
  id: 5, userId: 1, userName: 'Me', expenseDate: '2026-09-29T00:00:00', category: 'Travel', amount: 450.5,
  description: 'Cab to client office', receiptFileName: 'cab.pdf', status: 'Pending', createdAt: '2026-09-29T06:00:00Z', isOwn: true,
  ...over,
});
const teamStatus = { date: '', dateLabel: '', totalMembers: 0, presentCount: 0, wfhCount: 0, halfDayCount: 0,
  notCheckedInCount: 0, onLeaveCount: 0, pendingRequestsCount: 0, members: [] };

// ── Expenses ──────────────────────────────────────────────────────────────

test('an employee sends a claim with the bill attached', async ({ page }) => {
  let sentClaim = false;
  const { fake, sent } = await signIn(page, 'Developer', (path, method) => {
    if (path === '/expenses/my') return sentClaim ? [claim()] : [];
    if (path === '/expenses' && method === 'POST') { sentClaim = true; return claim(); }
    return undefined;
  });
  await fake.navigate('/expenses');
  await page.getByRole('button', { name: 'New claim' }).click();
  const form = page.getByRole('form', { name: 'New expense claim' });
  const send = form.getByRole('button', { name: 'Send claim' });
  await expect(send).toBeDisabled();                                   // the bill is required

  await form.getByLabel('Amount (₹)').fill('450.50');
  await form.getByLabel('What was it for?').fill('Cab to client office');
  await form.getByLabel(/Bill \(PDF or photo/).setInputFiles({ name: 'cab.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4') });
  await send.click();

  await expect.poll(() => sent.filter(s => s.url.endsWith('/api/expenses') && s.method === 'POST').length).toBe(1);
  const body = sent.find(s => s.url.endsWith('/api/expenses'))!.body!;
  expect(body).toContain('name="amount"');
  expect(body).toContain('450.50');
  expect(body).toContain('filename="cab.pdf"');
  await expect(page.getByText('Cab to client office')).toBeVisible();
  await expect(page.getByText('Waiting', { exact: true })).toBeVisible();
});

test('approved claims say which salary pays them; declined ones show the reason', async ({ page }) => {
  const { fake } = await signIn(page, 'Developer', path => path === '/expenses/my' ? [
    claim({ id: 1, status: 'Approved', paidWith: 'October 2026', amount: 1200 }),
    claim({ id: 2, status: 'Rejected', reviewNote: 'Personal trip', description: 'Weekend cab' }),
  ] : undefined);
  await fake.navigate('/expenses');
  await expect(page.getByText('paid with October 2026 salary')).toBeVisible();
  await expect(page.getByText('“Personal trip”')).toBeVisible();
  await expect(page.getByRole('button', { name: /Withdraw/ })).toHaveCount(0);   // only waiting claims can be withdrawn
});

test('a team lead approves a claim on Employee Requests; declining needs a reason', async ({ page }) => {
  let decided = false;
  const { fake, sent } = await signIn(page, 'TeamLead', (path, method) => {
    if (path === '/expenses/pending') return decided ? [] : [claim({ id: 9, userName: 'Priya Dev', isOwn: false })];
    if (path === '/expenses/9/review' && method === 'PUT') { decided = true; return { message: 'ok' }; }
    if (path === '/delegations/my') return { outgoing: [], actingFor: [], upcoming: [] };
    if (path === '/wfh-requests/team-status') return teamStatus;
    return undefined;
  });
  await fake.navigate('/manager/wfh-dashboard');
  await page.getByRole('button', { name: /Pending Queue/ }).click();
  const card = page.getByTestId('expense-9');
  await expect(card).toContainText('Priya Dev');
  await expect(card).toContainText('₹450.50');
  await expect(card.getByRole('button', { name: 'Decline' })).toBeDisabled();
  await card.getByRole('button', { name: 'Approve' }).click();
  await expect.poll(() => sent.filter(s => s.url.includes('/expenses/9/review')).length).toBe(1);
  expect(JSON.parse(sent.find(s => s.url.includes('/expenses/9/review'))!.body!)).toEqual({ status: 'Approved' });
  await expect(page.getByText('No expense claims waiting.')).toBeVisible();
});

// ── Delegation ────────────────────────────────────────────────────────────

test('a team lead going on leave hands over approvals to a colleague', async ({ page }) => {
  let handedOver = false;
  const { fake, sent } = await signIn(page, 'TeamLead', (path, method) => {
    if (path === '/delegations/my') return {
      outgoing: handedOver ? [{ id: 4, fromUserId: 1, fromName: 'Me', fromRole: 'TeamLead', toUserId: 5, toName: 'Om Lead',
        startDate: '2026-10-05T00:00:00', endDate: '2026-10-09T00:00:00', state: 'Upcoming' }] : [],
      actingFor: [], upcoming: [] };
    if (path === '/delegations' && method === 'POST') { handedOver = true; return { id: 4 }; }
    if (path === '/profile/directory') return [
      { id: 5, fullName: 'Om Lead', role: 'TeamLead' }, { id: 6, fullName: 'Dev One', role: 'Developer' }, { id: 7, fullName: 'Sara Boss', role: 'Manager' }];
    if (path === '/wfh-requests/team-status') return teamStatus;
    return undefined;
  });
  await fake.navigate('/manager/wfh-dashboard');
  const panel = page.getByRole('region', { name: /Hand over your approvals/ });
  await panel.getByRole('button', { name: 'Hand over' }).click();
  await panel.getByRole('combobox', { name: "Who decides while you're away" }).click();
  await expect(page.getByRole('option', { name: /Dev One/ })).toHaveCount(0);   // only managers and team leads
  await page.getByRole('option', { name: 'Om Lead (Team lead)' }).click();
  await panel.getByRole('form', { name: 'Hand over approvals' }).getByRole('button', { name: 'Hand over' }).click();

  await expect.poll(() => sent.filter(s => s.url.endsWith('/api/delegations') && s.method === 'POST').length).toBe(1);
  expect(JSON.parse(sent.find(s => s.url.endsWith('/api/delegations'))!.body!)).toMatchObject({ toUserId: 5 });
  await expect(page.getByTestId('handover-4')).toContainText('Om Lead decides for you');
});

test('a team lead covering for the manager sees the notice and the leave queue', async ({ page }) => {
  const { fake } = await signIn(page, 'TeamLead', path => {
    if (path === '/delegations/my') return { outgoing: [], upcoming: [], actingFor: [{ id: 2, fromUserId: 7, fromName: 'Sara Boss', fromRole: 'Manager',
      toUserId: 1, toName: 'Me', startDate: '2026-09-29T00:00:00', endDate: '2026-10-03T00:00:00', state: 'Active' }] };
    if (path === '/leave/all') return [{ id: 31, userId: 6, userName: 'Ravi Dev', fromDate: '2026-10-12T00:00:00', toDate: '2026-10-12T00:00:00',
      leaveDays: 1, leaveType: 'Casual', reason: 'family', status: 'Pending', appliedAt: '2026-09-30T05:00:00Z', isOwn: false, canReview: true }];
    if (path === '/wfh-requests/team-status') return teamStatus;
    return undefined;
  });
  await fake.navigate('/manager/wfh-dashboard');
  await expect(page.getByRole('status').filter({ hasText: 'deciding for Sara Boss' })).toBeVisible();
  await page.getByRole('button', { name: /Pending Queue/ }).click();
  await expect(page.getByText('Ravi Dev')).toBeVisible();
});
