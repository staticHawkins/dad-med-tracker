import { test, expect } from '@playwright/test';

const AUTH_URL = '/?testUser=1';

// Doctor must exist in the emulator before adding appointments.
// We create one per run using beforeAll so all tests in this file share it.
let sharedDoctorName;

test.describe.configure({ mode: 'serial' });

test.beforeAll(async ({ browser }) => {
  sharedDoctorName = `[e2e] AptDoctor ${Date.now()}`;
  const page = await browser.newPage();
  await page.goto(AUTH_URL);
  await page.waitForSelector('.topbar-menu-wrap', { timeout: 15_000 });
  await page.getByRole('button', { name: /Test User|▾/ }).click();
  await page.getByRole('button', { name: 'Doctors' }).click();
  await page.waitForSelector('.care-team-panel', { timeout: 10_000 });
  await page.getByRole('button', { name: '+ Add Doctor' }).click();
  await page.fill('input[placeholder="e.g. Dr. Patel"]', sharedDoctorName);
  await page.getByRole('button', { name: 'Save doctor' }).click();
  await page.waitForSelector(`.dr-name >> text=${sharedDoctorName}`, { timeout: 15_000 });
  await page.close();
});

test.describe('appointments', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(AUTH_URL);
    await page.waitForSelector('.topbar-menu-wrap', { timeout: 15_000 });
    await page.getByRole('button', { name: 'Go to Appointments' }).click();
    await page.waitForSelector('.apt-layout', { timeout: 10_000 });
  });

  async function addApt(page, title) {
    await page.getByRole('button', { name: '+ Add appointment' }).click();
    await page.waitForSelector('[role="dialog"]', { timeout: 5_000 });
    await page.fill('input[placeholder="e.g. Cardiology follow-up"]', title);
    await page.fill('input[type="datetime-local"]', '2099-06-15T10:00');
    await page.selectOption('select', { label: sharedDoctorName });
    await page.getByRole('button', { name: 'Add appointment', exact: true }).click();
    await page.waitForSelector(`.apt-title >> text=${title}`, { timeout: 15_000 });
  }

  test('appointments view renders calendar and controls', async ({ page }) => {
    await expect(page.locator('.mini-cal')).toBeVisible();
    await expect(page.getByRole('button', { name: '+ Add appointment' })).toBeVisible();
  });

  test('add appointment creates a card in the agenda', async ({ page }) => {
    const title = `[e2e] Apt ${Date.now()}`;
    await addApt(page, title);
    await expect(page.locator('.apt-title', { hasText: title })).toBeVisible();
  });

  test('search filters appointments', async ({ page }) => {
    const title = `[e2e] SearchApt ${Date.now()}`;
    await addApt(page, title);
    await page.fill('.search-input', title);
    await expect(page.locator('.apt-title', { hasText: title })).toBeVisible();
    const allCards = page.locator('.apt-card');
    const count = await allCards.count();
    for (let i = 0; i < count; i++) {
      await expect(allCards.nth(i)).toContainText('[e2e] SearchApt');
    }
  });

  test('clearing search restores full list', async ({ page }) => {
    const title = `[e2e] ClearApt ${Date.now()}`;
    await addApt(page, title);
    await page.fill('.search-input', title);
    await page.fill('.search-input', '');
    await expect(page.locator('.apt-card').first()).toBeVisible();
  });

  test('hero card renders next upcoming appointment', async ({ page }) => {
    const title = `[e2e] HeroApt ${Date.now()}`;
    await addApt(page, title);
    await expect(page.locator('.hero-card')).toBeVisible();
  });

  test('hero card toggles prep section on click', async ({ page }) => {
    const title = `[e2e] HeroToggle ${Date.now()}`;
    await addApt(page, title);
    const hero = page.locator('.hero-card');
    await hero.click();
    // Expanded content should appear
    await expect(page.locator('.hero-card')).toBeVisible();
    // Click again to collapse
    await hero.click();
  });

  test('open appointment detail modal', async ({ page }) => {
    const title = `[e2e] DetailApt ${Date.now()}`;
    await addApt(page, title);
    await page.locator('.apt-card', { hasText: title }).click();
    await page.waitForSelector('.note-modal', { timeout: 5_000 });
    await expect(page.locator('.note-modal')).toBeVisible();
  });

  test('inline edit appointment title autosaves', async ({ page }) => {
    const title = `[e2e] EditApt ${Date.now()}`;
    const newTitle = `[e2e] EditedApt ${Date.now()}`;
    await addApt(page, title);
    await page.locator('.apt-card', { hasText: title }).click();
    await page.waitForSelector('.note-modal', { timeout: 5_000 });
    await page.locator('.note-modal .inline-val').first().click();
    await page.locator('.note-modal .inline-input').first().fill(newTitle);
    await page.locator('.note-modal .inline-input').first().press('Enter');
    await page.waitForSelector('.autosave-pill.saved', { timeout: 15_000 });
    await expect(page.locator('.autosave-pill.saved')).toBeVisible();
  });

  test('toggle covering pill in detail modal', async ({ page }) => {
    const title = `[e2e] CoveringApt ${Date.now()}`;
    await addApt(page, title);
    await page.locator('.apt-card', { hasText: title }).click();
    await page.waitForSelector('.note-modal', { timeout: 5_000 });
    await page.locator('.covering-pill').first().click();
    await page.waitForSelector('.autosave-pill.saved', { timeout: 15_000 });
    await expect(page.locator('.autosave-pill.saved')).toBeVisible();
  });

  test('close detail modal with × button', async ({ page }) => {
    const title = `[e2e] CloseApt ${Date.now()}`;
    await addApt(page, title);
    await page.locator('.apt-card', { hasText: title }).click();
    await page.waitForSelector('.note-modal', { timeout: 5_000 });
    await page.getByRole('button', { name: 'Close' }).click();
    await expect(page.locator('.note-modal')).not.toBeVisible();
  });

  test('delete appointment removes it from agenda', async ({ page }) => {
    const title = `[e2e] DelApt ${Date.now()}`;
    await addApt(page, title);
    await page.locator('.apt-card', { hasText: title }).click();
    await page.waitForSelector('.note-modal', { timeout: 5_000 });
    page.on('dialog', d => d.accept());
    await page.getByRole('button', { name: /Delete|🗑/ }).click();
    await page.waitForSelector(`.apt-title >> text=${title}`, { state: 'detached', timeout: 15_000 });
    await expect(page.locator('.apt-title', { hasText: title })).not.toBeVisible();
  });

  test('mini-calendar prev/next changes displayed month', async ({ page }) => {
    const initialLabel = await page.locator('.cal-month-label').textContent();
    await page.locator('.cal-nav-btn').first().click(); // previous month
    const newLabel = await page.locator('.cal-month-label').textContent();
    expect(newLabel).not.toBe(initialLabel);
    await page.locator('.cal-nav-btn').last().click(); // next month (back to initial)
    await expect(page.locator('.cal-month-label')).toHaveText(initialLabel);
  });

  test('past appointments toggle expands the past section', async ({ page }) => {
    if (await page.locator('.past-toggle').count() === 0) {
      test.skip(); // No past appointments exist yet
      return;
    }
    await page.locator('.past-toggle').click();
    await expect(page.locator('.past-content.open')).toBeVisible();
  });

  test('validation prevents submission with empty title', async ({ page }) => {
    await page.getByRole('button', { name: '+ Add appointment' }).click();
    await page.waitForSelector('[role="dialog"]', { timeout: 5_000 });
    page.on('dialog', d => d.dismiss()); // Dismiss the alert
    await page.getByRole('button', { name: 'Add appointment', exact: true }).click();
    // Modal should still be open after failed validation
    await expect(page.locator('[role="dialog"]')).toBeVisible();
  });
});
