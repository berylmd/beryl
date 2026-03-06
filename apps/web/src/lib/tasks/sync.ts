import type { List, Todo } from './types.js';
import { fileNameToListId, parseFile, serializeTodos } from './serializer.js';
import { workspace } from '$lib/workspace/store.svelte.js';
import { dataStore } from './store.svelte.js';

function createWorkspaceSync() {
  let unwatchWorkspace: (() => void) | null = null;
  let loadInProgress = false;

  // ── Save ────────────────────────────────────────────────────────────────────

  const saveTimers = new Map<string, ReturnType<typeof setTimeout>>();
  let activeSaves = 0;
  let lastSaveCompletedAt = 0;
  const SELF_WRITE_WINDOW_MS = 1500;

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
    const listTodos = dataStore.todos.filter((t) => t.listId === listId);
    const content = serializeTodos(listTodos);
    const path = `${rootDir}/${listId}.md`;
    activeSaves++;
    try {
      await adapter.writeFile(path, content);
    } catch (e) {
      console.error(`[beryl] Failed to save ${listId}:`, e);
    } finally {
      activeSaves--;
      lastSaveCompletedAt = Date.now();
    }
  }

  // ── Load ────────────────────────────────────────────────────────────────────

  async function loadWorkspace() {
    const adapter = workspace.fileAdapter;
    const rootDir = workspace.rootDir;
    if (!adapter || !rootDir) return;

    if (loadInProgress) return;

    if (unwatchWorkspace) {
      unwatchWorkspace();
      unwatchWorkspace = null;
    }

    loadInProgress = true;
    const isInitialLoad = dataStore.lists.length === 0;
    if (isInitialLoad) dataStore.isLoading = true;
    dataStore.loadError = null;

    try {
      const filenames = await adapter.listFiles(rootDir);
      const mdFiles = filenames.filter((f) => f.toLowerCase().endsWith('.md'));

      const newLists: List[] = [];
      const newTodos: Todo[] = [];

      for (const filename of mdFiles) {
        const listId = fileNameToListId(filename);
        const fullPath = `${rootDir}/${filename}`;

        let content: string;
        try {
          content = await adapter.readFile(fullPath);
        } catch {
          continue;
        }

        newLists.push({
          id: listId,
          name: listId.charAt(0).toUpperCase() + listId.slice(1),
          color: '#6366f1',
        });

        newTodos.push(...parseFile(content, listId));
      }

      dataStore.hydrate(newLists, newTodos);

      unwatchWorkspace = await adapter.watchDir(rootDir, () => {
        const isSelfWrite =
          activeSaves > 0 || Date.now() - lastSaveCompletedAt < SELF_WRITE_WINDOW_MS;
        if (!isSelfWrite && saveTimers.size === 0 && !loadInProgress) {
          void loadWorkspace();
        }
      });
    } catch (e) {
      dataStore.loadError = String(e);
    } finally {
      loadInProgress = false;
      if (isInitialLoad) dataStore.isLoading = false;
    }
  }

  // Wire up save scheduling so mutations can trigger saves without knowing
  // anything about the adapter or file paths.
  dataStore.setSaveCallback(scheduleSave);

  return { loadWorkspace };
}

export const workspaceSync = createWorkspaceSync();
