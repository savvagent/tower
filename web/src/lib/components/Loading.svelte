<script lang="ts">
  import { m } from '#lib/paraglide/messages.js';
  import Spinner from './Spinner.svelte';

  interface Props {
    /** What is being waited for. Callers pass a keyed message. */
    what?: string;
  }

  let { what = m.loading_default() }: Props = $props();
</script>

<div class="flex items-center gap-2 px-1 py-6 text-sm text-muted-foreground" role="status">
  <Spinner />
  {what}…
</div>
