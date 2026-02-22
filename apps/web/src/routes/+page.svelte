<script lang="ts">
	import { todosStore } from '$lib/todos.svelte.js';
	import { cn } from '$lib/utils.js';
	import { SidebarInset, SidebarTrigger } from '$lib/components/ui/sidebar/index.js';
	import { Checkbox } from '$lib/components/ui/checkbox/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Separator } from '$lib/components/ui/separator/index.js';
	import {
		Dialog,
		DialogContent,
		DialogHeader,
		DialogTitle,
		DialogFooter
	} from '$lib/components/ui/dialog/index.js';
	import {
		DropdownMenu,
		DropdownMenuContent,
		DropdownMenuItem,
		DropdownMenuSeparator,
		DropdownMenuTrigger
	} from '$lib/components/ui/dropdown-menu/index.js';
	import AppSidebar from './AppSidebar.svelte';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import MoreHorizontalIcon from '@lucide/svelte/icons/more-horizontal';
	import Trash2Icon from '@lucide/svelte/icons/trash-2';
	import PencilIcon from '@lucide/svelte/icons/pencil';
	import CalendarIcon from '@lucide/svelte/icons/calendar';
	import ClipboardListIcon from '@lucide/svelte/icons/clipboard-list';
	import SunIcon from '@lucide/svelte/icons/sun';
	import MoonIcon from '@lucide/svelte/icons/moon';
	import { themeStore } from '$lib/theme.svelte.js';
	import type { Priority } from '$lib/types.js';

	// New todo form
	let newTodoTitle = $state('');
	let newTodoPriority = $state<Priority>('medium');
	let showPriorityPicker = $state(false);

	// Edit dialog state
	let editDialogOpen = $state(false);
	let editingTodoId = $state<string | null>(null);
	let editTitle = $state('');
	let editPriority = $state<Priority>('medium');
	let editDueDate = $state('');
	let editListId = $state('');
	let editNotes = $state('');

	const priorityConfig: Record<
		Priority,
		{ label: string; variant: 'default' | 'secondary' | 'outline'; dotClass: string }
	> = {
		high: { label: 'High', variant: 'default', dotClass: 'bg-primary' },
		medium: { label: 'Medium', variant: 'secondary', dotClass: 'bg-orange-400' },
		low: { label: 'Low', variant: 'outline', dotClass: 'bg-muted-foreground/40' }
	};

	const viewTitle = $derived.by(() => {
		if (todosStore.activeListId) {
			return todosStore.lists.find((l) => l.id === todosStore.activeListId)?.name ?? 'List';
		}
		switch (todosStore.activeFilter) {
			case 'today':
				return 'Today';
			case 'upcoming':
				return 'Upcoming';
			case 'completed':
				return 'Completed';
			default:
				return 'Inbox';
		}
	});

	const viewSubtitle = $derived.by(() => {
		const incomplete = todosStore.filteredTodos.filter((t) => !t.completed).length;
		if (todosStore.activeFilter === 'completed') {
			return `${todosStore.filteredTodos.length} completed`;
		}
		return incomplete === 0 ? 'All done!' : `${incomplete} remaining`;
	});

	function handleAddTodo(e: SubmitEvent) {
		e.preventDefault();
		if (newTodoTitle.trim()) {
			const listId = todosStore.activeListId ?? todosStore.lists[0]?.id ?? 'personal';
			todosStore.addTodo(newTodoTitle.trim(), listId, newTodoPriority);
			newTodoTitle = '';
			newTodoPriority = 'medium';
		}
	}

	function openEdit(id: string) {
		const todo = todosStore.todos.find((t) => t.id === id);
		if (!todo) return;
		editingTodoId = id;
		editTitle = todo.title;
		editPriority = todo.priority;
		editDueDate = todo.dueDate ?? '';
		editListId = todo.listId;
		editNotes = todo.notes;
		editDialogOpen = true;
	}

	function handleSaveEdit() {
		if (!editingTodoId) return;
		todosStore.updateTodo(editingTodoId, {
			title: editTitle,
			priority: editPriority,
			dueDate: editDueDate || null,
			listId: editListId,
			notes: editNotes
		});
		editDialogOpen = false;
		editingTodoId = null;
	}

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

<svelte:head>
	<title>Beryl</title>
</svelte:head>

<AppSidebar />

<SidebarInset>
	<!-- Page header — background fills behind the status bar / Dynamic Island -->
	<header
		class="sticky top-0 z-10 shrink-0 border-b bg-background/95 backdrop-blur"
		style="padding-top: var(--safe-top)"
	>
		<div class="flex h-14 items-center gap-2 px-4">
			<SidebarTrigger class="-ml-1" />
			<Separator orientation="vertical" class="h-4" />
			<div class="flex flex-1 items-baseline gap-2">
				<h1 class="text-base font-semibold">{viewTitle}</h1>
				<span class="text-xs text-muted-foreground">{viewSubtitle}</span>
			</div>
			<Button
				variant="ghost"
				size="icon"
				onclick={() => themeStore.toggle()}
				aria-label="Toggle theme"
			>
				{#if themeStore.current === 'dark'}
					<SunIcon class="size-4" />
				{:else}
					<MoonIcon class="size-4" />
				{/if}
			</Button>
		</div>
	</header>

	<div class="flex flex-1 flex-col p-4 md:p-6">
		<!-- Add todo form -->
		{#if todosStore.activeFilter !== 'completed'}
			<form class="mb-6 flex gap-2" onsubmit={handleAddTodo}>
				<div class="relative flex-1">
					<PlusIcon
						class="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
					/>
					<Input
						class="pl-9"
						placeholder="Add a task... press Enter to save"
						bind:value={newTodoTitle}
					/>
				</div>
				<!-- Priority picker -->
				<DropdownMenu bind:open={showPriorityPicker}>
					<DropdownMenuTrigger>
						{#snippet child({ props })}
							<Button variant="outline" class="gap-1.5 px-3" {...props}>
								<span
									class={cn('size-2 rounded-full', priorityConfig[newTodoPriority].dotClass)}
								></span>
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
		{/if}

		<!-- Todo list -->
		<div class="flex flex-col gap-1.5">
			{#if todosStore.filteredTodos.length === 0}
				<div class="flex flex-col items-center justify-center py-24 text-center">
					<div class="mb-4 flex size-16 items-center justify-center rounded-full bg-muted">
						<ClipboardListIcon class="size-8 text-muted-foreground/60" />
					</div>
					<p class="text-sm font-medium text-muted-foreground">Nothing here</p>
					<p class="mt-1 text-xs text-muted-foreground/70">
						{todosStore.activeFilter === 'completed'
							? 'Complete some tasks to see them here.'
							: 'Add a task above to get started.'}
					</p>
				</div>
			{/if}

			{#each todosStore.filteredTodos as todo (todo.id)}
				<div
					class={cn(
						'group flex items-start gap-3 rounded-xl border bg-card px-4 py-3 shadow-xs transition-all hover:shadow-sm',
						todo.completed && 'opacity-60'
					)}
				>
					<!-- Checkbox -->
					<div class="mt-0.5 shrink-0">
						<Checkbox
							checked={todo.completed}
							onCheckedChange={() => todosStore.toggleTodo(todo.id)}
							aria-label={todo.completed ? 'Mark as incomplete' : 'Mark as complete'}
						/>
					</div>

					<!-- Content -->
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

					<!-- Actions (shown on hover) -->
					<div
						class="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100"
					>
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
								<DropdownMenuItem onclick={() => openEdit(todo.id)}>
									<PencilIcon class="mr-2 size-4" />
									Edit
								</DropdownMenuItem>
								<DropdownMenuSeparator />
								<DropdownMenuItem
									class="text-destructive focus:text-destructive"
									onclick={() => todosStore.deleteTodo(todo.id)}
								>
									<Trash2Icon class="mr-2 size-4" />
									Delete
								</DropdownMenuItem>
							</DropdownMenuContent>
						</DropdownMenu>
					</div>
				</div>
			{/each}
		</div>
	</div>
</SidebarInset>

<!-- Edit dialog -->
<Dialog bind:open={editDialogOpen}>
	<DialogContent class="sm:max-w-md">
		<DialogHeader>
			<DialogTitle>Edit Task</DialogTitle>
		</DialogHeader>
		<div class="flex flex-col gap-4 py-2">
			<div class="flex flex-col gap-1.5">
				<label class="text-sm font-medium" for="edit-title">Title</label>
				<Input id="edit-title" bind:value={editTitle} />
			</div>
			<div class="grid grid-cols-2 gap-4">
				<div class="flex flex-col gap-1.5">
					<label class="text-sm font-medium" for="edit-priority">Priority</label>
					<select
						id="edit-priority"
						class="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs transition-colors focus:outline-none focus:ring-1 focus:ring-ring"
						bind:value={editPriority}
					>
						<option value="low">Low</option>
						<option value="medium">Medium</option>
						<option value="high">High</option>
					</select>
				</div>
				<div class="flex flex-col gap-1.5">
					<label class="text-sm font-medium" for="edit-due">Due Date</label>
					<Input id="edit-due" type="date" bind:value={editDueDate} />
				</div>
			</div>
			<div class="flex flex-col gap-1.5">
				<label class="text-sm font-medium" for="edit-list">List</label>
				<select
					id="edit-list"
					class="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs transition-colors focus:outline-none focus:ring-1 focus:ring-ring"
					bind:value={editListId}
				>
					{#each todosStore.lists as list}
						<option value={list.id}>{list.name}</option>
					{/each}
				</select>
			</div>
			<div class="flex flex-col gap-1.5">
				<label class="text-sm font-medium" for="edit-notes">Notes</label>
				<textarea
					id="edit-notes"
					class="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
					placeholder="Add notes..."
					bind:value={editNotes}
				></textarea>
			</div>
		</div>
		<DialogFooter>
			<Button
				variant="outline"
				onclick={() => {
					editDialogOpen = false;
					editingTodoId = null;
				}}>Cancel</Button
			>
			<Button onclick={handleSaveEdit} disabled={!editTitle.trim()}>Save changes</Button>
		</DialogFooter>
	</DialogContent>
</Dialog>
