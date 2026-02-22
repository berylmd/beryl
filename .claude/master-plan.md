# Beryl — Complete Migration & Roadmap

## Document Purpose

This is the master plan for migrating Beryl from its current architecture to a simpler, faster, more maintainable one — and then building features on top of it. It consolidates all architectural decisions into a single actionable document.

**Who this is for:** Sam (project owner), any future contributors, and any coding agents tasked with implementation.

---

## Table of Contents

1. [Current State](#1-current-state)
2. [Target State](#2-target-state)
3. [Migration Phase 1: Monorepo & Cleanup](#3-migration-phase-1-monorepo--cleanup)
4. [Migration Phase 2: Extract the Parser (as-is)](#4-migration-phase-2-extract-the-parser)
5. [Migration Phase 3: The FileAdapter Abstraction](#5-migration-phase-3-the-fileadapter-abstraction)
6. [Migration Phase 4: Replace Ionic with shadcn-svelte](#6-migration-phase-4-replace-ionic-with-shadcn-svelte)
7. [Migration Phase 5: Data Layer Rewrite (PouchDB → Files)](#7-migration-phase-5-data-layer-rewrite-pouchdb--files)
8. [Migration Phase 6: Electron Desktop Shell](#8-migration-phase-6-electron-desktop-shell)
9. [Migration Phase 7: Capacitor Mobile Shell](#9-migration-phase-7-capacitor-mobile-shell)
10. [Migration Phase 8: Verification & Cleanup](#10-migration-phase-8-verification--cleanup)
11. [Post-Migration: Feature Roadmap](#11-post-migration-feature-roadmap) (incl. Milestone 6: Parser Rewrite)
12. [Future: Plugin System](#12-future-plugin-system)
13. [Future: Sync Service](#13-future-sync-service)
14. [Appendix A: Data Flow Reference](#appendix-a-data-flow-reference)
15. [Appendix B: FileAdapter Interface Reference](#appendix-b-fileadapter-interface-reference)
16. [Appendix C: Ionic → shadcn-svelte Component Map](#appendix-c-ionic--shadcn-svelte-component-map)
17. [Appendix D: Parser Rewrite Architecture](#appendix-d-parser-rewrite-architecture)

---

## 1. Current State

**Repo:** `https://codeberg.org/beryl/beryl`

```
beryl/                          STATUS
├── apps/
│   └── desktop/                Wails (Go) shell wrapping Svelte UI     ← REMOVING
├── e2e/                        Appium end-to-end tests                 ← KEEPING (adapt later)
├── infra/fly.io/               CouchDB sync server config              ← REMOVING
├── libs/                       JS/TS parser + shared libraries         ← EXTRACTING
├── plugins/                    Plugin system experiments               ← REMOVING (rebuild later)
├── site/                       Marketing site (beryl.md)               ← KEEPING
├── third_party/go/             Go deps for Please build system         ← REMOVING
├── .plzconfig*                 Please build system config              ← REMOVING
├── pleasew                     Please wrapper script                   ← REMOVING
├── BUILD                       Root build file for Please              ← REMOVING
└── README.md                                                           ← REWRITING
```

**Technologies being removed and why:**

| Technology | Why it's being removed |
|---|---|
| Wails (Go) | Requires Go toolchain. Dev only maintains JS. Replaced by Electron. |
| PouchDB / CouchDB | Complex sync infra to maintain. Replaced by "user syncs their own files." |
| Please build system | Niche, steep learning curve, blocks contributors. Replaced by pnpm workspaces. |
| Ionic / ionic-svelte | Unofficial Svelte wrapper. `bind:value` broken, 800KB bundle, modal workarounds, visual glitches. Replaced by shadcn-svelte. |
| All Go code | Dead Go parser, dead TUI. JS parser is canonical. |
| fly.io infra | Hosted CouchDB. No longer needed without PouchDB sync. |

**Technologies being kept:**

| Technology | Why |
|---|---|
| Svelte | The dev knows it, likes it, it's fast, and it works. |
| Capacitor | Already in use for mobile. Wraps the same web UI. |
| The JS/TS parser | Canonical parser. The heart of the project. |
| The Svelte UI logic | Stores, actions, and business logic (not the Ionic presentation layer). |

**Technologies being added:**

| Technology | Why |
|---|---|
| Electron | Desktop shell. JS only, full fs access, proven packaging. Same approach as Obsidian. |
| pnpm workspaces | Standard monorepo tooling. `pnpm install && pnpm dev` to contribute. |
| shadcn-svelte | Beautiful, accessible Svelte components. Built on Bits UI + Tailwind. Code lives in your repo. |
| Tailwind CSS | Required by shadcn-svelte. Utility-first CSS. |
| tsup | Builds the parser and file-adapter packages. Zero config. |
| vitest | Fast test runner. Works with ESM and Svelte. |

---

## 2. Target State

```
beryl/
├── packages/
│   ├── parser/                  Standalone TS parser/serializer
│   │   ├── src/
│   │   │   ├── index.ts         Re-exports parse, serialize, Task type
│   │   │   ├── parse.ts         Markdown → Task[]
│   │   │   ├── serialize.ts     Task[] → Markdown
│   │   │   └── types.ts         Task, TaskChangeEvent, etc.
│   │   ├── test/
│   │   └── package.json         @beryl/parser
│   │
│   ├── file-adapter/            FileAdapter interface (types only)
│   │   ├── src/
│   │   │   └── index.ts         FileAdapter interface definition
│   │   └── package.json         @beryl/file-adapter
│   │
│   └── ui/                      Svelte UI (shared between platforms)
│       ├── src/
│       │   ├── lib/
│       │   │   ├── components/
│       │   │   │   └── ui/      shadcn-svelte components (owned source)
│       │   │   ├── stores/
│       │   │   │   ├── tasks.ts
│       │   │   │   ├── projects.ts
│       │   │   │   └── workspace.ts
│       │   │   ├── actions/
│       │   │   │   └── task-actions.ts
│       │   │   ├── adapters/
│       │   │   │   ├── electron.ts
│       │   │   │   └── capacitor.ts
│       │   │   ├── data.ts      Core data layer (replaces PouchDB)
│       │   │   ├── files.ts     FileAdapter + rootDir Svelte stores
│       │   │   └── platform.ts  Platform detection
│       │   ├── App.svelte
│       │   └── main.ts
│       └── package.json         @beryl/ui
│
├── apps/
│   ├── desktop/                 Electron shell (~200 lines)
│   │   ├── main.js              Electron main process + IPC handlers
│   │   ├── preload.js           Context bridge for FileAdapter
│   │   └── package.json         @beryl/desktop
│   │
│   └── mobile/                  Capacitor shell
│       ├── capacitor.config.ts
│       ├── android/
│       ├── ios/
│       └── package.json         @beryl/mobile
│
├── site/                        Marketing site (beryl.md)
├── pnpm-workspace.yaml
├── package.json                 Root workspace config
└── README.md
```

**Sync strategy:** None built-in. Users sync `.md` files with iCloud Drive, Dropbox, Syncthing, Google Drive, OneDrive, or Git. Beryl reads and writes files in a folder the user picks.

---

## 3. Migration Phase 1: Monorepo & Cleanup

**Goal:** Remove all dead code and set up pnpm workspaces. At the end of this phase, the repo is clean but the app doesn't work yet.

### Step 1.1 — Branch

```bash
git checkout -b migration
```

### Step 1.2 — Inventory (DO THIS BEFORE DELETING ANYTHING)

Search the codebase and write down the exact locations of:

**The parser:**
- Find all files in `libs/` related to parsing/serializing markdown tasks
- List every exported function and type
- List every test file

**The Svelte UI:**
- Find all `.svelte` component files
- Find all Svelte store files (files using `writable()`, `readable()`, `derived()`)
- Find the app entry point

**PouchDB usage (every single reference):**
```bash
grep -rn "pouchdb\|PouchDB\|couchdb\|CouchDB\|\.put(\|\.get(\|\.allDocs(\|\.bulkDocs(\|\.changes(\|\.replicate" --include="*.ts" --include="*.js" --include="*.svelte" .
```
Write down every file and line. These will be replaced in Phase 5.

**Ionic usage (every single reference):**
```bash
grep -rn "ion-\|ionic\|@ionic\|setupIonic" --include="*.ts" --include="*.js" --include="*.svelte" --include="*.css" .
```
Write down every file and line. These will be replaced in Phase 4.

### Step 1.3 — Delete dead code

Delete these files and directories:

```bash
# Please build system
rm -f .plzconfig .plzconfig.local.example .plzconfig_darwin_amd64 pleasew BUILD
find . -name "BUILD" -not -path "./.git/*" -delete

# Go code
rm -rf third_party/
find . -name "*.go" -not -path "./.git/*" -delete
find . -name "go.mod" -delete
find . -name "go.sum" -delete

# Sync infra
rm -rf infra/

# Old plugin experiments (we'll rebuild this properly later)
rm -rf plugins/
```

### Step 1.4 — Create pnpm workspace

Create `pnpm-workspace.yaml` in repo root:

```yaml
packages:
  - "packages/*"
  - "apps/*"
```

Create root `package.json`:

```json
{
  "name": "beryl",
  "private": true,
  "scripts": {
    "dev": "pnpm --filter @beryl/desktop dev",
    "build": "pnpm --filter @beryl/desktop build",
    "dev:mobile": "pnpm --filter @beryl/mobile dev",
    "build:mobile": "pnpm --filter @beryl/mobile build",
    "test": "pnpm -r test",
    "test:parser": "pnpm --filter @beryl/parser test"
  },
  "engines": {
    "node": ">=18"
  }
}
```

### Step 1.5 — Create directory structure

```bash
mkdir -p packages/parser/src packages/parser/test
mkdir -p packages/file-adapter/src
mkdir -p packages/ui/src/lib/{components/ui,stores,actions,adapters}
mkdir -p apps/desktop
mkdir -p apps/mobile
```

### Step 1.6 — Checkpoint

```bash
git add -A
git commit -m "phase 1: remove dead code, set up pnpm workspaces"
```

---

## 4. Migration Phase 2: Extract the Parser

**Goal:** Move the existing JS/TS parser into its own package within the monorepo. **Do not rewrite it.** Keep it exactly as-is, including any existing dependencies. We just need it isolated as a package so the rest of the codebase can import it cleanly.

The parser will be rewritten later (see [Milestone 6: Parser Rewrite](#milestone-6-parser-rewrite)) with a proper three-stage architecture and round-trip fidelity. For now, we just move files and make sure existing tests pass.

### Step 2.1 — Move parser files

Move the parser source files identified in Step 1.2 into `packages/parser/src/`. **Copy the files exactly as they are.** Do not rename, refactor, or restructure them.

### Step 2.2 — Create package.json

`packages/parser/package.json`:

```json
{
  "name": "@beryl/parser",
  "version": "0.1.0",
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "types": "./dist/index.d.ts"
    }
  },
  "scripts": {
    "build": "tsup src/index.ts --format esm --dts",
    "dev": "tsup src/index.ts --format esm --dts --watch",
    "test": "vitest run"
  },
  "devDependencies": {
    "tsup": "^8.0.0",
    "typescript": "^5.3.0",
    "vitest": "^1.0.0"
  }
}
```

**If the existing parser has npm dependencies**, add them to this `package.json` under `dependencies`. This is fine for now. The dependency-free rewrite happens later.

### Step 2.3 — Create entry point

Create `packages/parser/src/index.ts` that re-exports the existing parser's public surface. Adjust the import paths to match the actual filenames:

```ts
// These names must match what the existing parser exports.
// Look at the existing code and adjust accordingly.
export { parse } from './parse'
export { serialize } from './serialize'
export type { Task } from './types'
```

At minimum the parser must expose:

```ts
parse(markdown: string): Task[]
serialize(tasks: Task[]): string

interface Task {
  title: string
  completed: boolean
  tags: Record<string, string>
  subtasks: Task[]
  comment: string
}
```

If the existing parser's API surface doesn't match this exactly, create a thin wrapper in `index.ts` that adapts it. **Do not rewrite the parser internals to change the API.** Just wrap.

### Step 2.4 — Move and run tests

Move existing parser tests into `packages/parser/test/`. Update imports. Then:

```bash
cd packages/parser
pnpm install
pnpm test
```

**🛑 STOP. Do not proceed until all parser tests pass. You have not changed any parser logic — if tests fail, the problem is an import path or missing dependency.**

### Step 2.5 — Checkpoint

```bash
git add -A
git commit -m "phase 2: extract existing parser as @beryl/parser package (no rewrite)"
```

---

## 5. Migration Phase 3: The FileAdapter Abstraction

**Goal:** Define the interface that decouples the UI from the filesystem. This is the architectural keystone — everything else hangs off it.

### Step 3.1 — Create the file-adapter package

`packages/file-adapter/package.json`:

```json
{
  "name": "@beryl/file-adapter",
  "version": "0.1.0",
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "types": "./dist/index.d.ts"
    }
  },
  "scripts": {
    "build": "tsup src/index.ts --format esm --dts"
  },
  "devDependencies": {
    "tsup": "^8.0.0",
    "typescript": "^5.3.0"
  }
}
```

### Step 3.2 — Define the interface

`packages/file-adapter/src/index.ts`:

```ts
/**
 * FileAdapter is the contract between the Beryl UI and the host platform.
 *
 * - Desktop (Electron): implemented via Node fs through IPC
 * - Mobile (Capacitor): implemented via Capacitor Filesystem plugin
 * - Sync (future): a decorator that wraps any adapter and adds sync
 *
 * The UI never calls the filesystem directly. It always goes through this interface.
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
   * Desktop: native OS dialog. Mobile: fixed Documents subdirectory.
   */
  pickDirectory(): Promise<string | null>
}
```

### Step 3.3 — Build it

```bash
cd packages/file-adapter
pnpm install
pnpm build
```

### Step 3.4 — Checkpoint

```bash
git add -A
git commit -m "phase 3: define FileAdapter interface"
```

---

## 6. Migration Phase 4: Replace Ionic with shadcn-svelte

**Goal:** Remove every Ionic component and replace it with a shadcn-svelte equivalent. The app won't be *wired up* to data yet (that's Phase 5), but every component should render.

### Step 4.1 — Set up Tailwind + shadcn-svelte in the UI package

```bash
cd packages/ui
pnpm add -D tailwindcss @tailwindcss/vite svelte vite @sveltejs/vite-plugin-svelte
pnpm add bits-ui clsx tailwind-merge tailwind-variants lucide-svelte
npx shadcn-svelte@latest init
```

Then add the components Beryl needs:

```bash
npx shadcn-svelte@latest add button checkbox input dialog
npx shadcn-svelte@latest add dropdown-menu sidebar tabs toast
npx shadcn-svelte@latest add command tooltip card badge separator
```

These are copied into `packages/ui/src/lib/components/ui/` as source files.

### Step 4.2 — Replace Ionic components, one file at a time

Use the Ionic inventory from Step 1.2. For each `.svelte` file:

1. Replace Ionic imports with shadcn-svelte imports
2. Replace `<ion-*>` tags using the mapping in [Appendix C](#appendix-c-ionic--shadcn-svelte-component-map)
3. Replace `on:ionChange` handlers with `bind:value`
4. Remove Ionic lifecycle workarounds (`setupIonicSvelte`, `IonPage`, etc.)
5. Verify the component renders (even without data)

### Step 4.3 — Replace Ionic icons with Lucide

```bash
# Before (Ionic):
import { addOutline } from 'ionicons/icons'
<ion-icon icon={addOutline} />

# After (Lucide):
import { Plus } from 'lucide-svelte'
<Plus size={20} />
```

### Step 4.4 — Remove Ionic entirely

```bash
pnpm remove @ionic/core ionic-svelte ionicons
```

Delete:
- Ionic theme CSS (`variables.css` or similar)
- `setupIonicSvelte()` call in root layout
- Any `import 'ionic-svelte/components/*'` lines
- The `<ion-app>` wrapper element

Verify:
```bash
grep -rn "ion-\|ionic\|@ionic\|ionicons" --include="*.ts" --include="*.js" --include="*.svelte" --include="*.css" packages/ui/
# Must return zero results.
```

### Step 4.5 — Checkpoint

```bash
git add -A
git commit -m "phase 4: replace Ionic with shadcn-svelte"
```

---

## 7. Migration Phase 5: Data Layer Rewrite (PouchDB → Files)

**Goal:** Rip out PouchDB. The UI reads and writes `.md` files through the FileAdapter instead. This is the hardest phase.

### Step 5.1 — Create Svelte stores

`packages/ui/src/lib/files.ts`:

```ts
import { writable } from 'svelte/store'
import type { FileAdapter } from '@beryl/file-adapter'

/** Set by platform detection at startup. */
export const fileAdapter = writable<FileAdapter | null>(null)

/** The root directory the user has chosen. */
export const rootDir = writable<string | null>(null)
```

### Step 5.2 — Create the data layer

`packages/ui/src/lib/data.ts`:

This file replaces **all** PouchDB usage. It is the single place where parsing and serialization happen.

```ts
import { get, writable } from 'svelte/store'
import { parse, serialize } from '@beryl/parser'
import type { Task } from '@beryl/parser'
import { fileAdapter, rootDir } from './files'

/** In-memory store: filename → Task[] */
export const taskStore = writable<Map<string, Task[]>>(new Map())

/** Tracks files we're currently writing, to avoid fs.watch loops. */
const writeInProgress = new Set<string>()

/** Debounce timers per file, to avoid 100 disk writes while typing. */
const saveTimers = new Map<string, ReturnType<typeof setTimeout>>()

/** Hashes of last-read file contents, to skip spurious fs.watch events. */
const fileHashes = new Map<string, string>()

function simpleHash(str: string): string {
  let h = 0
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) - h + str.charCodeAt(i)) | 0
  }
  return h.toString(36)
}

/**
 * Load all .md files from the workspace. Called on startup
 * and when the file watcher fires.
 */
export async function loadAllTasks(): Promise<void> {
  const adapter = get(fileAdapter)
  const dir = get(rootDir)
  if (!adapter || !dir) return

  const files = await adapter.listFiles(dir)
  const mdFiles = files.filter(f => f.endsWith('.md'))
  const result = new Map<string, Task[]>()

  for (const file of mdFiles) {
    const content = await adapter.readFile(`${dir}/${file}`)
    fileHashes.set(file, simpleHash(content))
    result.set(file, parse(content))
  }

  taskStore.set(result)
}

/**
 * Reload a single file. Called by the file watcher
 * when an external change is detected.
 */
export async function reloadFile(filename: string): Promise<void> {
  const adapter = get(fileAdapter)
  const dir = get(rootDir)
  if (!adapter || !dir) return

  const content = await adapter.readFile(`${dir}/${filename}`)
  const hash = simpleHash(content)

  // Skip if content hasn't actually changed (spurious fs.watch event)
  if (fileHashes.get(filename) === hash) return
  fileHashes.set(filename, hash)

  const tasks = parse(content)
  taskStore.update(store => {
    store.set(filename, tasks)
    return new Map(store)  // new reference to trigger Svelte reactivity
  })
}

/**
 * Save tasks for a file. Called by UI actions.
 * Debounced: waits 300ms after the last call before writing.
 * This prevents 100 disk writes when a user types a long task title.
 * Sets a write guard so the file watcher ignores our own write.
 */
export async function saveTasks(filename: string, tasks: Task[]): Promise<void> {
  // Cancel any pending save for this file
  const existing = saveTimers.get(filename)
  if (existing) clearTimeout(existing)

  saveTimers.set(filename, setTimeout(async () => {
    saveTimers.delete(filename)

    const adapter = get(fileAdapter)
    const dir = get(rootDir)
    if (!adapter || !dir) return

    const content = serialize(tasks)
    fileHashes.set(filename, simpleHash(content))

    // Write guard: tell the watcher to ignore the next change event
    writeInProgress.add(filename)
    await adapter.writeFile(`${dir}/${filename}`, content)
    setTimeout(() => writeInProgress.delete(filename), 100)
  }, 300))
}

/**
 * Called by the file watcher callback.
 * Ignores our own writes. Reloads external changes.
 */
export function onFileChanged(filename: string): void {
  if (writeInProgress.has(filename)) return  // our own write, ignore
  reloadFile(filename)
}

/**
 * Start watching the workspace directory for external changes.
 */
export async function startWatching(): Promise<() => void> {
  const adapter = get(fileAdapter)
  const dir = get(rootDir)
  if (!adapter || !dir) return () => {}

  return adapter.watchDir(dir, async () => {
    // Reload all files on any directory change.
    // A smarter implementation could diff the file list,
    // but for a small workspace this is fine.
    const files = await adapter.listFiles(dir)
    const mdFiles = files.filter(f => f.endsWith('.md'))
    for (const file of mdFiles) {
      onFileChanged(file)
    }
  })
}
```

### Step 5.3 — Create task actions

`packages/ui/src/lib/actions/task-actions.ts`:

```ts
import { get } from 'svelte/store'
import { taskStore, saveTasks } from '../data'

export function toggleTask(filename: string, taskIndex: number): void {
  taskStore.update(store => {
    const tasks = store.get(filename)
    if (!tasks || !tasks[taskIndex]) return store
    tasks[taskIndex].completed = !tasks[taskIndex].completed
    saveTasks(filename, tasks)  // fire-and-forget, UI already updated
    return new Map(store)
  })
}

export function updateTaskTitle(filename: string, taskIndex: number, title: string): void {
  taskStore.update(store => {
    const tasks = store.get(filename)
    if (!tasks || !tasks[taskIndex]) return store
    tasks[taskIndex].title = title
    saveTasks(filename, tasks)
    return new Map(store)
  })
}

export function createTask(filename: string, title: string): void {
  taskStore.update(store => {
    const tasks = store.get(filename) ?? []
    tasks.push({ title, completed: false, tags: {}, subtasks: [], comment: '' })
    saveTasks(filename, tasks)
    return new Map(store)
  })
}

export function deleteTask(filename: string, taskIndex: number): void {
  taskStore.update(store => {
    const tasks = store.get(filename)
    if (!tasks) return store
    tasks.splice(taskIndex, 1)
    saveTasks(filename, tasks)
    return new Map(store)
  })
}

// Add more actions as needed: reorderTask, updateTag, addSubtask, etc.
```

### Step 5.4 — Replace every PouchDB call

Go through the PouchDB inventory from Step 1.2. Replace each call:

| PouchDB call | Replacement |
|---|---|
| `db.allDocs()` | `loadAllTasks()` at startup |
| `db.get(id)` | Read from `$taskStore.get(filename)` |
| `db.put(doc)` | Call the appropriate action from `task-actions.ts` |
| `db.changes({ live: true })` | `startWatching()` at startup |
| `db.replicate.to/from()` | **Delete entirely.** No sync. |
| Any sync configuration UI | Replace with "Open Workspace" folder picker |

### Step 5.5 — Remove PouchDB

```bash
pnpm remove pouchdb pouchdb-find pouchdb-adapter-idb  # and any other pouchdb-* packages
```

Verify:
```bash
grep -rn "pouchdb\|PouchDB\|couchdb\|CouchDB" --include="*.ts" --include="*.js" --include="*.svelte" .
# Must return zero results.
```

### Step 5.6 — Add workspace setup flow

Replace any existing sync configuration UI with a simple "Open Workspace" flow:

```svelte
<!-- WorkspaceSetup.svelte -->
<script>
  import { fileAdapter, rootDir } from '$lib/files'
  import { loadAllTasks, startWatching } from '$lib/data'
  import { Button } from '$lib/components/ui/button'
  import { FolderOpen } from 'lucide-svelte'
  import { get } from 'svelte/store'

  async function openWorkspace() {
    const adapter = get(fileAdapter)
    if (!adapter) return
    const dir = await adapter.pickDirectory()
    if (!dir) return
    rootDir.set(dir)
    await loadAllTasks()
    await startWatching()
  }
</script>

<div class="flex flex-col items-center justify-center h-screen gap-6">
  <h1 class="text-2xl font-semibold">Welcome to Beryl</h1>
  <p class="text-muted-foreground">Choose a folder for your tasks</p>
  <Button on:click={openWorkspace}>
    <FolderOpen class="mr-2 h-4 w-4" />
    Open Workspace
  </Button>
</div>
```

### Step 5.7 — Checkpoint

```bash
git add -A
git commit -m "phase 5: replace PouchDB with FileAdapter data layer"
```

---

## 8. Migration Phase 6: Electron Desktop Shell

**Goal:** The app runs as a desktop application on Linux, macOS, and Windows.

### Step 6.1 — Initialize

`apps/desktop/package.json`:

```json
{
  "name": "@beryl/desktop",
  "version": "0.1.0",
  "private": true,
  "main": "main.js",
  "scripts": {
    "dev": "electron .",
    "build": "electron-builder",
    "build:linux": "electron-builder --linux AppImage",
    "build:mac": "electron-builder --mac dmg",
    "build:win": "electron-builder --win nsis"
  },
  "build": {
    "appId": "md.beryl.app",
    "productName": "Beryl",
    "files": ["main.js", "preload.js", "dist/**/*"],
    "linux": { "target": "AppImage", "icon": "icons/icon.png" },
    "mac": { "target": "dmg", "icon": "icons/icon.icns" },
    "win": { "target": "nsis", "icon": "icons/icon.ico" }
  },
  "dependencies": {
    "@beryl/ui": "workspace:*"
  },
  "devDependencies": {
    "electron": "^33.0.0",
    "electron-builder": "^25.0.0"
  }
}
```

### Step 6.2 — Electron main process

`apps/desktop/main.js`:

```js
const { app, BrowserWindow, ipcMain, dialog } = require('electron')
const fs = require('fs/promises')
const path = require('path')
const { watch } = require('fs')

let mainWindow
const watchers = new Map()

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200, height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })
  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173')
  } else {
    mainWindow.loadFile(path.join(__dirname, 'dist', 'index.html'))
  }
}

app.whenReady().then(createWindow)
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

// --- FileAdapter IPC handlers (the entire backend) ---

ipcMain.handle('readFile', async (_, p) =>
  fs.readFile(p, 'utf-8'))

ipcMain.handle('writeFile', async (_, p, content) =>
  fs.writeFile(p, content, 'utf-8'))

ipcMain.handle('listFiles', async (_, dir) =>
  fs.readdir(dir))

ipcMain.handle('watchDir', async (_, dir) => {
  if (watchers.has(dir)) watchers.get(dir).close()
  const w = watch(dir, () => {
    mainWindow.webContents.send('dir-changed', dir)
  })
  watchers.set(dir, w)
})

ipcMain.handle('unwatchDir', async (_, dir) => {
  if (watchers.has(dir)) { watchers.get(dir).close(); watchers.delete(dir) }
})

ipcMain.handle('pickDirectory', async () => {
  const r = await dialog.showOpenDialog(mainWindow, { properties: ['openDirectory'] })
  return r.canceled ? null : r.filePaths[0]
})
```

### Step 6.3 — Preload script

`apps/desktop/preload.js`:

```js
const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('berylDesktop', {
  readFile: (p) => ipcRenderer.invoke('readFile', p),
  writeFile: (p, c) => ipcRenderer.invoke('writeFile', p, c),
  listFiles: (d) => ipcRenderer.invoke('listFiles', d),
  watchDir: (d) => ipcRenderer.invoke('watchDir', d),
  unwatchDir: (d) => ipcRenderer.invoke('unwatchDir', d),
  pickDirectory: () => ipcRenderer.invoke('pickDirectory'),
  onDirChanged: (cb) => ipcRenderer.on('dir-changed', (_, d) => cb(d)),
})
```

### Step 6.4 — Electron FileAdapter

`packages/ui/src/lib/adapters/electron.ts`:

```ts
import type { FileAdapter } from '@beryl/file-adapter'

export function createElectronAdapter(): FileAdapter {
  const api = (window as any).berylDesktop
  return {
    readFile: (p) => api.readFile(p),
    writeFile: (p, c) => api.writeFile(p, c),
    listFiles: (d) => api.listFiles(d),
    watchDir: (dir, cb) => {
      api.watchDir(dir)
      api.onDirChanged((d: string) => { if (d === dir) cb() })
      return Promise.resolve(() => api.unwatchDir(dir))
    },
    pickDirectory: () => api.pickDirectory()
  }
}
```

### Step 6.5 — Checkpoint

```bash
git add -A
git commit -m "phase 6: Electron desktop shell"
```

---

## 9. Migration Phase 7: Capacitor Mobile Shell

**Goal:** The same Svelte UI runs on iOS and Android.

### Step 7.1 — Set up Capacitor

```bash
cd apps/mobile
pnpm init
pnpm add @capacitor/core @capacitor/filesystem
pnpm add -D @capacitor/cli @capacitor/android @capacitor/ios
npx cap init Beryl md.beryl.app --web-dir ../ui/dist
npx cap add android
npx cap add ios
```

### Step 7.2 — iOS: Expose the app sandbox to iCloud Drive

**This is critical.** On iOS, apps are sandboxed. By default, the Beryl folder is invisible to the user and to iCloud. Without this configuration, users cannot sync their files — the data is trapped inside the app.

Add these keys to `apps/mobile/ios/App/App/Info.plist`:

```xml
<!-- Allow the "Beryl" folder to appear in the iOS Files app -->
<key>UIFileSharingEnabled</key>
<true/>

<!-- Allow files to be opened/edited in place (not copied) -->
<key>LSSupportsOpeningDocumentsInPlace</key>
<true/>
```

**What this does:** A "Beryl" folder appears in the user's Files app under "On My iPhone" (or under iCloud Drive if the user has iCloud enabled for the app). The user puts their `.md` files in this folder. iCloud syncs it automatically.

**What this does NOT do:** It does not let the user pick an arbitrary folder on their device. On mobile, the scope is fixed: "We read/write to the Beryl folder. You sync that folder." This is a deliberate mobile limitation. Document it clearly in the app's onboarding.

### Step 7.3 — Android: Scoped Storage considerations

On Android 11+, Scoped Storage restricts apps from accessing arbitrary filesystem locations. The `Directory.Documents` path in Capacitor maps to an app-specific folder.

**Practical sync options for Android users:**
- **Syncthing for Android** — can target the Beryl app folder directly
- **Dropsync / FolderSync** — third-party apps that sync specific folders to Dropbox/Google Drive/OneDrive
- **Manual copy** via the Android Files app

**Do NOT** request `MANAGE_EXTERNAL_STORAGE` permission. Google Play will reject apps that use it without strong justification, and a todo list doesn't qualify.

### Step 7.4 — Capacitor FileAdapter

`packages/ui/src/lib/adapters/capacitor.ts`:

```ts
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem'
import type { FileAdapter } from '@beryl/file-adapter'

export function createCapacitorAdapter(): FileAdapter {
  return {
    readFile: async (p) => {
      const r = await Filesystem.readFile({
        path: p, directory: Directory.Documents, encoding: Encoding.UTF8
      })
      return r.data as string
    },
    writeFile: async (p, c) => {
      await Filesystem.writeFile({
        path: p, data: c, directory: Directory.Documents,
        encoding: Encoding.UTF8, recursive: true
      })
    },
    listFiles: async (d) => {
      const r = await Filesystem.readdir({ path: d, directory: Directory.Documents })
      return r.files.map(f => f.name)
    },
    watchDir: async (_d, cb) => {
      // No native watcher on mobile. Poll every 2 seconds.
      const interval = setInterval(cb, 2000)
      return () => clearInterval(interval)
    },
    pickDirectory: async () => {
      // On mobile, use a fixed subdirectory in Documents.
      // This folder is exposed to the iOS Files app via Info.plist config.
      // On Android, accessible via Scoped Storage-compatible sync tools.
      const dir = 'Beryl'
      try {
        await Filesystem.mkdir({
          path: dir, directory: Directory.Documents, recursive: true
        })
      } catch { /* already exists */ }
      return dir
    }
  }
}
```

### Step 7.5 — Platform detection at app startup

`packages/ui/src/lib/platform.ts`:

```ts
export type Platform = 'electron' | 'capacitor' | 'web'

export function detectPlatform(): Platform {
  if (typeof (window as any).berylDesktop !== 'undefined') return 'electron'
  if (typeof (window as any).Capacitor !== 'undefined') return 'capacitor'
  return 'web'
}
```

`packages/ui/src/main.ts`:

```ts
import { fileAdapter } from './lib/files'
import { detectPlatform } from './lib/platform'
import { createElectronAdapter } from './lib/adapters/electron'
import { createCapacitorAdapter } from './lib/adapters/capacitor'
import App from './App.svelte'

const platform = detectPlatform()

if (platform === 'electron') {
  fileAdapter.set(createElectronAdapter())
} else if (platform === 'capacitor') {
  fileAdapter.set(createCapacitorAdapter())
}

const app = new App({ target: document.getElementById('app')! })
export default app
```

### Step 7.6 — Checkpoint

```bash
git add -A
git commit -m "phase 7: Capacitor mobile shell + platform detection"
```

---

## 10. Migration Phase 8: Verification & Cleanup

**Goal:** Everything works. All dead code is gone. README is updated.

### Step 8.1 — Verify desktop

```bash
pnpm dev   # or: pnpm --filter @beryl/desktop dev
```

Test checklist:
- [ ] Window opens
- [ ] Folder picker dialog appears
- [ ] Tasks from `.md` files are displayed
- [ ] Creating a task writes to disk
- [ ] Editing a task updates the file
- [ ] Completing a task updates the file
- [ ] External edits (e.g. in a text editor) are reflected in the UI
- [ ] Deleting a task updates the file

### Step 8.2 — Verify mobile (if environment available)

```bash
cd apps/mobile
npx cap sync
npx cap open ios    # or: npx cap open android
```

Same checklist as above.

### Step 8.3 — Build release artifacts

```bash
pnpm build                    # desktop (all platforms)
# or specifically:
pnpm --filter @beryl/desktop build:linux
pnpm --filter @beryl/desktop build:mac
pnpm --filter @beryl/desktop build:win
```

Verify the built AppImage / .dmg / .exe launches and works.

### Step 8.4 — Final dead code sweep

Every one of these must return zero results:

```bash
grep -r "pouchdb\|PouchDB" .                         # No PouchDB
grep -r "couchdb\|CouchDB" .                         # No CouchDB
grep -r "ionic\|@ionic\|ion-" --include="*.svelte" .  # No Ionic
grep -r "\.plzconfig\|pleasew" .                      # No Please
grep -r "wails\|Wails" .                              # No Wails
find . -name "*.go" -not -path "./.git/*"             # No Go files
find . -name "go.mod"                                 # No Go modules
find . -name "BUILD" -not -path "./.git/*"            # No Please build files
```

Delete any orphaned directories:
```bash
rm -rf infra/ third_party/ plugins/  # if somehow still present
```

### Step 8.5 — Update README.md

```markdown
# Beryl

> A Markdown To-Do List

Your tasks live in plain markdown files on your hard drive.
Sync them with any cloud service you already use.

Beryl is inspired by [Obsidian](https://obsidian.md),
[todo.txt](https://github.com/todotxt/todo.txt),
and [Todoist](https://todoist.com/).

## Quick Start

**Prerequisites:** Node.js 18+, pnpm

    pnpm install
    pnpm dev

## Downloads

See [Releases](https://codeberg.org/beryl/beryl/releases)
for pre-built desktop and mobile apps.

## Project Structure

    packages/parser        Markdown todo parser/serializer
    packages/file-adapter  FileAdapter interface
    packages/ui            Svelte UI (shared by all platforms)
    apps/desktop           Electron desktop shell
    apps/mobile            Capacitor mobile shell
    site/                  Marketing website

## Sync

Beryl doesn't include sync. Your tasks are `.md` files in a folder.
Sync them with iCloud Drive, Dropbox, Google Drive, Syncthing,
OneDrive, Git, or any other file sync tool.

## Build from Source

    pnpm install
    pnpm build               # desktop app
    pnpm build:mobile         # mobile app
    pnpm test                 # all tests
    pnpm test:parser          # parser tests only

## License

[LICENSE](./LICENSE)
```

### Step 8.6 — Update CI/CD

If Woodpecker CI or any other CI is configured, update to:

```yaml
steps:
  - name: install
    commands:
      - npm install -g pnpm
      - pnpm install
  - name: test
    commands:
      - pnpm test
  - name: build
    commands:
      - pnpm build
```

Remove any steps referencing Please, Go, or CouchDB.

### Step 8.7 — Final checkpoint

```bash
git add -A
git commit -m "phase 8: verification, cleanup, updated README and CI"
```

Merge `migration` into `main`. Tag as `v0.2.0`.

---

## 11. Post-Migration: Feature Roadmap

With the migration complete, these are the features to build **in this order**. Each builds on the previous.

### Milestone 1: Parity (get back to where v0.0.1 was)

- [ ] Workspace creation and switching
- [ ] Project creation (new `.md` file)
- [ ] Task creation with keyboard shortcut (blind entry, Sam's #1 feature)
- [ ] Task completion toggle
- [ ] Task editing (title, tags)
- [ ] Subtask support
- [ ] Task comments
- [ ] Task reordering (drag and drop)
- [ ] Remember last workspace on relaunch

### Milestone 2: Polish

- [ ] Search across all tasks in workspace (see [Search, Sort, Filters & Saved Views](query-layer) design)
- [ ] Built-in views: Today, Upcoming, Completed (same design doc)
- [ ] Saved custom views stored in `.beryl/views.json`
- [ ] Command palette (Cmd/Ctrl+K) for quick-add, search, and view switching
- [ ] Keyboard-driven workflow throughout (up/down/enter/tab/escape)
- [ ] Tag rendering: `due:` shows a formatted date, `p:` shows priority badge
- [ ] Filter/sort tasks by tag (due date, priority, context)
- [ ] Dark mode / light mode (Tailwind + shadcn theme switching)
- [ ] App icon and branding

### Milestone 3: Publish `@beryl/parser` on npm

- [ ] Clean up parser API, write comprehensive docs
- [ ] Add edge case tests (malformed markdown, empty files, huge files)
- [ ] Publish to npm as `@beryl/parser`
- [ ] This lets others build tools (VS Code extension, CLI, etc.)

### Milestone 4: Desktop release

- [ ] Automated builds for Linux (AppImage), macOS (.dmg), Windows (.exe)
- [ ] Auto-update mechanism (electron-updater)
- [ ] Release on Codeberg, update beryl.md download links
- [ ] Tag as `v1.0.0`

### Milestone 5: Mobile release

- [ ] Polish Capacitor build for iOS and Android
- [ ] Test with iCloud Drive sync (iOS) and Google Drive sync (Android)
- [ ] App Store / Play Store submission (or TestFlight / sideload)

### Milestone 6: Parser Rewrite

**When to do this:** After v1.0.0. Before plugins. The current parser works, but it has external dependencies and likely doesn't handle round-trip fidelity (where `serialize(parse(input))` produces byte-identical output to `input`). This matters once users put Beryl files in git and once plugins start transforming tasks.

**The rewrite follows a three-stage pipeline architecture (see [Appendix D](#appendix-d-parser-rewrite-architecture) for the full design):**

1. **Tokenizer** — splits input into classified lines (task, comment, blank, other). Single pass, one line at a time.
2. **Tree Builder** — assembles the flat token list into a nested tree using indentation depth and a stack. Attaches comments to their owning tasks. Preserves non-task content as passthrough nodes.
3. **Tag Extractor** — splits each task body (`"Buy groceries due:2025-03-15 p:2"`) into a clean title and a `Record<string, string>` tags map. Preserves original tag positions and key forms for round-trip fidelity.

**Key properties of the rewrite:**
- Zero external dependencies (pure string processing)
- Round-trip fidelity (`serialize(parse(input)) === input` for unmodified tasks)
- Dirty tracking (only modified tasks are rebuilt on serialize; unchanged tasks emit original bytes)
- Preserves tag shorthand (`p:1` stays `p:1`, not `priority:1`)
- Preserves blank lines, headings, freeform text between tasks
- Never throws on malformed input (degrades gracefully, preserves unrecognized lines)

**Implementation steps:**
- [ ] Write fixture files covering all edge cases (simple, nested, comments, mixed content, malformed)
- [ ] Write round-trip test: `expect(serialize(parse(fixture))).toBe(fixture)` for every fixture
- [ ] Run the round-trip test against the **existing** parser to capture its current behavior and failures
- [ ] Implement the tokenizer. Unit test independently.
- [ ] Implement the tree builder. Unit test independently.
- [ ] Implement the tag extractor. Unit test independently.
- [ ] Implement the serializer with dirty tracking.
- [ ] Pass all round-trip tests.
- [ ] Swap the new parser into `@beryl/parser`, keep the same public API (`parse`, `serialize`, `Task` type)
- [ ] Verify the full app still works (no UI changes needed — the `Task` type is the same)
- [ ] Remove the old parser's external dependencies from `package.json`
- [ ] Publish updated `@beryl/parser` to npm

**The public API does not change.** The UI imports `parse`, `serialize`, and `Task` — those stay identical. Only the internals change. The only visible difference is a new `Document` wrapper:

```ts
// v0.x (current): parse returns Task[] directly
const tasks: Task[] = parse(markdown)
const output: string = serialize(tasks)

// v1.x (after rewrite): parse returns Document, which contains tasks
const doc: Document = parse(markdown)
const tasks: Task[] = doc.tasks      // same Task type
const output: string = serialize(doc) // pass Document, not Task[]
```

This is a minor breaking change to the public API, so it should ship as a major version bump of `@beryl/parser`.

---

- [ ] Automated builds for Linux (AppImage), macOS (.dmg), Windows (.exe)
- [ ] Auto-update mechanism (electron-updater)
- [ ] Release on Codeberg, update beryl.md download links
- [ ] Tag as `v1.0.0`

### Milestone 5: Mobile release

- [ ] Polish Capacitor build for iOS and Android
- [ ] Test with iCloud Drive sync (iOS) and Google Drive sync (Android)
- [ ] App Store / Play Store submission (or TestFlight / sideload)

---

## 12. Future: Plugin System

**When to build this:** After the parser rewrite (Milestone 6). Plugins hook into `onTasksParsed` and `onTasksBeforeSave` — those hooks are much cleaner with the three-stage parser and its `Document` model than with the current parser.

**Architecture summary:**

A plugin is a JS file in `.beryl/plugins/<name>/` that exports an object with optional hook functions:

| Hook | When it runs | What it does |
|---|---|---|
| `onLoad(ctx)` | Plugin loaded | Initialize, set up state |
| `onTasksParsed(tasks, filename)` | After `parse()` | Transform/annotate tasks |
| `onTasksBeforeSave(tasks, filename)` | Before `serialize()` | Modify tasks before write |
| `onTaskChanged(event)` | After UI changes a task | Side effects (notifications, webhooks) |
| `views[]` | Registration | Custom views (kanban, calendar) |
| `commands[]` | Registration | Command palette actions |
| `taskDecorators[]` | Render time | Badges/labels on task items |
| `settings` | Registration | Plugin settings panel |

Plugins receive a `PluginContext` with access to:
- `files` (the FileAdapter)
- `parser` (parse/serialize functions)
- `notify()` (toast notifications)
- `getSetting()` / `setSetting()` (persistent plugin config)
- `rootDir` (workspace path)

**First plugins to build (to validate the API):**
1. **Recurrence** — `recur:daily|weekly|monthly` tag, auto-recreates tasks on completion
2. **Today view** — Custom view showing all tasks due today or overdue
3. **Import from Todoist** — Command palette action, calls Todoist API

**Implementation order:**
1. Define `BerylPlugin` and `PluginContext` types → publish as `@beryl/plugin-types`
2. Build plugin loader (reads `.beryl/plugins/`, dynamic `import()`)
3. Wire data hooks into `data.ts`
4. Wire UI hooks (views → view switcher, commands → command palette)
5. Build the three plugins above
6. Build `create-beryl-plugin` scaffolding CLI
7. Document on beryl.md

**Estimated effort:** ~500–800 lines for the plugin system itself. ~50–100 lines per plugin.

---

## 13. Future: Sync Service

**When to build this:** After plugins. After there are users asking for it.

**Architecture summary:**

Sync is a **decorator FileAdapter** that wraps the platform adapter:

```
UI → SyncAdapter → ElectronAdapter → disk
```

The SyncAdapter:
- Intercepts `writeFile`: writes locally, then pushes to server in background
- Pulls remote changes via WebSocket, writes locally, fires `watchDir` callback
- The UI never knows sync exists — it just sees files changing

**Sync protocol:**
- File-level sync (not task-level). No CRDTs needed.
- Version vectors per file: `{ deviceId: sequenceNumber }`
- Conflict resolution: write remote version as `filename.conflict.md`, show notification

**Server (5 endpoints):**
- `POST /auth/login`
- `GET /files` (list with versions/hashes)
- `GET /files/:path` (download)
- `PUT /files/:path` (upload)
- `WS /changes` (real-time push)

**Technology:** Cloudflare Workers + D1 + R2 (all JS, generous free tier) or self-hosted Go/Node + SQLite.

**Revenue model:**
- App: free, open source
- Hosted sync at `sync.beryl.md`: $5–10/month
- Self-host option: open source Docker image

**Implementation order:**
1. Build sync server (weekend project for 5 endpoints)
2. Write `SyncAdapter` (~200 lines)
3. Add "Sign in to Beryl Sync" settings panel
4. Ship it

---

## Appendix A: Data Flow Reference

### Flow A: User edits a task in the UI

```
1. User clicks checkbox in Svelte component
2. Component calls toggleTask(filename, index) from task-actions.ts
3. task-actions.ts updates Task in taskStore (Svelte store)
4. → Svelte reactivity re-renders UI immediately
5. task-actions.ts calls saveTasks(filename, tasks)
6. saveTasks() sets writeInProgress guard
7. saveTasks() calls serialize(tasks) → markdown string
8. saveTasks() calls fileAdapter.writeFile(path, markdown)
9. [If SyncAdapter active] → writes locally, pushes to server
10. Platform adapter writes to disk
11. fs.watch fires → watcher checks writeInProgress → IGNORES (our own write)
12. After 100ms, writeInProgress guard is released
```

### Flow B: External tool changes a file on disk

```
1. External change (text editor, Dropbox, git pull, sync)
2. fs.watch fires → watcher checks writeInProgress → NOT our write
3. Data layer calls fileAdapter.readFile(path) → raw markdown
4. Computes hash, compares to last known hash
5. If hash matches → IGNORE (spurious fs.watch event)
6. If hash differs → parse(markdown) → Task[]
7. Replace Task[] in taskStore
8. → Svelte reactivity re-renders UI
```

**Key rules:**
- Parsing happens ONLY when reading from disk
- Serialization happens ONLY when writing to disk
- The UI only ever sees `Task` objects, never markdown
- The FileAdapter only ever sees strings, never `Task` objects
- `onTaskChanged` fires for UI-initiated changes only (no diffing needed)
- External changes just reload — no diffing, no side effects

---

## Appendix B: FileAdapter Interface Reference

```ts
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
| Electron | Node `fs.readFile` via IPC | Node `fs.writeFile` via IPC | Node `fs.readdir` via IPC | Node `fs.watch` via IPC | Electron `dialog.showOpenDialog` |
| Capacitor | `Filesystem.readFile` | `Filesystem.writeFile` | `Filesystem.readdir` | 2-second poll interval | Fixed `Documents/Beryl` dir (exposed via `Info.plist` on iOS) |
| SyncAdapter (future) | Delegates to inner | Delegates + pushChange() | Delegates to inner | Delegates + WebSocket | Delegates to inner |

---

## Appendix C: Ionic → shadcn-svelte Component Map

| Ionic | shadcn-svelte | Notes |
|---|---|---|
| `<ion-app>` | (remove) | Not needed |
| `<ion-page>` | (remove) | Just use `<main>` |
| `<ion-content>` | (remove) | Just a styled `<div>` |
| `<ion-header>` + `<ion-toolbar>` | Custom `<header>` with Tailwind | `class="flex items-center h-12 px-4 border-b"` |
| `<ion-title>` | `<h1>` or `<span>` | With Tailwind typography classes |
| `<ion-list>` | `<ul>` or shadcn `Card` | |
| `<ion-item>` | `<li>` or custom row | |
| `<ion-checkbox>` | `<Checkbox>` | `bind:checked` just works |
| `<ion-input>` | `<Input>` | `bind:value` just works |
| `<ion-textarea>` | `<Textarea>` | `bind:value` just works |
| `<ion-button>` | `<Button>` | Variants: `default`, `outline`, `ghost`, `destructive` |
| `<ion-modal>` | `<Dialog.Root>` | No controller needed, just `bind:open` |
| `<ion-popover>` | `<Popover.Root>` | |
| `<ion-action-sheet>` | `<DropdownMenu.Root>` | |
| `<ion-toast>` | `<Toast>` / Sonner | |
| `<ion-tabs>` | `<Tabs.Root>` | No flickering |
| `<ion-menu>` | `<Sidebar>` | shadcn sidebar component |
| `<ion-searchbar>` | `<Command>` | Command palette with filtering |
| `<ion-fab>` | Positioned `<Button>` | `class="fixed bottom-6 right-6"` |
| `<ion-reorder-group>` | `svelte-dnd-action` | Separate small library |
| `<ion-icon>` | `lucide-svelte` | `import { Plus } from 'lucide-svelte'` |
| `<ion-toggle>` | `<Switch>` | |
| `<ion-select>` | `<Select.Root>` | |
| `<ion-badge>` | `<Badge>` | |
| `<ion-spinner>` | `<Loader2>` from lucide | `class="animate-spin"` |
| `<ion-segment>` | `<Tabs.Root>` | Styled as segmented control |
| `<ion-skeleton-text>` | `<Skeleton>` | shadcn skeleton component |
| `setupIonicSvelte()` | (delete) | No setup needed |
| `variables.css` (Ionic theme) | Tailwind config + shadcn theme | CSS variables in `app.css` |

---

## Appendix D: Parser Rewrite Architecture

This appendix describes the internal architecture for the parser rewrite (Milestone 6). **This is not implemented during the migration.** It is reference material for when the rewrite begins.

### The format (as spec)

```markdown
# Section Heading (optional, preserved but not parsed as tasks)

Some freeform text (preserved but not parsed)

- [ ] Buy groceries due:2025-03-15 p:2 context:errands
	**Need to go to Trader Joe's specifically**
	Also pick up dog food
	- [ ] Milk
	- [ ] Eggs
	- [x] Bread
- [x] Fix the kitchen sink f:2025-03-10
- [ ] Plan vacation due:2025-06-01
	- [ ] Book flights p:1
		Look at Southwest and Alaska
		- [ ] Compare prices
	- [ ] Reserve hotel
```

**Rules:**

1. A task line: optional leading tabs + `- [ ] ` or `- [x] ` + body
2. Body contains title + optional `key:value` tags (no space around `:`)
3. Tag shorthand: `p:` = `priority:`, `c:` = `context:`, `d:` = `due:`, `s:` = `start:`, `f:` = `finish:`
4. Comment lines: non-task lines indented one level deeper than the preceding task
5. Subtasks: task lines indented one level deeper than parent
6. Indentation: one tab character per level (canonical)
7. Non-task root content (headings, blank lines, freeform text): preserved verbatim

### Hard constraint: round-trip fidelity

`serialize(parse(input))` must produce **byte-identical** output to `input` for any well-formed file. This is non-negotiable because Beryl writes back to user files on disk.

### Three-stage pipeline

```
raw markdown → [Tokenizer] → Token[] → [Tree Builder] → Node[] → [Tag Extractor] → Node[] (with tags)
                                                                                          ↓
                                                                            Document { nodes, tasks }

Document → [Serializer] → markdown string
```

### Stage 1: Tokenizer (`tokenizer.ts`)

Splits input into lines, classifies each one:

```ts
type Token =
  | { type: 'task'; indent: number; completed: boolean; body: string; raw: string }
  | { type: 'comment'; indent: number; content: string; raw: string }
  | { type: 'blank'; raw: string }
  | { type: 'other'; raw: string }
```

Every token carries `raw` — the original line verbatim. This enables round-trip fidelity.

Single pass, one line at a time. No backtracking.

### Stage 2: Tree Builder (`tree-builder.ts`)

Assembles tokens into a tree using indentation depth and a stack:

```ts
interface TaskNode {
  type: 'task'
  indent: number
  completed: boolean
  body: string
  raw: string
  comments: string[]
  commentRaws: string[]
  children: TaskNode[]
  dirty: boolean          // set true when UI modifies this task
}

interface PassthroughNode {
  type: 'passthrough'
  raw: string             // headings, blank lines, freeform text — preserved verbatim
}

type Node = TaskNode | PassthroughNode
```

**Key rules:**
- Blank lines between tasks do NOT reset nesting (subtasks survive blank lines)
- Headings and freeform text DO reset nesting (start a new section)
- Orphan comments (indented lines with no preceding task) become passthrough nodes

### Stage 3: Tag Extractor (`tag-extractor.ts`)

Splits each task body into title + tags:

```
"Buy groceries due:2025-03-15 p:2" → title: "Buy groceries", tags: { due: "2025-03-15", priority: "2" }
```

Stores `tagSpans` — the exact position and original text of each tag in the body — so the serializer can reconstruct lines using the original key forms (`p:1` not `priority:1`).

Blocklists `http`, `https`, `ftp`, `mailto` to avoid parsing URLs as tags.

### Serializer (`serialize.ts`)

Walks the node tree:
- **Unchanged nodes** (`dirty === false`): emit `raw` verbatim (perfect round-trip)
- **Modified nodes** (`dirty === true`): rebuild the line from structured data, preserving original tag key forms and appending any new tags at the end

### Public API change

```ts
// Before (current parser):
const tasks: Task[] = parse(markdown)
const output: string = serialize(tasks)

// After (rewritten parser):
const doc: Document = parse(markdown)
const tasks: Task[] = doc.tasks       // same Task type as before
const output: string = serialize(doc)  // pass Document, not Task[]

interface Document {
  nodes: Node[]    // internal tree (for serializer)
  tasks: Task[]    // flat task list (for UI) — views into the node tree
}
```

`Task` objects are getter/setter proxies into the underlying `TaskNode`. When the UI mutates a task (e.g. `task.completed = true`), the underlying node's `dirty` flag is set automatically.

### File structure

```
packages/parser/
├── src/
│   ├── index.ts          Public API: parse, serialize, Task, Document
│   ├── types.ts          All type definitions
│   ├── tokenizer.ts      Stage 1: string → Token[]
│   ├── tree-builder.ts   Stage 2: Token[] → Node[]
│   ├── tag-extractor.ts  Stage 3: extract tags, populate title + tags
│   ├── parse.ts          Orchestrator: stages 1→2→3 → Document
│   └── serialize.ts      Node[] → string (with dirty tracking)
├── test/
│   ├── tokenizer.test.ts
│   ├── tree-builder.test.ts
│   ├── tag-extractor.test.ts
│   ├── parse.test.ts
│   ├── serialize.test.ts
│   ├── roundtrip.test.ts     ← THE critical test
│   └── fixtures/
│       ├── simple.md
│       ├── nested.md
│       ├── comments.md
│       ├── mixed-content.md
│       ├── edge-cases.md
│       └── malformed.md
└── package.json
```

### Edge cases

| Edge case | Behavior |
|---|---|
| Empty file | Empty task list. Serializes to empty string. |
| Only headings/text | No tasks. All content preserved as passthrough. |
| Task with no title (`- [ ] `) | Valid task, empty title. |
| Task with only tags (`- [ ] p:1 due:tomorrow`) | Empty title, tags extracted. |
| Duplicate tags (`p:1 p:2`) | Last value wins. |
| Tag-like URL (`http://example.com`) | Not parsed as tag (blocklisted prefix). |
| Windows line endings (`\r\n`) | Normalize to `\n` on parse. |
| No trailing newline | Preserve exactly. |
| Comments between subtasks | Attached to the preceding subtask. |
| 100+ nesting levels | Works. No recursion in tokenizer. Stack in tree builder handles it. |
| Malformed checkbox (`- [] task`) | Treated as `other`, preserved verbatim. |

### Implementation order for Milestone 6

1. Write fixture files first
2. Write round-trip test against **existing** parser (captures current behavior and failures)
3. Implement tokenizer + tests
4. Implement tree builder + tests
5. Implement tag extractor + tests
6. Implement serializer with dirty tracking + tests
7. Pass all round-trip tests
8. Swap into `@beryl/parser`, verify full app still works
9. Remove old parser's external dependencies
10. Publish as major version bump

---

## Checklist: Migration Phases

- [ ] **Phase 1:** Remove dead code, set up pnpm workspaces
- [ ] **Phase 2:** Extract parser → `@beryl/parser`, all tests passing
- [ ] **Phase 3:** Define FileAdapter interface → `@beryl/file-adapter`
- [ ] **Phase 4:** Replace Ionic with shadcn-svelte (zero Ionic references remaining)
- [ ] **Phase 5:** Replace PouchDB with FileAdapter data layer (zero PouchDB references remaining)
- [ ] **Phase 6:** Electron desktop shell working
- [ ] **Phase 7:** Capacitor mobile shell working, platform detection wired up
- [ ] **Phase 8:** Verification, cleanup, README, CI — merge to main, tag v0.2.0

## Checklist: Post-Migration Roadmap

- [ ] **Milestone 1:** Feature parity with v0.0.1
- [ ] **Milestone 2:** Polish (command palette, keyboard nav, filters, dark mode)
- [ ] **Milestone 3:** Publish `@beryl/parser` on npm (current parser, cleaned up)
- [ ] **Milestone 4:** Desktop release → v1.0.0
- [ ] **Milestone 5:** Mobile release
- [ ] **Milestone 6:** Parser rewrite (zero deps, round-trip fidelity, Document model)
- [ ] **Future:** Plugin system (depends on Milestone 6)
- [ ] **Future:** Sync service

**Do these in order. Do not skip ahead.**
