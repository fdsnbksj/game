// The goofy lines around Hero Gambit: what your hero says on Home, the captions on a win or
// a loss, and the stamps on a big moment in a fight. Tame on purpose: never cruel, no slurs,
// no jabs at anyone real. Picked by a number (the turn, the fight) so a screen is steady.

export const HOME_LINES = [
  'ready to gamble',
  'skill issue? never',
  'one more fight…',
  'trust the stopwatch',
  'all in on red',
  'built different',
  'my drip is unmatched',
  'touch grass later',
];

export const WIN_LINES = ['gg ez', 'built different', 'too easy', 'certified W', 'absolute cinema', 'clean'];

export const LOSE_LINES = ['skill issue', 'it’s rigged', 'lag', 'next one for sure', 'unlucky fr', 'we go again'];

export const pick = (list: readonly string[], n: number) => list[((n % list.length) + list.length) % list.length];
