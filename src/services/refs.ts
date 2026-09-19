import { collection, doc } from 'firebase/firestore';
import { db } from '../firebase';

export const playerRef = (uid: string) => doc(db, 'players', uid);
export const runsCollection = () => collection(db, 'runs');
export const runRef = (runId: string) => doc(db, 'runs', runId);
/** One ranking per UTC day, holding each player's best finished run that day. */
export const rankingsCollection = (day: string) => collection(db, 'rankings', day, 'entries');
export const rankingRef = (day: string, uid: string) => doc(rankingsCollection(day), uid);
/** The retired Neon Flap profile, read once to carry a player's name over. */
export const legacyUserRef = (uid: string) => doc(db, 'users', uid);
