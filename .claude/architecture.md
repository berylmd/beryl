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
│   ├── beryljs/      Markdown task parser (Nearley grammar)
│   └── file-adapter/ FileAdapter interface (to be created)
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
| Electron | Node `fs.readFile` via IPC | Node `fs.writeFile` via IPC | Node `fs.readdir` via IPC | Node `fs.watch` via IPC | `dialog.showOpenDialog` |
| Capacitor | `Filesystem.readFile` | `Filesystem.writeFile` | `Filesystem.readdir` | 2s poll | Fixed `Documents/Beryl/` dir |

---

## Data Flow

### User edits a task in the UI
```
1. User toggles checkbox / edits title / changes priority
2. UI calls dataStore.updateTodo(id, changes)
3. dataStore updates $state<Todo[]> → Svelte re-renders immediately
4. dataStore calls scheduleSave(listId) — debounced 300ms
5. After 300ms: serialize todos to markdown, call fileAdapter.writeFile()
6. File watcher fires — writeInProgress guard set → IGNORED
```

### External file change (Dropbox, git pull, text editor)
```
1. External app modifies .md file
2. File watcher callback fires
3. writeInProgress guard NOT set → proceed
4. Compute hash of new content vs last known hash
5. If different: parseFile() → new Todo[] → replace in dataStore
6. Svelte reactivity re-renders UI
```

### App startup
```
1. app.html loads → main.ts runs
2. Detect platform (window.berylDesktop? Capacitor? browser)
3. Create appropriate FileAdapter
4. Check localStorage for last rootDir
5. If found: open workspace automatically
6. If not: show WorkspaceSetup screen
7. WorkspaceSetup: user picks folder → loadWorkspace() → loadAllFiles()
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

Located at `packages/beryljs/`. Uses Nearley parser.

**Public API:**
```typescript
import { parseProject, printProject } from '@beryl/beryljs'
import type { Task } from '@beryl/beryljs'

// Parse markdown → Task[]
const tasks: Task[] = parseProject(markdownString)

// Serialize Task[] → markdown
const md: string = printProject(tasks)
```

**Parsed Task shape** (what fields matter):
```typescript
{
  checked: boolean,
  description: string,        // FULL text including label tokens, e.g. "Buy groceries p:high due:2025-03-01"
  labels: Array<{             // Parsed label objects
    label: string,            // key, e.g. "p", "due"
    value: string,            // value, e.g. "high", "2025-03-01"
  }>,
  comments: string | string[],  // text of > comment lines
  subtasks: Task[],
  indent: number,             // 0 = top-level
}
```

**Key behaviors:**
- `description` includes the label text — must strip labels to get clean title
- Comments from `\t>text` lines end up in `task.comments`
- Parser throws on malformed input (wrap in try/catch)
- Empty file or whitespace-only → returns `[]`
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
  color: string        // UI preference, stored in localStorage
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
export type Platform = 'electron' | 'capacitor' | 'browser'

export function detectPlatform(): Platform {
  if (typeof (window as any).berylDesktop !== 'undefined') return 'electron'
  if (typeof (window as any).Capacitor !== 'undefined') return 'capacitor'
  return 'browser'
}
```

`window.berylDesktop` is exposed by the Electron preload script. `window.Capacitor` is set by Capacitor's runtime.

---

## Key File Locations

```
apps/web/src/
├── routes/
│   ├── +layout.svelte        Root layout — platform init goes here
│   └── +page.svelte          Main todo UI
├── lib/
│   ├── types.ts              Todo, List, Priority types
│   ├── todos.svelte.ts       In-memory state (TO BE REPLACED by data.svelte.ts)
│   ├── theme.svelte.ts       Dark/light theme + Capacitor status bar
│   ├── platform.ts           Platform detection (TO BE CREATED)
│   ├── workspace.svelte.ts   rootDir + fileAdapter state (TO BE CREATED)
│   ├── data.svelte.ts        File-backed data layer (TO BE CREATED)
│   └── adapters/
│       ├── electron.ts       Electron FileAdapter impl (TO BE CREATED)
│       └── capacitor.ts      Capacitor FileAdapter impl (TO BE CREATED)
├── components/
│   └── WorkspaceSetup.svelte  Folder picker UI (TO BE CREATED)
│
apps/desktop/src/
├── main.js                   Electron main process (NEEDS IPC handlers added)
└── preload.js                Empty — NEEDS contextBridge impl
│
packages/
├── beryljs/                  Nearley parser — DO NOT MODIFY
└── file-adapter/             FileAdapter interface — TO BE CREATED
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
│  contextBridge.exposeInMainWorld('berylDesktop', {}) │
└─────────────────┬───────────────────────────────────┘
                  │ ipcRenderer.invoke → ipcMain.handle
┌─────────────────▼───────────────────────────────────┐
│  Main Process (main.js)                              │
│  ipcMain.handle('readFile', async (_, p) =>          │
│    fs.readFile(p, 'utf-8'))                          │
│                                                      │
│  Node.js fs API ──> actual files on disk             │
└─────────────────────────────────────────────────────┘
```

**Security:** `contextIsolation: true`, `nodeIntegration: false`. Node APIs never directly exposed to renderer. All access goes through contextBridge.

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

**Mobile workspace:** Fixed directory `Documents/Beryl/`. On iOS, this is exposed to the Files app via `Info.plist` (`UIFileSharingEnabled`, `LSSupportsOpeningDocumentsInPlace`). Users sync using iCloud or whatever Files app supports.

---

## What Is NOT in Scope (Yet)

- Subtasks in the UI (parser supports them, UI doesn't expose them)
- Command palette / keyboard-first navigation
- Tags/labels beyond priority and due date
- Search across files
- Sync service (users manage their own sync)
- Plugin system
- Parser rewrite (Nearley → zero-dep three-stage pipeline)
