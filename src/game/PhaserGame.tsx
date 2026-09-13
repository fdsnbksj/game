import Phaser from 'phaser';
import { useEffect, useRef } from 'react';

interface PhaserGameProps {
  /** Pass a module-level array: a new array recreates the game. */
  scenes: Phaser.Types.Scenes.SceneType[];
  width: number;
  height: number;
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

export function PhaserGame({ scenes, width, height, transparent = false, registry, className }: PhaserGameProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Phaser.Game | null>(null);
  const registryRef = useRef(registry);

  useEffect(() => {
    const game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: containerRef.current!,
      width,
      height,
      transparent,
      backgroundColor: '#10131a',
      banner: false,
      scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
      scene: scenes,
    });
    // Scenes boot asynchronously, so values set here are ready by the time create() runs.
    applyRegistry(game, registryRef.current);
    gameRef.current = game;
    return () => {
      game.destroy(true);
      gameRef.current = null;
    };
  }, [scenes, width, height, transparent]);

  useEffect(() => {
    registryRef.current = registry;
    if (gameRef.current) applyRegistry(gameRef.current, registry);
  }, [registry]);

  return <div ref={containerRef} className={className} />;
}
