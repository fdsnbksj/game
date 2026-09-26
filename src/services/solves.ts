import { FirebaseError } from 'firebase/app';
import { getDoc, getDocs, limit, orderBy, query, serverTimestamp, setDoc, updateDoc, where } from 'firebase/firestore';
import { NONOGRAM_VERSION } from '../nonogram/generate';
import type { Player } from '../store';
import { dailySolveRef, dailySolvesCollection, ladderRef, laddersCollection } from './refs';

// Solves in Firestore. firestore.rules checks each write's shape (isNewLadder,
// isNextLevel, isDailySolve) and tests/rules/solves.test.ts mirrors these writes; the
// rules can't check a grid against its clues, so `npm run audit` does.

/** A solved grid as one string of 0s and 1s, row by row. */
export const packGrid = (cells: readonly number[]) => cells.map((cell) => (cell === 1 ? '1' : '0')).join('');

/** A solve waiting to be written. */
export type SolveWrite = { kind: 'level'; level: number; grid: string } | { kind: 'daily'; day: string; grid: string };

/** Errors that mean "no connection right now": the write stays queued and is tried again. */
export function isRetryable(error: unknown): boolean {
  if (!(error instanceof FirebaseError)) return true;
  return ['unavailable', 'deadline-exceeded', 'aborted', 'internal', 'unknown'].some((code) => error.code.endsWith(code));
}

export async function writeSolve(uid: string, player: Player, solve: SolveWrite) {
  if (solve.kind === 'daily') {
    await setDoc(dailySolveRef(solve.day, uid), {
      name: player.displayName,
      v: NONOGRAM_VERSION,
      g: solve.grid,
      solvedAt: serverTimestamp(),
    });
    dailyCache.delete(solve.day);
  } else if (solve.level === 1) {
    await setDoc(ladderRef(uid), {
      uid,
      name: player.displayName,
      v: NONOGRAM_VERSION,
      level: 1,
      solutions: { l1: solve.grid },
      startedAt: serverTimestamp(),
      lastAt: serverTimestamp(),
    });
    ladderCache = null;
  } else {
    await updateDoc(ladderRef(uid), {
      level: solve.level,
      [`solutions.l${solve.level}`]: solve.grid,
      name: player.displayName,
      lastAt: serverTimestamp(),
    });
    ladderCache = null;
  }
}

export const RANKINGS_SIZE = 25;
/** Rankings change slowly; re-reading them on every visit would eat the free read quota. */
const CACHE_MS = 5 * 60 * 1000;

export interface Entry {
  uid: string;
  name: string;
  /** Highest level cleared, on the ladder; order of solving, on a day. */
  value: number;
}

export interface Ranking {
  top: Entry[];
  /** The player's own entry, whether or not it made the top. */
  mine: Entry | null;
}

let ladderCache: { ranking: Ranking; at: number } | null = null;
const dailyCache = new Map<string, { ranking: Ranking; at: number }>();

/** The players furthest up this ladder, and where this player is on it. */
export async function fetchLadder(uid: string): Promise<Ranking> {
  if (ladderCache && Date.now() - ladderCache.at < CACHE_MS) return ladderCache.ranking;
  const snap = await getDocs(query(laddersCollection(), where('v', '==', NONOGRAM_VERSION), orderBy('level', 'desc'), limit(RANKINGS_SIZE)));
  const top = snap.docs.map((d) => ({ uid: d.get('uid') as string, name: d.get('name') as string, value: d.get('level') as number }));
  let mine = top.find((entry) => entry.uid === uid) ?? null;
  if (!mine) {
    const own = await getDoc(ladderRef(uid));
    if (own.exists()) mine = { uid, name: own.get('name'), value: own.get('level') };
  }
  const ranking = { top, mine };
  ladderCache = { ranking, at: Date.now() };
  return ranking;
}

/** The first players to solve a day's puzzle, in the order they did. */
export async function fetchDaily(day: string, uid: string): Promise<Ranking> {
  const hit = dailyCache.get(day);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.ranking;
  const snap = await getDocs(query(dailySolvesCollection(day), orderBy('solvedAt', 'asc'), limit(RANKINGS_SIZE)));
  const top = snap.docs.map((d, i) => ({ uid: d.id, name: d.get('name') as string, value: i + 1 }));
  let mine = top.find((entry) => entry.uid === uid) ?? null;
  if (!mine) {
    const own = await getDoc(dailySolveRef(day, uid));
    // Solved, but outside the top; its exact place would cost another query.
    if (own.exists()) mine = { uid, name: own.get('name'), value: 0 };
  }
  const ranking = { top, mine };
  dailyCache.set(day, { ranking, at: Date.now() });
  return ranking;
}
