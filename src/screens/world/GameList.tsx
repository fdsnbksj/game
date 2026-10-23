import { useState, type CSSProperties } from 'react';
import { Link } from 'react-router';
import { GAME_GLYPHS } from '../../components/GameGlyphs';
import { lastRoom } from '../../lastPage';
import { useNonogramStore } from '../../nonogramStore';
import { useGameStore } from '../../store';
import { Stickman } from '../hero/Stickman';
import { GAMES, type Game } from './games';

// The main game gets the big card on top; every game, it included, is a tile below.
const FEATURED = GAMES.find((game) => game.id === 'hero')!;

/** Home, laid out like a game centre: you, a search, the featured game, then every game as a tile. */
export function GameList() {
  const [query, setQuery] = useState('');
  const name = useGameStore((s) => s.player?.displayName);
  const level = useNonogramStore((s) => s.level);
  const room = lastRoom();
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const shown = GAMES.filter((game) => {
    const text = `${game.name} ${game.tagline}`.toLowerCase();
    return words.every((word) => text.includes(word));
  });
  const ongoing = room && GAMES.find((game) => room.startsWith(`/${game.id}/`));
  const searching = words.length > 0;
  const chip = (game: Game) => (game.id === 'nonograms' ? `Lv ${level}` : `${game.players} ${game.players === '1' ? 'player' : 'players'}`);

  return (
    <main className="screen hub">
      <header className="hub-head">
        <div>
          <p className="hub-hello">{name ? `Hi, ${name}` : 'Welcome'}</p>
          <h1 className="hub-title">Game Centre</h1>
        </div>
        <Link className="hub-avatar" to="/account" aria-label="Your profile">
          {name ? (
            name.slice(0, 1).toUpperCase()
          ) : (
            <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
              <circle cx="12" cy="8.5" r="4" fill="currentColor" />
              <path d="M4.5 20a7.5 7.5 0 0 1 15 0z" fill="currentColor" />
            </svg>
          )}
        </Link>
      </header>

      <label className="hub-search">
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
          <circle cx="11" cy="11" r="6.5" fill="none" stroke="currentColor" strokeWidth="2" />
          <path d="M16 16l4.5 4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
        <input type="search" placeholder="Search games" aria-label="Search games" autoComplete="off" value={query} onChange={(e) => setQuery(e.target.value)} />
      </label>

      {!searching && ongoing && room && (
        <Link className="hub-continue" to={room}>
          <span className="hub-live" aria-hidden="true" />
          <span className="hub-continue-text">
            <small>Game in progress</small>
            <strong>
              {ongoing.name} · {room.split('/')[2]}
            </strong>
          </span>
          <span className="hub-pill">Continue</span>
        </Link>
      )}

      {!searching && (
        <Link className="hub-feature" to={FEATURED.path}>
          <span className="hub-feature-tag">Featured</span>
          <span className="hub-feature-art" aria-hidden="true">
            <Stickman />
            <span className="hub-vs">VS</span>
            <Stickman flip />
          </span>
          <span className="hub-feature-text">
            <strong>{FEATURED.name}</strong>
            <small>{FEATURED.tagline}</small>
          </span>
          <span className="hub-pill">Play</span>
        </Link>
      )}

      <h2 className="hub-section">{searching ? `Results (${shown.length})` : `All games (${GAMES.length})`}</h2>
      {shown.length > 0 ? (
        <div className="hub-grid">
          {shown.map((game, i) => {
            const Glyph = GAME_GLYPHS[game.id];
            return (
              <Link key={game.id} className={`hub-tile tile-${game.id}`} to={game.path} style={{ '--i': i } as CSSProperties}>
                <span className="hub-tile-art">
                  <Glyph />
                  {game.isNew && <span className="hub-new">New</span>}
                </span>
                <span className="hub-tile-text">
                  <strong>{game.name}</strong>
                  <small>{game.tagline}</small>
                </span>
                <span className="hub-chip">{chip(game)}</span>
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
