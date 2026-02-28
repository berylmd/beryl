<script lang="ts">
	import { goto } from '$app/navigation'
	import { SidebarProvider } from '$lib/components/ui/sidebar/index.js'
	import AppSidebar from '$lib/layout/AppSidebar.svelte'
	import { workspace } from '$lib/workspace/store.svelte.js'
	import { workspaceSync } from '$lib/tasks/sync.js'

	let { children } = $props()

	$effect(() => {
		if (!workspace.isReady) return
		if (!workspace.hasWorkspace) {
			goto('/setup', { replaceState: true })
			return
		}
		void workspaceSync.loadWorkspace()
	})
</script>

<SidebarProvider>
	<AppSidebar />
	{@render children()}
</SidebarProvider>
