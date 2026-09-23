import Phaser from 'phaser';
import { useEffect, useRef } from 'react';
import { cssColor } from '../shared/theme';

interface PhaserGameProps {
  /** Pass a module-level array: a new array recreates the game. */
  scenes: Phaser.Types.Scenes.SceneType[];
  /** Fills its container instead of using a fixed size, and follows it as it resizes. */
  responsive?: boolean;
  /** Ignored when `responsive`. */
  width?: number;
  height?: number;
  transparent?: boolean;
  /**
   * Copied into game.registry. Scenes read values with `registry.get(key)` and
   * react to updates via `registry.events.on('changedata-<key>')`. Memoize it.
   */
  registry?: Record<string, unknown>;
  className?: string;
}

function applyRegistry(game: Phaser.Game, registry: Record<string, unknown> | undefined) {
  for (const [key, value] of Object.entries(registry ?? {})) game.registry.set(key, value);
}

/** Capped: a 3x buffer costs 9x the pixels, and the gain over 2x isn't visible. */
const MAX_PIXEL_RATIO = 2.5;

const pixelRatio = () => Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO);

export function PhaserGame({ scenes, responsive = false, width = 100, height = 100, transparent = false, registry, className }: PhaserGameProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Phaser.Game | null>(null);
  const registryRef = useRef(registry);

  useEffect(() => {
    const container = containerRef.current!;
    // The buffer is the container's size in device pixels and the camera zoom undoes the
    // ratio, so the scene works in CSS pixels while drawing sharp on dense screens.
    const dpr = pixelRatio();
    const box = container.getBoundingClientRect();
    const game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: container,
      width: responsive ? Math.max(1, Math.round(box.width * dpr)) : width,
      height: responsive ? Math.max(1, Math.round(box.height * dpr)) : height,
      transparent,
      backgroundColor: cssColor('--board-scrim'),
      banner: false,
      scale: responsive
        ? { mode: Phaser.Scale.NONE, zoom: 1 / dpr }
        : { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
      scene: scenes,
    });
    // Scenes boot asynchronously, so values set here are ready by the time create() runs.
    applyRegistry(game, registryRef.current);
    gameRef.current = game;

    let observer: ResizeObserver | undefined;
    if (responsive) {
      let last = '';
      observer = new ResizeObserver(([entry]) => {
        const ratio = pixelRatio();
        const w = Math.max(1, Math.round(entry.contentRect.width * ratio));
        const h = Math.max(1, Math.round(entry.contentRect.height * ratio));
        if (`${w}x${h}x${ratio}` === last) return;
        last = `${w}x${h}x${ratio}`;
        game.scale.setZoom(1 / ratio);
        game.scale.resize(w, h);
      });
      observer.observe(container);
    }

    return () => {
      observer?.disconnect();
      game.destroy(true);
      gameRef.current = null;
    };
  }, [scenes, responsive, width, height, transparent]);

  useEffect(() => {
    registryRef.current = registry;
    if (gameRef.current) applyRegistry(gameRef.current, registry);
  }, [registry]);

  return <div ref={containerRef} className={className} />;
}
