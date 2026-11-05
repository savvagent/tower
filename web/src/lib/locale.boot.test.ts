// @vitest-environment jsdom
/**
 * `bootLocale` as the root layout runs it: the legacy cache moves first, then
 * the shared resolution installs its answer into this console's Paraglide
 * runtime. Dropping either step would pass the unit tests in `locale.test.ts`
 * and still reset people's language, or leave tower's strings in English under
 * a translated shell.
 */

import { SUPPORTED, currentLocale } from '@savvagent/console-ui';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { m } from '#lib/paraglide/messages.js';
import { baseLocale, getLocale, locales } from '#lib/paraglide/runtime.js';
import { LEGACY_CACHE_KEY, bootLocale } from './locale';

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe('the locale lists', () => {
  it('are the same in the shared shell and in this console', () => {
    // `bootLocale` hands the shell's answer to this runtime; a locale only one
    // side ships would render tower's strings in the base language.
    expect([...SUPPORTED].sort()).toEqual([...locales].sort());
    expect(baseLocale).toBe('en');
  });
});

describe('bootLocale', () => {
  it('honours a choice cached under the old key, and moves it', () => {
    localStorage.setItem(LEGACY_CACHE_KEY, 'es');
    expect(bootLocale()).toBe('es');
    // The shell and this console agree, and this console's own strings follow.
    expect(currentLocale()).toBe('es');
    expect(getLocale()).toBe('es');
    expect(m.nav_sign_in()).toBe('Iniciar sesión');
    expect(localStorage.getItem(LEGACY_CACHE_KEY)).toBeNull();
    expect(document.documentElement.lang).toBe('es');
  });

  it('falls back to the browser when nothing was chosen', () => {
    vi.spyOn(navigator, 'languages', 'get').mockReturnValue(['de-AT', 'en']);
    expect(bootLocale()).toBe('de');
    expect(getLocale()).toBe('de');
  });
});
