<script lang="ts">
  import { goto } from '$app/navigation';
  import { workspace } from '$lib/workspace/store.svelte.js';

  $effect(() => {
    if (workspace.isReady) {
      goto(workspace.hasWorkspace ? '/tasks' : '/setup', { replaceState: true });
    }
  });
</script>
