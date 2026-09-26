import { cluesOf, lineClue, sameClue, type Clues } from './clues';

// Playing a puzzle: what the player has marked, and how to undo it. Nothing is checked
// until the marks match the clues, so there are no mistakes, lives or clock.

/** 0 blank, 1 filled, 2 crossed out (the player's note that it's empty). */
export type Mark = 0 | 1 | 2;
export type Mode = 'fill' | 'cross';

/** One stroke: the cells it changed and what each held before, so it undoes in one step. */
export interface Stroke {
  cells: number[];
  before: Mark[];
}

export interface PlayState {
  size: number;
  marks: Mark[];
  mode: Mode;
  history: Stroke[];
}

/** Undo steps kept; older ones drop off. */
export const HISTORY_LIMIT = 200;

export const newPlay = (size: number): PlayState => ({
  size,
  marks: new Array<Mark>(size * size).fill(0),
  mode: 'fill',
  history: [],
});

const markFor = (mode: Mode): Mark => (mode === 'fill' ? 1 : 2);

/**
 * What a stroke starting on `first` sets its cells to: the mode's mark, or blank if the
 * first cell already has it, so tapping a filled cell again clears it.
 */
export function strokeTarget(state: PlayState, first: number): Mark {
  const mark = markFor(state.mode);
  return state.marks[first] === mark ? 0 : mark;
}

/** Applies a tap or a drag across `cells` (in the order touched) as one undo step. */
export function paint(state: PlayState, cells: readonly number[]): PlayState {
  if (cells.length === 0) return state;
  const target = strokeTarget(state, cells[0]);
  const changed = [...new Set(cells)].filter((cell) => state.marks[cell] !== target);
  if (changed.length === 0) return state;
  const marks = [...state.marks];
  const before = changed.map((cell) => marks[cell]);
  for (const cell of changed) marks[cell] = target;
  const history = [...state.history, { cells: changed, before }].slice(-HISTORY_LIMIT);
  return { ...state, marks, history };
}

export function undo(state: PlayState): PlayState {
  const last = state.history.at(-1);
  if (!last) return state;
  const marks = [...state.marks];
  last.cells.forEach((cell, i) => (marks[cell] = last.before[i]));
  return { ...state, marks, history: state.history.slice(0, -1) };
}

export const setMode = (state: PlayState, mode: Mode): PlayState => ({ ...state, mode });

/** Solved when the filled cells give every clue; crosses are only notes. */
export function isSolved(state: PlayState, clues: Clues): boolean {
  const filled = state.marks.map((mark) => (mark === 1 ? 1 : 0));
  const mine = cluesOf(filled, state.size);
  return (
    mine.rows.every((clue, i) => sameClue(clue, clues.rows[i])) &&
    mine.cols.every((clue, i) => sameClue(clue, clues.cols[i]))
  );
}

/** Whether a line's filled cells already give its clue, to dim the clue as done. */
export function lineDone(marks: readonly Mark[], clue: readonly number[], cells: readonly number[]) {
  return sameClue(lineClue(cells.map((cell) => (marks[cell] === 1 ? 1 : 0))), clue);
}
