import { stream } from '../../nonogram/rng';

// Bluff Table: a bluffing card game for 2–4 phones, with a revolver at the table. A deck of
// six kings, six queens, six aces and two jokers (jokers count as anything). Each round
// names a table card and deals five cards to everyone still in. On your turn you put 1–3
// cards face down, claiming they're all the table card, or call the last player a liar.
// The call turns their cards over: any card that isn't the table card or a joker and the
// liar pulls the trigger of their own revolver; all true and the caller does. Each
// revolver has one bullet in six chambers, so each pull is likelier than the last. Then a
// new round. The last one standing wins.
//
// A reducer: apply(state, move, seat) gives the next state, or null when the move isn't
// allowed; replay() runs a room's moves from its seed, skipping refused ones, so every
// phone comes out the same. The deals, table cards and bullets come from the seed.

export type Rank = 'K' | 'Q' | 'A';
export type Card = Rank | 'J';

export const RANKS: readonly Rank[] = ['K', 'Q', 'A'];
export const HAND = 5;
export const CHAMBERS = 6;
export const MAX_PLAY = 3;
export const MIN_SEATS = 2;
export const MAX_SEATS = 4;
/** Cards that pass for the table card: six of it and two jokers. */
export const TRUE_CARDS = 8;

export interface Player {
  hand: Card[];
  alive: boolean;
  /** Times this player has pulled the trigger. */
  pulls: number;
  /** The chamber (1–6) the bullet sits in. */
  bullet: number;
}

export interface Play {
  by: number;
  cards: Card[];
}

/** A call and the shot that followed it, kept for the screen to show. */
export interface Showdown {
  round: number;
  caller: number;
  /** Whose cards were turned over. */
  accused: number;
  cards: Card[];
  table: Rank;
  lied: boolean;
  /** Who pulled the trigger. */
  shooter: number;
  /** Which pull it was for them (1–6). */
  pull: number;
  died: boolean;
}

export interface BluffState {
  seed: string;
  players: Player[];
  round: number;
  table: Rank;
  /** Whose move it is. */
  turn: number;
  /** The last cards put down this round, if any. */
  last: Play | null;
  /** Cards put down this round, face down. */
  pile: number;
  showdowns: Showdown[];
  winner: number | null;
  /** Moves applied so far. */
  count: number;
}

export type Move = { type: 'play'; cards: number[] } | { type: 'call' };

export interface Recorded {
  by: string;
  move: Move;
}

function deck(): Card[] {
  return [...RANKS.flatMap((r) => Array<Card>(6).fill(r)), 'J', 'J'];
}

function shuffle<T>(items: T[], rng: (n: number) => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = rng(i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function start(seed: string, seats: number): BluffState {
  const bullets = stream(`${seed}:bullets`);
  const players = Array.from({ length: seats }, (): Player => ({ hand: [], alive: true, pulls: 0, bullet: 1 + bullets(CHAMBERS) }));
  const first = stream(`${seed}:first`)(seats);
  return deal({ seed, players, round: 0, table: 'K', turn: first, last: null, pile: 0, showdowns: [], winner: null, count: 0 }, 0, first);
}

/** A new round: fresh cards for everyone still in, a new table card, `first` to lead. */
function deal(s: BluffState, round: number, first: number): BluffState {
  const rng = stream(`${s.seed}:round:${round}`);
  const cards = shuffle(deck(), rng);
  const table = RANKS[rng(RANKS.length)];
  let next = 0;
  const players = s.players.map((p) => (p.alive ? { ...p, hand: cards.slice(next, (next += HAND)) } : { ...p, hand: [] }));
  return { ...s, players, round, table, turn: first, last: null, pile: 0 };
}

/** The next player still in after `seat`, going round the table. */
function nextAlive(s: BluffState, seat: number): number {
  const n = s.players.length;
  for (let k = 1; k <= n; k++) {
    const i = (seat + k) % n;
    if (s.players[i].alive) return i;
  }
  return seat;
}

/** Who answers a play by `seat`: the next player still in who has cards, or if nobody else has any, the next one in. */
function responder(s: BluffState, seat: number): number {
  const n = s.players.length;
  for (let k = 1; k < n; k++) {
    const i = (seat + k) % n;
    if (s.players[i].alive && s.players[i].hand.length > 0) return i;
  }
  return nextAlive(s, seat);
}

/** True when the player to move can't put cards down and has to call: no cards, or no one else holds any. */
export function mustCall(s: BluffState): boolean {
  if (!s.last) return false;
  const me = s.players[s.turn];
  return me.hand.length === 0 || s.players.every((p, i) => i === s.turn || !p.alive || p.hand.length === 0);
}

export const isTrue = (card: Card, table: Rank) => card === table || card === 'J';

export function apply(s: BluffState, move: Move, seat: number): BluffState | null {
  if (s.winner !== null || seat !== s.turn || !s.players[seat]?.alive) return null;

  if (move.type === 'play') {
    const picks = move.cards;
    const hand = s.players[seat].hand;
    if (!Array.isArray(picks) || picks.length < 1 || picks.length > MAX_PLAY || mustCall(s)) return null;
    if (new Set(picks).size !== picks.length || picks.some((i) => !Number.isInteger(i) || i < 0 || i >= hand.length)) return null;
    const cards = picks.map((i) => hand[i]);
    const players = s.players.map((p, i) => (i === seat ? { ...p, hand: hand.filter((_, k) => !picks.includes(k)) } : p));
    const after = { ...s, players, last: { by: seat, cards }, pile: s.pile + cards.length, count: s.count + 1 };
    return { ...after, turn: responder(after, seat) };
  }

  if (move.type === 'call') {
    if (!s.last) return null;
    const accused = s.last.by;
    const lied = s.last.cards.some((c) => !isTrue(c, s.table));
    const shooter = lied ? accused : seat;
    const gun = s.players[shooter];
    const pull = gun.pulls + 1;
    const died = pull === gun.bullet;
    const players = s.players.map((p, i) => (i === shooter ? { ...p, pulls: pull, alive: !died } : p));
    const showdown: Showdown = { round: s.round, caller: seat, accused, cards: s.last.cards, table: s.table, lied, shooter, pull, died };
    let after: BluffState = { ...s, players, showdowns: [...s.showdowns, showdown], count: s.count + 1 };
    const standing = players.filter((p) => p.alive);
    if (standing.length === 1) return { ...after, winner: players.findIndex((p) => p.alive), last: null };
    // The one who pulled the trigger leads the next round, if they're still in.
    after = deal(after, s.round + 1, died ? nextAlive(after, shooter) : shooter);
    return after;
  }

  return null;
}

export function replay(seed: string, seats: readonly string[], moves: readonly Recorded[]): BluffState {
  let state = start(seed, seats.length);
  for (const m of moves) {
    const seat = seats.indexOf(m.by);
    if (seat >= 0) state = apply(state, m.move, seat) ?? state;
  }
  return state;
}

export const RANK_NAMES: Record<Rank, { one: string; many: string }> = {
  K: { one: 'king', many: 'kings' },
  Q: { one: 'queen', many: 'queens' },
  A: { one: 'ace', many: 'aces' },
};

/** "Two queens", as a claim is said out loud. */
export function claim(count: number, table: Rank): string {
  const words = ['', 'One', 'Two', 'Three'];
  return `${words[count] ?? count} ${count === 1 ? RANK_NAMES[table].one : RANK_NAMES[table].many}`;
}
