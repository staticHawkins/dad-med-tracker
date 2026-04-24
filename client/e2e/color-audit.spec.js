import { test } from '@playwright/test';
import path from 'path';

const SCREENS_DIR = 'e2e/screenshots/color-audit';

test('capture dark mode - login screen', async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: `${SCREENS_DIR}/01-dark-login.png`, fullPage: true });
});

test('capture light mode - login screen', async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  // Force light theme on the HTML element
  await page.evaluate(() => {
    document.documentElement.dataset.theme = 'light';
  });
  await page.waitForTimeout(200);
  await page.screenshot({ path: `${SCREENS_DIR}/02-light-login.png`, fullPage: true });
});
