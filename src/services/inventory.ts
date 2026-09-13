import { serverTimestamp, setDoc, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';
import { ITEMS } from '../shared/items';
import type { Item, Loadout } from '../shared/types';
import { requireSession } from '../store';
import { inventoryRef, loadoutRef } from './refs';

// Each unlock makes the rules read one catalog doc; batched writes allow 20 rule reads in total.
const UNLOCK_BATCH_SIZE = 10;

/** Creates inventory docs for every item the best score has earned. Returns the newly unlocked items. */
export async function unlockEarnedItems(bestScore: number): Promise<Item[]> {
  const { uid, inventory, addToInventory } = requireSession();
  const owned = new Set(inventory);
  const earned = ITEMS.filter((item) => item.unlockScore <= bestScore && !owned.has(item.id));

  for (let i = 0; i < earned.length; i += UNLOCK_BATCH_SIZE) {
    const batch = writeBatch(db);
    for (const item of earned.slice(i, i + UNLOCK_BATCH_SIZE)) {
      batch.set(inventoryRef(uid, item.id), { unlockedAt: serverTimestamp() });
    }
    await batch.commit();
  }

  addToInventory(earned.map((item) => item.id));
  return earned;
}

export async function saveLoadout(loadout: Loadout) {
  const { uid, setLoadout } = requireSession();
  await setDoc(loadoutRef(uid), loadout);
  setLoadout(loadout);
}
