import { stream } from '../../nonogram/rng';
import { EDGES, HARBOUR_SLOTS, HEXES, otherEnd, VERTICES } from './board';
import { RESOURCES, setup, YIELD, type Dev, type Res, type Setup } from './setup';

// The game as a reducer. One player's turn at a time: roll, then build and trade, then end.
// Two things involve others: after a 7, everyone holding more than seven discards (in any
// order), and a trade offer, which anyone may accept. The dice and the robber's steal come
// from the seed, so every phone works out the same game, and replay() skips any move the
// rules refuse, so a tampered phone can't steer the others.

export type Hand = Record<Res, number>;

export interface Player {
  hand: Hand;
  /** Development cards held, point cards included. */
  devs: Dev[];
  /** Bought this turn: playable from the next. */
  fresh: Dev[];
  knights: number;
}

export interface Building {
  seat: number;
  city: boolean;
}

export interface Offer {
  give: Hand;
  get: Hand;
  declined: number[];
  /** When it was made (the move count): tells one offer from the next. */
  at: number;
}

export type Phase = 'setup' | 'roll' | 'discard' | 'robber' | 'main' | 'over';

export type Event =
  | { type: 'placed'; seat: number; vertex: number }
  | { type: 'rolled'; seat: number; dice: [number, number]; gains: Hand[] }
  | { type: 'built'; seat: number; what: 'road' | 'settlement' | 'city' }
  | { type: 'bought'; seat: number }
  | { type: 'played'; seat: number; card: Dev; res?: Res; took?: number }
  | { type: 'discarded'; seat: number; count: number }
  | { type: 'robbed'; seat: number; hex: number; victim: number | null; res: Res | null }
  | { type: 'traded'; seat: number; with: number | 'bank'; give: Hand; get: Hand }
  | { type: 'award'; what: 'longest' | 'largest'; seat: number | null }
  | { type: 'ended'; seat: number }
  | { type: 'won'; seat: number };

export type Move =
  | { type: 'place'; vertex: number; edge: number }
  | { type: 'roll' }
  | { type: 'discard'; cards: Hand }
  | { type: 'robber'; hex: number; victim: number | null }
  | { type: 'road'; edge: number }
  | { type: 'settlement'; vertex: number }
  | { type: 'city'; vertex: number }
  | { type: 'buy' }
  | { type: 'play'; card: 'knight' | 'roads' }
  | { type: 'play'; card: 'plenty'; take: [Res, Res] }
  | { type: 'play'; card: 'monopoly'; res: Res }
  | { type: 'bank'; give: Res; get: Res }
  | { type: 'offer'; give: Hand; get: Hand }
  | { type: 'cancel' }
  | { type: 'accept' }
  | { type: 'decline' }
  | { type: 'end' };

export interface IsleState {
  seed: string;
  n: number;
  setup: Setup;
  /** By vertex. */
  buildings: (Building | null)[];
  /** By edge: whose road. */
  roads: (number | null)[];
  robber: number;
  players: Player[];
  bank: Hand;
  /** Development cards still to draw, top first. */
  deck: Dev[];
  phase: Phase;
  current: number;
  /** Placements made in the opening round (2 per player, in snake order). */
  step: number;
  /** Turns played since the opening: names the dice of each. */
  turn: number;
  dice: [number, number] | null;
  /** By seat: cards still owed after a 7. */
  discarding: number[];
  /** Where play goes once the robber has moved: back to rolling (a knight played first) or on. */
  afterRobber: 'roll' | 'main';
  devPlayed: boolean;
  /** Roads still to place free from a Road building card. */
  freeRoads: number;
  offer: Offer | null;
  longest: number | null;
  largest: number | null;
  /** Moves applied: names the random steal of each. */
  count: number;
  log: Event[];
  winner: number | null;
}

export const COSTS = {
  road: { brick: 1, lumber: 1 },
  settlement: { brick: 1, lumber: 1, wool: 1, grain: 1 },
  city: { grain: 2, ore: 3 },
  dev: { wool: 1, grain: 1, ore: 1 },
} satisfies Record<string, Partial<Hand>>;

export const PIECES = { road: 15, settlement: 5, city: 4 };
export const TARGET = 10;

export const emptyHand = (): Hand => ({ brick: 0, lumber: 0, wool: 0, grain: 0, ore: 0 });
export const handSize = (h: Hand) => RESOURCES.reduce((sum, r) => sum + h[r], 0);
const full = (cost: Partial<Hand>): Hand => ({ ...emptyHand(), ...cost });
export const canAfford = (h: Hand, cost: Partial<Hand>) => RESOURCES.every((r) => h[r] >= (cost[r] ?? 0));

function move(from: Hand, to: Hand, what: Partial<Hand>) {
  for (const r of RESOURCES) {
    from[r] -= what[r] ?? 0;
    to[r] += what[r] ?? 0;
  }
}

/** A hand from a move as written to the database: five whole, non-negative counts. */
function readHand(x: unknown): Hand | null {
  if (typeof x !== 'object' || x === null) return null;
  const h = emptyHand();
  for (const r of RESOURCES) {
    const v = (x as Record<string, unknown>)[r] ?? 0;
    if (typeof v !== 'number' || !Number.isInteger(v) || v < 0 || v > 99) return null;
    h[r] = v;
  }
  return h;
}

const isIndex = (x: unknown, length: number): x is number => typeof x === 'number' && Number.isInteger(x) && x >= 0 && x < length;
const isRes = (x: unknown): x is Res => RESOURCES.includes(x as Res);

export function start(seed: string, n: number): IsleState {
  const deal = setup(seed);
  return {
    seed,
    n,
    setup: deal,
    buildings: VERTICES.map(() => null),
    roads: EDGES.map(() => null),
    robber: deal.terrain.indexOf('desert'),
    players: Array.from({ length: n }, () => ({ hand: emptyHand(), devs: [], fresh: [], knights: 0 })),
    bank: { brick: 19, lumber: 19, wool: 19, grain: 19, ore: 19 },
    deck: [...deal.deck],
    phase: 'setup',
    current: 0,
    step: 0,
    turn: 0,
    dice: null,
    discarding: Array(n).fill(0),
    afterRobber: 'main',
    devPlayed: false,
    freeRoads: 0,
    offer: null,
    longest: null,
    largest: null,
    count: 0,
    log: [],
    winner: null,
  };
}

// ---------- Where things can go ----------

const ownsAt = (s: IsleState, v: number, seat: number) => s.buildings[v]?.seat === seat;
/** Another player's building on this corner cuts a road through it. */
const blockedFor = (s: IsleState, v: number, seat: number) => s.buildings[v] !== null && s.buildings[v]!.seat !== seat;

/** A free corner with no building next to it. */
export const openCorner = (s: IsleState, v: number) => s.buildings[v] === null && VERTICES[v].neighbours.every((w) => s.buildings[w] === null);

export function canSettle(s: IsleState, seat: number, v: number): boolean {
  return openCorner(s, v) && VERTICES[v].edges.some((e) => s.roads[e] === seat);
}

export function canRoad(s: IsleState, seat: number, e: number): boolean {
  if (s.roads[e] !== null) return false;
  return [EDGES[e].a, EDGES[e].b].some((v) => ownsAt(s, v, seat) || (!blockedFor(s, v, seat) && VERTICES[v].edges.some((f) => f !== e && s.roads[f] === seat)));
}

export const piecesLeft = (s: IsleState, seat: number) => ({
  road: PIECES.road - s.roads.filter((r) => r === seat).length,
  settlement: PIECES.settlement - s.buildings.filter((b) => b?.seat === seat && !b.city).length,
  city: PIECES.city - s.buildings.filter((b) => b?.seat === seat && b.city).length,
});

export const settleSpots = (s: IsleState, seat: number) => VERTICES.flatMap((_, v) => (canSettle(s, seat, v) ? [v] : []));
export const roadSpots = (s: IsleState, seat: number) => EDGES.flatMap((_, e) => (canRoad(s, seat, e) ? [e] : []));
export const citySpots = (s: IsleState, seat: number) => s.buildings.flatMap((b, v) => (b?.seat === seat && !b.city ? [v] : []));
/** Opening round: any open corner, then a road from it. */
export const openingSpots = (s: IsleState) => VERTICES.flatMap((_, v) => (openCorner(s, v) ? [v] : []));

/** The best rate `seat` trades `res` to the bank at: 4, or 3 or 2 through a harbour. */
export function bankRate(s: IsleState, seat: number, res: Res): number {
  let rate = 4;
  HARBOUR_SLOTS.forEach((slot, i) => {
    const { a, b } = EDGES[slot.edge];
    if (!ownsAt(s, a, seat) && !ownsAt(s, b, seat)) return;
    const kind = s.setup.harbours[i];
    if (kind === res) rate = Math.min(rate, 2);
    else if (kind === 'any') rate = Math.min(rate, 3);
  });
  return rate;
}

/** Players `seat` could steal from with the robber on `hex`. */
export function victims(s: IsleState, seat: number, hex: number): number[] {
  const near = new Set(HEXES[hex].vertices.flatMap((v) => (s.buildings[v] ? [s.buildings[v]!.seat] : [])));
  return [...near].filter((p) => p !== seat && handSize(s.players[p].hand) > 0).sort((a, b) => a - b);
}

// ---------- Longest road and largest army ----------

/** The longest single run of `seat`'s roads, without reusing a road or passing another's building. */
export function roadLength(s: IsleState, seat: number): number {
  const used = new Set<number>();
  const walk = (v: number): number => {
    let best = 0;
    for (const e of VERTICES[v].edges) {
      if (s.roads[e] !== seat || used.has(e)) continue;
      used.add(e);
      const w = otherEnd(e, v);
      best = Math.max(best, 1 + (blockedFor(s, w, seat) ? 0 : walk(w)));
      used.delete(e);
    }
    return best;
  };
  let best = 0;
  VERTICES.forEach((_, v) => {
    if (VERTICES[v].edges.some((e) => s.roads[e] === seat)) best = Math.max(best, walk(v));
  });
  return best;
}

function award(s: IsleState, what: 'longest' | 'largest', holder: number | null) {
  if (holder === s[what]) return;
  s[what] = holder;
  s.log.push({ type: 'award', what, seat: holder });
}

/** Five roads or more claims it; it changes hands only to someone strictly longer, or goes when broken. */
function updateLongest(s: IsleState) {
  const lengths = s.players.map((_, seat) => roadLength(s, seat));
  const top = Math.max(...lengths);
  const holder = s.longest;
  if (holder !== null && lengths[holder] >= 5 && lengths[holder] === top) return;
  const leaders = lengths.flatMap((l, seat) => (l === top ? [seat] : []));
  award(s, 'longest', top >= 5 && leaders.length === 1 ? leaders[0] : null);
}

function updateLargest(s: IsleState, seat: number) {
  const knights = s.players[seat].knights;
  if (knights >= 3 && (s.largest === null || knights > s.players[s.largest].knights)) award(s, 'largest', seat);
}

// ---------- Points ----------

export interface Score {
  settlements: number;
  cities: number;
  longest: number;
  largest: number;
  cards: number;
  total: number;
}

export function score(s: IsleState, seat: number): Score {
  const mine = s.buildings.filter((b) => b?.seat === seat);
  const p = s.players[seat];
  const parts = {
    settlements: mine.filter((b) => !b!.city).length,
    cities: mine.filter((b) => b!.city).length * 2,
    longest: s.longest === seat ? 2 : 0,
    largest: s.largest === seat ? 2 : 0,
    cards: [...p.devs, ...p.fresh].filter((d) => d === 'point').length,
  };
  return { ...parts, total: Object.values(parts).reduce((a, b) => a + b, 0) };
}

/** What everyone can see: point cards stay hidden until the end. */
export const publicPoints = (s: IsleState, seat: number) => score(s, seat).total - score(s, seat).cards;

// ---------- Turns ----------

/** The opening order: everyone once, then back the other way. */
export const openingSeat = (s: { n: number }, step: number) => (step < s.n ? step : 2 * s.n - 1 - step);

/** Seats that may act now. */
export function waitingFor(s: IsleState): number[] {
  if (s.phase === 'over') return [];
  if (s.phase === 'discard') return s.discarding.flatMap((owed, seat) => (owed > 0 ? [seat] : []));
  if (s.phase === 'main' && s.offer) return [s.current, ...s.players.flatMap((_, seat) => (seat !== s.current && !s.offer!.declined.includes(seat) ? [seat] : []))];
  return [s.current];
}

function clone(s: IsleState): IsleState {
  return {
    ...s,
    buildings: [...s.buildings],
    roads: [...s.roads],
    players: s.players.map((p) => ({ ...p, hand: { ...p.hand }, devs: [...p.devs], fresh: [...p.fresh] })),
    bank: { ...s.bank },
    deck: [...s.deck],
    discarding: [...s.discarding],
    offer: s.offer && { ...s.offer, declined: [...s.offer.declined] },
    log: [...s.log],
  };
}

export function apply(state: IsleState, m: Move, seat: number): IsleState | null {
  if (typeof m !== 'object' || m === null || !waitingFor(state).includes(seat)) return null;
  const s = clone(state);
  const result = act(s, m, seat);
  if (!result) return null;
  s.count++;
  if (s.phase !== 'setup' && s.phase !== 'over' && score(s, s.current).total >= TARGET) {
    s.phase = 'over';
    s.winner = s.current;
    s.offer = null;
    s.log.push({ type: 'won', seat: s.current });
  }
  return s;
}

/** Applies a move to the copy; false if the rules refuse it. */
function act(s: IsleState, m: Move, seat: number): boolean {
  const me = s.players[seat];
  const mine = seat === s.current;

  // Moves anyone may make: trade answers and discards.
  if (m.type === 'accept' || m.type === 'decline') {
    if (mine || s.phase !== 'main' || !s.offer || s.offer.declined.includes(seat)) return false;
    if (m.type === 'decline') {
      s.offer.declined.push(seat);
      return true;
    }
    const { give, get } = s.offer;
    if (!canAfford(me.hand, get) || !canAfford(s.players[s.current].hand, give)) return false;
    move(s.players[s.current].hand, me.hand, give);
    move(me.hand, s.players[s.current].hand, get);
    s.log.push({ type: 'traded', seat: s.current, with: seat, give, get });
    s.offer = null;
    return true;
  }
  if (m.type === 'discard') {
    const cards = readHand(m.cards);
    if (s.phase !== 'discard' || !cards || handSize(cards) !== s.discarding[seat] || !canAfford(me.hand, cards)) return false;
    move(me.hand, s.bank, cards);
    s.discarding[seat] = 0;
    s.log.push({ type: 'discarded', seat, count: handSize(cards) });
    if (s.discarding.every((owed) => owed === 0)) s.phase = 'robber';
    return true;
  }
  if (!mine) return false;

  switch (m.type) {
    case 'place': {
      if (s.phase !== 'setup' || !isIndex(m.vertex, VERTICES.length) || !isIndex(m.edge, EDGES.length)) return false;
      if (!openCorner(s, m.vertex) || s.roads[m.edge] !== null || !VERTICES[m.vertex].edges.includes(m.edge)) return false;
      s.buildings[m.vertex] = { seat, city: false };
      s.roads[m.edge] = seat;
      s.log.push({ type: 'placed', seat, vertex: m.vertex });
      // The second settlement brings one of each land around it.
      if (s.step >= s.n) {
        for (const h of VERTICES[m.vertex].hexes) {
          const res = YIELD[s.setup.terrain[h]];
          if (res) move(s.bank, me.hand, { [res]: 1 });
        }
      }
      updateLongest(s);
      s.step++;
      if (s.step === 2 * s.n) {
        s.phase = 'roll';
        s.current = 0;
        s.turn = 1;
      } else s.current = openingSeat(s, s.step);
      return true;
    }

    case 'roll': {
      if (s.phase !== 'roll' || s.freeRoads) return false;
      const rng = stream(`isle:${s.seed}:roll:${s.turn}`);
      const dice: [number, number] = [rng(6) + 1, rng(6) + 1];
      s.dice = dice;
      const total = dice[0] + dice[1];
      const gains = s.players.map(() => emptyHand());
      if (total === 7) {
        s.discarding = s.players.map((p) => (handSize(p.hand) > 7 ? Math.floor(handSize(p.hand) / 2) : 0));
        s.phase = s.discarding.some((owed) => owed > 0) ? 'discard' : 'robber';
        s.afterRobber = 'main';
      } else {
        produce(s, total, gains);
        s.phase = 'main';
      }
      s.log.push({ type: 'rolled', seat, dice, gains });
      return true;
    }

    case 'robber': {
      if (s.phase !== 'robber' || !isIndex(m.hex, HEXES.length) || m.hex === s.robber) return false;
      const options = victims(s, seat, m.hex);
      if (options.length ? !options.includes(m.victim as number) : m.victim !== null) return false;
      s.robber = m.hex;
      let res: Res | null = null;
      if (m.victim !== null) {
        const theirs = s.players[m.victim].hand;
        const cards = RESOURCES.flatMap((r) => Array<Res>(theirs[r]).fill(r));
        res = cards[stream(`isle:${s.seed}:steal:${s.count}`)(cards.length)];
        move(theirs, me.hand, { [res]: 1 });
      }
      s.log.push({ type: 'robbed', seat, hex: m.hex, victim: m.victim, res });
      s.phase = s.afterRobber;
      return true;
    }

    case 'play': {
      if ((s.phase !== 'roll' && s.phase !== 'main') || s.devPlayed || s.freeRoads || !me.devs.includes(m.card) || (m.card as Dev) === 'point') return false;
      if (m.card === 'knight') {
        me.knights++;
        updateLargest(s, seat);
        s.afterRobber = s.phase;
        s.phase = 'robber';
        s.log.push({ type: 'played', seat, card: 'knight' });
      } else if (m.card === 'roads') {
        s.freeRoads = Math.min(2, piecesLeft(s, seat).road);
        if (!roadSpots(s, seat).length) s.freeRoads = 0;
        s.log.push({ type: 'played', seat, card: 'roads' });
      } else if (m.card === 'plenty') {
        if (!Array.isArray(m.take) || m.take.length !== 2 || !m.take.every(isRes)) return false;
        const want = emptyHand();
        for (const r of m.take) want[r]++;
        if (!canAfford(s.bank, want)) return false;
        move(s.bank, me.hand, want);
        s.log.push({ type: 'played', seat, card: 'plenty' });
      } else if (m.card === 'monopoly') {
        if (!isRes(m.res)) return false;
        let took = 0;
        s.players.forEach((p, other) => {
          if (other === seat) return;
          took += p.hand[m.res];
          me.hand[m.res] += p.hand[m.res];
          p.hand[m.res] = 0;
        });
        s.log.push({ type: 'played', seat, card: 'monopoly', res: m.res, took });
      } else return false;
      me.devs.splice(me.devs.indexOf(m.card), 1);
      s.devPlayed = true;
      return true;
    }

    case 'road': {
      const free = s.freeRoads > 0;
      if (!isIndex(m.edge, EDGES.length) || !canRoad(s, seat, m.edge) || piecesLeft(s, seat).road < 1) return false;
      if (free ? s.phase !== 'roll' && s.phase !== 'main' : s.phase !== 'main' || !canAfford(me.hand, COSTS.road)) return false;
      if (free) s.freeRoads--;
      else move(me.hand, s.bank, COSTS.road);
      s.roads[m.edge] = seat;
      s.log.push({ type: 'built', seat, what: 'road' });
      updateLongest(s);
      if (s.freeRoads && !roadSpots(s, seat).length) s.freeRoads = 0;
      return true;
    }
  }

  // The rest is the main part of a turn, after the roll, with no free roads to place.
  if (s.phase !== 'main' || s.freeRoads) return false;
  switch (m.type) {
    case 'settlement': {
      if (!isIndex(m.vertex, VERTICES.length) || !canSettle(s, seat, m.vertex) || piecesLeft(s, seat).settlement < 1 || !canAfford(me.hand, COSTS.settlement)) return false;
      move(me.hand, s.bank, COSTS.settlement);
      s.buildings[m.vertex] = { seat, city: false };
      s.log.push({ type: 'built', seat, what: 'settlement' });
      updateLongest(s);
      return true;
    }
    case 'city': {
      if (!isIndex(m.vertex, VERTICES.length) || !citySpots(s, seat).includes(m.vertex) || piecesLeft(s, seat).city < 1 || !canAfford(me.hand, COSTS.city)) return false;
      move(me.hand, s.bank, COSTS.city);
      s.buildings[m.vertex] = { seat, city: true };
      s.log.push({ type: 'built', seat, what: 'city' });
      return true;
    }
    case 'buy': {
      if (!s.deck.length || !canAfford(me.hand, COSTS.dev)) return false;
      move(me.hand, s.bank, COSTS.dev);
      me.fresh.push(s.deck.shift()!);
      s.log.push({ type: 'bought', seat });
      return true;
    }
    case 'bank': {
      if (!isRes(m.give) || !isRes(m.get) || m.give === m.get || s.bank[m.get] < 1) return false;
      const rate = bankRate(s, seat, m.give);
      if (me.hand[m.give] < rate) return false;
      move(me.hand, s.bank, { [m.give]: rate });
      move(s.bank, me.hand, { [m.get]: 1 });
      s.log.push({ type: 'traded', seat, with: 'bank', give: full({ [m.give]: rate }), get: full({ [m.get]: 1 }) });
      return true;
    }
    case 'offer': {
      const give = readHand(m.give);
      const get = readHand(m.get);
      if (!give || !get || !handSize(give) || !handSize(get) || RESOURCES.some((r) => give[r] && get[r]) || !canAfford(me.hand, give)) return false;
      s.offer = { give, get, declined: [], at: s.count };
      return true;
    }
    case 'cancel': {
      if (!s.offer) return false;
      s.offer = null;
      return true;
    }
    case 'end': {
      me.devs.push(...me.fresh);
      me.fresh = [];
      s.offer = null;
      s.devPlayed = false;
      s.dice = null;
      s.log.push({ type: 'ended', seat });
      s.current = (s.current + 1) % s.n;
      s.turn++;
      s.phase = 'roll';
      return true;
    }
  }
  return false;
}

/** Each land showing the roll pays its corners, unless the robber sits on it. If the bank
 *  runs short of a resource, only a lone taker gets what's left; otherwise nobody does. */
function produce(s: IsleState, total: number, gains: Hand[]) {
  const owed = s.players.map(() => emptyHand());
  HEXES.forEach((hex, h) => {
    const res = YIELD[s.setup.terrain[h]];
    if (!res || s.setup.numbers[h] !== total || h === s.robber) return;
    for (const v of hex.vertices) {
      const b = s.buildings[v];
      if (b) owed[b.seat][res] += b.city ? 2 : 1;
    }
  });
  for (const r of RESOURCES) {
    const takers = owed.flatMap((o, seat) => (o[r] > 0 ? [seat] : []));
    const demand = takers.reduce((sum, seat) => sum + owed[seat][r], 0);
    if (demand <= s.bank[r]) takers.forEach((seat) => (gains[seat][r] = owed[seat][r]));
    else if (takers.length === 1) gains[takers[0]][r] = s.bank[r];
  }
  gains.forEach((g, seat) => move(s.bank, s.players[seat].hand, g));
}

// ---------- Replaying a room, and choices ----------

export interface Recorded {
  by: string;
  move: Move;
}

export function replay(seed: string, seats: readonly string[], moves: readonly Recorded[]): IsleState {
  let state = start(seed, seats.length);
  for (const m of moves) {
    const seat = seats.indexOf(m.by);
    if (seat >= 0) state = apply(state, m.move, seat) ?? state;
  }
  return state;
}

/** Which development cards `seat` could play now. */
export function playable(s: IsleState, seat: number): Dev[] {
  if (seat !== s.current || (s.phase !== 'roll' && s.phase !== 'main') || s.devPlayed || s.freeRoads) return [];
  return [...new Set(s.players[seat].devs.filter((d) => d !== 'point'))];
}

/** A discard of `owed` cards taken from the biggest piles: a sensible default to start from. */
export function suggestDiscard(hand: Hand, owed: number): Hand {
  const left = { ...hand };
  const out = emptyHand();
  for (let i = 0; i < owed; i++) {
    const r = RESOURCES.reduce((a, b) => (left[b] > left[a] ? b : a));
    left[r]--;
    out[r]++;
  }
  return out;
}

/** Every move `seat` could make now (trade offers aside, which are open-ended). */
export function legalMoves(s: IsleState, seat: number): Move[] {
  if (!waitingFor(s).includes(seat)) return [];
  const moves: Move[] = [];
  const me = s.players[seat];
  if (s.phase === 'setup') {
    for (const vertex of openingSpots(s)) for (const edge of VERTICES[vertex].edges) if (s.roads[edge] === null) moves.push({ type: 'place', vertex, edge });
    return moves;
  }
  if (s.phase === 'discard') return [{ type: 'discard', cards: suggestDiscard(me.hand, s.discarding[seat]) }];
  if (s.phase === 'robber') {
    HEXES.forEach((_, hex) => {
      if (hex === s.robber) return;
      const options = victims(s, seat, hex);
      if (options.length) options.forEach((victim) => moves.push({ type: 'robber', hex, victim }));
      else moves.push({ type: 'robber', hex, victim: null });
    });
    return moves;
  }
  if (seat !== s.current) {
    const offer = s.offer!;
    if (canAfford(me.hand, offer.get) && canAfford(s.players[s.current].hand, offer.give)) moves.push({ type: 'accept' });
    return [...moves, { type: 'decline' }];
  }
  if (s.freeRoads) return roadSpots(s, seat).map((edge) => ({ type: 'road', edge }));
  for (const card of playable(s, seat)) {
    if (card === 'knight' || card === 'roads') moves.push({ type: 'play', card });
    if (card === 'monopoly') for (const res of RESOURCES) moves.push({ type: 'play', card, res });
    if (card === 'plenty')
      RESOURCES.forEach((a, i) =>
        RESOURCES.slice(i).forEach((b) => {
          const want = full({ [a]: 1 });
          want[b]++;
          if (canAfford(s.bank, want)) moves.push({ type: 'play', card, take: [a, b] });
        }),
      );
  }
  if (s.phase === 'roll') return [{ type: 'roll' }, ...moves];
  const left = piecesLeft(s, seat);
  if (left.road && canAfford(me.hand, COSTS.road)) for (const edge of roadSpots(s, seat)) moves.push({ type: 'road', edge });
  if (left.settlement && canAfford(me.hand, COSTS.settlement)) for (const vertex of settleSpots(s, seat)) moves.push({ type: 'settlement', vertex });
  if (left.city && canAfford(me.hand, COSTS.city)) for (const vertex of citySpots(s, seat)) moves.push({ type: 'city', vertex });
  if (s.deck.length && canAfford(me.hand, COSTS.dev)) moves.push({ type: 'buy' });
  for (const give of RESOURCES)
    if (me.hand[give] >= bankRate(s, seat, give)) for (const get of RESOURCES) if (get !== give && s.bank[get]) moves.push({ type: 'bank', give, get });
  if (s.offer) moves.push({ type: 'cancel' });
  moves.push({ type: 'end' });
  return moves;
}
