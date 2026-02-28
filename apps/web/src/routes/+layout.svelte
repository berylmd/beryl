<script lang="ts">
  import '$lib/workspace/adapters/codegen-setup.js';
  import { themeStore } from '$lib/theme/store.svelte.js';
  import { onMount } from 'svelte';
  import { workspace } from '$lib/workspace/store.svelte.js';
  import './layout.css';

  let { children } = $props();

  $effect(() => {
    themeStore.init();
  });

  onMount(() => {
    workspace.init();
  });
</script>

{@render children()}
