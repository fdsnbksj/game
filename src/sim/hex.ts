// The battle board: 7 columns by 8 rows of pointy-top hexes, odd rows shifted right
// ("odd-r"). Cells are numbered row * 7 + col. Rows 0–3 are the top side, 4–7 the bottom.
//
// A player's own board is the 7x4 half they place on, numbered the same way with row 0 at
// the front (nearest the enemy). Their side of a fight decides where that half lands.

export const COLS = 7;
export const ROWS = 8;
export const SIDE_ROWS = 4;
export const SIDE_CELLS = COLS * SIDE_ROWS;
export const BATTLE_CELLS = COLS * ROWS;

export type Side = 'a' | 'b';

/**
 * Side a fights from the bottom. Side b is mirrored through the board's centre:
 * (row, col) → (7 − row, 6 − col). On an odd-r grid that point reflection is exact;
 * flipping the rows alone would shift every other row by half a hex.
 */
export function toBattleCell(ownCell: number, side: Side): number {
  const row = SIDE_ROWS + Math.floor(ownCell / COLS);
  const col = ownCell % COLS;
  return side === 'a' ? row * COLS + col : (ROWS - 1 - row) * COLS + (COLS - 1 - col);
}

function axial(cell: number): [number, number] {
  const row = Math.floor(cell / COLS);
  const col = cell % COLS;
  return [col - (row - (row & 1)) / 2, row];
}

export function distance(a: number, b: number): number {
  const [q1, r1] = axial(a);
  const [q2, r2] = axial(b);
  const dq = q1 - q2;
  const dr = r1 - r2;
  return (Math.abs(dq) + Math.abs(dr) + Math.abs(dq + dr)) / 2;
}

// Neighbour offsets as [dcol, drow], in a fixed order so paths are deterministic.
const EVEN_ROW: readonly [number, number][] = [[1, 0], [0, -1], [-1, -1], [-1, 0], [-1, 1], [0, 1]];
const ODD_ROW: readonly [number, number][] = [[1, 0], [1, -1], [0, -1], [-1, 0], [0, 1], [1, 1]];

export function neighbors(cell: number): number[] {
  const row = Math.floor(cell / COLS);
  const col = cell % COLS;
  const result: number[] = [];
  for (const [dc, dr] of row & 1 ? ODD_ROW : EVEN_ROW) {
    const c = col + dc;
    const r = row + dr;
    if (c >= 0 && c < COLS && r >= 0 && r < ROWS) result.push(r * COLS + c);
  }
  return result;
}

/**
 * First step on a shortest path from `from` to any cell where `isGoal` holds, walking
 * only through cells that aren't blocked. Null if there is no path, or `from` is a goal.
 */
export function firstStep(from: number, isGoal: (cell: number) => boolean, isBlocked: (cell: number) => boolean): number | null {
  if (isGoal(from)) return null;
  const firstMove = new Array<number>(BATTLE_CELLS).fill(-1);
  const seen = new Array<boolean>(BATTLE_CELLS).fill(false);
  seen[from] = true;
  const queue: number[] = [];
  for (const next of neighbors(from)) {
    if (isBlocked(next)) continue;
    seen[next] = true;
    firstMove[next] = next;
    queue.push(next);
  }
  for (let i = 0; i < queue.length; i++) {
    const cell = queue[i];
    if (isGoal(cell)) return firstMove[cell];
    for (const next of neighbors(cell)) {
      if (seen[next] || isBlocked(next)) continue;
      seen[next] = true;
      firstMove[next] = firstMove[cell];
      queue.push(next);
    }
  }
  return null;
}
