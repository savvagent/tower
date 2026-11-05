<script lang="ts">
  /**
   * The ring that says "working": in `Loading`, and inside a button whose request
   * is in flight. Decoration only — the text beside it (or the button's disabled
   * state) is what a screen reader gets.
   */
  let { class: className = '' }: { class?: string } = $props();
</script>

<span
  class="size-3.5 animate-spin rounded-full border-2 border-current border-t-transparent {className}"
  aria-hidden="true"
></span>
