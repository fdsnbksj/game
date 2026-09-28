import { FirebaseError } from 'firebase/app';
import { getDoc, getDocs, limit, orderBy, query, serverTimestamp, setDoc, updateDoc, where } from 'firebase/firestore';
import { NONOGRAM_VERSION } from '../nonogram/generate';
import type { Player } from '../store';
import { ladderRef, laddersCollection } from './refs';

// The ladder in Firestore. firestore.rules checks each write's shape (isNewLadder,
// isNextLevel) and tests/rules/solves.test.ts mirrors these writes; the rules can't check
// a grid against its clues, so `npm run audit` does.

/** A solved grid as one string of 0s and 1s, row by row. */
export const packGrid = (cells: readonly number[]) => cells.map((cell) => (cell === 1 ? '1' : '0')).join('');

/** A solved level waiting to be written. */
export interface SolveWrite {
  kind: 'level';
  level: number;
  grid: string;
}

/** Errors that mean "no connection right now": the write stays queued and is tried again. */
export function isRetryable(error: unknown): boolean {
  if (!(error instanceof FirebaseError)) return true;
  return ['unavailable', 'deadline-exceeded', 'aborted', 'internal', 'unknown'].some((code) => error.code.endsWith(code));
}

/** Writes one level: the first one starts the ladder. */
export async function writeSolve(uid: string, player: Player, solve: SolveWrite) {
  if (solve.level === 1) {
    await setDoc(ladderRef(uid), {
      uid,
      name: player.displayName,
      v: NONOGRAM_VERSION,
      level: 1,
      solutions: { l1: solve.grid },
      startedAt: serverTimestamp(),
      lastAt: serverTimestamp(),
    });
  } else {
    await updateDoc(ladderRef(uid), {
      level: solve.level,
      [`solutions.l${solve.level}`]: solve.grid,
      name: player.displayName,
      lastAt: serverTimestamp(),
    });
  }
  cache = null;
}

/** The highest level this player's ladder has on the server, or 0 if it has none yet. */
export async function fetchOwnLevel(uid: string): Promise<number> {
  const own = await getDoc(ladderRef(uid));
  return own.exists() ? (own.get('level') as number) : 0;
}

export const RANKINGS_SIZE = 25;
/** Rankings change slowly; re-reading them on every visit would eat the free read quota. */
const CACHE_MS = 5 * 60 * 1000;

export interface Entry {
  uid: string;
  name: string;
  /** Highest level solved. */
  level: number;
}

export interface Ranking {
  top: Entry[];
  /** The player's own entry, whether or not it made the top. */
  mine: Entry | null;
}

let cache: { ranking: Ranking; at: number } | null = null;

/** The players furthest up this ladder, and where this player is on it. */
export async function fetchLadder(uid: string): Promise<Ranking> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.ranking;
  const snap = await getDocs(query(laddersCollection(), where('v', '==', NONOGRAM_VERSION), orderBy('level', 'desc'), limit(RANKINGS_SIZE)));
  const top = snap.docs.map((d) => ({ uid: d.get('uid') as string, name: d.get('name') as string, level: d.get('level') as number }));
  let mine = top.find((entry) => entry.uid === uid) ?? null;
  if (!mine) {
    const own = await getDoc(ladderRef(uid));
    if (own.exists()) mine = { uid, name: own.get('name'), level: own.get('level') };
  }
  const ranking = { top, mine };
  cache = { ranking, at: Date.now() };
  return ranking;
}
