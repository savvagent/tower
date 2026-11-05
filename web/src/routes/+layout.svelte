<script lang="ts">
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import { ConsoleFooter, ConsoleHeader, type ConsoleOrg } from '@savvagent/console-ui';
  import { Alert } from '@savvagent/console-ui/ui/alert';
  import { buttonVariants } from '@savvagent/console-ui/ui/button';
  import * as DropdownMenu from '@savvagent/console-ui/ui/dropdown-menu';
  import type { Snippet } from 'svelte';

  import '../app.css';
  import { api } from '#lib/api.ts';
  import { toConsoleSession } from '#lib/console-session.ts';
  import { messageFor } from '#lib/errors.ts';
  import { m } from '#lib/paraglide/messages.js';
  import { bootLocale } from '#lib/locale.ts';
  import { orgOf, signIn } from '#lib/login.ts';
  import {
    platformHome,
    platformLink,
    shellPlatformUrl,
    type PlatformPage
  } from '#lib/platform.ts';
  import { PlatformHome } from '#lib/platform-home.svelte.ts';
  import { session } from '#lib/session.svelte.ts';
  import { followColorScheme } from '#lib/theme.ts';
  import { APP_VERSION } from '#lib/version.ts';
  import Loading from '#lib/components/Loading.svelte';

  /**
   * Decide the language before anything renders.
   *
   * Top-level in this script rather than in `+layout.ts`, because `ssr = false`
   * makes this file browser-only while a universal load module is also
   * evaluated by the static build — where `document` and `localStorage` do not
   * exist. It runs once, synchronously, ahead of the first paint, so no page
   * ever renders English and then snaps to Spanish.
   */
  bootLocale();

  /**
   * Light or dark, before the first paint, for the same reason as the locale.
   * The root layout lives as long as the document, so the listener is never
   * removed.
   */
  followColorScheme(document.documentElement, matchMedia('(prefers-color-scheme: dark)'));

  let { children }: { children: Snippet } = $props();

  /** A failure resolving the session that is *not* "signed out". */
  let fatal = $state<string | undefined>(undefined);
  let signingOut = $state(false);
  /** Sign-in was just tried and the session still did not appear. */
  let signInStuck = $state(false);

  /**
   * Pages that skip the sign-in guard.
   *
   * `/docs/api` mirrors an `Auth::Public` server endpoint that has nothing to do
   * with session state, so a visitor following the footer link lands on it
   * whether or not they are signed in.
   *
   * `/` is the front page: a signed-out visitor has to be able to read it (and
   * see a "Sign in" button, and a `login_error` if a sign-in just failed). A
   * signed-in visitor is moved along by `+page.svelte`'s own effect.
   */
  const UNGATED = ['/docs/api', '/'];

  const isUngated = $derived(UNGATED.some((p) => page.url.pathname === p));

  $effect(() => {
    void resolve();
  });

  async function resolve() {
    if (session.ready) return;
    try {
      await session.refresh();
    } catch (error) {
      fatal = messageFor(error, m.error_session_resolve_failed());
    }
  }

  /**
   * The sign-in guard, in one place.
   *
   * Written as an effect over `session.ready` and the current path rather than
   * as a check in each page: a page that forgets is a page that renders a
   * skeleton to a signed-out visitor and then flashes it away.
   *
   * Sign-in is **a full navigation** to `/auth/login` — a server route that
   * answers a redirect to the Savvagent platform — and it brings the visitor back to
   * this same URL afterwards.
   *
   * `signingOut` suppresses the guard for the moment between clearing the
   * session and arriving at `/`. Without it the guard fires first, from whatever
   * org page the button was pressed on, and sends someone who deliberately signed
   * out straight back into sign-in.
   */
  $effect(() => {
    if (isUngated || !session.ready || fatal || signingOut || session.signedIn) return;
    const { pathname, search } = page.url;
    if (!signIn(orgOf(pathname), pathname + search)) signInStuck = true;
  });

  async function signOut() {
    // Both the shared account menu and the fallback header call this; one sign-out at a time.
    if (signingOut) return;
    signingOut = true;
    try {
      await api.logout();
    } catch {
      // Cleared locally regardless. The server treats an unknown cookie as
      // already gone, so the only way to reach here with a live session is a
      // network error — and leaving the console looking signed in after someone
      // pressed "sign out" is the worse of the two wrong answers.
    } finally {
      session.clear();
      await goto('/', { replace: true });
      signingOut = false;
    }
  }

  /**
   * Where the platform is, for every link back to it: the shared header's
   * "Savvagent" home link, its account and org menus, the footer, and the
   * Manage menu.
   *
   * A signed-in session already says (`ConsoleSession.platformUrl`). A visitor
   * without one — signed out, or whose session lookup failed — asks the open
   * discovery document instead, once. Both come from the server at runtime.
   * `shellPlatformUrl` refuses anything the shared shell would throw on, and
   * neither answer usable means the plain header and footer below: no link,
   * never a guessed address.
   */
  const home = new PlatformHome();
  const platformBase = $derived(platformHome(session.platformUrl));

  $effect(() => {
    home.observe(platformBase, session.ready);
  });

  const platformUrl = $derived(shellPlatformUrl(home.url(platformBase)));

  /** The session in the shell's shape, carrying the address that was checked. */
  const consoleSession = $derived(
    session.info && platformUrl ? toConsoleSession({ ...session.info, platformUrl }) : undefined
  );

  /**
   * The org switcher stays inside this console. A session has exactly one org,
   * so this is the current one; anything else would go through the org layout's
   * sign-in for that org.
   */
  const orgHref = (org: ConsoleOrg) => `/o/${encodeURIComponent(org.slug)}`;

  /**
   * The org-scoped pages the platform's console manages. Identity is the
   * platform's: this console links there rather than copying it. The account
   * page and switching org are the shared header's account menu and org
   * switcher.
   */
  const platformPages: { page: PlatformPage; label: () => string }[] = [
    { page: 'members', label: () => m.nav_platform_members() },
    { page: 'teams', label: () => m.nav_platform_teams() },
    { page: 'sso', label: () => m.nav_platform_sso() },
    { page: 'usage', label: () => m.nav_platform_usage() }
  ];

  /**
   * The version is a link only because the shared footer renders links; the API
   * reference is the closest thing to release notes a customer can open.
   */
  const footerLinks = [
    { label: m.nav_api_reference(), href: '/docs/api' },
    { label: `v${APP_VERSION}`, href: '/docs/api' }
  ];
</script>

<!--
  Sign in is a full navigation to a server route that redirects to another
  origin, so it is never a client-side `goto`.
-->
{#snippet signInLink()}
  <a
    href="/auth/login"
    data-sveltekit-reload
    class={buttonVariants({ variant: 'outline', size: 'sm' })}
  >
    {m.nav_sign_in()}
  </a>
{/snippet}

{#snippet manage()}
  {#if session.info && platformUrl}
    <DropdownMenu.Root>
      <DropdownMenu.Trigger class={buttonVariants({ variant: 'ghost', size: 'sm' })}>
        {m.nav_manage()}
      </DropdownMenu.Trigger>
      <DropdownMenu.Content align="start" class="min-w-48">
        {#each platformPages as item (item.page)}
          <DropdownMenu.Item>
            {#snippet child({ props })}
              <a {...props} href={platformLink(platformUrl, item.page, session.info!.org.slug)}>
                {item.label()}
              </a>
            {/snippet}
          </DropdownMenu.Item>
        {/each}
      </DropdownMenu.Content>
    </DropdownMenu.Root>
  {/if}
{/snippet}

<div class="flex min-h-full flex-col">
  {#if consoleSession}
    <ConsoleHeader
      session={consoleSession}
      service="tower"
      onSignOut={signOut}
      {orgHref}
      nav={manage}
    />
  {:else if platformUrl && !session.info}
    <ConsoleHeader {platformUrl} service="tower">
      {#snippet signedOut()}
        <!-- Only once the answer is in: a signed-in visitor must not glimpse "Sign in". -->
        {#if session.ready}{@render signInLink()}{/if}
      {/snippet}
    </ConsoleHeader>
  {:else}
    <!--
      No usable platform address: the shared header cannot render without one,
      and a guessed address is never used. Same height and edge as the shared one.
    -->
    <header
      class="flex items-center gap-2 border-b bg-background px-2 py-2 text-foreground sm:px-4"
    >
      <a href="/" class="px-2 text-sm font-semibold">Savvagent Tower</a>
      <div class="flex-1"></div>
      {#if session.info}
        <button
          type="button"
          class={buttonVariants({ variant: 'outline', size: 'sm' })}
          onclick={signOut}
          disabled={signingOut}
        >
          {m.nav_sign_out()}
        </button>
      {:else if session.ready}
        {@render signInLink()}
      {/if}
    </header>
  {/if}

  <main class="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
    {#if isUngated}
      {@render children()}
    {:else if fatal}
      <Alert variant="destructive">
        <span>
          {fatal}
          <button class="ml-2 underline" onclick={() => location.reload()}
            >{m.nav_try_again()}</button
          >
        </span>
      </Alert>
    {:else if signInStuck}
      <Alert variant="destructive">
        <span>
          {m.nav_sign_in_stuck()}
          <a class="ml-2 underline" href="/auth/login" data-sveltekit-reload>{m.nav_sign_in()}</a>
        </span>
      </Alert>
    {:else if !session.ready || !session.signedIn}
      <Loading what={m.nav_checking_session()} />
    {:else}
      {@render children()}
    {/if}
  </main>

  {#if platformUrl}
    <ConsoleFooter {platformUrl} links={footerLinks} />
  {:else}
    <footer
      class="flex flex-wrap items-center gap-x-4 gap-y-1 border-t px-4 py-3 text-sm text-muted-foreground"
    >
      {#each footerLinks as link (link.label)}
        <a href={link.href} class="hover:text-foreground">{link.label}</a>
      {/each}
    </footer>
  {/if}
</div>
