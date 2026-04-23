import { test, expect } from '@playwright/test';

const AUTH_URL = '/?testUser=1';

test.describe('profile dropdown', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(AUTH_URL);
    // Firebase keeps persistent connections open so networkidle never fires.
    // Wait for the topbar to confirm the app has rendered.
    await page.waitForSelector('.topbar-menu-wrap', { timeout: 15_000 });
  });

  test('opens when profile button is clicked', async ({ page }) => {
    await page.getByRole('button', { name: /Test User|▾/ }).click();
    await expect(page.locator('.topbar-menu')).toBeVisible();
  });

  test('contains Doctors item that navigates to Care Team', async ({ page }) => {
    await page.getByRole('button', { name: /Test User|▾/ }).click();
    const doctorsBtn = page.getByRole('button', { name: 'Doctors' });
    await expect(doctorsBtn).toBeVisible();
    await doctorsBtn.click();
    // Dropdown closes and Care Team view renders
    await expect(page.locator('.topbar-menu')).not.toBeVisible();
    await expect(page.locator('.back-bar')).toContainText('Care Team');
  });

  test('contains theme toggle that switches between light and dark mode', async ({ page }) => {
    // Starts in dark mode (default)
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

    await page.getByRole('button', { name: /Test User|▾/ }).click();
    const themeBtn = page.getByRole('button', { name: 'Light mode' });
    await expect(themeBtn).toBeVisible();
    await themeBtn.click();

    // Theme switches to light; dropdown stays open and label flips to "Dark mode"
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    await expect(page.getByRole('button', { name: 'Dark mode' })).toBeVisible();
  });

  test('closes when clicking outside', async ({ page }) => {
    await page.getByRole('button', { name: /Test User|▾/ }).click();
    await expect(page.locator('.topbar-menu')).toBeVisible();
    await page.locator('.brand').click();
    await expect(page.locator('.topbar-menu')).not.toBeVisible();
  });

  test('contains Notifications and Sign out items', async ({ page }) => {
    await page.getByRole('button', { name: /Test User|▾/ }).click();
    await expect(page.getByRole('button', { name: /Notifications/ })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible();
  });
});
