import { useEffect, useRef, useState } from 'react';
import { encodeLog, decodeLog, JUMP, LEFT, RIGHT, RUN_TICKS, spawn, step, type Runner } from '../../games/traps/sim';
import { COLS, TILE, type Placed, type World } from '../../games/traps/world';
import { draw, readPalette, seatColour } from './render';
import { TowerCanvas } from './TowerCanvas';

// Your run up the tower, full screen: the tower on top, a pad at the bottom for one thumb.
// Slide left or right to run; flick up to jump (slide back down a little to jump again).
// Lifting the thumb pauses everything at once, saws and arrows too, so the phone can be put
// down mid-run; holding the thumb still stands still. Every tick's input is saved as it
// goes (`game:traps`), so a reload carries on from the same spot. Runs already in this
// round climb alongside as ghosts.

const KEY = 'game:traps';
const TICK_MS = 1000 / 60;
/** How far the thumb slides before the runner moves, and how far up is a jump, in pixels. */
const DEAD_PX = 14;
const STICK_PX = 56;
const JUMP_PX = 26;

function loadInputs(key: string): number[] {
  try {
    const save = JSON.parse(localStorage.getItem(KEY) ?? 'null') as { key: string; log: string } | null;
    if (save?.key === key) return decodeLog(save.log) ?? [];
  } catch {
    // Unreadable: start the run afresh.
  }
  return [];
}

function saveInputs(key: string, inputs: number[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ key, log: encodeLog(inputs) }));
  } catch {
    // Full or private storage: the run still plays, it just won't resume.
  }
}

export interface Ghost {
  seat: number;
  inputs: number[];
}

function result(r: Runner, killer: string | null) {
  if (r.status === 'flag') return { title: 'You made it!', line: `To the flag in ${(r.tick / 60).toFixed(1)} s.` };
  if (r.status === 'time') return { title: 'Out of time', line: 'Thirty seconds, and no flag.' };
  const what = r.cause === 'saw' ? 'saw' : r.cause === 'arrow' ? 'arrow' : 'spikes';
  return { title: 'Got you', line: killer ? `${killer}’s ${what} got you.` : `The ${what} got you.` };
}

export function RunView({
  world,
  items,
  seat,
  ghosts,
  saveKey,
  nameOf,
  onSend,
  onClose,
}: {
  world: World;
  items: readonly Placed[];
  seat: number;
  ghosts: Ghost[];
  /** Which run this is, so a saved one is only picked up by the same run. */
  saveKey: string;
  /** "You" for your own seat, else the player's name. */
  nameOf: (seat: number) => string;
  onSend: (log: string) => Promise<void>;
  onClose: () => void;
}) {
  const inputs = useRef<number[] | null>(null);
  const runner = useRef<Runner>(spawn(world));
  const ghostRunners = useRef<Runner[]>([]);
  if (inputs.current === null) {
    inputs.current = loadInputs(saveKey);
    const r = spawn(world);
    for (const input of inputs.current) step(world, r, input);
    runner.current = r;
    ghostRunners.current = ghosts.map((g) => {
      const gr = spawn(world);
      while (gr.tick < r.tick && gr.status === 'run') step(world, gr, g.inputs[gr.tick] ?? 0);
      return gr;
    });
  }
  const palette = useRef(readPalette());
  const [active, setActive] = useState(false);
  const [knob, setKnob] = useState({ x: 0, jump: false });
  const [ended, setEnded] = useState(runner.current.status !== 'run');
  const [sending, setSending] = useState<'no' | 'yes' | 'sent' | 'failed'>('no');
  const pad = useRef({ id: null as number | null, x: 0, low: 0, high: 0, jumping: false, bits: 0 });
  const keys = useRef(new Set<string>());

  const send = () => {
    setSending('yes');
    onSend(encodeLog(inputs.current!)).then(
      () => setSending('sent'),
      () => setSending('failed'),
    );
  };

  // The clock: ticks run only while a thumb is on the pad (or a key is held).
  useEffect(() => {
    if (ended) return;
    let frame = 0;
    let last = performance.now();
    let acc = 0;
    let sinceSave = 0;
    const loop = (now: number) => {
      const on = pad.current.id !== null || keys.current.size > 0;
      if (on) {
        acc = Math.min(acc + (now - last), TICK_MS * 4);
        while (acc >= TICK_MS) {
          acc -= TICK_MS;
          const k = keys.current;
          const bits = pad.current.id !== null ? pad.current.bits : (k.has('ArrowLeft') ? LEFT : 0) | (k.has('ArrowRight') ? RIGHT : 0) | (k.has('ArrowUp') || k.has(' ') ? JUMP : 0);
          inputs.current!.push(bits);
          step(world, runner.current, bits);
          ghostRunners.current.forEach((g, i) => step(world, g, ghosts[i].inputs[g.tick] ?? 0));
          if (++sinceSave >= 120) {
            sinceSave = 0;
            saveInputs(saveKey, inputs.current!);
          }
          if (runner.current.status !== 'run') {
            saveInputs(saveKey, inputs.current!);
            setEnded(true);
            return;
          }
        }
      } else acc = 0;
      last = now;
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    const hidden = () => {
      if (document.visibilityState !== 'hidden') return;
      pad.current.id = null;
      keys.current.clear();
      setActive(false);
      saveInputs(saveKey, inputs.current!);
    };
    const keyDown = (e: KeyboardEvent) => {
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', ' '].includes(e.key)) {
        e.preventDefault();
        keys.current.add(e.key);
        setActive(true);
      }
    };
    const keyUp = (e: KeyboardEvent) => {
      keys.current.delete(e.key);
      if (keys.current.size === 0 && pad.current.id === null) {
        setActive(false);
        saveInputs(saveKey, inputs.current!);
      }
    };
    document.addEventListener('visibilitychange', hidden);
    window.addEventListener('keydown', keyDown);
    window.addEventListener('keyup', keyUp);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener('visibilitychange', hidden);
      window.removeEventListener('keydown', keyDown);
      window.removeEventListener('keyup', keyUp);
      saveInputs(saveKey, inputs.current!);
    };
    // The world and ghosts are fixed for a run.
  }, [ended]);

  // Send as soon as the run is over, so nobody waits on you.
  useEffect(() => {
    if (ended && sending === 'no') send();
  }, [ended]);

  const down = (e: React.PointerEvent) => {
    if (pad.current.id !== null || ended) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    pad.current = { id: e.pointerId, x: e.clientX, low: e.clientY, high: e.clientY, jumping: false, bits: 0 };
    setActive(true);
  };
  const move = (e: React.PointerEvent) => {
    const p = pad.current;
    if (e.pointerId !== p.id) return;
    // The stick's centre follows a thumb that slides too far, so turning back is always a short slide.
    let dx = e.clientX - p.x;
    if (dx > STICK_PX) p.x = e.clientX - STICK_PX;
    if (dx < -STICK_PX) p.x = e.clientX + STICK_PX;
    dx = e.clientX - p.x;
    if (!p.jumping) {
      p.low = Math.max(p.low, e.clientY);
      if (p.low - e.clientY > JUMP_PX) {
        p.jumping = true;
        p.high = e.clientY;
      }
    } else {
      p.high = Math.min(p.high, e.clientY);
      if (e.clientY - p.high > JUMP_PX / 2) {
        p.jumping = false;
        p.low = e.clientY;
      }
    }
    p.bits = (dx > DEAD_PX ? RIGHT : dx < -DEAD_PX ? LEFT : 0) | (p.jumping ? JUMP : 0);
    setKnob({ x: dx, jump: p.jumping });
  };
  const up = (e: React.PointerEvent) => {
    if (e.pointerId !== pad.current.id) return;
    pad.current.id = null;
    pad.current.bits = 0;
    setKnob({ x: 0, jump: false });
    setActive(false);
    saveInputs(saveKey, inputs.current!);
  };

  const paint = (ctx: CanvasRenderingContext2D) => {
    const r = runner.current;
    const c = palette.current;
    draw(ctx, c, { world, tick: r.tick, figures: [...ghostRunners.current.map((g, i) => ({ r: g, seat: ghosts[i].seat, ghost: true })), { r, seat }] }, items);
    // Time left, as a bar along the top.
    ctx.fillStyle = c.grid;
    ctx.fillRect(0, 0, COLS * TILE, 48);
    ctx.fillStyle = seatColour(c, seat);
    ctx.fillRect(0, 0, (COLS * TILE * Math.max(0, RUN_TICKS - r.tick)) / RUN_TICKS, 48);
  };

  const r = runner.current;
  const shown = ended ? result(r, r.killer !== null && r.killer !== seat ? nameOf(r.killer) : null) : null;

  return (
    <div className="traps-run" role="dialog" aria-label="Your run">
      <div className="traps-run-field">
        <TowerCanvas paint={paint} live />
        {!active && !ended && (
          <div className="traps-run-hint">
            <strong>{r.tick === 0 ? 'Hold the pad to start' : 'Paused'}</strong>
            <span>Slide to run, flick up to jump. Lift to pause.</span>
          </div>
        )}
        {shown && (
          <div className="traps-run-end">
            <strong>{shown.title}</strong>
            <p>{shown.line}</p>
            {sending === 'failed' ? (
              <>
                <p className="error">Your run didn’t go through.</p>
                <button className="button primary" onClick={send}>
                  Send again
                </button>
              </>
            ) : (
              <button className="button primary" disabled={sending === 'yes'} onClick={onClose}>
                {sending === 'yes' ? 'Sending your run…' : 'Done'}
              </button>
            )}
          </div>
        )}
      </div>
      <div className={active ? 'traps-pad on' : 'traps-pad'} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
        <span className="traps-pad-arrow" aria-hidden="true">
          ◀
        </span>
        <span className={knob.jump ? 'traps-knob jump' : 'traps-knob'} style={{ transform: `translateX(${Math.max(-STICK_PX, Math.min(STICK_PX, knob.x))}px)` }} aria-hidden="true" />
        <span className="traps-pad-arrow" aria-hidden="true">
          ▶
        </span>
        <span className="traps-pad-up" aria-hidden="true">
          ▲ flick up to jump
        </span>
      </div>
    </div>
  );
}
