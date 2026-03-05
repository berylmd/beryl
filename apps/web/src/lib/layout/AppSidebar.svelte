<script lang="ts">
  import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarGroup,
    SidebarGroupContent,
    SidebarGroupLabel,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
  } from '$lib/components/ui/sidebar/index.js';
  import { Button } from '$lib/components/ui/button/index.js';
  import CheckSquare2Icon from '@lucide/svelte/icons/check-square-2';
  import PlusIcon from '@lucide/svelte/icons/plus';
  import SettingsIcon from '@lucide/svelte/icons/settings';

  import { dataStore } from '$lib/tasks/store.svelte.js';

  let newListName = $state('');
  let showNewList = $state(false);

  function handleAddList(e: SubmitEvent) {
    e.preventDefault();
    if (newListName.trim()) {
      dataStore.addList(newListName.trim());
      newListName = '';
      showNewList = false;
    }
  }
</script>

<Sidebar>
  <SidebarHeader>
    <div
      class="flex items-center gap-2 px-2 pb-3"
      style="padding-top: calc(var(--safe-top) + 0.75rem)"
    >
      <div
        class="
          flex size-8 items-center justify-center rounded-lg bg-primary
          text-primary-foreground
        "
      >
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
    <!-- <SidebarGroup>
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

		<SidebarSeparator /> -->

    <!-- Lists -->
    <SidebarGroup>
      <SidebarGroupLabel>
        <span>Projects</span>
        <Button
          variant="ghost"
          size="icon"
          class="
            ml-auto size-5 text-muted-foreground
            hover:text-foreground
          "
          onclick={() => (showNewList = !showNewList)}
        >
          <PlusIcon class="size-3.5" />
        </Button>
      </SidebarGroupLabel>
      <SidebarGroupContent>
        {#if showNewList}
          <form class="px-2 py-1" onsubmit={handleAddList}>
            <input
              class="
                w-full rounded-md border border-input bg-background px-2 py-1.5
                text-sm outline-none
                placeholder:text-muted-foreground
                focus:ring-1 focus:ring-ring
              "
              placeholder="List name..."
              bind:value={newListName}
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
          {#each dataStore.lists as list (list.id)}
            <SidebarMenuItem>
              <SidebarMenuButton
                isActive={dataStore.activeListId === list.id}
                onclick={() => dataStore.setActiveList(list.id)}
                class="group/list"
              >
                <span class="flex-1 truncate">{list.id}</span>
              </SidebarMenuButton>
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
