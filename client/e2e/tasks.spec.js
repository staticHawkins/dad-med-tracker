import { test, expect } from '@playwright/test';

const AUTH_URL = '/?testUser=1';

async function goToTasks(page) {
  await page.goto(AUTH_URL);
  await page.waitForSelector('.topbar-menu-wrap', { timeout: 15_000 });
  await page.getByRole('button', { name: 'Go to Tasks' }).click();
  await page.waitForSelector('.tbl-tools', { timeout: 10_000 });
}

async function createTask(page, title) {
  await page.getByRole('button', { name: '+ Add Task' }).click();
  // Desktop renders .modal-task; mobile renders .fs-overlay
  await page.waitForSelector('.modal-task, .fs-overlay', { timeout: 5_000 });
  await page.fill('input[placeholder="e.g. Call cardiology to schedule follow-up"]', title);
  await page.fill('input[type="date"]', '2099-12-31');
  await page.getByRole('button', { name: 'Medical' }).first().click();
  await page.getByRole('button', { name: 'Create task' }).click();
  await page.waitForSelector(`.task-title >> text=${title}`, { timeout: 15_000 });
}

test.describe('tasks', () => {
  test.beforeEach(async ({ page }) => {
    await goToTasks(page);
  });

  test('tasks view renders toolbar and add button', async ({ page }) => {
    await expect(page.locator('.tbl-tools')).toBeVisible();
    await expect(page.getByRole('button', { name: '+ Add Task' })).toBeVisible();
  });

  test('add task creates a row in the list', async ({ page }) => {
    const title = `[e2e] Task ${Date.now()}`;
    await createTask(page, title);
    await expect(page.locator('.task-title', { hasText: title })).toBeVisible();
  });

  test('required-field validation prevents empty task creation', async ({ page }) => {
    await page.getByRole('button', { name: '+ Add Task' }).click();
    // Desktop renders .modal-task; mobile renders .fs-overlay
    await page.waitForSelector('.modal-task, .fs-overlay', { timeout: 5_000 });
    const submitBtn = page.getByRole('button', { name: 'Create task' });
    // Title is empty — button should be disabled or alert fires
    const isDisabled = await submitBtn.isDisabled();
    if (!isDisabled) {
      page.on('dialog', d => d.dismiss());
      await submitBtn.click();
      await expect(page.locator('.modal-task, .fs-overlay').first()).toBeVisible();
    } else {
      await expect(submitBtn).toBeDisabled();
    }
  });

  test('tasks are grouped by category section headers', async ({ page }) => {
    const title = `[e2e] CatTask ${Date.now()}`;
    await createTask(page, title);
    // After creating a task the category sections should render
    await expect(page.locator('.task-cat-sections')).toBeVisible();
  });

  test('clicking task row opens edit modal', async ({ page }) => {
    const title = `[e2e] OpenModal ${Date.now()}`;
    await createTask(page, title);
    await page.locator('.task-title', { hasText: title }).click();
    await page.waitForSelector('.task-edit-modal', { timeout: 5_000 });
    await expect(page.locator('.task-edit-modal')).toBeVisible();
  });

  test('inline edit task title autosaves', async ({ page }) => {
    const title = `[e2e] InlineTask ${Date.now()}`;
    const newTitle = `[e2e] InlineEdited ${Date.now()}`;
    await createTask(page, title);
    await page.locator('.task-title', { hasText: title }).click();
    await page.waitForSelector('.task-edit-modal', { timeout: 5_000 });
    await page.locator('.task-edit-modal .inline-val').first().click();
    await page.locator('.task-edit-modal .inline-input').first().fill(newTitle);
    await page.locator('.task-edit-modal .inline-input').first().press('Enter');
    await page.waitForSelector('.autosave-pill.saved', { timeout: 15_000 });
    await expect(page.locator('.autosave-pill.saved')).toBeVisible();
  });

  test('change task status to In Progress', async ({ page }) => {
    const title = `[e2e] StatusTask ${Date.now()}`;
    await createTask(page, title);
    await page.locator('.task-title', { hasText: title }).click();
    await page.waitForSelector('.task-edit-modal', { timeout: 5_000 });
    await page.locator('.task-edit-modal .status-sel-btn', { hasText: 'In progress' }).click();
    await page.waitForSelector('.autosave-pill.saved', { timeout: 15_000 });
    await expect(page.locator('.task-edit-modal .status-sel-btn.active')).toHaveText('In progress');
  });

  test('change task status to Done', async ({ page }) => {
    const title = `[e2e] DoneTask ${Date.now()}`;
    await createTask(page, title);
    await page.locator('.task-title', { hasText: title }).click();
    await page.waitForSelector('.task-edit-modal', { timeout: 5_000 });
    await page.locator('.task-edit-modal .status-sel-btn', { hasText: 'Done' }).click();
    await page.waitForSelector('.autosave-pill.saved', { timeout: 15_000 });
    await expect(page.locator('.task-edit-modal .status-sel-btn.active')).toHaveText('Done');
  });

  test('add comment to task', async ({ page }) => {
    const title = `[e2e] CommentTask ${Date.now()}`;
    const comment = `test comment ${Date.now()}`;
    await createTask(page, title);
    await page.locator('.task-title', { hasText: title }).click();
    await page.waitForSelector('.task-edit-modal', { timeout: 5_000 });
    await page.fill('.comment-input', comment);
    await page.getByRole('button', { name: 'Post' }).click();
    await page.waitForSelector(`.comment-text >> text=${comment}`, { timeout: 15_000 });
    await expect(page.locator('.comment-text', { hasText: comment })).toBeVisible();
  });

  test('comment survives a status change', async ({ page }) => {
    const title = `[e2e] CommentSurvive ${Date.now()}`;
    const comment = `survive comment ${Date.now()}`;
    await createTask(page, title);
    await page.locator('.task-title', { hasText: title }).click();
    await page.waitForSelector('.task-edit-modal', { timeout: 5_000 });
    await page.fill('.comment-input', comment);
    await page.getByRole('button', { name: 'Post' }).click();
    await page.waitForSelector(`.comment-text >> text=${comment}`, { timeout: 15_000 });
    await page.locator('.task-edit-modal .status-sel-btn', { hasText: 'In progress' }).click();
    await page.waitForSelector('.autosave-pill.saved', { timeout: 15_000 });
    await expect(page.locator('.comment-text', { hasText: comment })).toBeVisible();
  });

  test('delete own comment removes it', async ({ page }) => {
    const title = `[e2e] DelComment ${Date.now()}`;
    const comment = `delete me ${Date.now()}`;
    await createTask(page, title);
    await page.locator('.task-title', { hasText: title }).click();
    await page.waitForSelector('.task-edit-modal', { timeout: 5_000 });
    await page.fill('.comment-input', comment);
    await page.getByRole('button', { name: 'Post' }).click();
    await page.waitForSelector(`.comment-text >> text=${comment}`, { timeout: 15_000 });
    // Find and click the delete button for this comment
    const commentItem = page.locator('.comment-item', { hasText: comment });
    await commentItem.locator('.comment-delete').click();
    await page.waitForSelector(`.comment-text >> text=${comment}`, { state: 'detached', timeout: 10_000 });
    await expect(page.locator('.comment-text', { hasText: comment })).not.toBeVisible();
  });
});
