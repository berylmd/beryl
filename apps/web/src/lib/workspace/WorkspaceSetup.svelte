<script lang="ts">
  import { goto } from '$app/navigation'
  import { workspace } from './store.svelte.js'
  import { dataStore } from '$lib/tasks/store.svelte.js'

  let picking = $state(false)
  let error   = $state<string | null>(null)

  async function openWorkspace() {
    if (!workspace.fileAdapter) {
      error = 'No file adapter available. Open this app in Electron or on a mobile device.'
      return
    }

    picking = true
    error   = null

    try {
      const dir = await workspace.fileAdapter.pickDirectory()
      if (!dir) return

      workspace.setRootDir(dir)
      await dataStore.loadWorkspace()
      goto('/tasks')
    } catch (e) {
      error = String(e)
    } finally {
      picking = false
    }
  }
</script>

<div class="flex flex-col items-center justify-center h-screen w-full gap-6 p-8">
  <div class="text-center mx-auto">
    <h1 class="text-3xl font-bold tracking-tight">Welcome to Beryl</h1>
    <p class="mt-2 text-muted-foreground max-w-sm">
      Beryl reads your tasks from markdown files. Choose a folder to get started.
    </p>
  </div>

  <button
    onclick={openWorkspace}
    disabled={picking}
    class="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-primary text-primary-foreground font-medium disabled:opacity-50 mx-auto"
  >
    {picking ? 'Opening…' : 'Open Workspace Folder'}
  </button>

  {#if error}
    <p class="text-destructive text-sm mx-auto">{error}</p>
  {/if}

  <p class="text-xs text-muted-foreground max-w-xs text-center mx-auto">
    Your tasks stay on your device. Sync with iCloud, Dropbox, or any tool you already use.
  </p>
</div>
