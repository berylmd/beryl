# Beryl: Read Files From Disk

## Who This Is For

This plan is for an AI coding agent. It is written to be unambiguous. Read `architecture.md` first. Do each step in order. Do not skip ahead. Do not implement anything not described here.

---

## Goal

By the end of this plan, the Electron app will:
1. Show a "pick a folder" screen on first launch
2. Read all `.md` files from the chosen folder
3. Parse them with beryljs and display the tasks in the existing UI
4. Remember the chosen folder across restarts

Writing files back to disk, the file watcher, and mobile (Capacitor) are **out of scope**. The Capacitor adapter is stubbed so the codebase compiles — it is not functional yet.

---

## Current State

**What exists and works:**
- `apps/web` — SvelteKit app with a complete todo UI. All data is hardcoded in-memory in `todos.svelte.ts`.
- `apps/desktop` — Electron shell. `main.js` creates a window. `preload.js` is empty.
- `apps/native` — Capacitor shell. Not touched in this plan.
- `packages/beryljs` — Nearley parser. `parseProject(string): Task[]`. Not connected to the UI yet.

**What does NOT exist yet (will be created in this plan):**
- `packages/file-adapter/` — the FileAdapter interface
- `apps/web/src/lib/platform.ts`
- `apps/web/src/lib/adapters/electron.ts`
- `apps/web/src/lib/adapters/capacitor.ts` (stub only)
- `apps/web/src/lib/workspace.svelte.ts`
- `apps/web/src/lib/data.svelte.ts`
- `apps/web/src/lib/components/WorkspaceSetup.svelte`
- IPC handlers in `apps/desktop/src/main.js`
- contextBridge impl in `apps/desktop/src/preload.js`

---

## Phase 1: FileAdapter Interface Package

**Goal:** Define the contract every platform adapter must implement.

### Step 1.1 — Create `packages/file-adapter/package.json`

```json
{
  "name": "@beryl/file-adapter",
  "version": "0.1.0",
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": {
    ".": "./src/index.ts"
  }
}
```

### Step 1.2 — Create `packages/file-adapter/src/index.ts`

```typescript
/**
 * FileAdapter — the contract between the Beryl UI and the host platform.
 *
 * Electron: implemented via Node.js fs through Electron IPC
 * Capacitor: implemented via @capacitor/filesystem (stubbed for now)
 *
 * The UI never touches the filesystem directly. It always goes through this interface.
 */
export interface FileAdapter {
  /** Read a file as a UTF-8 string. Throw if not found. */
  readFile(path: string): Promise<string>

  /** Write a UTF-8 string to a file. Create if missing, overwrite if exists. */
  writeFile(path: string, content: string): Promise<void>

  /** List filenames in a directory. Non-recursive. Returns filenames only, not full paths. */
  listFiles(dir: string): Promise<string[]>

  /**
   * Watch a directory for changes. Call callback when anything changes.
   * Returns a cleanup function that stops watching.
   */
  watchDir(dir: string, callback: () => void): Promise<() => void>

  /**
   * Open a native folder picker. Returns the absolute path the user chose, or null if cancelled.
   * On mobile, returns a fixed path (Documents/Beryl) without showing a picker.
   */
  pickDirectory(): Promise<string | null>
}
```

### Step 1.3 — Register the package in the pnpm workspace

Open `pnpm-workspace.yaml` at the repo root. Confirm it contains `packages/*`. It should already — no change needed if it does.

### Step 1.4 — Add file-adapter as a dependency of the web app

In `apps/web/package.json`, add to `dependencies`:

```json
"@beryl/file-adapter": "workspace:*"
```

Run from the repo root:

```bash
pnpm install
```

### Step 1.5 — Checkpoint

`pnpm install` completes without errors. No other changes yet.

---

## Phase 2: Electron IPC

**Goal:** Make the Electron main process handle file read requests from the renderer. Write-related handlers (`writeFile`, `watchDir`) are included so the interface is fully satisfied — they will be used in a later plan.

### Step 2.1 — Rewrite `apps/desktop/src/main.js`

Replace the entire file:

```javascript
import { app, BrowserWindow, ipcMain, dialog } from 'electron'
import path from 'node:path'
import fs from 'node:fs/promises'
import { watch } from 'node:fs'
import started from 'electron-squirrel-startup'

if (started) app.quit()

let mainWindow
const watchers = new Map()

const createWindow = () => {
  mainWindow = new BrowserWindow({
    title: 'Beryl',
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173')
  } else {
    mainWindow.loadFile(path.join(process.resourcesPath, 'build', 'index.html'))
  }
}

app.whenReady().then(() => {
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

// ── FileAdapter IPC handlers ──────────────────────────────────────────────────

ipcMain.handle('beryl:readFile', async (_event, filePath) => {
  return fs.readFile(filePath, 'utf-8')
})

ipcMain.handle('beryl:writeFile', async (_event, filePath, content) => {
  await fs.writeFile(filePath, content, 'utf-8')
})

ipcMain.handle('beryl:listFiles', async (_event, dir) => {
  return fs.readdir(dir)
})

ipcMain.handle('beryl:watchDir', async (_event, dir) => {
  if (watchers.has(dir)) watchers.get(dir).close()
  const w = watch(dir, () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('beryl:dirChanged', dir)
    }
  })
  watchers.set(dir, w)
})

ipcMain.handle('beryl:unwatchDir', async (_event, dir) => {
  if (watchers.has(dir)) {
    watchers.get(dir).close()
    watchers.delete(dir)
  }
})

ipcMain.handle('beryl:pickDirectory', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
  })
  return result.canceled ? null : result.filePaths[0]
})
```

### Step 2.2 — Rewrite `apps/desktop/src/preload.js`

Replace the entire file. Note: preload scripts use CommonJS `require()` even if `main.js` uses ES modules. This is normal for Electron.

```javascript
const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('berylDesktop', {
  readFile:      (path) =>          ipcRenderer.invoke('beryl:readFile', path),
  writeFile:     (path, content) => ipcRenderer.invoke('beryl:writeFile', path, content),
  listFiles:     (dir) =>           ipcRenderer.invoke('beryl:listFiles', dir),
  watchDir:      (dir) =>           ipcRenderer.invoke('beryl:watchDir', dir),
  unwatchDir:    (dir) =>           ipcRenderer.invoke('beryl:unwatchDir', dir),
  pickDirectory: () =>              ipcRenderer.invoke('beryl:pickDirectory'),
  onDirChanged:  (callback) => {
    ipcRenderer.on('beryl:dirChanged', (_event, dir) => callback(dir))
  },
})
```

### Step 2.3 — Checkpoint

Start the desktop app in dev mode:

```bash
pnpm --filter @beryl/desktop dev
```

The window opens. Open DevTools (View → Toggle Developer Tools). In the console run:

```javascript
window.berylDesktop
```

It should print an object with these keys: `readFile`, `writeFile`, `listFiles`, `watchDir`, `unwatchDir`, `pickDirectory`, `onDirChanged`. If it prints `undefined`, the preload is not loading — check that the `preload` path in `main.js` matches where the file actually is.

---

## Phase 3: Platform Detection and Adapters

**Goal:** Create the platform detection utility and the two adapter files. The Capacitor adapter is a stub — it compiles but is not functional.

### Step 3.1 — Create `apps/web/src/lib/platform.ts`

```typescript
export type Platform = 'electron' | 'capacitor' | 'browser'

export function detectPlatform(): Platform {
  if (typeof (window as any).berylDesktop !== 'undefined') return 'electron'
  if (typeof (window as any).Capacitor !== 'undefined') return 'capacitor'
  return 'browser'
}
```

### Step 3.2 — Create `apps/web/src/lib/adapters/electron.ts`

Create the directory `apps/web/src/lib/adapters/` first.

```typescript
import type { FileAdapter } from '@beryl/file-adapter'

export function createElectronAdapter(): FileAdapter {
  const api = (window as any).berylDesktop

  return {
    readFile: (path) =>
      api.readFile(path),

    writeFile: (path, content) =>
      api.writeFile(path, content),

    listFiles: (dir) =>
      api.listFiles(dir),

    watchDir: (dir, callback) => {
      api.watchDir(dir)
      api.onDirChanged((changedDir: string) => {
        if (changedDir === dir) callback()
      })
      return Promise.resolve(() => api.unwatchDir(dir))
    },

    pickDirectory: () =>
      api.pickDirectory(),
  }
}
```

### Step 3.3 — Create `apps/web/src/lib/adapters/capacitor.ts` (stub)

This file satisfies the TypeScript compiler. It is not functional. It will be implemented in a future plan.

```typescript
import type { FileAdapter } from '@beryl/file-adapter'

export function createCapacitorAdapter(): FileAdapter {
  const notImplemented = (name: string) => () => {
    return Promise.reject(new Error(`Capacitor adapter: ${name} not yet implemented`))
  }

  return {
    readFile:     notImplemented('readFile') as FileAdapter['readFile'],
    writeFile:    notImplemented('writeFile') as FileAdapter['writeFile'],
    listFiles:    notImplemented('listFiles') as FileAdapter['listFiles'],
    watchDir:     notImplemented('watchDir') as FileAdapter['watchDir'],
    pickDirectory: notImplemented('pickDirectory') as FileAdapter['pickDirectory'],
  }
}
```

### Step 3.4 — Checkpoint

Run the TypeScript compiler:

```bash
pnpm --filter apps/web exec tsc --noEmit
```

Fix all errors before continuing. These three files have no runtime side effects — if they compile clean, they are correct.

---

## Phase 4: Workspace State

**Goal:** Create the reactive store that tracks the active folder and the file adapter.

### Step 4.1 — Create `apps/web/src/lib/workspace.svelte.ts`

```typescript
import type { FileAdapter } from '@beryl/file-adapter'
import { detectPlatform } from './platform.js'
import { createElectronAdapter } from './adapters/electron.js'
import { createCapacitorAdapter } from './adapters/capacitor.js'

const STORAGE_KEY = 'beryl:rootDir'

function createWorkspaceStore() {
  let fileAdapter = $state<FileAdapter | null>(null)
  let rootDir = $state<string | null>(null)
  let isReady = $state(false)

  function init() {
    // Pick the right adapter for this platform
    const platform = detectPlatform()
    if (platform === 'electron') {
      fileAdapter = createElectronAdapter()
    } else if (platform === 'capacitor') {
      fileAdapter = createCapacitorAdapter()
    }
    // 'browser' gets no adapter — the WorkspaceSetup screen handles this case

    // Restore last used folder from localStorage
    const saved = typeof localStorage !== 'undefined'
      ? localStorage.getItem(STORAGE_KEY)
      : null
    if (saved) rootDir = saved

    isReady = true
  }

  function setRootDir(dir: string) {
    rootDir = dir
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, dir)
    }
  }

  return {
    get fileAdapter() { return fileAdapter },
    get rootDir()     { return rootDir },
    get isReady()     { return isReady },
    get hasWorkspace(){ return rootDir !== null && fileAdapter !== null },
    init,
    setRootDir,
  }
}

export const workspace = createWorkspaceStore()
```

---

## Phase 5: Data Layer

**Goal:** Create `data.svelte.ts` which reads `.md` files from the workspace and exposes the parsed todos to the UI. **Writing is not implemented yet** — mutations update in-memory state only and do not persist to disk.

### Step 5.1 — Understand the beryljs API

`parseProject(markdownString)` returns `Task[]`. Each task looks like this:

```javascript
{
  checked: false,
  description: "Buy groceries p:high due:2025-03-15",  // full line text, labels included
  labels: [
    { label: "p",   value: "high"       },
    { label: "due", value: "2025-03-15" },
  ],
  comments: "Milk, eggs, and bread",  // text from >comment line. May be string or string[].
  subtasks: [],
  indent: 0,
}
```

**To get the clean task title:** strip all `p:value` and `due:value` tokens from `description`.

```typescript
function stripLabels(description: string): string {
  return description
    .replace(/\b(p|due):\S+/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}
```

**Priority mapping:**
- `p:high` → `'high'`
- `p:low` → `'low'`
- anything else / missing → `'medium'`

**Comments:** `task.comments` may be a `string`, an `array of strings`, or `undefined`. Normalize to a single string:

```typescript
function normalizeComments(comments: unknown): string {
  if (!comments) return ''
  if (Array.isArray(comments)) return comments.join('\n')
  return String(comments)
}
```

### Step 5.2 — Create `apps/web/src/lib/data.svelte.ts`

```typescript
import { parseProject } from '@beryl/beryljs'
import type { Todo, List, Priority } from './types.js'
import { workspace } from './workspace.svelte.js'

// ── Helpers ───────────────────────────────────────────────────────────────────

function stripLabels(description: string): string {
  return description
    .replace(/\b(p|due):\S+/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function normalizeComments(comments: unknown): string {
  if (!comments) return ''
  if (Array.isArray(comments)) return (comments as string[]).join('\n')
  return String(comments)
}

function parsePriority(labels: Array<{ label: string; value: string }>): Priority {
  const p = labels.find((l) => l.label === 'p')
  if (p?.value === 'high') return 'high'
  if (p?.value === 'low')  return 'low'
  return 'medium'
}

function parseDueDate(labels: Array<{ label: string; value: string }>): string | null {
  const d = labels.find((l) => l.label === 'due')
  return d ? d.value : null
}

function fileNameToListId(filename: string): string {
  return filename.replace(/\.md$/i, '')
}

function parseFile(content: string, listId: string): Todo[] {
  let tasks: ReturnType<typeof parseProject>
  try {
    tasks = parseProject(content)
  } catch {
    // beryljs throws on malformed input — treat the file as empty
    return []
  }

  return tasks
    .filter((t) => t.indent === 0)  // top-level tasks only
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

// ── Store ─────────────────────────────────────────────────────────────────────

function createDataStore() {
  let todos  = $state<Todo[]>([])
  let lists  = $state<List[]>([])
  let activeListId = $state<string | null>(null)
  let isLoading    = $state(false)
  let loadError    = $state<string | null>(null)

  // ── Derived ─────────────────────────────────────────────────────────────────

  const filteredTodos = $derived(
    activeListId ? todos.filter((t) => t.listId === activeListId) : todos
  )

  const counts = $derived(
    Object.fromEntries(
      lists.map((l) => [
        l.id,
        todos.filter((t) => t.listId === l.id && !t.completed).length,
      ])
    ) as Record<string, number>
  )

  // ── Loading ──────────────────────────────────────────────────────────────────

  async function loadWorkspace() {
    const adapter = workspace.fileAdapter
    const rootDir = workspace.rootDir
    if (!adapter || !rootDir) return

    isLoading  = true
    loadError  = null

    try {
      const filenames = await adapter.listFiles(rootDir)
      const mdFiles   = filenames.filter((f) => f.toLowerCase().endsWith('.md'))

      const newLists: List[] = []
      const newTodos: Todo[] = []

      for (const filename of mdFiles) {
        const listId   = fileNameToListId(filename)
        const fullPath = `${rootDir}/${filename}`

        let content: string
        try {
          content = await adapter.readFile(fullPath)
        } catch {
          // File unreadable — skip it
          continue
        }

        newLists.push({
          id:    listId,
          name:  listId.charAt(0).toUpperCase() + listId.slice(1),
          color: '#6366f1',  // default color, user can change later
        })

        newTodos.push(...parseFile(content, listId))
      }

      lists = newLists
      todos = newTodos

      // Default to the first list if nothing is selected
      if (!activeListId && newLists.length > 0) {
        activeListId = newLists[0].id
      }
    } catch (e) {
      loadError = String(e)
    } finally {
      isLoading = false
    }
  }

  // ── Mutations (in-memory only — no file writes yet) ───────────────────────

  function setActiveList(id: string | null) {
    activeListId = id
  }

  function toggleTodo(id: string) {
    const todo = todos.find((t) => t.id === id)
    if (todo) todo.completed = !todo.completed
  }

  function addTodo(partial: Pick<Todo, 'title' | 'listId'>) {
    todos.push({
      id:        crypto.randomUUID(),
      title:     partial.title,
      completed: false,
      priority:  'medium',
      dueDate:   null,
      listId:    partial.listId,
      createdAt: new Date().toISOString(),
      notes:     '',
    })
  }

  function updateTodo(id: string, changes: Partial<Todo>) {
    const todo = todos.find((t) => t.id === id)
    if (todo) Object.assign(todo, changes)
  }

  function deleteTodo(id: string) {
    todos = todos.filter((t) => t.id !== id)
  }

  function addList(name: string) {
    const id = name.toLowerCase().replace(/\s+/g, '-')
    if (lists.find((l) => l.id === id)) return
    lists.push({ id, name, color: '#6366f1' })
  }

  function deleteList(id: string) {
    lists  = lists.filter((l) => l.id !== id)
    todos  = todos.filter((t) => t.listId !== id)
    if (activeListId === id) activeListId = lists[0]?.id ?? null
  }

  return {
    get todos()        { return todos },
    get lists()        { return lists },
    get activeListId() { return activeListId },
    get filteredTodos(){ return filteredTodos },
    get counts()       { return counts },
    get isLoading()    { return isLoading },
    get loadError()    { return loadError },
    loadWorkspace,
    setActiveList,
    toggleTodo,
    addTodo,
    updateTodo,
    deleteTodo,
    addList,
    deleteList,
  }
}

export const dataStore = createDataStore()
```

### Step 5.3 — Checkpoint

```bash
pnpm --filter apps/web exec tsc --noEmit
```

Fix all type errors before continuing.

---

## Phase 6: WorkspaceSetup Screen

**Goal:** Show a folder-picker screen when no workspace is configured.

### Step 6.1 — Create `apps/web/src/lib/components/WorkspaceSetup.svelte`

Create the directory `apps/web/src/lib/components/` if it doesn't exist.

```svelte
<script lang="ts">
  import { workspace } from '$lib/workspace.svelte.js'
  import { dataStore } from '$lib/data.svelte.js'

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
      if (!dir) return  // user cancelled

      workspace.setRootDir(dir)
      await dataStore.loadWorkspace()
    } catch (e) {
      error = String(e)
    } finally {
      picking = false
    }
  }
</script>

<div class="flex flex-col items-center justify-center h-screen gap-6 p-8">
  <div class="text-center">
    <h1 class="text-3xl font-bold tracking-tight">Welcome to Beryl</h1>
    <p class="mt-2 text-muted-foreground max-w-sm">
      Beryl reads your tasks from markdown files. Choose a folder to get started.
    </p>
  </div>

  <button
    onclick={openWorkspace}
    disabled={picking}
    class="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-primary text-primary-foreground font-medium disabled:opacity-50"
  >
    {picking ? 'Opening…' : 'Open Workspace Folder'}
  </button>

  {#if error}
    <p class="text-destructive text-sm">{error}</p>
  {/if}

  <p class="text-xs text-muted-foreground max-w-xs text-center">
    Your tasks stay on your device. Sync with iCloud, Dropbox, or any tool you already use.
  </p>
</div>
```

**Note:** This component uses plain Tailwind classes and a plain `<button>` element. Do not use shadcn components here — it keeps this setup screen free of component library dependencies.

---

## Phase 7: Wire Everything Into the App

**Goal:** Connect workspace init, the data store, and the setup screen to the existing SvelteKit app.

### Step 7.1 — Update `apps/web/src/routes/+layout.svelte`

Open the existing `+layout.svelte`. **Do not remove any existing code.** Add the following:

In the `<script>` block, add these imports alongside whatever is already there:

```typescript
import { onMount } from 'svelte'
import { workspace } from '$lib/workspace.svelte.js'
import { dataStore } from '$lib/data.svelte.js'
```

Add an `onMount` call (or add to the existing one if it already exists):

```typescript
onMount(async () => {
  workspace.init()
  if (workspace.hasWorkspace) {
    await dataStore.loadWorkspace()
  }
})
```

### Step 7.2 — Update `apps/web/src/routes/+page.svelte`

Open the existing `+page.svelte`.

Add these imports at the top of the `<script>` block:

```typescript
import { workspace } from '$lib/workspace.svelte.js'
import { dataStore } from '$lib/data.svelte.js'
import WorkspaceSetup from '$lib/components/WorkspaceSetup.svelte'
```

Remove the import of `todosStore`:

```typescript
// REMOVE this line:
import { todosStore } from '$lib/todos.svelte.js'
```

Wrap the entire existing template content with a conditional:

```svelte
{#if !workspace.hasWorkspace}
  <WorkspaceSetup />
{:else if dataStore.isLoading}
  <div class="flex items-center justify-center h-screen text-muted-foreground">
    Loading…
  </div>
{:else}
  <!-- ALL existing page content here, unchanged -->
{/if}
```

### Step 7.3 — Replace `todosStore` references with `dataStore`

Throughout `+page.svelte` and any other component that currently imports `todosStore`, do a find-and-replace:

| Find | Replace |
|---|---|
| `todosStore.todos` | `dataStore.todos` |
| `todosStore.lists` | `dataStore.lists` |
| `todosStore.filteredTodos` | `dataStore.filteredTodos` |
| `todosStore.counts` | `dataStore.counts` |
| `todosStore.activeFilter` | `dataStore.activeFilter` |
| `todosStore.activeListId` | `dataStore.activeListId` |
| `todosStore.setActiveList(` | `dataStore.setActiveList(` |
| `todosStore.addTodo(` | `dataStore.addTodo(` |
| `todosStore.toggleTodo(` | `dataStore.toggleTodo(` |
| `todosStore.deleteTodo(` | `dataStore.deleteTodo(` |
| `todosStore.updateTodo(` | `dataStore.updateTodo(` |
| `todosStore.addList(` | `dataStore.addList(` |
| `todosStore.deleteList(` | `dataStore.deleteList(` |

The API shape is identical. This is a mechanical find-and-replace.

### Step 7.4 — Checkpoint

```bash
pnpm --filter apps/web exec tsc --noEmit
```

Fix all type errors. Then start the web dev server to check for runtime errors:

```bash
pnpm --filter apps/web dev
```

The app should show the WorkspaceSetup screen in the browser (no `berylDesktop` available in a plain browser). The button will show the "No file adapter available" error message when clicked — this is expected and correct.

---

## Phase 8: End-to-End Verification

**Goal:** Confirm the app reads real `.md` files from disk in Electron.

### Step 8.1 — Prepare a test folder

Create a folder on your computer (e.g. `~/beryl-test`) with two `.md` files:

**`work.md`**
```markdown
- [ ] Build the data layer p:high
- [x] Set up shadcn-svelte p:high
- [ ] Write tests p:medium
- [ ] Plan Q2 roadmap p:low due:2025-04-01
```

**`personal.md`**
```markdown
- [ ] Buy groceries p:high
	>Milk, eggs, bread
- [ ] Call dentist
- [x] Morning run p:low
```

### Step 8.2 — Run the desktop app

```bash
pnpm --filter @beryl/desktop dev
```

### Step 8.3 — Test checklist

Do not mark this plan complete until all items pass:

- [ ] App opens without errors in the DevTools console
- [ ] WorkspaceSetup screen is shown on first launch
- [ ] Clicking "Open Workspace Folder" opens the OS folder picker dialog
- [ ] Selecting `~/beryl-test` dismisses the setup screen and shows the main UI
- [ ] `work` and `personal` appear in the sidebar as lists
- [ ] Clicking `work` shows the 4 tasks from `work.md`
- [ ] Clicking `personal` shows the 3 tasks from `personal.md`
- [ ] Completed tasks (`[x]`) are shown as completed in the UI
- [ ] Priorities are correct (`p:high` shows as high, etc.)
- [ ] Notes appear correctly (`>Milk, eggs, bread` shows in the grocery task)
- [ ] Closing and reopening the app restores the same workspace automatically (no folder picker shown)
- [ ] Mutations (toggle, add, delete) update the UI immediately — **they do not need to persist to disk yet**

### Step 8.4 — Common issues

**`window.berylDesktop` is undefined in the app:**
The preload script is not being loaded. Check that `preload` path in `createWindow()` matches where `preload.js` is actually built. In electron-forge, `__dirname` in `main.js` points to the `.webpack/main` output directory.

**`parseProject` throws on a file:**
The `.md` file contains content beryljs can't parse (headings, freeform text, blank lines between tasks). The `try/catch` in `parseFile` treats these as empty lists. Check the exact file content.

**"No file adapter available" error on desktop:**
`window.berylDesktop` is undefined. Same root cause as first issue above.

**Lists appear but no tasks:**
Check that the `.md` files use the exact format — `- [ ]` and `- [x]` with a space, no leading content. beryljs is strict about format.

---

## What Is Not In This Plan

Do not implement these. They are for future plans:

- Writing changes back to `.md` files on disk
- The file watcher (live reload when files change externally)
- Functional Capacitor adapter (currently stubbed)
- iOS `Info.plist` changes
- New list creation that creates a file on disk
- List deletion that deletes a file on disk
