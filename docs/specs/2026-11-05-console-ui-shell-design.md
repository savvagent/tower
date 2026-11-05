# Console UI shell design

> **Status:** DRAFT — the tower console adopts the shared `@savvagent/console-ui@0.2.0` shell
> (header, footer, theme, locale, shadcn-svelte components) and drops its own copies.
>
> **Implements:** savvagent/tower#293. **Part of:** savvagent/platform#154.

## Brief

Issue savvagent/tower#293, "Adopt @savvagent/console-ui and shadcn-svelte in the tower console".
Acceptance criteria, verbatim:

- [ ] The tower console uses the shared header, footer and theme; its own header and the copied
      components are removed.
- [ ] The "back to platform" links come from the shared session contract.
- [ ] No visual regressions (screenshot check in light and dark).

Caller constraints added to the brief: pin `@savvagent/console-ui` at exactly `0.2.0` from GitHub
Packages; authenticate every install of the web deps (`web/.npmrc`, the CI web job, the Dockerfile's
console stage through a BuildKit secret, the Fly deploy through `--build-secret`); do not work around
the known low `--destructive` text contrast (savvagent/console-ui#10).

## Premise corrections

1. **"No visual regressions … in light and dark."** The console today is dark-only: `app.css`
   declares one fixed dark palette and nothing switches it, so a light-scheme browser renders the
   same dark page. The shared theme is light by default with dark under a `.dark` class. Adopting
   it necessarily changes the colours, and adds a light rendering that did not exist. The check is
   therefore read as: every page renders completely and legibly in both schemes, with nothing
   missing, clipped, overlapping, or unreadable, and the dark rendering keeps the old layout and
   hierarchy. Pixel identity with the old palette is not a goal; the shared palette replacing it is
   the point of the issue.
2. **"Back to platform" links.** Tower's header had one ("← Back to Savvagent", built by
   `#lib/platform` from `session.platformUrl`, or from `/.well-known/oauth-protected-resource`
   when signed out). In the shared header the brand link ("Savvagent") is that link, built from
   `ConsoleSession.platformUrl` (or the header's `platformUrl` prop when there is no session) and
   validated by the package's `checkPlatformUrl`. The account menu's settings link and the org
   switcher's "all organizations" link come from the same value.
3. **Which components are "copied".** `web/src/lib/components/` holds nine components. Four are
   generic primitives the shared kit now provides — `Alert`, `Button`, `Card`, `Field` — and one is
   the old header's logo mark (`Logo`). Those five are removed. `CopyField`, `Empty`, `Loading` and
   `StatusPill` are tower-specific (copy-to-clipboard of a credential, empty-state copy, the polling
   spinner, the job-status vocabulary) and stay, restyled onto the shared tokens.
4. **The account locale.** CLAUDE.md's `web/` section still describes `users.locale` and
   `PATCH /api/me`; that predates the platform split. Tower's `/api/session` carries no locale, so
   there is nothing to hand `reconcile`. The locale is the cached choice (now written by the shared
   header's language picker) or browser detection.

## Assumptions

- **No `## Development Workflow` section exists in `CLAUDE.md`.** Repo facts are taken from the
  repo's own `.github/skills/otto-tower-development/SKILL.md` and `.github/workflows/ci.yml`: trunk
  `master`; specs and plans committed under `docs/specs/` and `docs/plans/`; gates `npm run check`,
  `npm run lint`, `npm test`, `npm run build` for `web/` plus the Rust gates; squash-merge; deploy is
  release-gated (merging the release-please PR deploys).
- **Worktree path** `.claude/worktrees/feat-293-console-ui` and **branch** `feat/293-console-ui`, as
  the caller specified (the repo skill's `.worktrees/<branch>` convention is not in `CLAUDE.md`).
- **Dark mode follows the OS.** The shared theme switches on a `.dark` class and the shared header
  has no theme control, so tower sets `.dark` on `<html>` from `prefers-color-scheme` and follows
  changes live. Rationale: no new UI to translate, and a person who chose dark in their OS keeps
  the dark console they had.
- **The legacy locale cache key is migrated once.** Tower cached the locale under `of.locale`; the
  package uses `otto.locale`. On boot, when the new key is empty and the old one holds a supported
  locale, it is copied over and the old key removed, so nobody's chosen language silently resets.
- **The footer keeps the version.** `ConsoleFooter` renders only links, so the version is a link
  labelled `v<version>` to the API reference page, after the "API reference" link.
- **Org links stay inside tower.** `orgHref` maps an org to tower's own `/o/{slug}`; the session has
  exactly one org, so the switcher shows it plus the shared "all organizations" link to the
  platform.
- **The "Manage" menu stays, in the header's `nav` snippet,** reduced to the org-scoped platform
  pages (members, teams, SSO, usage). The account page and switching org are now the shared
  account menu's and org switcher's.

## Goal & success criteria

Tower renders inside the same shell as every other Savvagent console, from the shared package, and
keeps no copy of the shell or its primitives.

- `web/src/routes/+layout.svelte` renders `ConsoleHeader` and `ConsoleFooter`; no other header or
  footer markup exists in `web/src`.
- `web/src/app.css` imports `@savvagent/console-ui/theme.css` and declares no palette of its own;
  `git grep -nE '(text|bg|border|divide|ring)-(ink|faint|canvas|surface|raised|edge|bad|warn|busy|ok|accent-ink)\b|text-muted\b|(text|bg|border)-accent\b|of-(card|input|label)' web/src`
  is empty. (`text-muted` and `*-accent` are valid shared classes with another meaning — `muted` and
  `accent` are fills there — so they are searched for explicitly; every use is remapped.)
- `Alert`, `Button`, `Card`, `Field` and `Logo` no longer exist under `web/src/lib/components/`;
  pages import `@savvagent/console-ui/ui/*` instead.
- Every link to the platform derives from `platformUrl` (session, or discovery when signed out).
- The screenshot check (§7) shows every page complete and legible in light and dark, desktop and
  phone width, and all four `web` gates plus the Docker build pass with the token supplied only as
  a secret.

## Scope

**In:** `web/` (shell, theme, components, locale boot, colour scheme, message catalogs, tests),
`web/.npmrc`, `web/package.json` + lockfile, `.github/workflows/ci.yml` (package auth in `web`,
`docker-build`, `deploy`), `Dockerfile` (console stage secret mount), `docs/deploy/fly.md` and
`web/README.md` (the token for manual builds), `CLAUDE.md` (`web/` section, one-line updates).

**Out:** any server change (no route, no `OF_*` key, no migration); a theme toggle; the
`--destructive` contrast (savvagent/console-ui#10); restyling page layouts beyond token mapping;
the Cloudflare Worker's code (`web/worker/` is untouched; only its deploy instructions mention the
token); other consoles. None of this touches the three constraints: no repo-anchoring, workflow,
or client-specific behaviour changes.

## §1 Package and authentication

- `web/package.json`: `"@savvagent/console-ui": "0.2.0"` (exact) in `devDependencies`, beside every
  other dependency — the console is a static bundle, nothing is installed at runtime. Its peer
  `tailwindcss@^4.3.4` moves `tailwindcss` and `@tailwindcss/vite` to `^4.3.4`.
  `overrides: { "@sveltejs/kit": "$@sveltejs/kit" }`: `runed` (under bits-ui) declares an
  *optional* peer `@sveltejs/kit@^2`. npm 11 leaves it out of the lockfile; npm 10 (Node 22, which
  CI and the Dockerfile use) refuses `npm ci` without it, or nests a second Kit 2 under bits-ui. The
  override makes every Kit reference the project's own Kit 3, one copy, and a lockfile both npm 10
  and 11 accept. runed's Kit integration is not used by the shared components.
- `web/.npmrc`:
  ```ini
  @savvagent:registry=https://npm.pkg.github.com
  //npm.pkg.github.com/:_authToken=${NODE_AUTH_TOKEN}
  ```
  The file holds a reference, never a token. Locally `export NODE_AUTH_TOKEN=$(gh auth token)`.
- CI `web` job: `permissions: { contents: read, packages: read }`, and
  `NODE_AUTH_TOKEN: ${{ secrets.GITHUB_TOKEN }}` on the `npm ci` step only.
- CI `docker-build` job: `permissions: { contents: read, packages: read }`; `docker/build-push-action`
  gets `secrets: NODE_AUTH_TOKEN=${{ secrets.GITHUB_TOKEN }}`.
- `Dockerfile` console stage: `.npmrc` is copied with the manifests, and
  `RUN --mount=type=secret,id=NODE_AUTH_TOKEN,required=true NODE_AUTH_TOKEN="$(cat /run/secrets/NODE_AUTH_TOKEN)" npm ci`.
  The secret is a tmpfs mount for that one `RUN`; it is never an `ARG` or `ENV` and is in no layer.
  `required=true` makes a build without it fail at that line, naming the secret, rather than at a
  401 deep in npm's output.
- CI `deploy` job: `permissions: { contents: read, packages: read }`; `flyctl deploy --remote-only
  -a otto-factory-mcp --build-secret NODE_AUTH_TOKEN="$NODE_AUTH_TOKEN"` with the token in the
  step's `env`, so it never appears in the command text.
- `docs/deploy/fly.md`'s manual `fly deploy` and `web/README.md`'s commands gain the token.

## §2 Theme and colour scheme

`app.html`'s `<body class="… bg-canvas text-ink">` falls under the same mapping (the theme's base
layer already styles `body`, so the classes are dropped).

`app.css` becomes `@import 'tailwindcss'; @import '@savvagent/console-ui/theme.css';` plus the
`.of-mono` component class (font only) and the visible-focus rule, rewritten onto `--ring`. Tower's
own `@theme` palette and `.of-card`/`.of-input`/`.of-label` go.

Token mapping applied to every page:

| Tower | Shared |
|---|---|
| `ink` | `foreground` |
| `muted`, `faint` (text) | `muted-foreground` |
| `canvas` | `background` |
| `surface` | `card` |
| `raised` (fill) | `muted` |
| `edge` | `border` |
| `accent` (text, link) | `primary` |
| `bad` | `destructive` |
| `warn`, `busy` | `warning` |
| `ok` | `success` |

`#lib/theme.ts` exports `followColorScheme(root, media)`: it sets `.dark` on `root` when `media`
matches and keeps it in step with `change` events; the root layout calls it once with
`document.documentElement` and `matchMedia('(prefers-color-scheme: dark)')`. `app.html` adds
`<meta name="color-scheme" content="light dark">` so the canvas before the script runs follows the
OS too.

## §3 Header

`+layout.svelte` maps `session.info` to a `ConsoleSession` through `toConsoleSession` in
`#lib/console-session.ts` (the README's mapping; unit-tested). Rendering:

- **Signed in:** `<ConsoleHeader session service="tower" onSignOut={signOut} orgHref={…}>` with a
  `nav` snippet holding the "Manage" menu (shared `DropdownMenu`, links from `platformLink`).
- **Signed out, or the session lookup failed:** `<ConsoleHeader platformUrl={home} service="tower">`
  with `home` from the existing `PlatformHome` discovery (through `shellPlatformUrl`), and a `signedOut` snippet with the
  "Sign in" link (a full navigation, `data-sveltekit-reload`) rendered only once `session.ready`.
- **No platform address known** (signed out and discovery failed or pending): a plain `<header>` of
  the same height with the "Sign in" link. The shared header throws without a platform URL, and a
  guessed address is never used.

The old header markup, the `Logo` mark and the "otto" phone label go.

## §4 Footer

`<ConsoleFooter platformUrl links={[API reference → /docs/api, v<version> → /docs/api]}>` when a
platform address is known; otherwise a plain footer with the same two links.

## §5 Components

Shared replacements: `Alert` (`tone` error/warn/ok/info → `variant` destructive/warning/success/
default), `Button` (`tone` primary/quiet/danger → `variant` default/outline/destructive; `pending`
becomes `disabled` plus a `Spinner` child), `Card` (`Card` + `CardHeader`/`CardTitle`/
`CardDescription`/`CardAction`/`CardContent`), `Field` (`Field` + `FieldLabel` + `Input`/native
`select` + `FieldDescription`, ids from `$props.id()`). A new `Spinner.svelte` (the animated ring
both `Loading` and pending buttons used) is the only new component.

## §6 Locale

`#lib/locale.ts` shrinks to `migrateLegacyCache(store)` and `bootLocale()`; `bootLocale` migrates,
then calls the package's `resolveAtBoot(overwriteGetLocale)` with tower's Paraglide runtime.
`currentLocale` is imported from the package. The old resolution code and its tests move out with
it (the package owns and tests them). `reconcile` is not called (Premise correction 4).

## Invariants impact

- **Static SPA, cookie in the browser.** Unchanged: `+layout.ts` keeps `ssr = false`,
  `adapter-static` and the dev proxy are untouched, and the package needs no SvelteKit server
  (its README: "SvelteKit is not required").
- **Nothing about the deployment in the bundle.** Every platform link comes from
  `session.platformUrl` or `/.well-known/oauth-protected-resource`, through one helper,
  `shellPlatformUrl(url)` in `#lib/platform.ts`: `platformHome(url)` and then the package's
  `checkPlatformUrl`, returning `undefined` on any refusal. The header, footer and Manage menu all
  read it, so the fallback rule (§3) is one tested function. The service list is fetched at runtime
  from that same address by the package. `grep -r savvagent.com web/build` stays empty.
- **Runes only.** The new modules are plain TypeScript; the layout keeps `$state`/`$derived`/`$effect`.
- **Server rules mirrored, not re-implemented.** Unchanged: org pages still show "no such
  organization" for a `404`; `isAdmin` still only hides. `orgHref` returns tower's `/o/{slug}`, so a
  click there goes through the existing org guard and, for any other org, through `#lib/login`'s
  one-minute retry guard (the session has only its own org, so in practice it is the current one).
- **Poller.** Untouched.
- **Six catalog entries per string.** No string is added: the shell's strings are the package's own
  Paraglide messages, in the same six locales (its `project.inlang` lists en, es, de, fr, it, hi).
  Keys only the old header used are removed from all six catalogs: `nav_back_to_platform`,
  `nav_sign_out`, `nav_organizations`, `nav_platform_account`, `nav_platform_switch_org` (any other
  key found unused after the change is removed the same way; `npm run check` proves the catalogs
  stay complete). Kept: `nav_manage`, `nav_platform_members|teams|sso|usage`, `nav_sign_in`,
  `nav_api_reference`, and the session/sign-in states. The version label stays a literal
  `v{APP_VERSION}`, as today.

## Public interfaces and cost

No public interface changes: no MCP tool, console API route, OAuth/discovery endpoint, `OF_*` key,
or schema. Console URLs are unchanged. The only client-side state change is the `localStorage`
locale key (`of.locale` → `otto.locale`), migrated on boot. Recurring cost: none. Package reads from
GitHub Packages by Actions are covered by the existing grant and the org's plan.

## Out-of-band

| Item | Who | When |
|---|---|---|
| `web` and `docker-build` CI jobs install with the token | agent | on the PR's own CI run, which must show both jobs green |
| Docker console stage refuses to build without the secret | agent | locally with podman, `--no-cache` so a cached `npm ci` layer cannot hide it |
| Fly remote build receives `--build-secret` | agent observes, merge is Rob's or the release flow's | the `deploy` job runs only after a release-please PR merges; this PR cannot exercise it. Locally the agent proves the same Dockerfile with `podman build --secret`. After the release merges, the deploy job's log must show the console stage's `npm ci` succeeding and `/readyz` passing |
| `fly.toml` | none | `--build-secret` needs no `[build]` change; the Dockerfile names the secret id |

## §7 Testing approach

- Unit (vitest): `toConsoleSession`; `shellPlatformUrl` (https and loopback http pass; http off
  loopback, credentials, `javascript:`, garbage and `undefined` give `undefined`);
  `followColorScheme` (initial state, live change);
  `migrateLegacyCache` (copies, does not overwrite, drops unsupported, survives a throwing store).
- Render tests (existing `page.render.test.ts` harnesses) keep passing against the new markup; the
  root-layout render test asserts the shared header renders and the platform link uses the session's
  `platformUrl`.
- Gates: `cd web && npm run check && npm run lint && npm test && npm run build`; the Rust gates are
  unaffected but run before the PR; `podman build --secret id=NODE_AUTH_TOKEN,env=NODE_AUTH_TOKEN .`
  and a build without the secret, which must fail at the `npm ci` line.
- Screenshot check (outside the repo): a mock API and platform, the baseline (`origin/master`) and
  the branch under `vite dev`, every page signed in (overview, queue, job, failed job, repos,
  trackers, audit, API docs) and the signed-out front page, in light and dark, at 1280 and 390 px.

## Error handling & edge cases

- Platform URL failing `checkPlatformUrl` (not https, not loopback http, or with credentials):
  the shared header would throw. Every value goes through `shellPlatformUrl` first; a refused value
  renders the plain header and footer (§3, §4) instead of a crash.
- Colour before the script runs: the static shell has no content until JavaScript runs, and the
  `color-scheme` meta makes the browser's own canvas follow the OS, so a dark-OS visitor sees no
  white frame; the `.dark` class is set synchronously in the root layout before first render.
- Service list unreachable: the shared header shows its own error state; nothing in tower changes.
- Sign-out failure: unchanged (cleared locally regardless).
- `localStorage` blocked: the migration is wrapped like every other storage access.

## Risks & open questions

- **The destructive text contrast** is low in dark (savvagent/console-ui#10); error alerts are
  legible but below AA until that ships. Not worked around, by instruction.
- **Light mode is new.** A page that hard-coded a dark-only colour would be unreadable in light;
  the token sweep and the screenshot check are the guard.
- **Package availability.** Every build now depends on GitHub Packages and on the repo's Actions
  read grant (in place). A local build without `NODE_AUTH_TOKEN` fails at install.
- **Release-gated deploy.** Merging this PR deploys nothing; the change reaches production when the
  next release-please PR merges.
