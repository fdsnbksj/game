import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { BUTTON_BITS, knob as knobAt, stickBits, type Button } from '../../games/brawl/controls';
import { SKILL2, type Input } from '../../games/brawl/input';
import { SUB } from '../../games/brawl/stages';
import { ROUNDS_TO_WIN, stageOf, type Match } from '../../games/brawl/state';
import { MAX_HP } from '../../games/brawl/weapons';
import { draw, follow, readPalette, type Burst, type Camera } from './draw';
import { WeaponGlyph } from './Weapons';

export const STEP_MS = 1000 / 60;

/**
 * Where a fight's frames come from: bots on this phone, or a session with another phone.
 * `run` moves the fight on by the time that has passed and returns the match to draw;
 * `thumbs()` gives this frame's input, and is called once for each frame actually played.
 */
export interface Driver {
  local: number;
  run(elapsed: number, thumbs: () => Input): Match;
}

/** One chip per fighter: weapon and ammo, HP, and rounds won. Your own is gold. */
function Hud({ match, labels, local }: { match: Match; labels: string[]; local: number }) {
  const n = match.fighters.length;
  return (
    <div className="brawl-hud" style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 104px))` }}>
      {match.fighters.map((f, seat) => (
        <div key={seat} className={`brawl-chip p${((seat - local + n) % n) + 1}${f.alive ? '' : ' out'}`}>
          <span className="brawl-chip-name">
            {f.weapon !== 'fists' && <WeaponGlyph weapon={f.weapon} size={11} />}
            {labels[seat]}
            {f.weapon !== 'fists' && <em className="brawl-ammo">{f.ammo}</em>}
          </span>
          <span className="brawl-hp" aria-label={`${f.hp} HP`}>
            <i className={f.hp > MAX_HP / 2 ? 'good' : f.hp > MAX_HP / 4 ? 'mid' : 'low'} style={{ width: `${(f.hp / MAX_HP) * 100}%` }} />
          </span>
          <span className="brawl-stocks" aria-label={`${match.wins[seat]} rounds won`}>
            {Array.from({ length: ROUNDS_TO_WIN }, (_, i) => (
              <i key={i} className={i < match.wins[seat] ? 'on' : undefined} />
            ))}
          </span>
        </div>
      ))}
    </div>
  );
}

/** A short line for the HUD's re-render check: only what it shows. */
const hudKey = (m: Match) => `${m.between > 0 ? m.roundWinner : 'on'}:${m.round}|` + m.fighters.map((f, i) => `${f.hp}:${f.alive}:${f.weapon}:${f.ammo}:${m.wins[i]}`).join('|');

const BUTTONS: { id: Button; label: string }[] = [
  { id: 'heavy', label: 'Heavy' },
  { id: 'normal', label: 'Attack' },
  { id: 'dodge', label: 'Dodge' },
  { id: 'jump', label: 'Jump' },
];

/** Upright: the fight is drawn turned a quarter, so it plays sideways even with the rotation locked. */
const portrait = () => window.matchMedia('(orientation: portrait)').matches;

/**
 * The fight on screen, sideways: the arena fills it, the joystick sits under the left
 * thumb and four buttons under the right. On an upright screen (a phone with its rotation
 * locked) the whole stage is turned a quarter, so the phone is simply held sideways.
 * Draws whatever the driver hands it each screen refresh; the driver decides how many
 * frames that is.
 */
export function Arena({
  driver,
  initial,
  labels,
  action,
  blocked,
  children,
}: {
  driver: Driver;
  initial: Match;
  labels: string[];
  /** The button at the top right: pause, or leave. */
  action: ReactNode;
  /** Ignore the controls (while paused). */
  blocked?: boolean;
  children?: ReactNode;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const stage = useRef<HTMLElement>(null);
  const [turned, setTurned] = useState(portrait);
  const base = useRef<HTMLDivElement>(null);
  const knob = useRef<HTMLDivElement>(null);
  /** The left thumb on the stick: where it landed and where it is. */
  const stick = useRef<{ id: number; ox: number; oy: number; x: number; y: number } | null>(null);
  const presses = useRef<Input[]>([]);
  /** The heavy is held, not pressed: it charges while the button is down. */
  const heavy = useRef(false);
  const [hud, setHud] = useState(initial);
  const driverRef = useRef(driver);
  driverRef.current = driver;

  const stickInput = () => {
    const s = stick.current;
    return s ? stickBits(s.x - s.ox, s.y - s.oy) : 0;
  };

  useEffect(() => {
    const el = canvas.current!;
    const ctx = el.getContext('2d')!;
    const palette = readPalette();
    let cam: Camera | null = null;
    let bursts: Burst[] = [];
    let last = performance.now();
    let shown = initial;
    let shownHud = hudKey(initial);
    let raf = 0;

    const resize = () => {
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      el.width = Math.round(el.clientWidth * ratio);
      el.height = Math.round(el.clientHeight * ratio);
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(el);

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const elapsed = Math.min(now - last, 250);
      last = now;
      // One button press a frame, aimed by the stick as it is now.
      const thumbs = () => stickInput() | (heavy.current ? SKILL2 : 0) | (presses.current.shift() ?? 0);
      const m = driverRef.current.run(elapsed, thumbs);

      // A burst where someone left the arena.
      if (m !== shown) {
        m.fighters.forEach((f, i) => {
          const before = shown.fighters[i];
          if (f.falls > before.falls) {
            const blast = stageOf(m).blast;
            bursts.push({ x: Math.max(blast.left, Math.min(blast.right, f.x / SUB)), y: Math.max(blast.top, Math.min(blast.bottom, f.y / SUB)), seat: i, age: 0 });
          }
        });
        shown = m;
        const key = hudKey(m);
        if (key !== shownHud) {
          shownHud = key;
          setHud(m);
        }
      }
      bursts = bursts.map((b) => ({ ...b, age: b.age + 1 })).filter((b) => b.age < 40);
      cam = follow(m, cam, el.width / Math.max(1, el.height));
      draw(ctx, el.width, el.height, m, cam, palette, bursts, driverRef.current.local);

      // The stick under the left thumb.
      const s = stick.current;
      if (base.current && knob.current) {
        base.current.hidden = !s;
        if (s) {
          base.current.style.transform = `translate(${s.ox}px, ${s.oy}px)`;
          const [kx, ky] = knobAt(s.x - s.ox, s.y - s.oy);
          knob.current.style.transform = `translate(${kx}px, ${ky}px)`;
        }
      }
    };
    raf = requestAnimationFrame(frame);

    // Turn the stage with the screen.
    const query = window.matchMedia('(orientation: portrait)');
    const turn = () => setTurned(query.matches);
    query.addEventListener('change', turn);

    // Two thumbs moving apart look like a pinch to the browser, and quick taps like a
    // double tap: stop both zooming the page. (iOS ignores touch-action: none.)
    const root = stage.current!;
    const still = (event: TouchEvent) => event.preventDefault();
    const pinch = (event: TouchEvent) => {
      if (event.touches.length > 1) event.preventDefault();
    };
    let lastEnd = 0;
    const doubleTap = (event: TouchEvent) => {
      if (event.timeStamp - lastEnd < 350) event.preventDefault();
      lastEnd = event.timeStamp;
    };
    const gesture = (event: Event) => event.preventDefault();
    root.addEventListener('touchmove', still, { passive: false });
    root.addEventListener('touchstart', pinch, { passive: false });
    root.addEventListener('touchend', doubleTap, { passive: false });
    document.addEventListener('gesturestart', gesture);
    document.addEventListener('gesturechange', gesture);
    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      query.removeEventListener('change', turn);
      root.removeEventListener('touchmove', still);
      root.removeEventListener('touchstart', pinch);
      root.removeEventListener('touchend', doubleTap);
      document.removeEventListener('gesturestart', gesture);
      document.removeEventListener('gesturechange', gesture);
    };
    // The loop reads the driver through a ref; it starts once per fight.
  }, []);

  /** A touch in the zone's own (sideways) coordinates, whichever way the stage is turned. */
  const point = (event: React.PointerEvent<HTMLElement>) => {
    const zone = event.currentTarget;
    // Turned a quarter clockwise about the screen's top right: x runs down the screen, y runs right to left.
    const x = turned ? event.clientY : event.clientX;
    const y = turned ? window.innerWidth - event.clientX : event.clientY;
    return [x - zone.offsetLeft, y - zone.offsetTop] as const;
  };
  const capture = (event: React.PointerEvent<HTMLElement>) => {
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Not a live pointer (a synthetic event): the lift still arrives here.
    }
  };
  const letGo = (id: number) => {
    if (stick.current?.id === id) stick.current = null;
  };

  return (
    <main ref={stage} className={turned ? 'brawl-stage turned' : 'brawl-stage'}>
      <canvas ref={canvas} className="brawl-canvas" />

      <header className="brawl-top">
        <Link className="icon-button" to="/" aria-label="All games">
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
            <path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>
        <Hud match={hud} labels={labels} local={driver.local} />
        {action}
      </header>

      {hud.between > 0 && hud.winner === null && (
        <div className="brawl-banner" aria-live="polite">
          <strong>{hud.roundWinner !== null && hud.roundWinner >= 0 ? `${labels[hud.roundWinner] === 'You' ? 'You take' : `${labels[hud.roundWinner]} takes`} the round` : 'Nobody left standing'}</strong>
          <span>
            Round {hud.round + 1} · {stageOf(hud).name}
          </span>
        </div>
      )}

      <div
        className="brawl-stick-zone"
        onPointerDown={(event) => {
          if (blocked || stick.current) return;
          capture(event);
          const [x, y] = point(event);
          stick.current = { id: event.pointerId, ox: x, oy: y, x, y };
        }}
        onPointerMove={(event) => {
          const s = stick.current;
          if (s?.id !== event.pointerId) return;
          const [x, y] = point(event);
          stick.current = { ...s, x, y };
        }}
        onPointerUp={(event) => letGo(event.pointerId)}
        onPointerCancel={(event) => letGo(event.pointerId)}
        onLostPointerCapture={(event) => letGo(event.pointerId)}
      >
        <p className="brawl-stick-hint" aria-hidden="true">
          Move
        </p>
        <div ref={base} className="brawl-stick" hidden>
          <div ref={knob} className="brawl-knob" />
        </div>
      </div>

      <div className="brawl-buttons">
        {BUTTONS.map((b) => (
          <button
            key={b.id}
            className={`brawl-button ${b.id}`}
            aria-label={b.label}
            onPointerDown={(event) => {
              if (blocked) return;
              capture(event);
              event.currentTarget.dataset.down = 'true';
              if (b.id === 'heavy') heavy.current = true;
              else presses.current.push(BUTTON_BITS[b.id] | stickInput());
            }}
            onPointerUp={(event) => {
              delete event.currentTarget.dataset.down;
              if (b.id === 'heavy') heavy.current = false;
            }}
            onPointerCancel={(event) => {
              delete event.currentTarget.dataset.down;
              if (b.id === 'heavy') heavy.current = false;
            }}
            onLostPointerCapture={(event) => {
              delete event.currentTarget.dataset.down;
              if (b.id === 'heavy') heavy.current = false;
            }}
            onContextMenu={(event) => event.preventDefault()}
          >
            {b.label}
          </button>
        ))}
      </div>

      {children}
    </main>
  );
}
