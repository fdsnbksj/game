import { create } from 'zustand';
import type { BoardState } from './boardStore';
import { simulate } from './sim/combat';
import { boardUnits, move, newRun, type RunState } from './sim/planning';
import { LADDER_VERSION, puzzle, puzzleSeed, type Puzzle } from './sim/puzzle';
import { toPuzzleBoard, writeClear, type ClearWrite } from './services/puzzles';
import { isRetryable } from './services/runs';
import { useGameStore } from './store';

// Battle puzzles in progress. A level is played as a RunState made of its hand: the
// creatures wait on the bench, the board takes as many as the hand holds, and there's no
// shop or gold. That lets the board scene, the planning reducers and the shared board
// parts work unchanged; the rival stands on its half through `rivalPreview`.
//
// Progress is saved on this device; a clear is counted the moment its fight is simulated,
// before the replay, as runs do. Each clear is also queued for the online ladder and
// written in order, spaced out the way the rules require, as run rounds are.

const PUZZLE_KEY = 'game:puzzle';

/** What's saved: the level being played on this ladder, and how it's going. */
interface SavedPuzzle {
  v: number;
  level: number;
  attempts: number;
  /** The layout being worked on, so a reload keeps it. */
  placement: RunState | null;
  /** Clears waiting for Firestore. */
  pending: ClearWrite[];
  /** offline: Firestore refused a write, so this ladder carries on here, unranked. */
  online: 'live' | 'offline';
  /** When the last write landed (ms, client clock), to space the next one. */
  lastWriteAt: number;
}

/** A little over the rules' minimum, so client and server clocks can disagree slightly. */
const CLEAR_SPACING_MS = 3500;

/** Losses on a level before a hint is offered. */
export const HINT_AFTER = 3;

interface PuzzleStore extends BoardState, Omit<SavedPuzzle, 'v' | 'placement'> {
  puzzle: Puzzle | null;
  attempts: number;
  /** The level just cleared and the tries it took, while its replay and card show. `level` has moved on. */
  cleared: { level: number; tries: number } | null;
  /** The last fight was lost, for the card after the replay. */
  lost: boolean;
  /** Makes the current level (or picks up the saved one) and puts it on the board. */
  open: () => void;
  fight: () => void;
  /** Everything back on the bench. */
  reset: () => void;
  /** Stands one creature where the solution has it. */
  hint: () => void;
  /** On from a cleared level to the next. */
  next: () => void;
  /** Writes whatever clears are waiting. Safe to call any time; runs one write at a time. */
  sync: () => Promise<void>;
}

function load(): SavedPuzzle {
  try {
    const saved = JSON.parse(localStorage.getItem(PUZZLE_KEY) ?? 'null') as Partial<SavedPuzzle> | null;
    // A new ladder's levels are different puzzles, so it starts from the top.
    if (saved && saved.v === LADDER_VERSION) {
      // Saved before the ladder went online: its clears were never written, so it can't join.
      const online = saved.online ?? ((saved.level ?? 1) > 1 ? 'offline' : 'live');
      return { v: LADDER_VERSION, level: 1, attempts: 0, placement: null, pending: [], lastWriteAt: 0, ...saved, online };
    }
  } catch {
    // Unreadable: start over.
  }
  return { v: LADDER_VERSION, level: 1, attempts: 0, placement: null, pending: [], online: 'live', lastWriteAt: 0 };
}

// Clamped: setTimeout reads its delay as a 32-bit integer, so a wait long past (a first
// write, measured from 0) would wrap round to days instead of running at once.
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, Math.max(0, Math.min(ms, 60_000))));
let syncing = false;

function save(saved: SavedPuzzle) {
  try {
    localStorage.setItem(PUZZLE_KEY, JSON.stringify(saved));
  } catch {
    // Private mode or full storage: progress lasts this visit.
  }
}

/** Levels already made, so going back and forth doesn't make them twice. */
const made = new Map<number, Puzzle>();
export function puzzleAt(level: number): Puzzle {
  let found = made.get(level);
  if (!found) {
    found = puzzle(level);
    made.set(level, found);
  }
  return found;
}

/** Makes the next level while the player is busy with this one. */
function prepare(level: number) {
  const idle = window.requestIdleCallback ?? ((fn: () => void) => window.setTimeout(fn, 300));
  idle(() => puzzleAt(level));
}

/** A level's hand, laid out on the bench, as a run the planning reducers understand. */
export function boardFor(p: Puzzle): RunState {
  const run = newRun(`puzzle:${p.level}`);
  const bench = run.bench.map((_, i) => (p.hand[i] ? { uid: i + 1, unitId: p.hand[i].unitId, star: p.hand[i].star } : null));
  return { ...run, round: p.level, level: p.hand.length, gold: 0, shop: [], bench, bag: [...p.items], nextUid: p.hand.length + 1 };
}

export const usePuzzleStore = create<PuzzleStore>()((set, get) => {
  const saved = load();
  /** Saves the state as it is now. A cleared level's layout isn't kept: the next level is up. */
  const persist = () => {
    const { level, attempts, run, cleared, pending, online, lastWriteAt } = get();
    save({ v: LADDER_VERSION, level, attempts, placement: cleared ? null : run, pending, online, lastWriteAt });
  };

  return {
    run: null,
    battle: null,
    speed: 1,
    selected: null,
    itemTarget: null,
    unitDrag: null,
    teamHp: null,
    peek: null,
    notice: null,
    rivalPreview: null,
    level: saved.level,
    puzzle: null,
    attempts: saved.attempts,
    pending: saved.pending,
    online: saved.online,
    lastWriteAt: saved.lastWriteAt,
    cleared: null,
    lost: false,

    open: () => {
      const { level } = get();
      const p = puzzleAt(level);
      const kept = load();
      const run = kept.level === level && kept.placement ? kept.placement : boardFor(p);
      set({ puzzle: p, run, rivalPreview: p.enemy, battle: null, cleared: null, lost: false, selected: null });
      prepare(level + 1);
    },

    act: (change, failure) => {
      const { run, battle } = get();
      if (!run || battle) return false;
      const next = change(run);
      if (next === run) {
        if (failure) get().notify(failure);
        return false;
      }
      set({ run: next });
      persist();
      return true;
    },

    select: (selected) => set({ selected }),

    fight: () => {
      const { run, puzzle: p, battle, level, attempts } = get();
      if (!run || !p || battle || boardUnits(run).length === 0) return;
      const result = simulate(boardUnits(run), p.enemy, puzzleSeed(level), p.rivalPercent);
      const won = result.winner === 'a';
      const battleState = { result, opponent: `Level ${level}`, opponentKind: 'puzzle' as const, round: level, before: run };
      if (won) {
        // Counted now, so closing the app mid-replay can't lose the clear.
        const clear: ClearWrite = { level, board: toPuzzleBoard(boardUnits(run)) };
        const pending = get().online === 'live' ? [...get().pending, clear] : [];
        set({ battle: battleState, level: level + 1, attempts: 0, cleared: { level, tries: attempts + 1 }, lost: false, selected: null, pending });
        persist();
        void get().sync();
      } else {
        set({ battle: battleState, attempts: attempts + 1, lost: true, selected: null });
        persist();
      }
    },

    reset: () => {
      get().act((run) => {
        let next = run;
        next.board.forEach((unit, index) => {
          const free = next.bench.indexOf(null);
          if (unit && free >= 0) next = move(next, { area: 'board', index }, { area: 'bench', index: free });
        });
        return next;
      });
    },

    hint: () => {
      const { puzzle: p } = get();
      if (!p) return;
      get().act((run) => {
        for (const target of p.solution) {
          const there = run.board[target.cell];
          if (there && there.unitId === target.unitId && there.star === target.star) continue;
          // The same creature from wherever it is now; the bench first, so a placed one stays put.
          const bench = run.bench.findIndex((u) => u?.unitId === target.unitId && u.star === target.star);
          const board = run.board.findIndex((u, cell) => u?.unitId === target.unitId && u.star === target.star && !p.solution.some((s) => s.cell === cell && s.unitId === u.unitId && s.star === u.star));
          const from = bench >= 0 ? { area: 'bench' as const, index: bench } : board >= 0 ? { area: 'board' as const, index: board } : null;
          if (!from) continue;
          const next = move(run, from, { area: 'board', index: target.cell });
          if (next !== run) return next;
        }
        return run;
      }, 'Already where the answer has them');
    },

    next: () => get().open(),

    sync: async () => {
      if (syncing) return;
      syncing = true;
      try {
        for (;;) {
          const { pending, online, lastWriteAt } = get();
          const { uid, player } = useGameStore.getState();
          const clear = pending[0];
          if (online === 'offline' || !uid || !player || !clear) return;
          await sleep(lastWriteAt + CLEAR_SPACING_MS - Date.now());
          try {
            await writeClear(uid, player, clear);
            set({ pending: get().pending.filter((p) => p.level !== clear.level), lastWriteAt: Date.now() });
            persist();
          } catch (error) {
            if (isRetryable(error)) return; // Left queued; the next clear or visit tries again.
            console.warn('Puzzle ladder is offline from here:', error);
            set({ online: 'offline', pending: [] });
            persist();
            get().notify("Your puzzle progress can't be saved online, so it won't be ranked.");
            return;
          }
        }
      } finally {
        syncing = false;
      }
    },

    setSpeed: (speed) => set({ speed }),

    endReplay: () => set({ battle: null, teamHp: null }),

    finishReplay: () => {
      const battle = get().battle;
      if (battle && !battle.over) set({ battle: { ...battle, over: true } });
    },

    notify: (text) => set({ notice: { text, id: Date.now() } }),
  };
});
