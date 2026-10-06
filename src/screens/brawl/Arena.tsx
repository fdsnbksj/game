import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { charge, chargeAim, drag, GESTURE, held, idle, press, release, tick, type Gesture } from '../../games/brawl/gestures';
import type { Input } from '../../games/brawl/input';
import { BLAST, SUB } from '../../games/brawl/stage';
import type { Match } from '../../games/brawl/state';
import { draw, follow, readPalette, type Burst, type Camera } from './draw';
import { WeaponGlyph } from './Weapons';

export const STEP_MS = 1000 / 60;

/**
 * Where a fight's frames come from: bots on this phone, or a session with another phone.
 * `run` moves the fight on by the time that has passed and returns the match to draw;
 * `thumb()` gives this frame's input, and is called once for each frame actually played.
 */
export interface Driver {
  local: number;
  run(elapsed: number, thumb: () => Input): Match;
}

/** One line per fighter: their damage and the lives they have left. Your own is first-coloured. */
function Hud({ match, labels, local }: { match: Match; labels: string[]; local: number }) {
  const n = match.fighters.length;
  return (
    <div className="brawl-hud" style={{ gridTemplateColumns: `repeat(${n}, 1fr)` }}>
      {match.fighters.map((f, seat) => (
        <div key={seat} className={`brawl-chip p${((seat - local + n) % n) + 1}${f.stocks === 0 ? ' out' : ''}`}>
          <span className="brawl-chip-name">
            {f.weapon !== 'fists' && <WeaponGlyph weapon={f.weapon} size={11} />}
            {labels[seat]}
          </span>
          <strong className={f.damage >= 100 ? 'hot' : f.damage >= 50 ? 'warm' : undefined}>{f.stocks === 0 ? '—' : `${f.damage}%`}</strong>
          <span className="brawl-stocks" aria-label={`${f.stocks} lives`}>
            {Array.from({ length: 3 }, (_, i) => (
              <i key={i} className={i < f.stocks ? 'on' : undefined} />
            ))}
          </span>
        </div>
      ))}
    </div>
  );
}

/** A short line for the HUD's re-render check: only what it shows. */
const hudKey = (m: Match) => m.fighters.map((f) => `${f.damage}:${f.stocks}:${f.weapon}`).join('|');

/**
 * The fight on screen: the arena on top, the thumb's space below. Draws whatever the
 * driver hands it each screen refresh; the driver decides how many frames that is.
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
  /** Ignore the thumb (while paused). */
  blocked?: boolean;
  children?: ReactNode;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const stick = useRef<HTMLDivElement>(null);
  const knob = useRef<HTMLDivElement>(null);
  const ring = useRef<HTMLDivElement>(null);
  const arrow = useRef<HTMLDivElement>(null);
  const gesture = useRef<Gesture>(idle());
  const presses = useRef<number[]>([]);
  const [hud, setHud] = useState(initial);
  const driverRef = useRef(driver);
  driverRef.current = driver;

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
      const thumb = () => {
        const ticked = tick(gesture.current, now);
        gesture.current = ticked.g;
        if (ticked.out) presses.current.push(ticked.out);
        return held(gesture.current) | (presses.current.shift() ?? 0);
      };
      const m = driverRef.current.run(elapsed, thumb);

      // A burst where someone left the arena.
      if (m !== shown) {
        m.fighters.forEach((f, i) => {
          const before = shown.fighters[i];
          if (f.falls > before.falls) {
            bursts.push({ x: Math.max(BLAST.left, Math.min(BLAST.right, before.x / SUB)), y: Math.max(BLAST.top, Math.min(BLAST.bottom, before.y / SUB)), seat: i, age: 0 });
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

      // The stick under the thumb, and the ring that fills while a heavy charges.
      const touch = gesture.current.touch;
      if (stick.current && knob.current && ring.current) {
        stick.current.hidden = !touch;
        if (touch) {
          stick.current.style.transform = `translate(${touch.ox}px, ${touch.oy}px)`;
          const dx = touch.x - touch.ox;
          const dy = touch.y - touch.oy;
          const far = Math.hypot(dx, dy);
          const k = far > GESTURE.leash ? GESTURE.leash / far : 1;
          knob.current.style.transform = `translate(${dx * k}px, ${dy * k}px)`;
          ring.current.style.setProperty('--charge', String(charge(gesture.current, now)));
          ring.current.classList.toggle('ready', touch.charging);
          // While charging, an arrow shows where the strong skill will go; none means "at the nearest".
          const aim = chargeAim(gesture.current);
          if (arrow.current) {
            arrow.current.hidden = !aim;
            if (aim) arrow.current.style.transform = `rotate(${Math.atan2(aim[1], aim[0])}rad)`;
          }
        }
      }
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
    };
    // The loop reads the driver through a ref; it starts once per fight.
  }, []);

  const point = (event: React.PointerEvent<HTMLDivElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    return [event.clientX - box.left, event.clientY - box.top] as const;
  };
  const send = (out: number) => {
    if (out) presses.current.push(out);
  };

  return (
    <main className="screen brawl">
      <header className="bar">
        <Link className="icon-button" to="/" aria-label="All games">
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
            <path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>
        <Hud match={hud} labels={labels} local={driver.local} />
        {action}
      </header>

      <div className="brawl-arena">
        <canvas ref={canvas} />
      </div>

      <div
        className="brawl-thumb"
        onPointerDown={(event) => {
          if (blocked) return;
          try {
            event.currentTarget.setPointerCapture(event.pointerId);
          } catch {
            // Not a live pointer (a synthetic event): the lift still arrives here.
          }
          const [x, y] = point(event);
          const r = press(gesture.current, event.pointerId, x, y, event.timeStamp);
          gesture.current = r.g;
          send(r.out);
        }}
        onPointerMove={(event) => {
          const [x, y] = point(event);
          const r = drag(gesture.current, event.pointerId, x, y);
          gesture.current = r.g;
          send(r.out);
        }}
        onPointerUp={(event) => {
          const [x, y] = point(event);
          const r = release(gesture.current, event.pointerId, x, y, event.timeStamp);
          gesture.current = r.g;
          send(r.out);
        }}
        onPointerCancel={(event) => {
          gesture.current = { ...gesture.current, touch: gesture.current.touch?.id === event.pointerId ? null : gesture.current.touch };
        }}
        onLostPointerCapture={(event) => {
          // The lift went missing (the system took the touch): let go where the thumb was, so the stick never sticks.
          const touch = gesture.current.touch;
          if (touch?.id !== event.pointerId) return;
          gesture.current = release(gesture.current, touch.id, touch.x, touch.y, event.timeStamp).g;
        }}
      >
        <p className="brawl-thumb-hint" aria-hidden="true">
          Drag to move · tap to jump
          <br />
          Double-tap or hold for skills · swipe to aim
        </p>
        <div ref={stick} className="brawl-stick" hidden>
          <div ref={ring} className="brawl-ring" />
          <div ref={arrow} className="brawl-aim" hidden />
          <div ref={knob} className="brawl-knob" />
        </div>
      </div>
      {children}
    </main>
  );
}
