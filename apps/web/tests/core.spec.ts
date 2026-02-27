import { test, expect } from '@playwright/test'
import { setupTestAdapter, resetWriteHistory } from '../src/lib/adapters/test'

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


//   test('read/write from test adapter and displays tasks', async ({ page }) => {
//        await setupTestAdapter(page, {
//       '/test-workspace/inbox.md': `- [ ] Buy groceries
// - [x] Call mom
// - [ ] Finish report
// `,
//     })

//     await page.goto('/')

//     await expect(page.locator('text=Buy groceries')).toBeVisible()
//     await expect(page.locator('text=Call mom')).toBeVisible()
//     await expect(page.locator('text=Finish report')).toBeVisible()

//     const input = page.locator('input[placeholder="Add a task... press Enter to save"]')
//     await input.fill('Learn Playwright')
//     await input.press('Enter')

//     await expect(page.locator('text=Learn Playwright')).toBeVisible()

//     // Reset write history to track only new changes
//     await resetWriteHistory(page)

//     // Verify file was updated with new task
//     const content = await getFileContent(page, '/test-workspace/inbox.md')
//     expect(content).toContain('Learn Playwright')

//     // Get write history and verify a write occurred
//     const history = await getWriteHistory(page)
//     expect(history.length).toBeGreaterThan(0)

//     // Toggle the first task (Buy groceries) - find its checkbox
//     const firstCheckbox = page.locator('input[type="checkbox"]').first()
//     await firstCheckbox.click()

//     // Verify checkbox is now checked
//     await expect(firstCheckbox).toBeChecked()

//     // Verify file was updated with toggled task
//     const finalContent = await getFileContent(page, '/test-workspace/inbox.md')
//     expect(finalContent).toContain('- [x] Buy groceries')
//     expect(finalContent).toContain('- [ ] Finish report')
//     expect(finalContent).toContain('Learn Playwright') 
//   })
})
