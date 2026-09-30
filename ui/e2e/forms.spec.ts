// ─────────────────────────────────────────────────────────────────────────────
//  Form controls & manager requests (30 Sep 2026):
//  • every drop-down is the app's styled one (no plain browser <select>)
//  • the date picker is a fixed, compact size that stays on screen
//  • managers approve leave in the same place as WFH requests
// ─────────────────────────────────────────────────────────────────────────────
import { test, expect, type Page } from '@playwright/test';
import { FakeBackend } from './fakeBackend';

test.use({ viewport: { width: 1366, height: 768 } });

const leave = {
  id: 9, userId: 4, userName: 'Ravi Dev', fromDate: '2026-10-12', toDate: '2026-10-13', leaveDays: 2,
  leaveType: 'Casual', reason: 'Family function', status: 'Pending', appliedAt: '2026-09-30T08:00:00Z', canReview: true,
};

async function signIn(page: Page, role: string) {
  const fake = new FakeBackend(page);
  fake.me = { ...fake.me, role };
  const reviews: { url: string; body: unknown }[] = [];
  fake.answer = (path, method) => {
    if (path === '/leave/all') return [leave];
    if (path === '/wfh-requests/team-status')
      return { date: '2026-09-30', dateLabel: 'Today', totalMembers: 0, presentCount: 0, wfhCount: 0, halfDayCount: 0,
               notCheckedInCount: 0, onLeaveCount: 0, pendingRequestsCount: 0, members: [] };
    if (/^\/leave\/\d+\/review$/.test(path) && method === 'PUT') return { message: 'Leave reviewed.' };
    return undefined;
  };
  page.on('request', r => {
    if (r.method() === 'PUT' && r.url().includes('/review')) reviews.push({ url: r.url(), body: r.postDataJSON() });
  });
  await fake.install();
  await fake.login();
  return { fake, reviews };
}

test('drop-downs are the styled ones and work with mouse and keyboard', async ({ page }) => {
  const { fake } = await signIn(page, 'Manager');
  await fake.navigate('/team/directory');
  const roles = page.getByRole('combobox').filter({ hasText: 'All Roles' });
  await expect(roles).toBeVisible();
  await expect(page.locator('select')).toHaveCount(0);            // no plain browser drop-downs left

  await roles.click();
  await expect(page.getByRole('listbox')).toBeVisible();
  await page.getByRole('option', { name: 'Developer' }).click();
  await expect(roles).toHaveCount(0);                              // the box now says "Developer"
  const picked = page.getByRole('combobox').filter({ hasText: 'Developer' });
  await expect(picked).toBeVisible();
  await expect(page.getByRole('listbox')).toHaveCount(0);

  // keyboard: open with ↓, move, pick with Enter
  await picked.focus();
  await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('listbox')).toBeVisible();
  await page.keyboard.press('Home');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('combobox').filter({ hasText: 'All Roles' })).toBeVisible();
});

test('the date picker is compact and stays on screen, so the next month is easy to reach', async ({ page }) => {
  const { fake } = await signIn(page, 'Developer');
  await fake.navigate('/leave');
  await page.getByRole('button', { name: /Apply for Leave/ }).first().click();
  await page.getByRole('button', { name: 'Select date' }).first().click();

  const next = page.getByRole('button', { name: 'Next month' });
  await expect(next).toBeVisible();
  const popup = page.locator('div[style*="position: fixed"]', { has: next }).last();
  const box = (await popup.boundingBox())!;
  expect(box.width).toBeLessThanOrEqual(300);                      // was as wide as the form field
  expect(box.height).toBeLessThan(360);                            // was taller than the screen on wide fields
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.y + box.height).toBeLessThanOrEqual(768);

  await next.click();
  await next.click();
  await page.getByRole('button', { name: '15', exact: true }).click();
  await expect(page.getByRole('button', { name: /15 \w+ 20\d\d/ })).toBeVisible();
});

test('a manager approves leave in the same place as WFH requests', async ({ page }) => {
  const { fake, reviews } = await signIn(page, 'Manager');
  await fake.navigate('/manager/wfh-dashboard');
  await page.getByRole('button', { name: /Pending Queue/ }).click();

  await expect(page.getByRole('heading', { name: 'Leave requests' })).toBeVisible();
  await expect(page.getByRole('heading', { name: /WFH & half-day requests/ })).toBeVisible();
  const card = page.getByTestId('leave-9');
  await expect(card).toContainText('Ravi Dev');
  await expect(card).toContainText('Family function');

  await card.getByRole('textbox').fill('Enjoy!');
  await card.getByRole('button', { name: 'Approve' }).click();
  await expect.poll(() => reviews.length).toBe(1);
  expect(reviews[0].url).toContain('/leave/9/review');
  expect(reviews[0].body).toEqual({ status: 'Approved', reviewNote: 'Enjoy!' });
});

test('a team lead (who cannot decide leave) sees only the WFH queue there', async ({ page }) => {
  const { fake } = await signIn(page, 'TeamLead');
  await fake.navigate('/manager/wfh-dashboard');
  await page.getByRole('button', { name: /Pending Queue/ }).click();
  await expect(page.getByRole('heading', { name: /WFH & half-day requests/ })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Leave requests' })).toHaveCount(0);
});
