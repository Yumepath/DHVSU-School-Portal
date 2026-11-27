import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { mkdir } from 'node:fs/promises';

const widths = [360, 390, 768, 1024, 1366, 1920];
const url = process.env.SUPABASE_URL ?? '';
const local = /^http:\/\/(localhost|127\.0\.0\.1):/.test(url);
const password = role => process.env['E2E_' + role.toUpperCase() + '_PASSWORD'] ?? (local ? 'Local-Demo!2026' : undefined);
const email = role => role + '@dhvsu-demo.example';
const writeFixture = local || process.env.E2E_ALLOW_FIXTURE_WRITES === '1';
const goodBrowserWidth = async page => {
  expect(await page.evaluate(() => {
    const root = document.querySelector('ion-app > :not(router-outlet)');
    return !!root && root.scrollWidth <= root.clientWidth + 1;
  })).toBe(true);
};

async function signIn(page, role) {
  await page.goto('/sign-in');
  await page.getByLabel('Email address').fill(email(role));
  await page.getByLabel('Password', { exact: true }).fill(password(role));
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('alert')).toBeHidden();
  await expect(page).toHaveURL(new RegExp('/portal/' + role + '/overview$'));
}

function watchFailures(page) {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('response', response => {
    if (response.status() >= 400) errors.push(response.status() + ' ' + response.url().split('?')[0]);
  });
  return errors;
}

async function capture(page, name) {
  if (process.env.PORTAL_SCREENSHOTS !== '1') return;
  await mkdir('docs/screenshots', { recursive: true });
  await page.screenshot({ path: 'docs/screenshots/' + name + '.png', animations: 'disabled', fullPage: false });
}

test('sign-in, reset screen, theme and responsive boundaries', async ({ page }) => {
  const errors = watchFailures(page);
  await page.goto('/portal/admin/grades');
  await expect(page).toHaveURL(/sign-in$/);
  for (const width of widths) {
    await page.setViewportSize({ width, height: 900 });
    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
    await goodBrowserWidth(page);
  }
  await page.setViewportSize({ width: 1440, height: 950 });
  await page.getByRole('button', { name: 'Dark mode' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.reload();
  await expect(page.getByRole('button', { name: 'Light mode' })).toBeVisible();
  await page.getByRole('button', { name: 'Light mode' }).click();
  await capture(page, 'sign-in');
  await page.getByRole('button', { name: 'Forgot password?' }).click();
  await expect(page.getByRole('heading', { name: 'Reset your password' })).toBeVisible();
  await page.goto('/reset-password');
  await expect(page.getByRole('button', { name: 'Update password' })).toBeDisabled();
  expect(errors).toEqual([]);
});

test.describe('real Supabase roles', () => {
  test.skip(!password('student') || !password('faculty') || !password('admin'), 'Seed a local stack or configure private demo credentials.');

  test('student navigation, history, announcements, read receipt and responsive layout', async ({ page }) => {
    const errors = watchFailures(page);
    await signIn(page, 'student');
    await expect(page.getByRole('heading', { name: 'Welcome, Maya' })).toBeVisible();
    await capture(page, 'student-overview');
    for (const width of widths) {
      await page.setViewportSize({ width, height: 1050 });
      await goodBrowserWidth(page);
    }
    await page.setViewportSize({ width: 390, height: 900 });
    await capture(page, 'student-mobile');
    await page.getByRole('button', { name: 'Toggle navigation' }).click();
    await page.getByRole('link', { name: 'Grades & history', exact: true }).click();
    await expect(page.getByText('Web Systems and Technologies')).toBeVisible();
    await page.getByLabel('Semester').selectOption('');
    await expect(page.getByText('Database Systems')).toBeVisible();
    await page.goto('/portal/admin/profiles');
    await expect(page).toHaveURL(/\/student\/overview$/);
    await page.getByRole('button', { name: 'Switch to dark mode' }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    for (const width of widths) {
      await page.setViewportSize({ width, height: 1050 });
      await goodBrowserWidth(page);
    }
    await page.setViewportSize({ width: 1440, height: 1030 });
    await page.getByRole('link', { name: 'Academic calendar', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Academic calendar', exact: true })).toBeVisible();
    await expect(page.getByText('Research orientation').first()).toBeVisible();
    if (!(await page.locator('.fc').getByText('Research orientation').count())) {
      await page.locator('.fc-next-button').click();
    }
    await capture(page, 'student-calendar-dark');
    await page.getByRole('link', { name: 'Notifications', exact: true }).click();
    await expect(page.getByText('Grade published').first()).toBeVisible();
    if (writeFixture && await page.getByRole('button', { name: 'Mark as read' }).count()) {
      await page.getByRole('button', { name: 'Mark as read' }).first().click();
      await expect(page.getByText('Read', { exact: true }).first()).toBeVisible();
    }
    await page.getByRole('button', { name: 'Sign out', exact: true }).click();
    await expect(page).toHaveURL(/\/sign-in$/);
    expect(errors).toEqual([]);
  });

  test('faculty encodes attendance and submits a grade for administrator publication', async ({ browser }) => {
    const facultyPage = await browser.newPage();
    const adminPage = await browser.newPage();
    const errors = [watchFailures(facultyPage), watchFailures(adminPage)];
    await signIn(facultyPage, 'faculty');
    await facultyPage.getByRole('link', { name: 'Grade encoding', exact: true }).click();
    await expect(facultyPage.getByRole('heading', { name: 'Grade encoding' })).toBeVisible();
    const classFilter = facultyPage.getByRole('combobox', { name: 'Class', exact: true });
    await expect(classFilter).toBeVisible();
    const networking = (await classFilter.locator('option').allTextContents()).find(label => label.includes('NET 313'));
    await classFilter.selectOption({ label: networking });
    await expect(facultyPage.getByText('Maya Serrano', { exact: true })).toBeVisible();
    await expect(facultyPage.getByText('Isla de Vera', { exact: true })).toHaveCount(0);
    await capture(facultyPage, 'faculty-gradebook');
    if (writeFixture) {
      const row = facultyPage.getByRole('row').filter({ hasText: 'Maya Serrano' });
      if (await row.getByRole('button', { name: 'Save draft' }).count()) {
        await row.getByRole('combobox').selectOption({ label: '1.75' });
        await row.getByRole('button', { name: 'Save draft' }).click();
        await expect(row.getByRole('button', { name: 'Submit', exact: true })).toBeEnabled();
        await row.getByRole('button', { name: 'Submit', exact: true }).click();
        await expect(row.getByText('submitted', { exact: true })).toBeVisible();
      }
      await facultyPage.getByRole('link', { name: 'Attendance', exact: true }).click();
      await facultyPage.getByLabel('Attendance for Maya Serrano').selectOption('present');
      await facultyPage.getByRole('button', { name: 'Save attendance' }).click();
      await expect(facultyPage.getByText('Attendance saved', { exact: true })).toBeVisible();
      await facultyPage.reload();
      await facultyPage.getByRole('combobox', { name: 'Class', exact: true }).selectOption({ label: networking });
      await expect(facultyPage.getByLabel('Attendance for Maya Serrano')).toHaveValue('present');
    }
    await signIn(adminPage, 'admin');
    await expect(adminPage.getByRole('heading', { name: 'Administration overview' })).toBeVisible();
    await capture(adminPage, 'admin-overview');
    await adminPage.getByRole('link', { name: 'Grades', exact: true }).click();
    await adminPage.getByRole('searchbox').fill('NET 313');
    const grade = adminPage.getByRole('row').filter({ hasText: 'Maya Serrano' });
    if (writeFixture && await grade.getByRole('button', { name: 'Publish', exact: true }).count()) {
      await grade.getByRole('button', { name: 'Publish', exact: true }).click();
    }
    if (writeFixture) await expect(grade.getByText('published', { exact: true })).toBeVisible();
    expect(errors.flat()).toEqual([]);
    await facultyPage.close();
    await adminPage.close();
  });

  test('administrator manages catalogs, enrollment, announcements and account provisioning', async ({ page }) => {
    test.skip(!writeFixture, 'Explicitly enable writes only on the fictional demo database.');
    const errors = watchFailures(page);
    await signIn(page, 'admin');
    const nav = (name) => page.getByRole('link', { name, exact: true }).click();
    const add = () => page.getByRole('button', { name: 'Add record' }).click();
    const save = () => page.getByRole('button', { name: 'Save record' }).click();
    const find = async (text) => {
      await page.getByRole('searchbox').fill(text);
      await expect(page.locator('.pagination')).toContainText('Page 1');
      return page.getByRole('row').filter({ hasText: text });
    };
    await nav('Subjects');
    const subject = await find('DEMO 410');
    if (!(await subject.count())) {
      await add();
      await page.getByLabel('Code', { exact: true }).fill('DEMO 410');
      await page.getByLabel('Name', { exact: true }).fill('Applied Data Communications');
      await page.getByLabel('Credit units').fill('3');
      await page.getByRole('combobox', { name: 'Department', exact: true }).selectOption({ label: 'DEMO-CCS · College of Computing Studies' });
      await save();
    }
    await expect(subject).toBeVisible();
    await nav('Class assignments');
    const assignment = await find('DEMO 410');
    if (!(await assignment.count())) {
      await add();
      const semesters = await page.getByRole('combobox', { name: 'Semester', exact: true }).locator('option').allTextContents();
      const academicStart = new Date().getMonth() < 6 ? new Date().getFullYear() - 1 : new Date().getFullYear();
      const term = semesters.find(value => value.startsWith(String(academicStart)) &&
        value.endsWith(new Date().getMonth() < 6 ? 'Second semester' : 'First semester'));
      await page.getByRole('combobox', { name: 'Semester', exact: true }).selectOption({ label: term });
      await page.getByRole('combobox', { name: 'Subject', exact: true }).selectOption({ label: 'DEMO 410 · Applied Data Communications' });
      await page.getByRole('combobox', { name: 'Section', exact: true }).selectOption({ label: 'BSIT 3A' });
      await page.getByRole('combobox', { name: 'Faculty member', exact: true }).selectOption({ label: 'Rafael Mercado · DEMO-F-025' });
      await save();
    }
    await expect(assignment).toBeVisible();
    await nav('Class schedules');
    const schedule = await find('DEMO 410');
    if (!(await schedule.count())) {
      await add();
      await page.getByRole('combobox', { name: 'Class', exact: true }).selectOption({ label: (await page.getByRole('combobox', { name: 'Class', exact: true }).locator('option').allTextContents())
        .find(value => value.includes('DEMO 410')) });
      await page.getByRole('combobox', { name: 'Day', exact: true }).selectOption({ label: 'Thursday' });
      await page.getByLabel('Start time').fill('10:00');
      await page.getByLabel('End time').fill('11:30');
      await page.getByLabel('Room', { exact: true }).fill('Demo Lab 7');
      await save();
    }
    await expect(schedule).toBeVisible();
    await nav('Enrollments');
    const enrollment = await find('DEMO 410');
    if (!(await enrollment.count())) {
      await add();
      await page.getByRole('combobox', { name: 'Student', exact: true }).selectOption({ label: 'Maya Serrano · DEMO-26-0104' });
      await page.getByRole('combobox', { name: 'Class', exact: true }).selectOption({ label: (await page.getByRole('combobox', { name: 'Class', exact: true }).locator('option').allTextContents())
        .find(value => value.includes('DEMO 410')) });
      await save();
    }
    await expect(enrollment).toBeVisible();
    await nav('Announcements');
    const announcement = await find('Demo registrar checklist');
    if (!(await announcement.count())) {
      await add();
      await page.getByLabel('Title').fill('Demo registrar checklist');
      await page.getByLabel('Message').fill('Review your course load and class schedule before the next advising appointment.');
      await page.getByRole('button', { name: 'Publish now' }).click();
      await save();
    }
    await expect(announcement).toBeVisible();
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export CSV' }).click();
    expect((await download).suggestedFilename()).toBe('dhvsu-announcements.csv');

    await nav('User accounts');
    const suffix = process.env.E2E_PROVISION_SUFFIX ?? '';
    const accountEmail = 'new-learner' + suffix.toLowerCase().replaceAll(' ', '-') + '@dhvsu-demo.example';
    const account = await find(accountEmail);
    if (!(await account.count())) {
      await page.getByRole('button', { name: 'Provision account' }).click();
      await page.getByLabel('Full name').fill('New Demo Learner' + suffix);
      await page.getByLabel('Email address').fill(accountEmail);
      await page.getByLabel('Initial password').fill('Local!' + (await import('node:crypto')).randomBytes(24).toString('hex'));
      await page.getByRole('button', { name: 'Create account' }).click();
    }
    await expect(account).toBeVisible();
    if (await account.getByText('Active', { exact: true }).count()) {
      await account.getByRole('button', { name: 'Edit', exact: true }).click();
      await page.getByLabel('Active', { exact: true }).uncheck();
      await save();
    }
    await expect(account.getByText('Inactive', { exact: true })).toBeVisible();
    await nav('Audit log');
    await expect(page.getByText('PROVISION', { exact: true }).first()).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('direct Supabase requests enforce privacy and privilege boundaries', async () => {
    const options = { auth: { persistSession: false, autoRefreshToken: false } };
    const key = process.env.SUPABASE_PUBLISHABLE_KEY;
    const anon = createClient(url, key, options);
    expect((await anon.from('grades').select()).error).toBeTruthy();
    const client = createClient(url, key, options);
    const { data, error } = await client.auth.signInWithPassword({ email: email('student'), password: password('student') });
    expect(error).toBeNull();
    const uid = data.user.id;
    const profiles = await client.from('profiles').select('id,role');
    expect(profiles.data).toEqual([{ id: uid, role: 'student' }]);
    const grades = await client.from('grades').select('status');
    expect(grades.data.length).toBeGreaterThan(0);
    expect(grades.data.every(grade => grade.status === 'published')).toBe(true);
    const escalation = await client.from('profiles').update({ role: 'admin' }).eq('id', uid);
    expect(escalation.error?.code).toBe('42501');
    const provision = await client.functions.invoke('portal-accounts', { body: {} });
    expect(provision.error?.context?.status).toBe(403);
    await client.auth.signOut({ scope: 'local' });
  });
});
