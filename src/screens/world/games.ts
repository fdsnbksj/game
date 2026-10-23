/** Every game, in the order home lists them: add a game here and it appears there. */
export type GameId = 'avalon' | 'wonders' | 'nonograms' | 'hero' | 'sky' | 'bluff' | 'beads' | 'glide';

export interface Game {
  id: GameId;
  name: string;
  tagline: string;
  /** Who can play: shown as a chip. */
  players: string;
  /** Where its front door is. */
  path: string;
  /** Just added: home shows a small New chip on its tile. */
  isNew?: boolean;
}

export const GAMES: readonly Game[] = [
  { id: 'avalon', name: 'Avalon', tagline: 'Hidden roles, one table', players: '5–10', path: '/avalon' },
  { id: 'wonders', name: 'Ancient Wonders', tagline: 'Build a city, bots welcome', players: '3–7', path: '/wonders' },
  { id: 'bluff', name: 'Bluff Table', tagline: 'Lie, call, pull the trigger', players: '2–4', path: '/bluff' },
  { id: 'nonograms', name: 'Nonograms', tagline: 'Fill the grid to match the clues', players: '1', path: '/nonograms' },
  { id: 'beads', name: 'Bead Sort', tagline: 'One colour to a tube, tap by tap', players: '1', path: '/beads' },
  { id: 'glide', name: 'Glide', tagline: 'Swipe blocks home in so many moves', players: '1', path: '/glide' },
  { id: 'sky', name: 'Sky Ace', tagline: 'A 90s arcade shooter, one thumb', players: '1', path: '/sky' },
  { id: 'hero', name: 'Hero Gambit', tagline: 'Timing, roulette and cards, against a friend', players: '2', path: '/hero' },
];
