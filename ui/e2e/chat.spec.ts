// ─────────────────────────────────────────────────────────────────────────────
//  Chat in a real browser against a fake backend (see fakeBackend.ts).
//  Each test is a bug we've fixed before — CI goes red if one comes back.
// ─────────────────────────────────────────────────────────────────────────────
import { test, expect } from '@playwright/test';
import { FakeBackend, bubbles, expectNoEmptyState } from './fakeBackend';

let fake: FakeBackend;

test.beforeEach(async ({ page }) => {
  fake = new FakeBackend(page);
  await fake.install();
  await fake.login();
});

test('opening a chat shows the latest messages, one page only; scrolling up loads older ones in place', async ({ page }) => {
  await fake.navigate('/chat?c=10');

  await expect(bubbles(page, 'main', 'Shipped the release notes')).toBeVisible();
  await expect(bubbles(page)).toHaveCount(50);
  await page.waitForTimeout(800);
  // no "load the whole history" cascade just from opening the chat
  expect(fake.historyRequestsFor(10).filter(r => r.before !== null)).toHaveLength(0);

  // scroll to the top → the previous page is added and the reader stays where they were
  const firstVisible = bubbles(page).first();
  const firstId = await firstVisible.getAttribute('id');
  await page.locator('main [id^="msg-"]').first().scrollIntoViewIfNeeded();
  await page.evaluate(() => {
    const list = document.querySelector('main [id^="msg-"]')?.closest('[class*="overflow-y"]');
    if (list) list.scrollTop = 0;
  });
  await expect(bubbles(page)).toHaveCount(100);
  expect(fake.historyRequestsFor(10).filter(r => r.before !== null)).toHaveLength(1);
  await expect(page.locator(`#${firstId}`)).toBeInViewport();
});

test('a message that arrives while history is still loading is shown and kept', async ({ page }) => {
  fake.messages.delayMs = 2_500;
  await fake.navigate('/chat?c=11');

  await expect(page.getByText('Loading messages…')).toBeVisible();
  await expectNoEmptyState(page);

  await fake.receive(11, 6, 'sent during loading');
  await expect(bubbles(page, 'main', 'sent during loading')).toBeVisible();

  // the (older) history answer arrives — it must not wipe the live message
  await expect(bubbles(page, 'main', 'Can you approve my leave?')).toBeVisible({ timeout: 6_000 });
  await expect(bubbles(page, 'main', 'sent during loading')).toBeVisible();
  await expect(bubbles(page)).toHaveCount(2);
});

test('history retries by itself after a network blip', async ({ page }) => {
  fake.messages.failNext = 2;
  await fake.navigate('/chat?c=10');

  await expect(bubbles(page, 'main', 'Shipped the release notes')).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText("Couldn't load earlier messages")).toHaveCount(0);
  expect(fake.messages.failNext).toBe(0);                    // both failures really happened
});

test('when the server is down, an error with Retry is shown (never "No messages yet")', async ({ page }) => {
  fake.messages.down = true;
  await fake.navigate('/chat?c=10');

  await expect(page.getByText("Couldn't load earlier messages")).toBeVisible({ timeout: 12_000 });
  await expectNoEmptyState(page);

  fake.messages.down = false;
  await page.getByRole('button', { name: 'Retry' }).click();
  await expect(bubbles(page, 'main', 'Shipped the release notes')).toBeVisible();
  await expect(page.getByText("Couldn't load earlier messages")).toHaveCount(0);
});

test('a sent message shows up exactly once', async ({ page }) => {
  await fake.navigate('/chat?c=11');
  await expect(bubbles(page, 'main', 'Can you approve my leave?')).toBeVisible();

  await page.locator('main textarea').fill('Approved, enjoy!');
  await page.keyboard.press('Enter');

  await expect(bubbles(page, 'main', 'Approved, enjoy!')).toHaveCount(1);
  await page.waitForTimeout(500);                           // after the server's live echo too
  await expect(bubbles(page, 'main', 'Approved, enjoy!')).toHaveCount(1);
  expect(fake.sent).toEqual([expect.objectContaining({ conversationId: 11, content: 'Approved, enjoy!' })]);
});

test('unread badge: counts messages from others, not my own, and clears when I read the chat', async ({ page }) => {
  const bubble = page.getByRole('button', { name: /^Open chat/ });
  await expect(bubble).toHaveAccessibleName('Open chat, 1 unread');

  await fake.receive(10, 5, 'new from Priya');
  await expect(bubble).toHaveAccessibleName('Open chat, 2 unread');

  // my own message (e.g. sent from my phone) doesn't count
  await fake.push('ReceiveMessage', fake.message(10, 1, 'from my other device'));
  await page.waitForTimeout(400);
  await expect(bubble).toHaveAccessibleName('Open chat, 2 unread');

  await bubble.click();
  await page.getByRole('dialog').getByRole('button', { name: /Rahul Verma/ }).click();
  await expect(bubbles(page, '[role=dialog]', 'Can you approve my leave?')).toBeVisible();
  await expect.poll(() => fake.readCalls).toContain(11);
});

test('reopening a chat is instant and includes messages that came in while it was closed', async ({ page }) => {
  const dialog = page.getByRole('dialog');
  await page.getByRole('button', { name: /^Open chat/ }).click();
  await dialog.getByRole('button', { name: /Rahul Verma/ }).click();
  await expect(bubbles(page, '[role=dialog]', 'Can you approve my leave?')).toBeVisible();
  await page.keyboard.press('Escape');

  await fake.receive(11, 6, 'one more thing');
  fake.messages.delayMs = 3_000;                            // a slow server must not matter now

  await page.getByRole('button', { name: /^Open chat/ }).click();
  await dialog.getByRole('button', { name: /Rahul Verma/ }).click();
  await expect(bubbles(page, '[role=dialog]', 'one more thing')).toBeVisible({ timeout: 1_000 });
  await expect(bubbles(page, '[role=dialog]', 'Can you approve my leave?')).toBeVisible({ timeout: 1_000 });
  await expect(page.getByText('Loading messages…')).toHaveCount(0);
});
