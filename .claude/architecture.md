# Beryl Architecture

## What Beryl Is

A markdown-based task manager. Tasks live in `.md` files on disk. One file = one "List". The app reads and writes those files. Sync is left to the user (iCloud, Dropbox, Syncthing, etc.).

---

## Monorepo Structure

```
red-beryl/
├── apps/
│   ├── web/          SvelteKit app — the actual UI (all platforms share this)
│   ├── desktop/      Electron shell — wraps the web app for desktop
│   └── native/       Capacitor shell — wraps the web app for iOS/Android
├── packages/
│   ├── beryljs/      Markdown task parser (Nearley grammar) — package: @repo/beryljs
│   └── file-adapter/ FileAdapter interface — package: @repo/file-adapter
├── turbo.json
└── pnpm-workspace.yaml
```

**Package dependency graph:**
```
apps/web  ──────────────────> packages/beryljs
apps/web  ──────────────────> packages/file-adapter
apps/desktop  ──────────────> (loads apps/web via URL in dev, file in prod)
apps/native   ──────────────> (loads apps/web/build/ via cap sync)
```

---

## Technology Stack

| Layer | Technology | Notes |
|---|---|---|
| UI framework | Svelte 5 | Uses runes: `$state`, `$derived`, `$effect` |
| Meta-framework | SvelteKit 2 | Static adapter (no server) |
| Styling | Tailwind CSS v4 | Uses `@import "tailwindcss"` not config file |
| Components | shadcn-svelte (bits-ui) | Headless + Tailwind — source lives in repo |
| Icons | lucide-svelte | |
| Parser | packages/beryljs | Nearley grammar, parses markdown tasks |
| Desktop shell | Electron (electron-forge) | Node.js file I/O via IPC |
| Mobile shell | Capacitor 8 | `@capacitor/filesystem` for file I/O |
| Build orchestration | Turborepo | `pnpm dev` runs all apps |

---

## The FileAdapter Interface

The **FileAdapter** is the keystone abstraction. The UI never touches the filesystem directly — it always goes through a FileAdapter. This lets the same UI code run on Electron (real fs), Capacitor (sandboxed fs), and eventually a sync-enabled adapter.

```typescript
// packages/file-adapter/src/index.ts
interface FileAdapter {
  readFile(path: string): Promise<string>
  writeFile(path: string, content: string): Promise<void>
  listFiles(dir: string): Promise<string[]>
  watchDir(dir: string, callback: () => void): Promise<() => void>
  pickDirectory(): Promise<string | null>
}
```

**Implementations:**

| Platform | readFile | writeFile | listFiles | watchDir | pickDirectory |
|---|---|---|---|---|---|
| Electron | Node `fs.readFile` via IPC | Node `fs.writeFile` via IPC | Node `fs.readdir` via IPC | Node `fs.watch` via IPC (push model) | `dialog.showOpenDialog` |
| Capacitor | NOT IMPLEMENTED (stub) | NOT IMPLEMENTED (stub) | NOT IMPLEMENTED (stub) | NOT IMPLEMENTED (stub) | NOT IMPLEMENTED (stub) |
| Test | In-memory Map | In-memory Map | In-memory Map | Callback set | Fixed `/test-workspace` |

---

## Data Flow

### User edits a task in the UI
```
1. User toggles checkbox / edits title / changes priority
2. UI calls dataStore.toggleTodo(id) / addTodo(...) / updateTodo(...) / deleteTodo(id)
3. dataStore updates $state<Todo[]> → Svelte re-renders immediately
4. Mutation calls saveCallback(listId) — registered by workspaceSync at startup
5. workspaceSync.scheduleSave(listId) debounces 300ms → flushSave(listId)
6. flushSave serializes todos for that list → adapter.writeFile(path, content)
```

### App startup
```
1. app.html loads → +layout.svelte mounts
2. workspace.init() runs:
   a. If window.__BERYL_TEST_ADAPTER__ exists → use it (Playwright testing)
   b. Else: detectPlatform() → create ElectronAdapter or CapacitorAdapter
   c. Restore lastDir from localStorage
3. If workspace.hasWorkspace → workspaceSync.loadWorkspace()
4. Else → show WorkspaceSetup screen (user picks folder)
5. WorkspaceSetup calls workspace.setRootDir() → workspaceSync.loadWorkspace()
```

### workspaceSync.loadWorkspace()
```
1. adapter.listFiles(rootDir) → array of filenames
2. Filter to .md files
3. For each .md: adapter.readFile() → parseFile() → Todo[]
4. dataStore.hydrate(newLists, newTodos) — bulk update of reactive state
5. Default activeListId to first list (inside hydrate)
6. adapter.watchDir(rootDir, callback) → watch for external changes
```

### File watcher — external change handling
```
1. OS notifies adapter → watchDir callback fires
2. workspaceSync checks: is a save in-flight, or did we just finish saving?
   - activeSaves > 0 → ignore (write in progress)
   - Date.now() - lastSaveCompletedAt < 1500ms → ignore (our own write, suppress reload)
   - saveTimers pending → ignore (debounce not flushed yet)
3. Otherwise: call loadWorkspace() → full re-read from disk
```

---

## File Format

Each "List" is one `.md` file. File name (without `.md`) is the list's ID and display name.

**Example: `work.md`**
```markdown
- [ ] Build the data layer p:high due:2025-03-01
	>Connect beryljs parser to the file adapter
- [x] Set up shadcn-svelte p:high
- [ ] Write tests p:medium
- [ ] Plan Q2 roadmap p:low due:2025-04-01
	>Talk to the team first
```

**Format rules:**
- Task line: `- [ ] title` or `- [x] title`
- Labels in task body: `p:high`, `p:medium`, `p:low`, `due:YYYY-MM-DD`
- Comment (notes): indented line `\t>text` directly after the task
- Indentation: one tab character (`\t`) per nesting level
- Top-level tasks only (no subtask support in v1 of the UI)

**Priority encoding:**
- `p:high` → `priority: 'high'`
- `p:low` → `priority: 'low'`
- (omit) → `priority: 'medium'` (default, not written to file)

---

## beryljs Parser

Located at `packages/beryljs/`. Uses Nearley parser. Package name: `@repo/beryljs`.

**Public API:**
```typescript
import { parseProject, printProject } from '@repo/beryljs'
import type { Task, LabelText } from '@repo/beryljs'

// Parse markdown → Task[]
const tasks: Task[] = parseProject(markdownString)

// Serialize Task[] → markdown
const md: string = printProject(tasks)
```

**Parsed Task shape** (actual types from `packages/beryljs/types.ts`):
```typescript
class Task {
  type: string        // "task"
  indent: number      // 0 = top-level
  line: number        // 1-based line number assigned post-parse
  checked: boolean
  description: string // FULL text including label tokens, e.g. "Buy groceries p:high due:2025-03-01"
  labels: LabelText[] // Parsed labels
  comments: string[]  // text of > comment lines
  subtasks: Task[]
}

interface LabelText {
  text: string        // raw label string, e.g. "p:high"
  labels: {
    label: string     // key, e.g. "p", "due"
    text: string      // value, e.g. "high", "2025-03-01"
  }
}
```

**Accessing label values** (note the nesting — `labels.labels.label` / `labels.labels.text`):
```typescript
// To find priority:
const p = task.labels.find(l => l.labels.label === 'p')
const priority = p?.labels.text  // "high" | "low" | undefined

// To find due date:
const d = task.labels.find(l => l.labels.label === 'due')
const dueDate = d?.labels.text  // "2025-03-01" | undefined
```

**Key behaviors:**
- `description` includes the label text — must strip labels to get clean title
- Comments from `\t>text` lines end up in `task.comments` (always `string[]`, not `string | string[]`)
- Parser throws on malformed input (wrap in try/catch)
- Empty string or null → returns `[]`
- `printProject` uses `Task.toString()` which serializes back to markdown

**The data layer does NOT use `printProject`.** It uses a custom serializer because converting UI `Todo[]` back to beryljs `Task[]` is needlessly complex. The serializer is a simple string builder.

---

## UI Data Model

Defined in `apps/web/src/lib/types.ts`:

```typescript
type Priority = 'low' | 'medium' | 'high'

type Todo = {
  id: string           // ephemeral UUID, not stored in .md file
  title: string        // task text (no labels)
  completed: boolean
  priority: Priority
  dueDate: string | null   // ISO date string YYYY-MM-DD
  listId: string       // = filename without .md
  createdAt: string    // ISO datetime (not stored in file)
  notes: string        // content of > comment lines
}

type List = {
  id: string           // = filename without .md
  name: string         // = filename without .md (capitalized for display)
  color: string        // UI preference, stored in localStorage (default: '#6366f1')
}
```

**Todo ↔ file mapping:**
- `todo.id` — ephemeral, assigned on each file load, NOT stored in `.md`
- `todo.listId` — the filename (e.g. `work` for `work.md`)
- `todo.createdAt` — assigned on file load, NOT stored in `.md`
- `todo.priority === 'medium'` — NOT written to file (omitted)

---

## State Management (Svelte 5 Runes)

Svelte 5 uses runes instead of stores:

```typescript
// CORRECT (Svelte 5):
let count = $state(0)
let doubled = $derived(count * 2)
$effect(() => { console.log(count) })

// WRONG (Svelte 4 style — do not use):
const count = writable(0)
$: doubled = $count * 2
```

State lives in `.svelte.ts` files. The pattern used throughout the codebase is the "factory function with getters" pattern:

```typescript
function createStore() {
  let value = $state<string>('')

  return {
    get value() { return value },
    setValue(v: string) { value = v }
  }
}
export const myStore = createStore()
```

This creates a module-level singleton. Components import and use it directly:
```svelte
<script>
  import { myStore } from '$lib/mystore.svelte.ts'
</script>
{myStore.value}
```

---

## Platform Detection

```typescript
// apps/web/src/lib/platform.ts
// Note: Platform type is NOT exported
export function detectPlatform(): 'electron' | 'capacitor' | 'browser' {
  if (typeof (window as any).berylDesktop !== 'undefined') return 'electron'
  if (typeof (window as any).Capacitor !== 'undefined') return 'capacitor'
  return 'browser'
}
```

`window.berylDesktop` is exposed by the Electron preload script. `window.Capacitor` is set by Capacitor's runtime.

**Test adapter shortcut:** `workspace.init()` checks for `window.__BERYL_TEST_ADAPTER__` BEFORE calling `detectPlatform()`. If found, it uses that adapter directly (bypasses all platform logic). This is the Playwright testing hook.

---

## Key File Locations

```
apps/web/src/
├── routes/
│   ├── +layout.svelte             Root layout — workspace.init()
│   ├── +page.svelte               Redirects to /tasks or /setup
│   ├── tasks/
│   │   ├── +layout.svelte         Calls workspaceSync.loadWorkspace() on ready
│   │   └── +page.svelte           Main task view
│   └── setup/
│       └── +page.svelte           Workspace setup page
├── lib/
│   ├── platform.ts                detectPlatform() utility
│   ├── tasks/
│   │   ├── store.svelte.ts        Pure reactive state + mutations (dataStore)
│   │   ├── sync.ts                File I/O orchestration (workspaceSync)
│   │   ├── serializer.ts          parseFile() + serializeTodos() — Todo ↔ markdown
│   │   ├── types.ts               Todo, List, Priority types
│   │   ├── AddTaskForm.svelte
│   │   ├── EditTaskDialog.svelte
│   │   ├── TaskItem.svelte
│   │   ├── TaskList.svelte
│   │   └── priority.ts            Priority display helpers
│   ├── workspace/
│   │   ├── store.svelte.ts        fileAdapter + rootDir state, platform init (workspace)
│   │   ├── WorkspaceSetup.svelte  Folder picker UI — calls workspaceSync.loadWorkspace()
│   │   └── adapters/
│   │       ├── electron.ts        Electron FileAdapter impl (complete)
│   │       ├── capacitor.ts       Capacitor FileAdapter impl (stub — all methods throw)
│   │       └── test.ts            TestFileAdapter + Playwright helpers
│   ├── layout/
│   │   ├── AppSidebar.svelte
│   │   └── PageHeader.svelte
│   └── theme/
│       └── store.svelte.ts        Dark/light theme + Capacitor status bar
│
apps/desktop/src/
├── main.js                        Electron main process — all IPC handlers implemented
└── preload.js                     contextBridge impl — exposes window.berylDesktop
│
packages/
├── beryljs/                       Nearley parser — DO NOT MODIFY
└── file-adapter/                  FileAdapter interface (pure TypeScript, no build step)
```

---

## Electron Architecture

```
┌─────────────────────────────────────────────────────┐
│  Renderer Process (Svelte app)                       │
│  window.berylDesktop.readFile(path)                  │
└─────────────────┬───────────────────────────────────┘
                  │ IPC (contextBridge)
┌─────────────────▼───────────────────────────────────┐
│  Preload Script (preload.js)                         │
│  contextBridge.exposeInMainWorld('berylDesktop', {   │
│    readFile, writeFile, listFiles,                   │
│    watchDir, unwatchDir, pickDirectory,              │
│    onDirChanged                                      │
│  })                                                  │
└─────────────────┬───────────────────────────────────┘
                  │ ipcRenderer.invoke → ipcMain.handle
┌─────────────────▼───────────────────────────────────┐
│  Main Process (main.js)                              │
│  IPC channels (all prefixed beryl:):                 │
│    beryl:readFile, beryl:writeFile, beryl:listFiles  │
│    beryl:watchDir, beryl:unwatchDir                  │
│    beryl:pickDirectory                               │
│  Push event: beryl:dirChanged (mainWindow → renderer)│
│                                                      │
│  Node.js fs API ──> actual files on disk             │
└─────────────────────────────────────────────────────┘
```

**File watcher (push model):**
- `beryl:watchDir` IPC → `fs.watch(dir)` registered in `watchers` Map
- On change: `mainWindow.webContents.send('beryl:dirChanged', dir)`
- Preload: `ipcRenderer.on('beryl:dirChanged', callback)` via `onDirChanged`
- Renderer: `api.onDirChanged(changedDir => { if (changedDir === dir) callback() })`

**Security:** `contextIsolation: true`, `nodeIntegration: false`. Node APIs never directly exposed to renderer.

---

## Capacitor Architecture

```
┌──────────────────────────────────────────────────────┐
│  WebView (same Svelte app)                            │
│  Filesystem.readFile({ path, directory })             │
└─────────────────┬────────────────────────────────────┘
                  │ JS bridge
┌─────────────────▼────────────────────────────────────┐
│  Capacitor Runtime                                    │
│  @capacitor/filesystem plugin                        │
└─────────────────┬────────────────────────────────────┘
                  │ native bridge
┌─────────────────▼────────────────────────────────────┐
│  iOS: NSFileManager / UIDocument                      │
│  Android: Scoped Storage via ContentProvider          │
└──────────────────────────────────────────────────────┘
```

**Status:** The `createCapacitorAdapter()` in `adapters/capacitor.ts` is a stub — all methods return `Promise.reject(...)`. The Capacitor adapter needs to be implemented.

**Mobile workspace:** Fixed directory `Documents/Beryl/`. On iOS, this is exposed to the Files app via `Info.plist` (`UIFileSharingEnabled`, `LSSupportsOpeningDocumentsInPlace`).

---

## Testing Architecture

Tests use a `TestFileAdapter` (`apps/web/src/lib/workspace/adapters/test.ts`) that stores files in an in-memory `Map<string, string>`.

**How it works:**
1. In Playwright test, call `setupTestAdapter(page, initialFiles)` before navigating
2. This calls `page.addInitScript` to set `window.__BERYL_TEST_ADAPTER__` in the browser
3. `workspace.init()` detects the test adapter and uses it instead of a real platform adapter
4. After UI interactions, call `getFileContent(page, path)` or `getWriteHistory(page)` to assert

**Test helper functions** exported from `adapters/test.ts`:
- `setupTestAdapter(page, initialFiles, rootDir?)` — inject adapter into browser
- `getFileContent(page, path)` — read a file from the test adapter
- `getWriteHistory(page)` — get all write operations
- `resetWriteHistory(page)` — clear write history
- `setFileContent(page, path, content)` — simulate external file change (triggers watchers)

---

## What Is NOT Yet Implemented

- **Capacitor adapter** — all methods are stubs that throw
- **Subtasks in the UI** — parser supports them, UI doesn't expose them
- **List colors** — default `#6366f1` always; no UI to change it
- **Command palette / keyboard-first navigation**
- **Tags/labels beyond priority and due date**
- **Search across files**
- **Sync service** (users manage their own sync)
- **Plugin system**
- **Parser rewrite** (Nearley → zero-dep three-stage pipeline)
