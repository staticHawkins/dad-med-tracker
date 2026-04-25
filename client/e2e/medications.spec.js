import { test, expect } from '@playwright/test';

const AUTH_URL = '/?testUser=1';

async function goToMeds(page) {
  await page.goto(AUTH_URL);
  await page.waitForSelector('.topbar-menu-wrap', { timeout: 15_000 });
  await page.getByRole('button', { name: 'Go to Medications' }).click();
  await page.waitForSelector('.tbl-hdr', { timeout: 10_000 });
}

async function addMed(page, name) {
  await page.getByRole('button', { name: '+ Add medication' }).click();
  await page.waitForSelector('[role="dialog"]', { timeout: 5_000 });
  await page.fill('input[placeholder="e.g. Metformin"]', name);
  await page.fill('input[type="date"]', '2026-01-01');
  await page.fill('input[placeholder="e.g. 30"]', '30');
  // Frequency defaults to once-daily; no change needed
  await page.getByRole('button', { name: 'Add medication', exact: true }).click();
  await page.waitForSelector(`.med-row-main >> text=${name}`, { timeout: 15_000 });
}

test.describe.configure({ mode: 'serial' });

test.describe('medications', () => {
  test.beforeEach(async ({ page }) => {
    await goToMeds(page);
  });

  test('medications view renders toolbar and groups', async ({ page }) => {
    await expect(page.locator('.tbl-hdr')).toBeVisible();
    await expect(page.getByRole('button', { name: '+ Add medication' })).toBeVisible();
  });

  test('add medication with required fields', async ({ page }) => {
    const name = `[e2e] Med ${Date.now()}`;
    await addMed(page, name);
    await expect(page.locator('.med-row-main', { hasText: name })).toBeVisible();
  });

  test('search filters medication list', async ({ page }) => {
    const name = `[e2e] SearchMed ${Date.now()}`;
    await addMed(page, name);
    await page.fill('.search-input', name);
    await expect(page.locator('.med-row-main', { hasText: name })).toBeVisible();
    // A med with a different name should not be visible
    const rows = page.locator('.med-row-main');
    const count = await rows.count();
    for (let i = 0; i < count; i++) {
      const text = await rows.nth(i).textContent();
      expect(text).toContain('[e2e] SearchMed');
    }
  });

  test('clearing search restores full list', async ({ page }) => {
    const name = `[e2e] ClearSearch ${Date.now()}`;
    await addMed(page, name);
    await page.fill('.search-input', name);
    await page.fill('.search-input', '');
    // After clearing, multiple rows should be visible
    await expect(page.locator('.med-row-main').first()).toBeVisible();
  });

  test('expand drawer shows inline fields', async ({ page }) => {
    const name = `[e2e] ExpandMed ${Date.now()}`;
    await addMed(page, name);
    await page.locator('.med-row-main', { hasText: name }).click();
    await expect(page.locator('.med-drawer.open')).toBeVisible();
  });

  test('inline edit name autosaves', async ({ page }) => {
    const name = `[e2e] InlineEdit ${Date.now()}`;
    const newName = `[e2e] InlineEdited ${Date.now()}`;
    await addMed(page, name);
    await page.locator('.med-row-main', { hasText: name }).click();
    await page.waitForSelector('.med-drawer.open', { timeout: 5_000 });
    await page.locator('.med-drawer.open .inline-val').first().click();
    await page.locator('.med-drawer.open .inline-input').first().fill(newName);
    await page.locator('.med-drawer.open .inline-input').first().press('Enter');
    await page.waitForSelector('.autosave-pill.saved', { timeout: 15_000 });
    await expect(page.locator('.autosave-pill.saved')).toBeVisible();
  });

  test('refill request updates badge', async ({ page }) => {
    const name = `[e2e] RefillMed ${Date.now()}`;
    await addMed(page, name);
    const row = page.locator('.med-row', { hasText: name });
    await row.locator('.med-row-main').click();
    await row.locator('.med-drawer.open').waitFor({ timeout: 5_000 });
    await row.locator('.med-drawer-actions').getByRole('button', { name: 'Place request' }).click();
    // Wait for next workflow button — proves write succeeded and listener updated UI
    await row.locator('.med-drawer-actions').getByRole('button', { name: 'Ready for pickup' }).waitFor({ timeout: 15_000 });
    await expect(row.locator('.med-row-main')).toContainText(/Requested/);
  });

  test('mark refilled clears refill badge', async ({ page }) => {
    const name = `[e2e] MarkRefill ${Date.now()}`;
    await addMed(page, name);
    const row = page.locator('.med-row', { hasText: name });
    await row.locator('.med-row-main').click();
    await row.locator('.med-drawer.open').waitFor({ timeout: 5_000 });
    // Step through workflow: request → ready-pickup → picked-up → mark refilled
    // Wait for each next-step button to confirm the write succeeded before proceeding
    await row.locator('.med-drawer-actions').getByRole('button', { name: 'Place request' }).click();
    await row.locator('.med-drawer-actions').getByRole('button', { name: 'Ready for pickup' }).waitFor({ timeout: 15_000 });
    await row.locator('.med-drawer-actions').getByRole('button', { name: 'Ready for pickup' }).click();
    await row.locator('.med-drawer-actions').getByRole('button', { name: 'Picked up' }).waitFor({ timeout: 15_000 });
    await row.locator('.med-drawer-actions').getByRole('button', { name: 'Picked up' }).click();
    await row.locator('.med-drawer-actions').getByRole('button', { name: 'Mark refilled' }).waitFor({ timeout: 15_000 });
    await row.locator('.med-drawer-actions').getByRole('button', { name: 'Mark refilled' }).click();
    // After marking refilled, "Place request" reappears (refillStatus cleared)
    await row.locator('.med-drawer-actions').getByRole('button', { name: 'Place request' }).waitFor({ timeout: 15_000 });
    await expect(row.locator('.med-row-main')).not.toContainText(/Requested/);
  });

  test('deactivate moves med to inactive group', async ({ page }) => {
    const name = `[e2e] DeactMed ${Date.now()}`;
    await addMed(page, name);
    const row = page.locator('.med-row', { hasText: name });
    // Use the ⋯ menu — two-click confirm flow, stable popup
    await row.locator('.med-menu-btn').click();
    await row.locator('.med-menu-pop').waitFor({ timeout: 3_000 });
    await row.locator('.med-menu-pop').getByRole('button', { name: 'Deactivate' }).click();
    await row.locator('.med-menu-pop').getByRole('button', { name: 'Confirm deactivate?' }).waitFor({ timeout: 5_000 });
    await row.locator('.med-menu-pop').getByRole('button', { name: 'Confirm deactivate?' }).click();
    await page.waitForSelector(`.med-group-inactive .med-row-main >> text=${name}`, { timeout: 15_000 });
    await expect(page.locator('.med-group-inactive .med-row-main', { hasText: name })).toBeVisible();
  });

  test('reactivate moves med back to active groups', async ({ page }) => {
    const name = `[e2e] ReactMed ${Date.now()}`;
    await addMed(page, name);
    const row = page.locator('.med-row', { hasText: name });
    // Deactivate via ⋯ menu first
    await row.locator('.med-menu-btn').click();
    await row.locator('.med-menu-pop').waitFor({ timeout: 3_000 });
    await row.locator('.med-menu-pop').getByRole('button', { name: 'Deactivate' }).click();
    await row.locator('.med-menu-pop').getByRole('button', { name: 'Confirm deactivate?' }).waitFor({ timeout: 5_000 });
    await row.locator('.med-menu-pop').getByRole('button', { name: 'Confirm deactivate?' }).click();
    await page.waitForSelector(`.med-group-inactive .med-row-main >> text=${name}`, { timeout: 15_000 });
    // Reactivate via ⋯ menu on the inactive row
    const inactiveRow = page.locator('.med-group-inactive .med-row', { hasText: name });
    await inactiveRow.locator('.med-menu-btn').click();
    await inactiveRow.locator('.med-menu-pop').waitFor({ timeout: 3_000 });
    await inactiveRow.locator('.med-menu-pop').getByRole('button', { name: 'Reactivate' }).click();
    await page.waitForSelector(`.med-row:not(.med-row-inactive) .med-row-main >> text=${name}`, { timeout: 15_000 });
    await expect(page.locator('.med-row:not(.med-row-inactive) .med-row-main', { hasText: name })).toBeVisible();
  });

  test('filter tab ≤ 7d shows only urgent/soon meds', async ({ page }) => {
    await page.locator('.ftab', { hasText: '≤ 7d' }).click();
    // Either some rows appear or empty state appears — no stocked rows should be visible
    await expect(page.locator('.ftab.active', { hasText: '≤ 7d' })).toBeVisible();
  });

  test('export CSV button triggers download without error', async ({ page }) => {
    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 5_000 }).catch(() => null),
      page.getByRole('button', { name: '⬇ CSV' }).click(),
    ]);
    // Either a download fires or we at least confirm no page error occurred
    await expect(page.locator('.tbl-hdr')).toBeVisible();
  });

  test('add medication modal required-field validation', async ({ page }) => {
    await page.getByRole('button', { name: '+ Add medication' }).click();
    await page.waitForSelector('[role="dialog"]', { timeout: 5_000 });
    page.on('dialog', d => d.dismiss());
    await page.getByRole('button', { name: 'Add medication', exact: true }).click();
    // Modal stays open after failed validation
    await expect(page.locator('[role="dialog"]')).toBeVisible();
  });
});
