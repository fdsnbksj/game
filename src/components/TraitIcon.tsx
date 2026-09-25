import type { TraitId } from '../sim/balance';

/** A filled circle, for glyphs built out of dots. */
const dot = (x: number, y: number, r: number) => `M${x - r} ${y}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0z`;

/** The dots of a loading spinner, fading from big to small. */
const spinner = Array.from({ length: 8 }, (_, i) => {
  const angle = (i * Math.PI) / 4 - Math.PI / 2;
  return dot(Math.round((12 + 8 * Math.cos(angle)) * 10) / 10, Math.round((12 + 8 * Math.sin(angle)) * 10) / 10, 2.4 - i * 0.2);
}).join('');

/**
 * One meme glyph per trait, so a trait reads at a glance where its name won't fit. Holes
 * (eyes, the flame's core) are cut with the even-odd rule.
 */
const GLYPHS: Record<TraitId, string> = {
  // Zoomies: fast-forward, with a speed line.
  voltage: 'M7 5l7 7-7 7-2.5-2.5L9 12 4.5 7.5zM14 5l7 7-7 7-2.5-2.5L16 12l-4.5-4.5zM0 11h3v2H0z',
  // Lag: the loading spinner.
  glitch: spinner,
  // Sigma.
  chrome: 'M5 3h14v4h-3V6H9.5l5 6-5 6H16v-1h3v4H5v-2.5L11 12 5 5.5z',
  // Toxic: a skull.
  toxin:
    'M12 2C7 2 3.5 5.5 3.5 10c0 3 1.5 5 3.5 6v3a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1v-3c2-1 3.5-3 3.5-6C20.5 5.5 17 2 12 2z' +
    dot(8.5, 11, 2) + dot(15.5, 11, 2) + 'M12 13.5l1.3 2.5h-2.6zM10 17.5h1v2.5h-1zM13 17.5h1v2.5h-1z',
  // Aura: sparkles.
  prism: 'M10 4Q11 12 18 13Q11 14 10 22Q9 14 2 13Q9 12 10 4zM18.5 1.5Q19 5 22.5 5.5Q19 6 18.5 9.5Q18 6 14.5 5.5Q18 5 18.5 1.5z',
  // Chonk: a very round cat.
  bruiser: 'M4 21c-1.5-3.5-1.5-7.5 1-10.5L4 3l5 4.3c2-.7 4-.7 6 0L20 3l-1 7.5c2.5 3 2.5 7 1 10.5z' + dot(9.5, 13.5, 1.2) + dot(14.5, 13.5, 1.2),
  // Bonk: a bat, mid-swing.
  striker: 'M3.15 19.15L14.9 4.9A3 3 0 0 1 19.1 9.1L4.85 20.85z' + dot(3.6, 20.4, 1.9) + 'M20.5 12.3l2.6.6-.2 1-2.6-.6zM18.8 15l1.9 1.8-.7.7-1.9-1.8zM16 16.4l.9 2.5-.9.3-.9-2.5z',
  // Cooking: let it cook.
  caster: 'M12 2c1 4 6 6 6 12a6 6 0 0 1-12 0c0-3 1.5-5 3-6 0 2 1 3 2 3 0-3-.5-6 1-9zM12 14c1.5 1 2.5 2 2.5 3.5a2.5 2.5 0 0 1-5 0c0-1.5 1-2.5 2.5-3.5z',
  // Hype: the megaphone.
  support: 'M2 9h4.5L16 4v16l-9.5-5H2zM4 15.5h3l1 5H5zM18 8.5l2.8-1.4.7 1.3-2.8 1.4zM18.5 11.3H22v1.4h-3.5zM18 15.5l.7-1.3 2.8 1.4-.7 1.3z',
};

/** In the trait's own colour, from the stylesheet, so both schemes work with no JS. */
export function TraitIcon({ trait, size = 16, muted = false }: { trait: TraitId; size?: number; muted?: boolean }) {
  return (
    <svg
      className={muted ? 'trait-icon muted' : 'trait-icon'}
      viewBox="0 0 24 24"
      width={size}
      height={size}
      aria-hidden="true"
      style={{ color: `var(--trait-${trait})` }}
    >
      <path d={GLYPHS[trait]} fill="currentColor" fillRule="evenodd" />
    </svg>
  );
}
