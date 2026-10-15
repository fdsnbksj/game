/** Every game, in the order home lists them: add a game here and it appears there. */
export type GameId = 'avalon' | 'duel' | 'wonders' | 'isle' | 'nonograms' | 'hero';

export interface Game {
  id: GameId;
  name: string;
  tagline: string;
  /** Who can play: shown as a chip. */
  players: string;
  /** Where its front door is. */
  path: string;
}

export const GAMES: readonly Game[] = [
  { id: 'avalon', name: 'Avalon', tagline: 'Hidden roles, one table', players: '5–10', path: '/avalon' },
  { id: 'duel', name: 'Rival Wonders', tagline: 'Two cities, head to head', players: '2', path: '/duel' },
  { id: 'wonders', name: 'Ancient Wonders', tagline: 'Build a city, bots welcome', players: '3–7', path: '/wonders' },
  { id: 'isle', name: 'Island Settlers', tagline: 'Build, trade, bots welcome', players: '3–4', path: '/isle' },
  { id: 'nonograms', name: 'Nonograms', tagline: 'Fill the grid to match the clues', players: '1', path: '/nonograms' },
  { id: 'hero', name: 'Hero Gambit', tagline: 'Timing, roulette and cards, against a friend', players: '2', path: '/hero' },
];
