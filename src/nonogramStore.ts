import { create } from 'zustand';
import { dailyNonogram, nonogram, NONOGRAM_VERSION, type Nonogram } from './nonogram/generate';
import { isSolved, newPlay, paint, setMode, undo, type Mark, type Mode, type PlayState } from './nonogram/play';
import { isRetryable, packGrid, writeSolve, type SolveWrite } from './services/solves';
import { dayId } from './shared/constants';
import { useGameStore } from './store';

// Puzzles in progress, and everything solved on this device. Every change is saved to
// localStorage the moment it happens, so the app can be closed at any point (a stop
// coming up, a tunnel) and pick up exactly where it was.
//
// Solves are counted here first and queued for Firestore, written in order and spaced
// out the way the rules require, whenever there's a session and a connection.

export type Which = 'ladder' | 'daily';

const KEY = 'game:nonogram';

/** What's saved. */
interface Saved {
  v: number;
  /** The ladder level being played: one past the highest cleared. */
  level: number;
  ladder: PlayState | null;
  daily: { day: string; play: PlayState } | null;
  /** Days whose puzzle was solved here, newest last. */
  dailySolved: string[];
  /** Puzzles solved on this device, over every version. */
  solved: number;
  pending: SolveWrite[];
  /** False once Firestore refused a ladder write: the ladder carries on here, unranked. */
  ladderOnline: boolean;
  /** When the last write landed (ms, client clock), to space the next one. */
  lastWriteAt: number;
  haptics: boolean;
}

/** Just solved, for the card that follows. */
export interface JustSolved {
  which: Which;
  title: string;
  size: number;
  marks: Mark[];
}

/** A little over the rules' 3 s minimum, so client and server clocks can disagree slightly. */
const WRITE_SPACING_MS = 3500;
/** Solved days kept, enough for any streak worth showing. */
const DAYS_KEPT = 400;

const fresh = (): Saved => ({
  v: NONOGRAM_VERSION,
  level: 1,
  ladder: null,
  daily: null,
  dailySolved: [],
  solved: 0,
  pending: [],
  ladderOnline: true,
  lastWriteAt: 0,
  haptics: true,
});

function load(): Saved {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Partial<Saved> | null;
    if (!saved) return fresh();
    if (saved.v === NONOGRAM_VERSION) return { ...fresh(), ...saved };
    // New generator, new puzzles: the ladder starts over, but the count and settings stay.
    return { ...fresh(), solved: saved.solved ?? 0, haptics: saved.haptics ?? true };
  } catch {
    return fresh();
  }
}

function save(saved: Saved) {
  try {
    localStorage.setItem(KEY, JSON.stringify(saved));
  } catch {
    // Private mode or full storage: progress lasts this visit.
  }
}

/** Puzzles already made, so moving between screens doesn't make them twice. */
const made = new Map<string, Nonogram>();
function remember(id: string, make: () => Nonogram) {
  let found = made.get(id);
  if (!found) {
    found = make();
    made.set(id, found);
  }
  return found;
}
export const levelPuzzle = (level: number) => remember(`level:${level}`, () => nonogram(level));
export const dailyPuzzle = (day: string) => remember(`day:${day}`, () => dailyNonogram(day));

export const puzzleFor = (which: Which, level: number, day: string) => (which === 'ladder' ? levelPuzzle(level) : dailyPuzzle(day));

interface NonogramStore extends Saved {
  justSolved: JustSolved | null;
  /** The play in progress for a puzzle, or a blank one. */
  playOf: (which: Which) => PlayState;
  stroke: (which: Which, cells: number[]) => void;
  undo: (which: Which) => void;
  setMode: (which: Which, mode: Mode) => void;
  /** Wipes the grid (and its undo steps) to start the puzzle again. */
  clear: (which: Which) => void;
  dismissSolved: () => void;
  setHaptics: (on: boolean) => void;
  /** Writes whatever solves are waiting. Safe to call any time; runs one write at a time. */
  sync: () => Promise<void>;
}

// Clamped: setTimeout reads its delay as a 32-bit integer, so a wait long past (a first
// write, measured from 0) would wrap round to days instead of running at once.
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, Math.max(0, Math.min(ms, 60_000))));
let syncing = false;

export const useNonogramStore = create<NonogramStore>()((set, get) => {
  const persist = () => {
    const { v, level, ladder, daily, dailySolved, solved, pending, ladderOnline, lastWriteAt, haptics } = get();
    save({ v, level, ladder, daily, dailySolved, solved, pending, ladderOnline, lastWriteAt, haptics });
  };

  /** Puts a play back where it belongs. */
  const store = (which: Which, play: PlayState) => {
    if (which === 'ladder') set({ ladder: play });
    else set({ daily: { day: dayId(), play } });
  };

  /** Counts a solve at once, so closing the app on the card can't lose it. */
  const solve = (which: Which, play: PlayState) => {
    const grid = packGrid(play.marks);
    const justSolved = { which, size: play.size, marks: play.marks } as const;
    const state = get();
    if (which === 'ladder') {
      const write: SolveWrite = { kind: 'level', level: state.level, grid };
      set({
        level: state.level + 1,
        ladder: null,
        solved: state.solved + 1,
        pending: state.ladderOnline ? [...state.pending, write] : state.pending,
        justSolved: { ...justSolved, title: `Level ${state.level}` },
      });
    } else {
      const day = dayId();
      set({
        daily: null,
        dailySolved: [...state.dailySolved.filter((d) => d !== day), day].slice(-DAYS_KEPT),
        solved: state.solved + 1,
        pending: [...state.pending, { kind: 'daily', day, grid }],
        justSolved: { ...justSolved, title: "Today's puzzle" },
      });
    }
    if (state.haptics) navigator.vibrate?.([30, 60, 30]);
    persist();
    void get().sync();
  };

  return {
    ...load(),
    justSolved: null,

    playOf: (which) => {
      const { level, ladder, daily } = get();
      const saved = which === 'ladder' ? ladder : daily?.day === dayId() ? daily.play : null;
      return saved ?? newPlay(puzzleFor(which, level, dayId()).size);
    },

    stroke: (which, cells) => {
      const before = get().playOf(which);
      const next = paint(before, cells);
      if (next === before) return;
      if (isSolved(next, puzzleFor(which, get().level, dayId()))) return solve(which, next);
      store(which, next);
      persist();
    },

    undo: (which) => {
      const before = get().playOf(which);
      const next = undo(before);
      if (next === before) return;
      store(which, next);
      persist();
    },

    setMode: (which, mode) => {
      store(which, setMode(get().playOf(which), mode));
      persist();
    },

    clear: (which) => {
      const before = get().playOf(which);
      store(which, { ...newPlay(before.size), mode: before.mode });
      persist();
    },

    dismissSolved: () => set({ justSolved: null }),

    setHaptics: (haptics) => {
      set({ haptics });
      persist();
    },

    sync: async () => {
      if (syncing) return;
      syncing = true;
      try {
        for (;;) {
          const { pending, lastWriteAt } = get();
          const { uid, player } = useGameStore.getState();
          const next = pending[0];
          if (!uid || !player || !next) return;
          await sleep(lastWriteAt + WRITE_SPACING_MS - Date.now());
          try {
            await writeSolve(uid, player, next);
            set({ pending: get().pending.slice(1), lastWriteAt: Date.now() });
            persist();
          } catch (error) {
            if (isRetryable(error)) return; // Left queued; the next solve, connection or visit tries again.
            console.warn('Firestore refused a solve:', error);
            // A refused level breaks the chain the rules check, so the ladder stays on this
            // device from here. A refused day (filed too late, say) is only that day.
            if (next.kind === 'level') set({ ladderOnline: false, pending: get().pending.filter((p) => p.kind !== 'level') });
            else set({ pending: get().pending.slice(1) });
            persist();
          }
        }
      } finally {
        syncing = false;
      }
    },
  };
});

// Write what's queued as soon as there's a session, and whenever the connection returns.
useGameStore.subscribe((session, before) => {
  if (session.player && !before.player) void useNonogramStore.getState().sync();
});
if (typeof window !== 'undefined') window.addEventListener('online', () => void useNonogramStore.getState().sync());
