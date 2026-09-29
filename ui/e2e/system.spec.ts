// ─────────────────────────────────────────────────────────────────────────────
//  Managers' System page (error log + backups) against the fake backend
// ─────────────────────────────────────────────────────────────────────────────
import { test, expect } from '@playwright/test';
import { FakeBackend } from './fakeBackend';

const hoursAgo = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString().replace('Z', '');   // like the API: UTC, no "Z"

const ERRORS = [
  {
    id: 2, occurredAt: hoursAgo(1), kind: 'Error', method: 'POST', path: '/api/leave', statusCode: 500, durationMs: 180,
    userId: 2, userName: 'Prasad Gade', message: 'Npgsql.PostgresException: 23505 duplicate key', traceId: 't-2',
    details: 'Npgsql.PostgresException (0x80004005): 23505: duplicate key value violates unique constraint\n   at DailyTrackerAPI.Services.HR.LeaveService.ApplyAsync()',
  },
  {
    id: 1, occurredAt: hoursAgo(3), kind: 'Slow', method: 'GET', path: '/api/manager/team-monthly?month=9&year=2026',
    statusCode: 200, durationMs: 3400, userId: 1, userName: 'Mangesh Ghule', message: 'Took 3.4 s', details: null, traceId: 't-1',
  },
];
const BACKUPS = [
  { id: 3, startedAt: hoursAgo(2), finishedAt: hoursAgo(2), trigger: 'Manual', status: 'Succeeded', sizeBytes: 482_000, tableCount: 58, rowCount: 1234, error: null, requestedBy: 'Mangesh Ghule', canDownload: true },
  { id: 2, startedAt: hoursAgo(30), finishedAt: hoursAgo(30), trigger: 'Weekly', status: 'Failed', sizeBytes: 0, tableCount: 0, rowCount: 0, error: 'Storage:S3:Bucket is not set.', requestedBy: null, canDownload: false },
];

let fake: FakeBackend;

test.beforeEach(async ({ page }) => {
  fake = new FakeBackend(page);
  fake.me = { ...fake.me, role: 'Manager' };
  fake.answer = (path, method) => {
    if (path === '/monitoring/summary')
      return { errors24h: 1, slow24h: 1, lastErrorAt: ERRORS[0].occurredAt, lastBackup: { id: 3, startedAt: BACKUPS[0].startedAt, sizeBytes: 482_000, rowCount: 1234 }, nextBackupDue: hoursAgo(-24 * 6) };
    if (path === '/monitoring/errors' && method === 'GET') return { items: ERRORS, hasMore: false };
    if (path === '/monitoring/backups' && method === 'GET') return BACKUPS;
    return undefined;
  };
  await fake.install();
  await fake.login();
});

test('a manager finds errors and slow pages with who, when and the details to copy', async ({ page }) => {
  await page.getByRole('button', { name: /Manager/ }).first().click();          // open the Manager menu
  await page.getByRole('link', { name: /System$/ }).first().click();
  await expect(page).toHaveURL(/\/manager\/system$/);

  await expect(page.getByText('Npgsql.PostgresException: 23505 duplicate key')).toBeVisible();
  await expect(page.getByText(/Prasad Gade/).first()).toBeVisible();
  await expect(page.getByText('Error 500')).toBeVisible();
  await expect(page.getByText('Took 3.4 s')).toBeVisible();

  await page.getByText('Npgsql.PostgresException: 23505 duplicate key').click();
  await expect(page.getByText(/at DailyTrackerAPI\.Services\.HR\.LeaveService/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Copy details' })).toBeVisible();
  await page.screenshot({ path: 'test-results/system-errors.png', fullPage: true });
});

test('the backups tab shows good and failed backups; only good ones can be downloaded', async ({ page }) => {
  await fake.navigate('/manager/system');
  await page.getByRole('button', { name: 'Backups' }).click();

  await expect(page.getByText('Succeeded')).toBeVisible();
  await expect(page.getByText('471 KB · 58 tables · 1,234 rows')).toBeVisible();
  await expect(page.getByText('Storage:S3:Bucket is not set.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Download' })).toHaveCount(1);
  await page.screenshot({ path: 'test-results/system-backups.png', fullPage: true });
});

test('team leads do not get the System page', async ({ page }) => {
  await page.context().clearCookies();
  const lead = new FakeBackend(page);
  lead.me = { ...lead.me, role: 'TeamLead' };
  await page.unrouteAll({ behavior: 'ignoreErrors' });
  await lead.install();
  await lead.login();

  await page.getByRole('button', { name: /Manager/ }).first().click();
  await expect(page.getByRole('link', { name: /Team Dashboard/ }).first()).toBeVisible();
  await expect(page.getByRole('link', { name: /System$/ })).toHaveCount(0);
  await lead.navigate('/manager/system');
  await expect(page).toHaveURL(/\/manager$/);
});
