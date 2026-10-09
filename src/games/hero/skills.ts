import { stream } from '../../nonogram/rng';
import type { AttackId, EffectId } from './monsters';
import type { SkillId, Stats, Tree } from './stats';

// The three skills. Each turn's luck comes from streams named after the fight's seed and
// the turn number, so both phones (or a replay) roll the same balls, cards and crits.
// Whole numbers only.

export const WHEEL = 37;
/** Ranks 2..14: 11 is J, 12 Q, 13 K, 14 A (ace high). */
export const RANKS = 13;
/** Within this many ms of the target is Perfect: full power and a sure crit. */
export const PERFECT_MS = 50;
/** The stopwatch's running clock shows for this long, then hides. */
export const VISIBLE_MS = 1000;

export const stopwatchPower = (level: number) => 20 + 4 * level;
export const punchPower = (level: number) => 12 + 2 * level;
export const pokerPower = (level: number) => 100 + 10 * (level - 1);

/** The turn's target, in whole seconds from 1 to 10, shown before Start. */
export const stopwatchTarget = (seed: string, turn: number) => (stream(`${seed}:turn:${turn}:target`)(10) + 1) * 1000;

/** Percent of power for a stop `error` ms off: 100 at 0, down 5 a tenth of a second, never under 10. */
export const accuracyPct = (error: number) => Math.max(10, 100 - Math.floor(error / 20));

/** A hero's skill, or a bot creature's attack (monsters.ts). */
export type Move = { skill: 'stopwatch'; ms: number } | { skill: 'roulette'; pick: number } | { skill: 'poker' } | { skill: 'attack'; id: AttackId };

export type SkillMove = Exclude<Move, { skill: 'attack' }>;

export type Detail =
  | { skill: 'stopwatch'; target: number; ms: number; pct: number; perfect: boolean }
  | { skill: 'roulette'; pick: number; balls: number[]; hit: boolean }
  | { skill: 'poker'; mine: number; theirs: number; won: boolean }
  | { skill: 'attack'; id: AttackId; missed: boolean; healed: number; effect: EffectId | null };

export interface Hit {
  /** HP taken from the defender, after DEF. */
  damage: number;
  crit: boolean;
  kill: boolean;
  detail: Detail;
}

/** Damage after the defender's DEF: dmg × 100 / (100 + DEF), at least 1 for any hit. */
export const afterDef = (dmg: number, def: number) => (dmg <= 0 ? 0 : Math.max(1, Math.round((dmg * 100) / (100 + def))));

const critOf = (dmg: number, stats: Stats) => Math.floor((dmg * stats.critDmg) / 100);

/**
 * One skill. `boost` is the percent its damage is at, before DEF: 100 unless an effect
 * (monsters.ts) changes it, so fights without effects come out as they always did.
 */
export function resolve(move: SkillMove, tree: Tree, attacker: Stats, defender: Stats, seed: string, turn: number, boost = 100): Hit {
  const name = `${seed}:turn:${turn}`;
  const out = (dmg: number) => afterDef(Math.floor((dmg * boost) / 100), defender.def);
  const rolledCrit = stream(`${name}:crit`)(100) < attacker.crit;
  switch (move.skill) {
    case 'stopwatch': {
      const target = stopwatchTarget(seed, turn);
      const error = Math.abs(move.ms - target);
      const perfect = error <= PERFECT_MS;
      const pct = perfect ? 100 : accuracyPct(error);
      const base = Math.floor((stopwatchPower(tree.stopwatch) * pct) / 100);
      const crit = perfect || rolledCrit;
      return { damage: out(crit ? critOf(base, attacker) : base), crit, kill: false, detail: { skill: 'stopwatch', target, ms: move.ms, pct, perfect } };
    }
    case 'roulette': {
      const roll = stream(`${name}:balls`);
      const balls = Array.from({ length: tree.roulette }, () => roll(WHEEL));
      const hit = balls.includes(move.pick);
      const detail: Detail = { skill: 'roulette', pick: move.pick, balls, hit };
      if (hit) return { damage: 0, crit: false, kill: true, detail };
      const base = punchPower(tree.roulette);
      return { damage: out(rolledCrit ? critOf(base, attacker) : base), crit: rolledCrit, kill: false, detail };
    }
    case 'poker': {
      // Two different cards from one deck, so there's never a tie.
      const draw = stream(`${name}:cards`);
      const a = draw(RANKS);
      const b = (a + 1 + draw(RANKS - 1)) % RANKS;
      const mine = a + 2;
      const theirs = b + 2;
      const won = mine > theirs;
      const detail: Detail = { skill: 'poker', mine, theirs, won };
      if (!won) return { damage: 0, crit: false, kill: false, detail };
      return { damage: out(critOf(pokerPower(tree.poker), attacker)), crit: true, kill: false, detail };
    }
  }
}

export const isSkill = (s: unknown): s is SkillId => s === 'stopwatch' || s === 'roulette' || s === 'poker';

export const rankName = (rank: number) => (rank <= 10 ? String(rank) : ['J', 'Q', 'K', 'A'][rank - 11]);
