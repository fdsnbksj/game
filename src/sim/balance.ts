// Every number that shapes a run. Changing combat numbers changes old fights, so bump
// BALANCE_VERSION with them: ghosts are only matched against the same version.

export const BALANCE_VERSION = 3;

export const START_HP = 100;
export const MAX_LEVEL = 8;
export const BENCH_SIZE = 9;
export const SHOP_SIZE = 5;

export const REROLL_COST = 2;
export const XP_COST = 4;
export const XP_PER_BUY = 4;
/** Every round after the first. */
export const XP_PER_ROUND = 2;
/** Total XP needed to reach each level; index = level. */
export const LEVEL_XP = [0, 0, 2, 6, 12, 20, 32, 48, 68];

/** A creature can hold one item; one drops every ITEM_EVERY rounds, starting after ITEM_OFFSET. */
export const ITEM_EVERY = 3;
export const ITEM_OFFSET = 2;

/** Runs have no last round. After SURGE_FROM, each round's rival is SURGE_PERCENT% stronger than the last. */
export const SURGE_FROM = 15;
export const SURGE_PERCENT = 8;

export const MAX_INTEREST = 5;
export const WIN_BONUS = 1;

/** Percent of base HP and damage at each star level; index = star. */
export const STAR_PERCENT = [0, 100, 180, 324];

/** Copies of each unit in the shop's pool, by cost. */
export const POOL_SIZE: Record<Cost, number> = { 1: 18, 2: 15, 3: 12, 4: 9, 5: 6 };

/** Shop odds in percent for costs 1–5, by level. */
export const SHOP_ODDS: Record<number, [number, number, number, number, number]> = {
  1: [100, 0, 0, 0, 0],
  2: [100, 0, 0, 0, 0],
  3: [75, 25, 0, 0, 0],
  4: [55, 30, 15, 0, 0],
  5: [45, 33, 20, 2, 0],
  6: [30, 40, 25, 5, 0],
  7: [19, 30, 35, 15, 1],
  8: [15, 20, 35, 25, 5],
};

// Combat runs at 20 ticks a second and stops after 30 seconds.
export const TICKS_PER_SECOND = 20;
export const MAX_TICKS = 30 * TICKS_PER_SECOND;
/** From here damage ramps 20% a second and healing fades, so no fight grinds on. */
export const OVERTIME_TICK = 12 * TICKS_PER_SECOND;
export const MOVE_TICKS = 10;
export const MANA_PER_ATTACK = 10;
export const MAX_MANA_FROM_HIT = 15;
/** Poison ticks once a second. */
export const POISON_INTERVAL = TICKS_PER_SECOND;
export const POISON_SECONDS = 3;
export const HASTE_SECONDS = 4;

export interface ItemDef {
  id: string;
  name: string;
  description: string;
  /** Drawn by ItemChip and on the board. */
  color: number;
  /** Flat additions to the holder. */
  hp?: number;
  damage?: number;
  armor?: number;
  startMana?: number;
  /** Percent additions. */
  attackSpeed?: number;
  /** Percent of damage dealt returned as health. */
  lifesteal?: number;
}

export const ITEMS: readonly ItemDef[] = [
  { id: 'heavy_plate', name: 'Heavy Plate', description: '+280 health', color: 0x8fa3c8, hp: 280 },
  { id: 'razor_fang', name: 'Razor Fang', description: '+30% attack damage', color: 0xff5a5f, damage: 30 },
  { id: 'volt_coil', name: 'Volt Coil', description: '+25% attack speed', color: 0xffd23f, attackSpeed: 25 },
  { id: 'mirror_shard', name: 'Mirror Shard', description: '+30 armor', color: 0xd9e2f2, armor: 30 },
  { id: 'mana_cell', name: 'Mana Cell', description: '+30 starting mana', color: 0x36e2ff, startMana: 30 },
  { id: 'siphon_core', name: 'Siphon Core', description: 'heals for 20% of damage dealt', color: 0xff3df0, lifesteal: 20 },
];

const ITEMS_BY_ID = new Map(ITEMS.map((item) => [item.id, item]));

export function getItem(id: string): ItemDef {
  const item = ITEMS_BY_ID.get(id);
  if (!item) throw new Error(`Unknown item ${id}`);
  return item;
}

export type Cost = 1 | 2 | 3 | 4 | 5;
export type Star = 1 | 2 | 3;
export type Origin = 'voltage' | 'glitch' | 'chrome' | 'toxin' | 'prism';
export type Role = 'bruiser' | 'striker' | 'caster' | 'support';
export type TraitId = Origin | Role;

export interface Ability {
  name: string;
  description: string;
  /**
   * Where it lands: the attack target, the caster itself, the most hurt ally, or every
   * ally within `radius` of the caster.
   */
  target: 'enemy' | 'self' | 'weakestAlly' | 'allies';
  /** Hexes around that point that are also hit. 0 = just the one unit. */
  radius: number;
  /** Per star. */
  damage?: [number, number, number];
  heal?: [number, number, number];
  shield?: [number, number, number];
  stunTicks?: number;
  /** Damage a second, for POISON_SECONDS. */
  poison?: [number, number, number];
  /** Attack speed, as a percentage, for HASTE_SECONDS. */
  haste?: [number, number, number];
}

export interface UnitDef {
  id: string;
  name: string;
  cost: Cost;
  origin: Origin;
  role: Role;
  hp: number;
  damage: number;
  /** Ticks between attacks. */
  attackTicks: number;
  /** In hexes; 1 is melee. */
  range: number;
  armor: number;
  maxMana: number;
  startMana: number;
  ability: Ability;
}

export const UNITS: readonly UnitDef[] = [
  {
    id: 'sparkmouse', name: 'Wow', cost: 1, origin: 'voltage', role: 'striker',
    hp: 500, damage: 50, attackTicks: 18, range: 1, armor: 20, maxMana: 60, startMana: 0,
    ability: { name: 'Zap', description: 'Shocks its target.', target: 'enemy', radius: 0, damage: [220, 330, 500] },
  },
  {
    id: 'chromeshell', name: 'Rocky', cost: 1, origin: 'chrome', role: 'bruiser',
    hp: 650, damage: 40, attackTicks: 22, range: 1, armor: 40, maxMana: 70, startMana: 20,
    ability: { name: 'Hunker', description: 'Shields itself.', target: 'self', radius: 0, shield: [250, 375, 560] },
  },
  {
    id: 'glitchtoad', name: 'Smug', cost: 1, origin: 'glitch', role: 'caster',
    hp: 450, damage: 40, attackTicks: 20, range: 3, armor: 15, maxMana: 60, startMana: 20,
    ability: { name: 'Static Burst', description: 'Hits its target and the hexes around it.', target: 'enemy', radius: 1, damage: [150, 225, 340] },
  },
  {
    id: 'voltmoth', name: 'Vibe', cost: 1, origin: 'voltage', role: 'caster',
    hp: 430, damage: 45, attackTicks: 18, range: 3, armor: 15, maxMana: 50, startMana: 0,
    ability: { name: 'Arc', description: 'Strikes its target from range.', target: 'enemy', radius: 0, damage: [200, 300, 450] },
  },
  {
    id: 'bytebat', name: 'Bombo', cost: 2, origin: 'glitch', role: 'striker',
    hp: 600, damage: 60, attackTicks: 16, range: 1, armor: 25, maxMana: 70, startMana: 10,
    ability: { name: 'Bitrate', description: 'A heavy bite on its target.', target: 'enemy', radius: 0, damage: [300, 450, 680] },
  },
  {
    id: 'ironhog', name: 'Tung', cost: 2, origin: 'chrome', role: 'bruiser',
    hp: 800, damage: 50, attackTicks: 22, range: 1, armor: 45, maxMana: 80, startMana: 30,
    ability: { name: 'Tusk Slam', description: 'Damages and stuns its target.', target: 'enemy', radius: 0, damage: [150, 225, 340], stunTicks: 30 },
  },
  {
    id: 'surgeeel', name: 'Trala', cost: 2, origin: 'voltage', role: 'bruiser',
    hp: 750, damage: 50, attackTicks: 20, range: 1, armor: 35, maxMana: 80, startMana: 20,
    ability: { name: 'Discharge', description: 'Shocks every adjacent enemy.', target: 'self', radius: 1, damage: [180, 270, 400] },
  },
  {
    id: 'mirrorowl', name: 'Orly', cost: 2, origin: 'chrome', role: 'caster',
    hp: 550, damage: 40, attackTicks: 20, range: 3, armor: 25, maxMana: 70, startMana: 30,
    ability: { name: 'Mend', description: 'Heals the most hurt ally.', target: 'weakestAlly', radius: 0, heal: [300, 450, 680] },
  },
  {
    id: 'staticfox', name: 'Banani', cost: 3, origin: 'glitch', role: 'striker',
    hp: 700, damage: 75, attackTicks: 16, range: 1, armor: 30, maxMana: 70, startMana: 0,
    ability: { name: 'Blink Strike', description: 'Damages and briefly stuns its target.', target: 'enemy', radius: 0, damage: [450, 675, 1010], stunTicks: 15 },
  },
  {
    id: 'chromemantis', name: 'Capu', cost: 3, origin: 'chrome', role: 'striker',
    hp: 750, damage: 80, attackTicks: 18, range: 1, armor: 40, maxMana: 80, startMana: 20,
    ability: { name: 'Scythe', description: 'Cuts its target and the hexes around it.', target: 'enemy', radius: 1, damage: [300, 450, 680] },
  },
  {
    id: 'thunderstag', name: 'Stonks', cost: 4, origin: 'voltage', role: 'bruiser',
    hp: 1100, damage: 75, attackTicks: 20, range: 1, armor: 50, maxMana: 100, startMana: 40,
    ability: { name: 'Thunderhoof', description: 'Damages and stuns enemies within two hexes.', target: 'self', radius: 2, damage: [300, 450, 680], stunTicks: 20 },
  },
  {
    id: 'nullserpent', name: 'Wiz', cost: 5, origin: 'glitch', role: 'caster',
    hp: 900, damage: 70, attackTicks: 20, range: 4, armor: 30, maxMana: 100, startMana: 40,
    ability: { name: 'Void', description: 'Blasts its target and everything within two hexes.', target: 'enemy', radius: 2, damage: [500, 750, 1100] },
  },
  {
    id: 'sporecat', name: 'Capy', cost: 1, origin: 'toxin', role: 'support',
    hp: 520, damage: 40, attackTicks: 20, range: 2, armor: 20, maxMana: 60, startMana: 10,
    ability: { name: 'Bloom', description: 'Heals the most hurt ally.', target: 'weakestAlly', radius: 0, heal: [230, 345, 520] },
  },
  {
    id: 'prismfly', name: 'Uwu', cost: 1, origin: 'prism', role: 'support',
    hp: 460, damage: 40, attackTicks: 19, range: 3, armor: 15, maxMana: 60, startMana: 20,
    ability: { name: 'Refract', description: 'Shields the most hurt ally.', target: 'weakestAlly', radius: 0, shield: [210, 315, 475] },
  },
  {
    id: 'acidfrog', name: 'Crabby', cost: 2, origin: 'toxin', role: 'striker',
    hp: 620, damage: 55, attackTicks: 17, range: 1, armor: 25, maxMana: 70, startMana: 10,
    ability: { name: 'Spit', description: 'Damages its target and poisons it.', target: 'enemy', radius: 0, damage: [200, 300, 450], poison: [40, 60, 90] },
  },
  {
    id: 'lumihare', name: 'Boo', cost: 2, origin: 'prism', role: 'support',
    hp: 560, damage: 45, attackTicks: 18, range: 2, armor: 25, maxMana: 60, startMana: 20,
    ability: { name: 'Quicken', description: 'Speeds up nearby allies.', target: 'allies', radius: 2, haste: [30, 45, 70] },
  },
  {
    id: 'blightmoth', name: 'Lampy', cost: 3, origin: 'toxin', role: 'caster',
    hp: 640, damage: 55, attackTicks: 19, range: 3, armor: 25, maxMana: 80, startMana: 20,
    ability: { name: 'Miasma', description: 'Poisons its target and everything around it.', target: 'enemy', radius: 1, damage: [180, 270, 400], poison: [55, 80, 120] },
  },
  {
    id: 'beamray', name: 'Pop', cost: 3, origin: 'prism', role: 'support',
    hp: 700, damage: 50, attackTicks: 19, range: 3, armor: 30, maxMana: 80, startMana: 20,
    ability: { name: 'Sunwash', description: 'Heals every nearby ally.', target: 'allies', radius: 2, heal: [190, 285, 430] },
  },
  {
    id: 'sludgebear', name: 'Pata', cost: 4, origin: 'toxin', role: 'bruiser',
    hp: 1150, damage: 70, attackTicks: 21, range: 1, armor: 50, maxMana: 90, startMana: 30,
    ability: { name: 'Fume', description: 'Poisons and damages enemies within two hexes.', target: 'self', radius: 2, damage: [220, 330, 500], poison: [60, 90, 135] },
  },
  {
    id: 'solaris', name: 'Big Brain', cost: 5, origin: 'prism', role: 'support',
    hp: 950, damage: 65, attackTicks: 19, range: 3, armor: 35, maxMana: 100, startMana: 40,
    ability: { name: 'Daybreak', description: 'Shields and speeds up every nearby ally.', target: 'allies', radius: 2, shield: [280, 420, 630], haste: [35, 50, 75] },
  },
];

const UNITS_BY_ID = new Map(UNITS.map((unit) => [unit.id, unit]));

export function getUnit(id: string): UnitDef {
  const unit = UNITS_BY_ID.get(id);
  if (!unit) throw new Error(`Unknown unit ${id}`);
  return unit;
}

export interface TraitDef {
  id: TraitId;
  name: string;
  description: string;
  /** Units needed for each tier. */
  thresholds: [number, number];
  /** The bonus at each tier, applied to units with the trait. */
  values: [number, number];
}

export const TRAITS: readonly TraitDef[] = [
  { id: 'voltage', name: 'Voltage', description: '+{v}% attack speed', thresholds: [2, 4], values: [20, 45] },
  { id: 'glitch', name: 'Glitch', description: '{v}% chance to dodge attacks', thresholds: [2, 4], values: [20, 40] },
  { id: 'chrome', name: 'Chrome', description: '+{v} armor', thresholds: [2, 4], values: [25, 60] },
  { id: 'bruiser', name: 'Bruiser', description: '+{v} health', thresholds: [2, 4], values: [200, 450] },
  { id: 'striker', name: 'Striker', description: '+{v}% damage', thresholds: [2, 4], values: [15, 35] },
  { id: 'caster', name: 'Caster', description: '+{v} starting mana', thresholds: [2, 4], values: [20, 40] },
  { id: 'toxin', name: 'Toxin', description: 'attacks poison for {v} a second', thresholds: [2, 4], values: [30, 70] },
  { id: 'prism', name: 'Prism', description: '+{v}% ability power', thresholds: [2, 4], values: [25, 55] },
  { id: 'support', name: 'Support', description: '+{v} mana a second', thresholds: [2, 4], values: [8, 18] },
];

export function getTrait(id: TraitId): TraitDef {
  return TRAITS.find((trait) => trait.id === id)!;
}
