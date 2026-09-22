import type { TraitId } from '../sim/balance';

/** One glyph per trait, so a trait reads at a glance where its name won't fit. */
const GLYPHS: Record<TraitId, { color: string; path: string }> = {
  voltage: { color: '#ffd23f', path: 'M13 2 5 13h5l-1 9 8-11h-5z' },
  glitch: { color: '#ff3df0', path: 'M4 4h8v7H4zM12 13h8v7h-8zM14 5h6v4h-6zM4 15h6v4H4z' },
  chrome: { color: '#c9d4e8', path: 'M12 2 20 6v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6z' },
  toxin: { color: '#7cff3d', path: 'M12 2c3 4 6 7.5 6 11a6 6 0 0 1-12 0c0-3.5 3-7 6-11z' },
  prism: { color: '#9ff3ff', path: 'M12 3 21 20H3zM12 8l-4.6 9h9.2z' },
  bruiser: { color: '#ff9a3d', path: 'M6 7h12a2 2 0 0 1 2 2v6a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5V9a2 2 0 0 1 2-2zM8 3h8v3H8z' },
  striker: { color: '#ff5a5f', path: 'M19 3 21 5 9 17l-3 1 1-3zM4 18l2 2-2 1z' },
  caster: { color: '#b77cff', path: 'M12 2l2.6 6.4L21 9l-5 4.4L17.5 20 12 16.6 6.5 20 8 13.4 3 9l6.4-.6z' },
  support: { color: '#36e2ff', path: 'M9 3h6v6h6v6h-6v6H9v-6H3V9h6z' },
};

export const traitColor = (id: TraitId) => GLYPHS[id].color;

export function TraitIcon({ trait, size = 16, muted = false }: { trait: TraitId; size?: number; muted?: boolean }) {
  const glyph = GLYPHS[trait];
  return (
    <svg className="trait-icon" viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <path d={glyph.path} fill={muted ? 'rgb(255 255 255 / 0.35)' : glyph.color} fillRule="evenodd" />
    </svg>
  );
}
