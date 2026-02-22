<script lang="ts">
	import { todosStore } from '$lib/todos.svelte.js';
	import { cn } from '$lib/utils.js';
	import {
		Sidebar,
		SidebarContent,
		SidebarFooter,
		SidebarGroup,
		SidebarGroupContent,
		SidebarGroupLabel,
		SidebarHeader,
		SidebarMenu,
		SidebarMenuBadge,
		SidebarMenuButton,
		SidebarMenuItem,
		SidebarSeparator
	} from '$lib/components/ui/sidebar/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import CheckSquare2Icon from '@lucide/svelte/icons/check-square-2';
	import InboxIcon from '@lucide/svelte/icons/inbox';
	import CalendarIcon from '@lucide/svelte/icons/calendar';
	import CalendarDaysIcon from '@lucide/svelte/icons/calendar-days';
	import CheckCircle2Icon from '@lucide/svelte/icons/check-circle-2';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import CircleIcon from '@lucide/svelte/icons/circle';
	import SettingsIcon from '@lucide/svelte/icons/settings';
	import Trash2Icon from '@lucide/svelte/icons/trash-2';

	let newListName = $state('');
	let showNewList = $state(false);
	let hoveringListId = $state<string | null>(null);

	const filters = [
		{ id: 'all' as const, label: 'Inbox', icon: InboxIcon },
		{ id: 'today' as const, label: 'Today', icon: CalendarIcon },
		{ id: 'upcoming' as const, label: 'Upcoming', icon: CalendarDaysIcon },
		{ id: 'completed' as const, label: 'Completed', icon: CheckCircle2Icon }
	];

	const listColorClasses: Record<string, string> = {
		blue: 'text-blue-500 fill-blue-500',
		purple: 'text-purple-500 fill-purple-500',
		green: 'text-green-500 fill-green-500',
		red: 'text-red-500 fill-red-500',
		orange: 'text-orange-500 fill-orange-500',
		pink: 'text-pink-500 fill-pink-500',
		slate: 'text-slate-500 fill-slate-500'
	};

	function handleAddList(e: SubmitEvent) {
		e.preventDefault();
		if (newListName.trim()) {
			const colors = ['blue', 'purple', 'green', 'red', 'orange', 'pink'];
			const color = colors[todosStore.lists.length % colors.length];
			todosStore.addList(newListName.trim(), color);
			newListName = '';
			showNewList = false;
		}
	}
</script>

<Sidebar>
	<SidebarHeader>
		<div class="flex items-center gap-2 px-2 py-3">
			<div class="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
				<CheckSquare2Icon class="size-4" />
			</div>
			<div class="flex flex-col leading-none">
				<span class="text-sm font-semibold">Beryl Tasks</span>
				<span class="text-xs text-muted-foreground">Stay organized</span>
			</div>
		</div>
	</SidebarHeader>

	<SidebarContent>
		<!-- Navigation filters -->
		<SidebarGroup>
			<SidebarMenu>
				{#each filters as filter}
					{@const count = todosStore.counts[filter.id]}
					<SidebarMenuItem>
						<SidebarMenuButton
							isActive={todosStore.activeFilter === filter.id && !todosStore.activeListId}
							onclick={() => {
								todosStore.activeFilter = filter.id;
							}}
						>
							<filter.icon />
							<span>{filter.label}</span>
						</SidebarMenuButton>
						{#if count > 0}
							<SidebarMenuBadge>{count}</SidebarMenuBadge>
						{/if}
					</SidebarMenuItem>
				{/each}
			</SidebarMenu>
		</SidebarGroup>

		<SidebarSeparator />

		<!-- Lists -->
		<SidebarGroup>
			<SidebarGroupLabel>
				<span>My Lists</span>
				<Button
					variant="ghost"
					size="icon"
					class="ml-auto size-5 text-muted-foreground hover:text-foreground"
					onclick={() => (showNewList = !showNewList)}
				>
					<PlusIcon class="size-3.5" />
				</Button>
			</SidebarGroupLabel>
			<SidebarGroupContent>
				{#if showNewList}
					<form class="px-2 py-1" onsubmit={handleAddList}>
						<input
							class="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm outline-none placeholder:text-muted-foreground focus:ring-1 focus:ring-ring"
							placeholder="List name..."
							bind:value={newListName}
							autofocus
							onblur={() => {
								if (!newListName.trim()) showNewList = false;
							}}
							onkeydown={(e) => {
								if (e.key === 'Escape') {
									showNewList = false;
									newListName = '';
								}
							}}
						/>
					</form>
				{/if}
				<SidebarMenu>
					{#each todosStore.lists as list (list.id)}
						{@const count = todosStore.todos.filter(
							(t) => t.listId === list.id && !t.completed
						).length}
						<SidebarMenuItem
							onmouseenter={() => (hoveringListId = list.id)}
							onmouseleave={() => (hoveringListId = null)}
						>
							<SidebarMenuButton
								isActive={todosStore.activeListId === list.id}
								onclick={() => todosStore.setActiveList(list.id)}
								class="group/list"
							>
								<CircleIcon
									class={cn('size-2.5', listColorClasses[list.color] ?? listColorClasses.slate)}
								/>
								<span class="flex-1 truncate">{list.name}</span>
							</SidebarMenuButton>
							{#if hoveringListId === list.id}
								<button
									class="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover/item:opacity-100"
									onclick={(e) => {
										e.stopPropagation();
										todosStore.deleteList(list.id);
									}}
									aria-label="Delete list"
								>
									<Trash2Icon class="size-3.5" />
								</button>
							{/if}
							{#if count > 0 && hoveringListId !== list.id}
								<SidebarMenuBadge>{count}</SidebarMenuBadge>
							{/if}
						</SidebarMenuItem>
					{/each}
				</SidebarMenu>
			</SidebarGroupContent>
		</SidebarGroup>
	</SidebarContent>

	<SidebarFooter>
		<SidebarMenu>
			<SidebarMenuItem>
				<SidebarMenuButton class="text-muted-foreground">
					<SettingsIcon />
					<span>Settings</span>
				</SidebarMenuButton>
			</SidebarMenuItem>
		</SidebarMenu>
	</SidebarFooter>
</Sidebar>
