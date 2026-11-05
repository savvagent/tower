<script lang="ts">
  /**
   * Mounts the repos page inside an org context, for `page.render.test.ts`.
   *
   * The page reads its org through `useOrg()`, which throws outside the org
   * layout on purpose — so a test that mounts the page directly is testing a
   * routing mistake. This is the smallest thing that is not one.
   */
  import { OrgContext, provideOrg } from '#lib/org.svelte.ts';
  import type { Role } from '#lib/types.ts';
  import Page from './+page.svelte';

  let { slug, role }: { slug: string; role?: Role } = $props();

  const org = new OrgContext(() => slug);
  // The org layout fills this in from the session; an admin sees the register form.
  // svelte-ignore state_referenced_locally
  org.role = role;
  provideOrg(org);
</script>

<Page />
