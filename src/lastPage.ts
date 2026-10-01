/**
 * The installed app always opens at `/`, so a player mid-puzzle or mid-room would land on
 * the home screen. Remember the last page and open it again. A new key of its own, so it
 * never touches the saves in `game:nonogram` or `game:library`.
 */
const KEY = 'game:lastPage';

// Only the app's own pages; anything else (an old or tampered value) opens the home screen.
const PAGES = /^\/(nonograms|avalon(\/[A-Z]{4})?|duel(\/[A-Z]{4})?|saved|ranks|settings|account)$/;

export function rememberPage(path: string) {
  try {
    localStorage.setItem(KEY, path);
  } catch {
    // Private mode or full storage: the app just opens at home next time.
  }
}

/** Before the router starts: if the app opened at home, go back to where the player was. */
export function restoreLastPage() {
  if (location.pathname !== '/') return;
  let saved: string | null = null;
  try {
    saved = localStorage.getItem(KEY);
  } catch {
    return;
  }
  if (saved && PAGES.test(saved)) history.replaceState(null, '', saved);
}
