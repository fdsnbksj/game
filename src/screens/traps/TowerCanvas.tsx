import { useEffect, useRef } from 'react';
import { COLS, ROWS, TILE, type Cell } from '../../games/traps/world';

/**
 * The tower on a canvas, as big as its box allows at 12 by 20 cells. `paint` draws in world
 * units (the context comes scaled); it's called every frame while `live`, else whenever
 * the component renders or resizes. A tap gives the cell under the finger.
 */
export function TowerCanvas({ paint, live = false, onCell, className = '' }: { paint: (ctx: CanvasRenderingContext2D) => void; live?: boolean; onCell?: (cell: Cell) => void; className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const paintRef = useRef(paint);
  paintRef.current = paint;
  const redraw = useRef<() => void>(() => {});

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    let scale = 1;
    const render = () => {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.setTransform(scale, 0, 0, scale, 0, 0);
      paintRef.current(ctx);
    };
    const fit = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.max(1, Math.round(rect.width * dpr));
      canvas.height = Math.max(1, Math.round(rect.height * dpr));
      scale = canvas.width / (COLS * TILE);
      render();
    };
    redraw.current = render;
    const resize = new ResizeObserver(fit);
    resize.observe(canvas);
    fit();
    let frame = 0;
    const loop = () => {
      render();
      frame = requestAnimationFrame(loop);
    };
    if (live) frame = requestAnimationFrame(loop);
    return () => {
      resize.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [live]);

  // Not live: draw again whenever the parent renders with something new.
  useEffect(() => {
    if (!live) redraw.current();
  });

  return (
    <canvas
      ref={canvasRef}
      className={`traps-canvas ${className}`}
      style={{ aspectRatio: `${COLS} / ${ROWS}` }}
      onPointerDown={
        onCell &&
        ((e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const x = Math.floor(((e.clientX - rect.left) / rect.width) * COLS);
          const y = Math.floor(((e.clientY - rect.top) / rect.height) * ROWS);
          if (x >= 0 && x < COLS && y >= 0 && y < ROWS) onCell({ x, y });
        })
      }
    />
  );
}
