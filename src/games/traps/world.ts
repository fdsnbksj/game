// Trap Tower's world: a tower of ledges to climb from the start at the bottom to the flag
// at the top, and the items players add to it round by round. Everything here is plain
// data in whole numbers. A built world is static during a run: solid cells, plus hazards
// whose positions are pure functions of the tick (a saw's swing, a crossbow's arrow), so a
// run replays the same anywhere from its inputs alone.

export const COLS = 12;
export const ROWS = 20;
/** World units in a cell. Positions and speeds are whole numbers of these units. */
export const TILE = 256;

/** What a cell is made of. Outside the grid counts as rock. */
export type Ground = 'rock' | 'ice' | 'honey' | 'spring' | 'bow';

export type ItemKind = 'block' | 'plank' | 'ice' | 'honey' | 'spring' | 'spikes' | 'saw' | 'bow' | 'bomb';

export const ITEM_KINDS: readonly ItemKind[] = ['block', 'plank', 'ice', 'honey', 'spring', 'spikes', 'saw', 'bow', 'bomb'];

export const ITEMS: Record<ItemKind, { name: string; hint: string; turns: boolean; weight: number }> = {
  block: { name: 'Block', hint: 'One square to stand on.', turns: false, weight: 2 },
  plank: { name: 'Plank', hint: 'Three squares long, flat or upright.', turns: true, weight: 3 },
  ice: { name: 'Ice', hint: 'A slippery plank: hard to stop on.', turns: true, weight: 1 },
  honey: { name: 'Honey', hint: 'A sticky plank: slow, with a tiny jump.', turns: true, weight: 1 },
  spring: { name: 'Spring', hint: 'Land on it to bounce high.', turns: false, weight: 2 },
  spikes: { name: 'Spikes', hint: 'Touch them and you’re out.', turns: false, weight: 3 },
  saw: { name: 'Saw', hint: 'Swings along three squares. Deadly.', turns: true, weight: 2 },
  bow: { name: 'Crossbow', hint: 'Shoots an arrow every second and a half.', turns: true, weight: 2 },
  bomb: { name: 'Bomb', hint: 'Clears every item in a 3×3 square.', turns: false, weight: 1 },
};

/** An item in the tower. `rot` is 0–3: planks and saws lie flat on even turns, a crossbow aims right, down, left, up. */
export interface Placed {
  item: ItemKind;
  x: number;
  y: number;
  rot: number;
  /** The seat that placed it. */
  by: number;
}

export interface Tower {
  name: string;
  /** Rows top to bottom: `#` rock, `S` the start, `F` the flag, `.` air. */
  rows: readonly string[];
}

// Ledges three rows apart at most (a jump reaches a little under four), so every tower can
// be climbed with nothing added; tests/unit/traps.test.ts proves it with a search.
export const TOWERS: readonly Tower[] = [
  {
    name: 'Zigzag',
    rows: [
      '............',
      '.........F..',
      '........####',
      '............',
      '............',
      '...####.....',
      '............',
      '............',
      '####........',
      '............',
      '............',
      '.....####...',
      '............',
      '............',
      '........####',
      '............',
      '............',
      '...###......',
      '.S..........',
      '############',
    ],
  },
  {
    name: 'Chimney',
    rows: [
      '............',
      '.....F......',
      '...######...',
      '............',
      '............',
      '##........##',
      '............',
      '............',
      '....####....',
      '............',
      '............',
      '##........##',
      '............',
      '............',
      '....####....',
      '............',
      '............',
      '##........##',
      '..S.........',
      '############',
    ],
  },
  {
    name: 'Steps',
    rows: [
      '............',
      '..F.........',
      '####........',
      '............',
      '............',
      '.....##.....',
      '............',
      '............',
      '.........###',
      '............',
      '............',
      '....###.....',
      '............',
      '............',
      '###.........',
      '............',
      '............',
      '......###...',
      '..........S.',
      '############',
    ],
  },
];

export interface Cell {
  x: number;
  y: number;
}

function find(tower: Tower, mark: string): Cell {
  for (let y = 0; y < ROWS; y++) {
    const x = tower.rows[y].indexOf(mark);
    if (x >= 0) return { x, y };
  }
  throw new Error(`Tower ${tower.name} has no ${mark}`);
}

export const startOf = (tower: Tower) => find(tower, 'S');
export const flagOf = (tower: Tower) => find(tower, 'F');

/** The cells an item covers: one, or three in a line for planks and a saw's track. A bomb's own cell (its blast is 3×3). */
export function cellsOf(p: Pick<Placed, 'item' | 'x' | 'y' | 'rot'>): Cell[] {
  if (p.item === 'plank' || p.item === 'ice' || p.item === 'honey' || p.item === 'saw') {
    const flat = p.rot % 2 === 0;
    return [0, 1, 2].map((k) => (flat ? { x: p.x + k, y: p.y } : { x: p.x, y: p.y + k }));
  }
  return [{ x: p.x, y: p.y }];
}

const inGrid = (c: Cell) => c.x >= 0 && c.x < COLS && c.y >= 0 && c.y < ROWS;
const near = (a: Cell, b: Cell) => Math.abs(a.x - b.x) <= 1 && Math.abs(a.y - b.y) <= 1;

/**
 * Whether an item may go here, among those already placed: inside the tower, on air, clear
 * of every other item, and not right by the start or the flag. A bomb only needs to be
 * inside the tower.
 */
export function canPlace(tower: Tower, items: readonly Placed[], p: Pick<Placed, 'item' | 'x' | 'y' | 'rot'>): boolean {
  if (!Number.isInteger(p.x) || !Number.isInteger(p.y) || !Number.isInteger(p.rot) || p.rot < 0 || p.rot > 3) return false;
  if (p.item === 'bomb') return inGrid(p);
  const start = startOf(tower);
  const flag = flagOf(tower);
  const taken = new Set(items.flatMap((i) => cellsOf(i).map((c) => c.y * COLS + c.x)));
  return cellsOf(p).every((c) => inGrid(c) && tower.rows[c.y][c.x] !== '#' && !near(c, start) && !near(c, flag) && !taken.has(c.y * COLS + c.x));
}

/** The items left once a bomb at `at` has gone off: any with a cell in the 3×3 around it are cleared. */
export function explode(items: readonly Placed[], at: Cell): Placed[] {
  return items.filter((i) => !cellsOf(i).some((c) => near(c, at)));
}

export interface Saw {
  owner: number;
  /** The track's first cell, and whether it runs across (else up and down). */
  x: number;
  y: number;
  flat: boolean;
}

export interface Bow {
  owner: number;
  x: number;
  y: number;
  /** Which way it shoots, as a unit step. */
  dx: number;
  dy: number;
  /** How far an arrow flies before it hits something, in world units from the muzzle. */
  range: number;
}

export interface World {
  tower: Tower;
  /** Each cell's ground, or null for air; row by row. */
  ground: (Ground | null)[];
  spikes: { owner: number; x: number; y: number }[];
  saws: Saw[];
  bows: Bow[];
  start: Cell;
  flag: Cell;
}

export const BOW_DIRS: readonly Cell[] = [
  { x: 1, y: 0 },
  { x: 0, y: 1 },
  { x: -1, y: 0 },
  { x: 0, y: -1 },
];

export function groundAt(world: World, x: number, y: number): Ground | null {
  if (x < 0 || x >= COLS || y < 0 || y >= ROWS) return 'rock';
  return world.ground[y * COLS + x];
}

/** The tower with its items, ready to run. */
export function buildWorld(tower: Tower, items: readonly Placed[]): World {
  const ground: (Ground | null)[] = [];
  for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) ground.push(tower.rows[y][x] === '#' ? 'rock' : null);
  const world: World = { tower, ground, spikes: [], saws: [], bows: [], start: startOf(tower), flag: flagOf(tower) };
  for (const i of items) {
    const solid: Ground | null = i.item === 'block' || i.item === 'plank' ? 'rock' : i.item === 'ice' ? 'ice' : i.item === 'honey' ? 'honey' : i.item === 'spring' ? 'spring' : i.item === 'bow' ? 'bow' : null;
    if (solid) for (const c of cellsOf(i)) ground[c.y * COLS + c.x] = solid;
    if (i.item === 'spikes') world.spikes.push({ owner: i.by, x: i.x, y: i.y });
    if (i.item === 'saw') world.saws.push({ owner: i.by, x: i.x, y: i.y, flat: i.rot % 2 === 0 });
  }
  // Ranges once everything solid is in: an arrow flies until the first solid cell.
  for (const i of items) {
    if (i.item !== 'bow') continue;
    const d = BOW_DIRS[i.rot];
    let cells = 0;
    while (!groundAt(world, i.x + d.x * (cells + 1), i.y + d.y * (cells + 1))) cells++;
    world.bows.push({ owner: i.by, x: i.x, y: i.y, dx: d.x, dy: d.y, range: cells * TILE });
  }
  return world;
}
