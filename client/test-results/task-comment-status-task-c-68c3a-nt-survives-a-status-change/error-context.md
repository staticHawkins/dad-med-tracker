# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: task-comment-status.spec.js >> task comments >> comment survives a status change
- Location: e2e/task-comment-status.spec.js:11:3

# Error details

```
TimeoutError: page.waitForSelector: Timeout 15000ms exceeded.
Call log:
  - waiting for locator('.task-title').locator('text=[e2e] comment-status-1777057707791') to be visible

```

# Page snapshot

```yaml
- generic [ref=e2]:
  - generic [ref=e3]:
    - generic [ref=e4]: FamilyCareHub
    - generic [ref=e6]:
      - button "? Ask AI" [ref=e7] [cursor=pointer]:
        - generic [ref=e8]: "?"
        - text: Ask AI
      - button "Test User ▾" [ref=e10] [cursor=pointer]
  - generic [ref=e11]:
    - generic [ref=e12]: 🔔
    - generic [ref=e13]:
      - generic [ref=e14]: Notifications are blocked
      - generic [ref=e15]:
        - text: Go to
        - strong [ref=e16]: Settings → Notifications
        - text: and allow this site to send alerts.
    - button "Dismiss" [ref=e18] [cursor=pointer]: ✕
  - generic [ref=e19]:
    - button "← Dashboard" [ref=e20] [cursor=pointer]
    - generic [ref=e21]: Tasks
  - generic [ref=e22]:
    - generic [ref=e23]:
      - generic [ref=e24]:
        - button "All" [ref=e25] [cursor=pointer]
        - button "Mine" [ref=e26] [cursor=pointer]
        - button "To Do" [ref=e27] [cursor=pointer]
        - button "In Progress" [ref=e28] [cursor=pointer]
        - button "Done" [ref=e29] [cursor=pointer]
      - button "+ Add Task" [ref=e30] [cursor=pointer]
    - generic [ref=e31]: No tasks yet. Click "+ Add Task" to get started.
    - dialog [ref=e33]:
      - generic [ref=e34]:
        - generic [ref=e35]: Add task
        - button "Close" [ref=e36] [cursor=pointer]: ✕
      - generic [ref=e37]: Required
      - generic [ref=e38]:
        - generic [ref=e39]: Title *
        - textbox "e.g. Call cardiology to schedule follow-up" [ref=e40]: "[e2e] comment-status-1777057707791"
      - generic [ref=e41]:
        - generic [ref=e42]: Due date *
        - textbox [ref=e43]: 2099-12-31
      - generic [ref=e44]: Optional
      - generic [ref=e45]:
        - generic [ref=e46]: Description
        - textbox "Additional details…" [ref=e47]
      - generic [ref=e48]:
        - generic [ref=e49]: Status
        - generic [ref=e50]:
          - button "To do" [ref=e51] [cursor=pointer]
          - button "In progress" [ref=e52] [cursor=pointer]
          - button "Done" [ref=e53] [cursor=pointer]
      - generic [ref=e54]:
        - generic [ref=e55]: Priority
        - combobox [ref=e56]:
          - option "Low"
          - option "Medium" [selected]
          - option "High"
      - generic [ref=e57]: Assignment
      - generic [ref=e58]:
        - generic [ref=e59]: Doctors
        - button "Add doctor ▾" [ref=e61] [cursor=pointer]:
          - text: Add doctor
          - generic [ref=e62]: ▾
      - generic [ref=e63]:
        - generic [ref=e64]: Assign to
        - button "Test" [ref=e66] [cursor=pointer]
      - generic [ref=e67]:
        - button "Cancel" [ref=e68] [cursor=pointer]
        - button "Create task" [ref=e69] [cursor=pointer]
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | 
  3  | const AUTH_URL = '/?testUser=1';
  4  | 
  5  | test.describe('task comments', () => {
  6  |   test.beforeEach(async ({ page }) => {
  7  |     await page.goto(AUTH_URL);
  8  |     await page.waitForSelector('.topbar-menu-wrap', { timeout: 15_000 });
  9  |   });
  10 | 
  11 |   test('comment survives a status change', async ({ page }) => {
  12 |     const taskTitle = `[e2e] comment-status-${Date.now()}`;
  13 |     const commentText = 'this comment must survive a status change';
  14 | 
  15 |     // Navigate to Tasks view via the dashboard card
  16 |     await page.getByRole('button', { name: 'Go to Tasks' }).click();
  17 |     await page.waitForSelector('.tbl-tools', { timeout: 10_000 });
  18 | 
  19 |     // Create a new task
  20 |     await page.getByRole('button', { name: '+ Add Task' }).click();
  21 |     await page.waitForSelector('.modal-task', { timeout: 5_000 });
  22 |     await page.fill('input[placeholder="e.g. Call cardiology to schedule follow-up"]', taskTitle);
  23 |     await page.fill('input[type="date"]', '2099-12-31');
  24 |     await page.getByRole('button', { name: 'Create task' }).click();
  25 | 
  26 |     // Wait for the task to appear in the list (Firestore listener sync)
> 27 |     await page.waitForSelector(`.task-title >> text=${taskTitle}`, { timeout: 15_000 });
     |                ^ TimeoutError: page.waitForSelector: Timeout 15000ms exceeded.
  28 | 
  29 |     // Open the task
  30 |     await page.locator('.task-title', { hasText: taskTitle }).click();
  31 |     await page.waitForSelector('.modal-task', { timeout: 5_000 });
  32 | 
  33 |     // Post a comment
  34 |     await page.fill('.comment-input', commentText);
  35 |     await page.getByRole('button', { name: 'Post' }).click();
  36 | 
  37 |     // Wait for comment to appear in the list
  38 |     await page.waitForSelector(`.comment-text >> text=${commentText}`, { timeout: 10_000 });
  39 | 
  40 |     // Change status — this was the operation that wiped comments before the fix
  41 |     await page.getByRole('button', { name: 'In progress' }).click();
  42 | 
  43 |     // Wait for the save to complete
  44 |     await page.waitForSelector('.autosave-pill.saved', { timeout: 10_000 });
  45 | 
  46 |     // Comment must still be visible
  47 |     await expect(page.locator('.comment-text', { hasText: commentText })).toBeVisible();
  48 | 
  49 |     // Status button must reflect the change
  50 |     await expect(page.locator('.status-sel-btn.active')).toHaveText('In progress');
  51 |   });
  52 | });
  53 | 
```