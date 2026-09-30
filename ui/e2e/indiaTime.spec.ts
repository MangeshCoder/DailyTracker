// ─────────────────────────────────────────────────────────────────────────────
//  India time (30 Sep 2026): the office runs on IST. A 10:14 AM check-in is
//  04:44 UTC on the server — the page must show 10:14 even on a laptop set to
//  another time zone, and whether or not the server wrote the trailing "Z".
// ─────────────────────────────────────────────────────────────────────────────
import { test, expect } from '@playwright/test';
import { FakeBackend } from './fakeBackend';

test.use({ viewport: { width: 1366, height: 900 }, timezoneId: 'Europe/London' });

for (const checkInTime of ['2026-09-30T04:44:00Z', '2026-09-30T04:44:00']) {
  test(`the dashboard shows the 10:14 AM check-in in India time (${checkInTime})`, async ({ page }) => {
    const fake = new FakeBackend(page);
    fake.answer = path => path === '/dashboard/today'
      ? { isCheckedIn: true, isCheckedOut: false, hasActiveBreak: false, netWorkHours: '0h 30m', tasksCompleted: 0, tasksInProgress: 0, totalSupportGiven: 0,
          todayLog: { id: 1, logDate: '2026-09-30T00:00:00', checkInTime, checkOutTime: null, dayStatus: 'Present', breakLogs: [], taskLogs: [] } }
      : undefined;
    await fake.install();
    await fake.login();
    await expect(page.getByText('Working since 10:14 am', { exact: false })).toBeVisible();
    await expect(page.getByText(/04:44|05:44/)).toHaveCount(0);
  });
}
