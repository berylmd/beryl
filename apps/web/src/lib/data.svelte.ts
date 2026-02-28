import { parseProject } from '@repo/beryljs'
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

import type { LabelText } from '@repo/beryljs'

function parsePriority(labels: LabelText[]): Priority {
  const p = labels.find((l) => l.labels.label === 'p')
  if (p?.labels.text === 'high') return 'high'
  if (p?.labels.text === 'low')  return 'low'
  return 'medium'
}

function parseDueDate(labels: LabelText[]): string | null {
  const d = labels.find((l) => l.labels.label === 'due')
  return d ? d.labels.text : null
}

function fileNameToListId(filename: string): string {
  return filename.replace(/\.md$/i, '')
}

function serializeTodo(todo: Todo): string {
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

function serializeTodos(todos: Todo[]): string {
  if (todos.length === 0) return ''
  return todos.map(serializeTodo).join('\n') + '\n'
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

  // ── Save timers ───────────────────────────────────────────────────────────

  const saveTimers = new Map<string, ReturnType<typeof setTimeout>>()

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
    try {
      await adapter.writeFile(path, content)
    } catch (e) {
      console.error(`[beryl] Failed to save ${listId}:`, e)
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
      priority:  'medium',
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