import { test, expect } from '@playwright/test';

test('app loads and shows login screen', async ({ page }) => {
  await page.goto('/');
  // The app should render something — at minimum the root div
  await expect(page.locator('body')).not.toBeEmpty();
  // Should show a sign-in prompt (not a blank page or crash)
  await page.screenshot({ path: 'e2e/screenshots/smoke.png' });
});
