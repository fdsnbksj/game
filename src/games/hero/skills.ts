import { stream } from '../../nonogram/rng';
import { SKILLS, type SkillId, type Stats, type Tree } from './stats';

// The six skills. Each turn's luck comes from streams named after the fight's seed and
// the turn number, so both phones (or a replay) roll the same balls, numbers and crits.
// Whole numbers only.

export const WHEEL = 37;
/** Memory's number: this many digits, shown for MEMORY_SHOW_MS, then typed back. */
export const MEMORY_DIGITS = 20;
export const MEMORY_SHOW_MS = 5000;
/** Within this many ms of the target is Perfect: full power and a sure crit. */
export const PERFECT_MS = 50;
/** The stopwatch's running clock shows for this long, then hides. */
export const VISIBLE_MS = 1000;

/** Raised for 200 HP (the user's ask, 2026-10-17: fights were too long); it was 24 at level 1. */
export const stopwatchPower = (level: number) => 56 + 4 * level;
/** I'm Speed's power: a reaction test, so a little stronger than the stopwatch it unlocks from. */
export const speedPower = (level: number) => 70 + 5 * (level - 1);
/** A reaction this fast or faster is I'M SPEED: full power and a sure crit. */
export const FLASH_MS = 150;
/** The slowest reaction a move may claim. */
export const SPEED_MAX_MS = 5000;
/** Roulette's levels that add a ball (the user's design); the rest add punch damage. */
export const BALL_LEVELS: readonly number[] = [5, 10];
/** Balls on the wheel: one, plus one at each ball level reached (three at most). */
export const rouletteBalls = (level: number) => (level < 1 ? 0 : 1 + BALL_LEVELS.filter((l) => level >= l).length);
/** A missed Roulette's punch: 30, plus 5 for every level past the first that isn't a ball level. */
export const punchPower = (level: number) => 30 + 5 * Math.max(0, level - rouletteBalls(level));
/** A won Memory's hit: 90, like the Poker it replaced (the user's ask, 2026-10-18). */
export const memoryPower = (level: number) => 90 + 10 * (level - 1);
/** Fast as Fuck (the user's name): tap for this long, then the other side does. */
export const FAST_MS = 5000;
/** The most taps a go may claim: 30 a second, faster than any thumb. */
export const FAST_MAX_TAPS = 150;
/** Each tap more than the other side's hits for this much, up to FAST_CAP. */
export const FAST_PER_TAP = 5;
export const FAST_CAP = 100;
/** Jackpot's reels: three, each one of this many symbols. Three alike is an instant kill. */
export const REELS = 3;
export const SYMBOLS = 6;
/** A Jackpot pair hits for double this (the user's design); nothing alike, no damage. */
export const jackpotPower = (level: number) => 40 + 5 * (level - 1);
/** Every hit's damage varies by this many percent either way (the user's ask, 2026-10-18). */
export const VARY_PCT = 20;

/** The turn's target, from 1.00 to 10.00 seconds in hundredths (1.23 s is 1230), shown before Start. */
export const stopwatchTarget = (seed: string, turn: number) => (stream(`${seed}:turn:${turn}:target`)(901) + 100) * 10;

/**
 * How long I'm Speed's light stays red before it turns green: 1.50 to 4.50 s, from the seed.
 * The defender's answer waits its own time, so watching the attacker's light on a shared phone doesn't help.
 */
export const speedDelay = (seed: string, turn: number, answer = false) => 1500 + stream(`${seed}:turn:${turn}:${answer ? 'answerDelay' : 'delay'}`)(301) * 10;

/** Percent of power for a reaction of `ms`: 100 up to FLASH_MS, then down 1 every 5 ms, never under 10; a jump the gun (-1) does nothing. */
export const speedPct = (ms: number) => (ms < 0 ? 0 : Math.max(10, 100 - Math.floor(Math.max(0, ms - FLASH_MS) / 5)));

/** The turn's reels for Jackpot, each 0 to SYMBOLS - 1. */
export const jackpotReels = (seed: string, turn: number) => {
  const spin = stream(`${seed}:turn:${turn}:reels`);
  return Array.from({ length: REELS }, () => spin(SYMBOLS));
};

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
  /** How many digits of the turn's number were typed back right before the first wrong one. */
  | { skill: 'memory'; count: number }
  /** The defender's own go at the attacker's Memory, with their own number. */
  | { skill: 'recall'; count: number }
  /** The defender's own go at the attacker's Stopwatch (ms stopped) or I'm Speed (reaction, -1 too early). */
  | { skill: 'answer'; ms: number }
  /** How many times the screen was tapped in FAST_MS. */
  | { skill: 'fast'; taps: number }
  /** The defender's own go at the attacker's Fast as Fuck. */
  | { skill: 'tapback'; taps: number }
  | { skill: 'jackpot' };

/** A skill's move. `recall`, `answer` and `tapback` aren't: they're the defender's replies. */
export type SkillMove = Exclude<Move, { skill: 'recall' | 'answer' | 'tapback' }>;
export type Reply = Extract<Move, { skill: 'recall' | 'answer' | 'tapback' }>;
export const isReply = (move: Move): move is Reply => move.skill === 'recall' || move.skill === 'answer' || move.skill === 'tapback';

/** The skills both sides play (the user's design): the attacker, then the defender; only the better one's hit lands. */
export type ContestMove = Extract<SkillMove, { skill: 'stopwatch' | 'speed' | 'memory' | 'fast' }>;
export const isContest = (move: SkillMove): move is ContestMove => move.skill !== 'roulette' && move.skill !== 'jackpot';

/** Whether the attacker's reaction beats the defender's: on green (not -1) and strictly faster. */
export const fasterThan = (ms: number, theirs: number) => ms >= 0 && (theirs < 0 || ms < theirs);

export type Detail =
  /** `theirMs` is the defender's stop; `won` when the attacker's was strictly closer. */
  | { skill: 'stopwatch'; target: number; ms: number; theirMs: number | null; pct: number; perfect: boolean; won: boolean }
  /** `theirMs` is the defender's reaction; `won` when the attacker's was strictly faster. */
  | { skill: 'speed'; delay: number; ms: number; theirMs: number | null; pct: number; flash: boolean; won: boolean }
  | { skill: 'roulette'; pick: number; balls: number[]; hit: boolean }
  /** `theirCount` is the defender's; `won` when the attacker remembered strictly more. All of it is Perfect. */
  | { skill: 'memory'; count: number; theirCount: number | null; perfect: boolean; won: boolean }
  /** `theirTaps` is the defender's; `won` when the attacker tapped strictly more. */
  | { skill: 'fast'; taps: number; theirTaps: number | null; won: boolean }
  /** Three alike is a kill, a pair a double hit. */
  | { skill: 'jackpot'; reels: number[]; three: boolean; pair: boolean };

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

/** The turn's damage roll: 100 - VARY_PCT to 100 + VARY_PCT percent. */
export const varyPct = (seed: string, turn: number) => 100 - VARY_PCT + stream(`${seed}:turn:${turn}:vary`)(2 * VARY_PCT + 1);

/**
 * The turn's number to remember, MEMORY_DIGITS digits. The defender's answer gets its own,
 * so watching the attacker's on a shared phone doesn't help.
 */
export function memoryNumber(seed: string, turn: number, answer = false): string {
  const digit = stream(`${seed}:turn:${turn}:${answer ? 'answerDigits' : 'digits'}`);
  return Array.from({ length: MEMORY_DIGITS }, () => digit(10)).join('');
}

/**
 * One skill, from a hero with `tree` against `defender`. `answer` is the defender's reply to a
 * contest: their count for Memory, their stop or reaction for Stopwatch and I'm Speed (without
 * one, it goes uncontested).
 */
export function resolve(move: SkillMove, tree: Tree, attacker: Stats, defender: Stats, seed: string, turn: number, answer?: number): Hit {
  const name = `${seed}:turn:${turn}`;
  const vary = varyPct(seed, turn);
  const out = (dmg: number) => afterDef(Math.floor((dmg * vary) / 100), defender.def);
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
    case 'memory': {
      const perfect = move.count === MEMORY_DIGITS;
      // More digits than the defender, or the hit misses (a tie misses too).
      const won = answer === undefined ? move.count > 0 : move.count > answer;
      const detail: Detail = { skill: 'memory', count: move.count, theirCount: answer ?? null, perfect, won };
      if (!won) return { damage: 0, crit: false, kill: false, detail };
      const base = memoryPower(tree.memory);
      const crit = perfect || rolledCrit;
      return { damage: out(crit ? critOf(base, attacker) : base), crit, kill: false, detail };
    }
    case 'fast': {
      // More taps than the defender, or the hit misses (a tie misses too); each tap more hits harder.
      const lead = move.taps - (answer ?? 0);
      const won = lead > 0;
      const detail: Detail = { skill: 'fast', taps: move.taps, theirTaps: answer ?? null, won };
      if (!won) return { damage: 0, crit: false, kill: false, detail };
      const base = Math.min(FAST_CAP, lead * FAST_PER_TAP);
      return { damage: out(rolledCrit ? critOf(base, attacker) : base), crit: rolledCrit, kill: false, detail };
    }
    case 'jackpot': {
      const reels = jackpotReels(seed, turn);
      const three = reels.every((r) => r === reels[0]);
      const pair = !three && new Set(reels).size < REELS;
      const detail: Detail = { skill: 'jackpot', reels, three, pair };
      if (three) return { damage: 0, crit: false, kill: true, detail };
      if (!pair) return { damage: 0, crit: false, kill: false, detail };
      const base = 2 * jackpotPower(tree.jackpot);
      return { damage: out(rolledCrit ? critOf(base, attacker) : base), crit: rolledCrit, kill: false, detail };
    }
  }
}

export const isSkill = (s: unknown): s is SkillId => SKILLS.includes(s as SkillId);

/** A count Memory may claim: 0 to every digit. */
export const isCount = (n: number) => Number.isInteger(n) && n >= 0 && n <= MEMORY_DIGITS;

/** Taps Fast as Fuck may claim: 0 to FAST_MAX_TAPS. */
export const isTaps = (n: number) => Number.isInteger(n) && n >= 0 && n <= FAST_MAX_TAPS;
