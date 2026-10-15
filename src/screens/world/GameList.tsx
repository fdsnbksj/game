import { useState } from 'react';
import { Link } from 'react-router';
import { GAME_GLYPHS } from '../../components/GameGlyphs';
import { lastRoom } from '../../lastPage';
import { useNonogramStore } from '../../nonogramStore';
import { GAMES } from './games';

/** Home: every game in one list, with a search on top and a way back to a room still on. */
export function GameList() {
  const [query, setQuery] = useState('');
  const level = useNonogramStore((s) => s.level);
  const room = lastRoom();
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const shown = GAMES.filter((game) => {
    const text = `${game.name} ${game.tagline}`.toLowerCase();
    return words.every((word) => text.includes(word));
  });
  const ongoing = room && GAMES.find((game) => room.startsWith(`/${game.id}/`));

  return (
    <main className="screen game-list">
      <input
        className="field"
        type="search"
        placeholder="Search games"
        aria-label="Search games"
        autoComplete="off"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      {ongoing && room && (
        <Link className="button primary" to={room}>
          Continue {ongoing.name} · {room.split('/')[2]}
        </Link>
      )}

      {shown.length > 0 ? (
        <div className="group">
          {shown.map((game) => {
            const Glyph = GAME_GLYPHS[game.id];
            return (
              <Link key={game.id} className="row game-row" to={game.path}>
                <span className={`game-glyph ${game.id === 'nonograms' ? 'nonogram' : game.id}`}>
                  <Glyph />
                </span>
                <span className="game-row-text">
                  <strong>{game.name}</strong>
                  <small>{game.tagline}</small>
                </span>
                <span className="tile-chip">{game.id === 'nonograms' ? `Lv ${level}` : game.players}</span>
              </Link>
            );
          })}
        </div>
      ) : (
        <p className="note center-note">No game matches “{query.trim()}”.</p>
      )}
    </main>
  );
}
