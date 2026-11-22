import { describe, expect, it } from 'vitest';
import { hashSeed } from '../../src/shared/random';
import { stream } from '../../src/nonogram/rng';
import { botGame } from '../../src/games/kitchen/bot';
import {
  ACTION_DELAY,
  CHOP_TICKS,
  COLS,
  COOK_TICKS,
  GAME_TICKS,
  KITCHENS,
  ROWS,
  UNIT,
  advance,
  isFloor,
  newGame,
  simulate,
  sortActions,
  soupKey,
  stars,
  step,
  tileAt,
  walk,
  type Action,
  type KitchenState,
} from '../../src/games/kitchen/sim';

/** Plays one chef's taps one after another, each once the chef has done the last. */
function run(state: KitchenState, seat: number, taps: [number, number][]) {
  const actions: Action[] = [];
  for (const [x, y] of taps) {
    const chef = state.chefs[seat];
    while (chef.path.length || chef.goal || chef.chop >= 0) step(state);
    const a = { seat, tick: state.tick, x, y };
    actions.push(a);
    for (let i = 0; i <= ACTION_DELAY; i++) step(state, [a]);
  }
  const chef = state.chefs[seat];
  while (chef.path.length || chef.goal || chef.chop >= 0) step(state);
  return actions;
}

describe('the kitchens', () => {
  it('are 7 by 9, walled, with every station next to floor all chefs can reach', () => {
    KITCHENS.forEach((k, kitchen) => {
      expect(k.rows.length).toBe(ROWS);
      for (const row of k.rows) expect(row.length).toBe(COLS);
      const start: [number, number] = [0, 0];
      for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) if (k.rows[y][x] === '1') [start[0], start[1]] = [x, y];
      for (let y = 0; y < ROWS; y++)
        for (let x = 0; x < COLS; x++) {
          const tile = tileAt(kitchen, x, y);
          if (x === 0 || y === 0 || x === COLS - 1 || y === ROWS - 1) expect(isFloor(tile)).toBe(false);
          if (isFloor(tile)) expect(walk(kitchen, start, (a, b) => a === x && b === y)).not.toBeNull();
          else if (tile !== '#' || [[0, 1], [1, 0], [0, -1], [-1, 0]].some(([dx, dy]) => isFloor(tileAt(kitchen, x + dx, y + dy))))
            expect(walk(kitchen, start, (a, b) => Math.abs(a - x) + Math.abs(b - y) === 1), `${k.name} ${x},${y}`).not.toBeNull();
        }
      for (const n of '1234') expect(k.rows.join('')).toContain(n);
      for (const soup of k.menu) for (const c of soup) expect(k.rows.join('')).toContain(c);
      for (const kind of 'BSPHX') expect(k.rows.join('')).toContain(kind);
    });
  });
});

describe('cooking', () => {
  it('a tap does nothing until its delay, then the chef walks there', () => {
    const state = newGame('walk', 0, 1);
    const a = { seat: 0, tick: 0, x: 1, y: 1 };
    for (let i = 0; i < ACTION_DELAY; i++) step(state, [a]);
    expect(state.chefs[0].path).toEqual([]);
    step(state, [a]);
    expect(state.chefs[0].path.length).toBeGreaterThan(0);
    while (state.chefs[0].path.length) step(state);
    expect([state.chefs[0].x, state.chefs[0].y]).toEqual([1 * UNIT, 1 * UNIT]);
  });

  it('crate, board, pot, plate and hatch make a soup and score it', () => {
    // The Café: tomatoes at (1,0), boards at (0,2) and (0,4), stoves at (6,2), plates at (6,7), hatch at (4,0).
    const state = newGame('soup', 0, 1);
    // Wait for the first order: tomato or onion, as the seed has it.
    while (state.orders.length === 0) step(state);
    const letter = state.orders[0].soup[0];
    const crate: [number, number] = letter === 'T' ? [1, 0] : [2, 0];
    run(state, 0, [crate, [0, 2]]);
    expect(state.items[2 * COLS]).toBe(letter.toLowerCase());
    run(state, 0, [[0, 2], [6, 2], crate, [0, 2], [0, 2], [6, 2], crate, [0, 2], [0, 2], [6, 2]]);
    expect(state.pots[2 * COLS + 6]).toBe(letter.repeat(3));
    run(state, 0, [[6, 7], [6, 2]]);
    // Not cooked yet: still holding the plate.
    for (let i = 0; i < COOK_TICKS; i++) step(state);
    run(state, 0, [[6, 2]]);
    expect(state.chefs[0].hand).toBe(`P:${letter.repeat(3)}`);
    run(state, 0, [[4, 0]]);
    expect(state.chefs[0].hand).toBeNull();
    expect(state.score).toBeGreaterThan(20);
    expect(state.events.at(-1)).toMatchObject({ kind: 'served', soup: letter.repeat(3), seat: 0 });
  });

  it('chopping takes time at the board, and raw food can’t go in a pot', () => {
    const state = newGame('chop', 0, 1);
    run(state, 0, [[1, 0], [6, 2]]);
    expect(state.pots[2 * COLS + 6]).toBe('');
    expect(state.chefs[0].hand).toBe('T');
    const before = state.tick;
    run(state, 0, [[0, 2]]);
    expect(state.tick - before).toBeGreaterThanOrEqual(CHOP_TICKS);
    expect(state.items[2 * COLS]).toBe('t');
  });

  it('counters hold one thing, the bin empties a plate but keeps it', () => {
    const state = newGame('counter', 0, 1);
    run(state, 0, [[1, 0], [0, 1]]);
    expect(state.items[1 * COLS]).toBe('T');
    run(state, 0, [[2, 0], [0, 1]]);
    expect(state.chefs[0].hand).toBe('O');
    run(state, 0, [[0, 6]]);
    expect(state.chefs[0].hand).toBeNull();
    state.chefs[0].hand = 'P:OOO';
    run(state, 0, [[0, 6]]);
    expect(state.chefs[0].hand).toBe('P');
  });

  it('orders wait so long, then are missed', () => {
    const state = simulate('missed', 0, 2, []);
    expect(state.events.length).toBeGreaterThan(3);
    expect(state.events.every((e) => e.kind === 'missed' && e.points === 0)).toBe(true);
    expect(state.score).toBe(0);
    expect(stars(state)).toBe(0);
  });

  it('a soup no one ordered can’t be served', () => {
    const state = newGame('wrong', 0, 1);
    while (!state.orders.length) step(state);
    state.chefs[0].hand = 'P:MMM';
    run(state, 0, [[4, 0]]);
    expect(state.chefs[0].hand).toBe('P:MMM');
    expect(soupKey('tom')).toBe('MOT');
  });

  it('nothing happens after three minutes', () => {
    const state = simulate('end', 1, 2, [{ seat: 0, tick: GAME_TICKS - 1, x: 1, y: 1 }]);
    expect(state.tick).toBe(GAME_TICKS);
    const after = structuredClone(state);
    step(after, [{ seat: 1, tick: GAME_TICKS - ACTION_DELAY, x: 1, y: 1 }]);
    expect(after).toEqual(state);
  });
});

describe('bot kitchens', () => {
  it('every kitchen serves orders with one to four chefs, and earns stars', () => {
    KITCHENS.forEach((_, kitchen) => {
      for (let chefs = 1; chefs <= 4; chefs++) {
        const { actions, state } = botGame(`bots${kitchen}${chefs}`, kitchen, chefs);
        expect(state.events.filter((e) => e.kind === 'served').length, `${kitchen}/${chefs}`).toBeGreaterThan(4);
        expect(stars(state)).toBeGreaterThanOrEqual(2);
        expect(simulate(`bots${kitchen}${chefs}`, kitchen, chefs, actions)).toEqual(state);
      }
    });
  });
});

describe('replays', () => {
  const randomActions = (seed: string, chefs: number): Action[] => {
    const r = stream(`${seed}:taps`);
    const actions: Action[] = [];
    for (let seat = 0; seat < chefs; seat++) for (let t = r(60); t < GAME_TICKS; t += 15 + r(90)) actions.push({ seat, tick: t, x: r(COLS), y: r(ROWS) });
    return actions;
  };

  it('come out the same whatever order the taps arrive in', () => {
    for (let g = 0; g < 10; g++) {
      const actions = randomActions(`order${g}`, 3);
      expect(simulate(`order${g}`, g % 3, 3, [...actions].reverse())).toEqual(simulate(`order${g}`, g % 3, 3, actions));
    }
  });

  it('stepping as time passes matches playing it all at once', () => {
    const actions = sortActions(randomActions('steps', 4));
    const live = newGame('steps', 2, 4);
    for (let t = 0; t <= GAME_TICKS; t += 7) advance(live, actions, t);
    advance(live, actions, GAME_TICKS);
    expect(live).toEqual(simulate('steps', 2, 4, actions));
  });

  it('200 random games end with the score adding up', () => {
    for (let g = 0; g < 200; g++) {
      const chefs = 1 + (g % 4);
      const state = simulate(`random${g}`, g % 3, chefs, randomActions(`random${g}`, chefs));
      expect(state.tick).toBe(GAME_TICKS);
      expect(state.score).toBe(state.events.reduce((sum, e) => sum + e.points, 0));
      for (const chef of state.chefs) {
        expect(isFloor(tileAt(state.kitchen, Math.round(chef.x / UNIT), Math.round(chef.y / UNIT)))).toBe(true);
      }
    }
  });

  it('match the golden game (change it, and KITCHEN_VERSION, only when games would replay differently)', () => {
    const { state } = botGame('golden', 1, 2);
    expect(hashSeed(JSON.stringify(state))).toBe(2744634088);
  });
});
