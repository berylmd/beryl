<script lang="ts">
	import { workspace } from '$lib/workspace.svelte.js';
	import { dataStore } from '$lib/data.svelte.js';
	import WorkspaceSetup from '$lib/components/WorkspaceSetup.svelte';
	import { SidebarInset } from '$lib/components/ui/sidebar/index.js';
	import AppSidebar from './AppSidebar.svelte';
	import PageHeader from '$lib/components/layout/PageHeader.svelte';
	import AddTaskForm from '$lib/components/tasks/AddTaskForm.svelte';
	import TaskList from '$lib/components/tasks/TaskList.svelte';
	import EditTaskDialog from '$lib/components/tasks/EditTaskDialog.svelte';
	import type { Todo } from '$lib/types.js';

	let activeFilter = $state<'all' | 'today' | 'upcoming' | 'completed'>('all');
	let editingTodo = $state<Todo | null>(null);

	const viewTitle = $derived.by(() => {
		if (dataStore.activeListId) {
			return dataStore.lists.find((l) => l.id === dataStore.activeListId)?.name ?? 'List';
		}
		switch (activeFilter) {
			case 'today': return 'Today';
			case 'upcoming': return 'Upcoming';
			case 'completed': return 'Completed';
			default: return 'Inbox';
		}
	});

	const viewSubtitle = $derived.by(() => {
		const incomplete = dataStore.filteredTodos.filter((t) => !t.completed).length;
		if (activeFilter === 'completed') return `${dataStore.filteredTodos.length} completed`;
		return incomplete === 0 ? 'All done!' : `${incomplete} remaining`;
	});

	function openEdit(id: string) {
		editingTodo = dataStore.todos.find((t) => t.id === id) ?? null;
	}
</script>

<svelte:head>
	<title>Beryl</title>
</svelte:head>

{#if !workspace.hasWorkspace}
	<WorkspaceSetup />
{:else if dataStore.isLoading}
	<div class="flex items-center justify-center h-screen text-muted-foreground">
		Loading…
	</div>
{:else}
	<AppSidebar />

	<SidebarInset>
		<PageHeader title={viewTitle} subtitle={viewSubtitle} />

		<div class="flex flex-1 flex-col p-4 md:p-6">
			{#if activeFilter !== 'completed'}
				<AddTaskForm />
			{/if}
			<TaskList todos={dataStore.filteredTodos} {activeFilter} onedit={openEdit} />
		</div>
	</SidebarInset>

	<EditTaskDialog bind:todo={editingTodo} />
{/if}
