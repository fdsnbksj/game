/**
 * The world map's three regions and the games in each. The single list the map, the zone
 * pages and the tests read: add a game here and it appears in its zone.
 */
export type ZoneId = 'keep' | 'tower' | 'arena';
export type GameId = 'avalon' | 'duel' | 'wonders' | 'isle' | 'nonograms' | 'brawl' | 'hero';

export interface ZoneGame {
  id: GameId;
  name: string;
  tagline: string;
  /** Who can play: shown as a chip. */
  players: string;
  /** Where its front door is. */
  path: string;
}

export interface Zone {
  id: ZoneId;
  name: string;
  /** One line under the zone's banner. */
  lore: string;
  games: ZoneGame[];
}

export const ZONES: readonly Zone[] = [
  {
    id: 'keep',
    name: 'Board Game Keep',
    lore: 'Tables for friends, each on their own phone. Bots fill empty seats.',
    games: [
      { id: 'avalon', name: 'Avalon', tagline: 'Hidden roles, one table', players: '5–10', path: '/avalon' },
      { id: 'duel', name: 'Rival Wonders', tagline: 'Two cities, head to head', players: '2', path: '/duel' },
      { id: 'wonders', name: 'Ancient Wonders', tagline: 'Build a city, bots welcome', players: '3–7', path: '/wonders' },
      { id: 'isle', name: 'Island Settlers', tagline: 'Build, trade, bots welcome', players: '3–4', path: '/isle' },
    ],
  },
  {
    id: 'tower',
    name: 'Puzzle Tower',
    lore: 'One floor at a time, between chapters. No clock, no way to lose.',
    games: [{ id: 'nonograms', name: 'Nonograms', tagline: 'Fill the grid to match the clues', players: '1', path: '/nonograms' }],
  },
  {
    id: 'arena',
    name: 'Battle Arena',
    lore: 'Your hero, a ladder of bots, and stick fighters. Last one standing.',
    games: [
      { id: 'hero', name: 'Hero Gambit', tagline: 'Timing, roulette and cards. Grow your hero', players: '1–2', path: '/hero' },
      { id: 'brawl', name: 'Stick Brawl', tagline: 'Guns, chickens, sixteen stages', players: '1–4', path: '/brawl' },
    ],
  },
];

export const zoneOf = (game: string): Zone | undefined => ZONES.find((z) => z.games.some((g) => g.id === game));
