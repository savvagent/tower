<script lang="ts">
  import { api } from '#lib/api.ts';
  import { messageFor } from '#lib/errors.ts';
  import { m } from '#lib/paraglide/messages.js';
  import { LINK, around } from '#lib/labels.ts';
  import { useOrg } from '#lib/org.svelte.ts';
  import { relative } from '#lib/format.ts';
  import { beginConnect } from '#lib/trackerState.ts';
  import type {
    ProviderSetup,
    TrackerConnection,
    TrackerConnections,
    TrackerProvider
  } from '#lib/types.ts';
  import { Alert } from '@savvagent/console-ui/ui/alert';
  import { Button } from '@savvagent/console-ui/ui/button';
  import { Card, CardContent, CardHeader, CardTitle } from '@savvagent/console-ui/ui/card';
  import Loading from '#lib/components/Loading.svelte';
  import Spinner from '#lib/components/Spinner.svelte';

  /**
   * Connecting a tracker to this org.
   *
   * Nothing about either provider is baked into this bundle. The install and
   * consent URLs come from the server, which builds them from the App slug and
   * OAuth client id *this* deployment was configured with — a hard-coded slug
   * is how a staging console sends an admin to install the production App.
   *
   * `configured` is likewise the server's answer, not a guess: a Connect button
   * on a deployment with no OAuth client would walk an admin through installing
   * an App they then have to uninstall by hand.
   */

  const org = useOrg();

  let data = $state<TrackerConnections | undefined>(undefined);
  let loading = $state(true);
  let error = $state<string | undefined>(undefined);
  let busy = $state<TrackerProvider | undefined>(undefined);

  let latest = 0;

  $effect(() => {
    const org_ = org.slug;
    if (!org_ || !org.isAdmin) return;

    const seq = ++latest;
    loading = true;
    error = undefined;

    void (async () => {
      try {
        const loaded = await api.trackerConnections(org_);
        if (seq !== latest) return;
        data = loaded;
      } catch (e) {
        if (seq !== latest) return;
        error = messageFor(e, m.trackers_error_load());
      } finally {
        if (seq === latest) loading = false;
      }
    })();
  });

  const connections = $derived(data?.connections ?? []);
  const connectionFor = $derived((provider: TrackerProvider): TrackerConnection | undefined =>
    connections.find((c) => c.provider === provider)
  );

  function connect(provider: TrackerProvider, setup: ProviderSetup) {
    if (!setup.startUrl) return;
    // The nonce is stored before we navigate, never after: a redirect that
    // beat the write would come back to a check with nothing to check against.
    const state = beginConnect(org.slug, provider);
    const url = new URL(setup.startUrl);
    url.searchParams.set('state', state);
    window.location.href = url.toString();
  }

  async function disconnect(provider: TrackerProvider) {
    busy = provider;
    error = undefined;
    try {
      await api.disconnectTracker(org.slug, provider);
      data = await api.trackerConnections(org.slug);
    } catch (e) {
      error = messageFor(e, m.trackers_error_disconnect());
    } finally {
      busy = undefined;
    }
  }

  // `identifies` names what the provider calls the thing it connected — an
  // Installation on GitHub, a Site on Atlassian — so it is prose, while the
  // provider names beside it are not.
  const providers: { provider: TrackerProvider; name: string; identifies: string }[] = [
    { provider: 'github', name: 'GitHub', identifies: m.trackers_identifies_github() },
    { provider: 'jira', name: 'JIRA', identifies: m.trackers_identifies_jira() }
  ];

  const subtitle = $derived(around(m.trackers_subtitle({ link: LINK })));
</script>

<div class="space-y-5">
  <div>
    <h1 class="text-lg font-semibold">{m.trackers_title()}</h1>
    <p class="mt-0.5 text-sm text-muted-foreground">
      {subtitle[0]}<a class="underline hover:text-foreground" href="/o/{org.slug}/repos"
        >{m.trackers_repos_link()}</a
      >{subtitle[1]}
    </p>
  </div>

  {#if !org.isAdmin}
    <Alert variant="destructive">{m.trackers_admin_only()}</Alert>
  {:else if error}
    <Alert variant="destructive">{error}</Alert>
  {/if}

  {#if org.isAdmin}
    {#if loading && !data}
      <Loading what={m.trackers_loading()} />
    {:else if data}
      {#each providers as { provider, name, identifies } (provider)}
        {@const setup = data[provider]}
        {@const connection = connectionFor(provider)}
        <Card>
          <CardHeader class="border-b">
            <CardTitle level={2}>{name}</CardTitle>
          </CardHeader>
          <CardContent>
            {#if connection}
              <div class="flex flex-wrap items-center gap-3">
                <div class="min-w-0 flex-1">
                  <p class="text-sm text-foreground">
                    {identifies}
                    <code class="of-mono">{connection.externalId}</code>
                  </p>
                  <p class="mt-0.5 text-xs text-muted-foreground">
                    {connection.hasCredentials
                      ? m.trackers_connected_with_credentials({
                          when: relative(connection.createdAt)
                        })
                      : m.trackers_connected({ when: relative(connection.createdAt) })}
                  </p>
                </div>
                <Button
                  variant="outline"
                  disabled={busy === provider}
                  aria-busy={busy === provider}
                  onclick={() => disconnect(provider)}
                >
                  {#if busy === provider}<Spinner />{/if}
                  {m.trackers_disconnect()}
                </Button>
              </div>
              <p class="mt-3 text-xs text-muted-foreground">
                {m.trackers_disconnect_note({ provider: name })}
              </p>
            {:else if setup.configured}
              <p class="text-sm text-muted-foreground">
                {provider === 'github'
                  ? m.trackers_not_connected_github()
                  : m.trackers_not_connected_jira()}
              </p>
              <div class="mt-3">
                <Button onclick={() => connect(provider, setup)}>
                  {m.trackers_connect_button({ provider: name })}
                </Button>
              </div>
            {:else}
              <p class="text-sm text-muted-foreground">
                {m.trackers_not_configured({
                  provider: name,
                  credentials: provider === 'github' ? 'GitHub App' : 'Atlassian OAuth'
                })}
              </p>
            {/if}
          </CardContent>
        </Card>
      {/each}
    {/if}
  {/if}
</div>
