import { stream } from '../../nonogram/rng';
import {
  ATTACKS,
  BURN_PCT,
  CHARGED_PCT,
  ENRAGE_PCT,
  GUARD_DEF,
  hasEffect,
  isAttack,
  resolveAttack,
  WEAK_PCT,
  type Effect,
  type Kit,
} from './monsters';
import { costumeOf, type CostumeId } from './costumes';
import { isSkill, RANKS, resolve, WHEEL, type Hit, type Move } from './skills';
import { SKILLS, statsOf, type SkillId, type Stats, type Tree } from './stats';

// A fight as a reducer: apply(state, move, by) gives the next state, or null when the move
// isn't allowed. Turns alternate from a seeded coin flip; the fight ends at 0 HP. replay()
// runs a fight's moves from its seed, skipping any the game refuses, so a bot fight saved on
// the phone and an online fight read from Firestore both come out the same everywhere.
// Bot levels are creatures with a kit of attacks (monsters.ts) instead of skills; their
// buffs and hindrances are effects that last a few turns.

/** Bump when a change would make old fights replay differently. */
export const HERO_VERSION = 4;

export type Side = 0 | 1;

export interface Fighter {
  name: string;
  /** A hero's tree; a creature uses only its stats. */
  tree: Tree;
  /** A bot creature's attacks, instead of skills. */
  kit?: Kit;
  /** The costume a hero wears, for its bonus. */
  costume?: CostumeId | null;
}

export interface Turn extends Hit {
  by: Side;
  skill: SkillId | 'attack';
  /** What a burn took from the mover after its move. */
  burn: number;
}

export interface HeroState {
  seed: string;
  fighters: [Fighter, Fighter];
  stats: [Stats, Stats];
  hp: [number, number];
  /** Effects on each fighter. */
  effects: [Effect[], Effect[]];
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
  const stats: [Stats, Stats] = [statsOf(fighters[0].tree, bonusOf(fighters[0])), statsOf(fighters[1].tree, bonusOf(fighters[1]))];
  return { seed, fighters, stats, hp: [stats[0].hp, stats[1].hp], effects: [[], []], turn: stream(`${seed}:first`)(2) as Side, log: [], winner: null };
}

const bonusOf = (f: Fighter) => costumeOf(f.costume)?.bonus;

export const other = (side: Side): Side => (side === 0 ? 1 : 0);

/** Skills this fighter can use: any at level 1 or more. */
export const usable = (tree: Tree) => SKILLS.filter((s) => tree[s] > 0);

/** A boss below half its HP. */
export const enraged = (state: HeroState, side: Side) => !!state.fighters[side].kit?.enrage && state.hp[side] * 2 < state.stats[side].hp;

export function isLegal(state: HeroState, move: Move, by: Side): boolean {
  if (state.winner !== null || by !== state.turn || !move) return false;
  if (move.skill === 'attack') return isAttack(move.id) && !!state.fighters[by].kit?.attacks.includes(move.id);
  if (!isSkill(move.skill) || state.fighters[by].tree[move.skill] < 1) return false;
  if (move.skill === 'stopwatch') return Number.isInteger(move.ms) && move.ms >= 0 && move.ms <= 60_000;
  if (move.skill === 'roulette') return Number.isInteger(move.pick) && move.pick >= 0 && move.pick < WHEEL;
  if (move.skill === 'poker') return Number.isInteger(move.pick) && move.pick >= 0 && move.pick < RANKS;
  return true;
}

export function apply(state: HeroState, move: Move, by: Side): HeroState | null {
  if (!isLegal(state, move, by)) return null;
  const them = other(by);
  const mine = state.effects[by];
  const theirs = state.effects[them];
  // Effects on the damage, before DEF.
  const hurts = move.skill !== 'attack' || ATTACKS[move.id].power > 0;
  const charged = hurts && hasEffect(mine, 'charged');
  let boost = 100;
  if (charged) boost = (boost * CHARGED_PCT) / 100;
  if (hasEffect(mine, 'weak')) boost = Math.floor((boost * WEAK_PCT) / 100);
  if (enraged(state, by)) boost = Math.floor((boost * ENRAGE_PCT) / 100);
  const defender = hasEffect(theirs, 'guard') ? { ...state.stats[them], def: state.stats[them].def + GUARD_DEF } : state.stats[them];
  const turn = state.log.length;
  const hit: Hit =
    move.skill === 'attack'
      ? resolveAttack(move.id, state.fighters[by].kit!, state.stats[by], defender, state.seed, turn, boost)
      : resolve(move, state.fighters[by].tree, state.stats[by], defender, state.seed, turn, boost);

  const hp: [number, number] = [...state.hp];
  hp[them] = hit.kill ? 0 : Math.max(0, hp[them] - hit.damage);
  if (hit.detail.skill === 'attack') hp[by] = Math.min(state.stats[by].hp, hp[by] + hit.detail.healed);

  // The mover's effects run down after its move (a burn hurts as it does); ones gained this
  // turn start counting next turn.
  let burn = 0;
  if (hp[them] > 0 && hasEffect(mine, 'burn')) {
    burn = Math.max(1, Math.floor((state.stats[by].hp * BURN_PCT) / 100));
    hp[by] = Math.max(0, hp[by] - burn);
  }
  let myEffects = mine.filter((e) => !(charged && e.id === 'charged')).map((e) => ({ ...e, turns: e.turns - 1 })).filter((e) => e.turns > 0);
  let theirEffects = theirs;
  const cast = hit.detail.skill === 'attack' && hit.detail.effect ? ATTACKS[hit.detail.id].effect : undefined;
  if (cast) {
    const add = (list: Effect[]) => [...list.filter((e) => e.id !== cast.id), { id: cast.id, turns: cast.turns }];
    if (cast.on === 'self') myEffects = add(myEffects);
    else theirEffects = add(theirEffects);
  }
  const effects: [Effect[], Effect[]] = by === 0 ? [myEffects, theirEffects] : [theirEffects, myEffects];

  return {
    ...state,
    hp,
    effects,
    turn: them,
    log: [...state.log, { ...hit, by, skill: move.skill, burn }],
    winner: hp[them] === 0 ? by : hp[by] === 0 ? them : null,
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
