<script lang="ts">
	import type { Todo } from '$lib/types.js';
	import { dataStore } from '$lib/data.svelte.js';
	import { cn } from '$lib/utils.js';
	import { Checkbox } from '$lib/components/ui/checkbox/index.js';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import {
		DropdownMenu,
		DropdownMenuContent,
		DropdownMenuItem,
		DropdownMenuSeparator,
		DropdownMenuTrigger
	} from '$lib/components/ui/dropdown-menu/index.js';
	import CalendarIcon from '@lucide/svelte/icons/calendar';
	import MoreHorizontalIcon from '@lucide/svelte/icons/more-horizontal';
	import PencilIcon from '@lucide/svelte/icons/pencil';
	import Trash2Icon from '@lucide/svelte/icons/trash-2';
	import { priorityConfig } from './priority.js';

	let { todo, onedit }: { todo: Todo; onedit: (id: string) => void } = $props();

	function formatDate(dateStr: string | null) {
		if (!dateStr) return null;
		const date = new Date(dateStr + 'T00:00:00');
		const today = new Date();
		today.setHours(0, 0, 0, 0);
		const tomorrow = new Date(today);
		tomorrow.setDate(tomorrow.getDate() + 1);
		if (date.getTime() === today.getTime()) return 'Today';
		if (date.getTime() === tomorrow.getTime()) return 'Tomorrow';
		return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
	}

	function isOverdue(dateStr: string | null) {
		if (!dateStr) return false;
		const today = new Date().toISOString().split('T')[0];
		return dateStr < today;
	}
</script>

<div
	class={cn(
		'group flex items-start gap-3 rounded-xl border bg-card px-4 py-3 shadow-xs transition-all hover:shadow-sm',
		todo.completed && 'opacity-60'
	)}
>
	<div class="mt-0.5 shrink-0">
		<Checkbox
			checked={todo.completed}
			onCheckedChange={() => dataStore.toggleTodo(todo.id)}
			aria-label={todo.completed ? 'Mark as incomplete' : 'Mark as complete'}
		/>
	</div>

	<div class="min-w-0 flex-1">
		<p
			class={cn(
				'text-sm font-medium leading-snug',
				todo.completed && 'line-through text-muted-foreground'
			)}
		>
			{todo.title}
		</p>
		<div class="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5">
			{#if todo.dueDate}
				<span
					class={cn(
						'flex items-center gap-1 text-xs',
						isOverdue(todo.dueDate) && !todo.completed
							? 'text-destructive'
							: 'text-muted-foreground'
					)}
				>
					<CalendarIcon class="size-3" />
					{formatDate(todo.dueDate)}
				</span>
			{/if}
			{#if todo.notes}
				<span class="max-w-xs truncate text-xs text-muted-foreground">{todo.notes}</span>
			{/if}
		</div>
	</div>

	<div class="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
		<Badge variant={priorityConfig[todo.priority].variant} class="text-xs">
			{priorityConfig[todo.priority].label}
		</Badge>

		<DropdownMenu>
			<DropdownMenuTrigger>
				{#snippet child({ props })}
					<button
						class="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
						aria-label="Task options"
						{...props}
					>
						<MoreHorizontalIcon class="size-4" />
					</button>
				{/snippet}
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end">
				<DropdownMenuItem onclick={() => onedit(todo.id)}>
					<PencilIcon class="mr-2 size-4" />
					Edit
				</DropdownMenuItem>
				<DropdownMenuSeparator />
				<DropdownMenuItem
					class="text-destructive focus:text-destructive"
					onclick={() => dataStore.deleteTodo(todo.id)}
				>
					<Trash2Icon class="mr-2 size-4" />
					Delete
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	</div>
</div>
