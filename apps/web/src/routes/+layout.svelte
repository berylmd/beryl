<script lang="ts">
	import { SidebarProvider } from '$lib/components/ui/sidebar/index.js';
	import './layout.css';

	let { children } = $props();
</script>

<SidebarProvider>
	{@render children()}
</SidebarProvider>
