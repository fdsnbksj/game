import { EDGES, HARBOUR_SLOTS, HEXES, VERTICES } from '../../games/isle/board';
import { pips, type Res } from '../../games/isle/setup';
import type { IsleState } from '../../games/isle/state';

// The island as one SVG, in hex-size units. Only the spots you can use right now are
// drawn as targets (gold rings, big enough for a thumb); everything else is inert.

export const PLAYER_COLORS = ['var(--isle-p1)', 'var(--isle-p2)', 'var(--isle-p3)', 'var(--isle-p4)'];

const RES_LETTERS: Record<Res, string> = { brick: 'Br', lumber: 'Lu', wool: 'Wo', grain: 'Gr', ore: 'Or' };

const xs = [...VERTICES.map((v) => v.x), ...HARBOUR_SLOTS.map((h) => h.x)];
const ys = [...VERTICES.map((v) => v.y), ...HARBOUR_SLOTS.map((h) => h.y)];
const PAD = 0.45;
const VIEW = [Math.min(...xs) - PAD, Math.min(...ys) - PAD, Math.max(...xs) - Math.min(...xs) + 2 * PAD, Math.max(...ys) - Math.min(...ys) + 2 * PAD];

const corners = (h: number) => HEXES[h].vertices.map((v) => `${VERTICES[v].x},${VERTICES[v].y}`).join(' ');

export interface Targets {
  vertices?: number[];
  edges?: number[];
  hexes?: number[];
}

export function IslandMap({
  state,
  targets,
  pending,
  onVertex,
  onEdge,
  onHex,
}: {
  state: IsleState;
  targets: Targets;
  /** A settlement chosen but not yet sent (the opening's first tap). */
  pending?: { vertex: number; seat: number } | null;
  onVertex: (v: number) => void;
  onEdge: (e: number) => void;
  onHex: (h: number) => void;
}) {
  const { terrain, numbers, harbours } = state.setup;
  return (
    <svg className="island" viewBox={VIEW.join(' ')} role="img" aria-label="The island">
      <polygon className="isle-sea" points={seaOutline()} />

      {HARBOUR_SLOTS.map((slot, i) => {
        const { a, b } = EDGES[slot.edge];
        const kind = harbours[i];
        return (
          <g key={`h${i}`} className="isle-harbour">
            {[a, b].map((v) => (
              <line key={v} x1={slot.x} y1={slot.y} x2={VERTICES[v].x} y2={VERTICES[v].y} />
            ))}
            <circle cx={slot.x} cy={slot.y} r={0.3} />
            <text x={slot.x} y={slot.y - 0.04} className="isle-harbour-rate">
              {kind === 'any' ? '3:1' : '2:1'}
            </text>
            {kind !== 'any' && (
              <text x={slot.x} y={slot.y + 0.17} className="isle-harbour-res">
                {RES_LETTERS[kind]}
              </text>
            )}
          </g>
        );
      })}

      {HEXES.map((_, h) => (
        <polygon key={h} className={`isle-hex t-${terrain[h]}`} points={corners(h)} />
      ))}

      {HEXES.map((hex, h) => {
        const n = numbers[h];
        if (n === null) return null;
        const dots = pips(n);
        return (
          <g key={`n${h}`} className={dots === 5 ? 'isle-token hot' : 'isle-token'}>
            <circle cx={hex.x} cy={hex.y} r={0.34} />
            <text x={hex.x} y={hex.y + 0.02}>{n}</text>
            {Array.from({ length: dots }, (_, i) => (
              <circle key={i} className="pip" cx={hex.x + (i - (dots - 1) / 2) * 0.075} cy={hex.y + 0.2} r={0.025} />
            ))}
          </g>
        );
      })}

      <Robber x={HEXES[state.robber].x} y={HEXES[state.robber].y} />

      {state.roads.map((seat, e) => {
        if (seat === null) return null;
        const { a, b } = EDGES[e];
        const [x1, y1, x2, y2] = inset(a, b, 0.16);
        return <line key={`r${e}`} className="isle-road" x1={x1} y1={y1} x2={x2} y2={y2} stroke={PLAYER_COLORS[seat]} />;
      })}

      {state.buildings.map((b, v) => (b ? <Piece key={`b${v}`} v={v} seat={b.seat} city={b.city} /> : null))}
      {pending && <Piece v={pending.vertex} seat={pending.seat} city={false} />}

      {targets.hexes?.map((h) => (
        <g key={`th${h}`} className="isle-target hex" onClick={() => onHex(h)}>
          <polygon points={corners(h)} />
          <circle cx={HEXES[h].x} cy={HEXES[h].y} r={0.48} />
        </g>
      ))}
      {targets.edges?.map((e) => {
        const { a, b } = EDGES[e];
        const x = (VERTICES[a].x + VERTICES[b].x) / 2;
        const y = (VERTICES[a].y + VERTICES[b].y) / 2;
        return (
          <g key={`te${e}`} className="isle-target" onClick={() => onEdge(e)}>
            <circle className="hit" cx={x} cy={y} r={0.36} />
            <circle className="ring" cx={x} cy={y} r={0.17} />
          </g>
        );
      })}
      {targets.vertices?.map((v) => (
        <g key={`tv${v}`} className="isle-target" onClick={() => onVertex(v)}>
          <circle className="hit" cx={VERTICES[v].x} cy={VERTICES[v].y} r={0.42} />
          <circle className="ring" cx={VERTICES[v].x} cy={VERTICES[v].y} r={0.2} />
        </g>
      ))}
    </svg>
  );
}

/** A road drawn a little short of its corners, so the buildings stay clear. */
function inset(a: number, b: number, by: number): [number, number, number, number] {
  const A = VERTICES[a];
  const B = VERTICES[b];
  return [A.x + (B.x - A.x) * by, A.y + (B.y - A.y) * by, B.x + (A.x - B.x) * by, B.y + (A.y - B.y) * by];
}

function Piece({ v, seat, city }: { v: number; seat: number; city: boolean }) {
  const { x, y } = VERTICES[v];
  // Drawn in a 1-unit box centred on the corner.
  const d = city ? 'M-.3 .22V-.06L-.15-.2 0-.06V-.02H.3V.22z' : 'M-.17 .17V-.04L0-.2 .17-.04V.17z';
  return <path className="isle-piece" d={d} transform={`translate(${x} ${y})`} fill={PLAYER_COLORS[seat]} />;
}

function Robber({ x, y }: { x: number; y: number }) {
  return (
    <g className="isle-robber" transform={`translate(${x + 0.42} ${y - 0.12})`} aria-label="The robber">
      <circle cx={0} cy={-0.13} r={0.09} />
      <path d="M-.12 .2C-.12 0-.08-.05 0-.05S.12 0 .12 .2z" />
    </g>
  );
}

/** A sea around the island: the hexes' outer corners pushed out. */
function seaOutline(): string {
  const outer = VERTICES.map((v, i) => ({ i, v })).filter(({ v }) => v.hexes.length < 3);
  // Round the centre: upper half first, then by cross product within each half.
  const half = (p: { x: number; y: number }) => (p.y < 0 || (p.y === 0 && p.x > 0) ? 0 : 1);
  outer.sort((p, q) => half(p.v) - half(q.v) || q.v.x * p.v.y - q.v.y * p.v.x);
  return outer.map(({ v }) => `${v.x * 1.13},${v.y * 1.13}`).join(' ');
}
