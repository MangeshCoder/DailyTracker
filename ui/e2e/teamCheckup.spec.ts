// ─────────────────────────────────────────────────────────────────────────────
//  Team check-up (8 Oct 2026): Manager Dashboard → User Management lists who
//  reports to nobody / someone who left / someone who can't approve, and the
//  developers straight under a manager while team leads exist. Each is fixed
//  in place; the "worth a check" group can be marked correct.
// ─────────────────────────────────────────────────────────────────────────────
import { test, expect, type Page } from '@playwright/test';
import { FakeBackend, ME } from './fakeBackend';

const person = (id: number, fullName: string, role: string, managerId: number | null, isActive = true) =>
  ({ id, fullName, email: `${fullName.split(' ')[0].toLowerCase()}@test.dev`, role, isActive, managerId });

const company = () => [
  person(ME.id, ME.fullName, 'Manager', null),
  person(2, 'Sneha Patil', 'TeamLead', ME.id),
  person(3, 'Old Lead', 'TeamLead', ME.id, false),        // has left
  person(4, 'Amit Joshi', 'Developer', null),             // nobody
  person(5, 'Rahul Deshmukh', 'Developer', 3),            // reports to someone who left
  person(6, 'Priya Sharma', 'Developer', 7),              // reports to a developer
  person(7, 'Kiran Rao', 'Developer', 2),                 // fine
  person(8, 'Anjali Kulkarni', 'Developer', ME.id),       // straight under the manager
  person(9, 'Neha Shah', 'TeamLead', null),               // a team lead with nobody
];

async function open(page: Page, users: ReturnType<typeof company>) {
  const fake = new FakeBackend(page);
  fake.me = { ...fake.me, role: 'Manager' };
  const sent: { path: string; body: unknown }[] = [];
  fake.answer = (path, method) => {
    if (path === '/manager/users') return users;
    if (path === '/manager/team/daily') return { date: '2026-10-08', totalMembers: 0, checkedIn: 0, notCheckedIn: 0, members: [] };
    const m = path.match(/^\/auth\/users\/(\d+)\/reports-to$/);
    if (m && method === 'PUT') return { userId: +m[1], managerId: 2, managerName: 'Sneha Patil' };
    return undefined;
  };
  page.on('request', r => { if (r.method() === 'PUT' && r.url().includes('/reports-to')) sent.push({ path: new URL(r.url()).pathname, body: r.postDataJSON() }); });
  await fake.install();
  await fake.login();
  await fake.navigate('/manager');
  await page.getByRole('button', { name: 'User Management' }).click();
  return { fake, sent };
}

test('the check-up lists who needs fixing and fixes them in place', async ({ page }) => {
  const { sent } = await open(page, company());
  const checkup = page.getByRole('region', { name: 'Team check-up' });

  await expect(checkup.getByText('Needs fixing · 4')).toBeVisible();
  await expect(checkup.getByText('Reports to nobody yet, so their requests go to every manager.')).toHaveCount(2);   // Amit, Neha
  await expect(checkup.getByText('Reports to Old Lead, who has left.')).toBeVisible();
  await expect(checkup.getByText("Reports to Kiran Rao, a Developer, who can't approve requests.")).toBeVisible();
  await expect(checkup.getByText('Worth a check · 1')).toBeVisible();
  await expect(checkup.getByText(`Reports straight to ${ME.fullName} (Manager).`)).toBeVisible();
  await expect(checkup.getByText('Kiran Rao ·')).toHaveCount(0);                                                   // Kiran is fine

  // the list only offers active Managers and Team Leads
  await checkup.getByRole('combobox', { name: 'Who should Amit Joshi report to?' }).click();
  await expect(page.getByRole('option', { name: /Old Lead/ })).toHaveCount(0);
  await expect(page.getByRole('option', { name: /Kiran Rao/ })).toHaveCount(0);
  await page.getByRole('option', { name: 'Sneha Patil · Team Lead' }).click();

  await expect(page.getByText('Amit Joshi now reports to Sneha Patil')).toBeVisible();
  expect(sent).toEqual([{ path: '/api/auth/users/4/reports-to', body: { managerId: 2 } }]);
  await expect(checkup.getByText('Needs fixing · 3')).toBeVisible();
  await expect(checkup.getByText('Amit Joshi', { exact: false })).toHaveCount(0);
});

test('"These are correct" hides the worth-a-check group until someone new appears', async ({ page }) => {
  const users = company().filter(u => ![4, 5, 6, 9].includes(u.id));   // nothing to fix, Anjali to check
  await open(page, users);
  const checkup = page.getByRole('region', { name: 'Team check-up' });
  await expect(checkup.getByText('Worth a check · 1')).toBeVisible();
  await checkup.getByRole('button', { name: 'These are correct' }).click();

  const allGood = page.getByRole('status', { name: 'Team check-up' });
  await expect(allGood).toHaveText('Team check-up: everyone reports to an active team lead or manager.');

  // remembered after a reload …
  await page.reload();
  await page.getByRole('button', { name: 'User Management' }).click();
  await expect(page.getByRole('status', { name: 'Team check-up' })).toBeVisible();

  // … until another developer lands straight under a manager
  users.push(person(10, 'Rohan Mehta', 'Developer', ME.id));
  await page.reload();
  await page.getByRole('button', { name: 'User Management' }).click();
  await expect(checkup.getByText('Worth a check · 1')).toBeVisible();
  await expect(checkup.getByText('Rohan Mehta')).toBeVisible();
  await expect(checkup.getByText('Anjali Kulkarni')).toHaveCount(0);
});

test('without team leads, people under a manager are fine', async ({ page }) => {
  await open(page, [person(ME.id, ME.fullName, 'Manager', null), person(4, 'Amit Joshi', 'Developer', ME.id)]);
  await expect(page.getByRole('status', { name: 'Team check-up' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Team check-up' })).toHaveCount(0);
});
