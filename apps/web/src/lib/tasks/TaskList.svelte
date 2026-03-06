<script lang="ts">
  import type { Todo } from './types.js';
  import TaskItem from './TaskItem.svelte';
  import ClipboardListIcon from '@lucide/svelte/icons/clipboard-list';

  let { todos, onedit }: { todos: Todo[]; onedit: (id: string) => void } = $props();
</script>

<div class="flex flex-col gap-1.5">
  {#if todos.length === 0}
    <div class="flex flex-col items-center justify-center py-24 text-center">
      <div
        class="
        mb-4 flex size-16 items-center justify-center rounded-full bg-muted
      "
      >
        <ClipboardListIcon class="size-8 text-muted-foreground/60" />
      </div>
      <p class="text-sm font-medium text-muted-foreground">Nothing here</p>
      <p class="mt-1 text-xs text-muted-foreground/70">Add a task above to get started.</p>
    </div>
  {/if}

  {#each todos as todo (todo.id)}
    <TaskItem {todo} {onedit} />
  {/each}
</div>
