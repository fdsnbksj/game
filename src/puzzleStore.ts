import { create } from 'zustand';
import type { BoardState } from './boardStore';
import { simulate } from './sim/combat';
import { boardUnits, move, newRun, type RunState } from './sim/planning';
import { LADDER_VERSION, puzzle, puzzleSeed, type Puzzle } from './sim/puzzle';

// Battle puzzles in progress. A level is played as a RunState made of its hand: the
// creatures wait on the bench, the board takes as many as the hand holds, and there's no
// shop or gold. That lets the board scene, the planning reducers and the shared board
// parts work unchanged; the rival stands on its half through `rivalPreview`.
//
// Progress is saved on this device; a clear is counted the moment its fight is simulated,
// before the replay, as runs do.

const PUZZLE_KEY = 'game:puzzle';

/** What's saved: the level being played on this ladder, and how it's going. */
interface SavedPuzzle {
  v: number;
  level: number;
  attempts: number;
  /** The layout being worked on, so a reload keeps it. */
  placement: RunState | null;
}

/** Losses on a level before a hint is offered. */
export const HINT_AFTER = 3;

interface PuzzleStore extends BoardState {
  /** The level being played. */
  level: number;
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
}

function load(): SavedPuzzle {
  try {
    const saved = JSON.parse(localStorage.getItem(PUZZLE_KEY) ?? 'null') as SavedPuzzle | null;
    // A new ladder's levels are different puzzles, so it starts from the top.
    if (saved && saved.v === LADDER_VERSION) return saved;
  } catch {
    // Unreadable: start over.
  }
  return { v: LADDER_VERSION, level: 1, attempts: 0, placement: null };
}

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
  const store = (change: Partial<SavedPuzzle>) => {
    const { level, attempts, run } = get();
    save({ v: LADDER_VERSION, level, attempts, placement: run, ...change });
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
      store({ placement: next });
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
        save({ v: LADDER_VERSION, level: level + 1, attempts: 0, placement: null });
        set({ battle: battleState, level: level + 1, attempts: 0, cleared: { level, tries: attempts + 1 }, lost: false, selected: null });
      } else {
        set({ battle: battleState, attempts: attempts + 1, lost: true, selected: null });
        store({ attempts: attempts + 1 });
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

    setSpeed: (speed) => set({ speed }),

    endReplay: () => set({ battle: null, teamHp: null }),

    finishReplay: () => {
      const battle = get().battle;
      if (battle && !battle.over) set({ battle: { ...battle, over: true } });
    },

    notify: (text) => set({ notice: { text, id: Date.now() } }),
  };
});
