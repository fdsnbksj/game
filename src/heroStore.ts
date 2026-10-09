import { create } from 'zustand';
import { ARENA_UNLOCK, ratingChange, RESULT_SPACING_MS, START_RATING, type ArenaHero } from './games/hero/arena';
import { BOT_LEVELS } from './games/hero/bots';
import type { CostumeId } from './games/hero/costumes';
import { gemsFor } from './games/hero/gacha';
import type { Appearance } from './games/hero/look';
import type { Move } from './games/hero/skills';
import { HERO_VERSION, type Recorded } from './games/hero/state';
import {
  available,
  BOT_COUNT,
  buy,
  canBuy,
  canReset,
  defaultLoadout,
  FRESH_TREE,
  isUpgrade,
  LOADOUT_SIZE,
  NODES,
  rewardFor,
  SKILLS,
  validLoadout,
  validTree,
  type NodeId,
  type SkillId,
  type Tree,
} from './games/hero/stats';
import { fetchOwnArena, joinArena, refreshArenaHero, writeArenaResult, type ArenaRecord } from './services/arena';
import { fetchHero, writeHero } from './services/hero';
import { isRetryable } from './services/solves';
import { useGameStore } from './store';
import { useWardrobeStore } from './wardrobeStore';

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
  loadout?: SkillId[];
  /** Your costume when it began, for its bonus. */
  costume?: CostumeId | null;
  moves: Recorded[];
}

/** A fight against another player's hero, played by the bot brain on this phone. */
export interface ArenaFight {
  v: number;
  seed: string;
  tree: Tree;
  loadout?: SkillId[];
  costume?: CostumeId | null;
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
  /** Paid resets so far: the next costs one more point. */
  resets: number;
  /** The skills you fight with (up to four). */
  loadout: SkillId[];
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

const fresh = (): Saved => ({ owner: null, cleared: 0, tree: FRESH_TREE, resets: 0, loadout: ['stopwatch'], fight: null, dirty: false, arena: null, arenaFight: null, arenaPending: [], lastResultAt: 0 });

function load(): Saved {
  try {
    const saved = { ...fresh(), ...(JSON.parse(localStorage.getItem(KEY) ?? 'null') as Partial<Saved> | null) };
    const cleared = Number.isInteger(saved.cleared) ? Math.max(0, Math.min(BOT_COUNT, saved.cleared)) : 0;
    const resets = Number.isInteger(saved.resets) && saved.resets >= 0 ? saved.resets : 0;
    // A tree that doesn't fit the prices (one from before them) is refunded, for free.
    const kept = validTree(saved.tree, cleared, resets);
    const tree = kept ?? FRESH_TREE;
    const loadout = validLoadout(saved.loadout, tree) ?? defaultLoadout(tree);
    const fight = saved.fight && saved.fight.v === HERO_VERSION && validTree(saved.fight.tree) ? saved.fight : null;
    const arenaFight =
      saved.arenaFight && saved.arenaFight.v === HERO_VERSION && validTree(saved.arenaFight.tree) && validTree(saved.arenaFight.opponent?.tree) ? saved.arenaFight : null;
    const arenaPending = Array.isArray(saved.arenaPending) ? saved.arenaPending : [];
    return { owner: saved.owner ?? null, cleared, tree, resets, loadout, fight, dirty: !!saved.dirty || !kept, arena: saved.arena ?? null, arenaFight, arenaPending, lastResultAt: saved.lastResultAt ?? 0 };
  } catch {
    return fresh();
  }
}

function save({ owner, cleared, tree, resets, loadout, fight, dirty, arena, arenaFight, arenaPending, lastResultAt }: Saved) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ owner, cleared, tree, resets, loadout, fight, dirty, arena, arenaFight, arenaPending, lastResultAt }));
  } catch {
    // Private mode or full storage: the hero lasts this visit.
  }
}

interface HeroStore extends Saved {
  /** Points earned and not yet spent. */
  unspent: () => number;
  buy: (node: NodeId) => void;
  /** Applies a drafted tree (the skill tree's Confirm): only points added, none beyond those earned. */
  commit: (tree: Tree) => boolean;
  /** Every point back, less the reset's price (one more each time). False if it's not affordable. */
  reset: () => boolean;
  /** The skills to fight with: 1 to 4 you have. */
  setLoadout: (loadout: SkillId[]) => boolean;
  /** A new fight against a bot level you've reached. */
  startFight: (level: number) => void;
  /** Your move or the bot's, in a bot fight. */
  play: (by: 'me' | 'bot', move: Move) => void;
  /** The bot fight ended; counts a first win's points and any win's gems. Returns what was gained. */
  endFight: (won: boolean) => { points: number; gems: number };
  quitFight: () => void;
  /** The arena is open once the first boss is beaten. */
  arenaOpen: () => boolean;
  startArenaFight: (opponent: ArenaHero) => void;
  playArena: (by: 'me' | 'bot', move: Move) => void;
  /** Counts the arena fight (giving up is a loss) and queues it. Returns the rating change and gems. */
  endArenaFight: (won: boolean) => { delta: number; gems: number };
  claim: (uid: string) => void;
  /** Writes the hero to Firestore if it changed. Resolves once done (or given up for now). */
  sync: () => Promise<void>;
}

let syncing: Promise<void> | null = null;
/** Whether this session has read the arena doc yet (a new phone catches up to it). */
let arenaRead = false;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, Math.max(0, Math.min(ms, 60_000))));
const sameTree = (a: Tree | null, b: Tree) => !!a && NODES.every((n) => a[n.id] === b[n.id]);
const sameLoadout = (a: readonly SkillId[] | null, b: readonly SkillId[]) => !!a && a.join() === b.join();
/** A tree's new skills join the loadout while there's room. */
const withNewSkills = (loadout: SkillId[], before: Tree, after: Tree) => {
  const added = SKILLS.filter((s) => before[s] < 1 && after[s] >= 1 && !loadout.includes(s));
  return [...loadout, ...added].slice(0, LOADOUT_SIZE);
};
const standingOf = (r: ArenaRecord): ArenaStanding => ({ rating: r.rating, wins: r.wins, losses: r.losses });
const sameAppearance = (a: Appearance, b: Appearance) => a.costume === b.costume && JSON.stringify(a.look) === JSON.stringify(b.look);
const wardrobe = () => useWardrobeStore.getState();

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
      // Another phone (or cleared storage here) is further along, or reset: take its hero.
      // (One from before the prices comes back refunded, and is written so at once.)
      if (server && (server.cleared > get().cleared || server.resets > get().resets)) {
        update({ cleared: server.cleared, tree: server.tree, resets: server.resets, loadout: server.loadout, dirty: server.legacy });
        if (!server.legacy) return;
      }
      const local = get();
      const same =
        server &&
        !server.legacy &&
        sameTree(server.tree, local.tree) &&
        sameLoadout(server.loadout, local.loadout) &&
        server.resets === local.resets &&
        sameAppearance(server.appearance, wardrobe().appearance());
      if (!local.dirty && same) return await syncArena(uid);
      // A costume must be on the wardrobe doc before the hero doc can wear it.
      if (wardrobe().costume) {
        await wardrobe().sync();
        if (wardrobe().dirty) return;
      }
      // The rules let `cleared` rise by one a write; levels beaten offline go up step by step
      // with the server's tree (or a fresh one), and the last write carries this phone's tree.
      // A hero from before the prices takes its free refund on the first of these writes.
      const base = server ?? { cleared: 0, tree: FRESH_TREE, resets: 0, loadout: ['stopwatch'] as SkillId[] };
      const appearance = wardrobe().appearance();
      for (let c = base.cleared + 1; c < local.cleared; c++) await writeHero(uid, { cleared: c, tree: base.tree, resets: base.resets, loadout: base.loadout, appearance });
      const { cleared, tree, resets, loadout } = get();
      await writeHero(uid, { cleared, tree, resets, loadout, appearance });
      const now = get();
      if (now.cleared === cleared && now.tree === tree && now.resets === resets && now.loadout === loadout && sameAppearance(appearance, wardrobe().appearance())) update({ dirty: false });
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
    const appearance = wardrobe().appearance();
    const { tree, loadout } = get();
    if (!found) await joinArena(uid, name, tree, loadout, appearance);
    else if (!sameTree(found.tree, tree) || !sameLoadout(found.loadout, loadout) || found.name !== name || !sameAppearance(found.appearance, appearance))
      await refreshArenaHero(uid, name, tree, loadout, appearance);
    let server: ArenaRecord = found ?? { name, tree, loadout, appearance, rating: START_RATING, wins: 0, losses: 0 };
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
      const { cleared, tree, resets } = get();
      return available(tree, cleared, resets);
    },

    buy: (node) => {
      const { tree, cleared, resets, loadout } = get();
      if (!canBuy(tree, node, cleared, resets)) return;
      const next = buy(tree, node);
      changed({ tree: next, loadout: withNewSkills(loadout, tree, next) });
    },

    commit: (next) => {
      const { tree, cleared, resets, loadout } = get();
      if (!isUpgrade(tree, next, cleared, resets)) return false;
      changed({ tree: next, loadout: withNewSkills(loadout, tree, next) });
      return true;
    },

    reset: () => {
      const { cleared, resets } = get();
      if (!canReset(cleared, resets)) return false;
      changed({ tree: FRESH_TREE, resets: resets + 1, loadout: ['stopwatch'] });
      return true;
    },

    setLoadout: (next) => {
      const loadout = validLoadout(next, get().tree);
      if (!loadout) return false;
      changed({ loadout: [...loadout] });
      return true;
    },

    startFight: (level) => {
      if (level < 1 || level > Math.min(BOT_COUNT, get().cleared + 1)) return;
      const seed = Array.from(crypto.getRandomValues(new Uint32Array(3)), (n) => n.toString(36)).join('');
      update({ fight: { v: HERO_VERSION, level, seed, tree: get().tree, loadout: get().loadout, costume: wardrobe().costume, moves: [] } });
    },

    play: (by, move) => {
      const { fight } = get();
      if (fight) update({ fight: { ...fight, moves: [...fight.moves, { by, move }] } });
    },

    endFight: (won) => {
      const { fight, cleared } = get();
      if (!fight) return { points: 0, gems: 0 };
      const first = won && fight.level === cleared + 1;
      const gems = won ? gemsFor({ kind: 'bot', boss: BOT_LEVELS[fight.level - 1].boss, first }) : 0;
      wardrobe().earn(gems);
      if (!first) {
        update({ fight: null });
        return { points: 0, gems };
      }
      changed({ fight: null, cleared: fight.level });
      return { points: rewardFor(fight.level), gems };
    },

    quitFight: () => update({ fight: null }),

    arenaOpen: () => get().cleared >= ARENA_UNLOCK,

    startArenaFight: (opponent) => {
      if (!get().arenaOpen() || get().arenaFight) return;
      const seed = Array.from(crypto.getRandomValues(new Uint32Array(3)), (n) => n.toString(36)).join('');
      update({
        arena: get().arena ?? { rating: START_RATING, wins: 0, losses: 0 },
        arenaFight: { v: HERO_VERSION, seed, tree: get().tree, loadout: get().loadout, costume: wardrobe().costume, opponent, moves: [] },
      });
    },

    playArena: (by, move) => {
      const { arenaFight } = get();
      if (arenaFight) update({ arenaFight: { ...arenaFight, moves: [...arenaFight.moves, { by, move }] } });
    },

    endArenaFight: (won) => {
      const { arenaFight, arena, arenaPending } = get();
      if (!arenaFight || !arena) return { delta: 0, gems: 0 };
      const delta = ratingChange(arena.rating, arenaFight.opponent.rating, won);
      update({
        arenaFight: null,
        arena: { rating: arena.rating + delta, wins: arena.wins + (won ? 1 : 0), losses: arena.losses + (won ? 0 : 1) },
        arenaPending: [...arenaPending, { delta, won }],
      });
      void get().sync();
      const gems = gemsFor({ kind: 'arena', won });
      wardrobe().earn(gems);
      return { delta, gems };
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

// What you wear shows on your hero doc (and arena hero), so a change there is a change here.
useWardrobeStore.subscribe((now, before) => {
  if (now.look !== before.look || now.costume !== before.costume) {
    useHeroStore.setState({ dirty: true });
    void useHeroStore.getState().sync();
  }
});
