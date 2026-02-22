<script lang="ts">
	import type { Todo, Priority } from '$lib/types.js';
	import { dataStore } from '$lib/data.svelte.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import {
		Dialog,
		DialogContent,
		DialogHeader,
		DialogTitle,
		DialogFooter
	} from '$lib/components/ui/dialog/index.js';

	let { todo = $bindable() }: { todo: Todo | null } = $props();

	let editTitle = $state('');
	let editPriority = $state<Priority>('medium');
	let editDueDate = $state('');
	let editListId = $state('');
	let editNotes = $state('');

	$effect(() => {
		if (todo) {
			editTitle = todo.title;
			editPriority = todo.priority;
			editDueDate = todo.dueDate ?? '';
			editListId = todo.listId;
			editNotes = todo.notes;
		}
	});

	const open = $derived(todo !== null);

	function handleSave() {
		if (!todo) return;
		dataStore.updateTodo(todo.id, {
			title: editTitle,
			priority: editPriority,
			dueDate: editDueDate || null,
			listId: editListId,
			notes: editNotes
		});
		todo = null;
	}
</script>

<Dialog {open} onOpenChange={(v) => { if (!v) todo = null; }}>
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
					{#each dataStore.lists as list}
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
			<Button variant="outline" onclick={() => (todo = null)}>Cancel</Button>
			<Button onclick={handleSave} disabled={!editTitle.trim()}>Save changes</Button>
		</DialogFooter>
	</DialogContent>
</Dialog>
