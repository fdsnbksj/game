import type { ReactNode } from 'react';
import { GAME_GLYPHS } from '../../components/GameGlyphs';
import { GAMES, type GameId } from './games';

/** The top of a game's front door, like its tile on home: its colour, its emblem (or `art`), name, line and players. */
export function GameBanner({ id, line, art }: { id: GameId; line?: string; art?: ReactNode }) {
  const game = GAMES.find((g) => g.id === id)!;
  const Glyph = GAME_GLYPHS[id];
  return (
    <section className={`door-banner tile-${id}`}>
      <span className="door-banner-art" aria-hidden="true">
        {art ?? <Glyph />}
      </span>
      <h2 className="door-banner-name">{game.name}</h2>
      <p className="door-banner-line">{line ?? game.tagline}</p>
      <span className="door-banner-chip">
        {game.players} {game.players === '1' ? 'player' : 'players'}
      </span>
    </section>
  );
}
