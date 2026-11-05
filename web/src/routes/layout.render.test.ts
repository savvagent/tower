// @vitest-environment jsdom
/**
 * The root layout renders the console inside the shared Savvagent shell.
 *
 * What these pin is where the links back to the platform come from: the
 * session's `platformUrl` when signed in, the open discovery document when not,
 * and nowhere at all — a plain header with only "Sign in" — when neither
 * answers. A guessed address is how a staging console sends people to
 * production.
 */

import { flushSync, mount, tick, unmount } from 'svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('$app/navigation', () => ({
  goto: vi.fn(() => Promise.resolve())
}));

import { page } from '$app/state';
import { session } from '#lib/session.svelte.ts';
import Harness from './LayoutHarness.svelte';

const PLATFORM = 'https://savvagent.example';

let container: HTMLElement;
let urlDescriptor: PropertyDescriptor | undefined;
let discovery: string | undefined;

function setUrl(path: string) {
  Object.defineProperty(page, 'url', {
    configurable: true,
    get: () => new URL(`http://localhost${path}`)
  });
}

/** Every request the layout and the shared header make, answered without a network. */
function fakeFetch(input: RequestInfo | URL): Promise<Response> {
  const url = String(input instanceof Request ? input.url : input);
  if (url.endsWith('/services/v1.json')) {
    return Promise.resolve(Response.json({ version: 1, services: [] }));
  }
  if (url.endsWith('/.well-known/oauth-protected-resource')) {
    return Promise.resolve(
      discovery
        ? Response.json({ authorization_servers: [discovery] })
        : new Response('', { status: 404 })
    );
  }
  return Promise.resolve(new Response('', { status: 404 }));
}

/** Let fetches resolve and effects re-run. */
async function settle() {
  for (let i = 0; i < 5; i++) {
    await tick();
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  flushSync();
}

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  urlDescriptor = Object.getOwnPropertyDescriptor(page, 'url');
  discovery = undefined;
  vi.stubGlobal('fetch', vi.fn(fakeFetch));
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({ matches: false, addEventListener() {}, removeEventListener() {} }))
  );
});

afterEach(() => {
  container.remove();
  if (urlDescriptor) Object.defineProperty(page, 'url', urlDescriptor);
  session.info = undefined;
  session.ready = false;
  vi.unstubAllGlobals();
});

function links(): HTMLAnchorElement[] {
  return [...container.querySelectorAll('a')];
}

describe('the root layout', () => {
  it('links back to the platform from the session, and renders the shared footer', async () => {
    setUrl('/o/acme');
    session.info = {
      user: { id: 'u-1', email: 'ada@acme.test', name: 'Ada' },
      org: { id: 'o-1', slug: 'acme', name: 'Acme', plan: 'team' },
      role: 'owner',
      scopes: [],
      platformUrl: PLATFORM
    };
    session.ready = true;
    const instance = mount(Harness, { target: container });
    await settle();

    const home = links().find((a) => a.textContent?.trim() === 'Savvagent');
    expect(home?.getAttribute('href')).toBe(`${PLATFORM}/`);
    expect(container.querySelector('header')).not.toBeNull();
    expect(links().some((a) => a.getAttribute('href') === '/docs/api')).toBe(true);
    // The footer's copyright is the shared footer's own link to the platform.
    expect(container.querySelector('footer a')?.getAttribute('href')).toBe(`${PLATFORM}/`);
    unmount(instance);
  });

  it('signed out, links back to the platform the discovery document names', async () => {
    setUrl('/');
    discovery = PLATFORM;
    session.info = undefined;
    session.ready = true;
    const instance = mount(Harness, { target: container });
    await settle();

    const home = links().find((a) => a.textContent?.trim() === 'Savvagent');
    expect(home?.getAttribute('href')).toBe(`${PLATFORM}/`);
    expect(links().some((a) => a.getAttribute('href') === '/auth/login')).toBe(true);
    unmount(instance);
  });

  it('with no platform address anywhere, renders a plain header and no platform link', async () => {
    setUrl('/');
    session.info = undefined;
    session.ready = true;
    const instance = mount(Harness, { target: container });
    await settle();

    expect(links().some((a) => a.getAttribute('href') === '/auth/login')).toBe(true);
    expect(links().some((a) => a.textContent?.trim() === 'Savvagent')).toBe(false);
    expect(links().some((a) => a.getAttribute('href') === '/docs/api')).toBe(true);
    unmount(instance);
  });

  it('refuses a platform address the shared header would throw on', async () => {
    setUrl('/o/acme');
    session.info = {
      user: { id: 'u-1', email: 'ada@acme.test', name: 'Ada' },
      org: { id: 'o-1', slug: 'acme', name: 'Acme', plan: 'team' },
      role: 'owner',
      scopes: [],
      platformUrl: 'http://savvagent.example'
    };
    session.ready = true;
    const instance = mount(Harness, { target: container });
    await settle();

    expect(links().some((a) => a.textContent?.trim() === 'Savvagent')).toBe(false);
    expect(container.querySelector('[data-testid="child"]')).not.toBeNull();
    unmount(instance);
  });
});
