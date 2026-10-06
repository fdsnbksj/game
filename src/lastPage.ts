/**
 * The installed app always opens at `/`, so a player mid-puzzle or mid-room would land on
 * the home screen. Remember the last page and open it again. A new key of its own, so it
 * never touches the saves in `game:nonogram` or `game:library`.
 */
const KEY = 'game:lastPage';

// Only the app's own pages; anything else (an old or tampered value) opens the home screen.
const PAGES = /^\/(nonograms|avalon(\/[A-Z]{4})?|duel(\/[A-Z]{4})?|wonders(\/[A-Z]{4})?|isle(\/[A-Z]{4})?|brawl|saved|ranks|settings|account)$/;

// The last party-game room, so home can offer a way back until that game ends.
const ROOM_KEY = 'game:lastRoom';
const ROOM = /^\/(avalon|duel|wonders|isle)\/[A-Z]{4}$/;

export function rememberPage(path: string) {
  try {
    localStorage.setItem(KEY, path);
    if (ROOM.test(path)) localStorage.setItem(ROOM_KEY, path);
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

/** The room to go back to, if a game there may still be on. */
export function lastRoom(): string | null {
  try {
    const path = localStorage.getItem(ROOM_KEY);
    return path && ROOM.test(path) ? path : null;
  } catch {
    return null;
  }
}

/** The game in this room is over (or the room is gone): stop offering it on home. */
export function forgetRoom(path: string) {
  try {
    if (localStorage.getItem(ROOM_KEY) === path) localStorage.removeItem(ROOM_KEY);
  } catch {
    // Nothing to forget.
  }
}
