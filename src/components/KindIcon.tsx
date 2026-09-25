import type { Kind } from '../sim/balance';

/** A filled circle, for glyphs built out of dots. */
const dot = (x: number, y: number, r: number) => `M${x - r} ${y}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0z`;

/**
 * One glyph per way of fighting. Each is a list of paths, filled separately, so pieces
 * can overlap without the even-odd rule punching holes where they meet.
 */
const GLYPHS: Record<Kind, string[]> = {
  // A sword, point up and to the right.
  fighter: ['M20.5 2.5L21.5 3.5 20.8 7 10.5 17.3 7.7 14.5 18 4.2z', 'M4.9 13.7l1.4-1.4 6.4 6.4-1.4 1.4z', 'M7.4 17.2l1.4 1.4-3.9 3.9-1.4-1.4z', dot(3.2, 21.8, 1.6)],
  // A wand, with a sparkle off its tip.
  mage: ['M2.6 19.9L13.3 9.2l2.1 2.1L4.7 22z', 'M18 1Q18.6 5.4 23 6Q18.6 6.6 18 11Q17.4 6.6 13 6Q17.4 5.4 18 1z', 'M9.5 3.5Q9.8 5.7 12 6Q9.8 6.3 9.5 8.5Q9.2 6.3 7 6Q9.2 5.7 9.5 3.5z'],
  // A shield.
  tank: ['M12 1.5l8.5 3.2v6.3c0 5.8-3.6 9.9-8.5 11.5C7.1 20.9 3.5 16.8 3.5 11V4.7z' + 'M12 5l5.5 2.1v4c0 3.8-2.3 6.6-5.5 7.8z'],
  // Crosshairs.
  marksman: [dot(12, 12, 8.5) + dot(12, 12, 6.3), 'M10.9 1h2.2v6h-2.2zM10.9 17h2.2v6h-2.2zM1 10.9h6v2.2H1zM17 10.9h6v2.2h-6z', dot(12, 12, 1.8)],
};

export function KindIcon({ kind, size = 16 }: { kind: Kind; size?: number }) {
  return (
    <svg className="kind-icon" viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      {GLYPHS[kind].map((d) => (
        <path key={d} d={d} fill="currentColor" fillRule="evenodd" />
      ))}
    </svg>
  );
}
