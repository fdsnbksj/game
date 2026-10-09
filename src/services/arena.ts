import { collection, doc, getDoc, getDocs, limit, orderBy, query, serverTimestamp, setDoc, updateDoc, where } from 'firebase/firestore/lite';
import { dbRest as db } from '../firebase';
import type { ArenaHero } from '../games/hero/arena';
import { appearanceOf, type Appearance } from '../games/hero/look';
import { validLoadout, validTree, type SkillId, type Tree } from '../games/hero/stats';

// The Hero Gambit arena in Firestore: arena/{uid}, one per player who has beaten the first
// boss. Anyone may read it (it's the hero others fight); only its owner writes it, and
// firestore.rules caps each result. tests/rules/arena.test.ts mirrors these writes. All of it
// goes over plain HTTPS (Firestore Lite), so a stalled stream on a phone can't hold it up.

export const ARENA_TOP = 50;

export interface ArenaRecord {
  name: string;
  /** Null when it's a tree from before the prices: the next refresh replaces it. */
  tree: Tree | null;
  loadout: SkillId[] | null;
  appearance: Appearance;
  rating: number;
  wins: number;
  losses: number;
}

const arenaRef = (uid: string) => doc(db, 'arena', uid);
const arenaCollection = () => collection(db, 'arena');

function heroOf(uid: string, data: Record<string, unknown>): ArenaHero | null {
  const tree = validTree(data.tree);
  if (!tree || typeof data.name !== 'string' || !Number.isInteger(data.rating)) return null;
  return { uid, name: data.name, tree, loadout: validLoadout(data.loadout, tree) ?? undefined, rating: data.rating as number, appearance: appearanceOf(data.look, data.costume) };
}

export async function fetchOwnArena(uid: string): Promise<ArenaRecord | null> {
  const snap = await getDoc(arenaRef(uid));
  if (!snap.exists()) return null;
  const d = snap.data();
  const tree = validTree(d.tree);
  const loadout = tree && validLoadout(d.loadout, tree);
  return { name: d.name, tree, loadout, appearance: appearanceOf(d.look, d.costume), rating: d.rating, wins: d.wins, losses: d.losses };
}

export async function joinArena(uid: string, name: string, tree: Tree, loadout: SkillId[], appearance: Appearance) {
  await setDoc(arenaRef(uid), { name, tree, loadout, look: appearance.look, costume: appearance.costume, rating: 1000, wins: 0, losses: 0, lastFightAt: serverTimestamp() });
}

/** Your arena hero takes your hero's tree, loadout, look and your name as they are now. */
export async function refreshArenaHero(uid: string, name: string, tree: Tree, loadout: SkillId[], appearance: Appearance) {
  await updateDoc(arenaRef(uid), { name, tree, loadout, look: appearance.look, costume: appearance.costume });
}

export async function writeArenaResult(uid: string, record: Pick<ArenaRecord, 'rating' | 'wins' | 'losses'>) {
  await updateDoc(arenaRef(uid), { ...record, lastFightAt: serverTimestamp() });
}

/** Heroes rated within `span` of `rating` (any rating when span is null). */
export async function findOpponents(rating: number, span: number | null): Promise<ArenaHero[]> {
  const q =
    span === null
      ? query(arenaCollection(), orderBy('rating', 'desc'), limit(20))
      : query(arenaCollection(), where('rating', '>=', rating - span), where('rating', '<=', rating + span), orderBy('rating'), limit(20));
  const snap = await getDocs(q);
  return snap.docs.map((d) => heroOf(d.id, d.data())).filter((h): h is ArenaHero => h !== null);
}

export interface ArenaEntry extends ArenaHero {
  wins: number;
  losses: number;
}

export async function fetchArenaTop(): Promise<ArenaEntry[]> {
  const snap = await getDocs(query(arenaCollection(), orderBy('rating', 'desc'), limit(ARENA_TOP)));
  return snap.docs.flatMap((d) => {
    const hero = heroOf(d.id, d.data());
    return hero ? [{ ...hero, wins: d.get('wins') as number, losses: d.get('losses') as number }] : [];
  });
}
