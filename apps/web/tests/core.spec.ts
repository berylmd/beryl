import { test, expect } from '@playwright/test'
import { setupTestAdapter, resetWriteHistory, getFileContent, getWriteHistory } from '../src/lib/workspace/adapters/test'

test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.clear()
    })
});

test.describe('Core functionality', () => {

  test('reads from test adapter and displays tasks', async ({ page }) => {
    await setupTestAdapter(page, {
      '/test-workspace/inbox.md': `- [ ] Buy groceries
- [x] Call mom
- [ ] Finish report
`,
    })

    await page.goto('/')

    await expect(page.locator('text=Buy groceries')).toBeVisible()
    await expect(page.locator('text=Call mom')).toBeVisible()
    await expect(page.locator('text=Finish report')).toBeVisible()

    const input = page.locator('input[placeholder="Add a task... press Enter to save"]')
    await input.fill('Learn Playwright')
    await input.press('Enter')

    await expect(page.locator('text=Learn Playwright')).toBeVisible()
  })


  test('sidebar has all projects', async ({ page }) => {
    await setupTestAdapter(page, {
      '/test-workspace/project1.md': `- [ ] task1`,
      '/test-workspace/project2.md': `- [ ] task2`
    })

    await page.goto('/')

    await expect(page.getByRole('button', { name: 'project1' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'project2' })).toBeVisible()
  })

  test('sidebar changes projects', async ({ page }) => {
    await setupTestAdapter(page, {
      '/test-workspace/project1.md': `- [ ] task1`,
      '/test-workspace/project2.md': `- [ ] task2`
    })

    await page.goto('/')

    const input = page.getByRole('button', { name: 'project2' })

    await expect(page.locator('text=task1')).toBeVisible()

    input.click()

    await expect(page.locator('text=task2')).toBeVisible()
  })


  test('multiple projects only have their own task', async ({ page }) => {
    await setupTestAdapter(page, {
      '/test-workspace/project1.md': `- [ ] task1`,
      '/test-workspace/project2.md': `- [ ] task2`
    })

    await page.goto('/')

    await expect(page.locator('text=task1')).toBeVisible()
    await expect(page.locator('text=task2')).not.toBeVisible()
  })
})

test.describe('Write-back functionality', () => {

  test('adding a task writes to file', async ({ page }) => {
    await setupTestAdapter(page, {
      '/test-workspace/inbox.md': `- [ ] Existing task
`,
    })

    await page.goto('/')

    // Wait for initial load
    await expect(page.locator('text=Existing task')).toBeVisible()

    // Reset history before making changes
    await resetWriteHistory(page)

    // Add a new task
    const input = page.locator('input[placeholder="Add a task... press Enter to save"]')
    await input.fill('New task')
    await input.press('Enter')

    // Wait for the write to complete (debounced at 300ms)
    await page.waitForTimeout(400)

    // Verify the file was updated
    const content = await getFileContent(page, '/test-workspace/inbox.md')
    expect(content).toContain('New task')
    expect(content).toContain('Existing task')

    // Verify write history
    const history = await getWriteHistory(page)
    expect(history.length).toBeGreaterThan(0)
    expect(history[0].path).toBe('/test-workspace/inbox.md')
  })

  test('toggling a task writes to file', async ({ page }) => {
    await setupTestAdapter(page, {
      '/test-workspace/inbox.md': `- [ ] Buy groceries
- [x] Call mom
`,
    })

    await page.goto('/')

    // Wait for initial load
    await expect(page.locator('text=Buy groceries')).toBeVisible()

    // Reset history before making changes
    await resetWriteHistory(page)

    // Toggle the first task (Buy groceries)
    const firstCheckbox = page.getByRole('checkbox').first()
    await firstCheckbox.click()

    // Wait for the write to complete (debounced at 300ms)
    await page.waitForTimeout(400)

    // Verify the file was updated
    const content = await getFileContent(page, '/test-workspace/inbox.md')
    expect(content).toContain('- [x] Buy groceries')
    expect(content).toContain('- [x] Call mom')

    // Verify write history
    const history = await getWriteHistory(page)
    expect(history.length).toBeGreaterThan(0)
    expect(history[0].path).toBe('/test-workspace/inbox.md')
  })

  test('deleting a task writes to file', async ({ page }) => {
    await setupTestAdapter(page, {
      '/test-workspace/inbox.md': `- [ ] Task to delete
- [ ] Keep this task
`,
    })

    await page.goto('/')

    // Wait for initial load
    await expect(page.locator('text=Task to delete')).toBeVisible()

    // Reset history before making changes
    await resetWriteHistory(page)

    // First, hover over the task to reveal the menu button
    await page.locator('text=Task to delete').hover()

    // Click the more options button (three dots)
    await page.locator('button[aria-label="Task options"]').first().click()

    // Click the Delete option in the dropdown
    await page.getByRole('menuitem', { name: 'Delete' }).click()

    // Wait for the write to complete (debounced at 300ms)
    await page.waitForTimeout(400)

    // Verify the deleted task is no longer in the file
    const content = await getFileContent(page, '/test-workspace/inbox.md')
    expect(content).not.toContain('Task to delete')
    expect(content).toContain('Keep this task')

    // Verify write history
    const history = await getWriteHistory(page)
    expect(history.length).toBeGreaterThan(0)
  })

  test('adding task with priority writes priority to file', async ({ page }) => {
    await setupTestAdapter(page, {
      '/test-workspace/inbox.md': `- [ ] Regular task
`,
    })

    await page.goto('/')

    // Wait for initial load
    await expect(page.locator('text=Regular task')).toBeVisible()

    // Reset history before making changes
    await resetWriteHistory(page)

    // Add a high priority task - need to check how the UI handles priority
    // For now, test that basic add works and check the format
    const input = page.locator('input[placeholder="Add a task... press Enter to save"]')
    await input.fill('High priority task p:high')
    await input.press('Enter')

    // Wait for the write to complete
    await page.waitForTimeout(400)

    // Verify the file contains the priority marker
    const content = await getFileContent(page, '/test-workspace/inbox.md')
    expect(content).toContain('p:high')
  })

})

test.describe('empty start', () => {
  test('test', async ({ page }) => {

    await setupTestAdapter(page, {
    })

    await page.goto('/');

    await expect(page.getByRole('textbox', { name: 'Add a task... press Enter to' })).not.toBeVisible()
    // await .fill('test');
    // await page.getByRole('button', { name: 'Add' }).click();
  });
})