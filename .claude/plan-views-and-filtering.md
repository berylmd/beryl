# Plan: Views + Persistent Index + Filter Engine

## What This Is

A redesign of the data/filtering layer to support:

- User-defined saved filters ("Views") stored as `.berylview` files
- A composable filter expression language
- A persistent task index so global views (e.g. `due:today` across 1000 files) are instant
- Nested folder support in the file tree

---

## New Concepts

### View

A saved filter. Lives as a `.berylview` file in the workspace — syncs with the rest of the workspace via iCloud/Dropbox/etc. just like lists.

```
# urgent.berylview
priority:high AND due:<today
```

### Filter expression

A simple, readable expression language evaluated against individual `Todo` objects.

---

## Filter Expression Language

```
expr     = term (('AND' | 'OR') term)*
term     = 'NOT'? atom
atom     = property ':' value  |  '(' expr ')'
```

**Properties and values:**

| Property    | Example values                                             |
| ----------- | ---------------------------------------------------------- |
| `priority`  | `high`, `medium`, `low`                                    |
| `due`       | `today`, `overdue`, `tomorrow`, `<+7d`, `>+30d`            |
| `completed` | `true`, `false`                                            |
| `folder`    | `work`, `work/projects` (matches list's containing folder) |
| `list`      | `alpha`, `work/alpha` (matches list ID)                    |
| `tag`       | any label, e.g. `tag:review`                               |

**Examples:**

```
priority:high
priority:high AND due:<today
(priority:high OR priority:medium) AND folder:work
NOT completed AND due:overdue
list:work AND NOT completed
(tag:review OR tag:waiting) AND NOT completed
```

---

## New Package: `packages/filter-engine`

Package name: `@repo/filter-engine`

Pure TypeScript, no dependencies. Two exports:

```typescript
// Parse and compile a filter expression string into a predicate function
export function compileFilter(expression: string): (todo: Todo) => boolean;

// Validate an expression string — returns null if valid, error message if not
export function validateFilter(expression: string): string | null;
```

Internal structure:

```
packages/filter-engine/
├── src/
│   ├── index.ts        — public API (compileFilter, validateFilter)
│   ├── tokenize.ts     — split expression into tokens
│   ├── parse.ts        — tokens → AST
│   ├── evaluate.ts     — AST + Todo → boolean
│   └── values.ts       — date helpers (today, overdue, +7d, etc.)
├── test/
│   └── filter.test.ts
└── package.json        — { name: "@repo/filter-engine" }
```

`compileFilter` returns a predicate — parse once, call many times:

```typescript
const pred = compileFilter('priority:high AND due:<today');
const results = allTodos.filter(pred);
```

---

## `.berylview` File Format

- Extension: `.berylview`
- Content: a single filter expression (the whole file is the filter)
- Can live anywhere in the workspace folder tree
- File name (without extension) = view display name

```
# /workspace/urgent.berylview
priority:high AND due:<today
```

```
# /workspace/work/this-week.berylview
NOT completed AND due:<+7d AND folder:work
```

---

## Workspace Tree Model

Replace the flat `List[]` with a recursive tree:

```typescript
// In types.ts (or a new workspace-types.ts)
type WorkspaceNode =
  | { type: 'list'; id: string; name: string; path: string }
  | { type: 'view'; id: string; name: string; path: string; filter: string }
  | { type: 'folder'; id: string; name: string; path: string; children: WorkspaceNode[] };
```

`id` is always the relative path without extension, e.g.:

- `work/alpha` for `work/alpha.md`
- `urgent` for `urgent.berylview`
- `work` for the `work/` folder

---

## Index Architecture

Global views (e.g. `due:today`) must query across all files. There is no way to avoid having all task metadata available — the only question is whether it comes from parsing files at runtime or from a cache. The answer is a persistent index.

### Index file: `.beryl/index.json`

Lives in a `.beryl/` directory at the workspace root. Should be added to `.gitignore` by convention (it's a cache, not source data). Users don't interact with it directly.

```json
{
  "version": 1,
  "entries": {
    "work/alpha.md": {
      "mtime": 1709000000,
      "todos": [
        {
          "title": "Ship it",
          "priority": "high",
          "due": "2026-03-01",
          "completed": false,
          "notes": "",
          "listId": "work/alpha"
        }
      ]
    },
    "urgent.berylview": {
      "mtime": 1709000001,
      "filter": "priority:high AND due:<today"
    }
  }
}
```

At 1000 files × ~20 tasks × ~150 bytes metadata ≈ 3MB. Reading one 3MB JSON file is vastly faster than parsing 1000 markdown files on every launch.

### Startup sequence

```
1. Recursively walk directory tree (fast — just paths + mtimes)
2. Build WorkspaceNode tree → render sidebar immediately
3. Read .beryl/index.json (if exists)
4. For each .md file in the walk:
   a. If path is in index AND mtime matches → use cached todos
   b. If missing or mtime changed → parse file, update index entry
5. Write updated .beryl/index.json (only if anything changed)
6. All task metadata now in memory — global views are instant
```

### In-memory representation

The index is mirrored in memory as:

```typescript
// In data.svelte.ts
let index = $state<Map<string, { mtime: number; todos: Todo[] }>>();
```

All views filter against this flat map. For a global `due:today` view:

```typescript
const pred = compileFilter('due:today AND NOT completed');
const results = [...index.values()].flatMap((e) => e.todos).filter(pred);
```

### File watcher integration

When a `.md` file changes:

1. Re-parse that file
2. Update its entry in the in-memory index
3. Debounce write of `.beryl/index.json` to disk (500ms)
4. Re-evaluate the active view

When a `.berylview` file changes:

1. Read new filter expression
2. Update the `WorkspaceNode` in the tree
3. Re-evaluate the active view if it's the changed view

### Index integrity

On startup, any file in the walk that's missing from the index (new file) or has a different mtime (modified externally) gets re-parsed. The index can never be stale for files that exist — worst case is a missing entry that gets rebuilt. If `.beryl/index.json` is deleted, the app rebuilds it from scratch on next open.

### FileAdapter changes needed

Add `readIndex` / `writeIndex` convenience methods, or just use `readFile` / `writeFile` on `.beryl/index.json`. The latter requires no FileAdapter changes.

Add `walkDir` for recursive directory traversal:

```typescript
// Added to FileAdapter interface
walkDir(dir: string): Promise<WalkEntry[]>

interface WalkEntry {
  relativePath: string   // e.g. "work/alpha.md"
  absolutePath: string
  isDir: boolean
  mtime: number          // unix timestamp ms
}
```

---

## Changes Required

### New

- `packages/filter-engine/` — filter expression compiler/evaluator
- `.beryl/index.json` — persistent task index written to workspace root
- `.berylview` recognized as a new file type in workspace walker

### Modified

**`packages/file-adapter/src/index.ts`**

- Add `walkDir(dir: string): Promise<WalkEntry[]>` (recursive, returns `{ absolutePath, relativePath, isDir, mtime }`)

**`apps/web/src/lib/types.ts`**

- Add `WorkspaceNode` type
- Keep `Todo`, `List`, `Priority` as-is

**`apps/web/src/lib/workspace.svelte.ts`**

- Replace flat `List[]` with `WorkspaceNode[]` tree
- Add `walkWorkspace()` that builds the tree
- Remove eager `loadWorkspace()` call on init

**`apps/web/src/lib/data.svelte.ts`**

- Add in-memory index: `Map<relativePath, { mtime: number; todos: Todo[] }>`
- Add `activeView` state (can be a list node or a view node)
- Replace `filteredTodos` derived with a derived that applies the active view's filter predicate against the full index
- Keep all mutation functions (toggleTodo, addTodo, etc.) — they update the index in-memory and eventually write to files + update `.beryl/index.json`

**`apps/web/src/lib/components/layout/AppSidebar.svelte`**

- Render `WorkspaceNode` tree recursively
- Folder = collapsible group
- Views section alongside/below Lists section

---

## What Stays the Same

- `Todo` type — unchanged
- `FileAdapter` interface — unchanged (only adds `walkDir`)
- `.md` file format — unchanged
- `beryljs` parser — unchanged
- Electron IPC / Capacitor / Test adapter structure — unchanged

---

## What's Out of Scope (for now)

- Full-text search across task titles
- View editor UI (user edits `.berylview` files in their text editor; app just reads them)
- Subtasks in the UI
