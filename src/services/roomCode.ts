/** Letters that can't be mistaken for each other when read out across a table. */
const LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';

/** A random four-letter room code. */
export const newCode = () => Array.from(crypto.getRandomValues(new Uint32Array(4)), (n) => LETTERS[n % LETTERS.length]).join('');
