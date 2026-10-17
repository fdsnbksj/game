/** Each game as a small emblem: on home's list and anywhere a game is named. */

/** A few squares filled in, like a puzzle half done. */
export const NonogramGlyph = () => (
  <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true">
    {[0, 1, 2].flatMap((r) =>
      [0, 1, 2].map((c) => (
        <rect
          key={`${r}${c}`}
          x={3 + c * 6.5}
          y={3 + r * 6.5}
          width="5"
          height="5"
          rx="1.2"
          fill="currentColor"
          opacity={[1, 0.25, 1, 1, 1, 0.25, 0.25, 1, 1][r * 3 + c]}
        />
      )),
    )}
  </svg>
);

/** A crown, for the court of Avalon. */
export const AvalonGlyph = () => (
  <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true">
    <path d="M3 8l4.5 4L12 5l4.5 7L21 8l-2 10H5L3 8z" fill="currentColor" opacity="0.9" />
    <rect x="5" y="19.5" width="14" height="2" rx="1" fill="currentColor" />
  </svg>
);

export const WondersGlyph = () => (
  <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true">
    <path d="M12 3 4 20h16L12 3z" fill="currentColor" opacity="0.9" />
    <path d="M12 3 8 20h8L12 3z" fill="currentColor" />
    <rect x="2" y="20" width="20" height="1.6" rx="0.8" fill="currentColor" />
  </svg>
);

export const IsleGlyph = () => (
  <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true">
    <path d="M12 2.5 20.2 7.25v9.5L12 21.5l-8.2-4.75v-9.5z" fill="currentColor" opacity="0.35" />
    <path d="M7 15.5V12l3-2.8 3 2.8v3.5z" fill="currentColor" />
    <path d="M13.5 15.5v-2.5l2.2-2 2.2 2v2.5z" fill="currentColor" opacity="0.85" />
  </svg>
);

/** A shield with a stopwatch's face: your hero. */
export const HeroGlyph = () => (
  <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true">
    <path d="M12 2.5 20 5.5v6c0 5-3.4 8.6-8 10-4.6-1.4-8-5-8-10v-6z" fill="currentColor" opacity="0.35" />
    <circle cx="12" cy="12.5" r="4.6" fill="none" stroke="currentColor" strokeWidth="1.8" />
    <path d="M12 12.5V9.8M10.6 5.8h2.8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
  </svg>
);

/** A jet seen from above, nose up: Sky Ace. */
export const SkyGlyph = () => (
  <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true">
    <path d="M2.5 14 12 10l9.5 4v1.8L12 13.6l-9.5 2.2z" fill="currentColor" opacity="0.85" />
    <path d="M12 2c1.1 1.2 1.6 3 1.6 5v9.5l2.6 2v1.7L12 19l-4.2 1.2v-1.7l2.6-2V7c0-2 .5-3.8 1.6-5z" fill="currentColor" />
  </svg>
);

/** Two cards fanned, face down: Bluff Table. */
export const BluffGlyph = () => (
  <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true">
    <rect x="3.5" y="5" width="10" height="14.5" rx="2" transform="rotate(-12 8.5 12)" fill="currentColor" opacity="0.5" />
    <rect x="10" y="4" width="10" height="14.5" rx="2" transform="rotate(10 15 11)" fill="currentColor" />
    <path d="M15.2 8.2l1 2.1 2.2.3-1.6 1.5.4 2.2-2-1-2 1 .4-2.2-1.6-1.5 2.2-.3z" transform="rotate(10 15 11)" style={{ fill: 'var(--tile)' }} />
  </svg>
);

/** Each game's emblem by its id, for lists built from data. */
export const GAME_GLYPHS = {
  avalon: AvalonGlyph,
  wonders: WondersGlyph,
  isle: IsleGlyph,
  nonograms: NonogramGlyph,
  hero: HeroGlyph,
  sky: SkyGlyph,
  bluff: BluffGlyph,
} as const;
