import { PART_SHAPES, PART_SIZE, type Paint, type Shape } from '../shared/birdShapes';
import { DEFAULT_LOADOUT, getItem } from '../shared/items';
import type { Loadout, Slot } from '../shared/types';

const hex = (color: number) => `#${color.toString(16).padStart(6, '0')}`;

function ShapeSvg({ shape, tint }: { shape: Shape; tint: number }) {
  const color = hex(shape.paint === 'tint' ? tint : (shape.paint as Exclude<Paint, 'tint'>));
  switch (shape.type) {
    case 'circle':
      return <circle cx={shape.x} cy={shape.y} r={shape.r} fill={color} />;
    case 'ellipse':
      return <ellipse cx={shape.x} cy={shape.y} rx={shape.width / 2} ry={shape.height / 2} fill={color} />;
    case 'triangle':
      return <polygon points={shape.points.join(' ')} fill={color} />;
    case 'rect':
      return <rect x={shape.x} y={shape.y} width={shape.width} height={shape.height} fill={color} />;
    case 'line':
      return <line x1={shape.x1} y1={shape.y1} x2={shape.x2} y2={shape.y2} stroke={color} strokeWidth={shape.width} />;
  }
}

/** Shapes for the item in a slot, falling back to the default if a stored loadout names a retired item. */
function partShapes(loadout: Loadout, slot: Slot) {
  const key = getItem(loadout[slot])?.spriteKey ?? DEFAULT_LOADOUT[slot];
  return PART_SHAPES[key] ?? [];
}

/** A small still of a player's bird, cheap enough to show one per leaderboard row. */
export function BirdChip({ loadout, size = 32 }: { loadout: Loadout; size?: number }) {
  const layers: [readonly Shape[], number][] = [
    [partShapes(loadout, 'body'), loadout.colors.body],
    [partShapes(loadout, 'wing'), loadout.colors.wing],
    [PART_SHAPES.face, 0],
    [partShapes(loadout, 'hat'), 0],
  ];
  return (
    <svg className="bird-chip" viewBox={`0 0 ${PART_SIZE} ${PART_SIZE}`} width={size} height={size} aria-hidden="true">
      {layers.flatMap(([shapes, tint], layer) =>
        shapes.map((shape, i) => <ShapeSvg key={`${layer}-${i}`} shape={shape} tint={tint} />),
      )}
    </svg>
  );
}
