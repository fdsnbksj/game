import { describe, expect, it } from 'vitest';
import { AGE_I, AGE_II, AGE_III, ALL_CARDS, GUILDS, TOKENS, WONDERS } from '../../src/games/duel/cards';
import { payment } from '../../src/games/duel/pay';
import { coveredBy, LAYOUTS, setup } from '../../src/games/duel/setup';
import { accessible, actor, apply, builtWonders, legalMoves, replay, score, start, type DuelState, type Move, type Player } from '../../src/games/duel/state';
import { createRandom, hashSeed } from '../../src/shared/random';

/** A game past the draft: each player has drafted four wonders, Age I under way. */
function drafted(seed = 'test'): DuelState {
  let s = start(seed);
  while (s.phase === 'draft') s = apply(s, legalMoves(s)[0], actor(s)!)!;
  return s;
}

/** Puts a card straight into a city, for setting up a position. */
const give = (s: DuelState, p: Player, ...ids: string[]) => s.cities[p].cards.push(...ids);

describe('the cards', () => {
  it('number as in the published game', () => {
    expect([AGE_I.length, AGE_II.length, AGE_III.length, GUILDS.length, WONDERS.length, TOKENS.length]).toEqual([23, 23, 20, 7, 12, 10]);
    expect(new Set(ALL_CARDS.map((c) => c.id)).size).toBe(ALL_CARDS.length);
    expect(new Set(WONDERS.map((w) => w.id)).size).toBe(12);
  });

  it('chain only from links an earlier age gives', () => {
    for (const card of ALL_CARDS.filter((c) => c.chainFrom)) {
      const from = ALL_CARDS.filter((c) => c.chainTo === card.chainFrom);
      expect(from, card.id).toHaveLength(1);
      expect(from[0].age, card.id).toBeLessThan(card.age);
    }
  });

  it('give each science symbol twice, and law only from a token', () => {
    const symbols = ALL_CARDS.flatMap((c) => (c.science ? [c.science] : []));
    for (const s of ['wheel', 'mortar', 'quill', 'plumb', 'sundial', 'globe']) expect(symbols.filter((x) => x === s), s).toHaveLength(2);
    expect(symbols).not.toContain('law');
  });
});

describe('layouts', () => {
  it('hold twenty cards each, with the bottom row open at the start', () => {
    for (const age of [1, 2, 3] as const) expect(LAYOUTS[age]).toHaveLength(20);
    const open = (age: 1 | 2 | 3) => LAYOUTS[age].flatMap((_, i) => (coveredBy(LAYOUTS[age], i).length === 0 ? [i] : []));
    expect(open(1)).toHaveLength(6);
    expect(open(2)).toHaveLength(2);
    expect(open(3)).toHaveLength(2);
  });

  it('uncover a card once both cards overlapping it are taken', () => {
    const s = drafted();
    const layout = LAYOUTS[1];
    // Row 3 (5 cards), first card: covered by the first two of the bottom row.
    const target = layout.findIndex((x) => x.row === 3 && x.x === -4);
    const [a, b] = coveredBy(layout, target);
    expect(accessible(s)).not.toContain(target);
    s.taken[a] = true;
    expect(accessible(s)).not.toContain(target);
    s.taken[b] = true;
    expect(accessible(s)).toContain(target);
  });

  it('make Age III an hourglass with a gap in the middle', () => {
    const middle = LAYOUTS[3].filter((x) => x.row === 3).map((x) => x.x);
    expect(middle).toEqual([-2, 2]);
    // Each middle card holds up two cards above and rests on two below.
    const i = LAYOUTS[3].findIndex((x) => x.row === 3 && x.x === -2);
    expect(coveredBy(LAYOUTS[3], i)).toHaveLength(2);
  });
});

describe('setup', () => {
  it('is the same for the same seed, and deals a fair game', () => {
    expect(setup('abc')).toEqual(setup('abc'));
    const s = setup('abc');
    for (const age of [1, 2, 3] as const) expect(new Set(s.ages[age]).size).toBe(20);
    expect(s.ages[3].filter((id) => id.startsWith('guild-'))).toHaveLength(3);
    expect(new Set([...s.boardTokens, ...s.boxTokens]).size).toBe(10);
    expect(new Set(s.wonderGroups.flat()).size).toBe(8);
  });
});

describe('the wonder draft', () => {
  it('goes 1-2-1 then 2-1-2, with the last of each group given', () => {
    let s = start('draft');
    const first = s.setup.first;
    const pickers: Player[] = [];
    while (s.phase === 'draft') {
      const p = actor(s)!;
      pickers.push(p);
      s = apply(s, legalMoves(s)[0], p)!;
    }
    const second = first === 0 ? 1 : 0;
    // The auto-assigned last picks don't ask: 6 picks for 8 wonders.
    expect(pickers).toEqual([first, second, second, second, first, first]);
    expect(s.cities[0].wonders).toHaveLength(4);
    expect(s.cities[1].wonders).toHaveLength(4);
    expect(s.turn).toBe(first);
  });

  it('refuses a pick out of turn or not on offer', () => {
    const s = start('draft');
    const other = s.setup.first === 0 ? 1 : 0;
    expect(apply(s, legalMoves(s)[0], other)).toBeNull();
    expect(apply(s, { type: 'pickWonder', wonder: 'nope' }, s.setup.first)).toBeNull();
  });
});

describe('paying', () => {
  const none = { cards: [], wonders: [] };
  it('buys missing resources at 2 plus what the opponent makes', () => {
    expect(payment(none, none, { res: { stone: 2 } }, 10)).toEqual({ coins: 0, trade: 4, total: 4 });
    expect(payment(none, { cards: ['rock-cut', 'terrace-quarry'], wonders: [] }, { res: { stone: 1 } }, 10)!.total).toBe(5);
    expect(payment({ cards: ['rock-cut'], wonders: [] }, none, { res: { stone: 1 } }, 10)!.total).toBe(0);
  });

  it('uses fixed prices and choices, cheapest first', () => {
    expect(payment({ cards: ['stone-depot'], wonders: [] }, { cards: ['terrace-quarry'], wonders: [] }, { res: { stone: 2 } }, 10)!.total).toBe(2);
    expect(payment({ cards: ['caravan-stop'], wonders: [] }, none, { res: { wood: 1, clay: 1 } }, 10)!.total).toBe(2);
    expect(payment({ cards: [], wonders: ['piraeus'] }, none, { res: { glass: 1 } }, 10)!.total).toBe(0);
  });

  it('takes the discount off the dearest units', () => {
    // Stone at 4 (opponent makes 2), papyrus at 2: dropping two of three units leaves the papyrus.
    expect(payment(none, { cards: ['terrace-quarry'], wonders: [] }, { res: { stone: 2, papyrus: 1 } }, 10, 2)!.total).toBe(2);
  });

  it("refuses what you can't afford", () => {
    expect(payment(none, none, { coins: 3, res: { wood: 1 } }, 4)).toBeNull();
    expect(payment(none, none, { coins: 3, res: { wood: 1 } }, 5)).toEqual({ coins: 3, trade: 2, total: 5 });
  });
});

describe('playing', () => {
  /** A position where `p` is to play and `id` is in an open slot. */
  function withCard(id: string, p: Player = 0) {
    const s = drafted();
    s.turn = p;
    const slot = accessible(s)[0];
    s.setup = { ...s.setup, ages: { ...s.setup.ages, 1: s.setup.ages[1].map((c, i) => (i === slot ? id : c)) } };
    return { s, slot };
  }

  it('builds through a chain for free, and pays otherwise', () => {
    const { s, slot } = withCard('monument');
    give(s, 0, 'playhouse');
    s.cities[0].coins = 0;
    const next = apply(s, { type: 'build', slot }, 0)!;
    expect(next.cities[0].cards).toContain('monument');
    expect(next.cities[0].coins).toBe(0);
    expect(next.turn).toBe(1);
  });

  it('pays discards with 2 coins and 1 per yellow card', () => {
    const { s, slot } = withCard('rock-cut');
    give(s, 0, 'inn', 'stone-depot');
    const next = apply(s, { type: 'discard', slot }, 0)!;
    expect(next.cities[0].coins).toBe(7 + 4);
    expect(next.discard).toContain('rock-cut');
  });

  it('moves the pawn, takes coins at 3 and 6, and wins at 9', () => {
    const { s, slot } = withCard('weapon-stores');
    s.pawn = 2;
    s.cities[0].coins = 50;
    const a = apply(s, { type: 'build', slot }, 0)!;
    expect(a.pawn).toBe(5);
    expect(a.cities[1].coins).toBe(5);
    const b = withCard('war-council');
    b.s.pawn = 7;
    b.s.cities[0].coins = 50;
    const c = apply(b.s, { type: 'build', slot: b.slot }, 0)!;
    expect(c.pawn).toBe(9);
    expect(c.outcome).toMatchObject({ winner: 0, how: 'military' });
    expect(c.phase).toBe('over');
  });

  it('offers a progress token for a pair of science symbols', () => {
    const { s, slot } = withCard('schoolhouse');
    give(s, 0, 'herbalist');
    s.cities[0].coins = 50;
    const next = apply(s, { type: 'build', slot }, 0)!;
    expect(next.pending[0]).toMatchObject({ kind: 'token', player: 0, from: 'board' });
    expect(actor(next)).toBe(0);
    const token = next.boardTokens[0];
    const after = apply(next, { type: 'token', token }, 0)!;
    expect(after.cities[0].tokens).toEqual([token]);
    expect(after.boardTokens).not.toContain(token);
    expect(after.turn).toBe(1);
  });

  it('wins on six different science symbols', () => {
    const { s, slot } = withCard('star-tower');
    give(s, 0, 'herbalist', 'workbench', 'copy-room', 'remedy-stall', 'lyceum');
    s.cities[0].coins = 50;
    expect(apply(s, { type: 'build', slot }, 0)!.outcome).toMatchObject({ winner: 0, how: 'science' });
  });

  it('builds wonders with their effects, and puts the eighth out', () => {
    const { s, slot } = withCard('rock-cut');
    s.cities[0].wonders = [{ id: 'hanging-gardens', built: false, out: false }];
    s.cities[0].coins = 50;
    const next = apply(s, { type: 'wonder', slot, wonder: 'hanging-gardens' }, 0)!;
    expect(builtWonders(next.cities[0])).toEqual(['hanging-gardens']);
    expect(next.turn).toBe(0); // play again
    // Seven built in all: the last one left is out.
    const t = withCard('rock-cut');
    t.s.cities[0].wonders = ['pyramids', 'sphinx', 'colossus', 'pharos'].map((id, i) => ({ id, built: i > 0, out: false }));
    t.s.cities[1].wonders = ['appian-way', 'circus-maximus', 'mausoleum', 'piraeus'].map((id, i) => ({ id, built: i > 0, out: false }));
    t.s.cities[0].coins = 50;
    const seventh = apply(t.s, { type: 'wonder', slot: t.slot, wonder: 'pyramids' }, 0)!;
    expect(seventh.cities[1].wonders[0]).toMatchObject({ id: 'appian-way', built: false, out: true });
  });

  it('lets the weaker side choose who starts the next age', () => {
    const s = drafted();
    // Everything taken but the top card, which is then open.
    s.taken = s.taken.map((_, i) => i !== 0);
    const last = 0;
    s.turn = 0;
    s.pawn = 2;
    const ended = apply(s, { type: 'discard', slot: last }, 0)!;
    expect(ended.pending[0]).toEqual({ kind: 'starter', player: 1 });
    const next = apply(ended, { type: 'starter', player: 1 }, 1)!;
    expect(next.age).toBe(2);
    expect(next.turn).toBe(1);
    expect(next.taken.every((t) => !t)).toBe(true);
  });

  it('refuses taking a covered card, or playing out of turn', () => {
    const s = drafted();
    const covered = LAYOUTS[1].findIndex((x) => x.row === 0);
    expect(apply(s, { type: 'discard', slot: covered }, s.turn)).toBeNull();
    expect(apply(s, { type: 'discard', slot: accessible(s)[0] }, s.turn === 0 ? 1 : 0)).toBeNull();
  });
});

describe('scoring', () => {
  it('adds up cards, wonders, tokens, military and coins, and breaks ties on blue', () => {
    const s = drafted();
    s.cities[0].cards = ['shrine', 'herbalist', 'guild-judges'];
    s.cities[1].cards = ['playhouse', 'bathhouse'];
    s.cities[0].tokens = ['wisdom', 'geometry'];
    s.cities[0].coins = 10;
    s.cities[1].coins = 2;
    s.pawn = 4;
    s.cities[0].wonders = [{ id: 'pyramids', built: true, out: false }];
    const [a, b] = score(s);
    // Judges: 1 point per blue card in the city with the most (2).
    expect(a).toEqual({ blue: 3, green: 1, yellow: 0, guilds: 2, wonders: 9, tokens: 13, military: 5, coins: 3, total: 36 });
    expect(b.total).toBe(6);
  });
});

describe('random games', () => {
  it('always end, within the rules', () => {
    for (let g = 0; g < 600; g++) {
      const random = createRandom(hashSeed(`fuzz:${g}`));
      let s = start(`fuzz-${g}`);
      const recorded: { by: string; move: Move }[] = [];
      for (let turn = 0; turn < 400 && s.phase !== 'over'; turn++) {
        const moves = legalMoves(s);
        expect(moves.length, `game ${g} stuck`).toBeGreaterThan(0);
        const by = actor(s)!;
        const move = moves[Math.floor(random() * moves.length)];
        const next = apply(s, move, by);
        expect(next, `game ${g}: ${JSON.stringify(move)} refused`).not.toBeNull();
        s = next!;
        recorded.push({ by: by === 0 ? 'a' : 'b', move });
        for (const c of s.cities) {
          expect(c.coins).toBeGreaterThanOrEqual(0);
          expect(new Set(c.cards).size).toBe(c.cards.length);
        }
        expect(builtWonders(s.cities[0]).length + builtWonders(s.cities[1]).length).toBeLessThanOrEqual(7);
      }
      expect(s.phase, `game ${g} never ended`).toBe('over');
      expect(s.outcome).not.toBeNull();
      // Replaying the record gives the same game.
      expect(replay(`fuzz-${g}`, ['a', 'b'], recorded).outcome).toEqual(s.outcome);
    }
  });

  it('skip moves the game refuses when replaying', () => {
    const s = start('skip');
    const by = actor(s)!;
    const players: [string, string] = ['a', 'b'];
    const wrong = { by: players[by === 0 ? 1 : 0], move: legalMoves(s)[0] };
    const right = { by: players[by], move: legalMoves(s)[0] };
    expect(replay('skip', players, [wrong, right]).draft.step).toBe(1);
  });
});
