/**
 * Light or dark, following the OS.
 *
 * The shared theme (`@savvagent/console-ui/theme.css`) switches on a `.dark`
 * class rather than on `prefers-color-scheme`, so a console decides. The shared
 * header offers no theme control, and before the shared shell this console was
 * dark only, so following the OS keeps dark for everyone who chose it there and
 * adds nothing to translate. `app.html`'s `color-scheme` meta does the same for
 * the browser's own canvas before this runs.
 */

/** Keep `.dark` on `root` in step with `media`. Returns a function that stops. */
export function followColorScheme(root: Element, media: MediaQueryList): () => void {
  const apply = (dark: boolean) => root.classList.toggle('dark', dark);
  apply(media.matches);
  const onChange = (event: MediaQueryListEvent) => apply(event.matches);
  media.addEventListener('change', onChange);
  return () => media.removeEventListener('change', onChange);
}
