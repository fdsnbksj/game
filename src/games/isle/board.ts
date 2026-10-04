// The island's shape, the same in every game: 19 hexes (axial coordinates, radius 2,
// pointy-top), their 54 corners (where settlements go) and 72 sides (where roads go),
// and the 9 harbour spots on the coast. Positions are in hex-size units, for drawing.

export interface Hex {
  q: number;
  r: number;
  x: number;
  y: number;
  /** Its six corners, clockwise from the top. */
  vertices: number[];
}

export interface Vertex {
  x: number;
  y: number;
  hexes: number[];
  edges: number[];
  /** Corners one road away. */
  neighbours: number[];
}

export interface Edge {
  /** Its two ends. */
  a: number;
  b: number;
  hexes: number[];
}

export interface HarbourSlot {
  /** The coast edge it sits on; both its corners use the harbour. */
  edge: number;
  /** Where to draw it: off the coast, outward from the island. */
  x: number;
  y: number;
}

const SQRT3 = Math.sqrt(3);
// Corner offsets clockwise from the top, written out so no trigonometry is needed: its
// results may differ by engine, and every phone must agree (tests/unit/purity.test.ts).
const CORNERS = [
  [0, -1],
  [SQRT3 / 2, -0.5],
  [SQRT3 / 2, 0.5],
  [0, 1],
  [-SQRT3 / 2, 0.5],
  [-SQRT3 / 2, -0.5],
];

function build() {
  const hexes: Hex[] = [];
  const vertices: Vertex[] = [];
  const edges: Edge[] = [];
  const vertexAt = new Map<string, number>();
  const edgeAt = new Map<string, number>();
  const key = (x: number, y: number) => `${Math.round(x * 1000)},${Math.round(y * 1000)}`;

  for (let r = -2; r <= 2; r++) {
    for (let q = Math.max(-2, -2 - r); q <= Math.min(2, 2 - r); q++) {
      const x = SQRT3 * (q + r / 2);
      const y = 1.5 * r;
      const hex = hexes.length;
      const corners: number[] = [];
      for (let i = 0; i < 6; i++) {
        const vx = x + CORNERS[i][0];
        const vy = y + CORNERS[i][1];
        let v = vertexAt.get(key(vx, vy));
        if (v === undefined) {
          v = vertices.length;
          vertexAt.set(key(vx, vy), v);
          vertices.push({ x: vx, y: vy, hexes: [], edges: [], neighbours: [] });
        }
        vertices[v].hexes.push(hex);
        corners.push(v);
      }
      hexes.push({ q, r, x, y, vertices: corners });
      for (let i = 0; i < 6; i++) {
        const [a, b] = [corners[i], corners[(i + 1) % 6]].sort((m, n) => m - n);
        let e = edgeAt.get(`${a}-${b}`);
        if (e === undefined) {
          e = edges.length;
          edgeAt.set(`${a}-${b}`, e);
          edges.push({ a, b, hexes: [] });
          vertices[a].edges.push(e);
          vertices[b].edges.push(e);
          vertices[a].neighbours.push(b);
          vertices[b].neighbours.push(a);
        }
        edges[e].hexes.push(hex);
      }
    }
  }

  // The coast, walked in order round the island, and a harbour every 3, 3, 4 sides.
  const coast = edges.flatMap((e, i) => (e.hexes.length === 1 ? [i] : []));
  const ring: number[] = [coast[0]];
  let at = edges[coast[0]].b;
  while (ring.length < coast.length) {
    const next = vertices[at].edges.find((e) => coast.includes(e) && !ring.includes(e))!;
    ring.push(next);
    at = edges[next].a === at ? edges[next].b : edges[next].a;
  }
  const harbours: HarbourSlot[] = [0, 3, 6, 10, 13, 16, 20, 23, 26].map((i) => {
    const edge = ring[i];
    const { a, b } = edges[edge];
    const mx = (vertices[a].x + vertices[b].x) / 2;
    const my = (vertices[a].y + vertices[b].y) / 2;
    const len = Math.sqrt(mx * mx + my * my);
    return { edge, x: mx + (mx / len) * 0.55, y: my + (my / len) * 0.55 };
  });

  return { hexes, vertices, edges, harbours };
}

export const { hexes: HEXES, vertices: VERTICES, edges: EDGES, harbours: HARBOUR_SLOTS } = build();

/** Hexes that share a side. */
export function hexNeighbours(hex: number): number[] {
  const { q, r } = HEXES[hex];
  const dirs = [
    [1, 0],
    [1, -1],
    [0, -1],
    [-1, 0],
    [-1, 1],
    [0, 1],
  ];
  return dirs.flatMap(([dq, dr]) => {
    const i = HEXES.findIndex((h) => h.q === q + dq && h.r === r + dr);
    return i >= 0 ? [i] : [];
  });
}

/** The edge between two corners, if they're one road apart. */
export function edgeBetween(a: number, b: number): number | undefined {
  return VERTICES[a].edges.find((e) => EDGES[e].a === b || EDGES[e].b === b);
}

export const otherEnd = (edge: number, v: number) => (EDGES[edge].a === v ? EDGES[edge].b : EDGES[edge].a);
