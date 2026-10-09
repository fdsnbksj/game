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

/** The turn's target, from 1.00 to 10.00 seconds in hundredths (1.23 s is 1230), shown before Start. */
export const stopwatchTarget = (seed: string, turn: number) => (stream(`${seed}:turn:${turn}:target`)(901) + 100) * 10;

/** A time in ms as seconds to the hundredth: 1230 → "1.23". */
export const seconds = (ms: number) => `${Math.floor(ms / 1000)}.${String(Math.floor((ms % 1000) / 10)).padStart(2, '0')}`;

/** Percent of power for a stop `error` ms off: 100 at 0, down 5 a tenth of a second, never under 10. */
export const accuracyPct = (error: number) => Math.max(10, 100 - Math.floor(error / 20));

/** A hero's skill, or a bot creature's attack (monsters.ts). */
export type Move = { skill: 'stopwatch'; ms: number } | { skill: 'roulette'; pick: number } | { skill: 'poker'; pick: number } | { skill: 'attack'; id: AttackId };

export type SkillMove = Exclude<Move, { skill: 'attack' }>;

export type Detail =
  | { skill: 'stopwatch'; target: number; ms: number; pct: number; perfect: boolean }
  | { skill: 'roulette'; pick: number; balls: number[]; hit: boolean }
  | {
      skill: 'poker';
      /** The thirteen cards as they lay face down after the shuffle, 2 to 14 (ace). */
      deck: number[];
      /** Where the attacker and the defender picked. */
      pick: number;
      theirPick: number;
      mine: number;
      theirs: number;
      won: boolean;
    }
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
      // One shuffled deck of 2 to A laid face down. The attacker picks a card; the defender
      // takes another (seeded), so there's never a tie.
      const shuffle = stream(`${name}:deck`);
      const deck = Array.from({ length: RANKS }, (_, i) => i + 2);
      for (let i = RANKS - 1; i > 0; i--) {
        const j = shuffle(i + 1);
        [deck[i], deck[j]] = [deck[j], deck[i]];
      }
      const pick = move.pick;
      const theirPick = (pick + 1 + stream(`${name}:theirs`)(RANKS - 1)) % RANKS;
      const mine = deck[pick];
      const theirs = deck[theirPick];
      const won = mine > theirs;
      const detail: Detail = { skill: 'poker', deck, pick, theirPick, mine, theirs, won };
      if (!won) return { damage: 0, crit: false, kill: false, detail };
      return { damage: out(critOf(pokerPower(tree.poker), attacker)), crit: true, kill: false, detail };
    }
  }
}

export const isSkill = (s: unknown): s is SkillId => s === 'stopwatch' || s === 'roulette' || s === 'poker';

export const rankName = (rank: number) => (rank <= 10 ? String(rank) : ['J', 'Q', 'K', 'A'][rank - 11]);
