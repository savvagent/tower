/**
 * Which language the console renders in — now the shared shell's decision.
 *
 * `@savvagent/console-ui` owns resolution (cached choice, else the browser's
 * languages), the language picker in the header, and the reload a change needs;
 * tower hands it this console's Paraglide runtime so tower's own messages follow
 * the same locale as the shell's. Its README ("Locale") has the details.
 *
 * Tower's `/api/session` carries no account locale, so `reconcile` has nothing
 * to be handed: the cached choice or the browser decides.
 */

import { isSupported, readCached, resolveAtBoot, writeCached } from '@savvagent/console-ui';
import type { Locale, LocaleStore } from '@savvagent/console-ui';

import { overwriteGetLocale } from '#lib/paraglide/runtime.js';

/** Where tower cached the locale before the shared shell, whose key is its own. */
export const LEGACY_CACHE_KEY = 'of.locale';

/**
 * Move a choice cached under tower's old key to the shared one, once.
 *
 * Without it, adopting the shared shell would quietly reset everyone who had
 * picked a language back to browser detection. A choice already under the
 * shared key wins (it was made in the shared shell, so it is newer), and the old
 * key is removed either way so this runs at most once per browser.
 */
export function migrateLegacyCache(store: LocaleStore | undefined = browserStore()): void {
  if (!store) return;
  try {
    const legacy = store.getItem(LEGACY_CACHE_KEY);
    if (legacy === null) return;
    if (readCached(store) === undefined && isSupported(legacy)) writeCached(legacy, store);
    store.removeItem(LEGACY_CACHE_KEY);
  } catch {
    // A browser that blocks site data: nothing was cached to move.
  }
}

/**
 * Decide the language before anything renders. Called once, at the top of the
 * root layout's script.
 */
export function bootLocale(): Locale {
  migrateLegacyCache();
  // The package types the getter it installs as `() => string`; this runtime's
  // `overwriteGetLocale` wants its own narrower `Locale` union. The package only
  // ever resolves to a locale it supports, and it supports exactly this
  // console's six (both `project.inlang` files list en, es, de, fr, it, hi), so
  // the cast restates what is already true rather than widening anything.
  return resolveAtBoot((getLocale) => overwriteGetLocale(() => getLocale() as Locale));
}

/** Reaching for `localStorage` is itself what throws when site data is blocked. */
function browserStore(): LocaleStore | undefined {
  try {
    return localStorage;
  } catch {
    return undefined;
  }
}
