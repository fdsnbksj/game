import { createRandom, hashSeed } from '../shared/random';

// A question from a highlight: one telling word blanked out, to pick from four. Recalling
// a word into its sentence is what makes a line stick, and a choice of four keeps it to
// one thumb. The other choices are words from the player's own highlights, so they
// belong to the same book and sound plausible.

export interface Question {
  /** The highlight with the answer cut out: before, the blank, after. */
  before: string;
  after: string;
  answer: string;
  /** The answer and up to three others, shuffled. */
  choices: string[];
}

const WORD = /[\p{L}\p{N}][\p{L}\p{N}'’-]*[\p{L}\p{N}]|[\p{L}\p{N}]/gu;

/** Words too common to say anything about the line. */
const STOP = new Set(
  (
    'about above after again against because been before being below between both could does doing during each ' +
    'from further have having here into itself just more most other ought over same should some such than that their ' +
    'theirs them themselves then there these they this those through under until very were what when where which while ' +
    'whom will with would your yours yourself also only even ever every never much many made make like well cannot ' +
    'still upon within without shall might must once dont doesnt didnt isnt wasnt youre theyre thats whats ' +
    'something everything anything nothing someone everyone anyone people peoples things always really ' +
    'became become better thought believed preferred insisted described introduced released entirely saying'
  ).split(' '),
);

const plain = (word: string) => word.toLowerCase().replace(/['’]/g, '');

/** Words worth asking about: long enough to mean something, and not filler. */
export function keyWords(text: string): string[] {
  return [...text.matchAll(WORD)].map((m) => m[0]).filter((word) => word.length >= 4 && !STOP.has(plain(word)) && !/^\d+$/.test(word));
}

/**
 * The question for a highlight. `seed` varies it from one review to the next (a different
 * word may be blanked), and `pool` is the text of other highlights, to draw choices from.
 * Null when the line has no word worth asking about.
 */
export function makeQuestion(text: string, pool: readonly string[], seed: string): Question | null {
  const random = createRandom(hashSeed(seed));
  const pick = <T>(list: readonly T[]) => list[Math.floor(random() * list.length)];

  // Among the longest few, which tend to be the ones that carry the line.
  const candidates = [...new Set(keyWords(text))].sort((a, b) => b.length - a.length).slice(0, 3);
  if (candidates.length === 0) return null;
  const answer = pick(candidates);

  const at = [...text.matchAll(WORD)].find((m) => m[0] === answer)!.index!;
  const taken = new Set([plain(answer)]);
  const others: string[] = [];
  // Other highlights first, then the rest of this one; closest in length first, so no
  // choice gives itself away by looking out of place.
  for (const source of [pool.join(' '), text]) {
    const words = [...new Set(keyWords(source))].filter((w) => !taken.has(plain(w)));
    const ranked = words
      .map((w) => ({ w, score: Math.abs(w.length - answer.length) + random() * 2 }))
      .sort((a, b) => a.score - b.score);
    for (const { w } of ranked) {
      if (others.length === 3) break;
      if (taken.has(plain(w))) continue;
      taken.add(plain(w));
      others.push(matchCase(w, answer));
    }
  }
  if (others.length === 0) return null;

  const choices = [answer, ...others];
  for (let i = choices.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [choices[i], choices[j]] = [choices[j], choices[i]];
  }
  return { before: text.slice(0, at), after: text.slice(at + answer.length), answer, choices };
}

/** Capitalised like the answer, so a capital letter doesn't give the answer away. */
function matchCase(word: string, like: string): string {
  const lower = word.toLowerCase();
  return like[0] === like[0].toUpperCase() && like[0] !== like[0].toLowerCase() ? lower[0].toUpperCase() + lower.slice(1) : lower;
}
