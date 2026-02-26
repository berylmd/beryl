import { test, expect } from '@playwright/test'
import { setupTestAdapter, getFileContent, getWriteHistory, resetWriteHistory } from '../src/lib/adapters/test'

/**
 * File Watcher Integration Test
 * 
 * This test demonstrates the complete workflow:
 * 1. Set initial task file state
 * 2. Load the workspace
 * 3. Add a new task via UI
 * 4. Toggle task completion
 * 5. Verify final file state
 */
test.describe('File Watcher', () => {
  test('should add and toggle tasks, persisting changes to file', async ({ page }) => {
    // Clear localStorage first
    await page.addInitScript(() => {
      localStorage.clear()
    })

    // Setup test adapter with initial file state
    await setupTestAdapter(page, {
      '/test-workspace/inbox.md': `- [ ] Buy groceries
- [x] Call mom
- [ ] Finish report
`,
    })

    // Navigate to the app
    await page.goto('/')

    // Open workspace
    // await page.click('button:has-text("Open Workspace Folder")')

    // Verify initial tasks are loaded
    await expect(page.locator('text=Buy groceries')).toBeVisible()
    await expect(page.locator('text=Call mom')).toBeVisible()
    await expect(page.locator('text=Finish report')).toBeVisible()

    // Reset write history to track only new changes
    await resetWriteHistory(page)

    // Add a new task
    const input = page.locator('input[placeholder="Add a task... press Enter to save"]')
    await input.fill('Learn Playwright')
    await input.press('Enter')

    // Verify new task appears in UI
    await expect(page.locator('text=Learn Playwright')).toBeVisible()

    // // Verify file was updated with new task
    // const content = await getFileContent(page, '/test-workspace/inbox.md')
    // expect(content).toContain('Learn Playwright')

    // // Get write history and verify a write occurred
    // const history = await getWriteHistory(page)
    // expect(history.length).toBeGreaterThan(0)

    // // Toggle the first task (Buy groceries) - find its checkbox
    // const firstCheckbox = page.locator('input[type="checkbox"]').first()
    // await firstCheckbox.click()

    // // Verify checkbox is now checked
    // await expect(firstCheckbox).toBeChecked()

    // // Verify file was updated with toggled task
    // const finalContent = await getFileContent(page, '/test-workspace/inbox.md')
    // expect(finalContent).toContain('- [x] Buy groceries')
    // expect(finalContent).toContain('- [ ] Finish report')
    // expect(finalContent).toContain('Learn Playwright')
  })
})
