import {
  ACTION_DELAY,
  COLS,
  GAME_TICKS,
  ROWS,
  advance,
  chefTile,
  isChopped,
  isCooked,
  isRaw,
  isSoup,
  newGame,
  soupKey,
  tileAt,
  walk,
  type Action,
  type KitchenState,
} from './sim';

// A plain kitchen hand, for the tests (and bot seats one day): when its chef has nothing to
// do it picks the next useful tile. It plates cooked soup, serves it, fills pots towards the
// oldest orders and chops what it fetches. Several of them get in each other's way a bit,
// as real cooks do, but between them every order gets made.

type Tile = [number, number];

function tiles(state: KitchenState, kind: string): Tile[] {
  const out: Tile[] = [];
  for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) if (tileAt(state.kitchen, x, y) === kind) out.push([x, y]);
  return out;
}

const at = ([x, y]: Tile) => y * COLS + x;

/** The nearest of `options` by walk, or null if none can be reached. */
function nearest(state: KitchenState, seat: number, options: Tile[]): Tile | null {
  let best: Tile | null = null;
  let length = Infinity;
  for (const [tx, ty] of options) {
    const route = walk(state.kitchen, chefTile(state.chefs[seat]), (x, y) => Math.abs(x - tx) + Math.abs(y - ty) === 1);
    if (route && route.length < length) {
      best = [tx, ty];
      length = route.length;
    }
  }
  return best;
}

/** Whether `have` (letters) could still become `soup`. */
function fits(have: string, soup: string) {
  const left = [...soup];
  for (const c of have.toUpperCase()) {
    const i = left.indexOf(c);
    if (i < 0) return false;
    left.splice(i, 1);
  }
  return true;
}

const wanted = (state: KitchenState) => state.orders.map((o) => o.soup);

/** Whether a pot holding `pot` is worth adding `letter` to for some order. */
const potWants = (state: KitchenState, pot: string, letter: string) => pot.length < 3 && wanted(state).some((soup) => fits(pot + letter, soup));

/** The tile this seat's chef should go to next, or null to wait. */
export function botTarget(state: KitchenState, seat: number): Tile | null {
  const chef = state.chefs[seat];
  const hand = chef.hand;
  const stoves = tiles(state, 'S');
  const boards = tiles(state, 'B');
  const counters = tiles(state, '#').filter((t) => walk(state.kitchen, chefTile(chef), (x, y) => Math.abs(x - t[0]) + Math.abs(y - t[1]) === 1));

  if (isSoup(hand)) return wanted(state).includes(hand!.slice(2)) ? nearest(state, seat, tiles(state, 'H')) : nearest(state, seat, tiles(state, 'X'));
  if (hand === 'P') {
    const done = stoves.filter((t) => isCooked(state, at(t)));
    if (done.length) return nearest(state, seat, done);
    const cooking = stoves.filter((t) => state.pots[at(t)].length === 3);
    return cooking.length ? nearest(state, seat, cooking) : nearest(state, seat, counters.filter((t) => state.items[at(t)] === null));
  }
  if (isChopped(hand)) {
    const pot = nearest(state, seat, stoves.filter((t) => potWants(state, state.pots[at(t)], hand!)));
    if (pot) return pot;
    // A pot full of something no one wants: plate it so it can be tipped away.
    return nearest(state, seat, counters.filter((t) => state.items[at(t)] === null)) ?? nearest(state, seat, tiles(state, 'X'));
  }
  if (isRaw(hand)) return nearest(state, seat, boards.filter((t) => state.items[at(t)] === null)) ?? nearest(state, seat, counters.filter((t) => state.items[at(t)] === null));

  // Empty handed.
  const platesOut = state.chefs.filter((c) => c.hand === 'P').length;
  const ready = stoves.filter((t) => state.pots[at(t)].length === 3);
  const unwanted = stoves.filter((t) => isCooked(state, at(t)) && !wanted(state).includes(soupKey(state.pots[at(t)])));
  if (platesOut < ready.length && (ready.some((t) => state.cooked[at(t)] > 200) || unwanted.length)) return nearest(state, seat, tiles(state, 'P'));
  const choppers = new Set(state.chefs.map((c) => c.chop));
  const toChop = boards.filter((t) => isRaw(state.items[at(t)]) && !choppers.has(at(t)));
  if (toChop.length) return nearest(state, seat, toChop);
  const cut = [...boards, ...counters].filter((t) => isChopped(state.items[at(t)]) && stoves.some((s) => potWants(state, state.pots[at(s)], state.items[at(t)]!)));
  if (cut.length) return nearest(state, seat, cut);
  // Something raw left on a counter while the boards were busy: take it to a free board.
  const parked = counters.filter((t) => isRaw(state.items[at(t)]));
  if (parked.length && boards.some((t) => state.items[at(t)] === null)) return nearest(state, seat, parked);
  // Boards blocked by chopped things no pot wants yet: clear one onto a counter.
  const blocked = boards.filter((t) => isChopped(state.items[at(t)]));
  if (parked.length && blocked.length === boards.length && counters.some((t) => state.items[at(t)] === null)) return nearest(state, seat, blocked);

  // Fetch what a pot still needs, counting what's already on its way.
  const coming = [...state.chefs.map((c) => c.hand), ...state.items].filter((item) => isRaw(item) || isChopped(item)).map((item) => item!.toUpperCase());
  for (const order of state.orders) {
    for (const s of stoves) {
      const pot = state.pots[at(s)];
      if (!fits(pot, order.soup)) continue;
      let need = [...order.soup];
      for (const c of pot) need.splice(need.indexOf(c), 1);
      for (const c of coming) if (need.includes(c)) need.splice(need.indexOf(c), 1);
      need = need.filter((c) => tiles(state, c).length);
      if (need.length) return nearest(state, seat, tiles(state, need[0]));
    }
  }
  return null;
}

/** A whole game of bot chefs: every tap they make. */
export function botGame(seed: string, kitchen: number, chefs: number, until = GAME_TICKS): { actions: Action[]; state: KitchenState } {
  const state = newGame(seed, kitchen, chefs);
  const actions: Action[] = [];
  const free = Array.from({ length: chefs }, () => 0);
  while (state.tick < until) {
    const now = state.tick;
    for (let seat = 0; seat < chefs; seat++) {
      const chef = state.chefs[seat];
      if (now < free[seat] || chef.path.length || chef.goal || chef.chop >= 0) continue;
      const target = botTarget(state, seat);
      if (target) {
        actions.push({ seat, tick: now, x: target[0], y: target[1] });
        free[seat] = now + ACTION_DELAY + 1;
      } else free[seat] = now + 20;
    }
    advance(state, actions, now + 1);
  }
  return { actions, state };
}
