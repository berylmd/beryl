<script lang="ts">
	import { SidebarProvider } from '$lib/components/ui/sidebar/index.js';
	import { themeStore } from '$lib/theme.svelte.js';
	import { onMount } from 'svelte'
	import { workspace } from '$lib/workspace.svelte.js'
	import { detectPlatform } from '$lib/platform.js'
	import { dataStore } from '$lib/data.svelte.js'
	import './layout.css';

	let { children } = $props();

	$effect(() => {
		themeStore.init();
	});

	onMount(async () => {
	  workspace.init()
	  console.log('Platform:', detectPlatform())
	  console.log('workspace.fileAdapter:', workspace.fileAdapter)
	  console.log('workspace.rootDir:', workspace.rootDir)
	  console.log('workspace.hasWorkspace:', workspace.hasWorkspace)
	  if (workspace.hasWorkspace) {
	    await dataStore.loadWorkspace()
	  }
	})
</script>

<SidebarProvider>
	{@render children()}
</SidebarProvider>
