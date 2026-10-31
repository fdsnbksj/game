import { stream } from '../../nonogram/rng';

// Pass or Pay: a push-your-luck card game for 2–6 phones. The deck is the numbers 3 to 35;
// nine are set aside unseen, so nobody knows which numbers will come. One card lies face
// up. On your turn, pay a coin onto it to pass it on, or take it with every coin on it;
// whoever takes it turns up the next card and moves again. With no coins you must take.
// Once the deck is gone, each player scores the numbers they took, but a run of numbers in
// a row (21, 22, 23) counts only its lowest, and every coin left takes one off. Lowest
// score wins.
//
// A reducer: apply(state, move, seat) gives the next state, or null when the move isn't
// allowed; replay() runs a room's moves from its seed, skipping refused ones, so every
// phone comes out the same. The deck's order and who starts come from the seed.

/** Bump when the same moves would play out differently: phones on other versions don't share a room. */
export const PASS_VERSION = 1;

export const LOW = 3;
export const HIGH = 35;
/** Cards set aside unseen at the start. */
export const SET_ASIDE = 9;
export const MIN_SEATS = 2;
export const MAX_SEATS = 6;

/** Coins each player starts with: fewer at a full table, so the pots stay tight. */
export const startingCoins = (seats: number) => (seats >= 6 ? 9 : 11);

export interface Player {
  /** Cards taken, lowest first. */
  cards: number[];
  coins: number;
}

/** The last thing that happened, for the screen to say. */
export interface Last {
  by: number;
  type: 'pay' | 'take';
  card: number;
  /** Coins on the card after a pay, or taken with it. */
  pot: number;
}

export interface PassState {
  seed: string;
  players: Player[];
  /** Face-down cards still to come, next first. */
  deck: number[];
  /** The face-up card, or null once the game is over. */
  card: number | null;
  /** Coins on the face-up card. */
  pot: number;
  /** Whose move it is. */
  turn: number;
  last: Last | null;
  /** Seats with the lowest score once the deck is gone (ties share the win); null while playing. */
  winners: number[] | null;
  /** Moves applied so far. */
  count: number;
}

export type Move = { type: 'pay' } | { type: 'take' };

export interface Recorded {
  by: string;
  move: Move;
}

function shuffle<T>(items: T[], rng: (n: number) => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = rng(i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function start(seed: string, seats: number): PassState {
  const all = Array.from({ length: HIGH - LOW + 1 }, (_, i) => LOW + i);
  const deck = shuffle(all, stream(`${seed}:deck`)).slice(SET_ASIDE);
  const players = Array.from({ length: seats }, (): Player => ({ cards: [], coins: startingCoins(seats) }));
  return { seed, players, deck: deck.slice(1), card: deck[0], pot: 0, turn: stream(`${seed}:first`)(seats), last: null, winners: null, count: 0 };
}

/** The cards in runs of numbers in a row, lowest first: [[3], [21, 22, 23]]. */
export function runs(cards: readonly number[]): number[][] {
  const out: number[][] = [];
  for (const c of [...cards].sort((a, b) => a - b)) {
    const run = out.at(-1);
    if (run && c === run.at(-1)! + 1) run.push(c);
    else out.push([c]);
  }
  return out;
}

/** Each run's lowest number, less a point for every coin. Lower is better. */
export const score = (p: Player) => runs(p.cards).reduce((sum, run) => sum + run[0], 0) - p.coins;

/** What taking `card` would add to this player's score, coins on it included: a card next to a run costs nothing. */
export function takeCost(p: Player, card: number, pot: number): number {
  return score({ cards: [...p.cards, card], coins: p.coins + pot }) - score(p);
}

/** True when the player to move has no coin and must take. */
export const mustTake = (s: PassState) => s.winners === null && s.players[s.turn].coins === 0;

export function apply(s: PassState, move: Move, seat: number): PassState | null {
  if (s.winners !== null || s.card === null || seat !== s.turn || !s.players[seat]) return null;
  const card = s.card;

  if (move.type === 'pay') {
    if (s.players[seat].coins === 0) return null;
    const players = s.players.map((p, i) => (i === seat ? { ...p, coins: p.coins - 1 } : p));
    const pot = s.pot + 1;
    return { ...s, players, pot, turn: (seat + 1) % s.players.length, last: { by: seat, type: 'pay', card, pot }, count: s.count + 1 };
  }

  if (move.type === 'take') {
    const players = s.players.map((p, i) => (i === seat ? { cards: [...p.cards, card].sort((a, b) => a - b), coins: p.coins + s.pot } : p));
    const last: Last = { by: seat, type: 'take', card, pot: s.pot };
    // The taker turns up the next card and moves again.
    const after: PassState = { ...s, players, deck: s.deck.slice(1), card: s.deck[0] ?? null, pot: 0, last, count: s.count + 1 };
    if (after.card !== null) return after;
    const scores = players.map(score);
    const best = Math.min(...scores);
    return { ...after, winners: scores.flatMap((v, i) => (v === best ? [i] : [])) };
  }

  return null;
}

export function replay(seed: string, seats: readonly string[], moves: readonly Recorded[]): PassState {
  let state = start(seed, seats.length);
  for (const m of moves) {
    const seat = seats.indexOf(m.by);
    if (seat >= 0) state = apply(state, m.move, seat) ?? state;
  }
  return state;
}

/** A finished game in a room: its seed and the number of its first move. */
export interface PastGame {
  seed: string;
  from: number;
}

/**
 * Wins per seat over a room's games: each past game replayed from its own moves (up to the
 * next game's first), plus the current one if it's over. A shared win counts for each.
 */
export function tally(seats: readonly string[], past: readonly PastGame[], current: PastGame, moves: readonly Recorded[]): number[] {
  const wins = seats.map(() => 0);
  const games = [...past, current];
  games.forEach((game, i) => {
    const to = i + 1 < games.length ? games[i + 1].from : moves.length;
    for (const w of replay(game.seed, seats, moves.slice(game.from, to)).winners ?? []) wins[w]++;
  });
  return wins;
}
