import { parseProject } from '@repo/beryljs'
import type { LabelText } from '@repo/beryljs'
import type { Todo } from './types.js'

export function stripLabels(description: string): string {
  return description
    .replace(/\b(p|due):\S+/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

export function normalizeComments(comments: unknown): string {
  if (!comments) return ''
  if (Array.isArray(comments)) return (comments as string[]).join('\n')
  return String(comments)
}

export function parseDueDate(labels: LabelText[]): string | null {
  const d = labels.find((l) => l.labels.label === 'due')
  return d ? d.labels.text : null
}

export function fileNameToListId(filename: string): string {
  return filename.replace(/\.md$/i, '')
}

export function serializeTodo(todo: Todo): string {
  let line = todo.completed ? '- [x]' : '- [ ]'
  line += ` ${todo.title}`
  if (todo.dueDate) line += ` due:${todo.dueDate}`
  if (todo.notes) {
    for (const noteLine of todo.notes.split('\n')) {
      line += `\n\t>${noteLine}`
    }
  }
  return line
}

export function serializeTodos(todos: Todo[]): string {
  if (todos.length === 0) return ''
  return todos.map(serializeTodo).join('\n') + '\n'
}

export function parseFile(content: string, listId: string): Todo[] {
  let tasks: ReturnType<typeof parseProject>
  try {
    tasks = parseProject(content)
  } catch {
    return []
  }

  return tasks
    .filter((t) => t.indent === 0)
    .map((t) => ({
      id:        crypto.randomUUID(),
      title:     stripLabels(t.description),
      completed: t.checked,
      dueDate:   parseDueDate(t.labels ?? []),
      listId,
      createdAt: new Date().toISOString(),
      notes:     normalizeComments(t.comments),
    }))
}
