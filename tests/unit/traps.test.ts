import { describe, expect, it } from 'vitest';
import { stream } from '../../src/nonogram/rng';
import { hashSeed } from '../../src/shared/random';
import { BOW_FIRST, BOX_H, decodeLog, encodeLog, JUMP, RIGHT, RUN_TICKS, simulate, spawn, step, TRAPS_VERSION } from '../../src/games/traps/sim';
import { findClimb } from '../../src/games/traps/solver';
import { apply, MAX_ROUNDS, replay, score, start, waitingOn, type Move, type Recorded, type Run, type TrapsState } from '../../src/games/traps/state';
import { buildWorld, canPlace, COLS, explode, flagOf, ROWS, startOf, TILE, TOWERS, type Placed } from '../../src/games/traps/world';

const zigzag = TOWERS[0];
const idle = (ticks: number) => Array<number>(ticks).fill(0);
/** Nothing but a floor, with the start where Zigzag has it. */
const open = { name: 'open', rows: [...Array(ROWS - 3).fill('.'.repeat(COLS)), '..........F.', '.S..........', '#'.repeat(COLS)] };

describe('trap tower runs', () => {
  it('logs round-trip, and bad or overlong logs are refused', () => {
    const inputs = [...idle(30), ...Array(40).fill(RIGHT), ...Array(5).fill(RIGHT | JUMP), 4, 0, 0];
    expect(decodeLog(encodeLog(inputs))).toEqual(inputs);
    expect(decodeLog('')).toEqual([]);
    for (const bad of ['8a', '2', '2a,', 'x1', '2zzzz', `0${(RUN_TICKS + 1).toString(36)}`]) expect(decodeLog(bad)).toBeNull();
  });

  it('every tower can be climbed with nothing added', () => {
    for (const tower of TOWERS) {
      const world = buildWorld(tower, []);
      const climb = findClimb(world);
      expect(climb, tower.name).not.toBeNull();
      expect(simulate(world, climb!).status).toBe('flag');
    }
  });

  it('standing still stays on the floor until time runs out', () => {
    const world = buildWorld(zigzag, []);
    const end = simulate(world, []);
    expect(end.status).toBe('time');
    expect(end.tick).toBe(RUN_TICKS);
    expect(end.y).toBe(spawn(world).y);
  });

  it('a jump climbs three cells but not four', () => {
    const world = buildWorld(open, []);
    const r = spawn(world);
    let top = r.y;
    for (let t = 0; t < 60; t++) {
      step(world, r, JUMP);
      top = Math.min(top, r.y);
    }
    const rise = spawn(world).y - top;
    expect(rise).toBeGreaterThan(3 * TILE);
    expect(rise).toBeLessThan(4 * TILE);
  });

  const runOn = (items: Placed[], inputs: number[]) => simulate(buildWorld(zigzag, items), inputs);
  const s = startOf(zigzag);

  it('spikes end a run and credit whoever placed them', () => {
    const end = runOn([{ item: 'spikes', x: s.x + 3, y: s.y, rot: 0, by: 2 }], Array(120).fill(RIGHT));
    expect(end.status).toBe('dead');
    expect(end.cause).toBe('spikes');
    expect(end.killer).toBe(2);
  });

  it('a saw swings along its track and kills', () => {
    const end = runOn([{ item: 'saw', x: s.x + 4, y: s.y, rot: 0, by: 1 }], Array(200).fill(RIGHT));
    expect(end.status).toBe('dead');
    expect(end.cause).toBe('saw');
    expect(end.killer).toBe(1);
  });

  it('a crossbow shoots on its beat, and its arrow kills', () => {
    const end = runOn([{ item: 'bow', x: s.x + 8, y: s.y, rot: 2, by: 3 }], idle(400));
    expect(end.status).toBe('dead');
    expect(end.cause).toBe('arrow');
    expect(end.killer).toBe(3);
    expect(end.tick).toBeGreaterThan(BOW_FIRST);
    // A block in the way stops the arrows.
    const safe = runOn([{ item: 'bow', x: s.x + 8, y: s.y, rot: 2, by: 3 }, { item: 'block', x: s.x + 5, y: s.y, rot: 0, by: 0 }], idle(400));
    expect(safe.status).toBe('time');
  });

  it('a spring bounces higher than a jump', () => {
    const world = buildWorld(open, [{ item: 'spring', x: s.x + 3, y: s.y, rot: 0, by: 0 }]);
    // Drop onto the spring from just above it, and stand still.
    const r = spawn(world);
    r.x = (s.x + 3) * TILE + 48;
    r.y = s.y * TILE - BOX_H - 8;
    let top = r.y;
    for (let t = 0; t < 120; t++) {
      step(world, r, 0);
      top = Math.min(top, r.y);
    }
    expect(s.y * TILE - BOX_H - top).toBeGreaterThan(5 * TILE);
  });

  it('ice slides on after letting go, and honey keeps a jump low', () => {
    // A flat floor laid with planks of the given kind (buildWorld doesn't check placing).
    const flat = (item: 'ice' | 'honey' | null) =>
      buildWorld({ name: 'flat', rows: [...Array(ROWS - 3).fill('.'.repeat(COLS)), '...........F', 'S...........', '#'.repeat(COLS)] }, item ? [0, 3, 6, 9].map((x) => ({ item, x, y: ROWS - 1, rot: 0, by: 0 })) : []);
    const slide = (item: 'ice' | null) => {
      const world = flat(item);
      const r = spawn(world);
      for (let t = 0; t < 30; t++) step(world, r, RIGHT);
      const at = r.x;
      for (let t = 0; t < 60; t++) step(world, r, 0);
      return r.x - at;
    };
    expect(slide('ice')).toBeGreaterThan(slide(null) * 3);

    const world = flat('honey');
    const r = spawn(world);
    step(world, r, 0);
    let top = r.y;
    for (let t = 0; t < 60; t++) {
      step(world, r, JUMP);
      top = Math.min(top, r.y);
    }
    expect(spawn(world).y - top).toBeLessThan(2 * TILE);
    expect(BOX_H).toBeLessThan(TILE);
  });
});

describe('placing', () => {
  const s = startOf(zigzag);
  const f = flagOf(zigzag);

  it('needs air, inside the tower, clear of other items and of the start and flag', () => {
    expect(canPlace(zigzag, [], { item: 'block', x: 6, y: 9, rot: 0 })).toBe(true);
    expect(canPlace(zigzag, [], { item: 'block', x: 0, y: 19, rot: 0 })).toBe(false);
    expect(canPlace(zigzag, [], { item: 'plank', x: 10, y: 9, rot: 0 })).toBe(false);
    expect(canPlace(zigzag, [], { item: 'plank', x: 10, y: 9, rot: 1 })).toBe(true);
    expect(canPlace(zigzag, [], { item: 'spikes', x: s.x + 1, y: s.y - 1, rot: 0 })).toBe(false);
    expect(canPlace(zigzag, [], { item: 'spikes', x: f.x, y: f.y + 0, rot: 0 })).toBe(false);
    const block: Placed = { item: 'block', x: 6, y: 9, rot: 0, by: 0 };
    expect(canPlace(zigzag, [block], { item: 'saw', x: 4, y: 9, rot: 0 })).toBe(false);
    expect(canPlace(zigzag, [block], { item: 'saw', x: 3, y: 9, rot: 0 })).toBe(true);
    expect(canPlace(zigzag, [], { item: 'block', x: 6.5, y: 9, rot: 0 })).toBe(false);
  });

  it('a bomb goes anywhere and clears the items around it', () => {
    const items: Placed[] = [
      { item: 'block', x: 6, y: 9, rot: 0, by: 0 },
      { item: 'plank', x: 1, y: 6, rot: 0, by: 1 },
      { item: 'spikes', x: 8, y: 10, rot: 0, by: 1 },
    ];
    expect(canPlace(zigzag, items, { item: 'bomb', x: 0, y: 19, rot: 0 })).toBe(true);
    expect(explode(items, { x: 7, y: 10 })).toEqual([items[1]]);
    expect(explode(items, { x: 4, y: 5 })).toEqual([items[0], items[2]]);
  });
});

const run = (status: Run['status'], ticks = 600, killer: number | null = null): Run => ({ log: '', status, ticks, cause: status === 'dead' ? 'spikes' : null, killer });

describe('scoring', () => {
  it('scores nobody when everyone or nobody makes it', () => {
    expect(score([run('flag'), run('flag')])).toEqual({ points: [0, 0], verdict: 'easy' });
    expect(score([run('dead', 100, 1), run('time')])).toEqual({ points: [0, 0], verdict: 'none' });
  });

  it('scores the flag, the fastest, and traps that got someone else', () => {
    const { points, verdict } = score([run('flag', 500), run('flag', 400), run('dead', 100, 0), run('dead', 50, 3)]);
    expect(verdict).toBe('scored');
    expect(points).toEqual([3 + 1, 3 + 1, 0, 0]);
  });
});

/** A whole game of random picks, places and runs, mixing in climbs the search found. */
const climbs = new Map<number, number[]>();
const climbOf = (tower: number) => climbs.get(tower) ?? climbs.set(tower, findClimb(buildWorld(TOWERS[tower], []))!).get(tower)!;

function randomGame(seed: string, seats: number) {
  const rng = stream(`test:${seed}`);
  const ids = Array.from({ length: seats }, (_, i) => `p${i}`);
  const moves: Recorded[] = [];
  let state: TrapsState = start(seed, seats);
  const climb = climbOf(state.tower);
  for (let guard = 0; guard < 5000 && !state.winners; guard++) {
    const seat = waitingOn(state)[rng(waitingOn(state).length)];
    let move: Move;
    if (state.phase === 'pick') move = { type: 'pick', round: state.round, index: rng(state.box.length) };
    else if (state.phase === 'place') move = { type: 'place', round: state.round, x: rng(COLS), y: rng(ROWS), rot: rng(4) };
    else {
      const inputs = rng(3) === 0 ? climb : Array.from({ length: 200 + rng(600) }, () => rng(8));
      move = { type: 'run', round: state.round, log: encodeLog(inputs) };
    }
    const next = apply(state, move, seat);
    moves.push({ by: ids[seat], move });
    if (next) state = next;
  }
  return { state, moves, ids };
}

describe('trap tower games', () => {
  it('refuses a second pick of the same item, and moves from another round', () => {
    let s = start('picks', 2);
    s = apply(s, { type: 'pick', round: 0, index: 1 }, 0)!;
    expect(apply(s, { type: 'pick', round: 0, index: 1 }, 1)).toBeNull();
    expect(apply(s, { type: 'pick', round: 1, index: 2 }, 1)).toBeNull();
    expect(apply(s, { type: 'pick', round: 0, index: 0 }, 0)).toBeNull();
    s = apply(s, { type: 'pick', round: 0, index: 2 }, 1)!;
    expect(s.phase).toBe('place');
    expect(apply(s, { type: 'run', round: 0, log: '' }, 0)).toBeNull();
  });

  it('play out to a winner, and replay the same', () => {
    for (let g = 0; g < 12; g++) {
      const seats = 2 + (g % 3);
      const { state, moves, ids } = randomGame(`game${g}`, seats);
      expect(state.winners, `game ${g}`).not.toBeNull();
      expect(state.results.length).toBeLessThanOrEqual(MAX_ROUNDS);
      expect(replay(`game${g}`, ids, moves)).toEqual(state);
    }
  });

  it('matches the golden hash', () => {
    // Bump TRAPS_VERSION along with this when runs or rounds would replay differently.
    const { state } = randomGame('golden', 3);
    expect(TRAPS_VERSION).toBe(1);
    expect(hashSeed(JSON.stringify(state))).toMatchInlineSnapshot(`2352129857`);
  });
});
