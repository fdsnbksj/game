// Ancient Wonders: the cards and wonder boards. The play follows the published 3–7 player
// game of ancient wonders, but every name is ours: plain descriptive card names (none of
// the original's), the seven real historical wonders, and our own wording of what they do.
// Keep it that way (CLAUDE.md).

export type Res = 'wood' | 'stone' | 'clay' | 'ore' | 'glass' | 'cloth' | 'papyrus';
export const RAW: Res[] = ['wood', 'stone', 'clay', 'ore'];
export const GOODS: Res[] = ['glass', 'cloth', 'papyrus'];
export const RESOURCES: Res[] = [...RAW, ...GOODS];

export type Color = 'brown' | 'grey' | 'blue' | 'yellow' | 'red' | 'green' | 'purple';
export type Science = 'compass' | 'gear' | 'tablet';

export interface Cost {
  coins?: number;
  res?: Partial<Record<Res, number>>;
}

/** What a commercial card or guild counts, and whose cards. */
export interface Counting {
  what: Color | 'wonderStage' | 'defeat' | 'brownGreyPurple';
  /** own city, both neighbours, or all three. */
  where: 'own' | 'neighbours' | 'all';
}

export interface Card {
  id: string;
  name: string;
  age: 1 | 2 | 3;
  color: Color;
  /** One copy for each player count listed: a card marked 3 and 5 is in the deck twice from 5 players. */
  players: number[];
  cost: Cost;
  /** Free to build if you already have one of these cards. */
  chainFrom?: string[];
  /** Fixed production. */
  produces?: Partial<Record<Res, number>>;
  /** One of these each turn. Brown double cards can be bought by neighbours; commercial ones can't. */
  choice?: Res[];
  points?: number;
  shields?: number;
  science?: Science;
  coins?: number;
  /** Commercial trade discounts: buy these from that neighbour for 1 coin. */
  discount?: { side: 'left' | 'right' | 'both'; res: Res[] };
  /** Coins now, per counted card. */
  coinsPer?: Counting & { each: number };
  /** Points at the end, per counted card. */
  pointsPer?: Counting & { each: number };
  /** The scholars' guild: a science symbol of your choice. */
  scienceWild?: boolean;
}

const c = (card: Card) => card;
const r = (res: Cost['res'], coins?: number): Cost => ({ res, coins });

export const AGE_I: Card[] = [
  c({ id: 'woodlot', name: 'Woodlot', age: 1, color: 'brown', players: [3, 4], cost: {}, produces: { wood: 1 } }),
  c({ id: 'rock-face', name: 'Rock Face', age: 1, color: 'brown', players: [3, 5], cost: {}, produces: { stone: 1 } }),
  c({ id: 'clay-bank', name: 'Clay Bank', age: 1, color: 'brown', players: [3, 5], cost: {}, produces: { clay: 1 } }),
  c({ id: 'ore-seam', name: 'Ore Seam', age: 1, color: 'brown', players: [3, 4], cost: {}, produces: { ore: 1 } }),
  c({ id: 'coppice', name: 'Coppice', age: 1, color: 'brown', players: [6], cost: { coins: 1 }, choice: ['wood', 'clay'] }),
  c({ id: 'gravel-dig', name: 'Gravel Dig', age: 1, color: 'brown', players: [4], cost: { coins: 1 }, choice: ['stone', 'clay'] }),
  c({ id: 'red-earth-pit', name: 'Red Earth Pit', age: 1, color: 'brown', players: [3], cost: { coins: 1 }, choice: ['clay', 'ore'] }),
  c({ id: 'hillside-camp', name: 'Hillside Camp', age: 1, color: 'brown', players: [3], cost: { coins: 1 }, choice: ['stone', 'wood'] }),
  c({ id: 'forest-seam', name: 'Forest Seam', age: 1, color: 'brown', players: [5], cost: { coins: 1 }, choice: ['wood', 'ore'] }),
  c({ id: 'deep-shaft', name: 'Deep Shaft', age: 1, color: 'brown', players: [6], cost: { coins: 1 }, choice: ['ore', 'stone'] }),
  c({ id: 'weavers', name: 'Weavers', age: 1, color: 'grey', players: [3, 6], cost: {}, produces: { cloth: 1 } }),
  c({ id: 'glassblowers', name: 'Glassblowers', age: 1, color: 'grey', players: [3, 6], cost: {}, produces: { glass: 1 } }),
  c({ id: 'paper-mill', name: 'Paper Mill', age: 1, color: 'grey', players: [3, 6], cost: {}, produces: { papyrus: 1 } }),
  c({ id: 'lenders-stall', name: 'Lenders’ Stall', age: 1, color: 'blue', players: [4, 7], cost: {}, points: 3 }),
  c({ id: 'bathhouse', name: 'Bathhouse', age: 1, color: 'blue', players: [3, 7], cost: r({ stone: 1 }), points: 3 }),
  c({ id: 'shrine', name: 'Shrine', age: 1, color: 'blue', players: [3, 5], cost: {}, points: 2 }),
  c({ id: 'playhouse', name: 'Playhouse', age: 1, color: 'blue', players: [3, 6], cost: {}, points: 2 }),
  c({ id: 'inn', name: 'Inn', age: 1, color: 'yellow', players: [4, 5, 7], cost: {}, coins: 5 }),
  c({ id: 'east-trade-road', name: 'East Trade Road', age: 1, color: 'yellow', players: [3, 7], cost: {}, discount: { side: 'right', res: ['wood', 'stone', 'clay', 'ore'] } }),
  c({ id: 'west-trade-road', name: 'West Trade Road', age: 1, color: 'yellow', players: [3, 7], cost: {}, discount: { side: 'left', res: ['wood', 'stone', 'clay', 'ore'] } }),
  c({ id: 'goods-exchange', name: 'Goods Exchange', age: 1, color: 'yellow', players: [3, 6], cost: {}, discount: { side: 'both', res: ['glass', 'cloth', 'papyrus'] } }),
  c({ id: 'log-wall', name: 'Log Wall', age: 1, color: 'red', players: [3, 7], cost: r({ wood: 1 }), shields: 1 }),
  c({ id: 'muster-hall', name: 'Muster Hall', age: 1, color: 'red', players: [3, 5], cost: r({ ore: 1 }), shields: 1 }),
  c({ id: 'lookout', name: 'Lookout', age: 1, color: 'red', players: [3, 4], cost: r({ clay: 1 }), shields: 1 }),
  c({ id: 'herb-room', name: 'Herb Room', age: 1, color: 'green', players: [3, 5], cost: r({ cloth: 1 }), science: 'compass' }),
  c({ id: 'tool-shed', name: 'Tool Shed', age: 1, color: 'green', players: [3, 7], cost: r({ glass: 1 }), science: 'gear' }),
  c({ id: 'scribes-room', name: 'Scribes’ Room', age: 1, color: 'green', players: [3, 4], cost: r({ papyrus: 1 }), science: 'tablet' }),
];

export const AGE_II: Card[] = [
  c({ id: 'saw-pit', name: 'Saw Pit', age: 2, color: 'brown', players: [3, 4], cost: { coins: 1 }, produces: { wood: 2 } }),
  c({ id: 'cut-quarry', name: 'Cut Quarry', age: 2, color: 'brown', players: [3, 4], cost: { coins: 1 }, produces: { stone: 2 } }),
  c({ id: 'brick-kiln', name: 'Brick Kiln', age: 2, color: 'brown', players: [3, 4], cost: { coins: 1 }, produces: { clay: 2 } }),
  c({ id: 'smelter', name: 'Smelter', age: 2, color: 'brown', players: [3, 4], cost: { coins: 1 }, produces: { ore: 2 } }),
  // The same three workshops as Age I: a city can't build a second of any card.
  c({ id: 'weavers', name: 'Weavers', age: 2, color: 'grey', players: [3, 5], cost: {}, produces: { cloth: 1 } }),
  c({ id: 'glassblowers', name: 'Glassblowers', age: 2, color: 'grey', players: [3, 5], cost: {}, produces: { glass: 1 } }),
  c({ id: 'paper-mill', name: 'Paper Mill', age: 2, color: 'grey', players: [3, 5], cost: {}, produces: { papyrus: 1 } }),
  c({ id: 'water-channel', name: 'Water Channel', age: 2, color: 'blue', players: [3, 7], cost: r({ stone: 3 }), points: 5, chainFrom: ['bathhouse'] }),
  c({ id: 'sanctuary', name: 'Sanctuary', age: 2, color: 'blue', players: [3, 6], cost: r({ wood: 1, clay: 1, glass: 1 }), points: 3, chainFrom: ['shrine'] }),
  c({ id: 'monument', name: 'Monument', age: 2, color: 'blue', players: [3, 7], cost: r({ ore: 2, wood: 1 }), points: 4, chainFrom: ['playhouse'] }),
  c({ id: 'tribunal', name: 'Tribunal', age: 2, color: 'blue', players: [3, 5], cost: r({ clay: 2, cloth: 1 }), points: 4, chainFrom: ['scribes-room'] }),
  c({ id: 'market-square', name: 'Market Square', age: 2, color: 'yellow', players: [3, 6, 7], cost: r({ clay: 2 }), choice: ['glass', 'cloth', 'papyrus'], chainFrom: ['east-trade-road', 'west-trade-road'] }),
  c({ id: 'caravan-stop', name: 'Caravan Stop', age: 2, color: 'yellow', players: [3, 5, 6], cost: r({ wood: 2 }), choice: ['wood', 'stone', 'clay', 'ore'], chainFrom: ['goods-exchange'] }),
  c({ id: 'vine-terraces', name: 'Vine Terraces', age: 2, color: 'yellow', players: [3, 6], cost: {}, coinsPer: { what: 'brown', where: 'all', each: 1 } }),
  c({ id: 'grand-market', name: 'Grand Market', age: 2, color: 'yellow', players: [4, 7], cost: {}, coinsPer: { what: 'grey', where: 'all', each: 2 } }),
  c({ id: 'stone-walls', name: 'Stone Walls', age: 2, color: 'red', players: [3, 7], cost: r({ stone: 3 }), shields: 2 }),
  c({ id: 'drill-yard', name: 'Drill Yard', age: 2, color: 'red', players: [4, 6, 7], cost: r({ ore: 2, wood: 1 }), shields: 2 }),
  c({ id: 'horse-stalls', name: 'Horse Stalls', age: 2, color: 'red', players: [3, 5], cost: r({ clay: 1, wood: 1, ore: 1 }), shields: 2, chainFrom: ['herb-room'] }),
  c({ id: 'bow-field', name: 'Bow Field', age: 2, color: 'red', players: [3, 6], cost: r({ wood: 2, ore: 1 }), shields: 2, chainFrom: ['tool-shed'] }),
  c({ id: 'infirmary', name: 'Infirmary', age: 2, color: 'green', players: [3, 4], cost: r({ ore: 2, glass: 1 }), science: 'compass', chainFrom: ['herb-room'] }),
  c({ id: 'testing-room', name: 'Testing Room', age: 2, color: 'green', players: [3, 5], cost: r({ clay: 2, papyrus: 1 }), science: 'gear', chainFrom: ['tool-shed'] }),
  c({ id: 'archive', name: 'Archive', age: 2, color: 'green', players: [3, 6], cost: r({ stone: 2, cloth: 1 }), science: 'tablet', chainFrom: ['scribes-room'] }),
  c({ id: 'schoolhouse', name: 'Schoolhouse', age: 2, color: 'green', players: [3, 7], cost: r({ wood: 1, papyrus: 1 }), science: 'tablet' }),
];

export const AGE_III: Card[] = [
  c({ id: 'hall-of-gods', name: 'Hall of Gods', age: 3, color: 'blue', players: [3, 6], cost: r({ clay: 2, ore: 1, glass: 1, papyrus: 1, cloth: 1 }), points: 7, chainFrom: ['sanctuary'] }),
  c({ id: 'parkland', name: 'Parkland', age: 3, color: 'blue', players: [3, 4], cost: r({ clay: 2, wood: 1 }), points: 5, chainFrom: ['monument'] }),
  c({ id: 'civic-hall', name: 'Civic Hall', age: 3, color: 'blue', players: [3, 5, 6], cost: r({ stone: 2, ore: 1, glass: 1 }), points: 6 }),
  c({ id: 'royal-court', name: 'Royal Court', age: 3, color: 'blue', players: [3, 7], cost: r({ stone: 1, ore: 1, wood: 1, clay: 1, glass: 1, papyrus: 1, cloth: 1 }), points: 8 }),
  c({ id: 'assembly', name: 'Assembly', age: 3, color: 'blue', players: [3, 5], cost: r({ wood: 2, stone: 1, ore: 1 }), points: 6, chainFrom: ['archive'] }),
  c({ id: 'harbour', name: 'Harbour', age: 3, color: 'yellow', players: [3, 4], cost: r({ wood: 1, ore: 1, cloth: 1 }), chainFrom: ['market-square'], coinsPer: { what: 'brown', where: 'own', each: 1 }, pointsPer: { what: 'brown', where: 'own', each: 1 } }),
  c({ id: 'beacon', name: 'Beacon', age: 3, color: 'yellow', players: [3, 6], cost: r({ stone: 1, glass: 1 }), chainFrom: ['caravan-stop'], coinsPer: { what: 'yellow', where: 'own', each: 1 }, pointsPer: { what: 'yellow', where: 'own', each: 1 } }),
  c({ id: 'traders-hall', name: 'Traders’ Hall', age: 3, color: 'yellow', players: [4, 6], cost: r({ clay: 2, papyrus: 1 }), coinsPer: { what: 'grey', where: 'own', each: 2 }, pointsPer: { what: 'grey', where: 'own', each: 2 } }),
  c({ id: 'stadium', name: 'Stadium', age: 3, color: 'yellow', players: [3, 5, 7], cost: r({ stone: 2, ore: 1 }), chainFrom: ['infirmary'], coinsPer: { what: 'wonderStage', where: 'own', each: 3 }, pointsPer: { what: 'wonderStage', where: 'own', each: 1 } }),
  c({ id: 'bastions', name: 'Bastions', age: 3, color: 'red', players: [3, 7], cost: r({ ore: 3, stone: 1 }), shields: 3, chainFrom: ['stone-walls'] }),
  c({ id: 'racecourse', name: 'Racecourse', age: 3, color: 'red', players: [4, 5, 6], cost: r({ stone: 3, ore: 1 }), shields: 3, chainFrom: ['drill-yard'] }),
  c({ id: 'weapon-stores', name: 'Weapon Stores', age: 3, color: 'red', players: [3, 4, 7], cost: r({ wood: 2, ore: 1, cloth: 1 }), shields: 3 }),
  c({ id: 'engine-works', name: 'Engine Works', age: 3, color: 'red', players: [3, 5], cost: r({ clay: 3, wood: 1 }), shields: 3, chainFrom: ['testing-room'] }),
  c({ id: 'physicians-hall', name: 'Physicians’ Hall', age: 3, color: 'green', players: [3, 6], cost: r({ clay: 2, papyrus: 1, cloth: 1 }), science: 'compass', chainFrom: ['infirmary'] }),
  c({ id: 'star-tower', name: 'Star Tower', age: 3, color: 'green', players: [3, 7], cost: r({ ore: 2, glass: 1, cloth: 1 }), science: 'gear', chainFrom: ['testing-room'] }),
  c({ id: 'grand-school', name: 'Grand School', age: 3, color: 'green', players: [3, 4], cost: r({ wood: 2, papyrus: 1, glass: 1 }), science: 'tablet', chainFrom: ['archive'] }),
  c({ id: 'lyceum', name: 'Lyceum', age: 3, color: 'green', players: [3, 7], cost: r({ stone: 3, glass: 1 }), science: 'compass', chainFrom: ['schoolhouse'] }),
  c({ id: 'reading-room', name: 'Reading Room', age: 3, color: 'green', players: [3, 5], cost: r({ wood: 1, papyrus: 1, cloth: 1 }), science: 'gear', chainFrom: ['schoolhouse'] }),
];

/** Age III adds as many of these as players + 2, drawn at random. */
export const GUILDS: Card[] = [
  c({ id: 'union-labourers', name: 'Union of Labourers', age: 3, color: 'purple', players: [], cost: r({ ore: 2, clay: 1, stone: 1, wood: 1 }), pointsPer: { what: 'brown', where: 'neighbours', each: 1 } }),
  c({ id: 'union-artisans', name: 'Union of Artisans', age: 3, color: 'purple', players: [], cost: r({ ore: 2, stone: 2 }), pointsPer: { what: 'grey', where: 'neighbours', each: 2 } }),
  c({ id: 'union-dealers', name: 'Union of Dealers', age: 3, color: 'purple', players: [], cost: r({ cloth: 1, papyrus: 1, glass: 1 }), pointsPer: { what: 'yellow', where: 'neighbours', each: 1 } }),
  c({ id: 'union-thinkers', name: 'Union of Thinkers', age: 3, color: 'purple', players: [], cost: r({ clay: 3, cloth: 1, papyrus: 1 }), pointsPer: { what: 'green', where: 'neighbours', each: 1 } }),
  c({ id: 'union-informers', name: 'Union of Informers', age: 3, color: 'purple', players: [], cost: r({ clay: 3, glass: 1 }), pointsPer: { what: 'red', where: 'neighbours', each: 1 } }),
  c({ id: 'union-tacticians', name: 'Union of Tacticians', age: 3, color: 'purple', players: [], cost: r({ ore: 2, stone: 1, cloth: 1 }), pointsPer: { what: 'defeat', where: 'neighbours', each: 1 } }),
  c({ id: 'union-shippers', name: 'Union of Shippers', age: 3, color: 'purple', players: [], cost: r({ wood: 3, glass: 1, papyrus: 1 }), pointsPer: { what: 'brownGreyPurple', where: 'own', each: 1 } }),
  c({ id: 'union-scholars', name: 'Union of Scholars', age: 3, color: 'purple', players: [], cost: r({ wood: 2, ore: 2, papyrus: 1 }), scienceWild: true }),
  c({ id: 'union-judges', name: 'Union of Judges', age: 3, color: 'purple', players: [], cost: r({ wood: 3, stone: 1, cloth: 1 }), pointsPer: { what: 'blue', where: 'neighbours', each: 1 } }),
  c({ id: 'union-masons', name: 'Union of Masons', age: 3, color: 'purple', players: [], cost: r({ stone: 2, clay: 2, glass: 1 }), pointsPer: { what: 'wonderStage', where: 'all', each: 1 } }),
];

// ---------- Wonder boards ----------

export interface Stage {
  cost: Cost;
  points?: number;
  coins?: number;
  shields?: number;
  /** A resource of your choice each turn (not for neighbours to buy). */
  choice?: Res[];
  scienceWild?: boolean;
  /** Once per age, build a card for free. */
  freeBuildPerAge?: boolean;
  /** At the end of this turn, build a card from the discards for free. */
  reviveDiscard?: boolean;
  /** Play the last card of each age instead of discarding it. */
  playSeventh?: boolean;
  /** Buy raw materials from both neighbours for 1 coin. */
  rawDiscount?: boolean;
  /** At the end, copy one guild from a neighbour. */
  copyGuild?: boolean;
}

export interface Board {
  id: string;
  name: string;
  /** The resource the city makes from the start (neighbours can buy it). */
  starts: Res;
  sides: { A: Stage[]; B: Stage[] };
}

export const BOARDS: Board[] = [
  {
    id: 'rhodes',
    name: 'The Colossus of Rhodes',
    starts: 'ore',
    sides: {
      A: [{ cost: r({ wood: 2 }), points: 3 }, { cost: r({ clay: 3 }), shields: 2 }, { cost: r({ ore: 4 }), points: 7 }],
      B: [
        { cost: r({ stone: 3 }), shields: 1, points: 3, coins: 3 },
        { cost: r({ ore: 4 }), shields: 1, points: 4, coins: 4 },
      ],
    },
  },
  {
    id: 'alexandria',
    name: 'The Lighthouse of Alexandria',
    starts: 'glass',
    sides: {
      A: [{ cost: r({ stone: 2 }), points: 3 }, { cost: r({ ore: 2 }), choice: ['wood', 'stone', 'clay', 'ore'] }, { cost: r({ glass: 2 }), points: 7 }],
      B: [
        { cost: r({ clay: 2 }), choice: ['wood', 'stone', 'clay', 'ore'] },
        { cost: r({ wood: 2 }), choice: ['glass', 'cloth', 'papyrus'] },
        { cost: r({ stone: 3 }), points: 7 },
      ],
    },
  },
  {
    id: 'ephesus',
    name: 'The Temple of Artemis at Ephesus',
    starts: 'papyrus',
    sides: {
      A: [{ cost: r({ stone: 2 }), points: 3 }, { cost: r({ wood: 2 }), coins: 9 }, { cost: r({ papyrus: 2 }), points: 7 }],
      B: [
        { cost: r({ stone: 2 }), points: 2, coins: 4 },
        { cost: r({ wood: 2 }), points: 3, coins: 4 },
        { cost: r({ papyrus: 1, cloth: 1, glass: 1 }), points: 5, coins: 4 },
      ],
    },
  },
  {
    id: 'babylon',
    name: 'The Hanging Gardens of Babylon',
    starts: 'clay',
    sides: {
      A: [{ cost: r({ clay: 2 }), points: 3 }, { cost: r({ wood: 3 }), scienceWild: true }, { cost: r({ clay: 4 }), points: 7 }],
      B: [
        { cost: r({ clay: 1, cloth: 1 }), points: 3 },
        { cost: r({ wood: 2, glass: 1 }), playSeventh: true },
        { cost: r({ clay: 3, papyrus: 1 }), scienceWild: true },
      ],
    },
  },
  {
    id: 'olympia',
    name: 'The Statue of Zeus at Olympia',
    starts: 'wood',
    sides: {
      A: [{ cost: r({ wood: 2 }), points: 3 }, { cost: r({ stone: 2 }), freeBuildPerAge: true }, { cost: r({ ore: 2 }), points: 7 }],
      B: [
        { cost: r({ wood: 2 }), rawDiscount: true },
        { cost: r({ stone: 2 }), points: 5 },
        { cost: r({ ore: 2, cloth: 1 }), copyGuild: true },
      ],
    },
  },
  {
    id: 'halicarnassus',
    name: 'The Mausoleum at Halicarnassus',
    starts: 'cloth',
    sides: {
      A: [{ cost: r({ clay: 2 }), points: 3 }, { cost: r({ ore: 3 }), reviveDiscard: true }, { cost: r({ cloth: 2 }), points: 7 }],
      B: [
        { cost: r({ ore: 2 }), points: 2, reviveDiscard: true },
        { cost: r({ clay: 3 }), points: 1, reviveDiscard: true },
        { cost: r({ glass: 1, papyrus: 1, cloth: 1 }), reviveDiscard: true },
      ],
    },
  },
  {
    id: 'giza',
    name: 'The Pyramids of Giza',
    starts: 'stone',
    sides: {
      A: [{ cost: r({ stone: 2 }), points: 3 }, { cost: r({ wood: 3 }), points: 5 }, { cost: r({ stone: 4 }), points: 7 }],
      B: [
        { cost: r({ wood: 2 }), points: 3 },
        { cost: r({ stone: 3 }), points: 5 },
        { cost: r({ clay: 3 }), points: 5 },
        { cost: r({ stone: 4, papyrus: 1 }), points: 7 },
      ],
    },
  },
];

export const ALL_CARDS: Card[] = [...AGE_I, ...AGE_II, ...AGE_III, ...GUILDS];
/** By id. The three workshops appear in Ages I and II under the same id: the Age I entry stands for both. */
const byId = new Map<string, Card>();
for (const card of ALL_CARDS) if (!byId.has(card.id)) byId.set(card.id, card);
export const cardOf = (id: string): Card => byId.get(id)!;
export const boardOf = (id: string): Board => BOARDS.find((b) => b.id === id)!;
