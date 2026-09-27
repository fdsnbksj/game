import { create } from 'zustand';
import { useKnowledgeStore } from './knowledgeStore';
import { nonogram, NONOGRAM_VERSION, type Nonogram } from './nonogram/generate';
import { isSolved, newPlay, paint, setMode, undo, type Mark, type Mode, type PlayState } from './nonogram/play';
import { isRetryable, packGrid, writeSolve, type SolveWrite } from './services/solves';
import { useGameStore } from './store';

// The puzzle in progress and the ladder it's on. Every change is saved to localStorage
// the moment it happens, so the app can be closed at any point (a stop coming up, a
// tunnel) and pick up exactly where it was.
//
// Solves are counted here first and queued for Firestore, written in order and spaced
// out the way the rules require, whenever there's a session and a connection.

const KEY = 'game:nonogram';

/** What's saved. Older saves also hold fields from removed modes; they're ignored. */
interface Saved {
  v: number;
  /** The level being played: one past the highest cleared. */
  level: number;
  ladder: PlayState | null;
  pending: SolveWrite[];
  /** False once Firestore refused a write: the ladder carries on here, unranked. */
  ladderOnline: boolean;
  /** When the last write landed (ms, client clock), to space the next one. */
  lastWriteAt: number;
  haptics: boolean;
}

/** Just solved, for the card that follows. */
export interface JustSolved {
  level: number;
  /** What the picture shows, like "a lighthouse". */
  name?: string;
  /** The finished grid, to show the picture while the card is up. */
  marks: Mark[];
  /** A knowledge card to read before moving on, if any topic is chosen. */
  knowledge: string | null;
}

/** A little over the rules' 3 s minimum, so client and server clocks can disagree slightly. */
const WRITE_SPACING_MS = 3500;

const fresh = (): Saved => ({ v: NONOGRAM_VERSION, level: 1, ladder: null, pending: [], ladderOnline: true, lastWriteAt: 0, haptics: true });

function load(): Saved {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Partial<Saved> | null;
    if (!saved) return fresh();
    // New generator, new puzzles: the ladder starts over, but settings stay.
    if (saved.v !== NONOGRAM_VERSION) return { ...fresh(), haptics: saved.haptics ?? true };
    const { level, ladder, pending, ladderOnline, lastWriteAt, haptics } = { ...fresh(), ...saved };
    // Daily solves from before the daily puzzle was removed can no longer be written.
    return { v: NONOGRAM_VERSION, level, ladder, pending: pending.filter((p) => p.kind === 'level'), ladderOnline, lastWriteAt, haptics };
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

/** Levels already made, so re-renders don't make them twice. */
const made = new Map<number, Nonogram>();
export function levelPuzzle(level: number): Nonogram {
  let found = made.get(level);
  if (!found) {
    found = nonogram(level);
    made.set(level, found);
  }
  return found;
}

interface NonogramStore extends Saved {
  justSolved: JustSolved | null;
  /** The play in progress, or a blank one. */
  play: () => PlayState;
  stroke: (cells: number[]) => void;
  undo: () => void;
  setMode: (mode: Mode) => void;
  /** Wipes the grid (and its undo steps) to start the level again. */
  clear: () => void;
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
    const { v, level, ladder, pending, ladderOnline, lastWriteAt, haptics } = get();
    save({ v, level, ladder, pending, ladderOnline, lastWriteAt, haptics });
  };

  const keep = (ladder: PlayState) => {
    set({ ladder });
    persist();
  };

  return {
    ...load(),
    justSolved: null,

    play: () => get().ladder ?? newPlay(levelPuzzle(get().level).size),

    stroke: (cells) => {
      const before = get().play();
      const next = paint(before, cells);
      if (next === before) return;
      const { level, pending, ladderOnline, haptics } = get();
      const puzzle = levelPuzzle(level);
      if (!isSolved(next, puzzle)) return keep(next);
      // Counted at once, so closing the app on the card can't lose it.
      const write: SolveWrite = { kind: 'level', level, grid: packGrid(next.marks) };
      set({
        level: level + 1,
        ladder: null,
        pending: ladderOnline ? [...pending, write] : pending,
        justSolved: { level, name: puzzle.name, marks: next.marks, knowledge: useKnowledgeStore.getState().next(puzzle.topic) },
      });
      if (haptics) navigator.vibrate?.([30, 60, 30]);
      persist();
      void get().sync();
    },

    undo: () => {
      const before = get().play();
      const next = undo(before);
      if (next !== before) keep(next);
    },

    setMode: (mode) => keep(setMode(get().play(), mode)),

    clear: () => keep({ ...newPlay(get().play().size), mode: get().play().mode }),

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
            // A refused level breaks the chain the rules check, so the ladder stays on this device from here.
            console.warn('Firestore refused a solve:', error);
            set({ ladderOnline: false, pending: [] });
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
