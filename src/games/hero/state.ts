import { stream } from '../../nonogram/rng';
import { isSkill, RANKS, resolve, SPEED_MAX_MS, WHEEL, type Hit, type Move } from './skills';
import { cooldownOf, HERO_STATS, HERO_TREE, SKILLS, type SkillId, type Stats } from './stats';

// A fight as a reducer: apply(state, move, by) gives the next state, or null when the move
// isn't allowed. Both heroes are the same (HERO_TREE), with all four skills. Turns alternate
// from a seeded coin flip; the fight ends at 0 HP. replay() runs a fight's moves from its
// seed, skipping any the game refuses, so both phones come out the same.

/** Bump when a change would make old fights replay differently. */
export const HERO_VERSION = 8;

export type Side = 0 | 1;

export interface Fighter {
  name: string;
}

export interface Turn extends Hit {
  by: Side;
  skill: SkillId | 'rest';
}

export interface HeroState {
  seed: string;
  fighters: [Fighter, Fighter];
  stats: [Stats, Stats];
  hp: [number, number];
  /** Each fighter's skills cooling down: own turns left before they're ready again. */
  cooldowns: [Cooldowns, Cooldowns];
  /** Whose move it is. */
  turn: Side;
  /** A Poker played and waiting for the defender to pick their card (it's their move). */
  pending: { by: Side; pick: number } | null;
  /** Turns played so far, oldest first. */
  log: Turn[];
  winner: Side | null;
}

export type Cooldowns = Partial<Record<SkillId, number>>;

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
    cooldowns: [{}, {}],
    turn: stream(`${seed}:first`)(2) as Side,
    pending: null,
    log: [],
    winner: null,
  };
}

export const other = (side: Side): Side => (side === 0 ? 1 : 0);

/** Skills this side can use this turn: the ones not cooling down. */
export const ready = (state: HeroState, side: Side): SkillId[] => SKILLS.filter((s) => !state.cooldowns[side][s]);

export function isLegal(state: HeroState, move: Move, by: Side): boolean {
  if (state.winner !== null || by !== state.turn || !move) return false;
  // Waiting on the defender's card: that's the only move, and not the attacker's card.
  if (state.pending) return move.skill === 'card' && Number.isInteger(move.pick) && move.pick >= 0 && move.pick < RANKS && move.pick !== state.pending.pick;
  if (move.skill === 'card') return false;
  if (move.skill === 'rest') return ready(state, by).length === 0;
  if (!isSkill(move.skill) || !ready(state, by).includes(move.skill)) return false;
  if (move.skill === 'stopwatch') return Number.isInteger(move.ms) && move.ms >= 0 && move.ms <= 60_000;
  if (move.skill === 'speed') return Number.isInteger(move.ms) && move.ms >= -1 && move.ms <= SPEED_MAX_MS;
  if (move.skill === 'roulette') return Number.isInteger(move.pick) && move.pick >= 0 && move.pick < WHEEL;
  if (move.skill === 'poker') return Number.isInteger(move.pick) && move.pick >= 0 && move.pick < RANKS;
  return true;
}

export function apply(state: HeroState, move: Move, by: Side): HeroState | null {
  if (!isLegal(state, move, by)) return null;
  // Poker waits for the other side to pick a card, then plays out as the attacker's turn.
  if (move.skill === 'poker') return { ...state, pending: { by, pick: move.pick }, turn: other(by) };
  if (move.skill === 'card') return play({ ...state, pending: null, turn: state.pending!.by }, { skill: 'poker', pick: state.pending!.pick }, state.pending!.by, move.pick);
  return play(state, move, by);
}

function play(state: HeroState, move: Exclude<Move, { skill: 'card' }>, by: Side, theirPick?: number): HeroState {
  const them = other(by);
  const turn = state.log.length;
  const hit: Hit =
    move.skill === 'rest'
      ? { damage: 0, crit: false, kill: false, detail: { skill: 'rest' } }
      : resolve(move, HERO_TREE, state.stats[by], state.stats[them], state.seed, turn, theirPick);

  // The mover's cooldowns count down a turn, then the skill just used starts its own.
  const cooled: Cooldowns = {};
  for (const [skill, left] of Object.entries(state.cooldowns[by]) as [SkillId, number][]) if (left > 1) cooled[skill] = left - 1;
  if (isSkill(move.skill) && cooldownOf(move.skill) > 0) cooled[move.skill] = cooldownOf(move.skill);
  const cooldowns: [Cooldowns, Cooldowns] = by === 0 ? [cooled, state.cooldowns[1]] : [state.cooldowns[0], cooled];

  const hp: [number, number] = [...state.hp];
  hp[them] = hit.kill ? 0 : Math.max(0, hp[them] - hit.damage);

  return {
    ...state,
    hp,
    cooldowns,
    turn: them,
    log: [...state.log, { ...hit, by, skill: move.skill }],
    winner: hp[them] === 0 ? by : null,
  };
}

/** The fight so far: `players` are the ids moves are recorded by, in fighter order. */
export function replay(seed: string, fighters: [Fighter, Fighter], players: readonly [string, string], moves: readonly Recorded[]): HeroState {
  let state = start(seed, fighters);
  for (const { by, move } of moves) {
    const side = players.indexOf(by);
    if (side < 0) continue;
    state = apply(state, move, side as Side) ?? state;
  }
  return state;
}
