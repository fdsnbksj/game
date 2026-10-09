import { validLook, type Look } from '../games/hero/look';
import { costumeOf, type CostumeId } from '../games/hero/costumes';
import { ALL_ITEMS, PITY } from '../games/hero/gacha';
import { rest, restDoc } from './resilient';

// Your wardrobe in Firestore: wardrobes/{uid}, what you've summoned, your gems and what
// you wear, so a new phone gets them back. Only you read or write it; firestore.rules
// checks its shape (tests/rules/wardrobe.test.ts). Over HTTPS, like the hero doc.

export interface WardrobeDoc {
  look: Look;
  costume: CostumeId | null;
  owned: string[];
  gems: number;
  pity: number;
  /** The day of the last free pull (YYYY-MM-DD, the phone's own calendar). */
  lastFree: string;
}

const ref = (uid: string) => restDoc('wardrobes', uid);

export async function fetchWardrobe(uid: string): Promise<WardrobeDoc | null> {
  const snap = await rest.getDoc(ref(uid));
  if (!snap.exists()) return null;
  const d = snap.data();
  const look = validLook(d.look);
  if (!look || !Array.isArray(d.owned) || !Number.isInteger(d.gems) || !Number.isInteger(d.pity)) return null;
  const owned = (d.owned as unknown[]).filter((x): x is string => typeof x === 'string' && ALL_ITEMS.includes(x));
  return {
    look,
    costume: costumeOf(d.costume)?.id ?? null,
    owned,
    gems: Math.max(0, d.gems),
    pity: Math.max(0, Math.min(PITY - 1, d.pity)),
    lastFree: typeof d.lastFree === 'string' ? d.lastFree : '',
  };
}

export async function writeWardrobe(uid: string, w: WardrobeDoc) {
  await rest.setDoc(ref(uid), { ...w, updatedAt: rest.serverTimestamp() });
}
