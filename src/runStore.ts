import { create } from 'zustand';
import { aiOpponent } from './sim/ai';
import { simulate, type BattleResult } from './sim/combat';
import { autoFill, boardUnits, finishRound, newRun, type RunState, type Slot } from './sim/planning';

// The run in progress, kept in localStorage so a reload picks it up where it was. A fight
// is applied to the run the moment it's simulated, before the replay starts, so closing
// the app mid-fight can't undo a loss.

const RUN_KEY = 'neon-brawl:run';
const STATS_KEY = 'neon-brawl:stats';

export interface LocalStats {
  runs: number;
  bestWins: number;
  bestRound: number;
}

export interface Battle {
  result: BattleResult;
  opponent: string;
  round: number;
  /** The run as it was when the fight started, for the replay's HUD. */
  before: RunState;
}

export type ReplaySpeed = 1 | 2;

interface RunStore {
  run: RunState | null;
  battle: Battle | null;
  speed: ReplaySpeed;
  selected: Slot | null;
  /** A short message for the player, e.g. why a move didn't happen. */
  notice: { text: string; id: number } | null;
  stats: LocalStats;
  startRun: () => void;
  /** Applies a planning change; shows `failure` if it changed nothing. */
  act: (change: (run: RunState) => RunState, failure?: string) => boolean;
  select: (slot: Slot | null) => void;
  fight: () => void;
  setSpeed: (speed: ReplaySpeed) => void;
  endReplay: () => void;
  leaveRun: () => void;
  notify: (text: string) => void;
}

function load<T>(key: string, fallback: T): T {
  try {
    const saved = localStorage.getItem(key);
    return saved ? (JSON.parse(saved) as T) : fallback;
  } catch {
    return fallback;
  }
}

function save(key: string, value: unknown) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Private mode or full storage: the run still works for this visit.
  }
}

function newSeed() {
  return `${Date.now().toString(36)}-${Math.floor(Math.random() * 1e9).toString(36)}`;
}

export const useRunStore = create<RunStore>()((set, get) => ({
  run: load<RunState | null>(RUN_KEY, null),
  battle: null,
  speed: 1,
  selected: null,
  notice: null,
  stats: load<LocalStats>(STATS_KEY, { runs: 0, bestWins: 0, bestRound: 0 }),

  startRun: () => {
    const run = newRun(newSeed());
    save(RUN_KEY, run);
    set({ run, battle: null, selected: null });
  },

  act: (change, failure) => {
    const { run } = get();
    if (!run || get().battle) return false;
    const next = change(run);
    if (next === run) {
      if (failure) get().notify(failure);
      return false;
    }
    save(RUN_KEY, next);
    set({ run: next });
    return true;
  },

  select: (selected) => set({ selected }),

  fight: () => {
    const { run } = get();
    if (!run || run.done || get().battle) return;
    const planned = autoFill(run);
    // A different bot every round, so a run isn't the same opponent fifteen times.
    const opponent = aiOpponent(`${run.seed}:opp${run.round}`, run.round);
    const result = simulate(boardUnits(planned), opponent.units, `${run.seed}:fight${run.round}`);
    const next = finishRound(planned, result, opponent.name);
    save(RUN_KEY, next);
    set({ run: next, selected: null, battle: { result, opponent: opponent.name, round: run.round, before: planned } });
    // Counted now rather than after the replay, so a reload mid-replay can't skip it.
    if (next.done) {
      const stats = get().stats;
      const updated = {
        runs: stats.runs + 1,
        bestWins: Math.max(stats.bestWins, next.wins),
        bestRound: Math.max(stats.bestRound, next.history.length),
      };
      save(STATS_KEY, updated);
      set({ stats: updated });
    }
  },

  setSpeed: (speed) => set({ speed }),

  endReplay: () => set({ battle: null }),

  leaveRun: () => {
    save(RUN_KEY, null);
    set({ run: null, battle: null, selected: null });
  },

  notify: (text) => set({ notice: { text, id: Date.now() } }),
}));
