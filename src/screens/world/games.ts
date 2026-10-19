/** Every game, in the order home lists them: add a game here and it appears there. */
export type GameId = 'avalon' | 'wonders' | 'nonograms' | 'hero' | 'sky' | 'bluff' | 'traps';

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
  { id: 'wonders', name: 'Ancient Wonders', tagline: 'Build a city, bots welcome', players: '3–7', path: '/wonders' },
  { id: 'traps', name: 'Trap Tower', tagline: 'Set traps, then race to the flag', players: '2–4', path: '/traps' },
  { id: 'bluff', name: 'Bluff Table', tagline: 'Lie, call, pull the trigger', players: '2–4', path: '/bluff' },
  { id: 'nonograms', name: 'Nonograms', tagline: 'Fill the grid to match the clues', players: '1', path: '/nonograms' },
  { id: 'sky', name: 'Sky Ace', tagline: 'A 90s arcade shooter, one thumb', players: '1', path: '/sky' },
  { id: 'hero', name: 'Hero Gambit', tagline: 'Timing, roulette and cards, against a friend', players: '2', path: '/hero' },
];
