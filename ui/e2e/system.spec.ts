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
let restoreCalls: string[] = [];
const RESTORED = { message: 'Restore complete.', tables: 53, rows: 67, safetyBackupId: 4, backupCreatedAt: hoursAgo(2) };

test.beforeEach(async ({ page }) => {
  restoreCalls = [];
  fake = new FakeBackend(page);
  fake.me = { ...fake.me, role: 'Manager' };
  fake.answer = (path, method) => {
    if (path === '/monitoring/summary')
      return { errors24h: 1, slow24h: 1, lastErrorAt: ERRORS[0].occurredAt, lastBackup: { id: 3, startedAt: BACKUPS[0].startedAt, sizeBytes: 482_000, rowCount: 1234 }, nextBackupDue: hoursAgo(-24 * 6) };
    if (path === '/monitoring/errors' && method === 'GET') return { items: ERRORS, hasMore: false };
    if (path === '/monitoring/backups' && method === 'GET') return BACKUPS;
    if (method === 'POST' && (path === '/monitoring/backups/3/restore' || path === '/monitoring/restore')) {
      restoreCalls.push(path);
      return RESTORED;
    }
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

test('restoring a backup needs RESTORE typed, then reports what came back and reloads', async ({ page }) => {
  await fake.navigate('/manager/system');
  await page.getByRole('button', { name: 'Backups' }).click();
  await expect(page.getByRole('button', { name: 'Restore', exact: true })).toHaveCount(1);   // only for good backups

  await page.getByRole('button', { name: 'Restore', exact: true }).click();
  await expect(page.getByText('Restore this backup?')).toBeVisible();
  await expect(page.getByText(/Before restore" copy of the current data is saved first/)).toBeVisible();

  // a wrong word is refused, nothing is sent
  await page.getByPlaceholder('Type RESTORE to confirm').fill('restore');
  await page.getByRole('button', { name: 'Restore', exact: true }).last().click();
  await expect(page.getByText('Type RESTORE (capital letters) to confirm')).toBeVisible();
  expect(restoreCalls).toHaveLength(0);

  await page.getByPlaceholder('Type RESTORE to confirm').fill('RESTORE');
  await page.getByRole('button', { name: 'Restore', exact: true }).last().click();

  await expect(page.getByText('Restore complete')).toBeVisible();
  await expect(page.getByText(/Restored 67 rows in 53 tables/)).toBeVisible();
  expect(restoreCalls).toEqual(['/monitoring/backups/3/restore']);
  await expect(page.getByText('Restoring the database…')).toHaveCount(0);
  await page.waitForTimeout(400);   // dialog animation
  await page.screenshot({ path: 'test-results/system-restored.png' });

  const reloaded = page.waitForEvent('load');
  await page.getByRole('button', { name: 'OK' }).click();
  await reloaded;
});

test('a backup file from the PC can be restored', async ({ page }) => {
  await fake.navigate('/manager/system');
  await page.getByRole('button', { name: 'Backups' }).click();

  await page.getByTestId('restore-file').setInputFiles({
    name: 'dailytracker-backup-2026-09-30.json.gz', mimeType: 'application/gzip', buffer: Buffer.from([0x1f, 0x8b, 0x08, 0x00]),
  });
  await expect(page.getByText(/the backup file "dailytracker-backup-2026-09-30.json.gz"/)).toBeVisible();
  await page.waitForTimeout(400);   // dialog animation
  await page.screenshot({ path: 'test-results/system-restore-confirm.png' });
  await page.getByPlaceholder('Type RESTORE to confirm').fill('RESTORE');
  await page.getByRole('button', { name: 'Restore', exact: true }).last().click();

  await expect(page.getByText('Restore complete')).toBeVisible();
  expect(restoreCalls).toEqual(['/monitoring/restore']);
});
