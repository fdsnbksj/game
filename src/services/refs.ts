import { collection, doc } from 'firebase/firestore';
import { db } from '../firebase';
import type { RunMode } from '../sim/planning';

export const playerRef = (uid: string) => doc(db, 'players', uid);
export const runsCollection = () => collection(db, 'runs');
export const runRef = (runId: string) => doc(db, 'runs', runId);
/** One ranking per UTC day for each mode: ordinary runs, and the daily challenge. */
export const rankingsCollection = (day: string, mode: RunMode = 'run') =>
  collection(db, mode === 'daily' ? 'dailyRankings' : 'rankings', day, 'entries');
export const rankingRef = (day: string, uid: string, mode: RunMode = 'run') => doc(rankingsCollection(day, mode), uid);
/** The retired Neon Flap profile, read once to carry a player's name over. */
export const legacyUserRef = (uid: string) => doc(db, 'users', uid);
