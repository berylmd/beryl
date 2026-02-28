<script lang="ts">
	import { goto } from '$app/navigation'
	import { SidebarProvider } from '$lib/components/ui/sidebar/index.js'
	import AppSidebar from '$lib/layout/AppSidebar.svelte'
	import { workspace } from '$lib/workspace/store.svelte.js'
	import { dataStore } from '$lib/tasks/store.svelte.js'

	let { children } = $props()

	$effect(() => {
		if (!workspace.isReady) return
		if (!workspace.hasWorkspace) {
			goto('/setup', { replaceState: true })
			return
		}
		void dataStore.loadWorkspace()
	})
</script>

<SidebarProvider>
	<AppSidebar />
	{@render children()}
</SidebarProvider>
