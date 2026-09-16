import { getDoc, getDocs, serverTimestamp, updateDoc, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';
import { dayId } from '../shared/constants';
import { COSMETIC_SLOTS, DEFAULT_ITEM_IDS, DEFAULT_LOADOUT, getItem } from '../shared/items';
import type { Loadout, UserProfile } from '../shared/types';
import { requireSession } from '../store';
import { inventoryCollection, inventoryRef, loadoutRef, userRef } from './refs';

export async function loadOrCreateProfile(uid: string) {
  const userSnap = await getDoc(userRef(uid));
  if (!userSnap.exists()) return createProfile(uid);

  const [inventorySnap, loadoutSnap] = await Promise.all([getDocs(inventoryCollection(uid)), getDoc(loadoutRef(uid))]);
  const profile: UserProfile = {
    displayName: userSnap.get('displayName'),
    bestScore: userSnap.get('bestScore'),
    gamesPlayed: userSnap.get('gamesPlayed'),
    // Profiles from before daily scores existed have neither field.
    dailyId: userSnap.get('dailyId') ?? '',
    dailyScore: userSnap.get('dailyScore') ?? 0,
  };
  const stored = loadoutSnap.data() as Loadout | undefined;
  return {
    profile,
    inventory: inventorySnap.docs.map((d) => d.id),
    loadout: isCurrentLoadout(stored) ? stored : DEFAULT_LOADOUT,
  };
}

/** A loadout saved by an older version can name items that no longer exist. */
function isCurrentLoadout(loadout: Loadout | undefined): loadout is Loadout {
  return loadout !== undefined && COSMETIC_SLOTS.every((slot) => getItem(loadout[slot])?.slot === slot);
}

// One batch so the rules never see a player without their starter items and loadout.
async function createProfile(uid: string) {
  const profile: UserProfile = {
    displayName: `Player${Math.floor(1000 + Math.random() * 9000)}`,
    bestScore: 0,
    gamesPlayed: 0,
    dailyId: dayId(),
    dailyScore: 0,
  };
  const batch = writeBatch(db);
  batch.set(userRef(uid), { ...profile, createdAt: serverTimestamp(), lastRunAt: serverTimestamp() });
  for (const itemId of DEFAULT_ITEM_IDS) {
    batch.set(inventoryRef(uid, itemId), { unlockedAt: serverTimestamp() });
  }
  batch.set(loadoutRef(uid), DEFAULT_LOADOUT);
  await batch.commit();
  return { profile, inventory: [...DEFAULT_ITEM_IDS], loadout: DEFAULT_LOADOUT };
}

export async function renamePlayer(displayName: string) {
  const { uid, profile, setProfile } = requireSession();
  const name = displayName.trim().slice(0, 20);
  await updateDoc(userRef(uid), { displayName: name });
  setProfile({ ...profile, displayName: name });
}
