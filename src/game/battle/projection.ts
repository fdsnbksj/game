// The board is laid out flat (a top-down hex grid) and drawn tilted away from the viewer,
// like a table seen from the near edge. Rows shrink toward the far edge and bunch up, so
// the rival's half reads as further away. This maps flat layout points to the screen and
// back; it has no Phaser in it, so it can be tested on its own.

export interface Tilt {
  /** The centre line, which doesn't move sideways. */
  cx: number;
  /** The flat layout's far and near edges. */
  top: number;
  bottom: number;
  /** Where the far edge lands on screen. */
  screenTop: number;
  /** Scale at the far edge; the near edge is 1. */
  far: number;
  /** How flat the table lies: 1 is top-down, lower is more tilted. */
  squash: number;
}

export interface Projected {
  x: number;
  y: number;
  /** How big things are drawn at this depth. */
  scale: number;
}

const depthOf = (tilt: Tilt, y: number) => (y - tilt.top) / (tilt.bottom - tilt.top);
const scaleAt = (tilt: Tilt, t: number) => tilt.far + (1 - tilt.far) * t;

/**
 * Screen y is the running total of the scale down the table, so rows get closer together
 * exactly as fast as things in them get smaller, and the spacing never folds back.
 */
const screenYAt = (tilt: Tilt, t: number) => tilt.screenTop + tilt.squash * (tilt.bottom - tilt.top) * (tilt.far * t + ((1 - tilt.far) * t * t) / 2);

export function project(tilt: Tilt, x: number, y: number): Projected {
  const t = depthOf(tilt, y);
  const scale = scaleAt(tilt, t);
  return { x: tilt.cx + (x - tilt.cx) * scale, y: screenYAt(tilt, t), scale };
}

/** The depth on screen for a screen y: the inverse of screenYAt. */
function depthAtScreenY(tilt: Tilt, y: number) {
  const a = (1 - tilt.far) / 2;
  const b = tilt.far;
  const c = -(y - tilt.screenTop) / (tilt.squash * (tilt.bottom - tilt.top));
  if (a === 0) return -c / b;
  return (-b + Math.sqrt(Math.max(0, b * b - 4 * a * c))) / (2 * a);
}

/** How big things are drawn at a screen y. */
export const scaleAtScreenY = (tilt: Tilt, y: number) => scaleAt(tilt, depthAtScreenY(tilt, y));

/** The flat layout point under a screen point. */
export function unproject(tilt: Tilt, x: number, y: number) {
  const t = depthAtScreenY(tilt, y);
  const scale = scaleAt(tilt, t);
  return { x: tilt.cx + (x - tilt.cx) / scale, y: tilt.top + t * (tilt.bottom - tilt.top) };
}

/** A flat hexagon's corners on screen: pointy-topped, as the grid is. */
export function projectHex(tilt: Tilt, cx: number, cy: number, radius: number) {
  const points: { x: number; y: number }[] = [];
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 180) * (60 * i - 30);
    const { x, y } = project(tilt, cx + radius * Math.cos(angle), cy + radius * Math.sin(angle));
    points.push({ x, y });
  }
  return points;
}
