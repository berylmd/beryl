<script lang="ts">
  import { goto } from '$app/navigation';
  import { workspace } from './store.svelte.js';
  import { workspaceSync } from '$lib/tasks/sync.js';

  let picking = $state(false);
  let error = $state<string | null>(null);

  async function openWorkspace() {
    if (!workspace.fileAdapter) {
      error = 'No file adapter available. Open this app in Electron or on a mobile device.';
      return;
    }

    picking = true;
    error = null;

    try {
      const dir = await workspace.fileAdapter.pickDirectory();
      if (!dir) return;

      workspace.setRootDir(dir);
      await workspaceSync.loadWorkspace();
      goto('/tasks');
    } catch (e) {
      error = String(e);
    } finally {
      picking = false;
    }
  }
</script>

<div
  class="
  flex h-screen w-full flex-col items-center justify-center gap-6 p-8
"
>
  <div class="mx-auto text-center">
    <h1 class="text-3xl font-bold tracking-tight">Welcome to Beryl</h1>
    <p class="mt-2 max-w-sm text-muted-foreground">
      Beryl reads your tasks from markdown files. Choose a folder to get started.
    </p>
  </div>

  <button
    onclick={openWorkspace}
    disabled={picking}
    class="
      mx-auto inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3
      font-medium text-primary-foreground
      disabled:opacity-50
    "
  >
    {picking ? 'Opening…' : 'Open Workspace Folder'}
  </button>

  {#if error}
    <p class="mx-auto text-sm text-destructive">{error}</p>
  {/if}

  <p class="mx-auto max-w-xs text-center text-xs text-muted-foreground">
    Your tasks stay on your device. Sync with iCloud, Dropbox, or any tool you already use.
  </p>
</div>
