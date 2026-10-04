import { describe, expect, it } from 'vitest';
import { EDGES, HARBOUR_SLOTS, HEXES, hexNeighbours, VERTICES } from '../../src/games/isle/board';
import { botMove } from '../../src/games/isle/bot';
import { pips, setup, YIELD } from '../../src/games/isle/setup';
import {
  apply,
  bankRate,
  emptyHand,
  handSize,
  legalMoves,
  openingSeat,
  replay,
  roadLength,
  score,
  start,
  waitingFor,
  type Hand,
  type IsleState,
  type Move,
} from '../../src/games/isle/state';

const hand = (h: Partial<Hand>): Hand => ({ ...emptyHand(), ...h });

/** A game past the opening, at the start of seat 0's main phase, with an empty board. */
function midGame(n = 3, seed = 'test'): IsleState {
  return { ...start(seed, n), phase: 'main', turn: 1 };
}

const must = (s: IsleState, move: Move, seat: number) => {
  const next = apply(s, move, seat);
  expect(next, JSON.stringify(move)).not.toBeNull();
  return next!;
};

describe('Island Settlers board', () => {
  it('has 19 lands, 54 corners, 72 sides and 9 harbours on the coast', () => {
    expect(HEXES).toHaveLength(19);
    expect(VERTICES).toHaveLength(54);
    expect(EDGES).toHaveLength(72);
    expect(HARBOUR_SLOTS).toHaveLength(9);
    for (const v of VERTICES) {
      expect(v.hexes.length).toBeGreaterThanOrEqual(1);
      expect(v.hexes.length).toBeLessThanOrEqual(3);
      expect(v.neighbours.length).toBe(v.edges.length);
    }
    for (const slot of HARBOUR_SLOTS) expect(EDGES[slot.edge].hexes).toHaveLength(1);
    expect(new Set(HARBOUR_SLOTS.flatMap((s) => [EDGES[s.edge].a, EDGES[s.edge].b])).size).toBe(18);
  });

  it('deals the right lands and numbers, never two red numbers side by side', () => {
    for (let i = 0; i < 300; i++) {
      const deal = setup(`seed${i}`);
      const count = (t: string) => deal.terrain.filter((x) => x === t).length;
      expect([count('forest'), count('pasture'), count('fields'), count('hills'), count('mountains'), count('desert')]).toEqual([4, 4, 4, 3, 3, 1]);
      expect(deal.numbers.filter((n) => n === null)).toHaveLength(1);
      expect(deal.numbers[deal.terrain.indexOf('desert')]).toBeNull();
      expect(deal.numbers.filter((n) => n !== null).sort((a, b) => a! - b!)).toEqual([2, 3, 3, 4, 4, 5, 5, 6, 6, 8, 8, 9, 9, 10, 10, 11, 11, 12]);
      HEXES.forEach((_, h) => {
        if (pips(deal.numbers[h]) === 5) for (const j of hexNeighbours(h)) expect(pips(deal.numbers[j]), `seed${i}`).toBeLessThan(5);
      });
      expect(deal.deck).toHaveLength(25);
      expect([...deal.harbours].sort()).toEqual(['any', 'any', 'any', 'any', 'brick', 'grain', 'lumber', 'ore', 'wool']);
    }
  });

  it('deals the same island from the same seed', () => {
    expect(setup('abc')).toEqual(setup('abc'));
    expect(setup('abc')).not.toEqual(setup('abd'));
  });
});

describe('Island Settlers opening', () => {
  it('places in snake order and pays for the second settlement', () => {
    let s = start('open', 3);
    expect([0, 1, 2, 3, 4, 5].map((step) => openingSeat(s, step))).toEqual([0, 1, 2, 2, 1, 0]);
    for (let step = 0; step < 6; step++) {
      const seat = openingSeat(s, step);
      expect(waitingFor(s)).toEqual([seat]);
      const move = legalMoves(s, seat)[0] as Extract<Move, { type: 'place' }>;
      s = must(s, move, seat);
      const resources = VERTICES[move.vertex].hexes.filter((h) => YIELD[s.setup.terrain[h]]).length;
      expect(handSize(s.players[seat].hand)).toBe(step < 3 ? 0 : resources);
    }
    expect(s.phase).toBe('roll');
    expect(s.current).toBe(0);
  });

  it('keeps settlements two roads apart and roads beside their settlement', () => {
    let s = start('open', 3);
    s = must(s, { type: 'place', vertex: 2, edge: 1 }, 0);
    expect(apply(s, { type: 'place', vertex: 1, edge: 0 }, 1)).toBeNull();
    expect(apply(s, { type: 'place', vertex: 20, edge: 0 }, 1)).toBeNull();
    expect(apply(s, { type: 'place', vertex: 20, edge: VERTICES[20].edges[0] }, 0)).toBeNull();
  });
});

describe('Island Settlers turns', () => {
  it('rolls from the seed and pays each land showing the number', () => {
    let s = start('roll', 3);
    while (s.phase === 'setup') s = must(s, legalMoves(s, s.current)[0], s.current);
    const before = s.players.map((p) => ({ ...p.hand }));
    const a = must(s, { type: 'roll' }, 0);
    const b = must(s, { type: 'roll' }, 0);
    expect(a.dice).toEqual(b.dice);
    const total = a.dice![0] + a.dice![1];
    if (total !== 7) {
      expect(a.phase).toBe('main');
      s.players.forEach((_, seat) => {
        let gain = 0;
        s.buildings.forEach((bld, v) => {
          if (bld?.seat !== seat) return;
          for (const h of VERTICES[v].hexes) if (s.setup.numbers[h] === total && h !== s.robber) gain++;
        });
        expect(handSize(a.players[seat].hand) - handSize(before[seat])).toBe(gain);
      });
    }
  });

  it('pays nothing from the robber’s land, and only a lone taker when the bank runs short', () => {
    const s = midGame();
    // A land whose corners touch no other land with the same number.
    const h = HEXES.findIndex(
      (hex, i) => s.setup.numbers[i] !== null && hex.vertices.every((v) => VERTICES[v].hexes.every((j) => j === i || s.setup.numbers[j] !== s.setup.numbers[i])),
    );
    const res = YIELD[s.setup.terrain[h]]!;
    const [v1, , v3] = HEXES[h].vertices;
    s.buildings[v1] = { seat: 0, city: true };
    s.buildings[v3] = { seat: 1, city: false };
    // Find a seed turn that rolls this land's number.
    let rolled: IsleState | null = null;
    for (let turn = 1; turn < 500 && !rolled; turn++) {
      const t = { ...s, phase: 'roll' as const, turn };
      const next = must(t, { type: 'roll' }, 0);
      if (next.dice![0] + next.dice![1] === s.setup.numbers[h]) rolled = { ...t };
    }
    expect(rolled).not.toBeNull();
    const paid = must(rolled!, { type: 'roll' }, 0);
    expect(paid.players[0].hand[res]).toBe(2);
    expect(paid.players[1].hand[res]).toBe(1);
    expect(must({ ...rolled!, robber: h }, { type: 'roll' }, 0).players[0].hand[res]).toBe(0);
    const short = must({ ...rolled!, bank: { ...rolled!.bank, [res]: 2 } }, { type: 'roll' }, 0);
    expect(short.players[0].hand[res] + short.players[1].hand[res]).toBe(0);
    const lone = { ...rolled!, bank: { ...rolled!.bank, [res]: 1 }, buildings: [...rolled!.buildings] };
    lone.buildings[v3] = null;
    expect(must(lone, { type: 'roll' }, 0).players[0].hand[res]).toBe(1);
  });

  it('on a 7, makes big hands discard half, then moves the robber and steals', () => {
    let s = start('seven', 3);
    while (s.phase === 'setup') s = must(s, legalMoves(s, s.current)[0], s.current);
    let turn = 1;
    while (true) {
      const t = must({ ...s, turn }, { type: 'roll' }, 0);
      if (t.dice![0] + t.dice![1] === 7) break;
      turn++;
    }
    s = { ...s, turn, players: s.players.map((p, i) => ({ ...p, hand: i === 1 ? hand({ ore: 5, wool: 4 }) : i === 2 ? hand({ grain: 7 }) : p.hand })) };
    s = must(s, { type: 'roll' }, 0);
    expect(s.phase).toBe('discard');
    expect(s.discarding).toEqual([0, 4, 0]);
    expect(waitingFor(s)).toEqual([1]);
    expect(apply(s, { type: 'discard', cards: hand({ ore: 3 }) }, 1)).toBeNull();
    expect(apply(s, { type: 'discard', cards: hand({ wool: 5 }) }, 1)).toBeNull();
    s = must(s, { type: 'discard', cards: hand({ ore: 2, wool: 2 }) }, 1);
    expect(s.phase).toBe('robber');
    expect(apply(s, { type: 'robber', hex: s.robber, victim: null }, 0)).toBeNull();
    // Robber next to seat 1: seat 1 must be the victim.
    const hex = HEXES.findIndex((h, i) => i !== s.robber && h.vertices.some((v) => s.buildings[v]?.seat === 1) && !h.vertices.some((v) => s.buildings[v]?.seat === 0));
    expect(apply(s, { type: 'robber', hex, victim: null }, 0)).toBeNull();
    const after = must(s, { type: 'robber', hex, victim: 1 }, 0);
    expect(handSize(after.players[1].hand)).toBe(4);
    expect(handSize(after.players[0].hand)).toBe(handSize(s.players[0].hand) + 1);
    expect(after.phase).toBe('main');
  });

  it('wins only on your own turn', () => {
    const s = midGame();
    [0, 6, 10, 25, 29].forEach((v, i) => (s.buildings[v] = { seat: 1, city: i < 4 }));
    s.players[1].hand = hand({ grain: 2, ore: 3 });
    s.buildings[47] = { seat: 0, city: false };
    // Seat 1 has 9 points, but it's seat 0's turn: no win until seat 1 plays.
    s.players[1].devs = ['point'];
    expect(score(s, 1).total).toBe(10);
    const after = must(s, { type: 'end' }, 0);
    expect(after.phase).toBe('over');
    expect(after.winner).toBe(1);
  });
});

describe('Island Settlers building', () => {
  it('needs the cards, a connecting road and the distance rule', () => {
    let s = midGame();
    s.buildings[0] = { seat: 0, city: false };
    s.roads[0] = 0; // 0–1
    s.players[0].hand = hand({ brick: 3, lumber: 3, wool: 1, grain: 3, ore: 3 });
    expect(apply(s, { type: 'settlement', vertex: 2 }, 0)).toBeNull(); // no road to it
    s = must(s, { type: 'road', edge: 1 }, 0); // 1–2
    expect(apply(s, { type: 'settlement', vertex: 1 }, 0)).toBeNull(); // next to vertex 0
    s = must(s, { type: 'settlement', vertex: 2 }, 0);
    expect(apply(s, { type: 'road', edge: 30 }, 0)).toBeNull(); // nowhere near
    s = must(s, { type: 'city', vertex: 0 }, 0);
    expect(s.players[0].hand).toEqual(hand({ brick: 1, lumber: 1, grain: 0, ore: 0 }));
    expect(score(s, 0).total).toBe(3);
  });

  it('can’t run a road through another player’s settlement', () => {
    const s = midGame();
    s.roads[0] = 0; // 0–1
    s.buildings[1] = { seat: 1, city: false };
    s.players[0].hand = hand({ brick: 1, lumber: 1 });
    expect(apply(s, { type: 'road', edge: 1 }, 0)).toBeNull(); // 1–2, past the settlement on 1
    expect(apply(s, { type: 'road', edge: 5 }, 0)).not.toBeNull(); // 0–5
  });

  it('counts the longest road, broken by others, and awards it at five', () => {
    const s = midGame();
    for (const e of [0, 1, 2, 3]) s.roads[e] = 0;
    expect(roadLength(s, 0)).toBe(4);
    s.roads[4] = 0;
    expect(roadLength(s, 0)).toBe(5);
    s.roads[5] = 0;
    expect(roadLength(s, 0)).toBe(6); // the ring round one land
    s.roads[10] = 0; // a spur off the ring
    expect(roadLength(s, 0)).toBe(7);
    s.roads[5] = null;
    s.roads[10] = null;
    s.buildings[2] = { seat: 1, city: false };
    expect(roadLength(s, 0)).toBe(3);

    let t = midGame();
    for (const e of [0, 1, 2, 3]) t.roads[e] = 0;
    t.players[0].hand = hand({ brick: 1, lumber: 1 });
    t = must(t, { type: 'road', edge: 4 }, 0);
    expect(t.longest).toBe(0);
    expect(score(t, 0).longest).toBe(2);
    // Seat 1 settles in the middle of it and breaks it.
    t = { ...t, current: 1, roads: [...t.roads], buildings: [...t.buildings], players: t.players.map((p) => ({ ...p, hand: { ...p.hand } })) };
    t.roads[9] = 1; // 2–9
    t.players[1].hand = hand({ brick: 1, lumber: 1, wool: 1, grain: 1 });
    t = must(t, { type: 'settlement', vertex: 2 }, 1);
    expect(t.longest).toBeNull();
  });

  it('trades with the bank at 4:1, or better through a harbour', () => {
    const s = midGame();
    s.players[0].hand = hand({ wool: 4 });
    expect(bankRate(s, 0, 'wool')).toBe(4);
    const after = must(s, { type: 'bank', give: 'wool', get: 'ore' }, 0);
    expect(after.players[0].hand).toEqual(hand({ ore: 1 }));
    const slot = s.setup.harbours.indexOf('wool');
    s.buildings[EDGES[HARBOUR_SLOTS[slot].edge].a] = { seat: 0, city: false };
    expect(bankRate(s, 0, 'wool')).toBe(2);
    expect(bankRate(s, 0, 'ore')).toBe(4);
  });
});

describe('Island Settlers trades and cards', () => {
  it('lets anyone accept an offer they can pay, once', () => {
    let s = midGame();
    s.players[0].hand = hand({ wool: 2 });
    s.players[1].hand = hand({ ore: 1 });
    s.players[2].hand = hand({ ore: 1 });
    expect(apply(s, { type: 'offer', give: hand({ wool: 3 }), get: hand({ ore: 1 }) }, 0)).toBeNull();
    s = must(s, { type: 'offer', give: hand({ wool: 2 }), get: hand({ ore: 1 }) }, 0);
    expect(waitingFor(s)).toEqual([0, 1, 2]);
    s = must(s, { type: 'decline' }, 2);
    expect(apply(s, { type: 'accept' }, 2)).toBeNull();
    s = must(s, { type: 'accept' }, 1);
    expect(s.players[0].hand).toEqual(hand({ ore: 1 }));
    expect(s.players[1].hand).toEqual(hand({ wool: 2 }));
    expect(s.offer).toBeNull();
    expect(apply(s, { type: 'accept' }, 2)).toBeNull();
  });

  it('plays one development card a turn, never one bought this turn', () => {
    let s = midGame();
    s.players[0].hand = hand({ wool: 1, grain: 1, ore: 1 });
    s.deck = ['knight', ...s.deck];
    s = must(s, { type: 'buy' }, 0);
    expect(s.players[0].fresh).toEqual(['knight']);
    expect(apply(s, { type: 'play', card: 'knight' }, 0)).toBeNull();
    s = must(s, { type: 'end' }, 0);
    expect(s.players[0].devs).toEqual(['knight']);

    let t = midGame();
    t.players[0].devs = ['monopoly', 'plenty'];
    t.players[1].hand = hand({ ore: 2, wool: 1 });
    t.players[2].hand = hand({ ore: 3 });
    t = must(t, { type: 'play', card: 'monopoly', res: 'ore' }, 0);
    expect(t.players[0].hand.ore).toBe(5);
    expect(t.players[1].hand).toEqual(hand({ wool: 1 }));
    expect(apply(t, { type: 'play', card: 'plenty', take: ['ore', 'ore'] }, 0)).toBeNull();
  });

  it('lets a knight come before the roll, and gives the largest army at three', () => {
    let s: IsleState = { ...midGame(), phase: 'roll' };
    s.players[0].devs = ['knight'];
    s.players[0].knights = 2;
    s = must(s, { type: 'play', card: 'knight' }, 0);
    expect(s.phase).toBe('robber');
    expect(s.largest).toBe(0);
    const hex = HEXES.findIndex((_, i) => i !== s.robber);
    s = must(s, { type: 'robber', hex, victim: null }, 0);
    expect(s.phase).toBe('roll');
  });

  it('places two free roads from a Road building card', () => {
    let s = midGame();
    s.buildings[0] = { seat: 0, city: false };
    s.players[0].devs = ['roads'];
    s = must(s, { type: 'play', card: 'roads' }, 0);
    expect(apply(s, { type: 'end' }, 0)).toBeNull();
    s = must(s, { type: 'road', edge: 0 }, 0);
    s = must(s, { type: 'road', edge: 1 }, 0);
    expect(s.freeRoads).toBe(0);
    expect(handSize(s.players[0].hand)).toBe(0);
  });
});

describe('Island Settlers games', () => {
  it('refuses moves out of turn and skips them on replay', () => {
    const s = start('replay', 3);
    expect(apply(s, legalMoves(s, 0)[0], 1)).toBeNull();
    const first = legalMoves(s, 0)[0];
    const state = replay('replay', ['a', 'b', 'c'], [
      { by: 'b', move: first },
      { by: 'a', move: first },
      { by: 'z', move: { type: 'end' } },
      { by: 'b', move: { type: 'roll' } },
    ]);
    expect(state.step).toBe(1);
  });

  it('plays hundreds of all-bot games to a winner', () => {
    for (let g = 0; g < 200; g++) {
      let s = start(`bots${g}`, 3 + (g % 2));
      let moves = 0;
      while (s.phase !== 'over') {
        const seat = waitingFor(s)[0];
        const m = botMove(s, seat)!;
        const next = apply(s, m, seat);
        expect(next, `game ${g}: ${JSON.stringify(m)} in ${s.phase}`).not.toBeNull();
        s = next!;
        expect(++moves, `game ${g} runs on`).toBeLessThan(5000);
        // Cards are never made or lost: 19 of each between the bank and the hands.
        if (moves % 50 === 0) for (const r of ['brick', 'lumber', 'wool', 'grain', 'ore'] as const) expect(s.bank[r] + s.players.reduce((sum, p) => sum + p.hand[r], 0)).toBe(19);
      }
      expect(score(s, s.winner!).total).toBeGreaterThanOrEqual(10);
    }
  });

  it('survives random legal moves', () => {
    for (let g = 0; g < 40; g++) {
      let s = start(`random${g}`, 4);
      let rng = g * 7919 + 1;
      for (let i = 0; i < 1500 && s.phase !== 'over'; i++) {
        const seat = waitingFor(s)[(rng = (rng * 48271) % 2147483647) % waitingFor(s).length];
        const moves = legalMoves(s, seat);
        const m = moves[(rng = (rng * 48271) % 2147483647) % moves.length];
        const next = apply(s, m, seat);
        expect(next, JSON.stringify(m)).not.toBeNull();
        s = next!;
      }
    }
  });
});
