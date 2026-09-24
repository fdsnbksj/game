import { create } from 'zustand';
import { findGhost, type Ghost } from './services/opponents';
import { isRetryable, startOnlineRun, writeRound, type RoundWrite } from './services/runs';
import { aiOpponent } from './sim/ai';
import { simulate, type BattleResult, type Placed } from './sim/combat';
import { autoFill, boardUnits, dailySeed, finishRound, newRun, type RunMode, type RunState, type Slot } from './sim/planning';
import { toSnapshot } from './sim/validate';
import { dayId } from './shared/constants';
import { useGameStore } from './store';

// The run in progress, kept in localStorage so a reload picks it up where it was. A fight
// is applied to the run the moment it's simulated, before the replay starts, so closing
// the app mid-fight can't undo a loss.
//
// Online, each round is also queued for Firestore and written in order, spaced out the
// way the rules require. The queue is saved with the run, so a reload carries on writing.

// Historical names: the game was called Neon Brawl. Renaming them would wipe every
// in-progress run and lifetime stat on devices that already have one.
const RUN_KEY = 'neon-brawl:run';
const ONLINE_KEY = 'neon-brawl:online';
const STATS_KEY = 'neon-brawl:stats';
/** The last day whose challenge was finished on this device. */
const DAILY_KEY = 'neon-brawl:daily';

/** A little over the rules' minimums, so client and server clocks can disagree slightly. */
const ROUND_SPACING_MS = 3500;
const RUN_START_SPACING_MS = 5500;

export interface LocalStats {
  runs: number;
  bestWins: number;
  bestRound: number;
}

export interface Battle {
  result: BattleResult;
  opponent: string;
  /** A real player's saved team, or a bot. */
  opponentKind: 'ghost' | 'bot';
  round: number;
  /** The run as it was when the fight started, for the replay's HUD. */
  before: RunState;
  /** The last unit has fallen and the replay is only pausing on the final frame. */
  over?: boolean;
}

/** Health each side has left during a replay, for the versus header. */
export interface TeamHp {
  a: number;
  b: number;
  maxA: number;
  maxB: number;
  /** Units still standing on each side. */
  aliveA: number;
  aliveB: number;
}

/** A unit being dragged on the board, so the shop can turn into a sell zone. */
export interface UnitDrag {
  slot: Slot;
  /** Over the shop: letting go sells it. */
  overSell: boolean;
  /** Where the finger is, once it has left the canvas and the scene can't draw the unit. */
  outside: { x: number; y: number } | null;
}

export interface OnlineRun {
  runId: string;
  /** The day a daily challenge belongs to; '' for an ordinary run. */
  day: string;
  /** Random, for fair ghost picking; also part of the run's seed. */
  rand: number;
  /** Rounds wait here until Firestore has them. */
  pending: RoundWrite[];
  /**
   * starting: the run's first write hasn't landed yet.
   * live: rounds are being written.
   * offline: Firestore refused a write, so this run plays on locally and isn't ranked.
   */
  status: 'starting' | 'live' | 'offline';
  /** When the last write landed (ms, client clock), to space the next one. */
  lastWriteAt: number;
}

export type ReplaySpeed = 1 | 2;

interface RunStore {
  run: RunState | null;
  online: OnlineRun | null;
  /** The opponent fetched for the current round, if one was found. */
  ghost: (Ghost & { round: number }) | null;
  battle: Battle | null;
  speed: ReplaySpeed;
  selected: Slot | null;
  /** The creature an item is being dragged over. */
  itemTarget: Slot | null;
  unitDrag: UnitDrag | null;
  teamHp: TeamHp | null;
  /** A short message for the player, e.g. why a move didn't happen. */
  notice: { text: string; id: number } | null;
  stats: LocalStats;
  startRun: (mode?: RunMode) => void;
  /** Whether today's daily challenge has been played on this device. */
  dailyDone: (day: string) => boolean;
  /** Applies a planning change; shows `failure` if it changed nothing. */
  act: (change: (run: RunState) => RunState, failure?: string) => boolean;
  select: (slot: Slot | null) => void;
  /** Looks for a real player's board to fight this round. */
  prepareOpponent: () => Promise<void>;
  fight: () => void;
  setSpeed: (speed: ReplaySpeed) => void;
  endReplay: () => void;
  /** The replay reached the end of the fight; the result can show. */
  finishReplay: () => void;
  leaveRun: () => void;
  notify: (text: string) => void;
  /** Writes whatever is waiting. Safe to call any time; runs one write at a time. */
  sync: () => Promise<void>;
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

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
let syncing = false;

export const useRunStore = create<RunStore>()((set, get) => {
  /** Updates the online record, but only if it's still for the same run. */
  const updateOnline = (runId: string, change: Partial<OnlineRun> | ((online: OnlineRun) => Partial<OnlineRun>)) => {
    const online = get().online;
    if (!online || online.runId !== runId) return;
    const next = { ...online, ...(typeof change === 'function' ? change(online) : change) };
    save(ONLINE_KEY, next);
    set({ online: next });
  };

  return {
    run: load<RunState | null>(RUN_KEY, null),
    online: load<OnlineRun | null>(ONLINE_KEY, null),
    ghost: null,
    battle: null,
    speed: 1,
    selected: null,
    itemTarget: null,
    unitDrag: null,
    teamHp: null,
    notice: null,
    stats: load<LocalStats>(STATS_KEY, { runs: 0, bestWins: 0, bestRound: 0 }),

    startRun: (mode: RunMode = 'run') => {
      const { uid, player } = useGameStore.getState();
      const rand = Math.floor(Math.random() * 2 ** 31);
      const day = dayId();
      // Signed in, the run is named for its slot on the player (the rules require it), and its
      // seed includes a random part, so no one can work out a run's shops before it starts.
      // The daily challenge is the same run for everyone, so its seed is just the day.
      const runId = uid && player ? (mode === 'daily' ? `${uid}_d${day}` : `${uid}_${player.runsStarted}`) : null;
      const seed = mode === 'daily' ? dailySeed(day) : runId ? `${runId}:${rand}` : `local:${Date.now().toString(36)}:${rand}`;
      const run = newRun(seed, mode);
      const online: OnlineRun | null = runId ? { runId, day: mode === 'daily' ? day : '', rand, pending: [], status: 'starting', lastWriteAt: 0 } : null;
      save(RUN_KEY, run);
      save(ONLINE_KEY, online);
      set({ run, online, battle: null, selected: null, ghost: null });
      void get().sync();
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

    prepareOpponent: async () => {
      const { run, ghost, online } = get();
      const uid = useGameStore.getState().uid;
      if (!run || run.done || !uid || !online || ghost?.round === run.round) return;
      const round = run.round;
      try {
        const found = await findGhost(round, uid);
        if (found && get().run?.round === round && !get().battle) set({ ghost: { ...found, round } });
      } catch {
        // No index yet, or offline: this round's rival is a bot.
      }
    },

    fight: () => {
      const { run, ghost, online } = get();
      if (!run || run.done || get().battle) return;
      const planned = autoFill(run);
      const useGhost = ghost && ghost.round === run.round;
      // Without a ghost, a different bot every round, so a run isn't one opponent fifteen times.
      const bot = useGhost ? null : aiOpponent(`${run.seed}:opp${run.round}`, run.round);
      const opponent: { name: string; units: Placed[] } = useGhost ? ghost : bot!;
      const result = simulate(boardUnits(planned), opponent.units, `${run.seed}:fight${run.round}`);
      const next = finishRound(planned, result, opponent.name);
      save(RUN_KEY, next);
      set({
        run: next,
        ghost: null,
        selected: null,
        battle: { result, opponent: opponent.name, opponentKind: useGhost ? 'ghost' : 'bot', round: run.round, before: planned },
      });

      if (online && online.status !== 'offline') {
        const write: RoundWrite = {
          round: run.round,
          board: toSnapshot(boardUnits(planned), planned.level, useGhost ? `${ghost.runId}:${run.round}` : 'ai'),
          hp: next.hp,
          wins: next.wins,
          done: next.done,
        };
        updateOnline(online.runId, (current) => ({ pending: [...current.pending, write] }));
        void get().sync();
      }

      if (next.done && next.mode === 'daily') save(DAILY_KEY, dayId());

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

    endReplay: () => set({ battle: null, teamHp: null }),

    finishReplay: () => {
      const battle = get().battle;
      if (battle && !battle.over) set({ battle: { ...battle, over: true } });
    },

    leaveRun: () => {
      save(RUN_KEY, null);
      save(ONLINE_KEY, null);
      set({ run: null, online: null, battle: null, selected: null, ghost: null });
    },

    notify: (text) => set({ notice: { text, id: Date.now() } }),

    dailyDone: (day) => load<string | null>(DAILY_KEY, null) === day,

    sync: async () => {
      if (syncing) return;
      syncing = true;
      try {
        for (;;) {
          const online = get().online;
          const { uid, player } = useGameStore.getState();
          if (!online || online.status === 'offline' || !uid || !player) return;
          const runId = online.runId;

          try {
            const mode = get().run?.mode ?? 'run';
            if (online.status === 'starting') {
              // Ordinary runs are counted on the player and spaced out; the daily challenge is
              // named for the day instead, so neither applies to it.
              if (mode === 'run') {
                await sleep(player.lastRunStartAt + RUN_START_SPACING_MS - Date.now());
                // Another device may have started a run since this one was set up.
                if (runId !== `${uid}_${player.runsStarted}`) throw new Error('Run slot taken');
              }
              await startOnlineRun(uid, player, runId, online.rand, mode, online.day);
              if (mode === 'run') {
                useGameStore.getState().setPlayer({ ...player, runsStarted: player.runsStarted + 1, lastRunStartAt: Date.now() });
              }
              updateOnline(runId, { status: 'live', lastWriteAt: Date.now() });
              continue;
            }
            const write = online.pending[0];
            if (!write) return;
            await sleep(online.lastWriteAt + ROUND_SPACING_MS - Date.now());
            await writeRound(uid, player, runId, write, mode, online.day);
            updateOnline(runId, (current) => ({
              pending: current.pending.filter((pending) => pending.round !== write.round),
              lastWriteAt: Date.now(),
            }));
          } catch (error) {
            if (isRetryable(error)) return; // Leave it queued; the next fight or reload tries again.
            console.warn('Run is offline from here:', error);
            updateOnline(runId, { status: 'offline', pending: [] });
            return;
          }
        }
      } finally {
        syncing = false;
      }
    },
  };
});
