import { collection, doc } from 'firebase/firestore';
import { db } from '../firebase';
import { NONOGRAM_VERSION } from '../nonogram/generate';

export const playerRef = (uid: string) => doc(db, 'players', uid);
/** One ladder per player per generator version: a new generator makes new puzzles. */
export const laddersCollection = () => collection(db, 'ladders');
export const ladderRef = (uid: string) => doc(db, 'ladders', `${uid}_${NONOGRAM_VERSION}`);
/** Who solved each UTC day's puzzle, one entry per player. */
export const dailySolvesCollection = (day: string) => collection(db, 'dailySolves', day, 'entries');
export const dailySolveRef = (day: string, uid: string) => doc(dailySolvesCollection(day), uid);
/** The retired Neon Flap profile, read once to carry a player's name over. */
export const legacyUserRef = (uid: string) => doc(db, 'users', uid);
