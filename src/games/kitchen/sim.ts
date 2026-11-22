import { createRandom, hashSeed } from '../../shared/random';

// Short Order: one to four chefs share a kitchen for three minutes and cook soups to order.
// Tap a tile and your chef walks to it and does the obvious thing there: takes from a crate,
// chops on a board, drops into a pot, plates a cooked soup, serves it at the hatch.
//
// The whole kitchen is a function of the seed, the kitchen, the number of chefs and the taps.
// A tap is a tile and the tick it was made at, and it takes effect ACTION_DELAY ticks later,
// so a tap from another phone usually arrives before it does anything and the kitchen
// rarely jumps. Every phone replays the same kitchen from the same taps, whatever order they
// arrive in (`simulate` sorts them). Pure TypeScript: no trig, no clock, no device randomness.

/** Bump when the same taps would play out differently: rooms on another version can't be joined. */
export const KITCHEN_VERSION = 1;

export const TICKS_PER_SECOND = 60;
/** Three minutes. */
export const GAME_TICKS = 180 * TICKS_PER_SECOND;
/** A tap does something this many ticks after it's made (0.4 s): time for it to reach the other phones. */
export const ACTION_DELAY = 24;
export const COLS = 7;
export const ROWS = 9;
/** A chef's position is in tenths of a tile; a chef walks a tenth a tick (6 tiles a second). */
export const UNIT = 10;
export const MAX_CHEFS = 4;
/** Chopping one ingredient: 1.5 s at the board. */
export const CHOP_TICKS = 90;
/** A full pot cooks in 6 s. */
export const COOK_TICKS = 360;
/** How long an order waits before it's missed: 80 s. */
export const PATIENCE = 80 * TICKS_PER_SECOND;
export const MAX_ORDERS = 4;
/** A served soup is worth this, plus a tip of up to TIP for how much patience was left. */
export const SOUP_POINTS = 20;
export const TIP = 10;

/** Ingredients by letter: raw is the capital, chopped the small letter. */
export type Ingredient = 'T' | 'O' | 'M';
export const INGREDIENT_NAMES: Record<Ingredient, string> = { T: 'tomato', O: 'onion', M: 'mushroom' };

// Tiles: '.' floor (a digit is a floor tile a chef starts on), '#' counter, 'T' 'O' 'M' crates,
// 'B' chopping board, 'S' stove with its pot, 'P' plates, 'H' serving hatch, 'X' bin.
export interface Kitchen {
  name: string;
  line: string;
  rows: string[];
  /** The soups it serves, each three ingredients in order (see `soupKey`). */
  menu: string[];
  /** Points for one, two and three stars, by number of chefs (1 to 4). */
  stars: [number, number, number][];
}

export const KITCHENS: Kitchen[] = [
  {
    name: 'The Café',
    line: 'One open kitchen. Tomato and onion soup.',
    rows: ['#TO#HH#', '#.....#', 'B..1..S', '#.....#', 'B.....S', '#..2..#', 'X.....#', '#.3.4.P', '###P###'],
    menu: ['OOO', 'TTT'],
    stars: [
      [50, 100, 150],
      [70, 150, 220],
      [80, 160, 240],
      [80, 170, 250],
    ],
  },
  {
    name: 'Two Rooms',
    line: 'A counter down the middle. Pass things over it.',
    rows: ['#TO#HH#', '#..#..#', 'B1.#.2S', '#..#..#', 'B..#..S', '#..#..#', '#3.#.4P', '#.....#', '###X###'],
    menu: ['OOO', 'TTT', 'OOT'],
    stars: [
      [35, 70, 105],
      [60, 120, 180],
      [80, 160, 230],
      [80, 170, 250],
    ],
  },
  {
    name: 'The Island',
    line: 'A stove in the middle. Mushrooms too.',
    rows: ['#TOMHH#', '#.....#', 'B1...2S', '#..S..#', 'B..#..#', '#..P..S', 'X3...4#', '#.....#', '###B###'],
    menu: ['MMM', 'OOO', 'TTT', 'MOT'],
    stars: [
      [50, 100, 150],
      [70, 150, 220],
      [80, 160, 240],
      [80, 170, 250],
    ],
  },
];

/** A soup is known by its ingredients sorted: 'MOT', 'OOT', 'TTT'. */
export const soupKey = (letters: string) => [...letters.toUpperCase()].sort().join('');

// Something carried, or set down on a counter or board:
//   'T' a raw tomato, 't' a chopped one, 'P' a clean plate, 'P:OOT' a plate of soup.
export type Item = string;
export const isRaw = (item: Item | null) => item !== null && item.length === 1 && 'TOM'.includes(item);
export const isChopped = (item: Item | null) => item !== null && item.length === 1 && 'tom'.includes(item);
export const isSoup = (item: Item | null) => item !== null && item.startsWith('P:');

export interface Chef {
  /** Where the chef is, in tenths of a tile. */
  x: number;
  y: number;
  /** Tiles still to walk to, in order, as [x, y]; the first is the one being walked into. */
  path: [number, number][];
  /** The tile to use on arriving, or null. */
  goal: [number, number] | null;
  /** The board being chopped at (a tile index), or -1. */
  chop: number;
  hand: Item | null;
  /** Which way the chef faces, as a tile step. */
  face: [number, number];
}

export interface Order {
  id: number;
  soup: string;
  born: number;
  until: number;
}

export interface KitchenEvent {
  tick: number;
  kind: 'served' | 'missed';
  soup: string;
  points: number;
  /** Who served it, or -1 for a missed order. */
  seat: number;
}

export interface KitchenState {
  seed: string;
  kitchen: number;
  tick: number;
  chefs: Chef[];
  /** What's set down on each tile (counters and boards), by tile index. */
  items: (Item | null)[];
  /** How far each board's ingredient is chopped, in ticks. */
  chopped: number[];
  /** Each stove's pot: the ingredients in it, as capitals. */
  pots: string[];
  /** How long each full pot has cooked. */
  cooked: number[];
  orders: Order[];
  nextOrder: number;
  orderAt: number;
  score: number;
  events: KitchenEvent[];
}

/** A tap: a seat sent its chef to a tile at a tick. */
export interface Action {
  seat: number;
  tick: number;
  x: number;
  y: number;
}

const rand = (name: string) => createRandom(hashSeed(name));
export const tileAt = (kitchen: number, x: number, y: number) => (x < 0 || y < 0 || x >= COLS || y >= ROWS ? '#' : KITCHENS[kitchen].rows[y][x]);
export const isFloor = (tile: string) => tile === '.' || (tile >= '1' && tile <= '9');
const index = (x: number, y: number) => y * COLS + x;

const STEPS: [number, number][] = [
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
];

/**
 * The shortest walk over floor from `from` to a tile that `done` accepts, not counting `from`
 * itself; [] if already there, null if there's no way. Ties go the same way on every phone.
 */
export function walk(kitchen: number, from: [number, number], done: (x: number, y: number) => boolean): [number, number][] | null {
  if (done(from[0], from[1])) return [];
  const prev = new Map<number, number>([[index(from[0], from[1]), -1]]);
  let queue: [number, number][] = [from];
  while (queue.length) {
    const next: [number, number][] = [];
    for (const [x, y] of queue) {
      for (const [dx, dy] of STEPS) {
        const nx = x + dx;
        const ny = y + dy;
        const i = index(nx, ny);
        if (!isFloor(tileAt(kitchen, nx, ny)) || prev.has(i)) continue;
        prev.set(i, index(x, y));
        if (done(nx, ny)) {
          const path: [number, number][] = [];
          for (let at = i; at !== index(from[0], from[1]); at = prev.get(at)!) path.unshift([at % COLS, Math.floor(at / COLS)]);
          return path;
        }
        next.push([nx, ny]);
      }
    }
    queue = next;
  }
  return null;
}

const nextTo = (tx: number, ty: number) => (x: number, y: number) => Math.abs(x - tx) + Math.abs(y - ty) === 1;

// ---------- Starting ----------

export function newGame(seed: string, kitchen: number, chefs: number): KitchenState {
  const k = KITCHENS[kitchen];
  const starts: [number, number][] = [];
  for (let n = 1; n <= MAX_CHEFS; n++)
    for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) if (k.rows[y][x] === String(n)) starts.push([x, y]);
  const pots: string[] = [];
  const cooked: number[] = [];
  for (let i = 0; i < COLS * ROWS; i++) {
    pots.push('');
    cooked.push(0);
  }
  return {
    seed,
    kitchen,
    tick: 0,
    chefs: starts.slice(0, chefs).map(([x, y]) => ({ x: x * UNIT, y: y * UNIT, path: [], goal: null, chop: -1, hand: null, face: [0, 1] })),
    items: Array.from({ length: COLS * ROWS }, () => null),
    chopped: Array.from({ length: COLS * ROWS }, () => 0),
    pots,
    cooked,
    orders: [],
    nextOrder: 0,
    // The first order comes in after a second, so everyone sees the kitchen first.
    orderAt: TICKS_PER_SECOND,
    score: 0,
    events: [],
  };
}

export const isOver = (state: KitchenState) => state.tick >= GAME_TICKS;

/** The gap before the next order: shorter with more chefs, from the seed. */
function orderGap(state: KitchenState, id: number) {
  const base = [26, 17, 13, 11][state.chefs.length - 1] * TICKS_PER_SECOND;
  return Math.round(base * (0.8 + rand(`${state.seed}:gap:${id}`)() * 0.4));
}

function newOrder(state: KitchenState) {
  const id = state.nextOrder++;
  const menu = KITCHENS[state.kitchen].menu;
  const soup = soupKey(menu[Math.floor(rand(`${state.seed}:order:${id}`)() * menu.length)]);
  state.orders.push({ id, soup, born: state.tick, until: state.tick + PATIENCE });
  state.orderAt = state.tick + orderGap(state, id);
}

/** Whether a pot is full and cooked. */
export const isCooked = (state: KitchenState, i: number) => state.pots[i].length === 3 && state.cooked[i] >= COOK_TICKS;

/** The tile a chef stands on, or is walking into. */
export function chefTile(chef: Chef): [number, number] {
  return chef.path[0] ?? [Math.round(chef.x / UNIT), Math.round(chef.y / UNIT)];
}

// ---------- Taps ----------

/** Sends a chef to a tile: a floor tile to stand on, or anything else to use. */
function sendChef(state: KitchenState, seat: number, tx: number, ty: number) {
  const chef = state.chefs[seat];
  const tile = tileAt(state.kitchen, tx, ty);
  // A chef between two tiles finishes the step first.
  const moving = chef.x % UNIT !== 0 || chef.y % UNIT !== 0;
  const from: [number, number] = moving ? chef.path[0] : [chef.x / UNIT, chef.y / UNIT];
  const route = walk(state.kitchen, from, isFloor(tile) ? (x, y) => x === tx && y === ty : nextTo(tx, ty));
  if (!route) return;
  chef.path = moving ? [from, ...route] : route;
  chef.goal = isFloor(tile) ? null : [tx, ty];
  chef.chop = -1;
}

/** What a chef does on reaching a tile. */
function use(state: KitchenState, seat: number, tx: number, ty: number) {
  const chef = state.chefs[seat];
  const tile = tileAt(state.kitchen, tx, ty);
  const i = index(tx, ty);
  const hand = chef.hand;
  const there = state.items[i];
  switch (tile) {
    case 'T':
    case 'O':
    case 'M':
      if (hand === null) chef.hand = tile;
      break;
    case 'P':
      if (hand === null) chef.hand = 'P';
      break;
    case 'X':
      // A plate of soup is tipped out and the plate kept; anything else goes.
      if (hand !== null) chef.hand = isSoup(hand) ? 'P' : null;
      break;
    case 'H': {
      if (!isSoup(hand)) break;
      const soup = hand!.slice(2);
      const order = state.orders.find((o) => o.soup === soup);
      if (!order) break;
      const tip = Math.floor((TIP * (order.until - state.tick)) / (order.until - order.born));
      const points = SOUP_POINTS + tip;
      state.score += points;
      state.events.push({ tick: state.tick, kind: 'served', soup, points, seat });
      state.orders = state.orders.filter((o) => o !== order);
      chef.hand = null;
      // Nothing to cook: the next order comes in soon.
      if (state.orders.length === 0) state.orderAt = Math.min(state.orderAt, state.tick + 2 * TICKS_PER_SECOND);
      break;
    }
    case '#':
      if (hand === null && there !== null) {
        chef.hand = there;
        state.items[i] = null;
      } else if (hand !== null && there === null) {
        state.items[i] = hand;
        chef.hand = null;
      }
      break;
    case 'B':
      if (hand === null && isRaw(there)) chef.chop = i;
      else if (hand === null && there !== null) {
        chef.hand = there;
        state.items[i] = null;
        state.chopped[i] = 0;
      } else if ((isRaw(hand) || isChopped(hand)) && there === null) {
        state.items[i] = hand;
        chef.hand = null;
        if (isRaw(hand)) chef.chop = i;
      }
      break;
    case 'S':
      if (isChopped(hand) && state.pots[i].length < 3) {
        state.pots[i] += hand!.toUpperCase();
        chef.hand = null;
      } else if (hand === 'P' && isCooked(state, i)) {
        chef.hand = `P:${soupKey(state.pots[i])}`;
        state.pots[i] = '';
        state.cooked[i] = 0;
      }
      break;
  }
}

function moveChef(state: KitchenState, seat: number) {
  const chef = state.chefs[seat];
  if (chef.path.length) {
    const [tx, ty] = chef.path[0];
    const dx = Math.sign(tx * UNIT - chef.x);
    const dy = Math.sign(ty * UNIT - chef.y);
    if (dx || dy) chef.face = [dx, dy];
    chef.x += dx;
    chef.y += dy;
    if (chef.x === tx * UNIT && chef.y === ty * UNIT) chef.path.shift();
    if (chef.path.length) return;
  }
  if (chef.goal && chef.x % UNIT === 0 && chef.y % UNIT === 0) {
    const [gx, gy] = chef.goal;
    chef.face = [gx - chef.x / UNIT, gy - chef.y / UNIT];
    chef.goal = null;
    use(state, seat, gx, gy);
  }
}

/** One tick: the taps that take effect now, the chefs, the boards and pots, then the orders. */
export function step(state: KitchenState, actions: readonly Action[] = []) {
  if (isOver(state)) return;
  for (const a of actions) if (a.tick + ACTION_DELAY === state.tick && a.seat < state.chefs.length) sendChef(state, a.seat, a.x, a.y);
  for (let seat = 0; seat < state.chefs.length; seat++) moveChef(state, seat);

  for (const chef of state.chefs) {
    if (chef.chop < 0) continue;
    const i = chef.chop;
    if (!isRaw(state.items[i])) {
      chef.chop = -1;
      continue;
    }
    if (++state.chopped[i] >= CHOP_TICKS) {
      state.items[i] = state.items[i]!.toLowerCase();
      state.chopped[i] = 0;
      chef.chop = -1;
    }
  }
  for (let i = 0; i < state.pots.length; i++) if (state.pots[i].length === 3 && state.cooked[i] < COOK_TICKS) state.cooked[i]++;

  for (const order of state.orders)
    if (order.until <= state.tick) state.events.push({ tick: state.tick, kind: 'missed', soup: order.soup, points: 0, seat: -1 });
  state.orders = state.orders.filter((o) => o.until > state.tick);
  if (state.tick >= state.orderAt && state.orders.length < MAX_ORDERS) newOrder(state);
  else if (state.tick >= state.orderAt) state.orderAt = state.tick + TICKS_PER_SECOND;
  state.tick++;
}

/** Taps in the order they happened (seat order on the same tick), one per seat a tick. */
export function sortActions(actions: readonly Action[]): Action[] {
  const seen = new Set<string>();
  return [...actions]
    .filter(
      (a) =>
        Number.isInteger(a.tick) && a.tick >= 0 && a.tick < GAME_TICKS && Number.isInteger(a.seat) && a.seat >= 0 && a.seat < MAX_CHEFS && Number.isInteger(a.x) && Number.isInteger(a.y) && a.x >= 0 && a.x < COLS && a.y >= 0 && a.y < ROWS,
    )
    .sort((a, b) => a.tick - b.tick || a.seat - b.seat)
    .filter((a) => {
      const key = `${a.seat}:${a.tick}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

/**
 * Plays `state` on to `tick` with `actions` (sorted, from sortActions). Only the taps that
 * take effect from `state.tick` on matter, so a phone can keep stepping one game as time passes.
 */
export function advance(state: KitchenState, actions: readonly Action[], tick: number) {
  let i = 0;
  while (i < actions.length && actions[i].tick + ACTION_DELAY < state.tick) i++;
  const end = Math.min(tick, GAME_TICKS);
  while (state.tick < end) {
    const now: Action[] = [];
    while (i < actions.length && actions[i].tick + ACTION_DELAY === state.tick) now.push(actions[i++]);
    step(state, now);
  }
}

/** The kitchen at `tick` from the seed and every tap, in any order. */
export function simulate(seed: string, kitchen: number, chefs: number, actions: readonly Action[], tick = GAME_TICKS): KitchenState {
  const state = newGame(seed, kitchen, chefs);
  advance(state, sortActions(actions), tick);
  return state;
}

/** Stars earned, 0 to 3. */
export function stars(state: KitchenState): number {
  const bar = KITCHENS[state.kitchen].stars[state.chefs.length - 1];
  return bar.filter((points) => state.score >= points).length;
}
