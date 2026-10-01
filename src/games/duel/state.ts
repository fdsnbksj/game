import { stream } from '../../nonogram/rng';
import { cardOf, wonderOf, type Science, type TokenId } from './cards';
import { payment, type Payment } from './pay';
import { coveredBy, LAYOUTS, setup, type Setup } from './setup';

// The game as a reducer: apply(state, move, by) gives the next state, or null when the
// move isn't allowed. replay() runs the room's moves from the seed, so both phones work
// out the same game from the same documents; a move the rules of the game refuse is
// skipped, so a tampered client can't push the other phone off course.

export type Player = 0 | 1;

export interface City {
  coins: number;
  /** Built cards, in order. */
  cards: string[];
  /** Wonders drafted: built, or still to build (`out` once seven are built in all). */
  wonders: { id: string; built: boolean; out: boolean }[];
  tokens: TokenId[];
}

/** A choice the game is waiting for, before play goes on. */
export type Pending =
  | { kind: 'token'; player: Player; options: TokenId[]; from: 'board' | 'box' }
  | { kind: 'destroy'; player: Player; color: 'brown' | 'grey' }
  | { kind: 'revive'; player: Player }
  | { kind: 'starter'; player: Player };

export interface Score {
  blue: number;
  green: number;
  yellow: number;
  guilds: number;
  wonders: number;
  tokens: number;
  military: number;
  coins: number;
  total: number;
}

export interface Outcome {
  /** null for a shared win. */
  winner: Player | null;
  how: 'military' | 'science' | 'points';
  scores: [Score, Score];
}

export interface DuelState {
  setup: Setup;
  seed: string;
  phase: 'draft' | 'play' | 'over';
  /** Wonder draft: which group, what's still offered, how many picks so far. */
  draft: { group: 0 | 1; offered: string[]; step: number };
  age: 1 | 2 | 3;
  /** Slots of the current age already taken. */
  taken: boolean[];
  turn: Player;
  pending: Pending[];
  /** The player gets another turn once the pending choices are made. */
  again: boolean;
  cities: [City, City];
  /** The conflict pawn: positive toward player 1's capital (player 0 ahead), up to ±9. */
  pawn: number;
  /** Coin-loss tokens still on each side of the track: [2-coin at 3, 5-coin at 6], lost by that player. */
  loot: [[boolean, boolean], [boolean, boolean]];
  boardTokens: TokenId[];
  boxTokens: TokenId[];
  discard: string[];
  lastTaker: Player;
  outcome: Outcome | null;
  /** Moves applied, for the Great Library's draw. */
  count: number;
  /** A line about the last thing that happened, for the screen. */
  log: string;
}

export type Move =
  | { type: 'pickWonder'; wonder: string }
  | { type: 'build'; slot: number }
  | { type: 'discard'; slot: number }
  | { type: 'wonder'; slot: number; wonder: string }
  | { type: 'token'; token: TokenId }
  | { type: 'destroy'; card: string }
  | { type: 'revive'; card: string }
  | { type: 'starter'; player: Player };

const other = (p: Player): Player => (p === 0 ? 1 : 0);

/** Who picks at each step of the draft: first 1-2-1 from the first four, then 2-1-2 from the rest. */
const draftOrder = (first: Player): Player[] => {
  const s = other(first);
  return [first, s, s, first, s, first, first, s];
};

export function start(seed: string): DuelState {
  const s = setup(seed);
  const city = (): City => ({ coins: 7, cards: [], wonders: [], tokens: [] });
  return {
    setup: s,
    seed,
    phase: 'draft',
    draft: { group: 0, offered: [...s.wonderGroups[0]], step: 0 },
    age: 1,
    taken: Array(20).fill(false),
    turn: s.first,
    pending: [],
    again: false,
    cities: [city(), city()],
    pawn: 0,
    loot: [
      [true, true],
      [true, true],
    ],
    boardTokens: [...s.boardTokens],
    boxTokens: [...s.boxTokens],
    discard: [],
    lastTaker: s.first,
    outcome: null,
    count: 0,
    log: '',
  };
}

/** Whose move the game is waiting for. */
export function actor(state: DuelState): Player | null {
  if (state.phase === 'over') return null;
  if (state.pending.length) return state.pending[0].player;
  if (state.phase === 'draft') return draftOrder(state.setup.first)[state.draft.step];
  return state.turn;
}

/** Cards of the current age that can be taken: not taken, and nothing overlapping them. */
export function accessible(state: DuelState): number[] {
  const layout = LAYOUTS[state.age];
  return layout.flatMap((_, i) => (!state.taken[i] && coveredBy(layout, i).every((j) => state.taken[j]) ? [i] : []));
}

/** Whether a slot's card can be seen: face up, or uncovered. */
export function visible(state: DuelState, i: number): boolean {
  return LAYOUTS[state.age][i].faceUp || state.taken[i] || accessible(state).includes(i);
}

export const builtWonders = (city: City) => city.wonders.filter((w) => w.built).map((w) => w.id);

const builder = (city: City) => ({ cards: city.cards, wonders: builtWonders(city) });

/** What building a card would cost `player` now: 0 through a chain, else the cheapest payment. */
export function cardCost(state: DuelState, player: Player, id: string): (Payment & { chained: boolean }) | null {
  const card = cardOf(id);
  const me = state.cities[player];
  if (card.chainFrom && me.cards.some((c) => cardOf(c).chainTo === card.chainFrom)) return { coins: 0, trade: 0, total: 0, chained: true };
  const discount = card.color === 'blue' && me.tokens.includes('stonecraft') ? 2 : 0;
  const pay = payment(builder(me), builder(state.cities[other(player)]), card.cost, me.coins, discount);
  return pay && { ...pay, chained: false };
}

export function wonderCost(state: DuelState, player: Player, id: string): Payment | null {
  const me = state.cities[player];
  const discount = me.tokens.includes('engineering') ? 2 : 0;
  return payment(builder(me), builder(state.cities[other(player)]), wonderOf(id).cost, me.coins, discount);
}

/** Coins for discarding a card: 2, plus 1 for each yellow card you have. */
export const discardValue = (city: City) => 2 + city.cards.filter((c) => cardOf(c).color === 'yellow').length;

const count = (city: City, colors: string[]) => city.cards.filter((c) => colors.includes(cardOf(c).color)).length;

function symbols(city: City): Science[] {
  const own = city.cards.flatMap((c) => (cardOf(c).science ? [cardOf(c).science!] : []));
  return city.tokens.includes('justice') ? [...own, 'law'] : own;
}

// ---------- Applying moves ----------

/** A copy deep enough to change: the reducer never touches the state it's given. */
function clone(s: DuelState): DuelState {
  return {
    ...s,
    draft: { ...s.draft, offered: [...s.draft.offered] },
    taken: [...s.taken],
    pending: [...s.pending],
    cities: s.cities.map((c) => ({ ...c, cards: [...c.cards], wonders: c.wonders.map((w) => ({ ...w })), tokens: [...c.tokens] })) as [City, City],
    loot: [[...s.loot[0]], [...s.loot[1]]] as DuelState['loot'],
    boardTokens: [...s.boardTokens],
    boxTokens: [...s.boxTokens],
    discard: [...s.discard],
  };
}

function lose(city: City, coins: number) {
  city.coins = Math.max(0, city.coins - coins);
}

/** Shields push the pawn toward the opponent, costing them coins as it passes the tokens. */
function shields(s: DuelState, by: Player, n: number) {
  if (n <= 0) return;
  s.pawn = Math.max(-9, Math.min(9, s.pawn + (by === 0 ? n : -n)));
  const victim = other(by);
  const reach = by === 0 ? s.pawn : -s.pawn;
  if (reach >= 3 && s.loot[victim][0]) {
    s.loot[victim][0] = false;
    lose(s.cities[victim], 2);
  }
  if (reach >= 6 && s.loot[victim][1]) {
    s.loot[victim][1] = false;
    lose(s.cities[victim], 5);
  }
  if (reach >= 9) s.outcome = { winner: by, how: 'military', scores: score(s) };
}

function checkScience(s: DuelState, by: Player) {
  if (!s.outcome && new Set(symbols(s.cities[by])).size >= 6) s.outcome = { winner: by, how: 'science', scores: score(s) };
}

/** A card enters `by`'s city: its effects, now. */
function gain(s: DuelState, by: Player, id: string, chained: boolean) {
  const card = cardOf(id);
  const me = s.cities[by];
  me.cards.push(id);
  if (card.coins) me.coins += card.coins;
  if (chained && me.tokens.includes('city-planning')) me.coins += 4;
  if (card.coinsPer) {
    const { what, each } = card.coinsPer;
    const n = what === 'wonder' ? builtWonders(me).length : count(me, [what]);
    me.coins += n * each;
  }
  if (card.guild) {
    const kinds: Record<string, string[]> = { yellow: ['yellow'], brownGrey: ['brown', 'grey'], blue: ['blue'], green: ['green'], red: ['red'] };
    const colors = kinds[card.guild];
    if (colors) me.coins += Math.max(count(s.cities[0], colors), count(s.cities[1], colors));
  }
  if (card.shields) shields(s, by, card.shields + (me.tokens.includes('tactics') ? 1 : 0));
  if (card.science) {
    const same = me.cards.filter((c) => cardOf(c).science === card.science).length;
    if (same === 2 && s.boardTokens.length) s.pending.push({ kind: 'token', player: by, options: [...s.boardTokens], from: 'board' });
    checkScience(s, by);
  }
}

function takeToken(s: DuelState, by: Player, token: TokenId) {
  const me = s.cities[by];
  me.tokens.push(token);
  if (token === 'farming' || token === 'city-planning') me.coins += 6;
  if (token === 'justice') checkScience(s, by);
}

/** After a move: wait for choices, or pass the turn, or end the age or the game. */
function advance(s: DuelState, by: Player) {
  if (s.outcome) {
    s.phase = 'over';
    s.pending = [];
    return;
  }
  if (s.pending.length) return;
  if (s.taken.every(Boolean)) {
    // A play-again earned with an age's last card is lost.
    s.again = false;
    if (s.age === 3) {
      s.outcome = finalOutcome(s);
      s.phase = 'over';
      return;
    }
    // The player behind on military chooses who starts the next age; if level, whoever took the last card.
    const chooser: Player = s.pawn > 0 ? 1 : s.pawn < 0 ? 0 : s.lastTaker;
    s.pending.push({ kind: 'starter', player: chooser });
    return;
  }
  s.turn = s.again ? by : other(by);
  s.again = false;
}

export function apply(state: DuelState, move: Move, by: Player): DuelState | null {
  if (actor(state) !== by) return null;
  const s = clone(state);
  s.count++;
  const me = s.cities[by];
  const them = s.cities[other(by)];
  const pending = s.pending[0];

  if (pending) {
    if (move.type === 'token' && pending.kind === 'token' && pending.options.includes(move.token)) {
      if (pending.from === 'board') s.boardTokens = s.boardTokens.filter((t) => t !== move.token);
      else s.boxTokens = s.boxTokens.filter((t) => t !== move.token);
      s.pending.shift();
      takeToken(s, by, move.token);
      s.log = `took the ${move.token} token`;
    } else if (move.type === 'destroy' && pending.kind === 'destroy' && them.cards.includes(move.card) && cardOf(move.card).color === pending.color) {
      them.cards = them.cards.filter((c) => c !== move.card);
      s.discard.push(move.card);
      s.pending.shift();
      s.log = `destroyed ${cardOf(move.card).name}`;
    } else if (move.type === 'revive' && pending.kind === 'revive' && s.discard.includes(move.card)) {
      s.discard = s.discard.filter((c) => c !== move.card);
      s.pending.shift();
      gain(s, by, move.card, false);
      s.log = `built ${cardOf(move.card).name} from the discards`;
    } else if (move.type === 'starter' && pending.kind === 'starter') {
      s.pending.shift();
      s.age = (s.age + 1) as 2 | 3;
      s.taken = Array(20).fill(false);
      s.turn = move.player;
      s.log = `chose who starts Age ${s.age}`;
      return s;
    } else return null;
    advance(s, by);
    return s;
  }

  if (s.phase === 'draft') {
    if (move.type !== 'pickWonder' || !s.draft.offered.includes(move.wonder)) return null;
    const pick = (player: Player, wonder: string) => {
      s.cities[player].wonders.push({ id: wonder, built: false, out: false });
      s.draft.offered = s.draft.offered.filter((w) => w !== wonder);
      s.draft.step++;
    };
    pick(by, move.wonder);
    // The last wonder of a group goes to whoever's turn it is, without asking.
    if (s.draft.offered.length === 1) pick(draftOrder(s.setup.first)[s.draft.step], s.draft.offered[0]);
    if (s.draft.offered.length === 0) {
      if (s.draft.group === 0) s.draft = { group: 1, offered: [...s.setup.wonderGroups[1]], step: s.draft.step };
      else {
        s.phase = 'play';
        s.turn = s.setup.first;
      }
    }
    s.log = `picked ${wonderOf(move.wonder).name}`;
    return s;
  }

  if (move.type !== 'build' && move.type !== 'discard' && move.type !== 'wonder') return null;
  if (!accessible(s).includes(move.slot)) return null;
  const id = s.setup.ages[s.age][move.slot];

  if (move.type === 'build') {
    if (me.cards.includes(id)) return null;
    const cost = cardCost(s, by, id);
    if (!cost) return null;
    me.coins -= cost.total;
    if (cost.trade && them.tokens.includes('commerce')) them.coins += cost.trade;
    s.taken[move.slot] = true;
    gain(s, by, id, cost.chained);
    s.log = `built ${cardOf(id).name}`;
  } else if (move.type === 'discard') {
    me.coins += discardValue(me);
    s.taken[move.slot] = true;
    s.discard.push(id);
    s.log = `discarded a card for ${discardValue(me)} coins`;
  } else {
    const slot = me.wonders.find((w) => w.id === move.wonder && !w.built && !w.out);
    if (!slot) return null;
    const cost = wonderCost(s, by, move.wonder);
    if (!cost) return null;
    me.coins -= cost.total;
    if (cost.trade && them.tokens.includes('commerce')) them.coins += cost.trade;
    s.taken[move.slot] = true;
    slot.built = true;
    const w = wonderOf(move.wonder);
    if (w.coins) me.coins += w.coins;
    if (w.opponentLoses) lose(them, w.opponentLoses);
    if (w.shields) shields(s, by, w.shields);
    if (w.destroy && them.cards.some((c) => cardOf(c).color === w.destroy)) s.pending.push({ kind: 'destroy', player: by, color: w.destroy });
    if (w.revive && s.discard.length) s.pending.push({ kind: 'revive', player: by });
    if (w.library && s.boxTokens.length) {
      const rng = stream(`duel:${s.seed}:library:${s.count}`);
      const pool = [...s.boxTokens];
      const options: TokenId[] = [];
      while (options.length < 3 && pool.length) options.push(pool.splice(rng(pool.length), 1)[0]);
      s.pending.push({ kind: 'token', player: by, options, from: 'box' });
    }
    if (w.playAgain || me.tokens.includes('devotion')) s.again = true;
    // Only seven wonders can be built: the eighth is out.
    if (s.cities[0].wonders.filter((x) => x.built).length + s.cities[1].wonders.filter((x) => x.built).length === 7) {
      for (const city of s.cities) for (const x of city.wonders) if (!x.built) x.out = true;
    }
    s.log = `built ${w.name}`;
  }
  s.lastTaker = by;
  advance(s, by);
  return s;
}

// ---------- Scoring ----------

export function score(s: DuelState): [Score, Score] {
  return [0, 1].map((p) => {
    const me = s.cities[p];
    const pts = (color: string) => me.cards.filter((c) => cardOf(c).color === color).reduce((sum, c) => sum + (cardOf(c).points ?? 0), 0);
    const most = (colors: string[]) => Math.max(count(s.cities[0], colors), count(s.cities[1], colors));
    let guilds = 0;
    for (const id of me.cards) {
      const g = cardOf(id).guild;
      if (!g) continue;
      if (g === 'wonders') guilds += 2 * Math.max(builtWonders(s.cities[0]).length, builtWonders(s.cities[1]).length);
      else if (g === 'coins') guilds += Math.floor(Math.max(s.cities[0].coins, s.cities[1].coins) / 3);
      else guilds += most({ yellow: ['yellow'], brownGrey: ['brown', 'grey'], blue: ['blue'], green: ['green'], red: ['red'] }[g]);
    }
    const tokens =
      (me.tokens.includes('farming') ? 4 : 0) + (me.tokens.includes('wisdom') ? 7 : 0) + (me.tokens.includes('geometry') ? 3 * me.tokens.length : 0);
    const lead = p === 0 ? s.pawn : -s.pawn;
    const military = lead >= 6 ? 10 : lead >= 3 ? 5 : lead >= 1 ? 2 : 0;
    const wonders = builtWonders(me).reduce((sum, w) => sum + wonderOf(w).points, 0);
    const parts = { blue: pts('blue'), green: pts('green'), yellow: pts('yellow'), guilds, wonders, tokens, military, coins: Math.floor(me.coins / 3) };
    return { ...parts, total: Object.values(parts).reduce((a, b) => a + b, 0) };
  }) as [Score, Score];
}

function finalOutcome(s: DuelState): Outcome {
  const scores = score(s);
  const [a, b] = scores;
  const winner: Player | null = a.total !== b.total ? (a.total > b.total ? 0 : 1) : a.blue !== b.blue ? (a.blue > b.blue ? 0 : 1) : null;
  return { winner, how: 'points', scores };
}

// ---------- Replaying a room ----------

export interface Recorded {
  by: string;
  move: Move;
}

/** The game so far, from the seed and every move written; moves the game refuses are skipped. */
export function replay(seed: string, players: readonly [string, string], moves: readonly Recorded[]): DuelState {
  let state = start(seed);
  for (const m of moves) {
    const by = players.indexOf(m.by);
    if (by < 0) continue;
    state = apply(state, m.move, by as Player) ?? state;
  }
  return state;
}

/** Every move `player` could make now: for tests and a simple opponent. */
export function legalMoves(state: DuelState): Move[] {
  const p = actor(state);
  if (p === null) return [];
  const pending = state.pending[0];
  if (pending) {
    if (pending.kind === 'token') return pending.options.map((token) => ({ type: 'token', token }));
    if (pending.kind === 'destroy')
      return state.cities[other(p)].cards.filter((c) => cardOf(c).color === pending.color).map((card) => ({ type: 'destroy', card }));
    if (pending.kind === 'revive') return state.discard.map((card) => ({ type: 'revive', card }));
    return [{ type: 'starter', player: 0 }, { type: 'starter', player: 1 }];
  }
  if (state.phase === 'draft') return state.draft.offered.map((wonder) => ({ type: 'pickWonder', wonder }));
  const moves: Move[] = [];
  const me = state.cities[p];
  for (const slot of accessible(state)) {
    const id = state.setup.ages[state.age][slot];
    if (!me.cards.includes(id) && cardCost(state, p, id)) moves.push({ type: 'build', slot });
    moves.push({ type: 'discard', slot });
    for (const w of me.wonders) if (!w.built && !w.out && wonderCost(state, p, w.id)) moves.push({ type: 'wonder', slot, wonder: w.id });
  }
  return moves;
}
