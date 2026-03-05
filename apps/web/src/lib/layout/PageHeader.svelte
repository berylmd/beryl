<script lang="ts">
  import { SidebarTrigger } from '$lib/components/ui/sidebar/index.js';
  import { Separator } from '$lib/components/ui/separator/index.js';
  import { Button } from '$lib/components/ui/button/index.js';
  import { themeStore } from '$lib/theme/store.svelte.js';
  import SunIcon from '@lucide/svelte/icons/sun';
  import MoonIcon from '@lucide/svelte/icons/moon';

  let { title, subtitle = '' }: { title: string; subtitle?: string } = $props();
</script>

<header
  class="sticky top-0 z-10 shrink-0 border-b bg-background/95 backdrop-blur-sm"
  style="padding-top: var(--safe-top)"
>
  <div class="flex h-14 items-center gap-2 px-4">
    <SidebarTrigger class="-ml-1" />
    <Separator orientation="vertical" class="h-4" />
    <div class="flex flex-1 items-baseline gap-2">
      <h1 class="text-base font-semibold">{title}</h1>
      <span class="text-xs text-muted-foreground">{subtitle}</span>
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
