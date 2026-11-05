<script lang="ts">
  import { api } from '#lib/api.ts';
  import { messageFor } from '#lib/errors.ts';
  import { m } from '#lib/paraglide/messages.js';
  import { LINK, around } from '#lib/labels.ts';
  import { useOrg } from '#lib/org.svelte.ts';
  import { relative, slugPreview } from '#lib/format.ts';
  import type { Lease, Repo, RepoListItem, TrackerBinding, TrackerProvider } from '#lib/types.ts';
  import { Alert } from '@savvagent/console-ui/ui/alert';
  import { Button } from '@savvagent/console-ui/ui/button';
  import { Card, CardContent, CardHeader, CardTitle } from '@savvagent/console-ui/ui/card';
  import Empty from '#lib/components/Empty.svelte';
  import { Field, FieldDescription, FieldGroup, FieldLabel } from '@savvagent/console-ui/ui/field';
  import { Input } from '@savvagent/console-ui/ui/input';
  import { Textarea } from '@savvagent/console-ui/ui/textarea';
  import Spinner from '#lib/components/Spinner.svelte';
  import Loading from '#lib/components/Loading.svelte';

  /**
   * Repos, and who is holding a lease on one right now.
   *
   * The leases are the reason this page is worth opening. A lease is advisory —
   * the server cannot see what an agent does with the resource and cannot stop
   * it — so its whole value is being *visible*: "why is my agent waiting?" is
   * answered by a name and a resource, not by a lock.
   *
   * Leases are loaded per repo and only when a row is expanded. Fetching every
   * repo's leases up front would be one request per repo on every page load, to
   * render something nobody had asked to see. The tracker bindings in the same
   * expander are loaded the same way and for the same reason.
   *
   * A binding lives here rather than on a page of its own because it is a fact
   * about one repo: which project its tickets come from, and what label on an
   * issue there means "queue this". The connection those bindings hang off is
   * per-org and lives on the Trackers page.
   */

  const org = useOrg();
  /** Unique per instance, for the register form's label and hint ids. */
  const formId = $props.id();

  let repos = $state<RepoListItem[]>([]);
  let includeInactive = $state(false);
  let loading = $state(true);
  let error = $state<string | undefined>(undefined);

  let expanded = $state<string | undefined>(undefined);
  // One boolean, not keyed per repo — correct only because `expanded` already
  // allows a single row open at a time. `toggle()` resets this on every call,
  // so it can never survive a switch to a different row's panel.
  let infoOpen = $state(false);
  let leases = $state<Record<string, Lease[] | 'loading' | 'failed'>>({});
  let bindings = $state<Record<string, TrackerBinding[] | 'loading' | 'failed'>>({});

  // Keyed by `${repo}:${provider}` so two providers on one repo edit
  // independently and a third repo's draft never lands in this one's field.
  let refDraft = $state<Record<string, string>>({});
  let labelDraft = $state<Record<string, string>>({});
  let bindingBusy = $state<string | undefined>(undefined);
  let bindingError = $state<Record<string, string | undefined>>({});

  // `owner/repo` is git's own spelling rather than prose — a translated one is
  // a placeholder nobody can act on. The JIRA hint names a concept, and is.
  const PROVIDERS: { provider: TrackerProvider; name: string; hint: string }[] = [
    { provider: 'github', name: 'GitHub', hint: 'owner/repo' },
    { provider: 'jira', name: 'JIRA', hint: m.repos_binding_hint_jira() }
  ];

  let showForm = $state(false);
  let slug = $state('');
  let name = $state('');
  let remotes = $state('');
  let creating = $state(false);
  let formError = $state<string | undefined>(undefined);

  // Not $state: it identifies a request and is never rendered.
  let latest = 0;

  $effect(() => {
    const org_ = org.slug;
    const withInactive = includeInactive;
    if (!org_) return;

    // Sequence rather than an org comparison, because the include-inactive
    // toggle is a dependency too: flipped twice quickly, the first response can
    // land after the second and show the list the toggle no longer asks for.
    const seq = ++latest;

    loading = true;
    error = undefined;

    void (async () => {
      try {
        const r = await api.repos(org_, withInactive, true);
        if (seq !== latest) return;
        repos = r;
      } catch (e) {
        if (seq !== latest) return;
        error = messageFor(e, m.repos_error_load());
      } finally {
        if (seq === latest) loading = false;
      }
    })();
  });

  async function toggle(repo: Repo) {
    infoOpen = false;
    if (expanded === repo.slug) {
      expanded = undefined;
      return;
    }
    expanded = repo.slug;
    void loadLeases(repo.slug);
    void loadBindings(repo.slug);
  }

  async function loadLeases(slug_: string) {
    if (leases[slug_] && leases[slug_] !== 'failed') return;
    leases = { ...leases, [slug_]: 'loading' };
    try {
      const found = await api.leases(org.slug, slug_);
      leases = { ...leases, [slug_]: found };
    } catch {
      leases = { ...leases, [slug_]: 'failed' };
    }
  }

  async function loadBindings(slug_: string) {
    if (bindings[slug_] && bindings[slug_] !== 'failed') return;
    bindings = { ...bindings, [slug_]: 'loading' };
    try {
      const found = await api.trackerBindings(org.slug, slug_);
      bindings = { ...bindings, [slug_]: found };
      // Seed the drafts from what is stored, so the field an admin edits shows
      // what is live rather than an empty box beside a bound repo.
      for (const binding of found) {
        const key = `${slug_}:${binding.provider}`;
        refDraft[key] = binding.externalRef;
        labelDraft[key] = binding.triggerLabel;
      }
    } catch {
      bindings = { ...bindings, [slug_]: 'failed' };
    }
  }

  function bindingFor(slug_: string, provider: TrackerProvider): TrackerBinding | undefined {
    const found = bindings[slug_];
    return Array.isArray(found) ? found.find((b) => b.provider === provider) : undefined;
  }

  /**
   * Re-read after a write rather than patching the local array.
   *
   * The server decides two of the fields shown here — the default trigger
   * label, and whether the binding is `live` — so a locally patched row would
   * show what was typed instead of what was stored.
   */
  async function reloadBindings(slug_: string) {
    bindings = { ...bindings, [slug_]: 'failed' };
    await loadBindings(slug_);
  }

  async function saveBinding(slug_: string, provider: TrackerProvider) {
    const key = `${slug_}:${provider}`;
    bindingBusy = key;
    bindingError = { ...bindingError, [key]: undefined };
    try {
      const label = (labelDraft[key] ?? '').trim();
      await api.bindRepo(org.slug, slug_, provider, {
        externalRef: (refDraft[key] ?? '').trim(),
        ...(label ? { triggerLabel: label } : {})
      });
      await reloadBindings(slug_);
    } catch (e) {
      bindingError = {
        ...bindingError,
        [key]: messageFor(e, m.repos_error_save_binding())
      };
    } finally {
      bindingBusy = undefined;
    }
  }

  async function removeBinding(slug_: string, provider: TrackerProvider) {
    const key = `${slug_}:${provider}`;
    bindingBusy = key;
    bindingError = { ...bindingError, [key]: undefined };
    try {
      await api.unbindRepo(org.slug, slug_, provider);
      refDraft[key] = '';
      labelDraft[key] = '';
      await reloadBindings(slug_);
    } catch (e) {
      bindingError = {
        ...bindingError,
        [key]: messageFor(e, m.repos_error_remove_binding())
      };
    } finally {
      bindingBusy = undefined;
    }
  }

  async function register(event: SubmitEvent) {
    event.preventDefault();
    creating = true;
    formError = undefined;
    try {
      // One remote per line. The server normalizes them, so the SSH and HTTPS
      // spellings of one repository collapse to a single row and either
      // resolves to it — which is why pasting all of them is the right advice.
      const parsed = remotes
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.length > 0);

      await api.registerRepo(org.slug, {
        slug: slugPreview(slug),
        name: name.trim() || null,
        remotes: parsed
      });

      slug = '';
      name = '';
      remotes = '';
      showForm = false;
      repos = await api.repos(org.slug, includeInactive, true);
    } catch (e) {
      formError = messageFor(e, m.repos_error_register());
    } finally {
      creating = false;
    }
  }

  async function setActive(repo: Repo, active: boolean) {
    try {
      await api.updateRepo(org.slug, repo.slug, { active });
      repos = await api.repos(org.slug, includeInactive, true);
    } catch (e) {
      error = messageFor(e, m.repos_error_update());
    }
  }

  // Teams are the platform's, and this console cannot list them, so a scoped repo
  // says it is scoped rather than naming a team it cannot look up.
  const teamName = $derived((id: string | null) =>
    id ? m.repos_team_scoped() : m.repos_team_org_wide()
  );
</script>

<div class="space-y-5">
  <div class="flex flex-wrap items-center justify-between gap-3">
    <div>
      <h1 class="text-lg font-semibold">{m.repos_title()}</h1>
      <p class="mt-0.5 text-sm text-muted-foreground">
        {m.repos_subtitle()}
      </p>
    </div>
    {#if org.isAdmin}
      <Button onclick={() => (showForm = !showForm)}>
        {showForm ? m.repos_cancel() : m.repos_register_button()}
      </Button>
    {/if}
  </div>

  {#if showForm}
    <Card>
      <CardHeader class="border-b">
        <CardTitle>{m.repos_form_title()}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onsubmit={register}>
          <FieldGroup>
            <div class="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel for="{formId}-slug">{m.repos_field_slug_label()}</FieldLabel>
                <Input
                  id="{formId}-slug"
                  class="of-mono"
                  required
                  aria-describedby="{formId}-slug-hint"
                  bind:value={slug}
                />
                <FieldDescription id="{formId}-slug-hint">
                  {m.repos_field_slug_hint()}
                </FieldDescription>
              </Field>
              <Field>
                <FieldLabel for="{formId}-name">{m.repos_field_name_label()}</FieldLabel>
                <Input id="{formId}-name" aria-describedby="{formId}-name-hint" bind:value={name} />
                <FieldDescription id="{formId}-name-hint">
                  {m.repos_field_name_hint()}
                </FieldDescription>
              </Field>
            </div>

            <Field>
              <FieldLabel for="{formId}-remotes">{m.repos_field_remotes_label()}</FieldLabel>
              <Textarea
                id="{formId}-remotes"
                class="of-mono h-24"
                aria-describedby="{formId}-remotes-hint"
                bind:value={remotes}
              />
              <FieldDescription id="{formId}-remotes-hint">
                {m.repos_field_remotes_hint()}
              </FieldDescription>
            </Field>

            {#if formError}<Alert variant="destructive">{formError}</Alert>{/if}

            <div>
              <Button type="submit" disabled={creating}>
                {#if creating}<Spinner />{/if}
                {m.repos_submit()}
              </Button>
            </div>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  {/if}

  <label class="flex items-center gap-2 text-xs text-muted-foreground">
    <input type="checkbox" bind:checked={includeInactive} />
    {m.repos_include_retired()}
  </label>

  {#if error}
    <Alert variant="destructive">{error}</Alert>
  {:else if loading && repos.length === 0}
    <Loading what={m.repos_loading()} />
  {:else if repos.length === 0}
    <Empty title={m.repos_empty_title()}>
      {#if org.isAdmin}
        {m.repos_empty_admin({ tool: 'register_repo' })}
      {:else}
        {m.repos_empty_member()}
      {/if}
    </Empty>
  {:else}
    <ul class="space-y-2">
      {#each repos as repo (repo.id)}
        <li class="rounded-xl bg-card text-card-foreground ring-1 ring-foreground/10">
          <div class="flex flex-wrap items-center gap-3 px-4 py-3">
            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-2">
                <span class="of-mono text-sm text-foreground">{repo.slug}</span>
                {#if !repo.active}
                  <span
                    class="rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground"
                  >
                    {m.repos_badge_retired()}
                  </span>
                {/if}
                {#if repo.hasActiveLease}
                  <span
                    class="rounded-full border border-warning/50 bg-warning/10 px-2 py-0.5 text-xs text-warning"
                  >
                    {m.repos_badge_in_use()}
                  </span>
                {/if}
              </div>
              <p class="mt-0.5 text-xs text-muted-foreground">
                {repo.name} · {repo.provider} · {repo.defaultBranch} · {teamName(repo.teamId)}
              </p>
            </div>

            <button
              class="text-xs text-muted-foreground underline hover:text-foreground"
              onclick={() => toggle(repo)}
              aria-expanded={expanded === repo.slug}
            >
              {expanded === repo.slug ? m.repos_hide_leases() : m.repos_show_leases()}
            </button>

            <a
              class="text-xs text-muted-foreground underline hover:text-foreground"
              href="/o/{org.slug}/queue?repo={encodeURIComponent(repo.slug)}"
            >
              {m.repos_queue_link()}
            </a>

            {#if org.isAdmin}
              <Button variant="outline" onclick={() => setActive(repo, !repo.active)}>
                {repo.active ? m.repos_retire() : m.repos_reinstate()}
              </Button>
            {/if}
          </div>

          {#if expanded === repo.slug}
            <div class="border-t border-border px-4 py-3">
              <div class="flex items-center gap-1.5">
                <h3 class="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  {m.repos_leases_heading()}
                </h3>
                <div class="relative">
                  <button
                    type="button"
                    class="flex h-4 w-4 items-center justify-center rounded-full border border-border text-[10px] text-muted-foreground hover:text-foreground"
                    aria-label={m.repos_leases_info_label()}
                    aria-expanded={infoOpen}
                    aria-controls={`repos-lease-info-${repo.slug}`}
                    onclick={() => (infoOpen = !infoOpen)}
                    onblur={() => (infoOpen = false)}
                    onkeydown={(e) => {
                      if (e.key === 'Escape') infoOpen = false;
                    }}
                  >
                    i
                  </button>
                  <div
                    id={`repos-lease-info-${repo.slug}`}
                    hidden={!infoOpen}
                    class="absolute z-10 mt-1 w-64 rounded-md border border-border bg-muted p-2 text-xs text-muted-foreground shadow-lg"
                  >
                    {m.repos_leases_info_detail()}
                  </div>
                </div>
              </div>
              <p class="mt-1 text-xs text-muted-foreground">{m.repos_leases_note()}</p>
              {#if leases[repo.slug] === 'loading'}
                <Loading what={m.repos_leases_loading()} />
              {:else if leases[repo.slug] === 'failed'}
                <Alert variant="destructive">{m.repos_leases_failed()}</Alert>
              {:else if (leases[repo.slug] as Lease[]).length === 0}
                <p class="text-xs text-muted-foreground">
                  {m.repos_no_leases({ repo: repo.slug })}
                </p>
              {:else}
                <ul class="space-y-1.5">
                  {#each leases[repo.slug] as Lease[] as lease (lease.id)}
                    <li class="flex flex-wrap items-baseline gap-x-3 text-sm">
                      <span class="of-mono text-foreground">{lease.resource}</span>
                      <span class="text-muted-foreground">
                        {lease.holderLabel ?? m.repos_lease_holder_unknown()}
                      </span>
                      {#if lease.jobId}
                        <a
                          class="of-mono text-xs text-muted-foreground underline hover:text-foreground"
                          href="/o/{org.slug}/queue/{lease.jobId}"
                        >
                          {lease.jobId}
                        </a>
                      {/if}
                      <span class="text-xs text-muted-foreground">
                        {m.repos_lease_expires({ when: relative(lease.expiresAt) })}
                      </span>
                    </li>
                  {/each}
                </ul>
              {/if}
            </div>

            <div class="border-t border-border px-4 py-3">
              <h3 class="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                {m.repos_trackers_heading()}
              </h3>

              {#if bindings[repo.slug] === 'loading'}
                <Loading what={m.repos_bindings_loading()} />
              {:else if bindings[repo.slug] === 'failed'}
                <Alert variant="destructive">{m.repos_bindings_failed()}</Alert>
              {:else}
                <ul class="mt-2 space-y-3">
                  {#each PROVIDERS as { provider, name, hint } (provider)}
                    {@const binding = bindingFor(repo.slug, provider)}
                    {@const key = `${repo.slug}:${provider}`}
                    <li>
                      <div class="flex flex-wrap items-end gap-2">
                        <span class="w-14 shrink-0 text-sm text-foreground">{name}</span>

                        {#if org.isAdmin}
                          <label class="min-w-0 flex-1">
                            <span class="sr-only">
                              {m.repos_binding_ref_label({ provider: name })}
                            </span>
                            <Input class="of-mono" placeholder={hint} bind:value={refDraft[key]} />
                          </label>
                          <label class="w-32 shrink-0">
                            <span class="sr-only">
                              {m.repos_binding_trigger_label({ provider: name })}
                            </span>
                            <Input
                              class="of-mono"
                              placeholder="otto-tower"
                              bind:value={labelDraft[key]}
                            />
                          </label>
                          <Button
                            disabled={bindingBusy === key}
                            onclick={() => saveBinding(repo.slug, provider)}
                          >
                            {#if bindingBusy === key}<Spinner />{/if}
                            {binding ? m.repos_binding_update() : m.repos_binding_bind()}
                          </Button>
                          {#if binding}
                            <Button
                              variant="outline"
                              disabled={bindingBusy === key}
                              onclick={() => removeBinding(repo.slug, provider)}
                            >
                              {#if bindingBusy === key}<Spinner />{/if}
                              {m.repos_binding_remove()}
                            </Button>
                          {/if}
                        {:else if binding}
                          <span class="of-mono text-sm text-muted-foreground"
                            >{binding.externalRef}</span
                          >
                          <span class="text-xs text-muted-foreground">
                            {m.repos_binding_trigger_display({ label: binding.triggerLabel })}
                          </span>
                        {:else}
                          <span class="text-xs text-muted-foreground"
                            >{m.repos_binding_unbound()}</span
                          >
                        {/if}
                      </div>

                      {#if binding && !binding.live}
                        {@const parts = around(
                          m.repos_binding_inactive({ provider: name, link: LINK })
                        )}
                        <p class="mt-1 text-xs text-muted-foreground">
                          {parts[0]}<a
                            class="underline hover:text-foreground"
                            href="/o/{org.slug}/trackers">{m.repos_trackers_heading()}</a
                          >{parts[1]}
                        </p>
                      {/if}
                      {#if bindingError[key]}
                        <p class="mt-1 text-xs text-rose-400">{bindingError[key]}</p>
                      {/if}
                    </li>
                  {/each}
                </ul>

                <p class="mt-3 text-xs text-muted-foreground">
                  {m.repos_bindings_note({ githubRef: 'owner/repo' })}
                </p>
              {/if}
            </div>
          {/if}
        </li>
      {/each}
    </ul>
  {/if}
</div>
