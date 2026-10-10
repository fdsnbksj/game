// The lines around Hero Gambit, in a hyper, silly, slapstick Saturday-morning cartoon voice (our
// own lines, never a show's catchphrases): what your hero says on Home and the captions on a win
// or a loss (the fight's stamps are in Fight.tsx). Kind on purpose: never cruel, no slurs, no
// jabs at anyone real. Picked by a number (the turn, the fight) so a screen is steady.

export const HOME_LINES = [
  'i have no plan and it’s working',
  'one more fight then snacks',
  'boing boing boing',
  'my stopwatch is my best friend',
  'today i choose chaos',
  'is it fight o’clock? it’s fight o’clock',
  'my legs are noodles and i’m fine with it',
  'look at my drip. LOOK AT IT',
];

export const WIN_LINES = ['BOOM. nailed it', 'did you SEE that??', 'victory dance time', 'too easy (it wasn’t)', 'i am unstoppable-ish', 'hold my juice box'];

export const LOSE_LINES = ['ow. ow. ow.', 'i meant to do that', 'ok that one’s on me', 'rematch! rematch!', 'my noodle legs gave out', 'seeing stars (the bad kind)'];

export const pick = (list: readonly string[], n: number) => list[((n % list.length) + list.length) % list.length];
