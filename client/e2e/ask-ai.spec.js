import { test, expect } from '@playwright/test';

const AUTH_URL = '/?testUser=1';

test.describe('ask AI sheet', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(AUTH_URL);
    await page.waitForSelector('.topbar-menu-wrap', { timeout: 15_000 });
  });

  test('sheet opens when "Ask AI" button is clicked', async ({ page }) => {
    await page.getByRole('button', { name: /Ask AI/ }).click();
    await expect(page.locator('.ask-ai-sheet')).toBeVisible();
  });

  test('context chips render after opening', async ({ page }) => {
    await page.getByRole('button', { name: /Ask AI/ }).click();
    await expect(page.locator('.ask-ai-sheet')).toBeVisible();
    await expect(page.locator('.ai-ctx-chip').first()).toBeVisible();
  });

  test('"All data loaded" badge is visible', async ({ page }) => {
    await page.getByRole('button', { name: /Ask AI/ }).click();
    await expect(page.locator('.ask-ai-badge')).toHaveText('All data loaded');
  });

  test('suggested questions appear when chat is empty', async ({ page }) => {
    await page.getByRole('button', { name: /Ask AI/ }).click();
    await expect(page.locator('.ask-ai-suggestion').first()).toBeVisible();
  });

  test('close with × button', async ({ page }) => {
    await page.getByRole('button', { name: /Ask AI/ }).click();
    await expect(page.locator('.ask-ai-sheet')).toBeVisible();
    await page.locator('.ask-ai-close').click();
    await expect(page.locator('.ask-ai-sheet')).not.toBeVisible();
  });

  test('close with Escape key', async ({ page }) => {
    await page.getByRole('button', { name: /Ask AI/ }).click();
    await expect(page.locator('.ask-ai-sheet')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('.ask-ai-sheet')).not.toBeVisible();
  });

  test('close by clicking backdrop', async ({ page }) => {
    await page.getByRole('button', { name: /Ask AI/ }).click();
    await expect(page.locator('.ask-ai-sheet')).toBeVisible();
    // Click the backdrop at the top of the screen (above the sheet panel)
    await page.locator('.ask-ai-backdrop').click({ position: { x: 100, y: 10 } });
    await expect(page.locator('.ask-ai-sheet')).not.toBeVisible();
  });

  test('typing and sending a message shows user bubble', async ({ page }) => {
    await page.getByRole('button', { name: /Ask AI/ }).click();
    await expect(page.locator('.ask-ai-sheet')).toBeVisible();
    const question = 'What medications are running low?';
    await page.locator('.ask-ai-sheet textarea').fill(question);
    await page.locator('.ask-ai-sheet textarea').press('Enter');
    // User message bubble should appear immediately
    await expect(page.locator('.chat-row-user', { hasText: question })).toBeVisible();
  });
});
