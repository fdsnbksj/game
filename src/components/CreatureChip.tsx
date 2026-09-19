import { CREATURE_SHAPES, CREATURE_SIZE, type Shape } from '../shared/creatureShapes';

const hex = (color: number) => `#${color.toString(16).padStart(6, '0')}`;

function ShapeSvg({ shape }: { shape: Shape }) {
  const fill = hex(shape.color);
  switch (shape.type) {
    case 'circle':
      return <circle cx={shape.x} cy={shape.y} r={shape.r} fill={fill} />;
    case 'ellipse':
      return <ellipse cx={shape.x} cy={shape.y} rx={shape.width / 2} ry={shape.height / 2} fill={fill} />;
    case 'polygon':
      return <polygon points={shape.points.join(' ')} fill={fill} />;
    case 'rect':
      return <rect x={shape.x} y={shape.y} width={shape.width} height={shape.height} fill={fill} />;
    case 'line':
      return (
        <line x1={shape.x1} y1={shape.y1} x2={shape.x2} y2={shape.y2} stroke={fill} strokeWidth={shape.width} strokeLinecap="round" />
      );
  }
}

/** A creature as inline SVG, for the shop, sheets and lists. */
export function CreatureChip({ unitId, size = 40 }: { unitId: string; size?: number }) {
  return (
    <svg className="creature-chip" viewBox={`0 0 ${CREATURE_SIZE} ${CREATURE_SIZE}`} width={size} height={size} aria-hidden="true">
      {(CREATURE_SHAPES[unitId] ?? []).map((shape, i) => (
        <ShapeSvg key={i} shape={shape} />
      ))}
    </svg>
  );
}
