import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { botInput } from '../../games/brawl/bot';
import { step, type Match } from '../../games/brawl/state';
import { Arena, STEP_MS, type Driver } from './Arena';
import { HowToBrawl } from './HowTo';

/** Bots go by their colour: you're gold, then blue, red and green. */
export const BOT_NAMES = ['You', 'Blue', 'Red', 'Green'];

/** Save the fight about once a second, besides whenever the screen is left. */
const SAVE_EVERY = 60;

/**
 * A fight against bots on this phone: a fixed 60 steps a second, paused whenever the app
 * is out of sight, and saved so it can be picked up again.
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
  // A fight picked up again waits for a tap; a new one starts at once.
  const [paused, setPaused] = useState(initial.frame > 0);
  const pausedRef = useRef(paused);
  pausedRef.current = paused;
  const callbacks = useRef({ onKeep, onEnd });
  callbacks.current = { onKeep, onEnd };
  const current = useRef(initial);

  const driver = useMemo<Driver>(() => {
    let carry = 0;
    return {
      local: 0,
      run(elapsed, thumb) {
        let m = current.current;
        if (pausedRef.current || m.winner !== null) {
          carry = 0;
          return m;
        }
        carry += elapsed;
        while (carry >= STEP_MS && m.winner === null) {
          carry -= STEP_MS;
          const mine = thumb();
          const before = m;
          m = step(before, before.seats.map((seat, i) => (seat.bot ? botInput(before, i) : i === 0 ? mine : 0)));
          if (m.frame % SAVE_EVERY === 0) callbacks.current.onKeep(m);
        }
        current.current = m;
        if (m.winner !== null) callbacks.current.onEnd(m);
        return m;
      },
    };
  }, []);

  useEffect(() => {
    const away = () => {
      if (document.visibilityState !== 'hidden') return;
      setPaused(true);
      callbacks.current.onKeep(current.current);
    };
    document.addEventListener('visibilitychange', away);
    return () => {
      document.removeEventListener('visibilitychange', away);
      callbacks.current.onKeep(current.current);
    };
  }, []);

  const labels = initial.seats.map((_, i) => BOT_NAMES[i]);

  return (
    <Arena
      driver={driver}
      initial={initial}
      labels={labels}
      blocked={paused}
      action={
        <button
          className="icon-button"
          aria-label="Pause"
          onClick={() => {
            setPaused(true);
            onKeep(current.current);
          }}
        >
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
            <rect x="6.5" y="5" width="4" height="14" rx="1.2" fill="currentColor" />
            <rect x="13.5" y="5" width="4" height="14" rx="1.2" fill="currentColor" />
          </svg>
        </button>
      }
    >
      {paused && current.current.winner === null && (
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
    </Arena>
  );
}
