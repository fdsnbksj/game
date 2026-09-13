import { collection, doc } from 'firebase/firestore';
import { db } from '../firebase';
import { CURRENT_SEASON } from '../shared/constants';

export const userRef = (uid: string) => doc(db, 'users', uid);
export const inventoryCollection = (uid: string) => collection(db, 'users', uid, 'inventory');
export const inventoryRef = (uid: string, itemId: string) => doc(db, 'users', uid, 'inventory', itemId);
export const loadoutRef = (uid: string) => doc(db, 'users', uid, 'meta', 'loadout');
export const leaderboardCollection = () => collection(db, 'leaderboards', CURRENT_SEASON, 'entries');
export const leaderboardEntryRef = (uid: string) => doc(leaderboardCollection(), uid);
