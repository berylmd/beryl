import { describe, it, expect } from 'vitest';
import type { LabelText } from '@repo/beryljs';
import {
  stripLabels,
  normalizeComments,
  parseDueDate,
  fileNameToListId,
  serializeTodo,
  serializeTodos,
  parseFile,
} from './serializer.js';
import type { Todo } from './types.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeTodo(overrides: Partial<Todo> = {}): Todo {
  return {
    id: 'test-id',
    title: 'Test task',
    completed: false,
    dueDate: null,
    listId: 'inbox',
    createdAt: '2026-01-01T00:00:00.000Z',
    notes: '',
    ...overrides,
  };
}

// ── stripLabels ───────────────────────────────────────────────────────────────

describe('stripLabels', () => {
  it('strips a p: label', () => {
    expect(stripLabels('Buy milk p:high')).toBe('Buy milk');
  });

  it('strips a due: label', () => {
    expect(stripLabels('Buy milk due:2026-03-01')).toBe('Buy milk');
  });

  it('strips multiple labels', () => {
    expect(stripLabels('Buy milk p:high due:2026-03-01')).toBe('Buy milk');
  });

  it('preserves text that is not a label', () => {
    expect(stripLabels('Fix bug in module')).toBe('Fix bug in module');
  });

  it('collapses extra whitespace left by removed labels', () => {
    expect(stripLabels('Task  p:low  text')).toBe('Task text');
  });

  it('returns empty string for a labels-only description', () => {
    expect(stripLabels('p:high due:2026-01-01')).toBe('');
  });
});

// ── normalizeComments ─────────────────────────────────────────────────────────

describe('normalizeComments', () => {
  it('returns empty string for falsy input', () => {
    expect(normalizeComments(null)).toBe('');
    expect(normalizeComments(undefined)).toBe('');
    expect(normalizeComments('')).toBe('');
  });

  it('joins an array of strings with newlines', () => {
    expect(normalizeComments(['first', 'second'])).toBe('first\nsecond');
  });

  it('returns a plain string unchanged', () => {
    expect(normalizeComments('just a note')).toBe('just a note');
  });

  it('coerces non-string scalars', () => {
    expect(normalizeComments(42)).toBe('42');
  });
});

// ── parseDueDate ──────────────────────────────────────────────────────────────

describe('parseDueDate', () => {
  it('returns null when there are no labels', () => {
    expect(parseDueDate([])).toBeNull();
  });

  it('returns null when no due label is present', () => {
    // Runtime shape from beryljs Nearley grammar is { label, value }, not { labels: { label, text } }
    const labels = [{ label: 'p', value: 'high' }] as unknown as LabelText[];
    expect(parseDueDate(labels)).toBeNull();
  });

  it('extracts the due date string', () => {
    const labels = [{ label: 'due', value: '2026-06-15' }] as unknown as LabelText[];
    expect(parseDueDate(labels)).toBe('2026-06-15');
  });

  it('ignores non-due labels', () => {
    const labels = [
      { label: 'p', value: 'high' },
      { label: 'due', value: '2026-03-01' },
    ] as unknown as LabelText[];
    expect(parseDueDate(labels)).toBe('2026-03-01');
  });
});

// ── fileNameToListId ──────────────────────────────────────────────────────────

describe('fileNameToListId', () => {
  it('strips a lowercase .md extension', () => {
    expect(fileNameToListId('inbox.md')).toBe('inbox');
  });

  it('strips an uppercase .MD extension', () => {
    expect(fileNameToListId('NOTES.MD')).toBe('NOTES');
  });

  it('strips a mixed-case .Md extension', () => {
    expect(fileNameToListId('tasks.Md')).toBe('tasks');
  });

  it('preserves hyphens and dots in the base name', () => {
    expect(fileNameToListId('my-project.md')).toBe('my-project');
  });

  it('does not strip .md in the middle of a filename', () => {
    expect(fileNameToListId('my.md.backup')).toBe('my.md.backup');
  });
});

// ── serializeTodo ─────────────────────────────────────────────────────────────

describe('serializeTodo', () => {
  it('serializes an unchecked task', () => {
    expect(serializeTodo(makeTodo({ title: 'Buy milk', completed: false }))).toBe('- [ ] Buy milk');
  });

  it('serializes a completed task', () => {
    expect(serializeTodo(makeTodo({ title: 'Buy milk', completed: true }))).toBe('- [x] Buy milk');
  });

  it('appends a due: label when dueDate is set', () => {
    const result = serializeTodo(makeTodo({ title: 'Submit form', dueDate: '2026-08-20' }));
    expect(result).toBe('- [ ] Submit form due:2026-08-20');
  });

  it('omits due: when dueDate is null', () => {
    const result = serializeTodo(makeTodo({ title: 'No date', dueDate: null }));
    expect(result).not.toContain('due:');
  });

  it('appends a \\t> line per notes line', () => {
    const result = serializeTodo(makeTodo({ title: 'Task', notes: 'line one\nline two' }));
    expect(result).toBe('- [ ] Task\n\t>line one\n\t>line two');
  });

  it('omits notes block when notes is empty', () => {
    const result = serializeTodo(makeTodo({ title: 'Task', notes: '' }));
    expect(result).not.toContain('\t>');
  });

  it('combines due date and notes', () => {
    const result = serializeTodo(
      makeTodo({ title: 'Task', dueDate: '2026-01-01', notes: 'a note' })
    );
    expect(result).toBe('- [ ] Task due:2026-01-01\n\t>a note');
  });
});

// ── serializeTodos ────────────────────────────────────────────────────────────

describe('serializeTodos', () => {
  it('returns empty string for an empty array', () => {
    expect(serializeTodos([])).toBe('');
  });

  it('joins tasks with newlines and ends with a trailing newline', () => {
    const todos = [makeTodo({ title: 'Alpha' }), makeTodo({ title: 'Beta' })];
    const result = serializeTodos(todos);
    expect(result).toBe('- [ ] Alpha\n- [ ] Beta\n');
  });

  it('preserves task order', () => {
    const todos = ['Alpha', 'Beta', 'Gamma'].map((title) => makeTodo({ title }));
    const result = serializeTodos(todos);
    expect(result.indexOf('Alpha')).toBeLessThan(result.indexOf('Beta'));
    expect(result.indexOf('Beta')).toBeLessThan(result.indexOf('Gamma'));
  });
});

// ── parseFile ─────────────────────────────────────────────────────────────────

describe('parseFile', () => {
  it('returns empty array for empty content', () => {
    expect(parseFile('', 'inbox')).toEqual([]);
  });

  it('returns empty array for malformed content', () => {
    expect(parseFile('not a task list !!!', 'inbox')).toEqual([]);
  });

  it('parses a basic unchecked task', () => {
    const result = parseFile('- [ ] Buy milk\n', 'inbox');
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('Buy milk');
    expect(result[0].completed).toBe(false);
    expect(result[0].listId).toBe('inbox');
  });

  it('parses a checked task', () => {
    const result = parseFile('- [x] Done task\n', 'inbox');
    expect(result[0].completed).toBe(true);
  });

  it('strips labels from the title', () => {
    const result = parseFile('- [ ] Buy milk p:high due:2026-03-01\n', 'inbox');
    expect(result[0].title).toBe('Buy milk');
  });

  it('extracts the due date from a due: label', () => {
    const result = parseFile('- [ ] Task due:2026-06-15\n', 'inbox');
    expect(result[0].dueDate).toBe('2026-06-15');
  });

  it('parses notes from \\t> lines', () => {
    const result = parseFile('- [ ] Task\n\t>my note\n', 'inbox');
    expect(result[0].notes).toBe('my note');
  });

  it('parses multiple tasks', () => {
    const content = '- [ ] Alpha\n- [x] Beta\n- [ ] Gamma\n';
    const result = parseFile(content, 'work');
    expect(result).toHaveLength(3);
    expect(result.map((t) => t.title)).toEqual(['Alpha', 'Beta', 'Gamma']);
  });

  it('assigns the given listId to all tasks', () => {
    const result = parseFile('- [ ] Task one\n- [ ] Task two\n', 'my-list');
    expect(result.every((t) => t.listId === 'my-list')).toBe(true);
  });
});
