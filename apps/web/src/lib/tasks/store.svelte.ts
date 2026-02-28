import type { Todo, List } from './types.js'
import {
  fileNameToListId,
  parseFile,
  serializeTodos,
} from './serializer.js'
import { workspace } from '$lib/workspace/store.svelte.js'   // ← updated in Phase 2

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

  let unwatchWorkspace: (() => void) | null = null
  let loadInProgress = false  // plain var, not $state — must not be read in $effect call chains

  async function loadWorkspace() {
    const adapter = workspace.fileAdapter
    const rootDir = workspace.rootDir
    if (!adapter || !rootDir) return

    if (loadInProgress) return  // prevent concurrent loads

    // Tear down previous watcher before re-loading
    if (unwatchWorkspace) {
      unwatchWorkspace()
      unwatchWorkspace = null
    }

    loadInProgress = true
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

      // Watch for external changes (e.g. sync, external editor)
      unwatchWorkspace = await adapter.watchDir(rootDir, () => {
        // Skip if we're currently saving (avoid reloading our own writes)
        if (saveTimers.size === 0 && activeSaves === 0 && !loadInProgress) {
          void loadWorkspace()
        }
      })
    } catch (e) {
      loadError = String(e)
    } finally {
      loadInProgress = false
      isLoading = false
    }
  }

  // ── Save timers ───────────────────────────────────────────────────────────

  const saveTimers = new Map<string, ReturnType<typeof setTimeout>>()
  let activeSaves = 0

  function scheduleSave(listId: string) {
    const existing = saveTimers.get(listId)
    if (existing !== undefined) clearTimeout(existing)
    saveTimers.set(listId, setTimeout(() => {
      saveTimers.delete(listId)
      void flushSave(listId)
    }, 300))
  }

  async function flushSave(listId: string) {
    const adapter = workspace.fileAdapter
    const rootDir = workspace.rootDir
    if (!adapter || !rootDir) return
    const listTodos = todos.filter((t) => t.listId === listId)
    const content   = serializeTodos(listTodos)
    const path      = `${rootDir}/${listId}.md`
    activeSaves++
    try {
      await adapter.writeFile(path, content)
    } catch (e) {
      console.error(`[beryl] Failed to save ${listId}:`, e)
    } finally {
      activeSaves--
    }
  }

  // ── Mutations ─────────────────────────────────────────────────────────────

  function setActiveList(id: string | null) {
    activeListId = id
  }

  function toggleTodo(id: string) {
    const todo = todos.find((t) => t.id === id)
    if (todo) {
      todo.completed = !todo.completed
      scheduleSave(todo.listId)
    }
  }

  function addTodo(partial: Pick<Todo, 'title' | 'listId'>) {
    todos.push({
      id:        crypto.randomUUID(),
      title:     partial.title,
      completed: false,
      dueDate:   null,
      listId:    partial.listId,
      createdAt: new Date().toISOString(),
      notes:     '',
    })
    scheduleSave(partial.listId)
  }

  function updateTodo(id: string, changes: Partial<Todo>) {
    const todo = todos.find((t) => t.id === id)
    if (todo) {
      const oldListId = todo.listId
      Object.assign(todo, changes)
      scheduleSave(oldListId)
      // If the listId itself changed (moving a task between lists), save both
      if (changes.listId && changes.listId !== oldListId) {
        scheduleSave(changes.listId)
      }
    }
  }

  function deleteTodo(id: string) {
    const todo = todos.find((t) => t.id === id)
    if (todo) {
      scheduleSave(todo.listId)
      todos = todos.filter((t) => t.id !== id)
    }
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
