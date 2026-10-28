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

/** Two tubes of beads, one sorted: Bead Sort. */
export const BeadsGlyph = () => (
  <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true">
    <rect x="3.5" y="3" width="7" height="18.5" rx="3.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
    <rect x="13.5" y="3" width="7" height="18.5" rx="3.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
    {[17.8, 13.6, 9.4].map((y, i) => (
      <circle key={`a${y}`} cx="7" cy={y} r="1.9" fill="currentColor" opacity={[1, 0.45, 1][i]} />
    ))}
    {[17.8, 13.6].map((y) => (
      <circle key={`b${y}`} cx="17" cy={y} r="1.9" fill="currentColor" />
    ))}
  </svg>
);

/** A block sliding towards its ring: Glide. */
export const GlideGlyph = () => (
  <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true">
    <rect x="3" y="8" width="8" height="8" rx="1.8" fill="currentColor" />
    <path d="M13 10h3M13 14h3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" opacity="0.55" />
    <rect x="17" y="8.5" width="5" height="7" rx="1.4" fill="none" stroke="currentColor" strokeWidth="1.6" />
  </svg>
);

/** A pipe bend with a drop at its end: Waterworks. */
export const PipesGlyph = () => (
  <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true">
    <path d="M3 7h7a5 5 0 0 1 5 5v4" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" />
    <path d="M15 18.5c-1.6 1.9-2.2 2.9-2.2 3.6a2.2 2.2 0 0 0 4.4 0c0-.7-.6-1.7-2.2-3.6z" fill="currentColor" opacity="0.6" />
  </svg>
);

/** A lit lantern with a plus of light round it: Lanterns. */
export const LanternsGlyph = () => (
  <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true">
    <rect x="8.5" y="8.5" width="7" height="7" rx="1.6" fill="currentColor" />
    <rect x="9.5" y="2" width="5" height="5" rx="1.2" fill="currentColor" opacity="0.55" />
    <rect x="9.5" y="17" width="5" height="5" rx="1.2" fill="currentColor" opacity="0.55" />
    <rect x="2" y="9.5" width="5" height="5" rx="1.2" fill="currentColor" opacity="0.55" />
    <rect x="17" y="9.5" width="5" height="5" rx="1.2" fill="currentColor" opacity="0.55" />
  </svg>
);

/** Two knots joined by a bending thread, and a second thread beside it: Threads. */
export const ThreadsGlyph = () => (
  <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true">
    <path d="M5 5v9a5 5 0 0 0 5 5h9" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
    <circle cx="5" cy="5" r="3" fill="currentColor" />
    <circle cx="19" cy="19" r="3" fill="currentColor" />
    <path d="M11 5h8v8" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" opacity="0.55" />
  </svg>
);

/** A safe door with its dial and handle: Vault. */
export const VaultGlyph = () => (
  <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true">
    <rect x="2.5" y="3" width="19" height="18" rx="3" fill="none" stroke="currentColor" strokeWidth="2.4" />
    <circle cx="11" cy="12" r="4.6" fill="currentColor" />
    <path d="M11 9.2v2.8" style={{ stroke: 'var(--tile)' }} strokeWidth="1.8" strokeLinecap="round" />
    <rect x="17.5" y="8" width="2" height="8" rx="1" fill="currentColor" opacity="0.55" />
  </svg>
);

/** A car driving out of a gap in a wall, past a car standing across its way: Gridlock. */
export const GridlockGlyph = () => (
  <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true">
    <path d="M21 9.5V3H3v18h18v-5.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round" />
    <rect x="12.5" y="9.6" width="10" height="4.8" rx="1.6" fill="currentColor" />
    <rect x="6" y="5.5" width="4.4" height="10" rx="1.6" fill="currentColor" opacity="0.55" />
  </svg>
);

/** A numbered card with a coin on it: Pass or Pay. */
export const PassGlyph = () => (
  <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true">
    <rect x="3.5" y="2.5" width="12.5" height="18" rx="2.2" fill="currentColor" opacity="0.55" />
    <circle cx="15.5" cy="16" r="6" fill="currentColor" />
    <circle cx="15.5" cy="16" r="3.4" fill="none" style={{ stroke: 'var(--tile)' }} strokeWidth="1.4" />
  </svg>
);

/** Each game's emblem by its id, for lists built from data. */
export const GAME_GLYPHS = {
  avalon: AvalonGlyph,
  wonders: WondersGlyph,
  nonograms: NonogramGlyph,
  hero: HeroGlyph,
  sky: SkyGlyph,
  bluff: BluffGlyph,
  beads: BeadsGlyph,
  glide: GlideGlyph,
  pipes: PipesGlyph,
  lanterns: LanternsGlyph,
  threads: ThreadsGlyph,
  vault: VaultGlyph,
  gridlock: GridlockGlyph,
  pass: PassGlyph,
} as const;
