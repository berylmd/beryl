import { test, expect } from '@playwright/test';
import {
  setupTestAdapter,
  setFileContent,
  resetWriteHistory,
} from '../src/lib/workspace/adapters/test';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.clear();
  });
});

test.describe('File watcher — external changes', () => {
  test('new task added externally appears in UI', async ({ page }) => {
    await setupTestAdapter(page, {
      '/test-workspace/inbox.md': `- [ ] Original task\n`,
    });

    await page.goto('/');
    await expect(page.locator('text=Original task')).toBeVisible();

    // Simulate an external editor adding a task
    await setFileContent(
      page,
      '/test-workspace/inbox.md',
      `- [ ] Original task\n- [ ] Externally added task\n`
    );

    await expect(page.locator('text=Externally added task')).toBeVisible();
  });

  test('task completed externally shows as checked', async ({ page }) => {
    await setupTestAdapter(page, {
      '/test-workspace/inbox.md': `- [ ] Buy milk\n- [ ] Walk dog\n`,
    });

    await page.goto('/');
    await expect(page.locator('text=Buy milk')).toBeVisible();

    // Simulate external editor checking the task
    await setFileContent(page, '/test-workspace/inbox.md', `- [x] Buy milk\n- [ ] Walk dog\n`);

    // The checked task should now appear with a strikethrough / completed style
    const checkedCheckbox = page.getByRole('checkbox').first();
    await expect(checkedCheckbox).toBeChecked();
  });

  test('task deleted externally disappears from UI', async ({ page }) => {
    await setupTestAdapter(page, {
      '/test-workspace/inbox.md': `- [ ] Keep this\n- [ ] Delete this\n`,
    });

    await page.goto('/');
    await expect(page.locator('text=Delete this')).toBeVisible();

    // Simulate external deletion
    await setFileContent(page, '/test-workspace/inbox.md', `- [ ] Keep this\n`);

    await expect(page.locator('text=Delete this')).not.toBeVisible();
    await expect(page.locator('text=Keep this')).toBeVisible();
  });

  test('new list file added externally appears in sidebar', async ({ page }) => {
    await setupTestAdapter(page, {
      '/test-workspace/inbox.md': `- [ ] Some task\n`,
    });

    await page.goto('/');
    await expect(page.getByRole('button', { name: 'inbox' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'work' })).not.toBeVisible();

    // Simulate a sync tool dropping a new file
    await setFileContent(page, '/test-workspace/work.md', `- [ ] Work task\n`);

    await expect(page.getByRole('button', { name: 'work' })).toBeVisible();
  });

  test('external change to inactive list does not disrupt active view', async ({ page }) => {
    await setupTestAdapter(page, {
      '/test-workspace/inbox.md': `- [ ] Inbox task\n`,
      '/test-workspace/work.md': `- [ ] Work task\n`,
    });

    await page.goto('/');
    // Active list defaults to first (inbox)
    await expect(page.locator('text=Inbox task')).toBeVisible();

    // Externally change the inactive list
    await setFileContent(page, '/test-workspace/work.md', `- [ ] Work task\n- [ ] New work task\n`);

    // Active view should still show inbox tasks
    await expect(page.locator('text=Inbox task')).toBeVisible();
    await expect(page.locator('text=New work task')).not.toBeVisible();

    // Switching to work list should show the new task
    await page.getByRole('button', { name: 'work' }).click();
    await expect(page.locator('text=New work task')).toBeVisible();
  });
});

test.describe('File watcher — own writes do not cause flash', () => {
  test('toggling a task does not show loading spinner', async ({ page }) => {
    await setupTestAdapter(page, {
      '/test-workspace/inbox.md': `- [ ] Buy groceries\n`,
    });

    await page.goto('/');
    await expect(page.locator('text=Buy groceries')).toBeVisible();

    // Watch for the loading spinner appearing after initial load
    let flashDetected = false;
    page.on('domcontentloaded', () => {}); // keep page alive
    const checkFlash = async () => {
      const spinner = page.locator('text=Loading…');
      // Poll briefly after the action
      for (let i = 0; i < 10; i++) {
        if (await spinner.isVisible()) {
          flashDetected = true;
          break;
        }
        await page.waitForTimeout(50);
      }
    };

    // Toggle a task and check for flash simultaneously
    await Promise.all([page.getByRole('checkbox').first().click(), checkFlash()]);

    // Wait for save debounce to flush
    await page.waitForTimeout(400);

    expect(flashDetected).toBe(false);
    // Task list is still visible
    await expect(page.locator('text=Buy groceries')).toBeVisible();
  });

  test('adding a task does not show loading spinner', async ({ page }) => {
    await setupTestAdapter(page, {
      '/test-workspace/inbox.md': `- [ ] Existing task\n`,
    });

    await page.goto('/');
    await expect(page.locator('text=Existing task')).toBeVisible();

    const input = page.locator('input[placeholder="Add a task... press Enter to save"]');
    await input.fill('New task');
    await input.press('Enter');

    // Wait for debounce
    await page.waitForTimeout(400);

    // Loading spinner should never have appeared (task list stays visible throughout)
    await expect(page.locator('text=Loading…')).not.toBeVisible();
    await expect(page.locator('text=Existing task')).toBeVisible();
    await expect(page.locator('text=New task')).toBeVisible();
  });

  test('own write does not reload and overwrite in-flight edits', async ({ page }) => {
    await setupTestAdapter(page, {
      '/test-workspace/inbox.md': `- [ ] Task one\n- [ ] Task two\n`,
    });

    await page.goto('/');
    await expect(page.locator('text=Task one')).toBeVisible();

    await resetWriteHistory(page);

    // Toggle task one
    await page.getByRole('checkbox').first().click();

    // Immediately add another task before debounce fires
    const input = page.locator('input[placeholder="Add a task... press Enter to save"]');
    await input.fill('Task three');
    await input.press('Enter');

    // Wait for all saves to flush
    await page.waitForTimeout(600);

    // All three tasks should be present and correct
    await expect(page.locator('text=Task one')).toBeVisible();
    await expect(page.locator('text=Task two')).toBeVisible();
    await expect(page.locator('text=Task three')).toBeVisible();
  });
});
