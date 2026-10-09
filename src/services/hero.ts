import { FirebaseError } from 'firebase/app';
import type { Unsubscribe } from 'firebase/firestore';
import { appearanceOf, type Appearance } from '../games/hero/look';
import type { Move } from '../games/hero/skills';
import type { Recorded } from '../games/hero/state';
import { defaultLoadout, FRESH_TREE, validLoadout, validTree, type SkillId, type Tree } from '../games/hero/stats';
import { useGameStore } from '../store';
import { followRoom, poke, rest, restDoc } from './resilient';
import { newCode } from './roomCode';

// Hero Gambit in Firestore. heroes/{uid} is your hero (levels cleared and the tree), which
// only you can read or write; firestore.rules caps the tree by the points those levels give.
// heroDuels/{code} is a fight between two phones: each player brings the tree on their hero
// doc (the rules compare them), and the moves are appended in order, one document each.
// tests/rules/hero.test.ts mirrors these writes.
//
// Room writes go over plain HTTPS and rooms are followed with a backup read, as in every
// party game (src/services/resilient.ts says why).

export interface HeroDoc {
  cleared: number;
  tree: Tree;
  /** Paid resets so far: each one costs a point more. */
  resets: number;
  /** The skills the hero fights with. */
  loadout: SkillId[];
  /** What the hero wears, shown to opponents. */
  appearance: Appearance;
}

/** A hero doc as read: `legacy` when it's from before the prices and gets its one free refund. */
export interface ServerHero extends HeroDoc {
  legacy: boolean;
}

const heroRef = (uid: string) => restDoc('heroes', uid);

export async function fetchHero(uid: string): Promise<ServerHero | null> {
  const snap = await rest.getDoc(heroRef(uid));
  if (!snap.exists()) return null;
  const d = snap.data();
  if (!Number.isInteger(d.cleared)) return null;
  const legacy = !Number.isInteger(d.resets);
  const resets = legacy ? 0 : (d.resets as number);
  // A tree that doesn't fit the prices (one from before them) comes back as a fresh one.
  const tree = validTree(d.tree, d.cleared, resets) ?? FRESH_TREE;
  const loadout = validLoadout(d.loadout, tree) ?? defaultLoadout(tree);
  return { cleared: d.cleared, tree, resets, loadout, appearance: appearanceOf(d.look, d.costume), legacy };
}

/** One write: the rules let `cleared` go up by at most one at a time. */
export async function writeHero(uid: string, hero: HeroDoc) {
  await rest.setDoc(heroRef(uid), {
    cleared: hero.cleared,
    tree: hero.tree,
    resets: hero.resets,
    loadout: hero.loadout,
    look: hero.appearance.look,
    costume: hero.appearance.costume,
    updatedAt: rest.serverTimestamp(),
  });
}

// ---------- Rooms ----------

export interface HeroRoom {
  code: string;
  host: string;
  playerIds: string[];
  names: Record<string, string>;
  /** Each player's tree, as it was on their hero when they came in. */
  fighters: Record<string, Tree>;
  /** Each player's look and costume, from their hero doc too. */
  looks: Record<string, Appearance>;
  /** Each player's loadout, from their hero doc too. */
  loadouts: Record<string, SkillId[]>;
  status: 'lobby' | 'playing' | 'done';
  seed: string | null;
}

const roomRest = (code: string) => restDoc('heroDuels', code);
const moveRest = (code: string, n: number) => restDoc('heroDuels', code, 'moves', String(n));

function me() {
  const { uid, player } = useGameStore.getState();
  if (!uid || !player) throw new Error('Not connected yet. Try again in a moment.');
  return { uid, name: player.displayName };
}

/** `ready` puts your hero doc up to date first, since the rules check the tree (read after it) against it. */
export async function createHeroRoom(heroTree: () => Tree, loadout: () => SkillId[], appearance: () => Appearance, ready: () => Promise<void>): Promise<string> {
  const { uid, name } = me();
  await ready();
  const tree = heroTree();
  const loadouts = { [uid]: loadout() };
  const looks = { [uid]: appearance() };
  for (let tries = 0; tries < 5; tries++) {
    const code = newCode();
    try {
      await rest.setDoc(roomRest(code), { host: uid, playerIds: [uid], names: { [uid]: name }, fighters: { [uid]: tree }, looks, loadouts, status: 'lobby', createdAt: rest.serverTimestamp() });
      return code;
    } catch (error) {
      if (!(error instanceof FirebaseError && error.code === 'permission-denied')) throw error;
    }
  }
  throw new Error('Could not open a room. Try again.');
}

/** Joins as the second player. Returns why not, if you can't. */
export async function joinHeroRoom(code: string, heroTree: () => Tree, loadout: () => SkillId[], appearance: () => Appearance, ready: () => Promise<void>): Promise<string | null> {
  const { uid, name } = me();
  const snap = await rest.getDoc(roomRest(code));
  if (!snap.exists()) return 'No room with that code.';
  const room = snap.data();
  if ((room.playerIds as string[]).includes(uid)) return null;
  if (room.status !== 'lobby' || room.playerIds.length >= 2) return 'That fight is full.';
  await ready();
  const tree = heroTree();
  await rest.updateDoc(roomRest(code), {
    playerIds: [...room.playerIds, uid],
    names: { ...room.names, [uid]: name },
    fighters: { ...room.fighters, [uid]: tree },
    looks: { ...(room.looks ?? {}), [uid]: appearance() },
    loadouts: { ...(room.loadouts ?? {}), [uid]: loadout() },
  });
  poke(`heroDuels/${code}`);
  return null;
}

export async function startHeroRoom(code: string) {
  const seed = Array.from(crypto.getRandomValues(new Uint32Array(3)), (n) => n.toString(36)).join('');
  await rest.updateDoc(roomRest(code), { status: 'playing', seed, startedAt: rest.serverTimestamp() });
  poke(`heroDuels/${code}`);
}

export async function sendHeroMove(code: string, n: number, move: Move) {
  const { uid } = me();
  await rest.setDoc(moveRest(code, n), { n, by: uid, move });
  poke(`heroDuels/${code}`);
}

export async function finishHeroRoom(code: string) {
  await rest.updateDoc(roomRest(code), { status: 'done', endedAt: rest.serverTimestamp() });
  poke(`heroDuels/${code}`);
}

export interface HeroRoomData {
  room: HeroRoom | null;
  missing: boolean;
  moves: Recorded[];
}

/**
 * Follows a room and its moves: live listeners, backed up by reads over HTTPS every few
 * seconds and right after each write (src/services/resilient.ts).
 */
export function watchHeroRoom(code: string, uid: string, onChange: (data: HeroRoomData) => void): Unsubscribe {
  return followRoom<HeroRoom, Move>(
    'heroDuels',
    code,
    (d) => ({
      code,
      host: d.host as string,
      playerIds: d.playerIds as string[],
      names: d.names as Record<string, string>,
      fighters: d.fighters as Record<string, Tree>,
      looks: Object.fromEntries(Object.entries((d.looks as Record<string, { look?: unknown; costume?: unknown }> | undefined) ?? {}).map(([k, v]) => [k, appearanceOf(v?.look, v?.costume)])),
      loadouts: (d.loadouts as Record<string, SkillId[]> | undefined) ?? {},
      status: d.status as HeroRoom['status'],
      seed: (d.seed as string | undefined) ?? null,
    }),
    // Only the two players may read the moves, once the fight has started.
    (room) => room.playerIds.includes(uid) && room.status !== 'lobby',
    onChange,
  );
}
