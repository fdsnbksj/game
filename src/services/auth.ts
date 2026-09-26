import { onAuthStateChanged, signInAnonymously, type User } from 'firebase/auth';
import { auth } from '../firebase';
import { useGameStore } from '../store';
import { loadOrCreatePlayer } from './players';

/** How long to wait before trying again when there's no connection (a tunnel, say). */
const RETRY_MS = 30_000;

/**
 * Signs in anonymously if needed and loads the player into the store, in the background.
 * Offline it keeps retrying, sooner if the browser says the connection is back.
 * Returns an unsubscribe function.
 */
export function startSession(): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let stopped = false;

  const retry = (attempt: () => void) => (error: unknown) => {
    console.warn('Offline for now:', error);
    if (stopped) return;
    const again = () => {
      clearTimeout(timer);
      window.removeEventListener('online', again);
      if (!stopped) attempt();
    };
    timer = setTimeout(again, RETRY_MS);
    window.addEventListener('online', again);
  };

  const signIn = () => void signInAnonymously(auth).catch(retry(signIn));
  const load = (user: User) => {
    const attempt = () =>
      void loadOrCreatePlayer(user.uid)
        .then((player) => useGameStore.getState().setSession(user.uid, player))
        .catch(retry(attempt));
    attempt();
  };

  const unsubscribe = onAuthStateChanged(auth, (user) => (user ? load(user) : signIn()));
  return () => {
    stopped = true;
    clearTimeout(timer);
    unsubscribe();
  };
}
