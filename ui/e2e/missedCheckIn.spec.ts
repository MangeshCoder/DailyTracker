// ─────────────────────────────────────────────────────────────────────────────
//  Missed check-in (2 Oct 2026): tap a red (absent) day on My Report, send the
//  times; a team lead approves it on Employee Requests.
// ─────────────────────────────────────────────────────────────────────────────
import { test, expect, type Page } from '@playwright/test';
import { FakeBackend } from './fakeBackend';

test.use({ viewport: { width: 1366, height: 1000 } });

const sent = (page: Page, path: string, method: string) => {
  const bodies: unknown[] = [];
  page.on('request', r => { if (r.method() === method && new URL(r.url()).pathname.endsWith(`/api${path}`)) bodies.push(r.postDataJSON()); });
  return bodies;
};

// the browser's clock is set to Wed 16 Sep 2026, so "yesterday" (Tue 15) is in the month My Report shows
const NOW = new Date('2026-09-16T11:00:00+05:30');
const pastWeekday = () => new Date(2026, 8, 15);
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

test('an employee taps an absent day and sends the times for approval', async ({ page }) => {
  const day = pastWeekday();
  const fake = new FakeBackend(page);
  const mine: unknown[] = [];
  fake.answer = (path, method) => {
    if (path === '/report/my/calendar') return [{ date: `${iso(day)}T00:00:00`, status: 'Absent', workHours: '0h 0m', tasksCompleted: 0 }];
    if (path === '/missed-checkin/mine') return mine;
    if (path === '/report/my') return { user: fake.me, fromDate: '', toDate: '', totalWorkingDays: 0, daysPresent: 0, attendancePercentage: 0,
      totalWorkMinutes: 0, totalWorkHours: '0h 0m', averageDailyHours: 0, totalTasksCompleted: 0, totalTasksLogged: 0, totalSupportGiven: 0, dailyEntries: [] };
    if (path === '/missed-checkin' && method === 'POST') {
      mine.push({ id: 1, userId: 1, userName: 'Me', date: `${iso(day)}T00:00:00`, checkIn: `${iso(day)}T04:15:00Z`, checkOut: `${iso(day)}T13:00:00Z`,
        workMode: 'WFH', reason: 'Phone battery died', status: 'Pending', createdAt: new Date().toISOString(), isOwn: true });
      return mine[0];
    }
    return undefined;
  };
  const posted = sent(page, '/missed-checkin', 'POST');
  await page.clock.setFixedTime(NOW);
  await fake.install();
  await fake.login();
  await fake.navigate(`/my-report`);

  await page.getByRole('button', { name: /absent — ask to add this day/ }).click();
  const card = page.getByTestId('missed-checkin-card');
  await card.getByLabel('Checked in').fill('09:45');
  await card.getByRole('radio', { name: 'Work from home' }).click();
  await card.getByLabel('Why couldn’t you check in?').fill('Phone battery died');
  await card.getByRole('button', { name: 'Send for approval' }).click();

  await expect(page.getByText('Sent to your team lead / manager for approval.')).toBeVisible();
  await expect.poll(() => posted).toEqual([{ date: iso(day), checkIn: '09:45', checkOut: '18:30', workMode: 'WFH', reason: 'Phone battery died' }]);
  await expect(card.getByText('Pending')).toBeVisible();
});

test('a team lead approves a missed check-in on Employee Requests', async ({ page }) => {
  const fake = new FakeBackend(page);
  fake.me = { ...fake.me, role: 'TeamLead' };
  let pending = [{ id: 7, userId: 3, userName: 'Priya', date: '2026-09-29T00:00:00', checkIn: '2026-09-29T04:00:00Z', checkOut: '2026-09-29T13:00:00Z',
    workMode: 'Office', reason: 'Phone battery died', status: 'Pending', createdAt: new Date().toISOString(), isOwn: false }];
  fake.answer = (path, method) => {
    if (path === '/missed-checkin/pending') return pending;
    if (path === '/missed-checkin/7/review' && method === 'PUT') { pending = []; return { id: 7, status: 'Approved' }; }
    if (path === '/wfh-requests/team-status')
      return { date: '', dateLabel: '', totalMembers: 0, presentCount: 0, wfhCount: 0, halfDayCount: 0,
               notCheckedInCount: 0, onLeaveCount: 0, pendingRequestsCount: 0, members: [] };
    return undefined;
  };
  const reviews = sent(page, '/missed-checkin/7/review', 'PUT');
  await fake.install();
  await fake.login();
  await fake.navigate('/manager/wfh-dashboard');
  await page.getByRole('button', { name: /Pending Queue/ }).click();

  const card = page.getByTestId('missed-7');
  await expect(card.getByText('Priya')).toBeVisible();
  await expect(card.getByText('09:30 am')).toBeVisible();                 // shown in India time
  await expect(card.getByText('9h 0m')).toBeVisible();
  await card.getByRole('button', { name: 'Approve' }).click();

  await expect(page.getByText('Day added to their attendance')).toBeVisible();
  await expect.poll(() => reviews).toEqual([{ status: 'Approved' }]);
  await expect(page.getByText('No missed check-ins waiting.')).toBeVisible();
});
