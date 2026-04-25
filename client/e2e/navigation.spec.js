import { test, expect } from '@playwright/test';

const AUTH_URL = '/?testUser=1';

test.describe('navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(AUTH_URL);
    await page.waitForSelector('.topbar-menu-wrap', { timeout: 15_000 });
  });

  test('dashboard loads by default', async ({ page }) => {
    await expect(page.locator('.dashboard-page')).toBeVisible();
    await expect(page.locator('.back-bar')).not.toBeVisible();
  });

  test('navigate to Medications and back', async ({ page }) => {
    await page.getByRole('button', { name: 'Go to Medications' }).click();
    await expect(page.locator('.back-bar')).toBeVisible();
    await expect(page.locator('.back-bar')).toContainText('Medications');
    await page.getByRole('button', { name: '← Dashboard' }).click();
    await expect(page.locator('.dashboard-page')).toBeVisible();
  });

  test('navigate to Appointments and back', async ({ page }) => {
    await page.getByRole('button', { name: 'Go to Appointments' }).click();
    await expect(page.locator('.back-bar')).toContainText('Appointments');
    await page.getByRole('button', { name: '← Dashboard' }).click();
    await expect(page.locator('.dashboard-page')).toBeVisible();
  });

  test('navigate to Tasks and back', async ({ page }) => {
    await page.getByRole('button', { name: 'Go to Tasks' }).click();
    await expect(page.locator('.back-bar')).toContainText('Tasks');
    await page.getByRole('button', { name: '← Dashboard' }).click();
    await expect(page.locator('.dashboard-page')).toBeVisible();
  });

  test('navigate to Care Team via user menu and back', async ({ page }) => {
    await page.getByRole('button', { name: /Test User|▾/ }).click();
    await page.getByRole('button', { name: 'Doctors' }).click();
    await expect(page.locator('.back-bar')).toContainText('Care Team');
    await page.getByRole('button', { name: '← Dashboard' }).click();
    await expect(page.locator('.dashboard-page')).toBeVisible();
  });

  test('navigate to Timeline via Disease Timeline card', async ({ page }) => {
    await page.getByRole('button', { name: /Disease Timeline/ }).click();
    await expect(page.locator('.back-bar')).toContainText('Disease Timeline');
    await page.getByRole('button', { name: '← Dashboard' }).click();
    await expect(page.locator('.dashboard-page')).toBeVisible();
  });

  test('user menu Doctors button navigates to Care Team', async ({ page }) => {
    await page.getByRole('button', { name: /Test User|▾/ }).click();
    await page.getByRole('button', { name: 'Doctors' }).click();
    await expect(page.locator('.back-bar')).toContainText('Care Team');
  });
});
