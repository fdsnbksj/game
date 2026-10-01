import { boardOf, cardOf, RAW, RESOURCES, type Card, type Counting, type Res, type Science, type Stage } from './cards';
import { emptySupply, payment, type Payment, type Supply } from './pay';
import { baseId, setup, type Setup, type SideChoice } from './setup';

// The game as a reducer. Everyone picks at the same time: a pick is kept hidden in the state
// until every seat that should pick has, then the turn resolves for all at once (as if the
// cards were revealed together), and the hands pass on. replay() runs a room's moves from
// the seed, skipping any the rules refuse, so every phone works out the same game.

export interface City {
  board: string;
  side: 'A' | 'B';
  /** Wonder stages built so far. */
  stages: number;
  /** Built cards, by card id (a city never has two of the same). */
  cards: string[];
  coins: number;
  /** Military: points won (1, 3 or 5 each) and defeats (−1 each). */
  victories: number[];
  defeats: number;
  /** The age in which the once-an-age free build was used. */
  freeUsed: number | null;
}

export interface Pick {
  card: string;
  as: 'build' | 'wonder' | 'discard';
  /** Built for free (the Olympia ability), or through a chain. */
  free?: boolean;
  pay?: Payment;
}

export type Move =
  | { type: 'pick'; age: number; turn: number; card: string; as: Pick['as']; free?: boolean }
  /** Halicarnassus: build a card from the discards (null: none wanted). */
  | { type: 'revive'; card: string | null };

export interface Score {
  military: number;
  coins: number;
  wonder: number;
  blue: number;
  yellow: number;
  purple: number;
  green: number;
  total: number;
}

export interface WondersState {
  seed: string;
  setup: Setup;
  n: number;
  age: 1 | 2 | 3;
  /** 1 to 6, or 7 for the seventh card some cities may play. */
  turn: number;
  hands: string[][];
  picks: (Pick | null)[];
  /** Seats that must still choose a card from the discards before play goes on. */
  reviving: number[];
  discard: string[];
  cities: City[];
  phase: 'play' | 'over';
  /** What happened at the last resolution, for the screen. */
  last: { picks: (Pick | null)[]; military?: { seat: number; vsLeft: number; vsRight: number }[] } | null;
  outcome: { scores: Score[]; winners: number[] } | null;
}

export const leftOf = (s: { n: number }, seat: number) => (seat + 1) % s.n;
export const rightOf = (s: { n: number }, seat: number) => (seat - 1 + s.n) % s.n;

export function start(seed: string, n: number, sides: SideChoice): WondersState {
  const deal = setup(seed, n, sides);
  return {
    seed,
    setup: deal,
    n,
    age: 1,
    turn: 1,
    hands: deal.hands[1].map((h) => [...h]),
    picks: Array(n).fill(null),
    reviving: [],
    discard: [],
    cities: deal.boards.map((b) => ({ board: b.id, side: b.side, stages: 0, cards: [], coins: 3, victories: [], defeats: 0, freeUsed: null })),
    phase: 'play',
    last: null,
    outcome: null,
  };
}

// ---------- What a city has ----------

export const stagesOf = (city: City): Stage[] => boardOf(city.board).sides[city.side];
const built = (city: City) => stagesOf(city).slice(0, city.stages);
const has = (city: City, test: (s: Stage) => boolean | undefined) => built(city).some((s) => !!test(s));

/** What a city can use itself: everything it makes, its choice cards and wonder choices. */
export function ownSupply(city: City): Supply {
  const supply = emptySupply();
  supply.fixed[boardOf(city.board).starts]++;
  for (const id of city.cards) {
    const card = cardOf(id);
    if (card.produces) for (const [res, n] of Object.entries(card.produces) as [Res, number][]) supply.fixed[res] += n;
    if (card.choice) supply.choices.push(card.choice);
  }
  for (const stage of built(city)) if (stage.choice) supply.choices.push(stage.choice);
  return supply;
}

/** What a city sells to its neighbours: its board's resource and brown and grey cards only. */
export function saleSupply(city: City): Supply {
  const supply = emptySupply();
  supply.fixed[boardOf(city.board).starts]++;
  for (const id of city.cards) {
    const card = cardOf(id);
    if (card.color !== 'brown' && card.color !== 'grey') continue;
    if (card.produces) for (const [res, n] of Object.entries(card.produces) as [Res, number][]) supply.fixed[res] += n;
    if (card.choice) supply.choices.push(card.choice);
  }
  return supply;
}

/** Each resource's price from each neighbour: 2, or 1 with a matching discount. */
export function prices(city: City) {
  const price = (side: 'left' | 'right') =>
    Object.fromEntries(
      RESOURCES.map((res) => {
        const cheap =
          city.cards.some((id) => {
            const d = cardOf(id).discount;
            return d && (d.side === side || d.side === 'both') && d.res.includes(res);
          }) ||
          (RAW.includes(res) && has(city, (s) => s.rawDiscount));
        return [res, cheap ? 1 : 2];
      }),
    ) as Record<Res, number>;
  return { left: price('left'), right: price('right') };
}

const payFor = (s: WondersState, seat: number, cost: Card['cost']) =>
  payment(
    ownSupply(s.cities[seat]),
    saleSupply(s.cities[leftOf(s, seat)]),
    saleSupply(s.cities[rightOf(s, seat)]),
    prices(s.cities[seat]),
    cost,
    s.cities[seat].coins,
  );

/** How `seat` could build a card: free through a chain, or the cheapest payment; null if not at all. */
export function buildCost(s: WondersState, seat: number, id: string): (Payment & { chained: boolean }) | null {
  const city = s.cities[seat];
  const card = cardOf(id);
  if (city.cards.includes(card.id)) return null;
  if (card.chainFrom?.some((from) => city.cards.includes(from))) return { coins: 0, left: 0, right: 0, total: 0, chained: true };
  const pay = payFor(s, seat, card.cost);
  return pay && { ...pay, chained: false };
}

export function stageCost(s: WondersState, seat: number): Payment | null {
  const city = s.cities[seat];
  const next = stagesOf(city)[city.stages];
  return next ? payFor(s, seat, next.cost) : null;
}

/** Whether the once-an-age free build is available to `seat` now. */
export const canBuildFree = (s: WondersState, seat: number) => has(s.cities[seat], (st) => st.freeBuildPerAge) && s.cities[seat].freeUsed !== s.age;

// ---------- Turns ----------

/** Seats that still have to pick this turn. */
export function waitingFor(s: WondersState): number[] {
  if (s.phase === 'over') return [];
  if (s.reviving.length) return [s.reviving[0]];
  return s.picks.flatMap((p, seat) => (p === null && pickers(s).includes(seat) ? [seat] : []));
}

/** Who picks this turn: everyone, or on the seventh card only those who can play it. */
function pickers(s: WondersState): number[] {
  return s.cities.flatMap((city, seat) => (s.turn < 7 || (has(city, (st) => st.playSeventh) && s.hands[seat].length) ? [seat] : []));
}

function clone(s: WondersState): WondersState {
  return {
    ...s,
    hands: s.hands.map((h) => [...h]),
    picks: [...s.picks],
    reviving: [...s.reviving],
    discard: [...s.discard],
    cities: s.cities.map((c) => ({ ...c, cards: [...c.cards], victories: [...c.victories] })),
  };
}

export function apply(state: WondersState, move: Move, seat: number): WondersState | null {
  if (!waitingFor(state).includes(seat)) return null;
  const s = clone(state);

  if (move.type === 'revive') {
    if (!s.reviving.length) return null;
    if (move.card !== null) {
      if (!s.discard.includes(move.card) || s.cities[seat].cards.includes(baseId(move.card))) return null;
      s.discard = s.discard.filter((c) => c !== move.card);
      place(s, seat, baseId(move.card));
      earn(s, seat, baseId(move.card));
    } else if (reviveOptions(state, seat).length) return null;
    s.reviving.shift();
    if (!s.reviving.length) advance(s);
    return s;
  }

  if (s.reviving.length || move.age !== s.age || move.turn !== s.turn || !s.hands[seat].includes(move.card)) return null;
  const id = baseId(move.card);
  let pick: Pick;
  if (move.as === 'discard') pick = { card: move.card, as: 'discard' };
  else if (move.as === 'wonder') {
    const pay = stageCost(s, seat);
    if (!pay) return null;
    pick = { card: move.card, as: 'wonder', pay };
  } else if (move.free) {
    if (!canBuildFree(s, seat) || s.cities[seat].cards.includes(id)) return null;
    pick = { card: move.card, as: 'build', free: true };
  } else {
    const pay = buildCost(s, seat, id);
    if (!pay) return null;
    pick = { card: move.card, as: 'build', pay, free: pay.chained };
  }
  s.picks[seat] = pick;
  if (waitingFor(s).length === 0) resolve(s);
  return s;
}

/** A card enters a city. (Its coins come in `earn`, once every card of the turn is down.) */
function place(s: WondersState, seat: number, id: string) {
  s.cities[seat].cards.push(id);
}

/** Coins a card brings when built, counting the cities as they are now. */
function earn(s: WondersState, seat: number, id: string) {
  const card = cardOf(id);
  const city = s.cities[seat];
  if (card.coins) city.coins += card.coins;
  if (card.coinsPer) city.coins += card.coinsPer.each * counted(s, seat, card.coinsPer);
}

/** Everyone's picks take effect together. */
function resolve(s: WondersState) {
  const picks = s.picks;
  const builtNow: [number, string][] = [];
  const reviveNow: number[] = [];
  const paidTo = s.cities.map(() => 0);
  picks.forEach((pick, seat) => {
    if (!pick) return;
    const city = s.cities[seat];
    s.hands[seat] = s.hands[seat].filter((c) => c !== pick.card);
    if (pick.as === 'discard') {
      city.coins += 3;
      s.discard.push(pick.card);
      return;
    }
    if (pick.pay) {
      city.coins -= pick.pay.total;
      paidTo[leftOf(s, seat)] += pick.pay.left;
      paidTo[rightOf(s, seat)] += pick.pay.right;
    }
    if (pick.as === 'wonder') {
      const stage = stagesOf(city)[city.stages];
      city.stages++;
      if (stage.coins) city.coins += stage.coins;
      if (stage.reviveDiscard) reviveNow.push(seat);
      return;
    }
    if (pick.free && !pick.pay?.total && canBuildFree(s, seat) && !buildCostWasChain(s, seat, pick)) city.freeUsed = s.age;
    place(s, seat, baseId(pick.card));
    builtNow.push([seat, baseId(pick.card)]);
  });
  // Coins from trade arrive at the end of the turn; card coins count every card now built.
  paidTo.forEach((coins, seat) => (s.cities[seat].coins += coins));
  for (const [seat, id] of builtNow) earn(s, seat, id);
  s.last = { picks };
  s.picks = Array(s.n).fill(null);
  s.reviving = reviveNow.filter((seat) => reviveOptions(s, seat).length > 0);
  if (!s.reviving.length) advance(s);
}

/** Whether a free pick was free through a chain (which doesn't use up the once-an-age build). */
function buildCostWasChain(s: WondersState, seat: number, pick: Pick) {
  const card = cardOf(baseId(pick.card));
  return !!card.chainFrom?.some((from) => s.cities[seat].cards.includes(from));
}

/** Cards in the discards `seat` could build: any they don't already have. */
export const reviveOptions = (s: WondersState, seat: number) => s.discard.filter((c) => !s.cities[seat].cards.includes(baseId(c)));

/** After a turn: pass the hands on, or finish the age with its battles. */
function advance(s: WondersState) {
  if (s.turn < 6) {
    // Ages I and III pass to the left, Age II to the right.
    const passed: string[][] = Array.from({ length: s.n }, () => []);
    s.hands.forEach((hand, seat) => (passed[s.age === 2 ? rightOf(s, seat) : leftOf(s, seat)] = hand));
    s.hands = passed;
    s.turn++;
    return;
  }
  if (s.turn === 6) {
    // The last card is discarded, unless a city can play its seventh.
    const seventh = s.cities.flatMap((city, seat) => (has(city, (st) => st.playSeventh) && s.hands[seat].length ? [seat] : []));
    s.hands.forEach((hand, seat) => {
      if (!seventh.includes(seat)) {
        s.discard.push(...hand);
        s.hands[seat] = [];
      }
    });
    if (seventh.length) {
      s.turn = 7;
      return;
    }
  }
  // Age over: anything left is discarded, then each city fights both neighbours.
  s.hands.forEach((hand) => s.discard.push(...hand));
  battle(s);
  if (s.age === 3) {
    const scores = s.cities.map((_, seat) => score(s, seat));
    const best = Math.max(...scores.map((x) => x.total));
    const top = scores.flatMap((x, seat) => (x.total === best ? [seat] : []));
    const richest = Math.max(...top.map((seat) => s.cities[seat].coins));
    s.outcome = { scores, winners: top.filter((seat) => s.cities[seat].coins === richest) };
    s.phase = 'over';
    return;
  }
  s.age = (s.age + 1) as 2 | 3;
  s.turn = 1;
  s.hands = s.setup.hands[s.age].map((h) => [...h]);
}

export const shieldsOf = (city: City) =>
  city.cards.reduce((sum, id) => sum + (cardOf(id).shields ?? 0), 0) + built(city).reduce((sum, st) => sum + (st.shields ?? 0), 0);

function battle(s: WondersState) {
  const win = [1, 3, 5][s.age - 1];
  const results = s.cities.map((city, seat) => {
    const mine = shieldsOf(city);
    const fight = (other: number) => {
      const theirs = shieldsOf(s.cities[other]);
      if (mine > theirs) city.victories.push(win);
      else if (mine < theirs) city.defeats++;
      return Math.sign(mine - theirs);
    };
    return { seat, vsLeft: fight(leftOf(s, seat)), vsRight: fight(rightOf(s, seat)) };
  });
  s.last = { ...(s.last ?? { picks: [] }), military: results };
}

// ---------- Scoring ----------

function counted(s: WondersState, seat: number, what: Counting): number {
  const cities =
    what.where === 'own' ? [seat] : what.where === 'neighbours' ? [leftOf(s, seat), rightOf(s, seat)] : [seat, leftOf(s, seat), rightOf(s, seat)];
  return cities.reduce((sum, i) => {
    const city = s.cities[i];
    if (what.what === 'wonderStage') return sum + city.stages;
    if (what.what === 'defeat') return sum + city.defeats;
    if (what.what === 'brownGreyPurple') return sum + city.cards.filter((id) => ['brown', 'grey', 'purple'].includes(cardOf(id).color)).length;
    return sum + city.cards.filter((id) => cardOf(id).color === what.what).length;
  }, 0);
}

/** Science: each kind counts squared, plus 7 per full set; wildcards go wherever they score most. */
export function sciencePoints(symbols: Science[], wild: number): number {
  const base = { compass: 0, gear: 0, tablet: 0 };
  for (const sym of symbols) base[sym]++;
  let best = 0;
  const kinds: Science[] = ['compass', 'gear', 'tablet'];
  const tryWild = (left: number, counts: Record<Science, number>) => {
    if (left === 0) {
      const v = kinds.reduce((sum, k) => sum + counts[k] ** 2, 0) + 7 * Math.min(...kinds.map((k) => counts[k]));
      best = Math.max(best, v);
      return;
    }
    for (const k of kinds) tryWild(left - 1, { ...counts, [k]: counts[k] + 1 });
  };
  tryWild(wild, base);
  return best;
}

export function score(s: WondersState, seat: number): Score {
  const city = s.cities[seat];
  const cards = city.cards.map(cardOf);
  const military = city.victories.reduce((a, b) => a + b, 0) - city.defeats;
  const wonder = built(city).reduce((sum, st) => sum + (st.points ?? 0), 0);
  const blue = cards.filter((c) => c.color === 'blue').reduce((sum, c) => sum + (c.points ?? 0), 0);
  const yellow = cards.filter((c) => c.color === 'yellow' && c.pointsPer).reduce((sum, c) => sum + c.pointsPer!.each * counted(s, seat, c.pointsPer!), 0);
  const guildValue = (g: Card) => (g.pointsPer ? g.pointsPer.each * counted(s, seat, g.pointsPer) : 0);
  const guilds = cards.filter((c) => c.color === 'purple');
  // Olympia: copy the neighbour's guild worth most here (scholars' included, through science).
  const copyable = has(city, (st) => st.copyGuild)
    ? [leftOf(s, seat), rightOf(s, seat)].flatMap((i) => s.cities[i].cards.map(cardOf).filter((c) => c.color === 'purple' && !city.cards.includes(c.id)))
    : [];
  const symbols = cards.flatMap((c) => (c.science ? [c.science] : []));
  const wild = guilds.filter((g) => g.scienceWild).length + built(city).filter((st) => st.scienceWild).length;
  const green = (extraWild: number) => sciencePoints(symbols, wild + extraWild);
  let purple = guilds.reduce((sum, g) => sum + guildValue(g), 0);
  let greenPts = green(0);
  if (copyable.length) {
    const options = copyable.map((g) => (g.scienceWild ? { purple: 0, green: green(1) - greenPts } : { purple: guildValue(g), green: 0 }));
    const bestCopy = options.reduce((a, b) => (a.purple + a.green >= b.purple + b.green ? a : b));
    purple += bestCopy.purple;
    greenPts += bestCopy.green;
  }
  const parts = { military, coins: Math.floor(city.coins / 3), wonder, blue, yellow, purple, green: greenPts };
  return { ...parts, total: Object.values(parts).reduce((a, b) => a + b, 0) };
}

// ---------- Replaying a room, and choices ----------

export interface Recorded {
  by: string;
  move: Move;
}

export function replay(seed: string, seats: readonly string[], sides: SideChoice, moves: readonly Recorded[]): WondersState {
  let state = start(seed, seats.length, sides);
  for (const m of moves) {
    const seat = seats.indexOf(m.by);
    if (seat >= 0) state = apply(state, m.move, seat) ?? state;
  }
  return state;
}

/** Every move `seat` could make now. */
export function legalMoves(s: WondersState, seat: number): Move[] {
  if (!waitingFor(s).includes(seat)) return [];
  if (s.reviving.length) {
    const options = reviveOptions(s, seat);
    return options.length ? options.map((card) => ({ type: 'revive', card })) : [{ type: 'revive', card: null }];
  }
  const moves: Move[] = [];
  const at = { age: s.age, turn: s.turn };
  const stageOk = !!stageCost(s, seat);
  for (const card of s.hands[seat]) {
    if (buildCost(s, seat, baseId(card))) moves.push({ type: 'pick', ...at, card, as: 'build' });
    else if (canBuildFree(s, seat) && !s.cities[seat].cards.includes(baseId(card))) moves.push({ type: 'pick', ...at, card, as: 'build', free: true });
    if (stageOk) moves.push({ type: 'pick', ...at, card, as: 'wonder' });
    moves.push({ type: 'pick', ...at, card, as: 'discard' });
  }
  return moves;
}
