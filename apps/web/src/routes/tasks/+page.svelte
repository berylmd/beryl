<script lang="ts">
  import { SidebarInset } from '$lib/components/ui/sidebar/index.js';
  import type { Todo } from '$lib/tasks/types.js';
  import { dataStore } from '$lib/tasks/store.svelte.js';
  import PageHeader from '$lib/layout/PageHeader.svelte';
  import AddTaskForm from '$lib/tasks/AddTaskForm.svelte';
  import TaskList from '$lib/tasks/TaskList.svelte';
  import EditTaskDialog from '$lib/tasks/EditTaskDialog.svelte';

  let activeFilter = $state<'all' | 'today' | 'upcoming' | 'completed'>('all');
  let editingTodo = $state<Todo | null>(null);

  function openEdit(id: string) {
    editingTodo = dataStore.todos.find((t) => t.id === id) ?? null;
  }
</script>

<svelte:head>
  <title>Beryl</title>
</svelte:head>

{#if dataStore.isLoading}
  <div class="flex items-center justify-center h-screen text-muted-foreground">Loading…</div>
{:else}
  <SidebarInset>
    <PageHeader title={dataStore.activeListId ?? 'Tasks'} />

    <div class="flex flex-1 flex-col p-4 md:p-6">
      {#if dataStore.activeListId}
        <AddTaskForm />
      {/if}
      <TaskList todos={dataStore.filteredTodos} {activeFilter} onedit={openEdit} />
    </div>
  </SidebarInset>

  <EditTaskDialog bind:todo={editingTodo} />
{/if}
