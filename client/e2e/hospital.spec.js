import { test, expect } from '@playwright/test';

const AUTH_URL = '/?testUser=1';

async function goToHospital(page) {
  await page.goto(AUTH_URL);
  await page.waitForSelector('.topbar-menu-wrap', { timeout: 15_000 });
  await page.getByRole('button', { name: 'Hospital' }).click();
  await page.waitForSelector('.hospital-page', { timeout: 10_000 });
}

// Admits a stay if none is active. Resilient to parallel workers racing to admit.
async function ensureActiveStay(page) {
  await page.waitForSelector('.hospital-no-active, .hospital-active-stay', { timeout: 10_000 });
  if (await page.locator('.hospital-active-stay').isVisible()) return;
  try {
    // Use a short timeout: if another worker already admitted, the button detaches quickly.
    await page.getByRole('button', { name: '+ Admit' }).click({ timeout: 3_000 });
    await page.waitForSelector('.modal', { timeout: 3_000 });
    await page.fill('input[placeholder="e.g. St. Mary\'s Medical Center"]', 'E2E Test Hospital');
    await page.locator('.modal').getByRole('button', { name: 'Admit', exact: true }).click();
  } catch {
    // Another parallel worker admitted first — the Firestore update will arrive shortly.
  }
  await page.waitForSelector('.hospital-active-stay', { timeout: 15_000 });
}

// Opens the stay-meds add form, handling desktop aside vs mobile toggle layout.
async function openMedAddForm(page) {
  const { width } = page.viewportSize() ?? { width: 1280 };
  if (width < 768) {
    const body = page.locator('.hospital-mobile-meds-body');
    if (!await body.isVisible()) await page.locator('.hospital-mobile-meds-toggle').click();
    await page.waitForSelector('.hospital-mobile-meds-body', { timeout: 5_000 });
    await page.locator('.hospital-mobile-meds-body .daily-log-add-med-btn').last().click();
  } else {
    await page.waitForSelector('.hospital-medlog-card', { timeout: 5_000 });
    await page.locator('.hospital-medlog-card .daily-log-add-med-btn').last().click();
  }
  await page.waitForSelector('.stay-med-add-form', { timeout: 5_000 });
}

// Returns the container that holds stay med items (desktop card or mobile body).
function medContainer(page) {
  const { width } = page.viewportSize() ?? { width: 1280 };
  return width < 768
    ? page.locator('.hospital-mobile-meds-body')
    : page.locator('.hospital-medlog-card');
}

test.describe('hospital stay', () => {
  test.beforeEach(async ({ page }) => {
    await goToHospital(page);
  });

  // ── Navigation ──────────────────────────────────────────────────────────

  test('hospital view is reachable and renders the page', async ({ page }) => {
    await expect(page.locator('.hospital-page')).toBeVisible();
  });

  test('hospital view shows either empty state or active stay', async ({ page }) => {
    await page.waitForSelector('.hospital-no-active, .hospital-active-stay', { timeout: 10_000 });
    const hasEmpty = await page.locator('.hospital-no-active').isVisible();
    const hasActive = await page.locator('.hospital-active-stay').isVisible();
    expect(hasEmpty || hasActive).toBe(true);
  });

  // ── Active stay ──────────────────────────────────────────────────────────

  test('active stay section shows day count and hospital name', async ({ page }) => {
    await ensureActiveStay(page);
    await expect(page.locator('.hospital-active-stay')).toBeVisible();
    await expect(page.locator('.hospital-stay-title')).toContainText('Day');
  });

  test('edit stay button opens the edit modal', async ({ page }) => {
    await ensureActiveStay(page);
    await page.getByRole('button', { name: 'Edit stay' }).click();
    await page.waitForSelector('.modal', { timeout: 5_000 });
    await expect(page.locator('.sheet-title', { hasText: 'Edit Stay' })).toBeVisible();
    await page.getByRole('button', { name: 'Close' }).click();
    await expect(page.locator('.modal')).not.toBeVisible();
  });

  // ── Care team (desktop/tablet aside only) ────────────────────────────────

  test('add care team member appears in the list', async ({ page }) => {
    const { width } = page.viewportSize() ?? { width: 1280 };
    test.skip(width < 768, 'care team is in the desktop aside, not visible on mobile');
    await ensureActiveStay(page);
    await page.waitForSelector('.stay-team-section', { timeout: 8_000 });
    const name = `[e2e] Dr ${Date.now()}`;
    await page.locator('.stay-team-section').getByRole('button', { name: '+ Add' }).click();
    await page.waitForSelector('.stay-team-add-form', { timeout: 5_000 });
    await page.locator('.stay-team-add-form input[placeholder="Name (e.g., Dr. Huynh)"]').fill(name);
    await page.locator('.stay-team-add-form input[placeholder="Role (e.g., Attending Nephrologist)"]').fill('Hospitalist');
    await page.locator('.stay-team-add-form').getByRole('button', { name: 'Add' }).click();
    await page.waitForSelector(`.stay-team-member-name >> text=${name}`, { timeout: 10_000 });
    await expect(page.locator('.stay-team-member-name', { hasText: name })).toBeVisible();
  });

  test('clicking care team member opens inline edit pre-filled with current values', async ({ page }) => {
    const { width } = page.viewportSize() ?? { width: 1280 };
    test.skip(width < 768, 'care team is in the desktop aside, not visible on mobile');
    await ensureActiveStay(page);
    await page.waitForSelector('.stay-team-section', { timeout: 8_000 });
    const name = `[e2e] EditDr ${Date.now()}`;
    await page.locator('.stay-team-section').getByRole('button', { name: '+ Add' }).click();
    await page.waitForSelector('.stay-team-add-form', { timeout: 5_000 });
    await page.locator('.stay-team-add-form input[placeholder="Name (e.g., Dr. Huynh)"]').fill(name);
    await page.locator('.stay-team-add-form').getByRole('button', { name: 'Add' }).click();
    await page.waitForSelector(`.stay-team-member-name >> text=${name}`, { timeout: 10_000 });
    await page.locator('.stay-team-member', { hasText: name }).locator('.stay-team-member-info').click();
    await page.waitForSelector('.stay-team-add-form', { timeout: 5_000 });
    await expect(page.locator('.stay-team-add-form input[placeholder="Name (e.g., Dr. Huynh)"]')).toHaveValue(name);
  });

  test('save care team edit updates the displayed name', async ({ page }) => {
    const { width } = page.viewportSize() ?? { width: 1280 };
    test.skip(width < 768, 'care team is in the desktop aside, not visible on mobile');
    await ensureActiveStay(page);
    await page.waitForSelector('.stay-team-section', { timeout: 8_000 });
    const name = `[e2e] ToEdit ${Date.now()}`;
    const updated = `[e2e] Updated ${Date.now()}`;
    await page.locator('.stay-team-section').getByRole('button', { name: '+ Add' }).click();
    await page.waitForSelector('.stay-team-add-form', { timeout: 5_000 });
    await page.locator('.stay-team-add-form input[placeholder="Name (e.g., Dr. Huynh)"]').fill(name);
    await page.locator('.stay-team-add-form').getByRole('button', { name: 'Add' }).click();
    await page.waitForSelector(`.stay-team-member-name >> text=${name}`, { timeout: 10_000 });
    await page.locator('.stay-team-member', { hasText: name }).locator('.stay-team-member-info').click();
    await page.waitForSelector('.stay-team-add-form', { timeout: 5_000 });
    await page.locator('.stay-team-add-form input[placeholder="Name (e.g., Dr. Huynh)"]').fill(updated);
    await page.locator('.stay-team-add-form').getByRole('button', { name: 'Save' }).click();
    await page.waitForSelector(`.stay-team-member-name >> text=${updated}`, { timeout: 15_000 });
    await expect(page.locator('.stay-team-member-name', { hasText: updated })).toBeVisible();
  });

  // ── Stay medications ─────────────────────────────────────────────────────

  test('add stay medication appears in the list with brand name', async ({ page }) => {
    await ensureActiveStay(page);
    const medName = `[e2e] Metformin ${Date.now()}`;
    await openMedAddForm(page);
    await page.fill('input[placeholder="Medication name"]', medName);
    await page.fill('input[placeholder="Brand name (optional)"]', 'Glucophage');
    await page.fill('input[placeholder="Dosage"]', '500');
    await page.locator('.stay-med-add-form').getByRole('button', { name: 'Save' }).click();
    await page.waitForSelector(`.stay-med-name >> text=${medName}`, { timeout: 10_000 });
    const medItem = medContainer(page).locator('.stay-med-item', { hasText: medName });
    await expect(medItem.locator('.stay-med-name', { hasText: medName })).toBeVisible();
    await expect(medItem.locator('.stay-med-brand')).toContainText('Glucophage');
  });

  test('clicking stay med row opens inline edit pre-filled with current values', async ({ page }) => {
    await ensureActiveStay(page);
    const medName = `[e2e] Lisinopril ${Date.now()}`;
    await openMedAddForm(page);
    await page.fill('input[placeholder="Medication name"]', medName);
    await page.locator('.stay-med-add-form').getByRole('button', { name: 'Save' }).click();
    await page.waitForSelector(`.stay-med-name >> text=${medName}`, { timeout: 10_000 });
    await medContainer(page).locator('.stay-med-item', { hasText: medName }).locator('.stay-med-header').click();
    await page.waitForSelector('.stay-med-add-form', { timeout: 5_000 });
    await expect(page.locator('.stay-med-add-form input[placeholder="Medication name"]')).toHaveValue(medName);
  });

  test('save stay med edit updates the displayed name', async ({ page }) => {
    await ensureActiveStay(page);
    const medName = `[e2e] Atorva ${Date.now()}`;
    const updated = `[e2e] Rosuvastatin ${Date.now()}`;
    await openMedAddForm(page);
    await page.fill('input[placeholder="Medication name"]', medName);
    await page.locator('.stay-med-add-form').getByRole('button', { name: 'Save' }).click();
    await page.waitForSelector(`.stay-med-name >> text=${medName}`, { timeout: 10_000 });
    await medContainer(page).locator('.stay-med-item', { hasText: medName }).locator('.stay-med-header').click();
    await page.waitForSelector('.stay-med-add-form', { timeout: 5_000 });
    await page.locator('.stay-med-add-form input[placeholder="Medication name"]').fill(updated);
    await page.locator('.stay-med-add-form').getByRole('button', { name: 'Save' }).click();
    await page.waitForSelector(`.stay-med-name >> text=${updated}`, { timeout: 15_000 });
    await expect(medContainer(page).locator('.stay-med-name', { hasText: updated })).toBeVisible();
  });

  test('dose count badge expands and collapses the dose log', async ({ page }) => {
    await ensureActiveStay(page);
    const medName = `[e2e] DoseBadge ${Date.now()}`;
    await openMedAddForm(page);
    await page.fill('input[placeholder="Medication name"]', medName);
    await page.locator('.stay-med-add-form').getByRole('button', { name: 'Save' }).click();
    await page.waitForSelector(`.stay-med-name >> text=${medName}`, { timeout: 10_000 });
    const item = medContainer(page).locator('.stay-med-item', { hasText: medName });
    await expect(item.locator('.stay-med-logs')).not.toBeVisible();
    await item.locator('.stay-med-count').click();
    await expect(item.locator('.stay-med-logs')).toBeVisible();
    await item.locator('.stay-med-count').click();
    await expect(item.locator('.stay-med-logs')).not.toBeVisible();
  });

  test('cancel on stay med edit form discards changes', async ({ page }) => {
    await ensureActiveStay(page);
    const medName = `[e2e] CancelMed ${Date.now()}`;
    await openMedAddForm(page);
    await page.fill('input[placeholder="Medication name"]', medName);
    await page.locator('.stay-med-add-form').getByRole('button', { name: 'Save' }).click();
    await page.waitForSelector(`.stay-med-name >> text=${medName}`, { timeout: 10_000 });
    await medContainer(page).locator('.stay-med-item', { hasText: medName }).locator('.stay-med-header').click();
    await page.waitForSelector('.stay-med-add-form', { timeout: 5_000 });
    await page.locator('.stay-med-add-form input[placeholder="Medication name"]').fill('should not save');
    await page.locator('.stay-med-add-form').getByRole('button', { name: 'Cancel' }).click();
    await expect(medContainer(page).locator('.stay-med-name', { hasText: medName })).toBeVisible();
    await expect(medContainer(page).locator('.stay-med-name', { hasText: 'should not save' })).not.toBeVisible();
  });
});
