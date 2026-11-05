<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    title?: string;
    description?: string;
    actions?: Snippet;
    children: Snippet;
  }

  let { title, description, actions, children }: Props = $props();
</script>

<section class="of-card">
  {#if title || actions}
    <header class="border-edge/60 flex items-start justify-between gap-4 border-b px-4 py-3">
      <div>
        {#if title}<h2 class="text-ink text-sm font-semibold">{title}</h2>{/if}
        {#if description}<p class="text-faint mt-0.5 text-xs">{description}</p>{/if}
      </div>
      {#if actions}<div class="flex shrink-0 gap-2">{@render actions()}</div>{/if}
    </header>
  {/if}
  <div class="px-4 py-3">
    {@render children()}
  </div>
</section>
