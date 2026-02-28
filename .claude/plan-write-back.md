# Task: Markdown Serializer + scheduleSave

## Goal

Add file write-back to `apps/web/src/lib/data.svelte.ts`. After this task, every mutation (toggle, add, update, delete) automatically saves the affected `.md` file to disk within 300ms.

**Do not create any new files. All changes are in `apps/web/src/lib/data.svelte.ts` only.**

---

## File to edit

`apps/web/src/lib/data.svelte.ts`

Read this file first. It currently has a comment on line 137:

```
// ── Mutations (in-memory only — no file writes yet) ───────────────────────
```

That comment and all the functions below it are what you're completing.

---

## Step 1: Add the serializer helper function

Add the following two functions in the `// ── Helpers ─────` section, after the existing `fileNameToListId` function (after line 36) and before `parseFile` (before line 38).

```typescript
function serializeTodo(todo: Todo): string {
  let line = todo.completed ? '- [x]' : '- [ ]';
  line += ` ${todo.title}`;
  if (todo.priority === 'high') line += ' p:high';
  if (todo.priority === 'low') line += ' p:low';
  if (todo.dueDate) line += ` due:${todo.dueDate}`;
  if (todo.notes) {
    for (const noteLine of todo.notes.split('\n')) {
      line += `\n\t>${noteLine}`;
    }
  }
  return line;
}

function serializeTodos(todos: Todo[]): string {
  if (todos.length === 0) return '';
  return todos.map(serializeTodo).join('\n') + '\n';
}
```

**Rules the serializer follows:**

- `priority === 'medium'` → emit nothing (medium is the default, not written to file)
- `priority === 'high'` → append ` p:high` to the title line
- `priority === 'low'` → append ` p:low` to the title line
- `dueDate` is appended as ` due:YYYY-MM-DD` after priority (if present)
- `notes` is written as one `\t>line` per newline in the notes string
- Empty notes string → emit nothing
- The file ends with a single trailing newline
- Tasks are separated by a single newline (no blank lines between them)

---

## Step 2: Add scheduleSave inside createDataStore

Add the following block inside the `createDataStore` function, immediately after the `loadWorkspace` function (after line 135, before the mutation comment on line 137).

```typescript
// ── Save timers ───────────────────────────────────────────────────────────

const saveTimers = new Map<string, ReturnType<typeof setTimeout>>();

function scheduleSave(listId: string) {
  const existing = saveTimers.get(listId);
  if (existing !== undefined) clearTimeout(existing);
  saveTimers.set(
    listId,
    setTimeout(() => {
      saveTimers.delete(listId);
      void flushSave(listId);
    }, 300)
  );
}

async function flushSave(listId: string) {
  const adapter = workspace.fileAdapter;
  const rootDir = workspace.rootDir;
  if (!adapter || !rootDir) return;
  const listTodos = todos.filter((t) => t.listId === listId);
  const content = serializeTodos(listTodos);
  const path = `${rootDir}/${listId}.md`;
  try {
    await adapter.writeFile(path, content);
  } catch (e) {
    console.error(`[beryl] Failed to save ${listId}:`, e);
  }
}
```

**Notes:**

- `saveTimers` is a plain `Map`, not `$state` — it doesn't need to be reactive.
- Each listId gets its own independent debounce timer.
- `void flushSave(...)` silences the floating-promise lint warning.
- If `adapter` or `rootDir` are null (workspace not set up), the save is silently skipped.

---

## Step 3: Wire scheduleSave into every mutation

Replace the four mutation functions as follows. The only additions are `scheduleSave(...)` calls — the core logic is unchanged.

### toggleTodo

```typescript
function toggleTodo(id: string) {
  const todo = todos.find((t) => t.id === id);
  if (todo) {
    todo.completed = !todo.completed;
    scheduleSave(todo.listId);
  }
}
```

### addTodo

```typescript
function addTodo(partial: Pick<Todo, 'title' | 'listId'>) {
  todos.push({
    id: crypto.randomUUID(),
    title: partial.title,
    completed: false,
    priority: 'medium',
    dueDate: null,
    listId: partial.listId,
    createdAt: new Date().toISOString(),
    notes: '',
  });
  scheduleSave(partial.listId);
}
```

### updateTodo

```typescript
function updateTodo(id: string, changes: Partial<Todo>) {
  const todo = todos.find((t) => t.id === id);
  if (todo) {
    const oldListId = todo.listId;
    Object.assign(todo, changes);
    scheduleSave(oldListId);
    // If the listId itself changed (moving a task between lists), save both
    if (changes.listId && changes.listId !== oldListId) {
      scheduleSave(changes.listId);
    }
  }
}
```

### deleteTodo

```typescript
function deleteTodo(id: string) {
  const todo = todos.find((t) => t.id === id);
  if (todo) {
    scheduleSave(todo.listId);
    todos = todos.filter((t) => t.id !== id);
  }
}
```

**Important for deleteTodo:** capture the `listId` before filtering the todo out of the array, then call `scheduleSave`. Order matters — `scheduleSave` reads `todos` 300ms later, by which time the deleted todo is already gone, so the file will correctly omit it.

### Do NOT change addList or deleteList

Leave `addList` and `deleteList` exactly as they are. File creation/deletion is a separate task.

### Update the section comment

Change line 137 from:

```typescript
// ── Mutations (in-memory only — no file writes yet) ───────────────────────
```

to:

```typescript
// ── Mutations ─────────────────────────────────────────────────────────────
```

---

## Step 4: Verify the result

The final file should:

1. Have `serializeTodo` and `serializeTodos` as module-level helper functions in the helpers section
2. Have `saveTimers`, `scheduleSave`, and `flushSave` inside `createDataStore`, between `loadWorkspace` and the mutation functions
3. Have all four mutations (`toggleTodo`, `addTodo`, `updateTodo`, `deleteTodo`) calling `scheduleSave`
4. Have `addList` and `deleteList` unchanged
5. Export the same `dataStore` object with the same public API — no new properties are exposed

**No other files need to be touched.**

---

## How to manually verify

1. Run the Electron app in dev mode: `pnpm --filter @beryl/desktop dev`
2. Pick a folder with at least one `.md` task file
3. Toggle a task's checkbox
4. Wait ~400ms
5. Open the `.md` file in a text editor — the `[ ]` / `[x]` should reflect the change
6. Add a new task via the quick-add form
7. Wait ~400ms
8. The new task should appear at the bottom of the `.md` file
