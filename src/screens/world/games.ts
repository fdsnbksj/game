/** Every game, in the order home lists them: add a game here and it appears there. */
export type GameId = 'avalon' | 'wonders' | 'nonograms' | 'hero' | 'sky' | 'bluff' | 'beads' | 'glide' | 'pipes' | 'lanterns' | 'threads' | 'vault' | 'gridlock' | 'pass';

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
  { id: 'pass', name: 'Pass or Pay', tagline: 'Pay a coin, or take the card', players: '2–6', path: '/pass', isNew: true },
  { id: 'bluff', name: 'Bluff Table', tagline: 'Lie, call, pull the trigger', players: '2–4', path: '/bluff' },
  { id: 'gridlock', name: 'Gridlock', tagline: 'Slide the cars, free the red one', players: '1', path: '/gridlock' },
  { id: 'vault', name: 'Vault', tagline: 'Crack the code from the clues', players: '1', path: '/vault' },
  { id: 'nonograms', name: 'Nonograms', tagline: 'Fill the grid to match the clues', players: '1', path: '/nonograms' },
  { id: 'beads', name: 'Bead Sort', tagline: 'One colour to a tube, tap by tap', players: '1', path: '/beads' },
  { id: 'glide', name: 'Glide', tagline: 'Swipe blocks home in so many moves', players: '1', path: '/glide' },
  { id: 'lanterns', name: 'Lanterns', tagline: 'Tap to flip, put every light out', players: '1', path: '/lanterns' },
  { id: 'threads', name: 'Threads', tagline: 'Join the pairs, fill every square', players: '1', path: '/threads' },
  { id: 'pipes', name: 'Waterworks', tagline: 'Turn the pipes till every tile runs', players: '1', path: '/pipes' },
  { id: 'sky', name: 'Sky Ace', tagline: 'A 90s arcade shooter, one thumb', players: '1', path: '/sky' },
  { id: 'hero', name: 'Hero Gambit', tagline: 'Timing, roulette and cards, against a friend', players: '2', path: '/hero' },
];
