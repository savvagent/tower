<script lang="ts">
  /**
   * Mounts the root layout around a stand-in page, for `layout.render.test.ts`.
   * The layout renders its page through a `children` snippet, which a test can
   * only supply from a component.
   */
  import Layout from './+layout.svelte';
</script>

<Layout><p data-testid="child">page</p></Layout>
