import {
  getItem,
  getUnit,
  HASTE_SECONDS,
  MANA_PER_ATTACK,
  MAX_MANA_FROM_HIT,
  MAX_TICKS,
  MOVE_TICKS,
  OVERTIME_TICK,
  POISON_INTERVAL,
  POISON_SECONDS,
  STAR_PERCENT,
  TICKS_PER_SECOND,
  type Star,
  type UnitDef,
} from './balance';
import { BATTLE_CELLS, distance, firstStep, toBattleCell, type Side } from './hex';
import { stream, type Rng } from './rng';
import { activeTraits, traitBonus } from './traits';

// A fight is simulated in one go, then replayed from its event log. Everything is integer
// and every random choice comes from a seeded stream, so the same boards and seed always
// give the same fight, on any device.

/** A unit on a player's own 7x4 board. */
export interface Placed {
  unitId: string;
  star: Star;
  /** Own-board cell, 0–27, row 0 at the front. */
  cell: number;
  /** The item it holds, if any. */
  item?: string;
}

export interface FighterInfo {
  id: number;
  side: Side;
  unitId: string;
  star: Star;
  item?: string;
  cell: number;
  hp: number;
  maxHp: number;
  mana: number;
  maxMana: number;
}

export type BattleEvent =
  | { t: number; k: 'move'; id: number; cell: number }
  | { t: number; k: 'attack'; id: number; target: number; mana: number }
  | { t: number; k: 'cast'; id: number; cells: number[] }
  | { t: number; k: 'hit'; id: number; src: number; amount: number; hp: number; shield: number; mana: number; ability: boolean }
  | { t: number; k: 'dodge'; id: number; src: number }
  | { t: number; k: 'heal'; id: number; amount: number; hp: number }
  | { t: number; k: 'shield'; id: number; amount: number; shield: number }
  | { t: number; k: 'stun'; id: number; ticks: number }
  | { t: number; k: 'dot'; id: number; amount: number; hp: number }
  | { t: number; k: 'haste'; id: number; percent: number }
  | { t: number; k: 'death'; id: number };

export interface BattleResult {
  winner: Side | 'draw';
  ticks: number;
  fighters: FighterInfo[];
  events: BattleEvent[];
  /** Stars of the winner's surviving units, which sets the loser's damage. */
  survivorStars: number;
}

interface Fighter {
  id: number;
  side: Side;
  def: UnitDef;
  star: Star;
  cell: number;
  alive: boolean;
  hp: number;
  maxHp: number;
  armor: number;
  damage: number;
  /** Percent bonus to attack damage. */
  damageBonus: number;
  /** Percent bonus to everything its ability does: damage, healing and shielding. */
  abilityBonus: number;
  /** Mana gained every second, from the Support trait. */
  manaRegen: number;
  /** Poison a second its attacks leave behind, from the Toxin trait. */
  poisonOnHit: number;
  dodge: number;
  attackTicks: number;
  /** While hasted, attacks come this much faster. */
  hastePercent: number;
  hasteUntil: number;
  poisonDamage: number;
  poisonUntil: number;
  /** Percent of damage dealt returned as health, from an item. */
  lifesteal: number;
  item?: string;
  mana: number;
  shield: number;
  stun: number;
  attackCooldown: number;
  moveCooldown: number;
  target: number;
}

type Effect =
  | { kind: 'damage'; src: number; dst: number; amount: number; ability: boolean }
  | { kind: 'heal'; src: number; dst: number; amount: number }
  | { kind: 'shield'; src: number; dst: number; amount: number }
  | { kind: 'stun'; dst: number; ticks: number }
  | { kind: 'poison'; dst: number; damage: number }
  | { kind: 'haste'; dst: number; percent: number };

function buildSide(units: readonly Placed[], side: Side, percent: number): Omit<Fighter, 'id'>[] {
  const traits = activeTraits(units.map((unit) => unit.unitId));
  return units.map((unit) => {
    const def = getUnit(unit.unitId);
    const bonus = (id: typeof def.origin | typeof def.role) =>
      def.origin === id || def.role === id ? traitBonus(traits, id) : 0;
    const item = unit.item ? getItem(unit.item) : null;
    const maxHp = Math.floor(((Math.floor((def.hp * STAR_PERCENT[unit.star]) / 100) + bonus('bruiser') + (item?.hp ?? 0)) * percent) / 100);
    const attackSpeed = bonus('voltage') + (item?.attackSpeed ?? 0);
    return {
      side,
      def,
      star: unit.star,
      cell: toBattleCell(unit.cell, side),
      alive: true,
      hp: maxHp,
      maxHp,
      armor: def.armor + bonus('chrome') + (item?.armor ?? 0),
      damage: Math.floor((Math.floor((def.damage * STAR_PERCENT[unit.star]) / 100) * percent) / 100),
      damageBonus: bonus('striker') + (item?.damage ?? 0),
      abilityBonus: bonus('prism'),
      manaRegen: bonus('support'),
      poisonOnHit: bonus('toxin'),
      dodge: bonus('glitch'),
      attackTicks: Math.max(6, Math.floor((def.attackTicks * 100) / (100 + attackSpeed))),
      hastePercent: 0,
      hasteUntil: 0,
      poisonDamage: 0,
      poisonUntil: 0,
      lifesteal: item?.lifesteal ?? 0,
      ...(unit.item ? { item: unit.item } : {}),
      mana: Math.min(def.maxMana - 1, def.startMana + bonus('caster') + (item?.startMana ?? 0)),
      shield: 0,
      stun: 0,
      attackCooldown: 0,
      moveCooldown: 0,
      target: -1,
    };
  });
}

/** Most-hurt first, by fraction of health left; ties go to the lower id. */
function weakest(fighters: readonly Fighter[]): Fighter | undefined {
  let best: Fighter | undefined;
  for (const f of fighters) {
    if (!best || f.hp * best.maxHp < best.hp * f.maxHp) best = f;
  }
  return best;
}

/** `rivalPercent` scales side b's health and damage: surgePercent() of the round, 100 before the surge. */
export function simulate(a: readonly Placed[], b: readonly Placed[], seed: string, rivalPercent = 100): BattleResult {
  const rng: Rng = stream(`${seed}:battle`);
  // Ids follow the battle cell, so the order units act in depends only on the board.
  const fighters: Fighter[] = [...buildSide(a, 'a', 100), ...buildSide(b, 'b', rivalPercent)]
    .sort((x, y) => x.cell - y.cell)
    .map((fighter, id) => ({ ...fighter, id }));
  const occupant = new Array<number>(BATTLE_CELLS).fill(-1);
  for (const f of fighters) occupant[f.cell] = f.id;

  const events: BattleEvent[] = [];
  const info: FighterInfo[] = fighters.map((f) => ({
    id: f.id,
    side: f.side,
    unitId: f.def.id,
    star: f.star,
    ...(f.item ? { item: f.item } : {}),
    cell: f.cell,
    hp: f.hp,
    maxHp: f.maxHp,
    mana: f.mana,
    maxMana: f.def.maxMana,
  }));

  const enemiesOf = (f: Fighter) => fighters.filter((o) => o.alive && o.side !== f.side);
  const alliesOf = (f: Fighter) => fighters.filter((o) => o.alive && o.side === f.side);
  const nearestEnemy = (f: Fighter) => {
    let best: Fighter | undefined;
    let bestDistance = Infinity;
    for (const o of enemiesOf(f)) {
      const d = distance(f.cell, o.cell);
      if (d < bestDistance) {
        best = o;
        bestDistance = d;
      }
    }
    return best;
  };

  let tick = 0;
  let winner: Side | 'draw' | null = null;
  while (tick < MAX_TICKS) {
    tick += 1;
    const effects: Effect[] = [];

    // Support regenerates mana once a second.
    if (tick % TICKS_PER_SECOND === 0) {
      for (const f of fighters) {
        if (f.alive && f.manaRegen > 0) f.mana = Math.min(f.def.maxMana, f.mana + f.manaRegen);
      }
    }

    // Poison burns once a second and ignores armor.
    if (tick % POISON_INTERVAL === 0) {
      for (const f of fighters) {
        if (!f.alive || f.poisonUntil < tick || f.poisonDamage <= 0) continue;
        f.hp = Math.max(0, f.hp - f.poisonDamage);
        events.push({ t: tick, k: 'dot', id: f.id, amount: f.poisonDamage, hp: f.hp });
      }
      for (const f of fighters) {
        if (f.alive && f.hp <= 0) {
          f.alive = false;
          occupant[f.cell] = -1;
          events.push({ t: tick, k: 'death', id: f.id });
        }
      }
    }

    for (const f of fighters) {
      if (!f.alive) continue;
      if (f.attackCooldown > 0) f.attackCooldown -= 1;
      if (f.hasteUntil > 0 && tick > f.hasteUntil) {
        f.hasteUntil = 0;
        f.hastePercent = 0;
      }
      if (f.moveCooldown > 0) f.moveCooldown -= 1;
      if (f.stun > 0) {
        f.stun -= 1;
        continue;
      }

      let target = f.target >= 0 && fighters[f.target].alive ? fighters[f.target] : nearestEnemy(f);
      if (!target) continue;
      f.target = target.id;

      if (f.mana >= f.def.maxMana && cast(f, target, effects)) continue;

      if (distance(f.cell, target.cell) <= f.def.range) {
        if (f.attackCooldown === 0) {
          effects.push({ kind: 'damage', src: f.id, dst: target.id, amount: f.damage, ability: false });
          f.attackCooldown = Math.max(4, Math.floor((f.attackTicks * 100) / (100 + f.hastePercent)));
          f.mana = Math.min(f.def.maxMana, f.mana + MANA_PER_ATTACK);
          events.push({ t: tick, k: 'attack', id: f.id, target: target.id, mana: f.mana });
        }
      } else if (f.moveCooldown === 0) {
        const goalCell = target.cell;
        const step = firstStep(
          f.cell,
          (cell) => distance(cell, goalCell) <= f.def.range,
          (cell) => occupant[cell] !== -1,
        );
        if (step === null) {
          // Boxed in: look for a closer enemy next tick.
          f.target = -1;
        } else {
          occupant[f.cell] = -1;
          occupant[step] = f.id;
          f.cell = step;
          f.moveCooldown = MOVE_TICKS;
          events.push({ t: tick, k: 'move', id: f.id, cell: step });
        }
      }
    }

    // Overtime wears healers down as well as ramping damage, so no fight grinds on forever.
    const mending = tick > OVERTIME_TICK + 5 * TICKS_PER_SECOND ? 0 : tick > OVERTIME_TICK ? 50 : 100;

    // Everything this tick lands at once, so acting first gives no edge.
    for (const effect of effects) {
      const dst = fighters[effect.dst];
      if (dst.hp <= 0) continue;
      switch (effect.kind) {
        case 'damage': {
          const src = fighters[effect.src];
          if (!effect.ability && dst.dodge > 0 && rng(100) < dst.dodge) {
            events.push({ t: tick, k: 'dodge', id: dst.id, src: src.id });
            break;
          }
          const overtime = tick > OVERTIME_TICK ? tick - OVERTIME_TICK : 0;
          const power = effect.ability ? src.abilityBonus : src.damageBonus;
          const raw = Math.floor((effect.amount * (100 + power + overtime)) / 100);
          let taken = Math.floor((raw * 100) / (100 + dst.armor));
          const absorbed = Math.min(dst.shield, taken);
          dst.shield -= absorbed;
          taken -= absorbed;
          dst.hp = Math.max(0, dst.hp - taken);
          dst.mana = Math.min(dst.def.maxMana, dst.mana + Math.min(MAX_MANA_FROM_HIT, Math.floor(raw / 25)));
          if (src.lifesteal > 0 && src.alive && taken > 0) {
            const healed = Math.min(Math.floor((taken * src.lifesteal) / 100), src.maxHp - src.hp);
            if (healed > 0) {
              src.hp += healed;
              events.push({ t: tick, k: 'heal', id: src.id, amount: healed, hp: src.hp });
            }
          }
          if (!effect.ability && src.poisonOnHit > 0) {
            dst.poisonDamage = Math.max(dst.poisonDamage, src.poisonOnHit);
            dst.poisonUntil = tick + POISON_SECONDS * TICKS_PER_SECOND;
          }
          events.push({
            t: tick,
            k: 'hit',
            id: dst.id,
            src: src.id,
            amount: taken + absorbed,
            hp: dst.hp,
            shield: dst.shield,
            mana: dst.mana,
            ability: effect.ability,
          });
          break;
        }
        case 'heal': {
          const given = Math.floor((effect.amount * (100 + fighters[effect.src].abilityBonus) * mending) / 10000);
          const amount = Math.min(given, dst.maxHp - dst.hp);
          dst.hp += amount;
          events.push({ t: tick, k: 'heal', id: dst.id, amount, hp: dst.hp });
          break;
        }
        case 'shield': {
          const given = Math.floor((effect.amount * (100 + fighters[effect.src].abilityBonus) * mending) / 10000);
          dst.shield += given;
          events.push({ t: tick, k: 'shield', id: dst.id, amount: given, shield: dst.shield });
          break;
        }
        case 'poison':
          dst.poisonDamage = Math.max(dst.poisonDamage, effect.damage);
          dst.poisonUntil = tick + POISON_SECONDS * TICKS_PER_SECOND;
          break;
        case 'haste':
          dst.hastePercent = Math.max(dst.hastePercent, effect.percent);
          dst.hasteUntil = tick + HASTE_SECONDS * TICKS_PER_SECOND;
          events.push({ t: tick, k: 'haste', id: dst.id, percent: effect.percent });
          break;
        case 'stun':
          dst.stun = Math.max(dst.stun, effect.ticks);
          events.push({ t: tick, k: 'stun', id: dst.id, ticks: effect.ticks });
          break;
      }
    }

    for (const f of fighters) {
      if (f.alive && f.hp <= 0) {
        f.alive = false;
        occupant[f.cell] = -1;
        events.push({ t: tick, k: 'death', id: f.id });
      }
    }

    const aAlive = fighters.some((f) => f.alive && f.side === 'a');
    const bAlive = fighters.some((f) => f.alive && f.side === 'b');
    if (!aAlive || !bAlive) {
      winner = aAlive ? 'a' : bAlive ? 'b' : 'draw';
      break;
    }
  }

  if (winner === null) {
    // Time ran out: the side with more health left wins.
    const health = (side: Side) => fighters.filter((f) => f.alive && f.side === side).reduce((sum, f) => sum + f.hp, 0);
    const [ha, hb] = [health('a'), health('b')];
    winner = ha > hb ? 'a' : hb > ha ? 'b' : 'draw';
  }

  const survivorStars =
    winner === 'draw' ? 0 : fighters.filter((f) => f.alive && f.side === winner).reduce((sum, f) => sum + f.star, 0);
  return { winner, ticks: tick, fighters: info, events, survivorStars };

  /** Queues an ability's effects. False if it has nothing to hit yet, so the unit attacks instead. */
  function cast(f: Fighter, target: Fighter, queue: Effect[]): boolean {
    const ability = f.def.ability;
    const star = f.star - 1;
    const cells: number[] = [];

    if (ability.target === 'weakestAlly' || ability.target === 'allies') {
      const helped =
        ability.target === 'weakestAlly'
          ? [weakest(alliesOf(f))].filter((ally): ally is Fighter => ally !== undefined)
          : alliesOf(f).filter((ally) => distance(ally.cell, f.cell) <= ability.radius);
      if (helped.length === 0) return false;
      for (const ally of helped) {
        if (ability.heal) queue.push({ kind: 'heal', src: f.id, dst: ally.id, amount: ability.heal[star] });
        if (ability.shield) queue.push({ kind: 'shield', src: f.id, dst: ally.id, amount: ability.shield[star] });
        if (ability.haste) queue.push({ kind: 'haste', dst: ally.id, percent: ability.haste[star] });
        cells.push(ally.cell);
      }
      f.mana = 0;
      events.push({ t: tick, k: 'cast', id: f.id, cells });
      return true;
    }

    if (ability.target === 'self' && ability.shield) {
      queue.push({ kind: 'shield', src: f.id, dst: f.id, amount: ability.shield[star] });
      cells.push(f.cell);
    }
    if (ability.damage || ability.stunTicks || ability.poison) {
      const centre = ability.target === 'self' ? f.cell : target.cell;
      const hit = enemiesOf(f).filter((o) => distance(o.cell, centre) <= ability.radius);
      if (hit.length === 0 && !ability.shield) return false;
      for (const o of hit) {
        if (ability.damage) queue.push({ kind: 'damage', src: f.id, dst: o.id, amount: ability.damage[star], ability: true });
        if (ability.stunTicks) queue.push({ kind: 'stun', dst: o.id, ticks: ability.stunTicks });
        if (ability.poison) queue.push({ kind: 'poison', dst: o.id, damage: ability.poison[star] });
      }
      for (let cell = 0; cell < BATTLE_CELLS; cell++) {
        if (distance(cell, centre) <= ability.radius) cells.push(cell);
      }
    }
    f.mana = 0;
    events.push({ t: tick, k: 'cast', id: f.id, cells });
    return true;
  }
}
