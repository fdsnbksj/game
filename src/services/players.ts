import { getDoc, serverTimestamp, setDoc, updateDoc, type Timestamp } from 'firebase/firestore';
import { useGameStore, type Player } from '../store';
import { legacyUserRef, playerRef } from './refs';

/** The signed-in player's profile, created on first visit. */
export async function loadOrCreatePlayer(uid: string): Promise<Player> {
  const snap = await getDoc(playerRef(uid));
  if (snap.exists()) {
    return {
      displayName: snap.get('displayName'),
      runsStarted: snap.get('runsStarted'),
      lastRunStartAt: (snap.get('lastRunStartAt') as Timestamp | null)?.toMillis() ?? 0,
    };
  }
  const displayName = (await legacyName(uid)) ?? `Player${Math.floor(1000 + Math.random() * 9000)}`;
  try {
    await setDoc(playerRef(uid), { displayName, createdAt: serverTimestamp(), runsStarted: 0, lastRunStartAt: serverTimestamp() });
  } catch (error) {
    // Another tab may have created it first.
    const again = await getDoc(playerRef(uid));
    if (!again.exists()) throw error;
    return loadOrCreatePlayer(uid);
  }
  return { displayName, runsStarted: 0, lastRunStartAt: Date.now() };
}

/** Neon Flap players keep the name they already chose. */
async function legacyName(uid: string): Promise<string | null> {
  try {
    const legacy = await getDoc(legacyUserRef(uid));
    return legacy.exists() ? (legacy.get('displayName') as string) : null;
  } catch {
    return null;
  }
}

export async function renamePlayer(displayName: string) {
  const { uid, player, setPlayer } = useGameStore.getState();
  if (!uid || !player) throw new Error('Not signed in');
  const name = displayName.trim().slice(0, 20);
  await updateDoc(playerRef(uid), { displayName: name });
  setPlayer({ ...player, displayName: name });
}
