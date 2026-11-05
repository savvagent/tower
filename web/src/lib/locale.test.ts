/**
 * The locale cache moved from tower's own key to the shared shell's.
 *
 * Resolution itself is the package's (and tested there). What tower owns is the
 * one-time move of a choice cached under the old key, so that adopting the
 * shared shell does not quietly reset anyone's language.
 */

import { describe, expect, it } from 'vitest';

import { LEGACY_CACHE_KEY, migrateLegacyCache } from './locale';
import type { LocaleStore } from '@savvagent/console-ui';

const SHARED_KEY = 'otto.locale';

function fakeStore(initial: Record<string, string> = {}) {
  const map = new Map(Object.entries(initial));
  const store: LocaleStore = {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k)
  };
  return { store, map };
}

describe('migrateLegacyCache', () => {
  it('moves a cached choice to the shared key', () => {
    const { store, map } = fakeStore({ [LEGACY_CACHE_KEY]: 'es' });
    migrateLegacyCache(store);
    expect(map.get(SHARED_KEY)).toBe('es');
    expect(map.has(LEGACY_CACHE_KEY)).toBe(false);
  });

  it('never overwrites a choice already under the shared key', () => {
    const { store, map } = fakeStore({ [LEGACY_CACHE_KEY]: 'es', [SHARED_KEY]: 'de' });
    migrateLegacyCache(store);
    expect(map.get(SHARED_KEY)).toBe('de');
    expect(map.has(LEGACY_CACHE_KEY)).toBe(false);
  });

  it('drops an unsupported value instead of carrying it over', () => {
    const { store, map } = fakeStore({ [LEGACY_CACHE_KEY]: 'xx' });
    migrateLegacyCache(store);
    expect(map.has(SHARED_KEY)).toBe(false);
    expect(map.has(LEGACY_CACHE_KEY)).toBe(false);
  });

  it('does nothing when there is nothing to move', () => {
    const { store, map } = fakeStore();
    migrateLegacyCache(store);
    expect(map.size).toBe(0);
  });

  it('survives a browser that blocks site data', () => {
    const hostile: LocaleStore = {
      getItem() {
        throw new DOMException('denied');
      },
      setItem() {
        throw new DOMException('denied');
      },
      removeItem() {
        throw new DOMException('denied');
      }
    };
    expect(() => migrateLegacyCache(hostile)).not.toThrow();
    expect(() => migrateLegacyCache(undefined)).not.toThrow();
  });
});
