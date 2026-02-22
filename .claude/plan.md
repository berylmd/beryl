# Beryl Implementation Plan

## Who This Is For

This plan is for an AI coding agent. It is written to be unambiguous. Read the architecture doc at `.claude/architecture.md` first. Do each step in order. Do not skip ahead.

---

## Current State (as of Feb 2026)

**What exists and works:**
- `apps/web` — SvelteKit app with a complete todo UI. All data is **hardcoded in-memory**. Tasks are never read from or written to disk.
- `apps/desktop` — Electron shell. `main.js` only creates a window. `preload.js` is empty.
- `apps/native` — Capacitor shell. iOS and Android targets configured.
- `packages/beryljs` — Nearley markdown parser. Parses `.md` task files. **Not connected to the UI.**

**What does NOT exist yet:**
- `packages/file-adapter/` — FileAdapter interface package
- Electron IPC handlers for file operations
- `apps/web/src/lib/platform.ts`
- `apps/web/src/lib/adapters/electron.ts`
- `apps/web/src/lib/adapters/capacitor.ts`
- `apps/web/src/lib/workspace.svelte.ts`
- `apps/web/src/lib/data.svelte.ts`
- `apps/web/src/components/WorkspaceSetup.svelte`

**Goal of this plan:** Connect the existing pieces so the app reads/writes real `.md` files.

---

## Phase 1: Create the FileAdapter Package

**Goal:** Define the contract between the UI and the filesystem.

### Step 1.1 — Create the package directory and files

Create `packages/file-adapter/package.json`:

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

Create `packages/file-adapter/src/index.ts`:

```typescript
/**
 * FileAdapter is the contract between the Beryl UI and the host platform.
 *
 * Electron: implemented via Node.js fs through IPC
 * Capacitor: implemented via @capacitor/filesystem
 *
 * The UI never calls the filesystem directly. Always go through this interface.
 */
export interface FileAdapter {
  /** Read a file as UTF-8 string. Throw if not found. */
  readFile(path: string): Promise<string>

  /** Write UTF-8 string to file. Create if missing, overwrite if exists. */
  writeFile(path: string, content: string): Promise<void>

  /** List filenames in a directory (non-recursive, relative names only). */
  listFiles(dir: string): Promise<string[]>

  /**
   * Watch a directory for changes. Call the callback on any change.
   * Returns a cleanup function that stops watching.
   */
  watchDir(dir: string, callback: () => void): Promise<() => void>

  /**
   * Open a native folder picker. Returns absolute path, or null if cancelled.
   * Desktop: native OS dialog. Mobile: returns fixed Documents/Beryl path.
   */
  pickDirectory(): Promise<string | null>
}
```

### Step 1.2 — Add file-adapter to the pnpm workspace

Open `pnpm-workspace.yaml` (in the repo root). Verify it includes `packages/*`. It should already — no change needed if it does.

### Step 1.3 — Add file-adapter as a dependency of the web app

In `apps/web/package.json`, add to `dependencies`:
```json
"@beryl/file-adapter": "workspace:*"
```

Then run from the repo root:
```bash
pnpm install
```

### Step 1.4 — Checkpoint

Verify: `pnpm install` completes without errors. The file-adapter package is linked. No other changes yet.

---

## Phase 2: Electron IPC Handlers

**Goal:** Make the Electron main process respond to file operation requests from the renderer.

### Step 2.1 — Rewrite `apps/desktop/src/main.js`

Replace the entire file with the following. This adds `ipcMain.handle` calls for every FileAdapter method, and updates the `BrowserWindow` config to enable `contextIsolation`:

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

// ─── FileAdapter IPC handlers ─────────────────────────────────────────────────

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

### Step 2.2 — Write `apps/desktop/src/preload.js`

Replace the empty preload with the contextBridge implementation. **Note: preload.js uses CommonJS `require()` syntax even though main.js uses ES modules.** This is normal for Electron preload scripts.

```javascript
const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('berylDesktop', {
  readFile: (path) =>
    ipcRenderer.invoke('beryl:readFile', path),

  writeFile: (path, content) =>
    ipcRenderer.invoke('beryl:writeFile', path, content),

  listFiles: (dir) =>
    ipcRenderer.invoke('beryl:listFiles', dir),

  watchDir: (dir) =>
    ipcRenderer.invoke('beryl:watchDir', dir),

  unwatchDir: (dir) =>
    ipcRenderer.invoke('beryl:unwatchDir', dir),

  pickDirectory: () =>
    ipcRenderer.invoke('beryl:pickDirectory'),

  onDirChanged: (callback) => {
    ipcRenderer.on('beryl:dirChanged', (_event, dir) => callback(dir))
  },
})
```

### Step 2.3 — Checkpoint

Run the desktop app in dev mode:
```bash
pnpm --filter @beryl/desktop dev
```

The window should open. Open DevTools (View → Toggle Developer Tools) and run in the console:
```javascript
window.berylDesktop
```
It should print an object with keys: `readFile`, `writeFile`, `listFiles`, `watchDir`, `unwatchDir`, `pickDirectory`, `onDirChanged`. If `window.berylDesktop` is `undefined`, the preload is not loading — check that `preload.js` is in the correct location.

---

## Phase 3: Platform Detection and Adapters

**Goal:** Create the three files that connect the FileAdapter interface to the actual platform APIs.

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

Create the directory `apps/web/src/lib/adapters/` if it doesn't exist.

```typescript
import type { FileAdapter } from '@beryl/file-adapter'

export function createElectronAdapter(): FileAdapter {
  const api = (window as any).berylDesktop

  return {
    readFile: (path) => api.readFile(path),

    writeFile: (path, content) => api.writeFile(path, content),

    listFiles: (dir) => api.listFiles(dir),

    watchDir: (dir, callback) => {
      api.watchDir(dir)
      api.onDirChanged((changedDir: string) => {
        if (changedDir === dir) callback()
      })
      return Promise.resolve(() => api.unwatchDir(dir))
    },

    pickDirectory: () => api.pickDirectory(),
  }
}
```

### Step 3.3 — Add `@capacitor/filesystem` to the web app

Run from the repo root:
```bash
pnpm --filter apps/web add @capacitor/filesystem
```

Then run `cap sync` to install the native plugin in the iOS/Android projects:
```bash
pnpm --filter apps/native exec npx cap sync
```

### Step 3.4 — Create `apps/web/src/lib/adapters/capacitor.ts`

```typescript
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem'
import type { FileAdapter } from '@beryl/file-adapter'

const BERYL_DIR = 'Beryl'

export function createCapacitorAdapter(): FileAdapter {
  return {
    readFile: async (path) => {
      const result = await Filesystem.readFile({
        path,
        directory: Directory.Documents,
        encoding: Encoding.UTF8,
      })
      return result.data as string
    },

    writeFile: async (path, content) => {
      await Filesystem.writeFile({
        path,
        data: content,
        directory: Directory.Documents,
        encoding: Encoding.UTF8,
        recursive: true,
      })
    },

    listFiles: async (dir) => {
      const result = await Filesystem.readdir({
        path: dir,
        directory: Directory.Documents,
      })
      return result.files.map((f) => f.name)
    },

    watchDir: async (_dir, callback) => {
      // Capacitor has no native directory watcher. Poll every 3 seconds.
      const interval = setInterval(callback, 3000)
      return () => clearInterval(interval)
    },

    pickDirectory: async () => {
      // On mobile, use a fixed subdirectory in Documents.
      // On iOS: this folder is visible in the Files app via Info.plist config.
      // On Android: accessible via Scoped Storage-compatible sync tools.
      try {
        await Filesystem.mkdir({
          path: BERYL_DIR,
          directory: Directory.Documents,
          recursive: true,
        })
      } catch {
        // Already exists, that's fine
      }
      return BERYL_DIR
    },
  }
}
```

### Step 3.5 — Checkpoint

These files have no runtime side effects. Verify they have no TypeScript errors by running:
```bash
pnpm --filter apps/web exec tsc --noEmit
```

Fix any type errors before continuing.

---

## Phase 4: Workspace State

**Goal:** Create the central reactive state that tracks which folder the user is working in and which FileAdapter to use.

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
    // Create the appropriate FileAdapter for this platform
    const platform = detectPlatform()
    if (platform === 'electron') {
      fileAdapter = createElectronAdapter()
    } else if (platform === 'capacitor') {
      fileAdapter = createCapacitorAdapter()
    }
    // 'browser' has no adapter — app will show workspace setup

    // Restore last workspace from localStorage
    const saved = typeof localStorage !== 'undefined'
      ? localStorage.getItem(STORAGE_KEY)
      : null
    if (saved) {
      rootDir = saved
    }

    isReady = true
  }

  function setRootDir(dir: string) {
    rootDir = dir
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, dir)
    }
  }

  function clearWorkspace() {
    rootDir = null
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(STORAGE_KEY)
    }
  }

  return {
    get fileAdapter() { return fileAdapter },
    get rootDir() { return rootDir },
    get isReady() { return isReady },
    get hasWorkspace() { return rootDir !== null && fileAdapter !== null },
    init,
    setRootDir,
    clearWorkspace,
  }
}

export const workspace = createWorkspaceStore()
```

---

## Phase 5: File-Backed Data Layer

**Goal:** Replace the hardcoded in-memory `todos.svelte.ts` with a data layer that reads from and writes to `.md` files.

### Step 5.1 — Understand the data mapping

Before writing the data layer, understand how UI types map to file format:

**File format:**
```markdown
- [ ] Buy groceries p:high due:2025-03-15
	>Milk, eggs, and bread
- [x] Set up project p:high
- [ ] Plan vacation p:low due:2025-06-01
```

**What beryljs gives you for `- [ ] Buy groceries p:high due:2025-03-15\n\t>Milk, eggs, and bread`:**
```javascript
{
  checked: false,
  description: "Buy groceries p:high due:2025-03-15",  // full body text
  labels: [
    { label: "p", value: "high" },
    { label: "due", value: "2025-03-15" },
  ],
  comments: "Milk, eggs, and bread",  // text from >comment line (may be string or string[])
  subtasks: [],
  indent: 0,
}
```

**Mapping to a `Todo`:**
```typescript
{
  id: crypto.randomUUID(),          // ephemeral — assigned on load, NOT stored in file
  title: "Buy groceries",           // description with label tokens removed
  completed: false,                 // from checked
  priority: 'high',                 // from labels.find(l => l.label === 'p')
  dueDate: '2025-03-15',           // from labels.find(l => l.label === 'due')
  listId: 'shopping',               // from filename (shopping.md → 'shopping')
  createdAt: new Date().toISOString(),  // assigned on load, NOT stored in file
  notes: 'Milk, eggs, and bread',   // from comments
}
```

### Step 5.2 — Create `apps/web/src/lib/data.svelte.ts`

This file replaces `todos.svelte.ts` as the source of truth for tasks.

```typescript
import { parseProject } from '@beryl/beryljs'
import type { Task } from '@beryl/beryljs'
import type { Todo, List, Priority } from './types.js'
import { workspace } from './workspace.svelte.js'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function taskToTodo(task: Task, listId: string): Todo {
  // task.labels may be typed as LabelText[] but the actual runtime shape
  // (confirmed by beryljs tests) is Array<{label: string, value: string}>
  const labels = (task.labels ?? []) as unknown as Array<{ label: string; value: string }>
  const pLabel = labels.find((l) => l.label === 'p')
  const dueLabel = labels.find((l) => l.label === 'due')

  // Strip recognized label tokens from description to get clean title
  let title = task.description ?? ''
  for (const lbl of labels) {
    if (lbl.label === 'p' || lbl.label === 'due') {
      title = title.replace(`${lbl.label}:${lbl.value}`, '')
    }
  }
  title = title.trim()

  // comments may be a string or string[]
  const commentsArr = Array.isArray(task.comments)
    ? task.comments
    : task.comments
    ? [task.comments as string]
    : []
  const notes = commentsArr.join('\n')

  let priority: Priority = 'medium'
  if (pLabel?.value === 'high') priority = 'high'
  else if (pLabel?.value === 'low') priority = 'low'

  return {
    id: crypto.randomUUID(),
    title,
    completed: task.checked,
    priority,
    dueDate: dueLabel?.value ?? null,
    listId,
    createdAt: new Date().toISOString(),
    notes,
  }
}

function todoToLine(todo: Todo): string {
  const check = todo.completed ? '- [x]' : '- [ ]'
  let line = `${check} ${todo.title}`
  if (todo.priority !== 'medium') line += ` p:${todo.priority}`
  if (todo.dueDate) line += ` due:${todo.dueDate}`
  if (todo.notes && todo.notes.trim()) {
    for (const noteLine of todo.notes.split('\n')) {
      line += `\n\t>${noteLine}`
    }
  }
  return line
}

function todosToMarkdown(todos: Todo[]): string {
  return todos.map(todoToLine).join('\n')
}

function filenameToListId(filename: string): string {
  return filename.replace(/\.md$/i, '')
}

function listIdToFilename(listId: string): string {
  return `${listId}.md`
}

function simpleHash(str: string): string {
  let h = 0
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) - h + str.charCodeAt(i)) | 0
  }
  return h.toString(36)
}

// ─── Data Store ──────────────────────────────────────────────────────────────

function createDataStore() {
  let todos = $state<Todo[]>([])
  let lists = $state<List[]>([])
  let loading = $state(false)
  let activeFilter = $state<'all' | 'today' | 'upcoming' | 'completed'>('all')
  let activeListId = $state<string | null>(null)
  let stopWatcher = $state<(() => void) | null>(null)

  // Track file hashes to skip spurious watcher events
  const fileHashes = new Map<string, string>()
  // Debounce timers per file
  const saveTimers = new Map<string, ReturnType<typeof setTimeout>>()
  // Guard: set while we're writing a file ourselves
  const writeInProgress = new Set<string>()

  // ─── List colors (UI preference, stored in localStorage) ──────────────
  function getListColor(listId: string): string {
    if (typeof localStorage === 'undefined') return 'slate'
    return localStorage.getItem(`beryl:color:${listId}`) ?? 'slate'
  }

  function setListColor(listId: string, color: string) {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(`beryl:color:${listId}`, color)
    }
    const list = lists.find((l) => l.id === listId)
    if (list) list.color = color
  }

  // ─── File I/O ──────────────────────────────────────────────────────────

  async function loadFile(filename: string): Promise<Todo[]> {
    const adapter = workspace.fileAdapter
    const dir = workspace.rootDir
    if (!adapter || !dir) return []

    const fullPath = `${dir}/${filename}`
    let content: string
    try {
      content = await adapter.readFile(fullPath)
    } catch {
      // File doesn't exist yet — return empty
      return []
    }

    fileHashes.set(filename, simpleHash(content))
    const listId = filenameToListId(filename)

    let tasks: Task[]
    try {
      tasks = parseProject(content)
    } catch {
      console.warn(`beryljs failed to parse ${filename}, treating as empty`)
      tasks = []
    }

    return tasks
      .filter((t) => t.indent === 0)  // top-level tasks only
      .map((t) => taskToTodo(t, listId))
  }

  async function saveFile(listId: string): Promise<void> {
    const adapter = workspace.fileAdapter
    const dir = workspace.rootDir
    if (!adapter || !dir) return

    const filename = listIdToFilename(listId)
    const fullPath = `${dir}/${filename}`
    const fileTodos = todos.filter((t) => t.listId === listId)
    const content = todosToMarkdown(fileTodos)

    fileHashes.set(filename, simpleHash(content))
    writeInProgress.add(filename)
    try {
      await adapter.writeFile(fullPath, content)
    } finally {
      setTimeout(() => writeInProgress.delete(filename), 200)
    }
  }

  function scheduleSave(listId: string) {
    const filename = listIdToFilename(listId)
    const existing = saveTimers.get(filename)
    if (existing) clearTimeout(existing)

    saveTimers.set(
      filename,
      setTimeout(() => {
        saveTimers.delete(filename)
        saveFile(listId)
      }, 300)
    )
  }

  // ─── Workspace loading ─────────────────────────────────────────────────

  async function loadWorkspace(): Promise<void> {
    const adapter = workspace.fileAdapter
    const dir = workspace.rootDir
    if (!adapter || !dir) return

    loading = true
    try {
      const allFiles = await adapter.listFiles(dir)
      const mdFiles = allFiles.filter((f) => f.endsWith('.md'))

      const newLists: List[] = mdFiles.map((filename) => {
        const id = filenameToListId(filename)
        return {
          id,
          name: id.charAt(0).toUpperCase() + id.slice(1),
          color: getListColor(id),
        }
      })

      const todoArrays = await Promise.all(mdFiles.map((f) => loadFile(f)))
      const allTodos = todoArrays.flat()

      lists = newLists
      todos = allTodos
    } finally {
      loading = false
    }

    // Start watching for external changes
    startWatching()
  }

  async function startWatching() {
    const adapter = workspace.fileAdapter
    const dir = workspace.rootDir
    if (!adapter || !dir) return

    if (stopWatcher) {
      stopWatcher()
      stopWatcher = null
    }

    const stop = await adapter.watchDir(dir, async () => {
      // On any directory change, reload all .md files
      const allFiles = await adapter.listFiles(dir)
      const mdFiles = allFiles.filter((f) => f.endsWith('.md'))

      for (const filename of mdFiles) {
        if (writeInProgress.has(filename)) continue  // our own write, skip

        const fullPath = `${dir}/${filename}`
        let content: string
        try {
          content = await adapter.readFile(fullPath)
        } catch {
          continue
        }

        const hash = simpleHash(content)
        if (fileHashes.get(filename) === hash) continue  // no real change

        fileHashes.set(filename, hash)
        const listId = filenameToListId(filename)

        let tasks: Task[]
        try {
          tasks = parseProject(content)
        } catch {
          continue
        }

        const updatedTodos = tasks
          .filter((t) => t.indent === 0)
          .map((t) => taskToTodo(t, listId))

        // Replace todos for this list
        todos = [...todos.filter((t) => t.listId !== listId), ...updatedTodos]
      }
    })

    stopWatcher = stop
  }

  // ─── CRUD Actions ──────────────────────────────────────────────────────

  function addTodo(title: string, listId: string = lists[0]?.id ?? 'inbox', priority: Priority = 'medium') {
    todos.push({
      id: crypto.randomUUID(),
      title,
      completed: false,
      priority,
      dueDate: null,
      listId,
      createdAt: new Date().toISOString(),
      notes: '',
    })
    scheduleSave(listId)
  }

  function toggleTodo(id: string) {
    const todo = todos.find((t) => t.id === id)
    if (!todo) return
    todo.completed = !todo.completed
    scheduleSave(todo.listId)
  }

  function deleteTodo(id: string) {
    const index = todos.findIndex((t) => t.id === id)
    if (index === -1) return
    const listId = todos[index].listId
    todos.splice(index, 1)
    scheduleSave(listId)
  }

  function updateTodo(id: string, updates: Partial<Omit<Todo, 'id' | 'createdAt'>>) {
    const todo = todos.find((t) => t.id === id)
    if (!todo) return
    const oldListId = todo.listId
    Object.assign(todo, updates)
    scheduleSave(oldListId)
    if (updates.listId && updates.listId !== oldListId) {
      scheduleSave(updates.listId)
    }
  }

  async function addList(name: string, color: string = 'slate') {
    const id = name.toLowerCase().replace(/\s+/g, '-')
    if (lists.find((l) => l.id === id)) return  // already exists

    lists.push({ id, name, color })
    setListColor(id, color)

    // Create the .md file immediately (empty)
    const adapter = workspace.fileAdapter
    const dir = workspace.rootDir
    if (adapter && dir) {
      const filename = listIdToFilename(id)
      await adapter.writeFile(`${dir}/${filename}`, '')
    }
  }

  function deleteList(id: string) {
    const index = lists.findIndex((l) => l.id === id)
    if (index !== -1) lists.splice(index, 1)

    // Remove all todos in this list
    for (let i = todos.length - 1; i >= 0; i--) {
      if (todos[i].listId === id) todos.splice(i, 1)
    }

    if (activeListId === id) activeListId = null

    // Note: does NOT delete the .md file on disk. User manages their files.
  }

  // ─── Derived state ─────────────────────────────────────────────────────

  const filteredTodos = $derived.by(() => {
    const now = new Date().toISOString().split('T')[0]
    let result = [...todos]

    if (activeListId) {
      result = result.filter((t) => t.listId === activeListId)
    }

    switch (activeFilter) {
      case 'today':
        result = result.filter((t) => !t.completed && t.dueDate === now)
        break
      case 'upcoming':
        result = result.filter((t) => !t.completed && t.dueDate != null && t.dueDate > now)
        break
      case 'completed':
        result = result.filter((t) => t.completed)
        break
      default:
        result = [
          ...result.filter((t) => !t.completed),
          ...result.filter((t) => t.completed),
        ]
    }

    return result
  })

  const counts = $derived({
    all: todos.filter((t) => !t.completed).length,
    today: todos.filter((t) => {
      const now = new Date().toISOString().split('T')[0]
      return !t.completed && t.dueDate === now
    }).length,
    upcoming: todos.filter((t) => {
      const now = new Date().toISOString().split('T')[0]
      return !t.completed && t.dueDate != null && t.dueDate > now
    }).length,
    completed: todos.filter((t) => t.completed).length,
  })

  return {
    get todos() { return todos },
    get lists() { return lists },
    get loading() { return loading },
    get filteredTodos() { return filteredTodos },
    get counts() { return counts },
    get activeFilter() { return activeFilter },
    set activeFilter(v: 'all' | 'today' | 'upcoming' | 'completed') {
      activeFilter = v
      activeListId = null
    },
    get activeListId() { return activeListId },
    setActiveList(id: string | null) {
      activeListId = id
      activeFilter = 'all'
    },
    loadWorkspace,
    addTodo,
    toggleTodo,
    deleteTodo,
    updateTodo,
    addList,
    deleteList,
    setListColor,
  }
}

export const dataStore = createDataStore()
```

### Step 5.3 — Checkpoint

Run:
```bash
pnpm --filter apps/web exec tsc --noEmit
```

Fix any TypeScript errors. Common issues:
- Missing import paths (check `.js` extension on imports in SvelteKit)
- `@beryl/beryljs` types not matching — `Task` type may be imported differently, check `packages/beryljs/dist/index.d.ts` for the actual export names

---

## Phase 6: Workspace Setup Screen

**Goal:** Show a "pick your folder" screen when no workspace is configured.

### Step 6.1 — Create `apps/web/src/lib/components/WorkspaceSetup.svelte`

Create the directory `apps/web/src/lib/components/` if it doesn't exist.

```svelte
<script lang="ts">
  import { workspace } from '$lib/workspace.svelte.js'
  import { dataStore } from '$lib/data.svelte.js'
  import { Button } from '$lib/components/ui/button/index.js'
  import { FolderOpen } from 'lucide-svelte'

  let picking = $state(false)
  let error = $state<string | null>(null)

  async function openWorkspace() {
    if (!workspace.fileAdapter) {
      error = 'No file adapter available. Run the app as a desktop or mobile app.'
      return
    }

    picking = true
    error = null
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
      Beryl stores your tasks as markdown files. Choose a folder to get started.
    </p>
  </div>

  <Button onclick={openWorkspace} disabled={picking} size="lg">
    <FolderOpen class="mr-2 h-5 w-5" />
    {picking ? 'Opening...' : 'Open Workspace Folder'}
  </Button>

  {#if error}
    <p class="text-destructive text-sm">{error}</p>
  {/if}

  <p class="text-xs text-muted-foreground mt-4 max-w-xs text-center">
    Your tasks stay on your device. Sync them with iCloud, Dropbox, or any
    file sync tool you already use.
  </p>
</div>
```

### Step 6.2 — Update the root layout to initialize the platform

Open `apps/web/src/routes/+layout.svelte`. Add workspace initialization in `onMount`. The existing file likely sets up the theme — add workspace init alongside it.

**Find the existing `onMount` in `+layout.svelte` and add `workspace.init()` to it.** If there is no `onMount`, add one.

The key additions:
1. Import `workspace` and `dataStore`
2. Call `workspace.init()` in `onMount`
3. After `init`, if there's a saved `rootDir`, call `dataStore.loadWorkspace()`

Example additions to whatever is already in `+layout.svelte`:

```svelte
<script lang="ts">
  // ADD these imports alongside existing ones:
  import { onMount } from 'svelte'
  import { workspace } from '$lib/workspace.svelte.js'
  import { dataStore } from '$lib/data.svelte.js'

  // ... existing script content ...

  onMount(() => {
    workspace.init()
    if (workspace.hasWorkspace) {
      dataStore.loadWorkspace()
    }
  })
</script>
```

**Do not remove any existing code from `+layout.svelte`.** Only add the workspace init.

### Step 6.3 — Update `+page.svelte` to show setup screen when no workspace

Open `apps/web/src/routes/+page.svelte`.

At the top of the `<script>` block, add:
```typescript
import { workspace } from '$lib/workspace.svelte.js'
import { dataStore } from '$lib/data.svelte.js'
import WorkspaceSetup from '$lib/components/WorkspaceSetup.svelte'
```

Replace the existing import of `todosStore` with `dataStore`:
```typescript
// REMOVE: import { todosStore } from '$lib/todos.svelte.js'
// ADD: (already imported above)
```

In the template, wrap the existing content with a conditional:
```svelte
{#if !workspace.hasWorkspace}
  <WorkspaceSetup />
{:else}
  <!-- ALL existing page content goes here -->
{/if}
```

### Step 6.4 — Replace `todosStore` references with `dataStore`

Throughout `+page.svelte` and `AppSidebar.svelte` (or wherever `todosStore` is used), replace:
- `todosStore.todos` → `dataStore.todos`
- `todosStore.lists` → `dataStore.lists`
- `todosStore.filteredTodos` → `dataStore.filteredTodos`
- `todosStore.counts` → `dataStore.counts`
- `todosStore.activeFilter` → `dataStore.activeFilter`
- `todosStore.activeListId` → `dataStore.activeListId`
- `todosStore.setActiveList(...)` → `dataStore.setActiveList(...)`
- `todosStore.addTodo(...)` → `dataStore.addTodo(...)`
- `todosStore.toggleTodo(...)` → `dataStore.toggleTodo(...)`
- `todosStore.deleteTodo(...)` → `dataStore.deleteTodo(...)`
- `todosStore.updateTodo(...)` → `dataStore.updateTodo(...)`
- `todosStore.addList(...)` → `dataStore.addList(...)`
- `todosStore.deleteList(...)` → `dataStore.deleteList(...)`

The API is identical to `todosStore`. This is a find-and-replace operation.

### Step 6.5 — Checkpoint

Run:
```bash
pnpm --filter apps/web exec tsc --noEmit
```

Fix all type errors. Then start the dev server:
```bash
pnpm --filter apps/web dev
```

The app should show the WorkspaceSetup screen in a browser (since `window.berylDesktop` is not defined). The "Open Workspace Folder" button will show an error message — that's expected in a browser.

---

## Phase 7: End-to-End Verification

**Goal:** Verify everything works together in the Electron app.

### Step 7.1 — Run the desktop app

```bash
pnpm --filter @beryl/desktop dev
```

### Step 7.2 — Test checklist

Go through each item. Do not mark the plan complete until all pass:

- [ ] App opens without errors in the console
- [ ] WorkspaceSetup screen is shown on first launch
- [ ] Clicking "Open Workspace Folder" opens the OS folder picker dialog
- [ ] Selecting a folder dismisses the setup screen and shows the main UI
- [ ] A folder with existing `.md` files: tasks from those files appear in the UI
- [ ] An empty folder: no tasks, but app shows correctly with empty state
- [ ] Creating a new task: task appears in the UI immediately
- [ ] After ~300ms: a `.md` file is written/updated in the chosen folder (verify with Finder/text editor)
- [ ] Toggling a task complete: file is updated on disk
- [ ] Editing a task title: file is updated on disk
- [ ] Deleting a task: file is updated on disk
- [ ] External edit: open the `.md` file in a text editor, add a task, save — the new task appears in the Beryl UI within a few seconds (file watcher)
- [ ] Closing and reopening the app: the same workspace is restored (localStorage persistence)

### Step 7.3 — Fix any issues found in testing

Common issues and where to look:
- `window.berylDesktop` is undefined → preload.js not loading → check webpack/vite config for electron-forge, check preload path in main.js
- `parseProject` throws → the `.md` file has content that beryljs can't parse → check the file content, beryljs only supports the specific format (no headings, no freeform text, only task lines and comments)
- Save never happens → check that `scheduleSave` is being called, check console for errors in `saveFile`
- File watcher not firing → check that `watchDir` IPC handler is registered, check `onDirChanged` listener in electron adapter

---

## Phase 8: iOS Info.plist (Mobile Only)

**Goal:** Make the Beryl folder visible in the iOS Files app.

Only do this phase if you have a Mac with Xcode installed and need to build for iOS.

Open `apps/native/ios/App/App/Info.plist`. Add these two keys inside the root `<dict>`:

```xml
<!-- Allow the "Beryl" folder to appear in the iOS Files app -->
<key>UIFileSharingEnabled</key>
<true/>

<!-- Allow files to be opened/edited in place (not copied) -->
<key>LSSupportsOpeningDocumentsInPlace</key>
<true/>
```

**What this does:** A "Beryl" folder appears in the user's iOS Files app under "On My iPhone" (or under iCloud Drive if enabled for the app). Users put `.md` files there. iCloud syncs it.

---

## What Is Not In This Plan

These are out of scope for this plan. Do not implement them:
- Subtask support in the UI
- Tags beyond `p:` and `due:`
- Command palette / keyboard shortcuts
- Search
- Sync service
- Plugin system
- Parser rewrite (Nearley → three-stage pipeline)

---

## Known Limitations

1. **beryljs throws on malformed markdown.** The `parseProject` call is wrapped in try/catch that treats parse errors as empty files. If a user has a `.md` file with content that beryljs can't parse (e.g., headings, freeform text, URLs), the file will appear empty in the UI. The file is NOT deleted or overwritten until the user adds/edits a task in that list.

2. **No stable task IDs in files.** Task IDs are ephemeral UUIDs assigned on each file load. If the file watcher fires and reloads a file, the UI rebuilds with new IDs. This is fine for the current UI — there are no links to tasks by ID. It would become a problem if we add task permalinks.

3. **Capacitor watcher is a 3-second poll.** On mobile, external changes (from iCloud sync) appear within 3 seconds. This is an intentional tradeoff — native file watchers on iOS require significant extra native code.

4. **List deletion does not delete the .md file.** The user manages their own files. Deleting a list in the UI hides it from the sidebar but leaves the file on disk. On next app launch, if the file is still there, the list reappears.
