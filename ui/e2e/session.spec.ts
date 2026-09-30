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
