// ─────────────────────────────────────────────────────────────────────────────
//  "Reports to" (8 Oct 2026): approving a sign-up used to always link them to
//  the approving manager, so team leads never got their people's requests.
//  Now the manager picks the Team Lead / Manager when approving, and can
//  change it later from Manager Dashboard → User Management.
// ─────────────────────────────────────────────────────────────────────────────
import { test, expect } from '@playwright/test';
import { FakeBackend, ME } from './fakeBackend';

const team = [
  { id: ME.id, fullName: ME.fullName, email: ME.email, role: 'Manager', isActive: true, managerId: null },
  { id: 2, fullName: 'Sneha Patil', email: 'sneha@test.dev', role: 'TeamLead', isActive: true, managerId: ME.id },
  { id: 4, fullName: 'Amit Joshi', email: 'amit@test.dev', role: 'Developer', isActive: true, managerId: ME.id },
];

test('approving a sign-up lets the manager pick their team lead', async ({ page }) => {
  const fake = new FakeBackend(page);
  fake.me = { ...fake.me, role: 'Manager' };
  fake.answer = (path, method) => {
    if (path === '/auth/pending-users') return [{ id: 3, fullName: 'Priya Dev', email: 'priya@test.dev', createdAt: '2026-10-07T09:00:00' }];
    if (path === '/manager/users') return team;
    if (path === '/auth/assign-role' && method === 'POST') return { message: 'ok' };
    return undefined;
  };
  const sent: unknown[] = [];
  page.on('request', r => { if (r.url().endsWith('/api/auth/assign-role')) sent.push(r.postDataJSON()); });
  await fake.install();
  await fake.login();
  await fake.navigate('/manager/assign-role');

  await page.getByRole('button', { name: 'Developer', exact: true }).click();
  const reportsTo = page.getByRole('combobox', { name: 'Reports to' });
  await expect(reportsTo).toContainText(ME.fullName);                    // the approving manager by default
  await reportsTo.click();
  await page.getByRole('option', { name: 'Sneha Patil · Team Lead' }).click();
  await page.getByRole('button', { name: 'Confirm' }).click();

  await expect(page.getByText('Developer role assigned to Priya Dev — reports to Sneha Patil')).toBeVisible();
  expect(sent).toEqual([{ userId: 3, role: 'Developer', managerId: 2 }]);
});

test('approving a Manager asks nobody to report to', async ({ page }) => {
  const fake = new FakeBackend(page);
  fake.me = { ...fake.me, role: 'Manager' };
  fake.answer = path => {
    if (path === '/auth/pending-users') return [{ id: 3, fullName: 'Priya Dev', email: 'priya@test.dev', createdAt: '2026-10-07T09:00:00' }];
    if (path === '/manager/users') return team;
    return undefined;
  };
  await fake.install();
  await fake.login();
  await fake.navigate('/manager/assign-role');
  await page.getByRole('main').getByRole('button', { name: 'Manager', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Assign Manager' })).toBeVisible();
  await expect(page.getByRole('combobox', { name: 'Reports to' })).toHaveCount(0);
});

test('a manager changes who someone reports to later', async ({ page }) => {
  const fake = new FakeBackend(page);
  fake.me = { ...fake.me, role: 'Manager' };
  fake.answer = (path, method) => {
    if (path === '/manager/users') return team;
    if (path === '/manager/team/daily') return { date: '2026-10-07', totalMembers: 0, checkedIn: 0, notCheckedIn: 0, members: [] };
    if (path === '/auth/users/4/reports-to' && method === 'PUT') return { userId: 4, managerId: 2, managerName: 'Sneha Patil' };
    return undefined;
  };
  const sent: unknown[] = [];
  page.on('request', r => { if (r.url().endsWith('/api/auth/users/4/reports-to')) sent.push({ method: r.method(), body: r.postDataJSON() }); });
  await fake.install();
  await fake.login();
  await fake.navigate('/manager');
  await page.getByRole('button', { name: 'User Management' }).click();

  // managers don't report to anyone, so they get no picker
  await expect(page.getByRole('combobox', { name: `${ME.fullName} reports to` })).toHaveCount(0);
  const amit = page.getByRole('combobox', { name: 'Amit Joshi reports to' });
  await expect(amit).toContainText(ME.fullName);
  await amit.click();
  await page.getByRole('option', { name: 'Sneha Patil · Team Lead' }).click();

  await expect(page.getByText('Amit Joshi now reports to Sneha Patil')).toBeVisible();
  await expect(amit).toContainText('Sneha Patil');
  expect(sent).toEqual([{ method: 'PUT', body: { managerId: 2 } }]);
});
