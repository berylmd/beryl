import { describe, it, expect, beforeEach } from 'vitest';
import { dataStore } from './store.svelte.js';

// Reset store state before each test by hydrating with empty data
beforeEach(() => {
  dataStore.hydrate([], []);
});

// ── hydrate ───────────────────────────────────────────────────────────────────

describe('hydrate', () => {
  it('populates lists and todos', () => {
    dataStore.hydrate(
      [{ id: 'inbox', name: 'Inbox', color: '#6366f1' }],
      [
        {
          id: 't1',
          title: 'Buy milk',
          completed: false,
          dueDate: null,
          listId: 'inbox',
          createdAt: '',
          notes: '',
        },
      ]
    );
    expect(dataStore.lists).toHaveLength(1);
    expect(dataStore.todos).toHaveLength(1);
  });

  it('sets activeListId to the first list when none is active', () => {
    dataStore.hydrate([{ id: 'inbox', name: 'Inbox', color: '#6366f1' }], []);
    expect(dataStore.activeListId).toBe('inbox');
  });

  it('does not change activeListId if one is already set', () => {
    dataStore.hydrate([{ id: 'inbox', name: 'Inbox', color: '#6366f1' }], []);
    dataStore.hydrate([{ id: 'work', name: 'Work', color: '#6366f1' }], []);
    // activeListId stays 'inbox' from first hydrate
    expect(dataStore.activeListId).toBe('inbox');
  });
});

// ── addTodo ───────────────────────────────────────────────────────────────────

describe('addTodo', () => {
  beforeEach(() => {
    dataStore.hydrate([{ id: 'inbox', name: 'Inbox', color: '#6366f1' }], []);
  });

  it('appends a new todo to the list', () => {
    dataStore.addTodo({ title: 'Buy milk', listId: 'inbox' });
    expect(dataStore.todos).toHaveLength(1);
    expect(dataStore.todos[0].title).toBe('Buy milk');
  });

  it('creates the todo as unchecked', () => {
    dataStore.addTodo({ title: 'Task', listId: 'inbox' });
    expect(dataStore.todos[0].completed).toBe(false);
  });

  it('creates the todo with null dueDate and empty notes', () => {
    dataStore.addTodo({ title: 'Task', listId: 'inbox' });
    expect(dataStore.todos[0].dueDate).toBeNull();
    expect(dataStore.todos[0].notes).toBe('');
  });

  it('assigns the given listId', () => {
    dataStore.addTodo({ title: 'Task', listId: 'inbox' });
    expect(dataStore.todos[0].listId).toBe('inbox');
  });

  it('generates a unique id for each todo', () => {
    dataStore.addTodo({ title: 'A', listId: 'inbox' });
    dataStore.addTodo({ title: 'B', listId: 'inbox' });
    const [a, b] = dataStore.todos;
    expect(a.id).not.toBe(b.id);
  });
});

// ── toggleTodo ────────────────────────────────────────────────────────────────

describe('toggleTodo', () => {
  beforeEach(() => {
    dataStore.hydrate(
      [{ id: 'inbox', name: 'Inbox', color: '#6366f1' }],
      [
        {
          id: 't1',
          title: 'Task',
          completed: false,
          dueDate: null,
          listId: 'inbox',
          createdAt: '',
          notes: '',
        },
      ]
    );
  });

  it('marks an unchecked todo as completed', () => {
    dataStore.toggleTodo('t1');
    expect(dataStore.todos[0].completed).toBe(true);
  });

  it('marks a completed todo as unchecked', () => {
    dataStore.toggleTodo('t1');
    dataStore.toggleTodo('t1');
    expect(dataStore.todos[0].completed).toBe(false);
  });

  it('does nothing for an unknown id', () => {
    dataStore.toggleTodo('no-such-id');
    expect(dataStore.todos[0].completed).toBe(false);
  });
});

// ── updateTodo ────────────────────────────────────────────────────────────────

describe('updateTodo', () => {
  beforeEach(() => {
    dataStore.hydrate(
      [
        { id: 'inbox', name: 'Inbox', color: '#6366f1' },
        { id: 'work', name: 'Work', color: '#6366f1' },
      ],
      [
        {
          id: 't1',
          title: 'Original',
          completed: false,
          dueDate: null,
          listId: 'inbox',
          createdAt: '',
          notes: '',
        },
      ]
    );
  });

  it('updates the title', () => {
    dataStore.updateTodo('t1', { title: 'Updated' });
    expect(dataStore.todos[0].title).toBe('Updated');
  });

  it('updates the due date', () => {
    dataStore.updateTodo('t1', { dueDate: '2026-08-20' });
    expect(dataStore.todos[0].dueDate).toBe('2026-08-20');
  });

  it('updates notes', () => {
    dataStore.updateTodo('t1', { notes: 'a note' });
    expect(dataStore.todos[0].notes).toBe('a note');
  });

  it('moves a todo to a different list', () => {
    dataStore.updateTodo('t1', { listId: 'work' });
    expect(dataStore.todos[0].listId).toBe('work');
  });

  it('does nothing for an unknown id', () => {
    dataStore.updateTodo('no-such-id', { title: 'Ghost' });
    expect(dataStore.todos[0].title).toBe('Original');
  });
});

// ── deleteTodo ────────────────────────────────────────────────────────────────

describe('deleteTodo', () => {
  beforeEach(() => {
    dataStore.hydrate(
      [{ id: 'inbox', name: 'Inbox', color: '#6366f1' }],
      [
        {
          id: 't1',
          title: 'Keep',
          completed: false,
          dueDate: null,
          listId: 'inbox',
          createdAt: '',
          notes: '',
        },
        {
          id: 't2',
          title: 'Remove',
          completed: false,
          dueDate: null,
          listId: 'inbox',
          createdAt: '',
          notes: '',
        },
      ]
    );
  });

  it('removes the todo by id', () => {
    dataStore.deleteTodo('t2');
    expect(dataStore.todos).toHaveLength(1);
    expect(dataStore.todos[0].id).toBe('t1');
  });

  it('does nothing for an unknown id', () => {
    dataStore.deleteTodo('no-such-id');
    expect(dataStore.todos).toHaveLength(2);
  });
});

// ── addList ───────────────────────────────────────────────────────────────────

describe('addList', () => {
  it('adds a new list', () => {
    dataStore.addList('Shopping');
    expect(dataStore.lists).toHaveLength(1);
    expect(dataStore.lists[0].name).toBe('Shopping');
  });

  it('derives the id by lowercasing and hyphenating the name', () => {
    dataStore.addList('My Project');
    expect(dataStore.lists[0].id).toBe('my-project');
  });

  it('does not add a duplicate list', () => {
    dataStore.addList('inbox');
    dataStore.addList('inbox');
    expect(dataStore.lists).toHaveLength(1);
  });

  it('does not add a list whose id already exists', () => {
    dataStore.hydrate([{ id: 'inbox', name: 'Inbox', color: '#6366f1' }], []);
    dataStore.addList('Inbox'); // id = 'inbox', already present
    expect(dataStore.lists).toHaveLength(1);
  });
});

// ── deleteList ────────────────────────────────────────────────────────────────

describe('deleteList', () => {
  beforeEach(() => {
    dataStore.hydrate(
      [
        { id: 'inbox', name: 'Inbox', color: '#6366f1' },
        { id: 'work', name: 'Work', color: '#6366f1' },
      ],
      [
        {
          id: 't1',
          title: 'Inbox task',
          completed: false,
          dueDate: null,
          listId: 'inbox',
          createdAt: '',
          notes: '',
        },
        {
          id: 't2',
          title: 'Work task',
          completed: false,
          dueDate: null,
          listId: 'work',
          createdAt: '',
          notes: '',
        },
      ]
    );
  });

  it('removes the list', () => {
    dataStore.deleteList('work');
    expect(dataStore.lists.map((l) => l.id)).not.toContain('work');
  });

  it('removes todos belonging to the deleted list', () => {
    dataStore.deleteList('work');
    expect(dataStore.todos.every((t) => t.listId !== 'work')).toBe(true);
  });

  it('preserves todos from other lists', () => {
    dataStore.deleteList('work');
    expect(dataStore.todos).toHaveLength(1);
    expect(dataStore.todos[0].id).toBe('t1');
  });

  it('falls back activeListId to the first remaining list', () => {
    dataStore.setActiveList('work');
    dataStore.deleteList('work');
    expect(dataStore.activeListId).toBe('inbox');
  });
});

// ── filteredTodos ─────────────────────────────────────────────────────────────

describe('filteredTodos', () => {
  beforeEach(() => {
    dataStore.hydrate(
      [
        { id: 'inbox', name: 'Inbox', color: '#6366f1' },
        { id: 'work', name: 'Work', color: '#6366f1' },
      ],
      [
        {
          id: 't1',
          title: 'Inbox task',
          completed: false,
          dueDate: null,
          listId: 'inbox',
          createdAt: '',
          notes: '',
        },
        {
          id: 't2',
          title: 'Work task',
          completed: false,
          dueDate: null,
          listId: 'work',
          createdAt: '',
          notes: '',
        },
      ]
    );
  });

  it('returns only the active list todos', () => {
    dataStore.setActiveList('inbox');
    expect(dataStore.filteredTodos).toHaveLength(1);
    expect(dataStore.filteredTodos[0].listId).toBe('inbox');
  });

  it('updates when switching lists', () => {
    dataStore.setActiveList('inbox');
    expect(dataStore.filteredTodos[0].title).toBe('Inbox task');

    dataStore.setActiveList('work');
    expect(dataStore.filteredTodos[0].title).toBe('Work task');
  });

  it('returns all todos when activeListId is null', () => {
    dataStore.setActiveList(null);
    expect(dataStore.filteredTodos).toHaveLength(2);
  });
});

// ── counts ────────────────────────────────────────────────────────────────────

describe('counts', () => {
  it('counts incomplete todos per list', () => {
    dataStore.hydrate(
      [
        { id: 'inbox', name: 'Inbox', color: '#6366f1' },
        { id: 'work', name: 'Work', color: '#6366f1' },
      ],
      [
        {
          id: 't1',
          title: 'A',
          completed: false,
          dueDate: null,
          listId: 'inbox',
          createdAt: '',
          notes: '',
        },
        {
          id: 't2',
          title: 'B',
          completed: true,
          dueDate: null,
          listId: 'inbox',
          createdAt: '',
          notes: '',
        },
        {
          id: 't3',
          title: 'C',
          completed: false,
          dueDate: null,
          listId: 'work',
          createdAt: '',
          notes: '',
        },
      ]
    );
    expect(dataStore.counts['inbox']).toBe(1);
    expect(dataStore.counts['work']).toBe(1);
  });
});
