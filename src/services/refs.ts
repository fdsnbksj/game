import { collection, doc } from 'firebase/firestore';
import { db } from '../firebase';

export const userRef = (uid: string) => doc(db, 'users', uid);
export const inventoryCollection = (uid: string) => collection(db, 'users', uid, 'inventory');
export const inventoryRef = (uid: string, itemId: string) => doc(db, 'users', uid, 'inventory', itemId);
export const loadoutRef = (uid: string) => doc(db, 'users', uid, 'meta', 'loadout');
/** One leaderboard per day, keyed by the UTC day id. */
export const leaderboardCollection = (day: string) => collection(db, 'leaderboards', day, 'entries');
export const leaderboardEntryRef = (day: string, uid: string) => doc(leaderboardCollection(day), uid);
