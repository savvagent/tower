<script lang="ts">
  import { statusLabel } from '#lib/labels.ts';
  import type { JobStatus } from '#lib/types.ts';

  /**
   * Colour *and* the word, never colour alone. A queue read by someone with a
   * colour vision deficiency has to say "failed", not merely be red — and now
   * has to say it in their language, which is why the label is looked up rather
   * than being the enum value printed raw.
   */
  interface Props {
    status: JobStatus;
  }

  let { status }: Props = $props();

  const tones: Record<JobStatus, string> = {
    pending: 'border-border bg-muted text-muted-foreground',
    'in-progress': 'border-warning/50 bg-warning/10 text-warning',
    active: 'border-primary/50 bg-primary/10 text-primary',
    completed: 'border-success/50 bg-success/10 text-success',
    failed: 'border-destructive/50 bg-destructive/10 text-destructive',
    cancelled: 'border-border bg-muted text-muted-foreground'
  };
</script>

<span
  class="inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap {tones[
    status
  ]}"
>
  {statusLabel(status)}
</span>
