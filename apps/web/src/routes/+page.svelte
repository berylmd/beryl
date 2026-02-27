<script lang="ts">
	import { workspace } from '$lib/workspace.svelte.js';
	import { dataStore } from '$lib/data.svelte.js';
	import { SidebarInset } from '$lib/components/ui/sidebar/index.js';
	import type { Todo } from '$lib/types.js';

	import WorkspaceSetup from '$lib/components/WorkspaceSetup.svelte';
	import AppSidebar from '../lib/components/layout/AppSidebar.svelte'
	import PageHeader from '$lib/components/layout/PageHeader.svelte';
	import AddTaskForm from '$lib/components/tasks/AddTaskForm.svelte';
	import TaskList from '$lib/components/tasks/TaskList.svelte';
	import EditTaskDialog from '$lib/components/tasks/EditTaskDialog.svelte';

	let activeFilter = $state<'all' | 'today' | 'upcoming' | 'completed'>('all');
	let editingTodo = $state<Todo | null>(null);

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
		<PageHeader title={dataStore.activeListId ?? "Tasks" } />

		<div class="flex flex-1 flex-col p-4 md:p-6">
			<AddTaskForm />
			<TaskList todos={dataStore.filteredTodos} {activeFilter} onedit={openEdit} />
		</div>
	</SidebarInset>

	<EditTaskDialog bind:todo={editingTodo} />
{/if}
