// ─────────────────────────────────────────────────────────────────────────────
//  EOD "Auto-Generate Draft" (4 Oct 2026): the server asks Gemini to write the
//  report from today's tasks; without AI it fills the fixed template. The page
//  fills the form and says which one it was, so people know to read it first.
// ─────────────────────────────────────────────────────────────────────────────
import { test, expect } from '@playwright/test';
import { FakeBackend } from './fakeBackend';

test.use({ viewport: { width: 1366, height: 1000 } });

for (const source of ['ai', 'template'] as const) {
  test(`Auto-Generate Draft fills the form and says how it was written (${source})`, async ({ page }) => {
    const fake = new FakeBackend(page);
    fake.answer = (path) => path === '/eod/today' ? null          // nothing submitted yet (the server sends no body)
      : path === '/aichat/eod-draft'
      ? { success: true, source, draft: {
          whatWasDone: '• I fixed the password reset link on the login page.',
          blockers: '• Bank API work is blocked.',
          planForTomorrow: '• Finish the payroll export.',
          learnings: '',
          moodRating: 'Great' } }
      : undefined;
    await fake.install();
    await fake.login();
    await fake.navigate('/eod-reports');

    await page.getByRole('button', { name: 'Auto-Generate Draft' }).click();

    await expect(page.getByPlaceholder(/Key features deployed/)).toHaveValue('• I fixed the password reset link on the login page.');
    await expect(page.getByPlaceholder(/Dependencies on other teams/)).toHaveValue('• Bank API work is blocked.');
    await expect(page.getByPlaceholder(/Top 3 priorities/)).toHaveValue('• Finish the payroll export.');
    await expect(page.getByText(source === 'ai'
      ? '✨ Drafted with AI from today’s tasks — read it and edit before submitting.'
      : 'Filled in from today’s tasks — edit it before submitting.')).toBeVisible();
  });
}
