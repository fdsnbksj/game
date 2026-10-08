import { create } from 'zustand';
import { ARENA_UNLOCK, ratingChange, RESULT_SPACING_MS, START_RATING, type ArenaHero } from './games/hero/arena';
import { BOT_LEVELS } from './games/hero/bots';
import type { Move } from './games/hero/skills';
import { HERO_VERSION, type Recorded } from './games/hero/state';
import { BOT_COUNT, buy, canBuy, FRESH_TREE, NODES, pointsFor, rewardFor, spent, validTree, type NodeId, type Tree } from './games/hero/stats';
import { fetchOwnArena, joinArena, refreshArenaHero, writeArenaResult, type ArenaRecord } from './services/arena';
import { fetchHero, writeHero } from './services/hero';
import { isRetryable } from './services/solves';
import { useGameStore } from './store';

// Your hero, saved to localStorage the moment anything changes (levels cleared, the tree,
// every move of a bot or arena fight), then synced to heroes/{uid} in the background, and
// to arena/{uid} once the arena is open. Arena results count here at once and are queued
// for Firestore, written in order and spaced out as the rules require. A key of its own,
// so the other games' saves are untouched.

const KEY = 'game:hero';

/** The ids a bot fight's moves are recorded by: you are fighter 0. */
export const BOT_PLAYERS = ['me', 'bot'] as const;

export interface BotFight {
  v: number;
  level: number;
  seed: string;
  /** Your tree when the fight began, so buying a node mid-fight can't change it. */
  tree: Tree;
  moves: Recorded[];
}

/** A fight against another player's hero, played by the bot brain on this phone. */
export interface ArenaFight {
  v: number;
  seed: string;
  tree: Tree;
  opponent: ArenaHero;
  moves: Recorded[];
}

export interface ArenaStanding {
  rating: number;
  wins: number;
  losses: number;
}

/** A result counted here, waiting to be written. */
interface ArenaResult {
  delta: number;
  won: boolean;
}

interface Saved {
  owner: string | null;
  /** The highest bot level beaten (0 to 20). */
  cleared: number;
  tree: Tree;
  fight: BotFight | null;
  /** Something changed that the server doesn't have yet. */
  dirty: boolean;
  /** Your arena standing, results still queued included; null until the arena opens. */
  arena: ArenaStanding | null;
  arenaFight: ArenaFight | null;
  arenaPending: ArenaResult[];
  /** When the last result was written (ms, client clock), to space the next. */
  lastResultAt: number;
}

const fresh = (): Saved => ({ owner: null, cleared: 0, tree: FRESH_TREE, fight: null, dirty: false, arena: null, arenaFight: null, arenaPending: [], lastResultAt: 0 });

function load(): Saved {
  try {
    const saved = { ...fresh(), ...(JSON.parse(localStorage.getItem(KEY) ?? 'null') as Partial<Saved> | null) };
    const cleared = Number.isInteger(saved.cleared) ? Math.max(0, Math.min(BOT_COUNT, saved.cleared)) : 0;
    const tree = validTree(saved.tree, cleared) ?? FRESH_TREE;
    const fight = saved.fight && saved.fight.v === HERO_VERSION && validTree(saved.fight.tree) ? saved.fight : null;
    const arenaFight =
      saved.arenaFight && saved.arenaFight.v === HERO_VERSION && validTree(saved.arenaFight.tree) && validTree(saved.arenaFight.opponent?.tree) ? saved.arenaFight : null;
    const arenaPending = Array.isArray(saved.arenaPending) ? saved.arenaPending : [];
    return { owner: saved.owner ?? null, cleared, tree, fight, dirty: !!saved.dirty, arena: saved.arena ?? null, arenaFight, arenaPending, lastResultAt: saved.lastResultAt ?? 0 };
  } catch {
    return fresh();
  }
}

function save({ owner, cleared, tree, fight, dirty, arena, arenaFight, arenaPending, lastResultAt }: Saved) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ owner, cleared, tree, fight, dirty, arena, arenaFight, arenaPending, lastResultAt }));
  } catch {
    // Private mode or full storage: the hero lasts this visit.
  }
}

interface HeroStore extends Saved {
  /** Points earned and not yet spent. */
  unspent: () => number;
  buy: (node: NodeId) => void;
  /** Every point back, for free. */
  reset: () => void;
  /** A new fight against a bot level you've reached. */
  startFight: (level: number) => void;
  /** Your move or the bot's, in a bot fight. */
  play: (by: 'me' | 'bot', move: Move) => void;
  /** The bot fight ended; counts a first win's points. Returns the points gained. */
  endFight: (won: boolean) => number;
  quitFight: () => void;
  /** The arena is open once the first boss is beaten. */
  arenaOpen: () => boolean;
  startArenaFight: (opponent: ArenaHero) => void;
  playArena: (by: 'me' | 'bot', move: Move) => void;
  /** Counts the arena fight (giving up is a loss) and queues it. Returns the rating change. */
  endArenaFight: (won: boolean) => number;
  claim: (uid: string) => void;
  /** Writes the hero to Firestore if it changed. Resolves once done (or given up for now). */
  sync: () => Promise<void>;
}

let syncing: Promise<void> | null = null;
/** Whether this session has read the arena doc yet (a new phone catches up to it). */
let arenaRead = false;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, Math.max(0, Math.min(ms, 60_000))));
const sameTree = (a: Tree, b: Tree) => NODES.every((n) => a[n.id] === b[n.id]);
const standingOf = (r: ArenaRecord): ArenaStanding => ({ rating: r.rating, wins: r.wins, losses: r.losses });

export const useHeroStore = create<HeroStore>()((set, get) => {
  const update = (change: Partial<Saved>) => {
    set(change);
    save(get());
  };
  const changed = (change: Partial<Saved>) => {
    update({ ...change, dirty: true });
    void get().sync();
  };

  const runSync = async () => {
    const { uid } = useGameStore.getState();
    if (!uid) return;
    try {
      const server = await fetchHero(uid);
      const local = get();
      // Another phone (or cleared storage here) is further along: take its hero.
      if (server && server.cleared > local.cleared) {
        update({ cleared: server.cleared, tree: server.tree, dirty: false });
        return;
      }
      if (!local.dirty && server) return await syncArena(uid);
      // The rules let `cleared` rise by one a write; levels beaten offline go up step by step
      // with the server's tree (or a fresh one), and the last write carries this phone's tree.
      const base = server ?? { cleared: 0, tree: FRESH_TREE };
      for (let c = base.cleared + 1; c < local.cleared; c++) await writeHero(uid, { cleared: c, tree: base.tree });
      const { cleared, tree } = get();
      await writeHero(uid, { cleared, tree });
      if (get().cleared === cleared && get().tree === tree) update({ dirty: false });
      await syncArena(uid);
    } catch (error) {
      if (isRetryable(error)) return; // Still dirty: the next change or connection tries again.
      console.warn('Firestore refused the hero:', error);
      update({ dirty: false });
    }
  };

  /** Joins the arena, keeps your arena hero like your hero, and writes queued results. */
  const syncArena = async (uid: string) => {
    const name = useGameStore.getState().player?.displayName;
    if (!name || get().cleared < ARENA_UNLOCK || get().dirty) return;
    const found = await fetchOwnArena(uid);
    if (!found) await joinArena(uid, name, get().tree);
    else if (!sameTree(found.tree, get().tree) || found.name !== name) await refreshArenaHero(uid, name, get().tree);
    let server: ArenaRecord = found ?? { name, tree: get().tree, rating: START_RATING, wins: 0, losses: 0 };
    // Nothing queued: the server's standing is the true one (another phone may have fought).
    if (!arenaRead && !get().arenaPending.length) update({ arena: standingOf(server) });
    arenaRead = true;
    while (get().arenaPending.length) {
      const [next] = get().arenaPending;
      await sleep(get().lastResultAt + RESULT_SPACING_MS - Date.now());
      const record: ArenaStanding = {
        rating: server.rating + next.delta,
        wins: server.wins + (next.won ? 1 : 0),
        losses: server.losses + (next.won ? 0 : 1),
      };
      try {
        await writeArenaResult(uid, record);
        server = { ...server, ...record };
      } catch (error) {
        if (isRetryable(error)) throw error;
        // Refused (too soon, say): this result stays on this phone only.
        console.warn('Firestore refused an arena result:', error);
      }
      update({ arenaPending: get().arenaPending.slice(1), lastResultAt: Date.now() });
    }
    update({ arena: standingOf(server) });
  };

  return {
    ...load(),

    unspent: () => {
      const { cleared, tree } = get();
      return pointsFor(cleared) - spent(tree);
    },

    buy: (node) => {
      const { tree, cleared } = get();
      if (canBuy(tree, node, cleared)) changed({ tree: buy(tree, node) });
    },

    reset: () => changed({ tree: FRESH_TREE }),

    startFight: (level) => {
      if (level < 1 || level > Math.min(BOT_COUNT, get().cleared + 1)) return;
      const seed = Array.from(crypto.getRandomValues(new Uint32Array(3)), (n) => n.toString(36)).join('');
      update({ fight: { v: HERO_VERSION, level, seed, tree: get().tree, moves: [] } });
    },

    play: (by, move) => {
      const { fight } = get();
      if (fight) update({ fight: { ...fight, moves: [...fight.moves, { by, move }] } });
    },

    endFight: (won) => {
      const { fight, cleared } = get();
      if (!fight) return 0;
      const first = won && fight.level === cleared + 1;
      if (!first) {
        update({ fight: null });
        return 0;
      }
      changed({ fight: null, cleared: fight.level });
      return rewardFor(fight.level);
    },

    quitFight: () => update({ fight: null }),

    arenaOpen: () => get().cleared >= ARENA_UNLOCK,

    startArenaFight: (opponent) => {
      if (!get().arenaOpen() || get().arenaFight) return;
      const seed = Array.from(crypto.getRandomValues(new Uint32Array(3)), (n) => n.toString(36)).join('');
      update({
        arena: get().arena ?? { rating: START_RATING, wins: 0, losses: 0 },
        arenaFight: { v: HERO_VERSION, seed, tree: get().tree, opponent, moves: [] },
      });
    },

    playArena: (by, move) => {
      const { arenaFight } = get();
      if (arenaFight) update({ arenaFight: { ...arenaFight, moves: [...arenaFight.moves, { by, move }] } });
    },

    endArenaFight: (won) => {
      const { arenaFight, arena, arenaPending } = get();
      if (!arenaFight || !arena) return 0;
      const delta = ratingChange(arena.rating, arenaFight.opponent.rating, won);
      update({
        arenaFight: null,
        arena: { rating: arena.rating + delta, wins: arena.wins + (won ? 1 : 0), losses: arena.losses + (won ? 0 : 1) },
        arenaPending: [...arenaPending, { delta, won }],
      });
      void get().sync();
      return delta;
    },

    claim: (uid) => {
      const { owner } = get();
      if (owner !== null && owner !== uid) update({ ...fresh(), owner: uid });
      else update({ owner: uid });
      arenaRead = false;
    },

    sync: async () => {
      // One at a time; a change made during a sync is caught by the sync after it.
      while (syncing) await syncing;
      syncing = runSync().finally(() => (syncing = null));
      await syncing;
    },
  };
});

/** Your hero is on the server as it is here: rooms check the tree you bring against it. */
export async function heroReady() {
  await useHeroStore.getState().sync();
  if (useHeroStore.getState().dirty) throw new Error("Couldn't save your hero. Check the connection and try again.");
}

export const botLevel = (level: number) => BOT_LEVELS[Math.max(1, Math.min(BOT_COUNT, level)) - 1];

// Sync as soon as there's a session, and whenever the connection returns.
useGameStore.subscribe((session, before) => {
  if (session.uid && session.player && (session.uid !== before.uid || !before.player)) {
    useHeroStore.getState().claim(session.uid);
    void useHeroStore.getState().sync();
  }
});
if (typeof window !== 'undefined') window.addEventListener('online', () => void useHeroStore.getState().sync());
