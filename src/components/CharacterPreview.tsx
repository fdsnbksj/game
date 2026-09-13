import { useMemo } from 'react';
import { PhaserGame } from '../game/PhaserGame';
import { PREVIEW_HEIGHT, PREVIEW_WIDTH, PreviewScene } from '../game/scenes/PreviewScene';
import type { Loadout } from '../shared/types';

const SCENES = [PreviewScene];

export function CharacterPreview({ loadout }: { loadout: Loadout }) {
  const registry = useMemo(() => ({ loadout }), [loadout]);
  return (
    <PhaserGame
      className="character-preview"
      scenes={SCENES}
      width={PREVIEW_WIDTH}
      height={PREVIEW_HEIGHT}
      transparent
      registry={registry}
    />
  );
}
