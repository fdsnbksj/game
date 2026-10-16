import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { continueRun, H, newRun, step, W, type SkyState } from '../../games/sky/sim';
import { draw, readPalette } from './render';
import { loadSky, saveSky } from './save';

// Sky Ace's flight: one canvas and a thumb. Drag anywhere and the ship moves with the finger
// (relative, so the thumb never covers it); it fires by itself. Lifting the thumb pauses
// the world at once, so it can be put down at any moment. The bomb button sits bottom left:
// touch it and the bomb goes off, and that touch keeps steering.

const TICK_MS = 1000 / 60;
const SAVE_EVERY = 300;

export function newSeed() {
  const bytes = crypto.getRandomValues(new Uint32Array(2));
  return `${bytes[0].toString(36)}${bytes[1].toString(36)}`;
}

export function SkyPlay() {
  const navigate = useNavigate();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [flying, setFlying] = useState(false);
  const [over, setOver] = useState(false);
  const [bombs, setBombs] = useState(0);
  const runRef = useRef<SkyState | null>(null);
  const bestRef = useRef(0);

  if (!runRef.current) {
    const save = loadSky();
    runRef.current = save.run ?? newRun(newSeed());
    bestRef.current = save.best;
  }

  useEffect(() => {
    const canvas = canvasRef.current!;
    const wrap = wrapRef.current!;
    const ctx = canvas.getContext('2d')!;
    const palette = readPalette();
    const run = () => runRef.current!;

    let scale = 1;
    let offsetX = 0;
    let offsetY = 0;
    const fit = () => {
      const rect = wrap.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.round(rect.width * dpr);
      canvas.height = Math.round(rect.height * dpr);
      scale = Math.min(rect.width / W, rect.height / H);
      offsetX = (rect.width - W * scale) / 2;
      offsetY = (rect.height - H * scale) / 2;
      ctx.setTransform(dpr * scale, 0, 0, dpr * scale, dpr * offsetX, dpr * offsetY);
    };
    fit();
    const resize = new ResizeObserver(fit);
    resize.observe(wrap);

    // The finger: one pointer steers; any touch on the bomb button also drops a bomb.
    let steer: number | null = null;
    let lastX = 0;
    let lastY = 0;
    let dx = 0;
    let dy = 0;
    let bomb = false;
    const save = () => {
      bestRef.current = Math.max(bestRef.current, run().score);
      saveSky(run(), bestRef.current);
    };
    const down = (e: PointerEvent) => {
      if ((e.target as HTMLElement).closest('.sky-menu')) return;
      if ((e.target as HTMLElement).closest('.sky-bomb')) bomb = true;
      if (steer !== null) return;
      steer = e.pointerId;
      lastX = e.clientX;
      lastY = e.clientY;
      setFlying(true);
    };
    const move = (e: PointerEvent) => {
      if (e.pointerId !== steer) return;
      dx += (e.clientX - lastX) / scale;
      dy += (e.clientY - lastY) / scale;
      lastX = e.clientX;
      lastY = e.clientY;
    };
    const up = (e: PointerEvent) => {
      if (e.pointerId !== steer) return;
      steer = null;
      dx = 0;
      dy = 0;
      setFlying(false);
      save();
    };
    wrap.addEventListener('pointerdown', down);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    const hidden = () => {
      if (document.visibilityState !== 'hidden') return;
      steer = null;
      setFlying(false);
      save();
    };
    document.addEventListener('visibilitychange', hidden);

    let frame = 0;
    let last = performance.now();
    let acc = 0;
    let sinceSave = 0;
    const loop = (now: number) => {
      const s = run();
      if (steer !== null && s.phase !== 'over') {
        acc = Math.min(acc + (now - last), TICK_MS * 4);
        while (acc >= TICK_MS) {
          acc -= TICK_MS;
          step(s, { dx, dy, bomb });
          dx = 0;
          dy = 0;
          bomb = false;
          if (++sinceSave >= SAVE_EVERY) {
            sinceSave = 0;
            save();
          }
          // step() may have run out the last ship (TypeScript narrowed the phase before the call).
          if ((s.phase as string) === 'over') {
            steer = null;
            setFlying(false);
            setOver(true);
            save();
            break;
          }
        }
      } else {
        acc = 0;
        bomb = false;
      }
      last = now;
      setBombs(s.player.bombs);
      // A wide screen leaves bands either side: clear them in the stage's ground colour.
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = palette[(['ground-0', 'ground-1', 'ground-2'] as const)[s.stage % 3]];
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.restore();
      // The field fills the width; a taller screen shows more ground above and below it.
      draw(ctx, s, palette, bestRef.current, { top: -offsetY / scale, bottom: H + offsetY / scale });
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    setOver(run().phase === 'over');

    return () => {
      cancelAnimationFrame(frame);
      resize.disconnect();
      wrap.removeEventListener('pointerdown', down);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      document.removeEventListener('visibilitychange', hidden);
      save();
    };
  }, []);

  const carryOn = () => {
    continueRun(runRef.current!);
    saveSky(runRef.current, bestRef.current);
    setOver(false);
  };

  const fresh = () => {
    bestRef.current = Math.max(bestRef.current, runRef.current!.score);
    saveSky(null, bestRef.current);
    navigate('/sky');
  };

  return (
    <main className="sky-screen">
      <div className="sky-field" ref={wrapRef}>
        <canvas ref={canvasRef} className="sky-canvas" />
        {!flying && !over && (
          <div className="sky-overlay">
            <p className="sky-hint">Touch and drag to fly</p>
            <p className="sky-subhint">Lift your thumb to pause</p>
            <div className="sky-menu">
              <Link className="button" to="/sky">
                Back to the menu
              </Link>
            </div>
          </div>
        )}
        {over && (
          <div className="sky-overlay sky-over">
            <p className="sky-hint">Out of ships</p>
            <p className="sky-subhint">Carry on from here for half your score.</p>
            <div className="sky-menu">
              <button className="button primary" onClick={carryOn}>
                Continue
              </button>
              <button className="button" onClick={fresh}>
                End run
              </button>
            </div>
          </div>
        )}
        <button className="sky-bomb" aria-label={`Bomb, ${bombs} left`} tabIndex={-1}>
          <span className="sky-bomb-icon" aria-hidden="true">
            B
          </span>
          <span className="sky-bomb-count">{bombs}</span>
        </button>
      </div>
    </main>
  );
}
