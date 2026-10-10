// The lines around Hero Gambit, in a deadpan, burpy, a-bit-existential late-night cartoon
// voice (our own lines, never a show's catchphrases): what your hero says on Home and the
// captions on a win or a loss (the fight's stamps are in Fight.tsx). Tame on purpose: never
// cruel, no slurs, no jabs at anyone real. Picked by a number (the turn, the fight) so a screen is steady.

export const HOME_LINES = [
  'nothing matters. except this fight',
  'ugh. fine. one more',
  'my stopwatch has seen things',
  'existential dread? in this economy?',
  'i’m fine. this is fine.',
  'science says: gamble',
  'touch grass? which dimension',
  'my drip is unmatched',
];

export const WIN_LINES = ['dimension: conquered', 'science, baby', 'that was disgusting. nice.', 'certified W', 'gg, cosmically', 'clean. weirdly clean.'];

export const LOSE_LINES = ['we’re all just meat anyway', 'the multiverse hates me', 'it’s fine. everything’s fine', 'skill issue (cosmic)', 'reality is rigged', 'we go again, i guess'];

export const pick = (list: readonly string[], n: number) => list[((n % list.length) + list.length) % list.length];
