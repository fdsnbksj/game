import { onAuthStateChanged, signInAnonymously } from 'firebase/auth';
import { auth } from '../firebase';
import { useGameStore } from '../store';
import { unlockEarnedItems } from './inventory';
import { loadOrCreateProfile } from './profile';

/** Signs in anonymously if needed and loads the player into the store. Returns an unsubscribe function. */
export function startSession(onError: (error: unknown) => void): () => void {
  return onAuthStateChanged(auth, (user) => {
    if (!user) {
      signInAnonymously(auth).catch(onError);
      return;
    }
    loadOrCreateProfile(user.uid)
      .then((session) => {
        useGameStore.getState().setSession({ uid: user.uid, ...session });
        // Catches up on unlocks if a previous attempt failed (e.g. the player went offline after a run).
        return unlockEarnedItems(session.profile.bestScore);
      })
      .catch(onError);
  });
}
