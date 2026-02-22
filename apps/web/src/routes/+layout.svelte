<script lang="ts">
	import { SidebarProvider } from '$lib/components/ui/sidebar/index.js';
	import { themeStore } from '$lib/theme.svelte.js';
	import './layout.css';

	let { children } = $props();

	$effect(() => {
		themeStore.init();
	});
</script>

<SidebarProvider>
	{@render children()}
</SidebarProvider>
