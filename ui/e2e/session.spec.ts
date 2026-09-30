// ─────────────────────────────────────────────────────────────────────────────
//  Signing in: staying signed in after a reload, accounts waiting for approval,
//  and what a Team Lead's menu shows (found in the 30 Sep 2026 audit)
// ─────────────────────────────────────────────────────────────────────────────
import { test, expect } from '@playwright/test';
import { FakeBackend } from './fakeBackend';

test('refreshing the page keeps you signed in (the login cookie is still valid)', async ({ page }) => {
  const fake = new FakeBackend(page);
  fake.me = { ...fake.me, role: 'Developer' };
  await fake.install();
  await fake.login();
  await fake.navigate('/kudos');
  await expect(page).toHaveURL(/\/kudos$/);

  await page.reload();

  await expect(page).toHaveURL(/\/kudos$/);                       // was: thrown back to /login
  await expect(page.getByRole('heading', { name: /Kudos/i }).first()).toBeVisible();
});

test('opening the site without being signed in goes to the login page (no loop)', async ({ page }) => {
  const fake = new FakeBackend(page);
  await fake.install();
  await page.goto('/tasks');
  await expect(page).toHaveURL(/\/login$/);
  await page.waitForTimeout(1500);
  await expect(page).toHaveURL(/\/login$/);                       // stays put, doesn't keep reloading
});

test('an account waiting for approval sees a waiting screen, not the app', async ({ page }) => {
  const fake = new FakeBackend(page);
  fake.me = { ...fake.me, role: 'Pending' };
  await fake.install();
  await page.goto('/login');
  await page.fill('input[type=email]', fake.me.email);
  await page.fill('input[type=password]', 'secret123');
  await page.locator('button[type=submit]').last().click();

  await expect(page.getByRole('heading', { name: 'Waiting for approval' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible();
  await expect(page.getByText('Dashboard')).toHaveCount(0);
});

test("a team lead's manager menu has no Assign Roles or EOD Reviews (manager-only pages)", async ({ page }) => {
  const fake = new FakeBackend(page);
  fake.me = { ...fake.me, role: 'TeamLead' };
  await fake.install();
  await fake.login();
  await page.getByRole('button', { name: /Manager/ }).first().click();

  await expect(page.getByRole('link', { name: /Team Dashboard/ }).first()).toBeVisible();
  await expect(page.getByRole('link', { name: /Assign Roles/ })).toHaveCount(0);
  await expect(page.getByRole('link', { name: /EOD Reviews/ })).toHaveCount(0);

  await fake.navigate('/manager/assign-role');
  await expect(page).toHaveURL(/\/manager$/);
});

// ── How long a sign-in lasts (30 Sep 2026) ──────────────────────────────────

test('"Trust this device" starts unticked on the login page', async ({ page }) => {
  const fake = new FakeBackend(page);
  await fake.install();
  await page.goto('/login');
  await expect(page.getByRole('checkbox', { name: /Trust this device/ })).not.toBeChecked();
});

test('a computer left alone for 30 minutes is signed out (not a trusted device)', async ({ page }) => {
  await page.clock.install();
  const fake = new FakeBackend(page);
  await fake.install();
  await fake.login();                                            // box left unticked
  await page.clock.fastForward('29:00');
  await expect(page).toHaveURL(/\/$/);                           // still signed in before the limit
  await page.clock.fastForward('02:00');
  await expect(page).toHaveURL(/\/login\?reason=idle$/);
  await page.clock.resume();                                     // let the login page load normally
  await expect(page.getByText(/signed out after 30 minutes without activity/)).toBeVisible();
});

test('activity keeps you signed in', async ({ page }) => {
  await page.clock.install();
  const fake = new FakeBackend(page);
  await fake.install();
  await fake.login();
  for (let i = 0; i < 4; i++) {                                  // 60 minutes, busy every 15
    await page.clock.fastForward('15:00');
    await page.mouse.move(100 + i * 10, 200);
  }
  await page.clock.fastForward('01:00');
  await expect(page).toHaveURL(/\/$/);
});

test('a trusted device is not signed out when idle', async ({ page }) => {
  await page.clock.install();
  const fake = new FakeBackend(page);
  await fake.install();
  await page.goto('/login');
  await page.fill('input[type=email]', fake.me.email);
  await page.fill('input[type=password]', 'secret123');
  await page.getByRole('checkbox', { name: /Trust this device/ }).check();
  await page.locator('button[type=submit]').last().click();
  await page.waitForURL(url => url.pathname === '/');
  await page.clock.fastForward('45:00');
  await expect(page).toHaveURL(/\/$/);
});
