<script lang="ts">
	import { dataStore } from './store.svelte.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import PlusIcon from '@lucide/svelte/icons/plus';

	let newTodoTitle = $state('');

	function handleAddTodo(e: SubmitEvent) {
		e.preventDefault();
		if (newTodoTitle.trim()) {
			const listId = dataStore.activeListId ?? dataStore.lists[0]?.id;
			dataStore.addTodo({ title: newTodoTitle.trim(), listId });
			newTodoTitle = '';
		}
	}
</script>

<form class="mb-6 flex gap-2" onsubmit={handleAddTodo}>
	<div class="relative flex-1">
		<PlusIcon class="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
		<Input
			class="pl-9"
			placeholder="Add a task... press Enter to save"
			bind:value={newTodoTitle}
		/>
	</div>

	<Button type="submit" disabled={!newTodoTitle.trim()}>Add</Button>
</form>
