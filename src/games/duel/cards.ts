// Rival Wonders: the cards. The play follows a published two-player duel of ancient
// wonders, but the names are ours: plain descriptive card names, the real historical
// wonders, and no card text or art from the original. Keep it that way (CLAUDE.md).

export type Res = 'wood' | 'clay' | 'stone' | 'glass' | 'papyrus';
export const RESOURCES: Res[] = ['wood', 'clay', 'stone', 'glass', 'papyrus'];
/** Raw materials come from brown cards, manufactured goods from grey. */
export const RAW: Res[] = ['wood', 'clay', 'stone'];

export type Color = 'brown' | 'grey' | 'blue' | 'green' | 'red' | 'yellow' | 'purple';

/** Science symbols: each appears on two green cards, except `law`, which only a progress token gives. */
export type Science = 'wheel' | 'mortar' | 'quill' | 'plumb' | 'sundial' | 'globe' | 'law';

export interface Cost {
  coins?: number;
  res?: Partial<Record<Res, number>>;
}

/** What a guild counts, in whichever city has the most of it. */
export type GuildKind = 'yellow' | 'brownGrey' | 'blue' | 'green' | 'red' | 'wonders' | 'coins';

export interface Card {
  id: string;
  name: string;
  age: 1 | 2 | 3;
  color: Color;
  cost: Cost;
  /** A link symbol this card needs: owning a card that gives it makes this one free. */
  chainFrom?: string;
  /** A link symbol this card gives. */
  chainTo?: string;
  produces?: Partial<Record<Res, number>>;
  /** Commercial: one of these each turn (not counted for the opponent's trade prices). */
  choice?: Res[];
  /** Commercial: these can be bought from the bank for 1 coin each. */
  fixes?: Res[];
  points?: number;
  shields?: number;
  science?: Science;
  /** Coins on building. */
  coins?: number;
  /** Coins on building, per card of a kind (or wonder) in your own city. */
  coinsPer?: { what: 'grey' | 'brown' | 'red' | 'yellow' | 'wonder'; each: number };
  guild?: GuildKind;
}

const card = (c: Card) => c;
const r = (res: Cost['res'], coins?: number): Cost => ({ res, coins });

export const AGE_I: Card[] = [
  card({ id: 'timber-stack', name: 'Timber Stack', age: 1, color: 'brown', cost: {}, produces: { wood: 1 } }),
  card({ id: 'woodcutters', name: 'Woodcutters', age: 1, color: 'brown', cost: { coins: 1 }, produces: { wood: 1 } }),
  card({ id: 'mud-flats', name: 'Mud Flats', age: 1, color: 'brown', cost: {}, produces: { clay: 1 } }),
  card({ id: 'clay-diggings', name: 'Clay Diggings', age: 1, color: 'brown', cost: { coins: 1 }, produces: { clay: 1 } }),
  card({ id: 'rock-cut', name: 'Rock Cut', age: 1, color: 'brown', cost: {}, produces: { stone: 1 } }),
  card({ id: 'stonecutters', name: 'Stonecutters', age: 1, color: 'brown', cost: { coins: 1 }, produces: { stone: 1 } }),
  card({ id: 'glass-kiln', name: 'Glass Kiln', age: 1, color: 'grey', cost: { coins: 1 }, produces: { glass: 1 } }),
  card({ id: 'reed-press', name: 'Reed Press', age: 1, color: 'grey', cost: { coins: 1 }, produces: { papyrus: 1 } }),
  card({ id: 'shrine', name: 'Shrine', age: 1, color: 'blue', cost: {}, points: 3, chainTo: 'moon' }),
  card({ id: 'bathhouse', name: 'Bathhouse', age: 1, color: 'blue', cost: r({ stone: 1 }), points: 3, chainTo: 'drop' }),
  card({ id: 'playhouse', name: 'Playhouse', age: 1, color: 'blue', cost: {}, points: 3, chainTo: 'mask' }),
  card({ id: 'herbalist', name: 'Herbalist', age: 1, color: 'green', cost: r({ glass: 1 }), points: 1, science: 'wheel' }),
  card({ id: 'workbench', name: 'Workbench', age: 1, color: 'green', cost: r({ papyrus: 1 }), points: 1, science: 'plumb' }),
  card({ id: 'copy-room', name: 'Copy Room', age: 1, color: 'green', cost: { coins: 2 }, science: 'quill', chainTo: 'book' }),
  card({ id: 'remedy-stall', name: 'Remedy Stall', age: 1, color: 'green', cost: { coins: 2 }, science: 'mortar', chainTo: 'gear' }),
  card({ id: 'watchtower', name: 'Watchtower', age: 1, color: 'red', cost: {}, shields: 1 }),
  card({ id: 'horse-pens', name: 'Horse Pens', age: 1, color: 'red', cost: r({ wood: 1 }), shields: 1, chainTo: 'horseshoe' }),
  card({ id: 'outpost', name: 'Outpost', age: 1, color: 'red', cost: r({ clay: 1 }), shields: 1, chainTo: 'sword' }),
  card({ id: 'stockade', name: 'Stockade', age: 1, color: 'red', cost: { coins: 2 }, shields: 1, chainTo: 'tower' }),
  card({ id: 'inn', name: 'Inn', age: 1, color: 'yellow', cost: {}, coins: 4, chainTo: 'amphora' }),
  card({ id: 'stone-depot', name: 'Stone Depot', age: 1, color: 'yellow', cost: { coins: 3 }, fixes: ['stone'] }),
  card({ id: 'clay-depot', name: 'Clay Depot', age: 1, color: 'yellow', cost: { coins: 3 }, fixes: ['clay'] }),
  card({ id: 'timber-depot', name: 'Timber Depot', age: 1, color: 'yellow', cost: { coins: 3 }, fixes: ['wood'] }),
];

export const AGE_II: Card[] = [
  card({ id: 'sawpit', name: 'Sawpit', age: 2, color: 'brown', cost: { coins: 2 }, produces: { wood: 2 } }),
  card({ id: 'brickworks', name: 'Brickworks', age: 2, color: 'brown', cost: { coins: 2 }, produces: { clay: 2 } }),
  card({ id: 'terrace-quarry', name: 'Terrace Quarry', age: 2, color: 'brown', cost: { coins: 2 }, produces: { stone: 2 } }),
  card({ id: 'glass-furnace', name: 'Glass Furnace', age: 2, color: 'grey', cost: {}, produces: { glass: 1 } }),
  card({ id: 'drying-loft', name: 'Drying Loft', age: 2, color: 'grey', cost: {}, produces: { papyrus: 1 } }),
  card({ id: 'tribunal', name: 'Tribunal', age: 2, color: 'blue', cost: r({ wood: 2, glass: 1 }), points: 5 }),
  card({ id: 'monument', name: 'Monument', age: 2, color: 'blue', cost: r({ clay: 2 }), points: 4, chainFrom: 'mask', chainTo: 'pillar' }),
  card({ id: 'sanctuary', name: 'Sanctuary', age: 2, color: 'blue', cost: r({ wood: 1, papyrus: 1 }), points: 4, chainFrom: 'moon', chainTo: 'sun' }),
  card({ id: 'waterworks', name: 'Waterworks', age: 2, color: 'blue', cost: r({ stone: 3 }), points: 5, chainFrom: 'drop' }),
  card({ id: 'podium', name: 'Podium', age: 2, color: 'blue', cost: r({ stone: 1, wood: 1 }), points: 4, chainTo: 'column' }),
  card({ id: 'archive', name: 'Archive', age: 2, color: 'green', cost: r({ stone: 1, wood: 1, glass: 1 }), points: 2, science: 'quill', chainFrom: 'book' }),
  card({ id: 'infirmary', name: 'Infirmary', age: 2, color: 'green', cost: r({ clay: 2, stone: 1 }), points: 2, science: 'mortar', chainFrom: 'gear' }),
  card({ id: 'schoolhouse', name: 'Schoolhouse', age: 2, color: 'green', cost: r({ wood: 1, papyrus: 2 }), points: 1, science: 'wheel', chainTo: 'harp' }),
  card({ id: 'testing-room', name: 'Testing Room', age: 2, color: 'green', cost: r({ wood: 1, glass: 2 }), points: 1, science: 'plumb', chainTo: 'lamp' }),
  card({ id: 'horse-farm', name: 'Horse Farm', age: 2, color: 'red', cost: r({ clay: 1, wood: 1 }), shields: 1, chainFrom: 'horseshoe' }),
  card({ id: 'quarters', name: 'Quarters', age: 2, color: 'red', cost: { coins: 3 }, shields: 1, chainFrom: 'sword' }),
  card({ id: 'bow-range', name: 'Bow Range', age: 2, color: 'red', cost: r({ stone: 1, wood: 1, papyrus: 1 }), shields: 2, chainTo: 'target' }),
  card({ id: 'drill-field', name: 'Drill Field', age: 2, color: 'red', cost: r({ clay: 2, glass: 1 }), shields: 2, chainTo: 'helmet' }),
  card({ id: 'ramparts', name: 'Ramparts', age: 2, color: 'red', cost: r({ stone: 2 }), shields: 2 }),
  card({ id: 'market-square', name: 'Market Square', age: 2, color: 'yellow', cost: r({ clay: 1 }, 3), choice: ['glass', 'papyrus'] }),
  card({ id: 'caravan-stop', name: 'Caravan Stop', age: 2, color: 'yellow', cost: r({ glass: 1, papyrus: 1 }, 2), choice: ['wood', 'clay', 'stone'] }),
  card({ id: 'toll-house', name: 'Toll House', age: 2, color: 'yellow', cost: { coins: 4 }, fixes: ['glass', 'papyrus'] }),
  card({ id: 'alehouse', name: 'Alehouse', age: 2, color: 'yellow', cost: {}, coins: 6, chainTo: 'barrel' }),
];

export const AGE_III: Card[] = [
  card({ id: 'assembly', name: 'Assembly', age: 3, color: 'blue', cost: r({ clay: 2, stone: 1, papyrus: 1 }), points: 5, chainFrom: 'column' }),
  card({ id: 'spire', name: 'Spire', age: 3, color: 'blue', cost: r({ stone: 2, glass: 1 }), points: 5 }),
  card({ id: 'parkland', name: 'Parkland', age: 3, color: 'blue', cost: r({ clay: 2, wood: 2 }), points: 6, chainFrom: 'pillar' }),
  card({ id: 'hall-of-gods', name: 'Hall of Gods', age: 3, color: 'blue', cost: r({ clay: 1, wood: 1, papyrus: 2 }), points: 6, chainFrom: 'sun' }),
  card({ id: 'royal-court', name: 'Royal Court', age: 3, color: 'blue', cost: r({ clay: 1, stone: 1, wood: 1, glass: 2 }), points: 7 }),
  card({ id: 'civic-hall', name: 'Civic Hall', age: 3, color: 'blue', cost: r({ stone: 3, wood: 2 }), points: 7 }),
  card({ id: 'lyceum', name: 'Lyceum', age: 3, color: 'green', cost: r({ stone: 1, wood: 1, glass: 2 }), points: 3, science: 'sundial' }),
  card({ id: 'reading-room', name: 'Reading Room', age: 3, color: 'green', cost: r({ wood: 2, glass: 1, papyrus: 1 }), points: 3, science: 'sundial' }),
  card({ id: 'grand-school', name: 'Grand School', age: 3, color: 'green', cost: r({ clay: 1, glass: 1, papyrus: 1 }), points: 2, science: 'globe', chainFrom: 'harp' }),
  card({ id: 'star-tower', name: 'Star Tower', age: 3, color: 'green', cost: r({ stone: 1, papyrus: 2 }), points: 2, science: 'globe', chainFrom: 'lamp' }),
  card({ id: 'bastions', name: 'Bastions', age: 3, color: 'red', cost: r({ stone: 2, clay: 1, papyrus: 1 }), shields: 2, chainFrom: 'tower' }),
  card({ id: 'engine-works', name: 'Engine Works', age: 3, color: 'red', cost: r({ wood: 3, glass: 1 }), shields: 2, chainFrom: 'target' }),
  card({ id: 'racecourse', name: 'Racecourse', age: 3, color: 'red', cost: r({ clay: 2, stone: 2 }), shields: 2, chainFrom: 'helmet' }),
  card({ id: 'weapon-stores', name: 'Weapon Stores', age: 3, color: 'red', cost: r({ clay: 3, wood: 2 }), shields: 3 }),
  card({ id: 'war-council', name: 'War Council', age: 3, color: 'red', cost: { coins: 8 }, shields: 3 }),
  card({ id: 'traders-hall', name: 'Traders’ Hall', age: 3, color: 'yellow', cost: r({ papyrus: 2 }), points: 3, coinsPer: { what: 'grey', each: 3 } }),
  card({ id: 'harbour', name: 'Harbour', age: 3, color: 'yellow', cost: r({ wood: 1, glass: 1, papyrus: 1 }), points: 3, coinsPer: { what: 'brown', each: 2 } }),
  card({ id: 'smithy', name: 'Smithy', age: 3, color: 'yellow', cost: r({ stone: 2, glass: 1 }), points: 3, coinsPer: { what: 'red', each: 1 } }),
  card({ id: 'beacon', name: 'Beacon', age: 3, color: 'yellow', cost: r({ clay: 2, glass: 1 }), points: 3, coinsPer: { what: 'yellow', each: 1 }, chainFrom: 'amphora' }),
  card({ id: 'stadium', name: 'Stadium', age: 3, color: 'yellow', cost: r({ clay: 1, stone: 1, wood: 1 }), points: 3, coinsPer: { what: 'wonder', each: 2 }, chainFrom: 'barrel' }),
];

export const GUILDS: Card[] = [
  card({ id: 'guild-markets', name: 'Guild of Markets', age: 3, color: 'purple', cost: r({ clay: 1, wood: 1, glass: 1, papyrus: 1 }), guild: 'yellow' }),
  card({ id: 'guild-shippers', name: 'Guild of Shippers', age: 3, color: 'purple', cost: r({ clay: 1, stone: 1, glass: 1, papyrus: 1 }), guild: 'brownGrey' }),
  card({ id: 'guild-builders', name: 'Guild of Builders', age: 3, color: 'purple', cost: r({ stone: 2, clay: 1, wood: 1, glass: 1 }), guild: 'wonders' }),
  card({ id: 'guild-judges', name: 'Guild of Judges', age: 3, color: 'purple', cost: r({ wood: 2, clay: 1, papyrus: 1 }), guild: 'blue' }),
  card({ id: 'guild-scholars', name: 'Guild of Scholars', age: 3, color: 'purple', cost: r({ clay: 2, wood: 2 }), guild: 'green' }),
  card({ id: 'guild-lenders', name: 'Guild of Lenders', age: 3, color: 'purple', cost: r({ stone: 2, wood: 2 }), guild: 'coins' }),
  card({ id: 'guild-generals', name: 'Guild of Generals', age: 3, color: 'purple', cost: r({ stone: 2, clay: 1, papyrus: 1 }), guild: 'red' }),
];

export interface Wonder {
  id: string;
  name: string;
  cost: Cost;
  points: number;
  coins?: number;
  /** The opponent loses this many coins (as many as they have). */
  opponentLoses?: number;
  shields?: number;
  playAgain?: boolean;
  /** Destroy one of the opponent's cards of this colour. */
  destroy?: 'brown' | 'grey';
  /** Build a card from the discard pile for free. */
  revive?: boolean;
  /** Choose one of three progress tokens drawn from those left out of the game. */
  library?: boolean;
  choice?: Res[];
}

export const WONDERS: Wonder[] = [
  { id: 'appian-way', name: 'The Appian Way', cost: r({ stone: 2, clay: 2, papyrus: 1 }), points: 3, coins: 3, opponentLoses: 3, playAgain: true },
  { id: 'circus-maximus', name: 'Circus Maximus', cost: r({ stone: 2, wood: 1, glass: 1 }), points: 3, shields: 1, destroy: 'grey' },
  { id: 'colossus', name: 'The Colossus', cost: r({ clay: 3, glass: 1 }), points: 3, shields: 2 },
  { id: 'great-library', name: 'The Great Library', cost: r({ wood: 3, glass: 1, papyrus: 1 }), points: 4, library: true },
  { id: 'pharos', name: 'The Pharos', cost: r({ wood: 1, stone: 1, papyrus: 2 }), points: 4, choice: ['wood', 'clay', 'stone'] },
  { id: 'hanging-gardens', name: 'The Hanging Gardens', cost: r({ wood: 2, glass: 1, papyrus: 1 }), points: 3, coins: 6, playAgain: true },
  { id: 'mausoleum', name: 'The Mausoleum', cost: r({ clay: 2, glass: 2, papyrus: 1 }), points: 2, revive: true },
  { id: 'piraeus', name: 'Piraeus', cost: r({ wood: 2, stone: 1, clay: 1 }), points: 2, choice: ['glass', 'papyrus'], playAgain: true },
  { id: 'pyramids', name: 'The Pyramids', cost: r({ stone: 3, papyrus: 1 }), points: 9 },
  { id: 'sphinx', name: 'The Sphinx', cost: r({ stone: 1, clay: 1, glass: 2 }), points: 6, playAgain: true },
  { id: 'statue-of-zeus', name: 'The Statue of Zeus', cost: r({ stone: 1, wood: 1, clay: 1, papyrus: 2 }), points: 3, shields: 1, destroy: 'brown' },
  { id: 'temple-of-artemis', name: 'The Temple of Artemis', cost: r({ wood: 1, stone: 1, glass: 1, papyrus: 1 }), points: 0, coins: 12, playAgain: true },
];

export type TokenId = 'farming' | 'engineering' | 'commerce' | 'justice' | 'stonecraft' | 'geometry' | 'wisdom' | 'tactics' | 'devotion' | 'city-planning';

export interface Token {
  id: TokenId;
  name: string;
  text: string;
}

export const TOKENS: Token[] = [
  { id: 'farming', name: 'Farming', text: '6 coins now, and 4 points.' },
  { id: 'engineering', name: 'Engineering', text: 'Your wonders cost 2 fewer resources.' },
  { id: 'commerce', name: 'Commerce', text: 'Coins your opponent pays to buy resources come to you.' },
  { id: 'justice', name: 'Justice', text: 'A science symbol of its own.' },
  { id: 'stonecraft', name: 'Stonecraft', text: 'Your blue cards cost 2 fewer resources.' },
  { id: 'geometry', name: 'Geometry', text: '3 points for each progress token you have, this one included.' },
  { id: 'wisdom', name: 'Wisdom', text: '7 points.' },
  { id: 'tactics', name: 'Tactics', text: 'Each red card you build from now on gives 1 more shield.' },
  { id: 'devotion', name: 'Devotion', text: 'Every wonder you build from now on gives you another turn.' },
  { id: 'city-planning', name: 'City Planning', text: '6 coins now, and 4 coins whenever you build a card through a chain.' },
];

export const ALL_CARDS: Card[] = [...AGE_I, ...AGE_II, ...AGE_III, ...GUILDS];
const byId = new Map(ALL_CARDS.map((c) => [c.id, c]));
const wonderById = new Map(WONDERS.map((w) => [w.id, w]));
export const cardOf = (id: string): Card => byId.get(id)!;
export const wonderOf = (id: string): Wonder => wonderById.get(id)!;
export const tokenOf = (id: TokenId): Token => TOKENS.find((t) => t.id === id)!;
