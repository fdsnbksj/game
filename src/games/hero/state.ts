import { stream } from '../../nonogram/rng';
import { isSkill, resolve, WHEEL, type Hit, type Move } from './skills';
import { SKILLS, statsOf, type SkillId, type Stats, type Tree } from './stats';

// A fight as a reducer: apply(state, move, by) gives the next state, or null when the move
// isn't allowed. Turns alternate from a seeded coin flip; the fight ends at 0 HP. replay()
// runs a fight's moves from its seed, skipping any the game refuses, so a bot fight saved on
// the phone and an online fight read from Firestore both come out the same everywhere.

/** Bump when a change would make old fights replay differently. */
export const HERO_VERSION = 1;

export type Side = 0 | 1;

export interface Fighter {
  name: string;
  tree: Tree;
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
  /** Turns played so far, oldest first. */
  log: Turn[];
  winner: Side | null;
}

export interface Recorded {
  by: string;
  move: Move;
}

export function start(seed: string, fighters: [Fighter, Fighter]): HeroState {
  const stats: [Stats, Stats] = [statsOf(fighters[0].tree), statsOf(fighters[1].tree)];
  return { seed, fighters, stats, hp: [stats[0].hp, stats[1].hp], turn: stream(`${seed}:first`)(2) as Side, log: [], winner: null };
}

export const other = (side: Side): Side => (side === 0 ? 1 : 0);

/** Skills this fighter can use: any at level 1 or more. */
export const usable = (tree: Tree) => SKILLS.filter((s) => tree[s] > 0);

export function isLegal(state: HeroState, move: Move, by: Side): boolean {
  if (state.winner !== null || by !== state.turn || !move || !isSkill(move.skill)) return false;
  if (state.fighters[by].tree[move.skill] < 1) return false;
  if (move.skill === 'stopwatch') return Number.isInteger(move.ms) && move.ms >= 0 && move.ms <= 60_000;
  if (move.skill === 'roulette') return Number.isInteger(move.pick) && move.pick >= 0 && move.pick < WHEEL;
  return true;
}

export function apply(state: HeroState, move: Move, by: Side): HeroState | null {
  if (!isLegal(state, move, by)) return null;
  const them = other(by);
  const hit = resolve(move, state.fighters[by].tree, state.stats[by], state.stats[them], state.seed, state.log.length);
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
