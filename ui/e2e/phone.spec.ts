// ─────────────────────────────────────────────────────────────────────────────
//  Phone size & light/dark readability (found in the 30 Sep 2026 phone check):
//  cut-off summary cards, text invisible in dark mode, floating buttons covering
//  the end of the page / the login footer
// ─────────────────────────────────────────────────────────────────────────────
import { test, expect, type Page, type Locator } from '@playwright/test';
import { FakeBackend } from './fakeBackend';

test.use({ viewport: { width: 412, height: 839 }, isMobile: true, hasTouch: true });

const balance = [{
  userId: 1, userName: 'Mangesh Ghule', year: 2026,
  balances: [
    { leaveType: 'Casual', entitlement: 12, used: 0, pending: 0, remaining: 12, isUnlimited: false },
    { leaveType: 'Sick', entitlement: 7, used: 0, pending: 0, remaining: 7, isUnlimited: false },
  ],
}];

async function signIn(page: Page, theme: 'light' | 'dark', role = 'Developer') {
  await page.addInitScript(t => localStorage.setItem('theme', t), theme);
  const fake = new FakeBackend(page);
  fake.me = { ...fake.me, role };
  fake.answer = (path) => (path === '/leave/balance' ? balance : undefined);
  await fake.install();
  await fake.login();
  return fake;
}

/** WCAG contrast of an element's text against the page behind it (solid backgrounds only) */
const contrast = (el: Locator) => el.evaluate(node => {
  const rgb = (c: string) => (c.match(/[\d.]+/g) ?? []).map(Number);
  const lum = ([r, g, b]: number[]) => [r, g, b].map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; })
    .reduce((s, v, i) => s + v * [0.2126, 0.7152, 0.0722][i], 0);
  let bg = [255, 255, 255];
  for (let p: Element | null = node; p; p = p.parentElement) {
    const c = rgb(getComputedStyle(p).backgroundColor);
    if (c.length >= 3 && (c[3] ?? 1) > 0.5) { bg = c; break; }
  }
  const a = lum(rgb(getComputedStyle(node).color)), b = lum(bg);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
});

test('summary cards are not cut off on a phone', async ({ page }) => {
  const fake = await signIn(page, 'light');
  await fake.navigate('/leave');
  const title = page.getByText('Total Available', { exact: true });
  await expect(title).toBeVisible();
  // the whole title is shown (was "TOTAL AVA…")
  expect(await title.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);

  await fake.navigate('/notifications');
  const unread = page.getByText('Unread', { exact: true }).first();
  await expect(unread).toBeVisible();
  expect(await unread.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);   // was "U…"
});

test('leave-type names can be read in dark mode', async ({ page }) => {
  const fake = await signIn(page, 'dark');
  await fake.navigate('/leave');
  const casual = page.getByRole('heading', { name: 'Casual' });
  await expect(casual).toBeVisible();
  expect(await contrast(casual)).toBeGreaterThan(4.5);   // was dark text on a dark card (1.06)
});

test('the end of a page can be scrolled clear of the chat and AI Help buttons', async ({ page }) => {
  const fake = await signIn(page, 'light');
  await fake.navigate('/leave');
  await expect(page.getByText('Total Available', { exact: true })).toBeVisible();
  await page.locator('main').evaluate(m => m.scrollTo(0, m.scrollHeight));
  await page.waitForTimeout(300);
  const lastBottom = await page.locator('main').evaluate(m => {
    const kids = [...m.querySelectorAll('*')].filter(e => e.getBoundingClientRect().height > 0 && !e.children.length);
    return Math.max(...kids.map(e => e.getBoundingClientRect().bottom));
  });
  const aiTop = (await page.getByRole('button', { name: 'Open AI Assistant' }).boundingBox())!.y;
  const chatTop = (await page.getByRole('button', { name: /^Open chat/ }).boundingBox())!.y;
  expect(lastBottom).toBeLessThanOrEqual(Math.min(aiTop, chatTop));
});

test('AI Help is not on the sign-in pages — only after signing in', async ({ page }) => {
  const fake = new FakeBackend(page);
  await fake.install();
  for (const path of ['/login', '/register', '/forgot-password']) {
    await page.goto(path);
    await expect(page.locator('input[type=email]').first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Open AI Assistant' })).toHaveCount(0);
  }
  await fake.login();
  await expect(page.getByRole('button', { name: 'Open AI Assistant' })).toBeVisible();
});

test('team calendar: today and the day counts fit inside the day box on a phone', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-09-16T11:00:00+05:30'));
  const fake = await signIn(page, 'light');
  const member = (userId: number, fullName: string, status: string) => ({ userId, fullName, role: 'Developer', status, profilePhotoUrl: null, leaveType: null });
  const days = Array.from({ length: 30 }, (_, i) => {
    const d = new Date(2026, 8, i + 1), wd = d.getDay();
    return { date: `2026-09-${String(i + 1).padStart(2, '0')}`, weekday: '', isWeekend: wd === 0 || wd === 6, isHoliday: false, holidayName: null,
      isToday: i + 1 === 16, members: i + 1 === 16 ? [member(1, 'A', 'Present'), member(2, 'B', 'Present'), member(3, 'C', 'WFH'), member(4, 'D', 'Leave')] : [] };
  });
  const previous = fake.answer;
  fake.answer = (path, method) => (path === '/team-calendar' ? { month: 9, year: 2026, label: 'September 2026', days } : previous?.(path, method));
  await fake.navigate('/team/calendar');
  const today = page.getByTestId('calendar-today');
  await expect(today).toBeVisible();
  // nothing inside the box (date, counts) sticks out of it — "TODAY" used to hang over the next day
  const spill = await today.evaluate(cell => {
    const b = cell.getBoundingClientRect();
    return [...cell.querySelectorAll('*')].filter(e => e.getBoundingClientRect().width > 0)
      .map(e => e.getBoundingClientRect()).filter(r => r.left < b.left - 1 || r.right > b.right + 1).length;
  });
  expect(spill).toBe(0);
  // on phones the count is shown with its colour; the word is hidden (it didn't fit)
  await expect(today.getByTitle('2 In Office')).toBeVisible();
  await expect(today.getByText('In Office')).toBeHidden();
});

for (const theme of ['light', 'dark'] as const) {
  test(`"View full profile" in the directory is easy to read (${theme})`, async ({ page }) => {
    const fake = await signIn(page, theme);
    const people = [{ id: 7, fullName: 'Gatlu Ghule', email: 'g@test.dev', role: 'Developer', isActive: true, managerName: 'Mangesh Ghule' }];
    const previous = fake.answer;
    fake.answer = (path, method) => (path === '/profile/directory' ? people : previous?.(path, method));
    await fake.navigate('/team/directory');
    const link = page.getByText('View full profile').first();
    await expect(link).toBeVisible();
    expect(await contrast(link)).toBeGreaterThan(4.5);   // was faint grey (≈ 3, and unreadable in dark mode)
  });
}
