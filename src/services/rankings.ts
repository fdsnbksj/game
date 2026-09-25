import { getDoc, getDocs, limit, orderBy, query } from 'firebase/firestore';
import { rankingRef, rankingsCollection } from './refs';
import type { RunMode } from '../sim/planning';

export const RANKINGS_SIZE = 25;
/** Rankings change slowly; re-reading them on every visit would eat the free read quota. */
const CACHE_MS = 5 * 60 * 1000;

export interface RankingEntry {
  uid: string;
  displayName: string;
  wins: number;
  /** The round the run ended in; missing on entries filed before it was recorded. */
  round?: number;
  score: number;
}

export interface Rankings {
  day: string;
  mode: RunMode;
  top: RankingEntry[];
  /** The player's own entry, whether or not it made the top. */
  mine: RankingEntry | null;
}

const cache = new Map<string, { rankings: Rankings; at: number }>();

export function invalidateRankings() {
  cache.clear();
}

const toEntry = (uid: string, data: Record<string, unknown>): RankingEntry => ({
  uid,
  displayName: data.displayName as string,
  wins: data.wins as number,
  round: data.round as number | undefined,
  score: data.score as number,
});

export async function fetchRankings(day: string, uid: string, mode: RunMode = 'run'): Promise<Rankings> {
  const key = `${mode}:${day}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.rankings;
  const snap = await getDocs(query(rankingsCollection(day, mode), orderBy('score', 'desc'), limit(RANKINGS_SIZE)));
  const top = snap.docs.map((doc) => toEntry(doc.id, doc.data()));
  let mine = top.find((entry) => entry.uid === uid) ?? null;
  if (!mine) {
    const own = await getDoc(rankingRef(day, uid, mode));
    if (own.exists()) mine = toEntry(uid, own.data());
  }
  const rankings = { day, mode, top, mine };
  cache.set(key, { rankings, at: Date.now() });
  return rankings;
}
