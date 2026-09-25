import { CREATURE_ART, CREATURE_SIZE, INK, OUTLINE, type Part } from '../shared/creatureArt';

/** One part: its fill, then its line or outline. */
function PartSvg({ part }: { part: Part }) {
  return (
    <g opacity={part.opacity}>
      {part.fill && <path d={part.d} fill={part.fill} />}
      {part.line && <path d={part.d} fill="none" stroke={part.line.color} strokeWidth={part.line.width} strokeLinecap="round" strokeLinejoin="round" />}
      {part.outline && <path d={part.d} fill="none" stroke={INK} strokeWidth={OUTLINE} strokeLinejoin="round" />}
    </g>
  );
}

/** A creature as inline SVG, for the shop, sheets and lists. */
export function CreatureChip({ unitId, size = 40 }: { unitId: string; size?: number }) {
  return (
    <svg className="creature-chip" viewBox={`0 0 ${CREATURE_SIZE} ${CREATURE_SIZE}`} width={size} height={size} aria-hidden="true">
      {(CREATURE_ART[unitId]?.parts ?? []).map((part, i) => (
        <PartSvg key={i} part={part} />
      ))}
    </svg>
  );
}
