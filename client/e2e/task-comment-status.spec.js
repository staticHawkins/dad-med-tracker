import { test, expect } from '@playwright/test';

const AUTH_URL = '/?testUser=1';

test.describe('task comments', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(AUTH_URL);
    await page.waitForSelector('.topbar-menu-wrap', { timeout: 15_000 });
  });

  test('comment survives a status change', async ({ page }) => {
    const taskTitle = `[e2e] comment-status-${Date.now()}`;
    const commentText = 'this comment must survive a status change';

    // Navigate to Tasks view via the dashboard card
    await page.getByRole('button', { name: 'Go to Tasks' }).click();
    await page.waitForSelector('.tbl-tools', { timeout: 10_000 });

    // Create a new task
    await page.getByRole('button', { name: '+ Add Task' }).click();
    await page.waitForSelector('.modal-task, .edit-sheet.open', { timeout: 5_000 });
    await page.fill('input[placeholder="e.g. Call cardiology to schedule follow-up"]', taskTitle);
    await page.fill('input[type="date"]', '2099-12-31');
    await page.getByRole('button', { name: 'Medical' }).first().click();
    await page.getByRole('button', { name: 'Create task' }).click();

    // Wait for the task to appear in the list (Firestore listener sync)
    await page.waitForSelector(`.task-title >> text=${taskTitle}`, { timeout: 15_000 });

    // Open the task
    await page.locator('.task-title', { hasText: taskTitle }).click();
    await page.waitForSelector('.modal-task, .edit-sheet.open', { timeout: 5_000 });

    // Post a comment
    await page.fill('.comment-input', commentText);
    await page.getByRole('button', { name: 'Post' }).click();

    // Wait for comment to appear in the list
    await page.waitForSelector(`.comment-text >> text=${commentText}`, { timeout: 10_000 });

    // Change status — this was the operation that wiped comments before the fix
    await page.locator('.modal-task .status-sel-btn', { hasText: 'In progress' }).click();

    // Wait for the save to complete
    await page.waitForSelector('.autosave-pill.saved', { timeout: 10_000 });

    // Comment must still be visible
    await expect(page.locator('.comment-text', { hasText: commentText })).toBeVisible();

    // Status button must reflect the change
    await expect(page.locator('.status-sel-btn.active')).toHaveText('In progress');
  });
});
