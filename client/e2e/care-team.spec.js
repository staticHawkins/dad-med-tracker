import { test, expect } from '@playwright/test';

const AUTH_URL = '/?testUser=1';

async function goToCareTeam(page) {
  await page.goto(AUTH_URL);
  await page.waitForSelector('.topbar-menu-wrap', { timeout: 15_000 });
  await page.getByRole('button', { name: /Test User|▾/ }).click();
  await page.getByRole('button', { name: 'Doctors' }).click();
  await page.waitForSelector('.care-team-panel', { timeout: 10_000 });
}

test.describe('care team', () => {
  test.beforeEach(async ({ page }) => {
    await goToCareTeam(page);
  });

  test('care team panel renders with add button', async ({ page }) => {
    await expect(page.locator('.care-team-panel')).toBeVisible();
    await expect(page.getByRole('button', { name: '+ Add Doctor' })).toBeVisible();
  });

  test('add doctor creates a card in the list', async ({ page }) => {
    const name = `[e2e] Dr ${Date.now()}`;
    await page.getByRole('button', { name: '+ Add Doctor' }).click();
    await page.fill('input[placeholder="e.g. Dr. Patel"]', name);
    await page.getByRole('button', { name: 'Save doctor' }).click();
    await page.waitForSelector(`.dr-name >> text=${name}`, { timeout: 15_000 });
    await expect(page.locator('.dr-name', { hasText: name })).toBeVisible();
  });

  test('specialty dropdown renders existing options', async ({ page }) => {
    await page.getByRole('button', { name: '+ Add Doctor' }).click();
    const specialtySelect = page.locator('select').first();
    await expect(specialtySelect).toBeVisible();
    // Should have at least the default "Select specialty…" option
    const options = await specialtySelect.locator('option').count();
    expect(options).toBeGreaterThan(0);
  });

  test('add new specialty inline', async ({ page }) => {
    const specialtyName = `[e2e] Spec ${Date.now()}`;
    await page.getByRole('button', { name: '+ Add Doctor' }).click();
    await page.selectOption('select', { value: '__add__' });
    await page.waitForSelector('input[placeholder="e.g. Cardiology"]', { timeout: 5_000 });
    await page.fill('input[placeholder="e.g. Cardiology"]', specialtyName);
    await page.getByRole('button', { name: 'Add' }).click();
    // After clicking Add, the select reappears with the new specialty selected
    await expect(page.locator('select')).toBeVisible();
    // The specialty input should be hidden now
    await expect(page.locator('input[placeholder="e.g. Cardiology"]')).not.toBeVisible();
  });

  test('edit doctor updates displayed information', async ({ page }) => {
    const name = `[e2e] EditDr ${Date.now()}`;
    const affiliation = `Hospital ${Date.now()}`;
    // First create the doctor
    await page.getByRole('button', { name: '+ Add Doctor' }).click();
    await page.fill('input[placeholder="e.g. Dr. Patel"]', name);
    await page.getByRole('button', { name: 'Save doctor' }).click();
    await page.waitForSelector(`.dr-name >> text=${name}`, { timeout: 15_000 });
    // Click the doctor card to edit
    await page.locator('.dr-card', { hasText: name }).click();
    await page.fill('input[placeholder="Practice / hospital network"]', affiliation);
    await page.getByRole('button', { name: 'Save doctor' }).click();
    await page.waitForSelector(`.dr-affil >> text=${affiliation}`, { timeout: 15_000 });
    await expect(page.locator('.dr-affil', { hasText: affiliation })).toBeVisible();
  });

  test('delete doctor removes the card', async ({ page }) => {
    const name = `[e2e] DelDr ${Date.now()}`;
    await page.getByRole('button', { name: '+ Add Doctor' }).click();
    await page.fill('input[placeholder="e.g. Dr. Patel"]', name);
    await page.getByRole('button', { name: 'Save doctor' }).click();
    await page.waitForSelector(`.dr-name >> text=${name}`, { timeout: 15_000 });
    // Click the ✕ delete button on the card
    page.on('dialog', d => d.accept());
    await page.locator('.dr-card', { hasText: name }).locator('.btn-ghost[title="Remove"]').click();
    await page.waitForSelector(`.dr-name >> text=${name}`, { state: 'detached', timeout: 15_000 });
    await expect(page.locator('.dr-name', { hasText: name })).not.toBeVisible();
  });

  test('back button returns to doctor list from form', async ({ page }) => {
    await page.getByRole('button', { name: '+ Add Doctor' }).click();
    await expect(page.locator('input[placeholder="e.g. Dr. Patel"]')).toBeVisible();
    await page.getByRole('button', { name: 'Back' }).click();
    await expect(page.getByRole('button', { name: '+ Add Doctor' })).toBeVisible();
  });

  test('save is blocked when name is empty', async ({ page }) => {
    await page.getByRole('button', { name: '+ Add Doctor' }).click();
    page.on('dialog', d => d.dismiss());
    await page.getByRole('button', { name: 'Save doctor' }).click();
    // Form should still be visible after failed validation
    await expect(page.locator('input[placeholder="e.g. Dr. Patel"]')).toBeVisible();
  });
});
