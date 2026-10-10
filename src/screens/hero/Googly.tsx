// A big round cartoon eye: a white ball with an ink ring, a fat pupil sitting low and a glint.
// (It rolled about in the wacky look; `beat` is kept for that, unused now.) Shared by the hero,
// the creatures and costumes.

export function Googly({ x, y, r, beat = 0, ring = 2.5 }: { x: number; y: number; r: number; beat?: number; ring?: number }) {
  return (
    <g>
      <circle className="s-eye s-ink" cx={x} cy={y} r={r} strokeWidth={ring} />
      <g className="googly" style={{ animationDelay: `${-beat * 0.37}s` }}>
        <circle className="s-pupil" cx={x} cy={y + r * 0.3} r={r * 0.48} />
        <circle className="s-glint" cx={x - r * 0.15} cy={y + r * 0.12} r={r * 0.13} />
      </g>
    </g>
  );
}
