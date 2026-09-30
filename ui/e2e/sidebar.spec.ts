// ─────────────────────────────────────────────────────────────────────────────
//  Sidebar pop-out menus (collapsed sidebar) and the notification card:
//  both must be drawn on top of the page, not clipped inside the sidebar
// ─────────────────────────────────────────────────────────────────────────────
import { test, expect } from '@playwright/test';
import { FakeBackend } from './fakeBackend';

test.use({ viewport: { width: 1600, height: 900 } });

const notifications = [
  { id: 1, title: 'Set Your Daily Goal', message: 'Start your day with a clear focus', type: 'Reminder', isRead: false, createdAt: new Date().toISOString() },
];

async function signIn(page: import('@playwright/test').Page) {
  const fake = new FakeBackend(page);
  fake.me = { ...fake.me, role: 'Manager' };
  fake.answer = (path) => {
    if (path === '/notifications') return notifications;
    if (path === '/notifications/count') return { count: 1 };
    return undefined;
  };
  await fake.install();
  await fake.login();
  return fake;
}

test('collapsed sidebar: each section icon opens its menu beside the sidebar and links work', async ({ page }) => {
  await signIn(page);
  await page.getByTitle('Collapse Sidebar').click();

  for (const [section, link] of [['General', 'Kudos'], ['Work Management', 'Tasks'], ['HR & Requests', 'Leave'], ['System & Docs', 'Security & 2FA'], ['Manager', 'Team Dashboard']]) {
    await page.getByTitle(section, { exact: true }).click();
    const item = page.getByRole('link', { name: new RegExp(`${link.replace(/[&]/g, '\\$&')}$`) });
    await expect(item).toBeVisible();
    // really visible on screen: to the right of the sidebar and not covered by anything
    const box = (await item.boundingBox())!;
    const aside = (await page.locator('aside').boundingBox())!;
    expect(box.x).toBeGreaterThan(aside.x + aside.width - 1);
    const onTop = await item.evaluate(el => {
      const r = el.getBoundingClientRect();
      return el.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
    });
    expect(onTop).toBe(true);
  }

  // clicking a link in the pop-out navigates and closes it
  await page.getByTitle('General', { exact: true }).click();
  await page.getByRole('link', { name: /Kudos$/ }).click();
  await expect(page).toHaveURL(/\/kudos$/);
  await expect(page.getByRole('link', { name: /Analytics$/ })).toHaveCount(0);
});

test('notification card opens in the middle of the screen', async ({ page }) => {
  await signIn(page);
  await page.locator('aside').getByRole('button', { name: 'Notifications' }).click();

  const card = page.getByRole('dialog', { name: 'Notifications' });
  await expect(card.getByText('Set Your Daily Goal')).toBeVisible();
  const b = (await card.boundingBox())!;
  const vp = page.viewportSize()!;
  expect(Math.abs(b.x + b.width / 2 - vp.width / 2)).toBeLessThan(4);
  expect(Math.abs(b.y + b.height / 2 - vp.height / 2)).toBeLessThan(4);

  // clicking inside the card keeps it open; clicking outside closes it
  await card.getByText('Set Your Daily Goal').click();
  await expect(card).toBeVisible();
  await page.mouse.click(20, vp.height / 2);
  await expect(card).toHaveCount(0);
});
