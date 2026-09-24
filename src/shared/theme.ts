// The palette lives in src/index.css, in :root and in its prefers-color-scheme block.
// This reads the --board-* properties off the document and hands Phaser the ints it
// wants, so CSS stays the one place a colour is written and the board follows the
// scheme for free. Every --board-* colour must be a plain #rrggbb, with its alpha as a
// separate numeric property, or the parsing below can't work.

/** The system face, matching --font in src/index.css. Phaser puts this straight into
    the canvas font, where '-apple-system' is the spelling Safari wants first. */
export const DISPLAY_FONT = "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', Roboto, system-ui, sans-serif";

export interface BoardPalette {
  cell: number;
  cellAlpha: number;
  scrim: number;
  scrimAlpha: number;
  shadow: number;
  shadowAlpha: number;
  mine: number;
  rival: number;
  shield: number;
  mana: number;
  track: number;
  trackAlpha: number;
  /** One per star level, 1 to 3. */
  star: [number, number, number];
  /** Phaser text styles take strings, not ints. */
  label: string;
  halo: string;
  success: string;
  danger: string;
  currency: string;
  muted: string;
}

const FALLBACK = '#8e8e93';

function read(style: CSSStyleDeclaration, name: string): string {
  const value = style.getPropertyValue(name).trim();
  if (/^#[0-9a-f]{6}$/i.test(value)) return value;
  // Without this a typo would quietly paint the whole board one colour.
  if (import.meta.env.DEV) console.warn(`${name} is "${value}", expected #rrggbb`);
  return FALLBACK;
}

const int = (style: CSSStyleDeclaration, name: string) => Number.parseInt(read(style, name).slice(1), 16);

function alpha(style: CSSStyleDeclaration, name: string): number {
  const value = Number.parseFloat(style.getPropertyValue(name));
  if (Number.isFinite(value)) return value;
  if (import.meta.env.DEV) console.warn(`${name} is not a number`);
  return 0.2;
}

export function readBoardPalette(): BoardPalette {
  const style = getComputedStyle(document.documentElement);
  return {
    cell: int(style, '--board-cell'),
    cellAlpha: alpha(style, '--board-cell-a'),
    scrim: int(style, '--board-scrim'),
    scrimAlpha: alpha(style, '--board-scrim-a'),
    shadow: int(style, '--board-shadow'),
    shadowAlpha: alpha(style, '--board-shadow-a'),
    mine: int(style, '--board-mine'),
    rival: int(style, '--board-rival'),
    shield: int(style, '--board-shield'),
    mana: int(style, '--board-mana'),
    track: int(style, '--board-track'),
    trackAlpha: alpha(style, '--board-track-a'),
    star: [int(style, '--board-star-1'), int(style, '--board-star-2'), int(style, '--board-star-3')],
    label: read(style, '--board-label'),
    halo: read(style, '--board-halo'),
    success: read(style, '--board-hp'),
    danger: read(style, '--board-hp-rival'),
    currency: read(style, '--board-star-3'),
    muted: read(style, '--board-muted'),
  };
}

/** One colour from the stylesheet, as an int. */
export const cssColor = (name: string): number => int(getComputedStyle(document.documentElement), name);
