/** Each game as a small emblem: on the map's stage cards and anywhere a game is named. */

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

/** Columns under a pediment: a wonder. */
export const DuelGlyph = () => (
  <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true">
    <path d="M12 3l9 5H3l9-5z" fill="currentColor" />
    {[5, 10.5, 16].map((x) => (
      <rect key={x} x={x} y="10" width="3" height="8" rx="0.8" fill="currentColor" opacity="0.85" />
    ))}
    <rect x="3" y="19" width="18" height="2" rx="1" fill="currentColor" />
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

/** Two blades crossed over the island they fight on. */
export const BrawlGlyph = () => (
  <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true">
    <path d="M18.6 2.8 20.2 4.4 9.4 15.2l-1.6-1.6z" fill="currentColor" />
    <path d="M5.4 2.8 3.8 4.4l10.8 10.8 1.6-1.6z" fill="currentColor" opacity="0.6" />
    <rect x="3" y="18.5" width="18" height="2.6" rx="1.3" fill="currentColor" />
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

/** Each game's emblem by its id, for lists built from data. */
export const GAME_GLYPHS = {
  avalon: AvalonGlyph,
  duel: DuelGlyph,
  wonders: WondersGlyph,
  isle: IsleGlyph,
  nonograms: NonogramGlyph,
  brawl: BrawlGlyph,
  hero: HeroGlyph,
} as const;
