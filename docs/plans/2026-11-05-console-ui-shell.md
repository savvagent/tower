# Console UI shell — the tower console on @savvagent/console-ui

**Goal:** the console renders in the shared Savvagent shell from `@savvagent/console-ui@0.2.0`
(header, footer, theme, locale, shadcn-svelte components) and keeps no copy of its own. Closes
savvagent/tower#293; part of savvagent/platform#154.

**Spec:** `docs/specs/2026-11-05-console-ui-shell-design.md` — read it first. This plan implements
it exactly.

## Status — 2026-11-05

🚧 Task 1 in progress (`.npmrc`, package, lockfile, Dockerfile and CI edits made; docs pending).

## Global constraints

- `web/`, `Dockerfile`, `.github/workflows/ci.yml` and docs only. No server change, no route, no
  `OF_*` key, no migration.
- Never hard-code the platform URL; it comes from `session.platformUrl` or `/.well-known`.
- Runes only. A new string is six catalog entries; a string no longer used is removed from all six.
- The token is never written to a file, a layer, an `ARG`, or a command line.
- Worktree only; `master` only through the PR. No attribution of any kind.
- Gates for every task: `cd web && npm run check && npm run lint && npm test` (and `npm run build`
  where stated). Before the PR: those four, `podman build --secret id=NODE_AUTH_TOKEN,env=NODE_AUTH_TOKEN .`,
  and `cargo fmt --all -- --check && cargo clippy --all-targets -- -D warnings && cargo test --workspace`.
- `export NODE_AUTH_TOKEN=$(gh auth token)` before any install.
- **Evidence:** report each gate as the exact command with its pass/fail/skip counts; a skipped
  test is not evidence. `cargo test --workspace` needs `podman compose up -d` (Postgres on 15433)
  and a `.env` (copied from the main checkout) or its database tests prove nothing.
- **Invariants:** static SPA (`adapter-static`, `ssr = false`, the `__Host-` cookie stays in the
  browser); nothing about the deployment in the bundle (after a build, `grep -r savvagent.com
  web/build` is empty); runes only; six catalog entries per string; a `404` still reads "no such
  organization"; polling only through `Poller`.

## File structure

| File | Responsibility |
|---|---|
| **Create.** `web/.npmrc` | `@savvagent` scope on GitHub Packages, token from the environment |
| **Modify.** `web/package.json`, `web/package-lock.json` | `@savvagent/console-ui` `0.2.0` exact; Tailwind `^4.3.4` |
| **Modify.** `Dockerfile` | console stage: `.npmrc` + secret-mounted `npm ci` |
| **Modify.** `.github/workflows/ci.yml` | `packages: read` + token for `web`, `docker-build`, `deploy` |
| **Modify.** `docs/deploy/fly.md`, `web/README.md` | the token for manual installs and deploys |
| **Modify.** `web/src/app.css`, `web/src/app.html` | shared theme; `color-scheme` meta |
| **Create.** `web/src/lib/theme.ts` + `theme.test.ts` | `followColorScheme` |
| **Create.** `web/src/lib/console-session.ts` + test | `toConsoleSession` |
| **Modify.** `web/src/lib/locale.ts` (+ test rewritten) | `migrateLegacyCache`, `bootLocale` |
| **Modify.** `web/src/lib/platform.ts` (+ test) | `shellPlatformUrl` |
| **Modify.** `web/src/lib/format.ts` | `currentLocale` from the package |
| **Modify.** `web/src/routes/+layout.svelte` | `ConsoleHeader`, `ConsoleFooter`, boot |
| **Delete.** `web/src/lib/components/{Alert,Button,Card,Field,Logo}.svelte` | replaced by shared |
| **Create.** `web/src/lib/components/Spinner.svelte` | the shared spinner ring |
| **Modify.** `web/src/lib/components/{CopyField,Empty,Loading,StatusPill}.svelte` | shared tokens |
| **Modify.** every `web/src/routes/**/+page.svelte`, `o/[org]/+layout.svelte` | shared components and tokens |
| **Modify.** `web/messages/*.json` | drop keys the old header used and nothing else does |
| **Modify.** `CLAUDE.md` | `web/` section: the shell is the package's |

## Task order & rationale

Packaging first (nothing else installs without it), then the pure modules with unit tests, then the
shell, then the pages, then docs. Each task leaves every gate green.

## Task 1 — Package and authentication ⬜

**Files:** `web/.npmrc`, `web/package.json`, lockfile, `Dockerfile`, `ci.yml`, `docs/deploy/fly.md`,
`web/README.md`.

- [ ] Add `web/.npmrc`; `npm install -D tailwindcss@^4.3.4 @tailwindcss/vite@^4.3.4`;
      `npm install -D --save-exact @savvagent/console-ui@0.2.0`. Confirm `package.json` reads `"0.2.0"`
      and the lockfile resolves it from `npm.pkg.github.com`.
- [ ] `Dockerfile`: `COPY web/package.json web/package-lock.json web/.npmrc ./`, then
      `RUN --mount=type=secret,id=NODE_AUTH_TOKEN,required=true NODE_AUTH_TOKEN="$(cat /run/secrets/NODE_AUTH_TOKEN)" npm ci`.
- [ ] `podman build --no-cache --secret id=NODE_AUTH_TOKEN,env=NODE_AUTH_TOKEN --target console .` passes;
      with `--no-cache` and without `--secret` it fails at the `npm ci` line. `podman history` shows no token.
- [ ] `ci.yml`: `web` gets `permissions: {contents: read, packages: read}` and
      `env: NODE_AUTH_TOKEN: ${{ secrets.GITHUB_TOKEN }}` on `npm ci`; `docker-build` gets the same
      permissions and `secrets: NODE_AUTH_TOKEN=${{ secrets.GITHUB_TOKEN }}` on the build action;
      `deploy` gets `packages: read` and `--build-secret NODE_AUTH_TOKEN="$NODE_AUTH_TOKEN"` with the
      token in the step `env`.
- [ ] Docs: manual `fly deploy` and `npm install`/`npm run deploy` name the token.
- [ ] `package.json` `overrides: {"@sveltejs/kit": "$@sveltejs/kit"}` (spec §1); `npx npm@10 ci` and
      `npm ci` both succeed; the lockfile has exactly one `@sveltejs/kit`.
- [ ] Out-of-band reminder: the PR's own CI run must show `web` and `docker-build` green (they are
      the first use of the token in CI); the `deploy` job is checked after the release merges (Task 5).
- [ ] Gates (check, lint, test, build). Commit `build(web): install @savvagent/console-ui from GitHub Packages`.

## Task 2 — Locale, colour scheme, session mapping ⬜

**Interfaces:** produces `followColorScheme(root: Element, media: MediaQueryList): () => void`,
`toConsoleSession(s: SessionInfo): ConsoleSession`, `migrateLegacyCache(store?: LocaleStore): void`,
`bootLocale(): Locale`, `shellPlatformUrl(url?: string): string | undefined`.

- [ ] Write failing tests: `theme.test.ts` (adds/removes `.dark` initially and on `change`; the
      returned function unsubscribes), `console-session.test.ts` (one org, role carried,
      `platformUrl` passed through), `locale.test.ts` rewritten (copies `of.locale` to
      `otto.locale` and removes it; never overwrites an existing `otto.locale`; drops an unsupported
      value; a throwing store is ignored), `platform.test.ts` gains `shellPlatformUrl` (https and
      loopback http pass; http off loopback, credentials, `javascript:`, garbage, `undefined` refused).
- [ ] `npx vitest run src/lib/theme.test.ts src/lib/console-session.test.ts src/lib/locale.test.ts src/lib/platform.test.ts`
      — expect failures.
- [ ] Implement; `format.ts` and `o/[org]/+page.svelte` import `currentLocale` from the package, and
      `+layout.svelte` calls `bootLocale()` (from `#lib/locale.ts`) in place of the old `resolveAtBoot()`.
      Re-run — expect pass. Gates. Commit `feat(web): boot the locale and colour scheme the shared way`.

## Task 3 — Shell: theme, header, footer ⬜

- [ ] Create `web/src/routes/LayoutHarness.svelte` (the root layout with a `children` snippet) and
      `web/src/routes/layout.render.test.ts`. Set `session.info`/`session.ready` first so the
      layout makes no `/api/session` request, and stub `fetch` for the header's service list
      (`/services/v1.json` at the platform). Cases: signed in → a "Savvagent" link whose href is the
      session's `platformUrl` and the footer's API reference link; no address known → the plain
      fallback header with "Sign in". Run — expect failure.
- [ ] `app.css` → shared theme (§2); `app.html` → `color-scheme` meta, body palette classes dropped.
- [ ] `+layout.svelte` → `ConsoleHeader`/`ConsoleFooter` per spec §3–§4, with the plain fallback
      header/footer when no platform address is known; delete `Logo.svelte`.
- [ ] Remove `nav_back_to_platform`, `nav_sign_out`, `nav_organizations`, `nav_platform_account`,
      `nav_platform_switch_org` (and any other key left unused) from all six catalogs (`npm run check` proves completeness).
- [ ] Note: pages still use the old palette classes until Task 4, so they render unstyled in
      between; do not screenshot here.
- [ ] Re-run the render test — pass. Gates + build; `grep -r savvagent.com web/build` empty.
      Commit `feat(web): render the console in the shared shell`.

## Task 4 — Components and pages onto the shared kit ⬜

- [ ] Add `Spinner.svelte`; restyle `CopyField`, `Empty`, `Loading`, `StatusPill` onto shared tokens.
- [ ] Replace `Alert`/`Button`/`Card`/`Field` in every page and the org layout with the shared
      components (spec §5) and map every palette class (spec §2 table); delete the four files.
- [ ] `git grep -nE '(text|bg|border|divide|ring)-(ink|faint|canvas|surface|raised|edge|bad|warn|busy|ok|accent-ink)\b|text-muted\b|(text|bg|border)-accent\b|of-(card|input|label)' web/src` is empty.
- [ ] Render tests pass (update selectors only where markup legitimately changed). Gates + build.
      Commit `refactor(web): use the shared shadcn-svelte components and tokens`.

## Task 5 — Docs and the screenshot check ⬜

- [ ] `CLAUDE.md` `web/` section: one line that the shell, theme and locale resolution are the
      package's; the locale paragraph no longer claims `users.locale`.
- [ ] Screenshot check (outside the repo): mock API + platform, baseline vs branch, every page,
      light and dark, 1280 and 390 px. Fix anything missing, clipped or unreadable.
- [ ] Full gate run (web four + Rust three + podman build with and without the secret, `--no-cache`).
      Commit `docs(web): describe the shared console shell`.
- [ ] After the PR opens: its CI run shows `rust`, `web`, `docker-build`, `pr-title` green on the head.
- [ ] After the release-please PR merges: the `deploy` job's log shows the console stage's `npm ci`
      succeeding with the build secret, and `https://tower.savvagent.com/readyz` answers 200.
