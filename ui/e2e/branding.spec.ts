// ─────────────────────────────────────────────────────────────────────────────
//  New look (Oct 2026): Montcrest Software logo on the sign-in page and in the
//  sidebar, Montcrest app / browser icons, and the sidebar's menu search.
// ─────────────────────────────────────────────────────────────────────────────
import { test, expect } from '@playwright/test';
import { FakeBackend } from './fakeBackend';

test.use({ viewport: { width: 1440, height: 900 } });

const loaded = (img: import('@playwright/test').Locator) =>
  img.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0);

test('the Montcrest logo is on the sign-in page and in the sidebar', async ({ page }) => {
  const fake = new FakeBackend(page);
  await fake.install();
  await page.goto('/login');
  const logo = page.locator('img[src="/brand/montcrest-logo.png"]');
  await expect(logo).toBeVisible();
  expect(await loaded(logo)).toBe(true);

  await fake.login();
  const mark = page.locator('aside img[src="/brand/montcrest-mark.png"]');
  await expect(mark).toBeVisible();
  expect(await loaded(mark)).toBe(true);
  await expect(page.locator('aside').getByText('Montcrest Software')).toBeVisible();
});

test('browser and app icons are the Montcrest ones', async ({ request }) => {
  for (const file of ['/favicon.svg', '/favicon.ico', '/icons/icon-192.png', '/icons/icon-512.png',
                      '/icons/icon-maskable-512.png', '/icons/apple-touch-icon.png', '/brand/montcrest-logo.png']) {
    const res = await request.get(file);
    expect(res.status(), file).toBe(200);
  }
  expect(await (await request.get('/favicon.svg')).text()).toContain('data:image/png;base64');
});

test('menu search lists matching pages from every section and opens them', async ({ page }) => {
  const fake = new FakeBackend(page);
  fake.me = { ...fake.me, role: 'Manager' };
  await fake.install();
  await fake.login();

  const search = page.locator('aside').getByPlaceholder('Search for…');
  await search.fill('face');
  const hits = page.locator('aside nav').getByRole('link');
  await expect(hits).toHaveCount(2);                       // General → Face Setup and Manager → Face Setup
  await expect(hits.filter({ hasText: 'Manager' })).toHaveCount(1);   // each hit names its section

  await search.fill('zzz');
  await expect(page.locator('aside nav').getByText('No page matches').first()).toBeVisible();

  await search.fill('payroll');
  await page.locator('aside nav').getByRole('link', { name: /Payroll/ }).click();
  await expect(page).toHaveURL(/\/payroll$/);
});

test('each person can switch between the three colour designs and it is remembered', async ({ page }) => {
  const fake = new FakeBackend(page);
  await fake.install();
  await fake.login();
  const primary = () => page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--c-blue-600').trim());
  const html = page.locator('html');

  await expect(html).toHaveAttribute('data-design', 'montcrest');          // default
  expect(await primary()).toBe('179 95 0');                                // Montcrest amber button shade

  await page.getByTitle('Account & Documentation Menu').click();
  await page.getByRole('button', { name: 'Dashdark Purple', exact: true }).click();
  await expect(html).toHaveAttribute('data-design', 'purple');
  expect(await primary()).toBe('154 27 214');

  await page.getByRole('button', { name: 'Original Blue', exact: true }).click();
  await expect(html).toHaveAttribute('data-design', 'blue');
  expect(await primary()).toBe('37 99 235');                               // Tailwind blue-600
  await expect(page.getByRole('button', { name: 'Original Blue', exact: true })).toHaveAttribute('aria-pressed', 'true');

  await page.reload();
  await expect(html).toHaveAttribute('data-design', 'blue');               // still blue after a reload
  expect(await primary()).toBe('37 99 235');
});
