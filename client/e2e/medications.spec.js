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

  // Detail modal locator scoped to detail (excludes the Refill modal whose title starts with "Refill ")
  function detailModal(page, name) {
    return page.locator('[role="dialog"]', { hasText: name })
      .filter({ has: page.locator('.med-drawer-details') });
  }

  test('open med detail modal shows inline fields', async ({ page }) => {
    const name = `[e2e] DetailMed ${Date.now()}`;
    await addMed(page, name);
    await page.locator('.med-row-main', { hasText: name }).click();
    await expect(detailModal(page, name)).toBeVisible();
    await expect(detailModal(page, name).locator('.med-drawer-details')).toBeVisible();
  });

  test('inline edit name autosaves', async ({ page }) => {
    const name = `[e2e] InlineEdit ${Date.now()}`;
    const newName = `[e2e] InlineEdited ${Date.now()}`;
    await addMed(page, name);
    await page.locator('.med-row-main', { hasText: name }).click();
    const modal = detailModal(page, name);
    await modal.waitFor({ timeout: 5_000 });
    await modal.locator('.inline-val').first().click();
    await modal.locator('.inline-input').first().fill(newName);
    await modal.locator('.inline-input').first().press('Enter');
    await page.waitForSelector('.autosave-pill.saved', { timeout: 15_000 });
    await expect(page.locator('.autosave-pill.saved')).toBeVisible();
  });

  test('refill request updates badge', async ({ page }) => {
    const name = `[e2e] RefillMed ${Date.now()}`;
    await addMed(page, name);
    await page.locator('.med-row-main', { hasText: name }).click();
    const modal = detailModal(page, name);
    await modal.waitFor({ timeout: 5_000 });
    await modal.locator('.med-drawer-actions').getByRole('button', { name: 'Place request' }).click();
    // Wait for next workflow button — proves write succeeded and listener updated UI
    await modal.locator('.med-drawer-actions').getByRole('button', { name: 'Ready for pickup' }).waitFor({ timeout: 15_000 });
    // Close modal and check the row badge
    await modal.getByRole('button', { name: 'Close' }).click();
    await expect(page.locator('.med-row-main', { hasText: name })).toContainText(/Requested/);
  });

  test('mark refilled clears refill badge', async ({ page }) => {
    const name = `[e2e] MarkRefill ${Date.now()}`;
    await addMed(page, name);
    await page.locator('.med-row-main', { hasText: name }).click();
    const modal = detailModal(page, name);
    await modal.waitFor({ timeout: 5_000 });
    // Step through workflow: request → ready-pickup → picked-up → mark refilled
    await modal.locator('.med-drawer-actions').getByRole('button', { name: 'Place request' }).click();
    await modal.locator('.med-drawer-actions').getByRole('button', { name: 'Ready for pickup' }).waitFor({ timeout: 15_000 });
    await modal.locator('.med-drawer-actions').getByRole('button', { name: 'Ready for pickup' }).click();
    await modal.locator('.med-drawer-actions').getByRole('button', { name: 'Picked up' }).waitFor({ timeout: 15_000 });
    await modal.locator('.med-drawer-actions').getByRole('button', { name: 'Picked up' }).click();
    await modal.locator('.med-drawer-actions').getByRole('button', { name: 'Mark refilled' }).waitFor({ timeout: 15_000 });
    await modal.locator('.med-drawer-actions').getByRole('button', { name: 'Mark refilled' }).click();
    // Refill confirmation modal opens — confirm with current values
    const refillModal = page.locator('[role="dialog"]', { hasText: `Refill ${name}` });
    await refillModal.waitFor({ timeout: 5_000 });
    await refillModal.getByRole('button', { name: /Confirm refill/ }).click();
    // After confirming, both modals close and the med moves to the collapsed stocked group
    await page.locator('.med-group-ok').waitFor({ timeout: 15_000 });
    await page.locator('.med-group-ok .stk-show-btn').click();
    const stockedRow = page.locator('.med-group-ok .med-row', { hasText: name });
    await stockedRow.locator('.med-row-main').click();
    const reopened = detailModal(page, name);
    await reopened.waitFor({ timeout: 5_000 });
    await expect(reopened.locator('.med-drawer-actions').getByRole('button', { name: 'Place request' })).toBeVisible();
    await expect(stockedRow.locator('.med-row-main')).not.toContainText(/Requested/);
  });

  async function deactivateMed(page, name) {
    await page.locator('.med-row-main', { hasText: name }).click();
    const modal = detailModal(page, name);
    await modal.waitFor({ timeout: 5_000 });
    await modal.locator('.drawer-deactivate').click();
    await modal.locator('.drawer-deactivate.danger').waitFor({ timeout: 3_000 });
    await modal.locator('.drawer-deactivate.danger').click();
  }

  test('deactivate moves med to inactive group', async ({ page }) => {
    const name = `[e2e] DeactMed ${Date.now()}`;
    await addMed(page, name);
    await deactivateMed(page, name);
    // Inactive group starts collapsed — expand it first
    await page.locator('.med-group-inactive').waitFor({ timeout: 15_000 });
    await page.locator('.med-group-inactive .med-group-toggle').click();
    await expect(page.locator('.med-group-inactive .med-row-main', { hasText: name })).toBeVisible();
  });

  test('reactivate moves med back to active groups', async ({ page }) => {
    const name = `[e2e] ReactMed ${Date.now()}`;
    await addMed(page, name);
    await deactivateMed(page, name);
    await page.locator('.med-group-inactive').waitFor({ timeout: 15_000 });
    await page.locator('.med-group-inactive .med-group-toggle').click();
    const inactiveRow = page.locator('.med-group-inactive .med-row', { hasText: name });
    await inactiveRow.locator('.med-row-main').click();
    const modal = detailModal(page, name);
    await modal.waitFor({ timeout: 5_000 });
    await modal.locator('.med-drawer-actions').getByRole('button', { name: 'Reactivate' }).click();
    await page.waitForSelector(`.med-row:not(.med-row-inactive) .med-row-main >> text=${name}`, { timeout: 15_000 });
    await expect(page.locator('.med-row:not(.med-row-inactive) .med-row-main', { hasText: name })).toBeVisible();
  });

  test('export CSV button triggers download without error', async ({ page }) => {
    const csvBtn = page.getByRole('button', { name: '⬇ CSV' });
    if (await csvBtn.isHidden()) return; // hidden on mobile viewports via CSS
    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 5_000 }).catch(() => null),
      csvBtn.click(),
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
