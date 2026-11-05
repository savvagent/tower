// @vitest-environment jsdom
/**
 * The shared theme switches on a `.dark` class, and nothing in the shared shell
 * sets it. Tower follows the OS: these pin that it does so at boot and on a
 * live change, and that the listener can be removed.
 */

import { describe, expect, it } from 'vitest';

import { followColorScheme } from './theme';

/** A `MediaQueryList` whose answer the test controls. */
function fakeMedia(initial: boolean) {
  const listeners = new Set<(event: MediaQueryListEvent) => void>();
  const media = {
    matches: initial,
    addEventListener: (_type: 'change', fn: (event: MediaQueryListEvent) => void) =>
      void listeners.add(fn),
    removeEventListener: (_type: 'change', fn: (event: MediaQueryListEvent) => void) =>
      void listeners.delete(fn)
  };
  return {
    media: media as unknown as MediaQueryList,
    flip(matches: boolean) {
      media.matches = matches;
      for (const fn of listeners) fn({ matches } as MediaQueryListEvent);
    },
    get listening() {
      return listeners.size;
    }
  };
}

describe('followColorScheme', () => {
  it('sets dark at once when the OS prefers dark', () => {
    const root = document.createElement('html');
    followColorScheme(root, fakeMedia(true).media);
    expect(root.classList.contains('dark')).toBe(true);
  });

  it('leaves light alone when the OS prefers light', () => {
    const root = document.createElement('html');
    followColorScheme(root, fakeMedia(false).media);
    expect(root.classList.contains('dark')).toBe(false);
  });

  it('follows a change made while the page is open', () => {
    const root = document.createElement('html');
    const os = fakeMedia(false);
    followColorScheme(root, os.media);
    os.flip(true);
    expect(root.classList.contains('dark')).toBe(true);
    os.flip(false);
    expect(root.classList.contains('dark')).toBe(false);
  });

  it('stops following once the returned function is called', () => {
    const root = document.createElement('html');
    const os = fakeMedia(false);
    const stop = followColorScheme(root, os.media);
    stop();
    expect(os.listening).toBe(0);
    os.flip(true);
    expect(root.classList.contains('dark')).toBe(false);
  });
});
