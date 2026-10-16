import { stream } from '../../nonogram/rng';
import type { SkillId, Stats, Tree } from './stats';

// The four skills. Each turn's luck comes from streams named after the fight's seed and
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
/** I'm Speed's power: a reaction test, so a little stronger than the stopwatch it unlocks from. */
export const speedPower = (level: number) => 30 + 5 * (level - 1);
/** A reaction this fast or faster is I'M SPEED: full power and a sure crit. */
export const FLASH_MS = 150;
/** The slowest reaction a move may claim. */
export const SPEED_MAX_MS = 5000;
/** Roulette's levels that add a ball (the user's design); the rest add punch damage. */
export const BALL_LEVELS: readonly number[] = [5, 10];
/** Balls on the wheel: one, plus one at each ball level reached (three at most). */
export const rouletteBalls = (level: number) => (level < 1 ? 0 : 1 + BALL_LEVELS.filter((l) => level >= l).length);
/** A missed Roulette's punch: 12, plus 5 for every level past the first that isn't a ball level. */
export const punchPower = (level: number) => 12 + 5 * Math.max(0, level - rouletteBalls(level));
/** A won Poker's hit (nerfed by the user, 2026-10-11: it was 100 and always a crit). */
export const pokerPower = (level: number) => 50 + 10 * (level - 1);

/** The turn's target, from 1.00 to 10.00 seconds in hundredths (1.23 s is 1230), shown before Start. */
export const stopwatchTarget = (seed: string, turn: number) => (stream(`${seed}:turn:${turn}:target`)(901) + 100) * 10;

/**
 * How long I'm Speed's light stays red before it turns green: 1.50 to 4.50 s, from the seed.
 * The defender's answer waits its own time, so watching the attacker's light on a shared phone doesn't help.
 */
export const speedDelay = (seed: string, turn: number, answer = false) => 1500 + stream(`${seed}:turn:${turn}:${answer ? 'answerDelay' : 'delay'}`)(301) * 10;

/** Percent of power for a reaction of `ms`: 100 up to FLASH_MS, then down 1 every 5 ms, never under 10; a jump the gun (-1) does nothing. */
export const speedPct = (ms: number) => (ms < 0 ? 0 : Math.max(10, 100 - Math.floor(Math.max(0, ms - FLASH_MS) / 5)));

/** A time in ms as seconds to the hundredth: 1230 → "1.23". */
export const seconds = (ms: number) => `${Math.floor(ms / 1000)}.${String(Math.floor((ms % 1000) / 10)).padStart(2, '0')}`;

/** Percent of power for a stop `error` ms off: 100 at 0, down 5 a tenth of a second, never under 10. */
export const accuracyPct = (error: number) => Math.max(10, 100 - Math.floor(error / 20));

/** A hero's move. */
export type Move =
  | { skill: 'stopwatch'; ms: number }
  /** A reaction time in ms, or -1 for a tap before the light turned green. */
  | { skill: 'speed'; ms: number }
  | { skill: 'roulette'; pick: number }
  | { skill: 'poker'; pick: number }
  | { skill: 'card'; pick: number }
  /** The defender's own go at the attacker's Stopwatch (ms stopped) or I'm Speed (reaction, -1 too early). */
  | { skill: 'answer'; ms: number }
  /** Every skill is cooling down: the turn passes. */
  | { skill: 'rest' };

/** A skill's move. `card` and `answer` aren't (the defender's replies), nor `rest`. */
export type SkillMove = Exclude<Move, { skill: 'card' } | { skill: 'answer' } | { skill: 'rest' }>;

/** The skills both sides play (the user's design): the attacker, then the defender; only the better one's hit lands. */
export type ContestMove = Extract<SkillMove, { skill: 'stopwatch' | 'speed' | 'poker' }>;
export const isContest = (move: SkillMove): move is ContestMove => move.skill !== 'roulette';

/** Whether the attacker's reaction beats the defender's: on green (not -1) and strictly faster. */
export const fasterThan = (ms: number, theirs: number) => ms >= 0 && (theirs < 0 || ms < theirs);

export type Detail =
  /** `theirMs` is the defender's stop; `won` when the attacker's was strictly closer. */
  | { skill: 'stopwatch'; target: number; ms: number; theirMs: number | null; pct: number; perfect: boolean; won: boolean }
  /** `theirMs` is the defender's reaction; `won` when the attacker's was strictly faster. */
  | { skill: 'speed'; delay: number; ms: number; theirMs: number | null; pct: number; flash: boolean; won: boolean }
  | { skill: 'rest' }
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
    };

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
 * The thirteen cards of a turn's Poker, 2 to A, as they lie face down after the shuffle.
 * The screen uses it too, to turn over the card you tap at once.
 */
export function pokerDeck(seed: string, turn: number): number[] {
  const shuffle = stream(`${seed}:turn:${turn}:deck`);
  const deck = Array.from({ length: RANKS }, (_, i) => i + 2);
  for (let i = RANKS - 1; i > 0; i--) {
    const j = shuffle(i + 1);
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

/**
 * One skill, from a hero with `tree` against `defender`. `answer` is the defender's reply to a
 * contest: their card for Poker, their stop or reaction for Stopwatch and I'm Speed (without
 * one, Poker's is seeded and the others go uncontested).
 */
export function resolve(move: SkillMove, tree: Tree, attacker: Stats, defender: Stats, seed: string, turn: number, answer?: number): Hit {
  const name = `${seed}:turn:${turn}`;
  const out = (dmg: number) => afterDef(dmg, defender.def);
  const rolledCrit = stream(`${name}:crit`)(100) < attacker.crit;
  switch (move.skill) {
    case 'stopwatch': {
      const target = stopwatchTarget(seed, turn);
      const error = Math.abs(move.ms - target);
      const perfect = error <= PERFECT_MS;
      const pct = perfect ? 100 : accuracyPct(error);
      // Closer than the defender's stop, or the hit misses (a tie misses too).
      const won = answer === undefined || error < Math.abs(answer - target);
      const detail: Detail = { skill: 'stopwatch', target, ms: move.ms, theirMs: answer ?? null, pct, perfect, won };
      if (!won) return { damage: 0, crit: false, kill: false, detail };
      const base = Math.floor((stopwatchPower(tree.stopwatch) * pct) / 100);
      const crit = perfect || rolledCrit;
      return { damage: out(crit ? critOf(base, attacker) : base), crit, kill: false, detail };
    }
    case 'speed': {
      const delay = speedDelay(seed, turn);
      const pct = speedPct(move.ms);
      const flash = move.ms >= 0 && move.ms <= FLASH_MS;
      // Faster than the defender, or the hit misses (a tie misses too).
      const won = answer === undefined ? move.ms >= 0 : fasterThan(move.ms, answer);
      const detail: Detail = { skill: 'speed', delay, ms: move.ms, theirMs: answer ?? null, pct, flash, won };
      if (!won) return { damage: 0, crit: false, kill: false, detail };
      const base = Math.floor((speedPower(tree.speed) * pct) / 100);
      const crit = base > 0 && (flash || rolledCrit);
      return { damage: out(crit ? critOf(base, attacker) : base), crit, kill: false, detail };
    }
    case 'roulette': {
      const roll = stream(`${name}:balls`);
      const balls = Array.from({ length: rouletteBalls(tree.roulette) }, () => roll(WHEEL));
      const hit = balls.includes(move.pick);
      const detail: Detail = { skill: 'roulette', pick: move.pick, balls, hit };
      if (hit) return { damage: 0, crit: false, kill: true, detail };
      const base = punchPower(tree.roulette);
      return { damage: out(rolledCrit ? critOf(base, attacker) : base), crit: rolledCrit, kill: false, detail };
    }
    case 'poker': {
      // One shuffled deck of 2 to A laid face down. The attacker picks a card and the
      // defender another (state.ts waits for it; without one it's seeded), so never a tie.
      const deck = pokerDeck(seed, turn);
      const pick = move.pick;
      const theirPick = answer ?? (pick + 1 + stream(`${name}:theirs`)(RANKS - 1)) % RANKS;
      const mine = deck[pick];
      const theirs = deck[theirPick];
      const won = mine > theirs;
      const detail: Detail = { skill: 'poker', deck, pick, theirPick, mine, theirs, won };
      if (!won) return { damage: 0, crit: false, kill: false, detail };
      const base = pokerPower(tree.poker);
      return { damage: out(rolledCrit ? critOf(base, attacker) : base), crit: rolledCrit, kill: false, detail };
    }
  }
}

export const isSkill = (s: unknown): s is SkillId => s === 'stopwatch' || s === 'speed' || s === 'roulette' || s === 'poker';

export const rankName = (rank: number) => (rank <= 10 ? String(rank) : ['J', 'Q', 'K', 'A'][rank - 11]);
