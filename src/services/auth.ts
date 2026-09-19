import { onAuthStateChanged, signInAnonymously } from 'firebase/auth';
import { auth } from '../firebase';
import { useGameStore } from '../store';
import { loadOrCreatePlayer } from './players';

/** Signs in anonymously if needed and loads the player into the store. Returns an unsubscribe function. */
export function startSession(onError: (error: unknown) => void): () => void {
  return onAuthStateChanged(auth, (user) => {
    if (!user) {
      signInAnonymously(auth).catch(onError);
      return;
    }
    loadOrCreatePlayer(user.uid)
      .then((player) => useGameStore.getState().setSession(user.uid, player))
      .catch(onError);
  });
}
