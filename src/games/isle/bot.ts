import { stream } from '../../nonogram/rng';
import { HEXES, otherEnd, VERTICES } from './board';
import { pips, RESOURCES, YIELD, type Res } from './setup';
import {
  bankRate,
  canAfford,
  citySpots,
  COSTS,
  handSize,
  openCorner,
  openingSpots,
  piecesLeft,
  playable,
  publicPoints,
  roadSpots,
  settleSpots,
  suggestDiscard,
  victims,
  waitingFor,
  type Hand,
  type IsleState,
  type Move,
} from './state';

// A simple, steady player for empty seats. It settles on good numbers, builds cities, then
// settlements, then roads toward the next good corner, buys development cards when it can't
// expand, and trades with the bank for what it's missing. It turns down every player trade.
// Ties break on the room's seed, so every phone agrees on its choice.

/** What resources `seat` already gets from its buildings. */
function produced(s: IsleState, seat: number): Set<Res> {
  const out = new Set<Res>();
  s.buildings.forEach((b, v) => {
    if (b?.seat !== seat) return;
    for (const h of VERTICES[v].hexes) {
      const res = YIELD[s.setup.terrain[h]];
      if (res) out.add(res);
    }
  });
  return out;
}

/** How good a corner is for `seat`: the dots of its numbers, more for resources it lacks. */
function cornerValue(s: IsleState, seat: number, v: number): number {
  const have = produced(s, seat);
  let value = 0;
  const kinds = new Set<Res>();
  for (const h of VERTICES[v].hexes) {
    const res = YIELD[s.setup.terrain[h]];
    if (!res) continue;
    const dots = h === s.robber ? pips(s.setup.numbers[h]) / 2 : pips(s.setup.numbers[h]);
    value += dots;
    if (!have.has(res) && !kinds.has(res)) value += 1.5;
    kinds.add(res);
  }
  return value;
}

const best = <T>(items: T[], value: (x: T) => number, rng: (n: number) => number): T | undefined =>
  items.map((x) => ({ x, v: value(x) + rng(1000) / 100000 })).sort((a, b) => b.v - a.v)[0]?.x;

/** The first road toward the best open corner the network can reach, if any. */
function roadToward(s: IsleState, seat: number): number | null {
  const blocked = (v: number) => s.buildings[v] !== null && s.buildings[v]!.seat !== seat;
  const first = new Map<number, number | null>();
  const dist = new Map<number, number>();
  const queue: number[] = [];
  VERTICES.forEach((vertex, v) => {
    if (blocked(v)) return;
    if (s.buildings[v]?.seat === seat || vertex.edges.some((e) => s.roads[e] === seat)) {
      first.set(v, null);
      dist.set(v, 0);
      queue.push(v);
    }
  });
  let target: { edge: number; value: number } | null = null;
  while (queue.length) {
    const v = queue.shift()!;
    for (const e of VERTICES[v].edges) {
      if (s.roads[e] !== null) continue;
      const w = otherEnd(e, v);
      if (dist.has(w)) continue;
      dist.set(w, dist.get(v)! + 1);
      first.set(w, first.get(v) ?? e);
      if (openCorner(s, w)) {
        const value = cornerValue(s, seat, w) / dist.get(w)!;
        if (!target || value > target.value) target = { edge: first.get(w)!, value };
      }
      if (!blocked(w) && dist.get(w)! < 4) queue.push(w);
    }
  }
  return target?.edge ?? null;
}

type Goal = 'city' | 'settlement' | 'road' | 'dev';

function goalOf(s: IsleState, seat: number): Goal {
  const left = piecesLeft(s, seat);
  if (left.city && citySpots(s, seat).length) return 'city';
  if (left.settlement && settleSpots(s, seat).length) return 'settlement';
  if (left.road && roadToward(s, seat) !== null) return 'road';
  return 'dev';
}

/** The bot's move for `seat` now, or null if it has nothing to do. */
export function botMove(s: IsleState, seat: number): Move | null {
  if (!waitingFor(s).includes(seat)) return null;
  const rng = stream(`isle:${s.seed}:bot:${seat}:${s.count}`);
  const me = s.players[seat];

  if (s.phase === 'setup') {
    const vertex = best(openingSpots(s), (v) => cornerValue(s, seat, v), rng)!;
    const edges = VERTICES[vertex].edges.filter((e) => s.roads[e] === null);
    const edge = best(edges, (e) => Math.max(0, ...VERTICES[otherEnd(e, vertex)].neighbours.filter((w) => w !== vertex && openCorner(s, w)).map((w) => cornerValue(s, seat, w))), rng)!;
    return { type: 'place', vertex, edge };
  }
  if (s.phase === 'discard') return { type: 'discard', cards: discardFor(s, seat) };
  if (seat !== s.current) return { type: 'decline' };
  if (s.phase === 'robber') return robberMove(s, seat, rng);
  if (s.freeRoads) {
    const edge = roadToward(s, seat);
    return { type: 'road', edge: edge ?? roadSpots(s, seat)[0] };
  }

  const cards = playable(s, seat);
  if (s.phase === 'roll') {
    const robbed = HEXES[s.robber].vertices.some((v) => s.buildings[v]?.seat === seat);
    if (robbed && cards.includes('knight')) return { type: 'play', card: 'knight' };
    return { type: 'roll' };
  }

  const left = piecesLeft(s, seat);
  const can = (cost: Partial<Hand>) => canAfford(me.hand, cost);
  const cities = citySpots(s, seat);
  if (left.city && cities.length && can(COSTS.city)) return { type: 'city', vertex: best(cities, (v) => cornerValue(s, seat, v), rng)! };
  const spots = settleSpots(s, seat);
  if (left.settlement && spots.length && can(COSTS.settlement)) return { type: 'settlement', vertex: best(spots, (v) => cornerValue(s, seat, v), rng)! };

  const goal = goalOf(s, seat);
  if (goal === 'road' && cards.includes('roads')) return { type: 'play', card: 'roads' };
  if (goal === 'road' && can(COSTS.road)) return { type: 'road', edge: roadToward(s, seat)! };
  if (goal === 'dev' && s.deck.length && can(COSTS.dev)) return { type: 'buy' };

  const need = COSTS[goal === 'road' ? 'road' : goal];
  const missing = RESOURCES.filter((r) => me.hand[r] < (need[r as keyof typeof need] ?? 0));
  if (cards.includes('plenty') && missing.length) {
    const take: [Res, Res] = [missing[0], missing[1] ?? missing[0]];
    if (s.bank[take[0]] && s.bank[take[1]] && (take[0] !== take[1] || s.bank[take[0]] > 1)) return { type: 'play', card: 'plenty', take };
  }
  if (cards.includes('monopoly')) {
    const res = best(RESOURCES, (r) => s.players.reduce((sum, p, i) => sum + (i === seat ? 0 : p.hand[r]), 0), rng)!;
    if (s.players.reduce((sum, p, i) => sum + (i === seat ? 0 : p.hand[res]), 0) >= 3) return { type: 'play', card: 'monopoly', res };
  }
  // Trade spare cards (beyond what the goal needs) to the bank for a missing one.
  for (const get of missing) {
    if (!s.bank[get]) continue;
    const give = RESOURCES.find((r) => r !== get && me.hand[r] - (need[r as keyof typeof need] ?? 0) >= bankRate(s, seat, r));
    if (give) return { type: 'bank', give, get };
  }
  return { type: 'end' };
}

/** Keeps what the next build needs; gives up the biggest piles of the rest. */
function discardFor(s: IsleState, seat: number): Hand {
  const hand = s.players[seat].hand;
  const owed = s.discarding[seat];
  const goal = goalOf(s, seat);
  const need = COSTS[goal === 'road' ? 'road' : goal] as Partial<Hand>;
  const spare = { ...hand };
  for (const r of RESOURCES) spare[r] = Math.max(0, hand[r] - (need[r] ?? 0));
  const out = suggestDiscard(spare, Math.min(owed, handSize(spare)));
  if (handSize(out) < owed) {
    const rest = { ...hand };
    for (const r of RESOURCES) rest[r] -= out[r];
    const more = suggestDiscard(rest, owed - handSize(out));
    for (const r of RESOURCES) out[r] += more[r];
  }
  return out;
}

/** The robber goes where it hurts the leaders most and not the bot itself. */
function robberMove(s: IsleState, seat: number, rng: (n: number) => number): Move {
  const hexes = HEXES.map((_, h) => h).filter((h) => h !== s.robber);
  const harm = (h: number) => {
    let value = 0;
    for (const v of HEXES[h].vertices) {
      const b = s.buildings[v];
      if (!b) continue;
      if (b.seat === seat) return -10;
      value += (b.city ? 2 : 1) * pips(s.setup.numbers[h]) * (1 + publicPoints(s, b.seat) / 5);
    }
    return value;
  };
  const hex = best(hexes, harm, rng)!;
  const options = victims(s, seat, hex);
  const victim = best(options, (p) => handSize(s.players[p].hand), rng) ?? null;
  return { type: 'robber', hex, victim };
}
