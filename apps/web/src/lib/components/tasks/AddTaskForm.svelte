<script lang="ts">
	import { dataStore } from '$lib/data.svelte.js';
	import { cn } from '$lib/components/ui/lib.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import {
		DropdownMenu,
		DropdownMenuContent,
		DropdownMenuItem,
		DropdownMenuTrigger
	} from '$lib/components/ui/dropdown-menu/index.js';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import type { Priority } from '$lib/types.js';
	import { priorityConfig } from './priority.js';

	let newTodoTitle = $state('');
	let newTodoPriority = $state<Priority>('medium');
	let showPriorityPicker = $state(false);

	function handleAddTodo(e: SubmitEvent) {
		e.preventDefault();
		if (newTodoTitle.trim()) {
			const listId = dataStore.activeListId ?? dataStore.lists[0]?.id ?? 'personal';
			dataStore.addTodo({ title: newTodoTitle.trim(), listId });
			newTodoTitle = '';
			newTodoPriority = 'medium';
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

	<DropdownMenu bind:open={showPriorityPicker}>
		<DropdownMenuTrigger>
			{#snippet child({ props })}
				<Button variant="outline" class="gap-1.5 px-3" {...props}>
					<span class={cn('size-2 rounded-full', priorityConfig[newTodoPriority].dotClass)}></span>
					<span class="hidden sm:inline">{priorityConfig[newTodoPriority].label}</span>
				</Button>
			{/snippet}
		</DropdownMenuTrigger>
		<DropdownMenuContent align="end">
			{#each Object.entries(priorityConfig) as [p, config]}
				<DropdownMenuItem
					onclick={() => {
						newTodoPriority = p as Priority;
						showPriorityPicker = false;
					}}
				>
					<span class={cn('size-2 rounded-full', config.dotClass)}></span>
					{config.label}
				</DropdownMenuItem>
			{/each}
		</DropdownMenuContent>
	</DropdownMenu>

	<Button type="submit" disabled={!newTodoTitle.trim()}>Add</Button>
</form>
