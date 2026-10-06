import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { botInput } from '../../games/brawl/bot';
import { FIGHTERS } from '../../games/brawl/fighters';
import { charge, drag, GESTURE, held, idle, press, release, tick, type Gesture } from '../../games/brawl/gestures';
import { BLAST, SUB } from '../../games/brawl/stage';
import { step, type Match } from '../../games/brawl/state';
import { draw, follow, readPalette, type Burst, type Camera } from './draw';
import { HowToBrawl } from './HowTo';

const STEP_MS = 1000 / 60;
/** Save the fight about once a second, besides whenever the screen is left. */
const SAVE_EVERY = 60;

/** One line per fighter: their damage and the lives they have left. */
function Hud({ match }: { match: Match }) {
  return (
    <div className="brawl-hud" style={{ gridTemplateColumns: `repeat(${match.fighters.length}, 1fr)` }}>
      {match.fighters.map((f, seat) => (
        <div key={seat} className={`brawl-chip p${seat + 1}${f.stocks === 0 ? ' out' : ''}`}>
          <span className="brawl-chip-name">{seat === 0 ? 'You' : FIGHTERS[match.seats[seat].fighter].name}</span>
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
const hudKey = (m: Match) => m.fighters.map((f) => `${f.damage}:${f.stocks}`).join('|');

/**
 * The fight: the arena on top, the thumb's space below. The game runs at a fixed 60 steps
 * a second whatever the screen's rate, and stops whenever the app is out of sight.
 */
export function BrawlMatch({
  initial,
  onKeep,
  onEnd,
  onQuit,
  children,
}: {
  initial: Match;
  onKeep: (m: Match) => void;
  onEnd: (m: Match) => void;
  onQuit: () => void;
  /** Shown over the arena once the fight is over. */
  children?: ReactNode;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const stick = useRef<HTMLDivElement>(null);
  const knob = useRef<HTMLDivElement>(null);
  const ring = useRef<HTMLDivElement>(null);
  const match = useRef(initial);
  const gesture = useRef<Gesture>(idle());
  const presses = useRef<number[]>([]);
  // A fight picked up again waits for a tap; a new one starts at once.
  const [paused, setPaused] = useState(initial.frame > 0);
  const pausedRef = useRef(paused);
  pausedRef.current = paused;
  const [hud, setHud] = useState(initial);
  const callbacks = useRef({ onKeep, onEnd });
  callbacks.current = { onKeep, onEnd };

  useEffect(() => {
    const el = canvas.current!;
    const ctx = el.getContext('2d')!;
    const palette = readPalette();
    let cam: Camera | null = null;
    let bursts: Burst[] = [];
    let last = performance.now();
    let carry = 0;
    let shownHud = hudKey(match.current);
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
      let m = match.current;
      if (!pausedRef.current && m.winner === null) {
        carry += elapsed;
        while (carry >= STEP_MS && m.winner === null) {
          carry -= STEP_MS;
          const ticked = tick(gesture.current, now);
          gesture.current = ticked.g;
          if (ticked.out) presses.current.push(ticked.out);
          const mine = held(gesture.current) | (presses.current.shift() ?? 0);
          const before = m;
          m = step(m, m.seats.map((seat, i) => (seat.bot ? botInput(m, i) : i === 0 ? mine : 0)));
          m.fighters.forEach((f, i) => {
            if (f.falls > before.fighters[i].falls) {
              const old = before.fighters[i];
              bursts.push({ x: Math.max(BLAST.left, Math.min(BLAST.right, old.x / SUB)), y: Math.max(BLAST.top, Math.min(BLAST.bottom, old.y / SUB)), seat: i, age: 0 });
            }
          });
          if (m.frame % SAVE_EVERY === 0) callbacks.current.onKeep(m);
        }
        match.current = m;
        if (m.winner !== null) callbacks.current.onEnd(m);
        const key = hudKey(m);
        if (key !== shownHud) {
          shownHud = key;
          setHud(m);
        }
      } else {
        carry = 0;
      }
      bursts = bursts.map((b) => ({ ...b, age: b.age + 1 })).filter((b) => b.age < 40);
      cam = follow(m, cam, el.width / Math.max(1, el.height));
      draw(ctx, el.width, el.height, m, cam, palette, bursts);

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
          const c = charge(gesture.current, now);
          ring.current.style.setProperty('--charge', String(c));
          ring.current.classList.toggle('ready', touch.charging);
        }
      }
    };
    raf = requestAnimationFrame(frame);

    const away = () => {
      if (document.visibilityState === 'hidden') {
        setPaused(true);
        callbacks.current.onKeep(match.current);
      }
    };
    document.addEventListener('visibilitychange', away);
    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      document.removeEventListener('visibilitychange', away);
      if (match.current.winner === null) callbacks.current.onKeep(match.current);
    };
  }, []);

  const local = (event: React.PointerEvent<HTMLDivElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    return [event.clientX - box.left, event.clientY - box.top] as const;
  };
  const send = (out: number) => {
    if (out) presses.current.push(out);
  };

  const pause = () => {
    setPaused(true);
    onKeep(match.current);
  };

  return (
    <main className="screen brawl">
      <header className="bar">
        <Link className="icon-button" to="/" aria-label="All games">
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
            <path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>
        <Hud match={hud} />
        <button className="icon-button" aria-label="Pause" onClick={pause}>
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
            <rect x="6.5" y="5" width="4" height="14" rx="1.2" fill="currentColor" />
            <rect x="13.5" y="5" width="4" height="14" rx="1.2" fill="currentColor" />
          </svg>
        </button>
      </header>

      <div className="brawl-arena">
        <canvas ref={canvas} />
      </div>

      <div
        className="brawl-thumb"
        onPointerDown={(event) => {
          if (paused) return;
          try {
            event.currentTarget.setPointerCapture(event.pointerId);
          } catch {
            // Not a live pointer (a synthetic event): the lift still arrives here.
          }
          const [x, y] = local(event);
          const r = press(gesture.current, event.pointerId, x, y, event.timeStamp);
          gesture.current = r.g;
          send(r.out);
        }}
        onPointerMove={(event) => {
          const [x, y] = local(event);
          const r = drag(gesture.current, event.pointerId, x, y);
          gesture.current = r.g;
          send(r.out);
        }}
        onPointerUp={(event) => {
          const [x, y] = local(event);
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
          Drag to move · up to jump
          <br />
          Tap to strike · hold for a heavy · tap twice to dodge
        </p>
        <div ref={stick} className="brawl-stick" hidden>
          <div ref={ring} className="brawl-ring" />
          <div ref={knob} className="brawl-knob" />
        </div>
      </div>

      {paused && match.current.winner === null && (
        <div className="overlay">
          <div className="panel" role="dialog" aria-label="Paused">
            <p className="solved-title">Paused</p>
            <div className="how-to">
              <HowToBrawl />
            </div>
            <button className="button primary" onClick={() => setPaused(false)}>
              Carry on
            </button>
            <button className="button ghost" onClick={onQuit}>
              Leave the fight
            </button>
          </div>
        </div>
      )}
      {children}
    </main>
  );
}
