import { getDoc, getDocs, limit, orderBy, query } from 'firebase/firestore';
import { rankingRef, rankingsCollection } from './refs';

export const RANKINGS_SIZE = 25;
/** Rankings change slowly; re-reading them on every visit would eat the free read quota. */
const CACHE_MS = 5 * 60 * 1000;

export interface RankingEntry {
  uid: string;
  displayName: string;
  wins: number;
  hp: number;
  score: number;
}

export interface Rankings {
  day: string;
  top: RankingEntry[];
  /** The player's own entry, whether or not it made the top. */
  mine: RankingEntry | null;
}

let cache: { rankings: Rankings; at: number } | null = null;

export function invalidateRankings() {
  cache = null;
}

const toEntry = (uid: string, data: Record<string, unknown>): RankingEntry => ({
  uid,
  displayName: data.displayName as string,
  wins: data.wins as number,
  hp: data.hp as number,
  score: data.score as number,
});

export async function fetchRankings(day: string, uid: string): Promise<Rankings> {
  if (cache && cache.rankings.day === day && Date.now() - cache.at < CACHE_MS) return cache.rankings;
  const snap = await getDocs(query(rankingsCollection(day), orderBy('score', 'desc'), limit(RANKINGS_SIZE)));
  const top = snap.docs.map((doc) => toEntry(doc.id, doc.data()));
  let mine = top.find((entry) => entry.uid === uid) ?? null;
  if (!mine) {
    const own = await getDoc(rankingRef(day, uid));
    if (own.exists()) mine = toEntry(uid, own.data());
  }
  const rankings = { day, top, mine };
  cache = { rankings, at: Date.now() };
  return rankings;
}
