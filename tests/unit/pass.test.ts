import { describe, expect, it } from 'vitest';
import { botMove } from '../../src/games/pass/bot';
import { apply, HIGH, LOW, MAX_SEATS, mustTake, PASS_VERSION, replay, runs, score, SET_ASIDE, start, startingCoins, takeCost, tally, type PassState, type Recorded } from '../../src/games/pass/state';
import { stream } from '../../src/nonogram/rng';
import { hashSeed } from '../../src/shared/random';

// Pass or Pay: each rule, then hundreds of random games to the end and their replays.

describe('the deal', () => {
  it('sets nine aside and lays one card up, the same for a seed', () => {
    const s = start('deal', 4);
    const seen = [s.card!, ...s.deck];
    expect(seen).toHaveLength(HIGH - LOW + 1 - SET_ASIDE);
    expect(new Set(seen).size).toBe(seen.length);
    expect(seen.every((c) => c >= LOW && c <= HIGH)).toBe(true);
    expect(s.pot).toBe(0);
    expect(s.players.every((p) => p.coins === 11 && p.cards.length === 0)).toBe(true);
    expect(start('deal', 4)).toEqual(s);
    expect(start('other', 4).deck).not.toEqual(s.deck);
  });

  it('gives fewer coins at a full table', () => {
    expect(startingCoins(2)).toBe(11);
    expect(startingCoins(5)).toBe(11);
    expect(startingCoins(MAX_SEATS)).toBe(9);
  });
});

describe('a pay', () => {
  it('puts a coin on the card and passes it to the next player, round the table', () => {
    const s = { ...start('pay', 3), turn: 2 };
    const t = apply(s, { type: 'pay' }, 2)!;
    expect(t.players[2].coins).toBe(10);
    expect(t.pot).toBe(1);
    expect(t.turn).toBe(0);
    expect(t.card).toBe(s.card);
    expect(t.last).toEqual({ by: 2, type: 'pay', card: s.card, pot: 1 });
  });

  it('needs a coin: with none you must take', () => {
    const s0 = start('broke', 2);
    const s: PassState = { ...s0, turn: 0, players: s0.players.map((p, i) => (i === 0 ? { ...p, coins: 0 } : p)) };
    expect(mustTake(s)).toBe(true);
    expect(apply(s, { type: 'pay' }, 0)).toBeNull();
    expect(apply(s, { type: 'take' }, 0)).not.toBeNull();
  });

  it('refuses out of turn and unknown moves', () => {
    const s = { ...start('turn', 3), turn: 1 };
    expect(apply(s, { type: 'pay' }, 0)).toBeNull();
    expect(apply(s, { type: 'take' }, 2)).toBeNull();
    expect(apply(s, { type: 'steal' } as never, 1)).toBeNull();
  });
});

describe('a take', () => {
  it('takes the card and its coins, turns up the next card and moves again', () => {
    let s = { ...start('take', 3), turn: 0 };
    s = apply(s, { type: 'pay' }, 0)!;
    s = apply(s, { type: 'pay' }, 1)!;
    const card = s.card!;
    const t = apply(s, { type: 'take' }, 2)!;
    expect(t.players[2]).toEqual({ cards: [card], coins: 13 });
    expect(t.pot).toBe(0);
    expect(t.card).toBe(s.deck[0]);
    expect(t.deck).toEqual(s.deck.slice(1));
    expect(t.turn).toBe(2);
    expect(t.last).toEqual({ by: 2, type: 'take', card, pot: 2 });
  });
});

describe('scoring', () => {
  it('counts only the lowest of each run, less a point a coin', () => {
    expect(runs([23, 3, 21, 22, 5])).toEqual([[3], [5], [21, 22, 23]]);
    expect(score({ cards: [3, 5, 21, 22, 23], coins: 4 })).toBe(3 + 5 + 21 - 4);
    expect(score({ cards: [], coins: 11 })).toBe(-11);
  });

  it('a card next to your run costs only what its coins take off', () => {
    const p = { cards: [20, 21], coins: 5 };
    expect(takeCost(p, 22, 3)).toBe(-3);
    expect(takeCost(p, 19, 0)).toBe(-1);
    expect(takeCost(p, 30, 2)).toBe(28);
    // 22 joins 20–21 and 24 into one run: 24 stops counting.
    expect(takeCost({ cards: [20, 21, 23, 24], coins: 0 }, 22, 0)).toBe(-23);
  });

  it('the last card ends it: lowest score wins, ties share', () => {
    const s0 = start('end', 3);
    const last = s0.deck.at(-1)!;
    const s: PassState = {
      ...s0,
      turn: 1,
      card: last,
      deck: [],
      pot: 0,
      players: [
        { cards: [10], coins: 5 },
        { cards: [], coins: 0 },
        { cards: [last + 100], coins: 0 },
      ],
    };
    const t = apply(s, { type: 'take' }, 1)!;
    expect(t.card).toBeNull();
    expect(t.winners).toEqual([0]);
    expect(apply(t, { type: 'take' }, 1)).toBeNull();
    const tie = apply({ ...s, players: [{ cards: [last + 5], coins: 5 }, s.players[1], s.players[2]] }, { type: 'take' }, 1)!;
    expect(tie.winners).toEqual([0, 1]);
  });
});

describe('bots', () => {
  it('move only on their turn, and must take when broke', () => {
    const s = { ...start('bot', 3), turn: 1 };
    expect(botMove(s, 0)).toBeNull();
    expect(botMove(s, 1)).not.toBeNull();
    const broke: PassState = { ...s, players: s.players.map((p, i) => (i === 1 ? { ...p, coins: 0 } : p)) };
    expect(botMove(broke, 1)).toEqual({ type: 'take' });
  });

  it('take a fat pot or a card that joins their run, and pass a costly one', () => {
    const s0 = { ...start('bot2', 3), turn: 0 };
    const at = (card: number, pot: number, cards: number[], coins = 11): PassState => ({ ...s0, card, pot, players: s0.players.map((p, i) => (i === 0 ? { cards, coins } : p)) });
    expect(botMove(at(30, 31, []), 0)).toEqual({ type: 'take' });
    expect(botMove(at(30, 0, []), 0)).toEqual({ type: 'pay' });
    expect(botMove(at(21, 0, [20], 2), 0)).toEqual({ type: 'take' });
  });

  it('are the same on every phone, and play whole games to the end', () => {
    for (let g = 0; g < 200; g++) {
      const seats = Array.from({ length: 2 + (g % 5) }, (_, i) => `bot:${i + 1}`);
      const seed = `bots${g}`;
      let s = start(seed, seats.length);
      const moves: Recorded[] = [];
      for (let t = 0; t < 5000 && s.winners === null; t++) {
        const move = botMove(s, s.turn)!;
        expect(botMove(s, s.turn)).toEqual(move);
        const next = apply(s, move, s.turn);
        expect(next).not.toBeNull();
        moves.push({ by: seats[s.turn], move });
        s = next!;
      }
      expect(s.winners).not.toBeNull();
      expect(botMove(s, s.turn)).toBeNull();
      expect(replay(seed, seats, moves)).toEqual(s);
    }
  });
});

describe('whole games', () => {
  it('random players always reach the end, and replay the same', () => {
    for (let g = 0; g < 400; g++) {
      const seats = Array.from({ length: 2 + (g % 5) }, (_, i) => `p${i}`);
      const seed = `game${g}`;
      let s = start(seed, seats.length);
      const rng = stream(`${seed}:test`);
      const moves: Recorded[] = [];
      for (let t = 0; t < 5000 && s.winners === null; t++) {
        const move = rng(3) === 0 ? { type: 'take' as const } : { type: 'pay' as const };
        const next = apply(s, move, s.turn);
        if (!next) {
          expect(move.type).toBe('pay');
          expect(mustTake(s)).toBe(true);
          continue;
        }
        moves.push({ by: seats[s.turn], move });
        s = next;
      }
      expect(s.winners).not.toBeNull();
      expect(s.winners!.length).toBeGreaterThan(0);
      expect(s.players.flatMap((p) => p.cards)).toHaveLength(HIGH - LOW + 1 - SET_ASIDE);
      // Coins only move between players and the pot.
      expect(s.players.reduce((n, p) => n + p.coins, 0)).toBe(seats.length * startingCoins(seats.length));
      expect(replay(seed, seats, moves)).toEqual(s);
      // A refused move in the log is skipped.
      expect(replay(seed, seats, [{ by: 'nobody', move: { type: 'take' } }, ...moves])).toEqual(s);
    }
  });

  it('match the golden game (change it, and PASS_VERSION, only when games would replay differently)', () => {
    let s = start('golden', 4);
    const rng = stream('golden:moves');
    while (s.winners === null) s = apply(s, { type: rng(3) === 0 || mustTake(s) ? 'take' : 'pay' }, s.turn)!;
    expect(PASS_VERSION).toBe(1);
    expect(hashSeed(JSON.stringify(s))).toBe(1043184058);
  });
});

describe('the room tally', () => {
  const seats = ['ann', 'bob', 'bot:1'];
  /** A whole game's moves from a seed, played by the bot for every seat. */
  function game(seed: string): { moves: Recorded[]; winners: number[] } {
    let s = start(seed, seats.length);
    const moves: Recorded[] = [];
    while (s.winners === null) {
      const move = botMove(s, s.turn)!;
      moves.push({ by: seats[s.turn], move });
      s = apply(s, move, s.turn)!;
    }
    return { moves, winners: s.winners };
  }

  it('counts each finished game in the room, shared wins for each, a game under way not at all', () => {
    const seeds = ['t1', 't2', 't3', 't4', 't5'];
    const games = seeds.map(game);
    const moves = games.flatMap((g) => g.moves);
    const froms = games.map((_, i) => games.slice(0, i).reduce((n, g) => n + g.moves.length, 0));
    const expected = seats.map(() => 0);
    for (const g of games) for (const w of g.winners) expected[w]++;
    const past = seeds.slice(0, 4).map((seed, i) => ({ seed, from: froms[i] }));
    expect(tally(seats, past, { seed: 't5', from: froms[4] }, moves)).toEqual(expected);

    // The last game half played: only the four before it count.
    const half = moves.slice(0, froms[4] + 5);
    const four = seats.map(() => 0);
    for (const g of games.slice(0, 4)) for (const w of g.winners) four[w]++;
    expect(tally(seats, past, { seed: 't5', from: froms[4] }, half)).toEqual(four);
    expect(tally(seats, [], { seed: 't1', from: 0 }, games[0].moves)).toEqual(seats.map((_, i) => (games[0].winners.includes(i) ? 1 : 0)));
  });
});
