// The one palette. React reads the `#rrggbb` strings (and the matching custom
// properties in src/index.css); Phaser reads the `0xRRGGBB` ints.
//
// The CSS custom properties in src/index.css mirror COLORS below. Change both
// together — same rule as MAX_SCORE in src/shared/constants.ts.

/** Hex strings, for CSS, inline SVG and Phaser text styles. */
export const COLORS = {
  bg: '#080b14',
  bgRaised: '#0e1322',
  panel: '#141b2d',
  panelActive: '#1c2440',
  line: '#26304d',
  lineSoft: '#1b2238',
  text: '#eef2ff',
  muted: '#8b96b8',
  /** Ink for text sitting on a filled neon button. */
  onNeon: '#04121a',

  cyan: '#36e2ff',
  magenta: '#ff3df0',
  violet: '#b77cff',
  lime: '#5cff87',
  gold: '#ffc83d',
  danger: '#ff5a5f',
} as const;

/** The same values as ints, for Phaser. */
export const HEX = Object.fromEntries(
  Object.entries(COLORS).map(([key, value]) => [key, Number.parseInt(value.slice(1), 16)]),
) as { [K in keyof typeof COLORS]: number };

/** Tower colors, cycled in order. The rest of the game is built from these four. */
export const NEON = [HEX.cyan, HEX.magenta, HEX.violet, HEX.lime];

/** Item rarity maps onto the neon set, so the shop and the game agree. */
export const RARITY_COLORS = {
  common: COLORS.line,
  rare: COLORS.cyan,
  epic: COLORS.violet,
} as const;

/** Loaded from public/fonts, preloaded in index.html. Wordmark and numbers only. */
export const DISPLAY_FONT = "'Orbitron', system-ui, sans-serif";
export const BODY_FONT = "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";
