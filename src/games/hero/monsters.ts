import { stream } from '../../nonogram/rng';
import { afterDef, type Hit } from './skills';
import type { Stats } from './stats';

// The bot ladder's creatures. They don't use the heroes' skills: each has a kit of plain
// attacks, some of which hurt and some of which buff the creature or hinder the hero.
// Whole numbers only; every roll comes from the fight's seed and the turn number.

export type Family = 'clock' | 'coin' | 'card' | 'dice' | 'wheel';

export type AttackId = 'strike' | 'jab' | 'slam' | 'drain' | 'scorch' | 'rattle' | 'smoke' | 'brace' | 'windup' | 'finisher';

/** Lasting effects on a fighter. */
export type EffectId = 'burn' | 'weak' | 'fog' | 'guard' | 'charged';

export interface Effect {
  id: EffectId;
  /** How many more of its holder's turns it lasts. */
  turns: number;
}

export interface Attack {
  /** Percent of the creature's power; 0 for an attack that only casts an effect. */
  power: number;
  /** Percent chance to land. */
  accuracy: number;
  /** Heals the creature by half the damage done. */
  drain?: boolean;
  effect?: { id: EffectId; on: 'self' | 'foe'; turns: number };
}

export const ATTACKS: Record<AttackId, Attack> = {
  strike: { power: 100, accuracy: 95 },
  jab: { power: 60, accuracy: 100 },
  slam: { power: 170, accuracy: 70 },
  drain: { power: 80, accuracy: 95, drain: true },
  scorch: { power: 50, accuracy: 90, effect: { id: 'burn', on: 'foe', turns: 3 } },
  rattle: { power: 0, accuracy: 90, effect: { id: 'weak', on: 'foe', turns: 2 } },
  smoke: { power: 0, accuracy: 90, effect: { id: 'fog', on: 'foe', turns: 1 } },
  brace: { power: 0, accuracy: 100, effect: { id: 'guard', on: 'self', turns: 2 } },
  windup: { power: 0, accuracy: 100, effect: { id: 'charged', on: 'self', turns: 1 } },
  finisher: { power: 200, accuracy: 75 },
};

/** A burn takes this percent of its holder's max HP at the end of each of their turns. */
export const BURN_PCT = 6;
/** Weakened: outgoing damage at this percent. */
export const WEAK_PCT = 70;
/** Guard up: this much more DEF. */
export const GUARD_DEF = 50;
/** Charged: the next hit at this percent. */
export const CHARGED_PCT = 160;
/** A boss below half its HP is enraged: its hits at this percent. */
export const ENRAGE_PCT = 150;

/** What a creature fights with, carried in its fighter. */
export interface Kit {
  family: Family;
  attacks: AttackId[];
  /** A 100% attack's damage before crits and DEF. */
  power: number;
  /** A boss: enraged below half HP. */
  enrage: boolean;
}

/** Each family's name for each attack. */
export const ATTACK_NAMES: Record<Family, Record<AttackId, string>> = {
  clock: {
    strike: 'Tick Strike', jab: 'Quick Tick', slam: 'Gear Grind', drain: 'Borrowed Time', scorch: 'Overheat',
    rattle: 'Alarm Bell', smoke: 'Time Blur', brace: 'Wind the Case', windup: 'Wind Up', finisher: 'Midnight Strike',
  },
  coin: {
    strike: 'Coin Toss', jab: 'Flick', slam: 'Heavy Purse', drain: 'Pickpocket', scorch: 'Hot Penny',
    rattle: 'Jingle', smoke: 'Glint', brace: 'Tails Up', windup: 'Polish', finisher: 'Jackpot Crash',
  },
  card: {
    strike: 'Paper Cut', jab: 'Card Flick', slam: 'Deck Slam', drain: 'Steal a Card', scorch: 'Burning Ace',
    rattle: 'Bluff', smoke: 'Shuffle', brace: 'Hold', windup: 'Stack the Deck', finisher: 'Royal Strike',
  },
  dice: {
    strike: 'Roll Over', jab: 'Pip Jab', slam: 'Six Slam', drain: 'Loaded Steal', scorch: 'Hot Dice',
    rattle: 'Rattle Cup', smoke: 'Dust Cloud', brace: 'Square Up', windup: 'Shake ’Em', finisher: 'Snake Bite',
  },
  wheel: {
    strike: 'Spin Hit', jab: 'Ball Flick', slam: 'Wheel Roll', drain: 'House Edge', scorch: 'Red Hot',
    rattle: 'No More Bets', smoke: 'Dizzy Spin', brace: 'Bank Vault', windup: 'Raise the Stakes', finisher: 'Zero Hour',
  },
};

export const isAttack = (id: unknown): id is AttackId => typeof id === 'string' && Object.prototype.hasOwnProperty.call(ATTACKS, id);

export const hasEffect = (effects: readonly Effect[], id: EffectId) => effects.some((e) => e.id === id);

/** One creature attack. `boost` is the percent its damage is at (charged, enraged, weakened). */
export function resolveAttack(id: AttackId, kit: Kit, attacker: Stats, defender: Stats, seed: string, turn: number, boost: number): Hit {
  const name = `${seed}:turn:${turn}`;
  const attack = ATTACKS[id];
  const missed = stream(`${name}:hit`)(100) >= attack.accuracy;
  const effect = !missed && attack.effect ? attack.effect.id : null;
  if (missed || attack.power === 0) return { damage: 0, crit: false, kill: false, detail: { skill: 'attack', id, missed, healed: 0, effect } };
  const crit = stream(`${name}:crit`)(100) < attacker.crit;
  const base = Math.floor((kit.power * attack.power) / 100);
  const damage = afterDef(Math.floor(((crit ? Math.floor((base * attacker.critDmg) / 100) : base) * boost) / 100), defender.def);
  return { damage, crit, kill: false, detail: { skill: 'attack', id, missed, healed: attack.drain ? Math.floor(damage / 2) : 0, effect } };
}

/**
 * A creature's move: weighted toward hurting, with buffs only when it hasn't got them,
 * hindrances only when the hero hasn't got them, and draining more when it's hurt.
 */
export function monsterChoice(kit: Kit, mine: readonly Effect[], theirs: readonly Effect[], hurt: boolean, seed: string, turn: number): AttackId {
  const charged = hasEffect(mine, 'charged');
  const weight = (id: AttackId): number => {
    const a = ATTACKS[id];
    if (a.power === 0 && charged) return 0;
    if (a.effect) {
      const list = a.effect.on === 'self' ? mine : theirs;
      if (hasEffect(list, a.effect.id)) return 0;
    }
    switch (id) {
      case 'strike':
        return 4;
      case 'jab':
        return 3;
      case 'slam':
        return 3;
      case 'drain':
        return hurt ? 5 : 2;
      case 'finisher':
        return hurt ? 5 : 3;
      default:
        return 2;
    }
  };
  const weights = kit.attacks.map((id) => ({ id, w: weight(id) }));
  const total = weights.reduce((sum, x) => sum + x.w, 0);
  if (total === 0) return kit.attacks[0];
  let roll = stream(`${seed}:bot:${turn}`)(total);
  return weights.find((x) => (roll -= x.w) < 0)!.id;
}
