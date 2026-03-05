---
name: e2e-test
description: Write Playwright e2e tests for the red-beryl web app. Use when asked to write, add, or scaffold e2e tests.
argument-hint: [what to test]
---

Write a Playwright e2e test for the red-beryl web app. The feature or scenario to test: $ARGUMENTS

## Project conventions

Tests live in `apps/web/tests/` and follow the patterns in `core.spec.ts` and `file-watcher.spec.ts`. Read those files before writing anything new.

## Setup

Every test file imports from the test adapter:

```typescript
import { test, expect } from '@playwright/test';
import {
  setupTestAdapter,
  getFileContent,
  getWriteHistory,
  resetWriteHistory,
  setFileContent,
} from '../src/lib/workspace/adapters/test';
```

Only import the helpers you actually use.

Every test file has this `beforeEach` to clear localStorage:

```typescript
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.clear();
  });
});
```

## File format

The test adapter uses in-memory files. Paths are absolute: `/test-workspace/<name>.md`.

Markdown file content follows the beryljs format:

```
- [ ] Task title p:high due:2026-03-01
	>optional notes line
- [x] Completed task
- [ ] Low priority p:low
```

Labels: `p:high`, `p:medium`, `p:low`; `due:YYYY-MM-DD`. Comments: a `\t>text` line immediately after the task.

## Core test pattern

```typescript
test('description of what it does', async ({ page }) => {
  // 1. Set up in-memory file state
  await setupTestAdapter(page, {
    '/test-workspace/inbox.md': '- [ ] Buy milk\n- [x] Call dentist\n',
    '/test-workspace/work.md': '- [ ] Review PR\n',
  });

  // 2. Navigate — workspace auto-initialises from the test adapter
  await page.goto('/');

  // 3. Assert initial UI state
  await expect(page.locator('text=Buy milk')).toBeVisible();

  // 4. Interact
  await page.getByRole('checkbox').first().click();

  // 5. Wait for debounce (300 ms + buffer)
  await page.waitForTimeout(400);

  // 6. Verify the write
  const content = await getFileContent(page, '/test-workspace/inbox.md');
  expect(content).toContain('[x] Buy milk');
});
```

## Simulating external file changes (file-watcher tests)

```typescript
// Triggers the watch callback — UI should react without page reload
await setFileContent(page, '/test-workspace/inbox.md', '- [ ] New task\n');
await expect(page.locator('text=New task')).toBeVisible();
```

## Verifying writes with write history

```typescript
await resetWriteHistory(page); // clear writes from setup
// ... perform action ...
await page.waitForTimeout(400);
const history = await getWriteHistory(page);
expect(history).toHaveLength(1);
expect(history[0].path).toBe('/test-workspace/inbox.md');
expect(history[0].content).toContain('[x] Buy milk');
```

## Selectors to use

- Visible text: `page.locator('text=...')`
- Role: `page.getByRole('button', { name: '...' })`, `page.getByRole('checkbox')`
- Placeholder input: `page.locator('input[placeholder="..."]')`
- Menu item (task options): `page.getByRole('menuitem', { name: '...' })`

## Debounce

The app debounces file writes at **300 ms**. Always `await page.waitForTimeout(400)` before reading write state.

## What to do

1. Read the existing test files to understand current coverage and patterns.
2. Read the relevant source components if you need to know what selectors exist.
3. Write the new test(s) in the appropriate file — add to an existing `test.describe` block if it fits, or create a new one.
4. Keep tests focused and independent. Each test sets up its own state via `setupTestAdapter`.
