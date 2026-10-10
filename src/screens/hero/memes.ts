// The lines around Hero Gambit, in a cheerful backyard-garden voice full of plant puns (our own
// lines, nothing from any garden game: no brains, no zombies): what your hero says on Home and
// the captions on a win or a loss (the fight's stamps are in Fight.tsx). Kind on purpose: never
// cruel, no slurs, no jabs at anyone real. Picked by a number (the turn, the fight) so a screen is steady.

export const HOME_LINES = [
  'touch grass? i AM the grass',
  'dig in!',
  'water me with wins',
  'this lawn ain’t big enough',
  'growing stronger, slowly',
  'leaf it to me',
  'rooting for myself',
  'my gloves are ready',
];

export const WIN_LINES = ['fresh harvest!', 'weeded it', 'in full bloom', 'rooted in victory', 'mowed right through', 'a bumper crop of W'];

export const LOSE_LINES = ['trampled…', 'i’ll grow back', 'need more fertiliser', 'wilted. briefly.', 'back to the seed tray', 'nipped in the bud'];

export const pick = (list: readonly string[], n: number) => list[((n % list.length) + list.length) % list.length];
