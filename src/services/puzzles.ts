import { collection, doc, getDoc, getDocs, limit, orderBy, query, serverTimestamp, setDoc, updateDoc, where } from 'firebase/firestore';
import { db } from '../firebase';
import type { Placed } from '../sim/combat';
import { LADDER_VERSION } from '../sim/puzzle';
import { toSnapshot } from '../sim/validate';
import type { Player } from '../store';

// The puzzle ladder in Firestore: puzzles/{uid}_{LADDER_VERSION}, holding the highest level
// cleared and the layout that cleared each one. firestore.rules checks every write
// (isNewLadder, isNextPuzzle) and tests/rules/puzzles.test.ts mirrors these writes.

/** A layout that cleared a level: a board snapshot without the run-only fields. */
export type PuzzleBoard = { u: string[]; c: number[]; s: number[]; it?: string[]; ia?: number[] };

export function toPuzzleBoard(units: readonly Placed[]): PuzzleBoard {
  const { u, c, s, it, ia } = toSnapshot(units, units.length, '');
  return it && ia ? { u, c, s, it, ia } : { u, c, s };
}

export const ladderId = (uid: string) => `${uid}_${LADDER_VERSION}`;
const laddersCollection = () => collection(db, 'puzzles');
const ladderRef = (uid: string) => doc(db, 'puzzles', ladderId(uid));

/** A cleared level waiting to be written. */
export interface ClearWrite {
  level: number;
  board: PuzzleBoard;
}

/** Writes one clear: the first one starts the ladder. */
export async function writeClear(uid: string, player: Player, clear: ClearWrite) {
  if (clear.level === 1) {
    await setDoc(ladderRef(uid), {
      uid,
      name: player.displayName,
      v: LADDER_VERSION,
      level: 1,
      solutions: { l1: clear.board },
      startedAt: serverTimestamp(),
      lastAt: serverTimestamp(),
    });
  } else {
    await updateDoc(ladderRef(uid), {
      level: clear.level,
      [`solutions.l${clear.level}`]: clear.board,
      name: player.displayName,
      lastAt: serverTimestamp(),
    });
  }
  cache = null;
}

export interface LadderEntry {
  uid: string;
  name: string;
  level: number;
}

export interface Ladder {
  top: LadderEntry[];
  mine: LadderEntry | null;
}

export const LADDER_SIZE = 25;
/** Like the daily rankings: re-reading on every visit would eat the free read quota. */
const CACHE_MS = 5 * 60 * 1000;
let cache: { ladder: Ladder; at: number } | null = null;

const toEntry = (data: Record<string, unknown>): LadderEntry => ({
  uid: data.uid as string,
  name: data.name as string,
  level: data.level as number,
});

/** The players furthest up this ladder, and where this player is on it. */
export async function fetchLadder(uid: string): Promise<Ladder> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.ladder;
  const snap = await getDocs(query(laddersCollection(), where('v', '==', LADDER_VERSION), orderBy('level', 'desc'), limit(LADDER_SIZE)));
  const top = snap.docs.map((d) => toEntry(d.data()));
  let mine = top.find((entry) => entry.uid === uid) ?? null;
  if (!mine) {
    const own = await getDoc(ladderRef(uid));
    if (own.exists()) mine = toEntry(own.data());
  }
  const ladder = { top, mine };
  cache = { ladder, at: Date.now() };
  return ladder;
}
