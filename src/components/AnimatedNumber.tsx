import { useEffect, useRef, useState } from 'react';

/** Long enough to read as counting, short enough not to lag behind the next change. */
const DURATION = 450;
/** How long a value keeps its up/down tint after changing. */
const FLASH = 600;

const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

/** Counts from the old value to the new one, and marks which way it went. */
export function useAnimatedNumber(value: number, start = value) {
  const [shown, setShown] = useState(start);
  const [direction, setDirection] = useState<'up' | 'down' | null>(null);
  const from = useRef(start);
  const frame = useRef(0);

  useEffect(() => {
    const begin = from.current;
    if (begin === value) return;
    setDirection(value > begin ? 'up' : 'down');
    const flash = setTimeout(() => setDirection(null), FLASH);

    if (reducedMotion()) {
      from.current = value;
      setShown(value);
      return () => clearTimeout(flash);
    }

    const startedAt = performance.now();
    const step = () => {
      const t = Math.min(1, (performance.now() - startedAt) / DURATION);
      const eased = 1 - (1 - t) ** 3;
      const current = Math.round(begin + (value - begin) * eased);
      from.current = current;
      setShown(current);
      if (t < 1) frame.current = requestAnimationFrame(step);
      else from.current = value;
    };
    frame.current = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(frame.current);
      clearTimeout(flash);
    };
  }, [value]);

  return { shown, direction };
}

/** A number that counts to each new value and flashes green up or red down. */
export function AnimatedNumber({ value, from, className }: { value: number; /** Counts up from here on first paint. */ from?: number; className?: string }) {
  const { shown, direction } = useAnimatedNumber(value, from ?? value);
  return <span className={[className, 'tally', direction].filter(Boolean).join(' ')}>{shown}</span>;
}
