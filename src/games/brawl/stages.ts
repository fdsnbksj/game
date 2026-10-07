/**
 * The six stages. In world pixels, y growing downward. The state stores everything in
 * sub-units (SUB per pixel) so all the maths stays in whole numbers. Moving platforms are
 * pure functions of the frame, so every phone sees them in the same place.
 */
export const SUB = 100;

/** A fighter's body, feet at its position. */
export const BODY_W = 36;
export const BODY_H = 64;

export interface Platform {
  left: number;
  right: number;
  top: number;
  /** Solid ground has an underside and sides; soft ledges can be jumped up through and dropped from. */
  soft: boolean;
  bottom: number;
  /** Cracks a second after it's stood on, falls, and comes back later. */
  crumbles?: boolean;
  /** Throws anyone who lands on it high into the air. */
  bounce?: boolean;
}

/** A platform riding back and forth: `dx`/`dy` either side of where it's drawn, once each `period`. */
export interface Mover {
  platform: Platform;
  dx: number;
  dy: number;
  period: number;
  /** Where in its trip it starts, in frames. */
  phase: number;
}

export interface Box {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

export type Hazard = { kind: 'none' } | { kind: 'lava'; top: number } | { kind: 'spikes'; strips: Box[] } | { kind: 'crumble' } | { kind: 'wind' };

export interface Stage {
  id: string;
  name: string;
  platforms: Platform[];
  movers: Mover[];
  spawns: { x: number; y: number }[];
  /** Cross any of these and you're out of the round. */
  blast: Box;
  hazard: Hazard;
  /** Where bots head when they're falling: the tops of the main ground. */
  safe: { left: number; right: number; top: number }[];
}

const solid = (left: number, right: number, top: number, bottom: number, extra: Partial<Platform> = {}): Platform => ({ left, right, top, bottom, soft: false, ...extra });
const ledge = (left: number, right: number, top: number, extra: Partial<Platform> = {}): Platform => ({ left, right, top, bottom: top, soft: true, ...extra });

export const STAGES: readonly Stage[] = [
  {
    id: 'rooftops',
    name: 'Rooftops',
    platforms: [solid(-400, -90, 0, 400), solid(90, 400, 0, 400), ledge(-60, 60, -150), ledge(-320, -200, -170), ledge(200, 320, -170)],
    movers: [],
    spawns: [
      { x: -250, y: 0 },
      { x: 250, y: 0 },
      { x: -150, y: 0 },
      { x: 150, y: 0 },
    ],
    blast: { left: -780, right: 780, top: -720, bottom: 420 },
    hazard: { kind: 'none' },
    safe: [
      { left: -400, right: -90, top: 0 },
      { left: 90, right: 400, top: 0 },
    ],
  },
  {
    id: 'lifts',
    name: 'Lifts',
    platforms: [solid(-180, 180, 0, 40)],
    movers: [
      { platform: ledge(-430, -290, -60), dx: 0, dy: 130, period: 240, phase: 0 },
      { platform: ledge(290, 430, -60), dx: 0, dy: 130, period: 240, phase: 120 },
      { platform: ledge(-60, 60, -230), dx: 230, dy: 0, period: 360, phase: 0 },
    ],
    spawns: [
      { x: -120, y: 0 },
      { x: 120, y: 0 },
      { x: -40, y: 0 },
      { x: 40, y: 0 },
    ],
    blast: { left: -760, right: 760, top: -760, bottom: 460 },
    hazard: { kind: 'none' },
    safe: [{ left: -180, right: 180, top: 0 }],
  },
  {
    id: 'lava',
    name: 'Lava',
    platforms: [solid(-220, 220, 0, 40), solid(-470, -360, 70, 160, { bounce: true }), solid(360, 470, 70, 160, { bounce: true }), ledge(-160, -50, -150), ledge(50, 160, -150)],
    movers: [],
    spawns: [
      { x: -150, y: 0 },
      { x: 150, y: 0 },
      { x: -60, y: 0 },
      { x: 60, y: 0 },
    ],
    blast: { left: -760, right: 760, top: -760, bottom: 480 },
    hazard: { kind: 'lava', top: 170 },
    safe: [{ left: -220, right: 220, top: 0 }],
  },
  {
    id: 'spikes',
    name: 'Spikes',
    platforms: [solid(-320, -60, 0, 40), solid(60, 320, 0, 40), ledge(-90, 90, -150), solid(-460, -360, -110, -80), solid(360, 460, -110, -80)],
    movers: [],
    spawns: [
      { x: -220, y: 0 },
      { x: 220, y: 0 },
      { x: -120, y: 0 },
      { x: 120, y: 0 },
    ],
    blast: { left: -760, right: 760, top: -740, bottom: 460 },
    hazard: {
      kind: 'spikes',
      strips: [
        // A bed of spikes down in the gap between the halves.
        { left: -60, right: 60, top: 90, bottom: 110 },
        // Under the high blocks either side.
        { left: -460, right: -360, top: -80, bottom: -66 },
        { left: 360, right: 460, top: -80, bottom: -66 },
      ],
    },
    safe: [
      { left: -320, right: -60, top: 0 },
      { left: 60, right: 320, top: 0 },
    ],
  },
  {
    id: 'crumble',
    name: 'Crumble',
    platforms: [
      ...[-360, -240, -120, 0, 120, 240].map((x) => solid(x, x + 110, 0, 30, { crumbles: true })),
      ledge(-260, -150, -170),
      ledge(150, 260, -170),
    ],
    movers: [],
    spawns: [
      { x: -290, y: 0 },
      { x: 290, y: 0 },
      { x: -70, y: 0 },
      { x: 70, y: 0 },
    ],
    blast: { left: -760, right: 760, top: -740, bottom: 440 },
    hazard: { kind: 'crumble' },
    safe: [{ left: -360, right: 350, top: 0 }],
  },
  {
    id: 'gusts',
    name: 'Gusts',
    platforms: [solid(-300, 300, 0, 40), ledge(-250, -100, -150), ledge(100, 250, -150), ledge(-75, 75, -290)],
    movers: [],
    spawns: [
      { x: -170, y: 0 },
      { x: 170, y: 0 },
      { x: -60, y: 0 },
      { x: 60, y: 0 },
    ],
    blast: { left: -740, right: 740, top: -780, bottom: 480 },
    hazard: { kind: 'wind' },
    safe: [{ left: -300, right: 300, top: 0 }],
  },
];

/** How far along its trip a mover is at a frame: -1000 to 1000, back and forth (a triangle wave). */
export function swing(mover: Mover, frame: number): number {
  const half = mover.period / 2;
  const t = (frame + mover.phase) % mover.period;
  const along = t < half ? t : mover.period - t;
  return Math.trunc(((2 * along - half) * 1000) / half);
}

/** A mover's platform where it is at a frame. */
export function moverAt(mover: Mover, frame: number): Platform {
  const s = swing(mover, frame);
  const ox = Math.trunc((mover.dx * s) / 1000);
  const oy = Math.trunc((mover.dy * s) / 1000);
  const p = mover.platform;
  return { ...p, left: p.left + ox, right: p.right + ox, top: p.top + oy, bottom: p.bottom + oy };
}

/** Gusts: calm, then a warning, then a blow one way or the other, round and round. */
export const WIND = { cycle: 360, warn: 180, blow: 240, push: 26 };
