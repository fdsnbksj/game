import { create } from 'zustand';
import { BOT_LEVELS } from './games/hero/bots';
import type { Move } from './games/hero/skills';
import { HERO_VERSION, type Recorded } from './games/hero/state';
import { BOT_COUNT, buy, canBuy, FRESH_TREE, pointsFor, rewardFor, spent, validTree, type NodeId, type Tree } from './games/hero/stats';
import { fetchHero, writeHero } from './services/hero';
import { isRetryable } from './services/solves';
import { useGameStore } from './store';

// Your hero, saved to localStorage the moment anything changes (levels cleared, the tree,
// every move of a bot fight), then synced to heroes/{uid} in the background. A key of its
// own, so the other games' saves are untouched.

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

interface Saved {
  owner: string | null;
  /** The highest bot level beaten (0 to 20). */
  cleared: number;
  tree: Tree;
  fight: BotFight | null;
  /** Something changed that the server doesn't have yet. */
  dirty: boolean;
}

const fresh = (): Saved => ({ owner: null, cleared: 0, tree: FRESH_TREE, fight: null, dirty: false });

function load(): Saved {
  try {
    const saved = { ...fresh(), ...(JSON.parse(localStorage.getItem(KEY) ?? 'null') as Partial<Saved> | null) };
    const cleared = Number.isInteger(saved.cleared) ? Math.max(0, Math.min(BOT_COUNT, saved.cleared)) : 0;
    const tree = validTree(saved.tree, cleared) ?? FRESH_TREE;
    const fight = saved.fight && saved.fight.v === HERO_VERSION && validTree(saved.fight.tree) ? saved.fight : null;
    return { owner: saved.owner ?? null, cleared, tree, fight, dirty: !!saved.dirty };
  } catch {
    return fresh();
  }
}

function save({ owner, cleared, tree, fight, dirty }: Saved) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ owner, cleared, tree, fight, dirty }));
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
  claim: (uid: string) => void;
  /** Writes the hero to Firestore if it changed. Resolves once done (or given up for now). */
  sync: () => Promise<void>;
}

let syncing: Promise<void> | null = null;

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
      if (!local.dirty && server) return;
      // The rules let `cleared` rise by one a write; levels beaten offline go up step by step
      // with the server's tree (or a fresh one), and the last write carries this phone's tree.
      const base = server ?? { cleared: 0, tree: FRESH_TREE };
      for (let c = base.cleared + 1; c < local.cleared; c++) await writeHero(uid, { cleared: c, tree: base.tree });
      const { cleared, tree } = get();
      await writeHero(uid, { cleared, tree });
      if (get().cleared === cleared && get().tree === tree) update({ dirty: false });
    } catch (error) {
      if (isRetryable(error)) return; // Still dirty: the next change or connection tries again.
      console.warn('Firestore refused the hero:', error);
      update({ dirty: false });
    }
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

    claim: (uid) => {
      const { owner } = get();
      if (owner !== null && owner !== uid) update({ ...fresh(), owner: uid });
      else update({ owner: uid });
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
