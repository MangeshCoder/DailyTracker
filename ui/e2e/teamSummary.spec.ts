// ─────────────────────────────────────────────────────────────────────────────
//  AI team summary (7 Oct 2026): Manager Dashboard → "AI Summary". A team lead
//  picks a period, generates the summary, sees the AI text with a clear label
//  and the per-person numbers; changing the period asks again.
// ─────────────────────────────────────────────────────────────────────────────
import { test, expect } from '@playwright/test';
import { FakeBackend } from './fakeBackend';

const summary = (days: number) => ({
  source: 'ai', from: '2026-09-10T00:00:00', to: '2026-09-16T00:00:00', days,
  overview: `A good ${days}-day stretch: payroll work moved forward.`,
  highlights: ['Priya finished the payroll screen.'],
  blockers: ['Priya is waiting for the bank API keys.'],
  needsAttention: ['Ravi has 2 worked days without an EOD report.'],
  people: [
    { userId: 3, name: 'Priya Dev', role: 'Developer', daysWorked: 5, workMinutes: 2430, tasksCompleted: 7, tasksBlocked: 1, eodsSubmitted: 5, eodsMissing: 0, lastMood: 'Stressed' },
    { userId: 4, name: 'Ravi Dev', role: 'Developer', daysWorked: 4, workMinutes: 1900, tasksCompleted: 3, tasksBlocked: 0, eodsSubmitted: 2, eodsMissing: 2, lastMood: null },
  ],
});

for (const viewport of [{ width: 1366, height: 1000 }, { width: 360, height: 780 }]) {
  test(`a team lead generates the AI team summary (${viewport.width}px)`, async ({ page }) => {
    await page.setViewportSize(viewport);
    const fake = new FakeBackend(page);
    fake.me = { ...fake.me, role: 'TeamLead' };
    const asked: number[] = [];
    fake.answer = (path) => {
      if (path === '/manager/users') return [];
      if (path === '/manager/team/daily') return { date: '2026-09-16', totalMembers: 0, checkedIn: 0, notCheckedIn: 0, members: [] };
      return undefined;
    };
    page.on('request', r => {
      const u = new URL(r.url());
      if (u.pathname.endsWith('/api/aichat/team-summary')) asked.push(+(u.searchParams.get('days') ?? 0));
    });
    await fake.install();
    // after install, so this answer wins over the fake backend's catch-all
    await page.route('**/api/aichat/team-summary**', route =>
      route.fulfill({ contentType: 'application/json', body: JSON.stringify(summary(+(new URL(route.request().url()).searchParams.get('days') ?? 7))) }));
    await fake.login();
    await fake.navigate('/manager');

    await page.getByRole('button', { name: 'AI Summary' }).click();
    await page.getByRole('button', { name: 'Generate summary' }).click();

    const result = page.getByTestId('team-summary');
    await expect(result.getByText('Written by AI')).toBeVisible();
    await expect(result.getByText('A good 7-day stretch: payroll work moved forward.')).toBeVisible();
    await expect(result.getByText('Priya is waiting for the bank API keys.')).toBeVisible();
    await expect(result.getByText('Ravi has 2 worked days without an EOD report.')).toBeVisible();
    const ravi = page.getByTestId('summary-person-4');
    await expect(ravi).toContainText('31h 40m');
    await expect(ravi).toContainText('2 missing');
    expect(asked).toEqual([7]);

    // a different period asks the server again
    await page.getByRole('button', { name: 'Last 14 days' }).click();
    await expect(result.getByText('A good 14-day stretch: payroll work moved forward.')).toBeVisible();
    expect(asked).toEqual([7, 14]);

    // nothing pokes out sideways on a phone (the table scrolls inside its card)
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);
  });
}
