import { Link, Navigate, useParams } from 'react-router';
import { GAME_GLYPHS } from '../../components/GameGlyphs';
import { lastRoom } from '../../lastPage';
import { heroLevel } from '../../games/hero/stats';
import { useHeroStore } from '../../heroStore';
import { useNonogramStore } from '../../nonogramStore';
import { Landmark } from './WorldMap';
import { ZONES } from './zones';

/**
 * A zone of the map: its banner, then each of its games as a stage card. A game with a
 * room still on carries a Continue ribbon.
 */
export function Zone() {
  const { id } = useParams();
  const zone = ZONES.find((z) => z.id === id);
  const level = useNonogramStore((s) => s.level);
  const hero = useHeroStore((s) => heroLevel(s.tree));
  if (!zone) return <Navigate to="/" replace />;
  const room = lastRoom();

  return (
    <main className={`screen zone zone-${zone.id}`}>
      <header className="bar">
        <Link className="icon-button" to="/" aria-label="Back to the map">
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
            <path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>
        <span />
        <span className="icon-button" aria-hidden="true" />
      </header>

      <section className="zone-banner frame">
        <svg viewBox="0 0 100 100" width="86" height="86" aria-hidden="true">
          <Landmark zone={zone.id} />
        </svg>
        <h1 className="ribbon">{zone.name}</h1>
        <p className="note">{zone.lore}</p>
      </section>

      <div className="stage-cards">
        {zone.games.map((game) => {
          const Glyph = GAME_GLYPHS[game.id];
          const ongoing = room?.startsWith(`/${game.id}/`) ? room : null;
          return (
            <div key={game.id} className="stage-card frame">
              {ongoing && (
                <Link className="stage-ribbon" to={ongoing}>
                  Continue · {ongoing.split('/')[2]}
                </Link>
              )}
              <Link className="stage-main" to={game.path}>
                <span className={`game-glyph ${game.id === 'nonograms' ? 'nonogram' : game.id}`}>
                  <Glyph />
                </span>
                <span className="stage-text">
                  <strong>{game.name}</strong>
                  <small>{game.tagline}</small>
                </span>
                <span className="tile-chip">{game.id === 'nonograms' ? `Lv ${level}` : game.id === 'hero' ? `Hero Lv ${hero}` : game.players}</span>
              </Link>
              {game.id === 'nonograms' && (
                <div className="stage-extra">
                  <Link className="button ghost" to="/ranks">
                    Rankings
                  </Link>
                  <Link className="button ghost" to="/saved">
                    Saved cards
                  </Link>
                </div>
              )}
              {game.id === 'hero' && (
                <div className="stage-extra">
                  <Link className="button ghost" to="/hero/tree">
                    Skill tree
                  </Link>
                  <Link className="button ghost" to="/hero/online">
                    Play a friend
                  </Link>
                </div>
              )}
              {game.id === 'brawl' && (
                <div className="stage-extra">
                  <Link className="button ghost" to="/brawl">
                    Fight bots
                  </Link>
                  <Link className="button ghost" to="/brawl/online">
                    Play a friend
                  </Link>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </main>
  );
}
