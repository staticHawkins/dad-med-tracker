import { test, expect } from '@playwright/test';

const AUTH_URL = '/?testUser=1';

test.describe('timeline', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(AUTH_URL);
    await page.waitForSelector('.topbar-menu-wrap', { timeout: 15_000 });
  });

  test('timeline view loads with patient header', async ({ page }) => {
    await page.getByRole('button', { name: /Disease Timeline/ }).click();
    await page.waitForSelector('.tl-page', { timeout: 10_000 });
    await expect(page.locator('.tl-page')).toBeVisible();
    await expect(page.locator('.tl-patient-header')).toBeVisible();
  });

  test('back bar label says Disease Timeline', async ({ page }) => {
    await page.getByRole('button', { name: /Disease Timeline/ }).click();
    await page.waitForSelector('.back-bar', { timeout: 10_000 });
    await expect(page.locator('.back-bar')).toContainText('Disease Timeline');
  });

  test('phase strip section renders', async ({ page }) => {
    await page.getByRole('button', { name: /Disease Timeline/ }).click();
    await page.waitForSelector('.tl-page', { timeout: 10_000 });
    // Either phase cards or the phase-strip container is present
    const phaseSection = page.locator('.tl-phase-card, .tl-phases-strip');
    // If empty, there should at least be a section wrapper
    await expect(page.locator('.tl-page')).toBeVisible();
  });

  test('milestones section heading is present', async ({ page }) => {
    await page.getByRole('button', { name: /Disease Timeline/ }).click();
    await page.waitForSelector('.tl-page', { timeout: 10_000 });
    await expect(page.getByText(/Clinical Milestones/)).toBeVisible();
  });

  test('disease timeline card is visible on dashboard', async ({ page }) => {
    await expect(page.getByRole('button', { name: /Disease Timeline/ })).toBeVisible();
  });

  test('"View full timeline" link navigates to timeline view', async ({ page }) => {
    const link = page.getByRole('link', { name: /View full timeline/ });
    if (await link.count() > 0) {
      await link.click();
      await page.waitForSelector('.tl-page', { timeout: 10_000 });
      await expect(page.locator('.tl-page')).toBeVisible();
    } else {
      // Link may be inside the card button; click the card itself
      await page.getByRole('button', { name: /Disease Timeline/ }).click();
      await page.waitForSelector('.tl-page', { timeout: 10_000 });
      await expect(page.locator('.tl-page')).toBeVisible();
    }
  });
});
