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