import type { Todo, List } from './types.js'

function createDataStore() {
  let todos        = $state<Todo[]>([])
  let lists        = $state<List[]>([])
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

  // ── Sync bridge ──────────────────────────────────────────────────────────────
  // workspaceSync registers a callback here so mutations can schedule saves
  // without the store knowing about adapters or file I/O.

  let saveCallback: ((listId: string) => void) | null = null

  function setSaveCallback(fn: (listId: string) => void) {
    saveCallback = fn
  }

  function hydrate(newLists: List[], newTodos: Todo[]) {
    lists = newLists
    todos = newTodos
    if (!activeListId && newLists.length > 0) {
      activeListId = newLists[0].id
    }
  }

  function setLoading(v: boolean) { isLoading = v }
  function setLoadError(e: string | null) { loadError = e }

  // ── Mutations ─────────────────────────────────────────────────────────────

  function setActiveList(id: string | null) {
    activeListId = id
  }

  function toggleTodo(id: string) {
    const todo = todos.find((t) => t.id === id)
    if (todo) {
      todo.completed = !todo.completed
      saveCallback?.(todo.listId)
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
    saveCallback?.(partial.listId)
  }

  function updateTodo(id: string, changes: Partial<Todo>) {
    const todo = todos.find((t) => t.id === id)
    if (todo) {
      const oldListId = todo.listId
      Object.assign(todo, changes)
      saveCallback?.(oldListId)
      if (changes.listId && changes.listId !== oldListId) {
        saveCallback?.(changes.listId)
      }
    }
  }

  function deleteTodo(id: string) {
    const todo = todos.find((t) => t.id === id)
    if (todo) {
      saveCallback?.(todo.listId)
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
    setSaveCallback,
    hydrate,
    setLoading,
    setLoadError,
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
