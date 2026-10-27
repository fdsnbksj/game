import { createRandom, hashSeed } from '../../shared/random';

// Vault: a hidden code of coloured pegs. Make a guess and the lock answers with two counts: pegs
// of the right colour in the right place, and pegs of the right colour in the wrong place. Work
// the code out from the answers. Pure and deterministic: a level's code comes from its number
// alone, so it's the same lock on every phone, and a game in progress is its level and moves.

/** Bump when a level's code, rules or a move would come out differently; it restarts saved games. */
export const VAULT_VERSION = 1;

/** The most colours a level uses (the screen has a token for each). */
export const MAX_COLOURS = 8;

/** A level's lock: how many pegs, how many colours, and whether a colour can repeat. */
export interface Rules {
  slots: number;
  colours: number;
  repeats: boolean;
}

/** A guess's answer: right colour in the right place, right colour in the wrong place. */
export interface Answer {
  exact: number;
  near: number;
}

/**
 * A move: a colour (0 to colours − 1) goes in the first empty slot; `CLEAR + i` empties slot i;
 * `TRY` tries the row once it's full.
 */
export type Move = number;
export const CLEAR = 10;
export const TRY = 99;

export interface VaultGame {
  level: number;
  rules: Rules;
  /** The hidden code. */
  code: number[];
  /** Each row tried, oldest first, with the lock's answer. */
  tries: { guess: number[]; answer: Answer }[];
  /** The row being made: a colour or null per slot. */
  draft: (number | null)[];
  moves: Move[];
}

/** A level's lock: 3 pegs of 4 colours to start, up to 5 pegs of 8 colours that can repeat. */
export function rulesFor(level: number): Rules {
  const l = Math.max(1, level);
  if (l <= 2) return { slots: 3, colours: 4, repeats: false };
  if (l <= 6) return { slots: 4, colours: 5, repeats: false };
  if (l <= 12) return { slots: 4, colours: 6, repeats: true };
  if (l <= 20) return { slots: 5, colours: 6, repeats: true };
  return { slots: 5, colours: 8, repeats: true };
}

/** How the lock answers `guess` when the code is `code`. */
export function score(code: readonly number[], guess: readonly number[]): Answer {
  let exact = 0;
  const left = new Array<number>(MAX_COLOURS).fill(0);
  const tried = new Array<number>(MAX_COLOURS).fill(0);
  for (let i = 0; i < code.length; i++) {
    if (code[i] === guess[i]) exact++;
    else {
      left[code[i]]++;
      tried[guess[i]]++;
    }
  }
  let near = 0;
  for (let c = 0; c < MAX_COLOURS; c++) near += Math.min(left[c], tried[c]);
  return { exact, near };
}

/** Whether a row keeps to the level's rules (every slot a colour, no repeats unless allowed). */
export function fits(rules: Rules, code: readonly number[]) {
  if (code.length !== rules.slots) return false;
  if (!code.every((c) => Number.isInteger(c) && c >= 0 && c < rules.colours)) return false;
  return rules.repeats || new Set(code).size === code.length;
}

/** Every code the level allows, in order: as many as `colours ** slots`, at most 8⁵. */
function codeAt(rules: Rules, index: number): number[] {
  const code: number[] = [];
  for (let i = 0; i < rules.slots; i++) {
    code.push(index % rules.colours);
    index = Math.floor(index / rules.colours);
  }
  return code.reverse();
}

function codeCount(rules: Rules) {
  return rules.colours ** rules.slots;
}

/** Makes a level's code from its seed. */
export function makeCode(level: number): number[] {
  const rules = rulesFor(level);
  const random = createRandom(hashSeed(`vault:${VAULT_VERSION}:level:${level}`));
  for (;;) {
    const code = Array.from({ length: rules.slots }, () => Math.floor(random() * rules.colours));
    if (fits(rules, code)) return code;
  }
}

export function newGame(level: number): VaultGame {
  const rules = rulesFor(level);
  return { level, rules, code: makeCode(level), tries: [], draft: new Array(rules.slots).fill(null), moves: [] };
}

export function isSolved(game: VaultGame) {
  const last = game.tries[game.tries.length - 1];
  return last !== undefined && last.answer.exact === game.rules.slots;
}

/** Plays one move; returns the game unchanged when it doesn't apply (or once solved). */
export function play(game: VaultGame, move: Move): VaultGame {
  if (isSolved(game) || !Number.isInteger(move)) return game;
  const { rules, draft } = game;
  if (move >= 0 && move < rules.colours) {
    const slot = draft.indexOf(null);
    if (slot < 0 || (!rules.repeats && draft.includes(move))) return game;
    const next = draft.slice();
    next[slot] = move;
    return { ...game, draft: next, moves: [...game.moves, move] };
  }
  if (move >= CLEAR && move < CLEAR + rules.slots) {
    if (draft[move - CLEAR] === null) return game;
    const next = draft.slice();
    next[move - CLEAR] = null;
    return { ...game, draft: next, moves: [...game.moves, move] };
  }
  if (move === TRY) {
    const guess = draft as number[];
    if (draft.includes(null) || !fits(rules, guess) || game.tries.some((t) => same(t.guess, guess))) return game;
    return {
      ...game,
      tries: [...game.tries, { guess, answer: score(game.code, guess) }],
      draft: new Array(rules.slots).fill(null),
      moves: [...game.moves, move],
    };
  }
  return game;
}

function same(a: readonly number[], b: readonly number[]) {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

/** A level and its moves, played from the start: how a saved game comes back. Moves that don't apply are dropped. */
export function replay(level: number, moves: readonly Move[]): VaultGame {
  let game = newGame(level);
  for (const move of moves) game = play(game, move);
  return game;
}

/** Takes back the last move (a peg, a cleared slot or a try). */
export function undo(game: VaultGame): VaultGame {
  if (game.moves.length === 0 || isSolved(game)) return game;
  return replay(game.level, game.moves.slice(0, -1));
}

/** Whether `code` could still be the answer: every row tried would have got the answer it did. */
export function couldBe(game: VaultGame, code: readonly number[]) {
  return (
    fits(game.rules, code) &&
    game.tries.every((t) => {
      const a = score(code, t.guess);
      return a.exact === t.answer.exact && a.near === t.answer.near;
    })
  );
}

/** How many codes still fit every answer so far. */
export function codesLeft(game: VaultGame): number {
  let n = 0;
  for (let i = 0; i < codeCount(game.rules); i++) if (couldBe(game, codeAt(game.rules, i))) n++;
  return n;
}

/**
 * A code that fits every answer so far, or null once solved: the first one from a place in the
 * list chosen by the level's seed, so hints don't always start with the same colours. The real
 * code always fits and a row already tried only fits if it opened the lock, so trying hints
 * always opens it.
 */
export function hint(game: VaultGame): number[] | null {
  if (isSolved(game)) return null;
  const count = codeCount(game.rules);
  const start = hashSeed(`vault:${VAULT_VERSION}:hint:${game.level}`) % count;
  for (let k = 0; k < count; k++) {
    const code = codeAt(game.rules, (start + k) % count);
    if (couldBe(game, code)) return code;
  }
  return null;
}

/** The moves that empty the row being made and fill it with `code`. */
export function fillMoves(game: VaultGame, code: readonly number[]): Move[] {
  const clears = game.draft.flatMap((c, i) => (c === null ? [] : [CLEAR + i]));
  return [...clears, ...code];
}
