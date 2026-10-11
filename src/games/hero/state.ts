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
import { isSkill, RANKS, resolve, SPEED_MAX_MS, WHEEL, type Hit, type Move } from './skills';
import { cooldownOf, defaultLoadout, statsOf, validLoadout, type SkillId, type Stats, type Tree } from './stats';

// A fight as a reducer: apply(state, move, by) gives the next state, or null when the move
// isn't allowed. Turns alternate from a seeded coin flip; the fight ends at 0 HP. replay()
// runs a fight's moves from its seed, skipping any the game refuses, so a bot fight saved on
// the phone and an online fight read from Firestore both come out the same everywhere.
// Bot levels are creatures with a kit of attacks (monsters.ts) instead of skills; their
// buffs and hindrances are effects that last a few turns.

/** Bump when a change would make old fights replay differently. */
export const HERO_VERSION = 7;

export type Side = 0 | 1;

export interface Fighter {
  name: string;
  /** A hero's tree; a creature uses only its stats. */
  tree: Tree;
  /** A bot creature's attacks, instead of skills. */
  kit?: Kit;
  /** The skills a hero brings (up to four); without one, its first four. */
  loadout?: SkillId[];
}

export interface Turn extends Hit {
  by: Side;
  skill: SkillId | 'attack' | 'rest';
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
  const stats: [Stats, Stats] = [statsOf(fighters[0].tree), statsOf(fighters[1].tree)];
  return { seed, fighters, stats, hp: [stats[0].hp, stats[1].hp], effects: [[], []], cooldowns: [{}, {}], turn: stream(`${seed}:first`)(2) as Side, pending: null, log: [], winner: null };
}

export const other = (side: Side): Side => (side === 0 ? 1 : 0);

/** Skills this fighter brings: its loadout, or its first four. */
export const usable = (f: Pick<Fighter, 'tree' | 'loadout'>): SkillId[] => validLoadout(f.loadout, f.tree) ?? defaultLoadout(f.tree);

/** Skills this side can use this turn: brought and not cooling down. */
export const ready = (state: HeroState, side: Side): SkillId[] => usable(state.fighters[side]).filter((s) => !state.cooldowns[side][s]);

/** A boss below half its HP. */
export const enraged = (state: HeroState, side: Side) => !!state.fighters[side].kit?.enrage && state.hp[side] * 2 < state.stats[side].hp;

export function isLegal(state: HeroState, move: Move, by: Side): boolean {
  if (state.winner !== null || by !== state.turn || !move) return false;
  // Waiting on the defender's card: that's the only move, and not the attacker's card.
  if (state.pending) return move.skill === 'card' && Number.isInteger(move.pick) && move.pick >= 0 && move.pick < RANKS && move.pick !== state.pending.pick;
  if (move.skill === 'card') return false;
  if (move.skill === 'attack') return isAttack(move.id) && !!state.fighters[by].kit?.attacks.includes(move.id);
  if (state.fighters[by].kit) return false;
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
  const mine = state.effects[by];
  const theirs = state.effects[them];
  // Effects on the damage, before DEF.
  const hurts = move.skill !== 'rest' && (move.skill !== 'attack' || ATTACKS[move.id].power > 0);
  const charged = hurts && hasEffect(mine, 'charged');
  let boost = 100;
  if (charged) boost = (boost * CHARGED_PCT) / 100;
  if (hasEffect(mine, 'weak')) boost = Math.floor((boost * WEAK_PCT) / 100);
  if (enraged(state, by)) boost = Math.floor((boost * ENRAGE_PCT) / 100);
  const defender = hasEffect(theirs, 'guard') ? { ...state.stats[them], def: state.stats[them].def + GUARD_DEF } : state.stats[them];
  const turn = state.log.length;
  const hit: Hit =
    move.skill === 'rest'
      ? { damage: 0, crit: false, kill: false, detail: { skill: 'rest' } }
      : move.skill === 'attack'
        ? resolveAttack(move.id, state.fighters[by].kit!, state.stats[by], defender, state.seed, turn, boost)
        : resolve(move, state.fighters[by].tree, state.stats[by], defender, state.seed, turn, boost, theirPick);

  // The mover's cooldowns count down a turn, then the skill just used starts its own.
  const cooled: Cooldowns = {};
  for (const [skill, left] of Object.entries(state.cooldowns[by]) as [SkillId, number][]) if (left > 1) cooled[skill] = left - 1;
  if (isSkill(move.skill) && cooldownOf(move.skill) > 0) cooled[move.skill] = cooldownOf(move.skill);
  const cooldowns: [Cooldowns, Cooldowns] = by === 0 ? [cooled, state.cooldowns[1]] : [state.cooldowns[0], cooled];

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
    cooldowns,
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
