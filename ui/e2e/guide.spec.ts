// ─────────────────────────────────────────────────────────────────────────────
//  The user guide (1 Oct 2026): the guide page shows the new English and
//  Marathi PDFs, and the PDF links really return PDFs (not the app page).
// ─────────────────────────────────────────────────────────────────────────────
import { test, expect } from '@playwright/test';
import { FakeBackend } from './fakeBackend';

test.use({ viewport: { width: 1366, height: 900 } });

test('the guide page offers both editions and the reader loads the current PDF', async ({ page, request }) => {
  const fake = new FakeBackend(page);
  await fake.install();
  await fake.login();
  await fake.navigate('/guide');

  await expect(page.getByRole('heading', { name: 'DailyTracker v2 User Guides' })).toBeVisible();
  await expect(page.getByText('19 pages · updated 1 Oct 2026')).toBeVisible();
  const src = await page.locator('iframe').getAttribute('src');
  expect(src).toMatch(/^\/DailyTracker_v2_Feature_Guide\.pdf\?v=\d{4}-\d{2}-\d{2}(\.\d+)?#/);

  for (const file of ['DailyTracker_v2_Feature_Guide.pdf', 'DailyTracker_v2_Feature_Guide_Marathi.pdf']) {
    const res = await request.get(`/${file}?v=2026-10-01&download=true`);
    expect(res.status()).toBe(200);
    expect((await res.body()).subarray(0, 5).toString()).toBe('%PDF-');
  }

  await page.getByRole('button', { name: 'View in Reader' }).click();   // switch to Marathi
  await expect(page.locator('iframe')).toHaveAttribute('src', /Marathi\.pdf\?v=/);
});
