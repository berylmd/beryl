# Web Project Restructure Plan

## Goal

Reorganise `apps/web/src` from a flat per-type layout into feature-based folders,
split `data.svelte.ts` into a store + serializer, and replace the single conditional
route with proper SvelteKit routes for `/setup` and `/tasks`.

Zero behaviour changes — this is pure restructuring.

---

## Final target structure

```
apps/web/src/
  lib/
    tasks/
      types.ts              ← was lib/types.ts
      serializer.ts         ← NEW: pure fns extracted from data.svelte.ts
      store.svelte.ts       ← was lib/data.svelte.ts (imports serializer)
      TaskItem.svelte       ← was lib/components/tasks/TaskItem.svelte
      TaskList.svelte       ← was lib/components/tasks/TaskList.svelte
      AddTaskForm.svelte    ← was lib/components/tasks/AddTaskForm.svelte
      EditTaskDialog.svelte ← was lib/components/tasks/EditTaskDialog.svelte
      priority.ts           ← was lib/components/tasks/priority.ts
    workspace/
      store.svelte.ts       ← was lib/workspace.svelte.ts
      WorkspaceSetup.svelte ← was lib/components/WorkspaceSetup.svelte
      adapters/
        electron.ts         ← was lib/adapters/electron.ts
        capacitor.ts        ← was lib/adapters/capacitor.ts
        test.ts             ← was lib/adapters/test.ts
        codegen-setup.ts    ← was lib/adapters/codegen-setup.ts
    theme/
      store.svelte.ts       ← was lib/theme.svelte.ts
    layout/
      AppSidebar.svelte     ← was lib/components/layout/AppSidebar.svelte
      PageHeader.svelte     ← was lib/components/layout/PageHeader.svelte
    hooks/
      is-mobile.svelte.ts   (unchanged)
    components/
      ui/                   (untouched — all shadcn components stay here)
    platform.ts             (unchanged)
  routes/
    layout.css              (unchanged)
    +layout.svelte          (updated: remove SidebarProvider + data load)
    +layout.ts              (unchanged)
    +page.svelte            (replaced: redirect logic only)
    +page.ts                (unchanged)
    setup/
      +page.svelte          ← NEW: renders WorkspaceSetup
    tasks/
      +layout.svelte        ← NEW: SidebarProvider + data load guard
      +page.svelte          ← NEW: task list UI
```

---

## Agent rules

1. Work through the phases **in order**. Each phase leaves the app in a working state.
2. **Never delete a file until every file that imports it has been updated** to use the new path.
3. After finishing each phase: run `pnpm run test` from the repo root.
   Fix any failures before moving to the next phase.
4. After tests pass, **commit** with a message describing the phase (e.g. `refactor: create lib/tasks feature`).
5. No logic changes — copy code exactly, only update import paths.
6. Use `$lib/...` alias for cross-feature imports (e.g. `$lib/workspace/store.svelte.js`).
   Use relative imports only within the same feature folder.

---

## Phase 1 — Create `lib/tasks/`

### Step 1.1 — Create `lib/tasks/types.ts`

Copy `src/lib/types.ts` verbatim to `src/lib/tasks/types.ts`. No changes.

### Step 1.2 — Create `lib/tasks/priority.ts`

Copy `src/lib/components/tasks/priority.ts` verbatim to `src/lib/tasks/priority.ts`. No changes.

### Step 1.3 — Create `lib/tasks/serializer.ts`

Create `src/lib/tasks/serializer.ts` with the following content — these are the pure
functions extracted from `data.svelte.ts`, with the import updated to use `./types.js`:

```typescript
import { parseProject } from '@repo/beryljs'
import type { LabelText } from '@repo/beryljs'
import type { Todo, Priority } from './types.js'

export function stripLabels(description: string): string {
  return description
    .replace(/\b(p|due):\S+/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

export function normalizeComments(comments: unknown): string {
  if (!comments) return ''
  if (Array.isArray(comments)) return (comments as string[]).join('\n')
  return String(comments)
}

export function parsePriority(labels: LabelText[]): Priority {
  const p = labels.find((l) => l.labels.label === 'p')
  if (p?.labels.text === 'high') return 'high'
  if (p?.labels.text === 'low')  return 'low'
  return 'medium'
}

export function parseDueDate(labels: LabelText[]): string | null {
  const d = labels.find((l) => l.labels.label === 'due')
  return d ? d.labels.text : null
}

export function fileNameToListId(filename: string): string {
  return filename.replace(/\.md$/i, '')
}

export function serializeTodo(todo: Todo): string {
  let line = todo.completed ? '- [x]' : '- [ ]'
  line += ` ${todo.title}`
  if (todo.priority === 'high') line += ' p:high'
  if (todo.priority === 'low')  line += ' p:low'
  if (todo.dueDate)             line += ` due:${todo.dueDate}`
  if (todo.notes) {
    for (const noteLine of todo.notes.split('\n')) {
      line += `\n\t>${noteLine}`
    }
  }
  return line
}

export function serializeTodos(todos: Todo[]): string {
  if (todos.length === 0) return ''
  return todos.map(serializeTodo).join('\n') + '\n'
}

export function parseFile(content: string, listId: string): Todo[] {
  let tasks: ReturnType<typeof parseProject>
  try {
    tasks = parseProject(content)
  } catch {
    return []
  }

  return tasks
    .filter((t) => t.indent === 0)
    .map((t) => ({
      id:        crypto.randomUUID(),
      title:     stripLabels(t.description),
      completed: t.checked,
      priority:  parsePriority(t.labels ?? []),
      dueDate:   parseDueDate(t.labels ?? []),
      listId,
      createdAt: new Date().toISOString(),
      notes:     normalizeComments(t.comments),
    }))
}
```

### Step 1.4 — Create `lib/tasks/store.svelte.ts`

Create `src/lib/tasks/store.svelte.ts`. This is `data.svelte.ts` with three changes:
1. Remove the inline helper functions (now in serializer.ts)
2. Import them from `./serializer.js`
3. Import types from `./types.js`
4. Import workspace from `$lib/workspace/store.svelte.js` (note: `workspace` module
   doesn't exist at this path yet — but we're in Phase 1. To keep the build passing,
   temporarily keep importing from `$lib/workspace.svelte.js` for now and update it
   in Phase 2 Step 2.1.)

```typescript
import type { Todo, List } from './types.js'
import {
  fileNameToListId,
  parseFile,
  serializeTodos,
} from './serializer.js'
import { workspace } from '$lib/workspace.svelte.js'   // ← updated in Phase 2

function createDataStore() {
  // ... identical to data.svelte.ts from line 82 onward
  // (copy the entire createDataStore function body exactly)
}

export const dataStore = createDataStore()
```

Full instruction: copy everything from `data.svelte.ts` starting at line 82 (`function createDataStore()`),
remove the helper function declarations above (lines 5–78), and add the imports listed above.

### Step 1.5 — Move task components

For each file below, copy to the new path and update its imports as noted:

**`src/lib/tasks/TaskItem.svelte`** (from `src/lib/components/tasks/TaskItem.svelte`):
- Change `import type { Todo } from '$lib/types.js'` → `import type { Todo } from './types.js'`
- Change `import { dataStore } from '$lib/data.svelte.js'` → `import { dataStore } from './store.svelte.js'`
- Change `import { priorityConfig } from './priority.js'` → stays `./priority.js` (same folder)

**`src/lib/tasks/TaskList.svelte`** (from `src/lib/components/tasks/TaskList.svelte`):
- Change `import type { Todo } from '$lib/types.js'` → `import type { Todo } from './types.js'`
- Change `import TaskItem from './TaskItem.svelte'` → stays `./TaskItem.svelte`

**`src/lib/tasks/AddTaskForm.svelte`** (from `src/lib/components/tasks/AddTaskForm.svelte`):
- Change `import { dataStore } from '$lib/data.svelte.js'` → `import { dataStore } from './store.svelte.js'`
- Change `import type { Priority } from '$lib/types.js'` → `import type { Priority } from './types.js'`
- Change `import { priorityConfig } from './priority.js'` → stays `./priority.js`

**`src/lib/tasks/EditTaskDialog.svelte`** (from `src/lib/components/tasks/EditTaskDialog.svelte`):
- Change `import type { Todo, Priority } from '$lib/types.js'` → `import type { Todo, Priority } from './types.js'`
- Change `import { dataStore } from '$lib/data.svelte.js'` → `import { dataStore } from './store.svelte.js'`

### Step 1.6 — Update files that import old paths

Update these files to import from the new `$lib/tasks/` paths:

**`src/lib/components/layout/AppSidebar.svelte`**:
- Change `import { dataStore } from '$lib/data.svelte.js'` → `import { dataStore } from '$lib/tasks/store.svelte.js'`

**`src/routes/+layout.svelte`**:
- Change `import { dataStore } from '$lib/data.svelte.js'` → `import { dataStore } from '$lib/tasks/store.svelte.js'`

**`src/routes/+page.svelte`**:
- Change `import { dataStore } from '$lib/data.svelte.js'` → `import { dataStore } from '$lib/tasks/store.svelte.js'`
- Change `import type { Todo } from '$lib/types.js'` → `import type { Todo } from '$lib/tasks/types.js'`
- Change `import WorkspaceSetup from '$lib/components/WorkspaceSetup.svelte'` → stays for now (updated in Phase 2)
- Change `import AppSidebar from '../lib/components/layout/AppSidebar.svelte'` → stays for now (updated in Phase 3)
- Change `import PageHeader from '$lib/components/layout/PageHeader.svelte'` → stays for now (updated in Phase 3)
- Change `import AddTaskForm from '$lib/components/tasks/AddTaskForm.svelte'` → `import AddTaskForm from '$lib/tasks/AddTaskForm.svelte'`
- Change `import TaskList from '$lib/components/tasks/TaskList.svelte'` → `import TaskList from '$lib/tasks/TaskList.svelte'`
- Change `import EditTaskDialog from '$lib/components/tasks/EditTaskDialog.svelte'` → `import EditTaskDialog from '$lib/tasks/EditTaskDialog.svelte'`

### Step 1.7 — Run tests and commit

```bash
cd apps/web && pnpm run test
```

Fix any failures. Then commit:
```
git add -A
git commit -m "refactor: create lib/tasks feature (store, serializer, components)"
```

---

## Phase 2 — Create `lib/workspace/`

### Step 2.1 — Create `lib/workspace/adapters/`

Copy these four files verbatim (no import changes needed — they don't import each other):
- `src/lib/adapters/electron.ts` → `src/lib/workspace/adapters/electron.ts`
- `src/lib/adapters/capacitor.ts` → `src/lib/workspace/adapters/capacitor.ts`
- `src/lib/adapters/test.ts` → `src/lib/workspace/adapters/test.ts`
- `src/lib/adapters/codegen-setup.ts` → `src/lib/workspace/adapters/codegen-setup.ts`

### Step 2.2 — Create `lib/workspace/store.svelte.ts`

Copy `src/lib/workspace.svelte.ts` to `src/lib/workspace/store.svelte.ts` and update imports:
- Change `import { createElectronAdapter } from './adapters/electron.js'` → stays `./adapters/electron.js` (same relative path)
- Change `import { createCapacitorAdapter } from './adapters/capacitor.js'` → stays `./adapters/capacitor.js`
- Change `import { detectPlatform } from './platform.js'` → `import { detectPlatform } from '$lib/platform.js'`

### Step 2.3 — Create `lib/workspace/WorkspaceSetup.svelte`

Copy `src/lib/components/WorkspaceSetup.svelte` to `src/lib/workspace/WorkspaceSetup.svelte`
and update imports:
- Change `import { workspace } from '$lib/workspace.svelte.js'` → `import { workspace } from './store.svelte.js'`
- Change `import { dataStore } from '$lib/data.svelte.js'` → `import { dataStore } from '$lib/tasks/store.svelte.js'`

### Step 2.4 — Update all consumers of old workspace/adapter paths

**`src/lib/tasks/store.svelte.ts`**:
- Change `import { workspace } from '$lib/workspace.svelte.js'` → `import { workspace } from '$lib/workspace/store.svelte.js'`

**`src/routes/+layout.svelte`**:
- Change `import { workspace } from '$lib/workspace.svelte.js'` → `import { workspace } from '$lib/workspace/store.svelte.js'`
- Change `import '$lib/adapters/codegen-setup.js'` → `import '$lib/workspace/adapters/codegen-setup.js'`

**`src/routes/+page.svelte`**:
- Change `import { workspace } from '$lib/workspace.svelte.js'` → `import { workspace } from '$lib/workspace/store.svelte.js'`
- Change `import WorkspaceSetup from '$lib/components/WorkspaceSetup.svelte'` → `import WorkspaceSetup from '$lib/workspace/WorkspaceSetup.svelte'`

**`apps/web/tests/core.spec.ts`**:
- Change `import { setupTestAdapter, ... } from '../src/lib/adapters/test'`
  → `import { setupTestAdapter, ... } from '../src/lib/workspace/adapters/test'`

### Step 2.5 — Run tests and commit

```bash
cd apps/web && pnpm run test
```

Fix any failures. Then commit:
```
git add -A
git commit -m "refactor: create lib/workspace feature (store, adapters, WorkspaceSetup)"
```

---

## Phase 3 — Create `lib/theme/` and `lib/layout/`

### Step 3.1 — Create `lib/theme/store.svelte.ts`

Copy `src/lib/theme.svelte.ts` verbatim to `src/lib/theme/store.svelte.ts`. No import changes needed.

### Step 3.2 — Create `lib/layout/PageHeader.svelte`

Copy `src/lib/components/layout/PageHeader.svelte` to `src/lib/layout/PageHeader.svelte`
and update imports:
- Change `import { themeStore } from '$lib/theme.svelte.js'` → `import { themeStore } from '$lib/theme/store.svelte.js'`

### Step 3.3 — Create `lib/layout/AppSidebar.svelte`

Copy `src/lib/components/layout/AppSidebar.svelte` to `src/lib/layout/AppSidebar.svelte`.
The only import that needs updating:
- Change `import { dataStore } from '$lib/tasks/store.svelte.js'` — already updated in Phase 1 Step 1.6,
  but the file being copied is the original. Make sure the copy uses `'$lib/tasks/store.svelte.js'`.

### Step 3.4 — Update all consumers of old theme/layout paths

**`src/routes/+layout.svelte`**:
- Change `import { themeStore } from '$lib/theme.svelte.js'` → `import { themeStore } from '$lib/theme/store.svelte.js'`

**`src/routes/+page.svelte`**:
- Change `import AppSidebar from '../lib/components/layout/AppSidebar.svelte'` → `import AppSidebar from '$lib/layout/AppSidebar.svelte'`
- Change `import PageHeader from '$lib/components/layout/PageHeader.svelte'` → `import PageHeader from '$lib/layout/PageHeader.svelte'`

### Step 3.5 — Run tests and commit

```bash
cd apps/web && pnpm run test
```

Fix any failures. Then commit:
```
git add -A
git commit -m "refactor: create lib/theme and lib/layout features"
```

---

## Phase 4 — Delete old files

Now that all consumers have been updated to the new paths, delete the originals.

### Files to delete

```
src/lib/types.ts
src/lib/data.svelte.ts
src/lib/workspace.svelte.ts
src/lib/theme.svelte.ts
src/lib/adapters/                    (entire directory)
src/lib/components/tasks/            (entire directory)
src/lib/components/layout/           (entire directory)
src/lib/components/WorkspaceSetup.svelte
```

If `src/lib/components/` is now empty (only `ui/` remains), leave `ui/` in place.
`src/lib/components/ui/` is **never touched**.

### Step 4.1 — Run tests and commit

```bash
cd apps/web && pnpm run test
```

Fix any failures. Then commit:
```
git add -A
git commit -m "refactor: delete old flat-structure files after moving to features"
```

---

## Phase 5 — Split routes

### Step 5.1 — Update `routes/+layout.svelte`

Replace its content with the following. Key changes:
- Remove `SidebarProvider` (moves to tasks layout)
- Remove `dataStore` import (data loading moves to tasks layout)
- Keep `workspace.init()` in `onMount`

```svelte
<script lang="ts">
  import '$lib/workspace/adapters/codegen-setup.js'
  import { themeStore } from '$lib/theme/store.svelte.js'
  import { onMount } from 'svelte'
  import { workspace } from '$lib/workspace/store.svelte.js'
  import './layout.css'

  let { children } = $props()

  $effect(() => {
    themeStore.init()
  })

  onMount(() => {
    workspace.init()
  })
</script>

{@render children()}
```

### Step 5.2 — Replace `routes/+page.svelte`

Replace its entire content with redirect logic. When workspace is ready, it navigates
to either `/tasks` or `/setup` depending on whether a workspace folder is set:

```svelte
<script lang="ts">
  import { goto } from '$app/navigation'
  import { workspace } from '$lib/workspace/store.svelte.js'

  $effect(() => {
    if (workspace.isReady) {
      goto(workspace.hasWorkspace ? '/tasks' : '/setup', { replaceState: true })
    }
  })
</script>
```

### Step 5.3 — Create `routes/setup/+page.svelte`

```svelte
<script lang="ts">
  import WorkspaceSetup from '$lib/workspace/WorkspaceSetup.svelte'
</script>

<svelte:head>
  <title>Beryl — Open Workspace</title>
</svelte:head>

<WorkspaceSetup />
```

### Step 5.4 — Update `lib/workspace/WorkspaceSetup.svelte` to navigate after setup

Add navigation so that after a workspace is picked, the app goes to `/tasks`.
Add one import and one `goto` call:

```svelte
<script lang="ts">
  import { goto } from '$app/navigation'        // ← add this
  import { workspace } from './store.svelte.js'
  import { dataStore } from '$lib/tasks/store.svelte.js'

  let picking = $state(false)
  let error   = $state<string | null>(null)

  async function openWorkspace() {
    if (!workspace.fileAdapter) {
      error = 'No file adapter available. Open this app in Electron or on a mobile device.'
      return
    }

    picking = true
    error   = null

    try {
      const dir = await workspace.fileAdapter.pickDirectory()
      if (!dir) return

      workspace.setRootDir(dir)
      await dataStore.loadWorkspace()
      goto('/tasks')                            // ← add this
    } catch (e) {
      error = String(e)
    } finally {
      picking = false
    }
  }
</script>
```

The rest of the template is unchanged.

### Step 5.5 — Create `routes/tasks/+layout.svelte`

This layout wraps the task UI with the sidebar shell and loads data reactively once
the workspace store is ready:

```svelte
<script lang="ts">
  import { goto } from '$app/navigation'
  import { SidebarProvider } from '$lib/components/ui/sidebar/index.js'
  import AppSidebar from '$lib/layout/AppSidebar.svelte'
  import { workspace } from '$lib/workspace/store.svelte.js'
  import { dataStore } from '$lib/tasks/store.svelte.js'

  let { children } = $props()

  $effect(() => {
    if (!workspace.isReady) return
    if (!workspace.hasWorkspace) {
      goto('/setup', { replaceState: true })
      return
    }
    void dataStore.loadWorkspace()
  })
</script>

<SidebarProvider>
  <AppSidebar />
  {@render children()}
</SidebarProvider>
```

### Step 5.6 — Create `routes/tasks/+page.svelte`

Move the task UI from the old `+page.svelte` into this new page:

```svelte
<script lang="ts">
  import { SidebarInset } from '$lib/components/ui/sidebar/index.js'
  import type { Todo } from '$lib/tasks/types.js'
  import { dataStore } from '$lib/tasks/store.svelte.js'
  import PageHeader from '$lib/layout/PageHeader.svelte'
  import AddTaskForm from '$lib/tasks/AddTaskForm.svelte'
  import TaskList from '$lib/tasks/TaskList.svelte'
  import EditTaskDialog from '$lib/tasks/EditTaskDialog.svelte'

  let activeFilter = $state<'all' | 'today' | 'upcoming' | 'completed'>('all')
  let editingTodo = $state<Todo | null>(null)

  function openEdit(id: string) {
    editingTodo = dataStore.todos.find((t) => t.id === id) ?? null
  }
</script>

<svelte:head>
  <title>Beryl</title>
</svelte:head>

{#if dataStore.isLoading}
  <div class="flex items-center justify-center h-screen text-muted-foreground">
    Loading…
  </div>
{:else}
  <SidebarInset>
    <PageHeader title={dataStore.activeListId ?? "Tasks"} />

    <div class="flex flex-1 flex-col p-4 md:p-6">
      {#if dataStore.activeListId}
        <AddTaskForm />
      {/if}
      <TaskList todos={dataStore.filteredTodos} {activeFilter} onedit={openEdit} />
    </div>
  </SidebarInset>

  <EditTaskDialog bind:todo={editingTodo} />
{/if}
```

### Step 5.7 — Run tests and commit

The Playwright tests navigate to `/` which now redirects to `/tasks`. The tests should
still pass because the UI structure is the same, just reached via redirect. If any test
navigates directly to `/` and checks for immediate UI, update it to navigate to `/tasks`.

```bash
cd apps/web && pnpm run test
```

Fix any failures. Then commit:
```
git add -A
git commit -m "refactor: split routes into /setup and /tasks"
```

---

## Done

All five phases complete. The app should behave identically to before. Run a final
full test to confirm:

```bash
cd apps/web && pnpm run test
```
