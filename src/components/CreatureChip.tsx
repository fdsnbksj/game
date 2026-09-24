import { useId } from 'react';
import { CREATURE_ART, CREATURE_SIZE, GLOSS, INK, OUTLINE, glossEllipse, shadeEllipse, type Part } from '../shared/creatureArt';

/** One part: its fill, then the shade and highlight clipped to it, then its outline. */
function PartSvg({ part, clipId }: { part: Part; clipId: string }) {
  const clipped = part.shade !== undefined || part.gloss;
  const shade = shadeEllipse(part.box);
  const gloss = glossEllipse(part.box);
  return (
    <g opacity={part.opacity}>
      {clipped && (
        <clipPath id={clipId}>
          <path d={part.d} />
        </clipPath>
      )}
      {part.fill && <path d={part.d} fill={part.fill} />}
      {part.shade && <ellipse cx={shade.cx} cy={shade.cy} rx={shade.rx} ry={shade.ry} fill={part.shade} clipPath={`url(#${clipId})`} />}
      {part.gloss && <ellipse cx={gloss.cx} cy={gloss.cy} rx={gloss.rx} ry={gloss.ry} fill={GLOSS} clipPath={`url(#${clipId})`} />}
      {part.line && <path d={part.d} fill="none" stroke={part.line.color} strokeWidth={part.line.width} strokeLinecap="round" strokeLinejoin="round" />}
      {part.outline && <path d={part.d} fill="none" stroke={INK} strokeWidth={OUTLINE} strokeLinejoin="round" />}
    </g>
  );
}

/** A creature as inline SVG, for the shop, sheets and lists. */
export function CreatureChip({ unitId, size = 40 }: { unitId: string; size?: number }) {
  // Clip paths are looked up by id across the whole page, so each chip needs its own.
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  return (
    <svg className="creature-chip" viewBox={`0 0 ${CREATURE_SIZE} ${CREATURE_SIZE}`} width={size} height={size} aria-hidden="true">
      {(CREATURE_ART[unitId]?.parts ?? []).map((part, i) => (
        <PartSvg key={i} part={part} clipId={`c${id}-${i}`} />
      ))}
    </svg>
  );
}
