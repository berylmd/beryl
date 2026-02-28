<script lang="ts">
	import '$lib/adapters/codegen-setup.js';
	import { SidebarProvider } from '$lib/components/ui/sidebar/index.js';
	import { themeStore } from '$lib/theme.svelte.js';
	import { onMount } from 'svelte'
	import { workspace } from '$lib/workspace.svelte.js'
	import { dataStore } from '$lib/data.svelte.js'
	import './layout.css';

	let { children } = $props();

	$effect(() => {
		themeStore.init();
	});

	onMount(async () => {
	  workspace.init()

	  if (workspace.hasWorkspace) {
	    await dataStore.loadWorkspace()
	  }
	})
</script>

<SidebarProvider>
	{@render children()}
</SidebarProvider>
