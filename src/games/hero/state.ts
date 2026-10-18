import { stream } from '../../nonogram/rng';
import { isContest, isCount, isReply, isTaps, resolve, SPEED_MAX_MS, WHEEL, type ContestMove, type Hit, type Move, type SkillMove } from './skills';
import { EVERYDAY, HERO_STATS, HERO_TREE, LAST_STAND, LAST_STAND_HP, type SkillId, type Stats } from './stats';

// A fight as a reducer: apply(state, move, by) gives the next state, or null when the move
// isn't allowed. Both heroes are the same (HERO_TREE). Turns alternate from a seeded coin
// flip, and the seed picks each turn's skill (skillOf); the fight ends at 0 HP. replay() runs
// a fight's moves from its seed, skipping any the game refuses, so both phones come out the same.

/** Bump when a change would make old fights replay differently. */
export const HERO_VERSION = 14;

export type Side = 0 | 1;

export interface Fighter {
  name: string;
}

export interface Turn extends Hit {
  by: Side;
  skill: SkillId;
}

export interface HeroState {
  seed: string;
  fighters: [Fighter, Fighter];
  stats: [Stats, Stats];
  hp: [number, number];
  /** Whose move it is. */
  turn: Side;
  /** A contest (Stopwatch, I'm Speed, Memory, Fast as Fuck) played and waiting for the defender's go (it's their move). */
  pending: { by: Side; move: ContestMove } | null;
  /** Turns played so far, oldest first. */
  log: Turn[];
  winner: Side | null;
}

export interface Recorded {
  by: string;
  move: Move;
}

export function start(seed: string, fighters: [Fighter, Fighter]): HeroState {
  return {
    seed,
    fighters,
    stats: [HERO_STATS, HERO_STATS],
    hp: [HERO_STATS.hp, HERO_STATS.hp],
    turn: stream(`${seed}:first`)(2) as Side,
    pending: null,
    log: [],
    winner: null,
  };
}

export const other = (side: Side): Side => (side === 0 ? 1 : 0);

/**
 * The skill the game gives whoever's turn it is (the user's design): one of the everyday four,
 * or at LAST_STAND_HP or less, Roulette or Jackpot. Drawn from the seed and the turn.
 */
export function skillOf(state: HeroState): SkillId {
  const pool = state.hp[state.turn] <= LAST_STAND_HP ? LAST_STAND : EVERYDAY;
  return pool[stream(`${state.seed}:turn:${state.log.length}:skill`)(pool.length)];
}

export function isLegal(state: HeroState, move: Move, by: Side): boolean {
  if (state.winner !== null || by !== state.turn || !move) return false;
  // Waiting on the defender's go: that's the only move.
  const pending = state.pending?.move;
  if (pending?.skill === 'memory') return move.skill === 'recall' && isCount(move.count);
  if (pending?.skill === 'fast') return move.skill === 'tapback' && isTaps(move.taps);
  if (pending) return move.skill === 'answer' && isTimed(pending.skill, move.ms);
  if (isReply(move) || move.skill !== skillOf(state)) return false;
  if (move.skill === 'stopwatch' || move.skill === 'speed') return isTimed(move.skill, move.ms);
  if (move.skill === 'roulette') return Number.isInteger(move.pick) && move.pick >= 0 && move.pick < WHEEL;
  if (move.skill === 'memory') return isCount(move.count);
  if (move.skill === 'fast') return isTaps(move.taps);
  return true;
}

const isTimed = (skill: 'stopwatch' | 'speed', ms: number) =>
  Number.isInteger(ms) && (skill === 'stopwatch' ? ms >= 0 && ms <= 60_000 : ms >= -1 && ms <= SPEED_MAX_MS);

export function apply(state: HeroState, move: Move, by: Side): HeroState | null {
  if (!isLegal(state, move, by)) return null;
  // A contest waits for the other side's go (a count, a stop, a reaction, taps), then plays out as the attacker's turn.
  if (isReply(move)) {
    const { by: attacker, move: theirs } = state.pending!;
    const answer = move.skill === 'recall' ? move.count : move.skill === 'tapback' ? move.taps : move.ms;
    return play({ ...state, pending: null, turn: attacker }, theirs, attacker, answer);
  }
  if (isContest(move)) return { ...state, pending: { by, move }, turn: other(by) };
  return play(state, move, by);
}

function play(state: HeroState, move: SkillMove, by: Side, answer?: number): HeroState {
  const them = other(by);
  const turn = state.log.length;
  const hit: Hit = resolve(move, HERO_TREE, state.stats[by], state.stats[them], state.seed, turn, answer);

  const hp: [number, number] = [...state.hp];
  hp[them] = hit.kill ? 0 : Math.max(0, hp[them] - hit.damage);

  return {
    ...state,
    hp,
    turn: them,
    log: [...state.log, { ...hit, by, skill: move.skill }],
    winner: hp[them] === 0 ? by : null,
  };
}

/**
 * The fight so far: `players` are the ids moves are recorded by, in fighter order.
 * `onRefused` hears of each player's move the game skipped (a phone on another version, or tampered).
 */
export function replay(seed: string, fighters: [Fighter, Fighter], players: readonly [string, string], moves: readonly Recorded[], onRefused?: (side: Side) => void): HeroState {
  let state = start(seed, fighters);
  for (const { by, move } of moves) {
    const side = players.indexOf(by);
    if (side < 0) continue;
    const next = apply(state, move, side as Side);
    if (next) state = next;
    else onRefused?.(side as Side);
  }
  return state;
}
