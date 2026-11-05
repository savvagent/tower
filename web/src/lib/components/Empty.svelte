<script lang="ts">
  import type { Snippet } from 'svelte';

  /**
   * The empty state.
   *
   * It always says what to do next. An empty table with no instruction is the
   * moment a new customer decides the product is broken rather than new.
   */
  interface Props {
    title: string;
    children?: Snippet;
  }

  let { title, children }: Props = $props();
</script>

<div class="border-edge/70 rounded-md border border-dashed px-4 py-8 text-center">
  <p class="text-sm text-muted">{title}</p>
  {#if children}
    <div class="text-faint mt-2 text-xs">{@render children()}</div>
  {/if}
</div>
