import { paraglideVitePlugin } from '@inlang/paraglide-js';
import adapter from '@sveltejs/adapter-static';
import { sveltekit } from '@sveltejs/kit/vite';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

/**
 * In production the console and the API are one origin: `tower-server` serves the
 * built bundle beside `/api`, `/auth`, and `/.well-known`.
 *
 * Development has to reproduce that, not merely approximate it. The session
 * cookie carries the `__Host-` prefix, which browsers refuse to store unless
 * the cookie has `Path=/` and **no `Domain`** — so it is bound to whatever
 * origin set it and cannot be sent to a different port. A dev server that
 * pointed `fetch` at `http://localhost:8080` would never send the session, and
 * CORS could not rescue it. Proxying instead keeps every request on the Vite
 * origin, where the cookie lives.
 *
 * Sign-in works through the same proxy: set the server's `OF_PUBLIC_URL` to
 * `http://localhost:5173` so the platform sends the browser back to
 * `/auth/callback` on this origin, and register that redirect URI for the
 * console client at the platform.
 *
 * `secure: false` only tells the proxy not to verify an upstream TLS
 * certificate; it has nothing to do with the cookie's `Secure` attribute, which
 * browsers honour on `localhost` regardless.
 */
const api = process.env.OF_API_ORIGIN ?? 'http://127.0.0.1:8080';

const proxied = {
  target: api,
  changeOrigin: false,
  secure: false
};

/**
 * Messages are compiled, not looked up at runtime.
 *
 * `emitTsDeclarations` is not optional. Without it Paraglide emits no `.d.ts`
 * at all and a misspelled key type-checks clean, then renders the base locale's
 * string in every language — which is exactly the failure `npm run check` is
 * supposed to catch before a customer does. With it, `m.no_such_key()` is a
 * `TS2339`.
 *
 * The output is generated and git-ignored, so it is also in `.prettierignore`;
 * a fresh compile would otherwise fail `npm run lint` on code no human wrote.
 */
const paraglide = paraglideVitePlugin({
  project: './project.inlang',
  outdir: './src/lib/paraglide',
  emitTsDeclarations: true
});

/**
 * The console is a single-page app, and that is a security decision before it
 * is an architectural one.
 *
 * The session is an `HttpOnly`, `__Host-`-prefixed cookie bound to one origin.
 * A SvelteKit server rendering these pages would have to hold that credential
 * to fetch on the user's behalf — a second process with the keys to every
 * console session, for pages that are behind a login and cannot be cached
 * anyway. Building to static files that `tower-server` serves on the same origin
 * as `/api` keeps the cookie in exactly one place: the browser.
 *
 * `fallback` is what makes deep links work. Every route below `/` is resolved
 * by the client router, so the server answers any unmatched path with the same
 * shell — `/o/acme/queue` typed into the address bar has to load the app, not a
 * 404 from a static file server.
 *
 * SvelteKit 3 takes this configuration here; there is no `svelte.config.js`.
 *
 * `version.pollInterval: 0` keeps SvelteKit 2's behaviour of never polling
 * `/_app/version.json`. Kit 3 polls hourly by default to feed `updated.current`,
 * which nothing in the console reads, so the poll would be a request from every
 * open tab for nothing — including from a tab `Poller` has deliberately parked
 * because nobody is looking at it. The focus- and visibility-based version
 * checks still run.
 *
 * TypeScript's `strict` lives in `tsconfig.json`, which now extends
 * `$app/tsconfig` instead of a generated file a hand edit would be lost from.
 */
const kit = sveltekit({
  preprocess: vitePreprocess(),
  adapter: adapter({ fallback: 'index.html', strict: false }),
  version: { pollInterval: 0 }
});

export default defineConfig({
  plugins: [paraglide, tailwindcss(), kit],
  // Vitest resolves package `exports` with a "node" condition by default,
  // which is what mounting a Svelte component needs to avoid — Svelte's
  // package exports a server-only build under "default", and only the
  // "browser" condition resolves to the client build that has `mount`.
  // Scoped to `process.env.VITEST` so dev/build keep their normal resolution.
  resolve: process.env.VITEST ? { conditions: ['browser'] } : undefined,
  server: {
    port: 5173,
    proxy: {
      '/api': proxied,
      '/auth': proxied,
      '/oauth': proxied,
      '/.well-known': proxied
    }
  }
});
