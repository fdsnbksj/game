import { Link } from 'react-router';
import { lastRoom } from '../lastPage';
import { useNonogramStore } from '../nonogramStore';
import { useGameStore } from '../store';

const GAME_NAMES: Record<string, string> = { avalon: 'Avalon', duel: 'Rival Wonders', wonders: 'Ancient Wonders', isle: 'Island Settlers', brawl: 'Sky Brawl' };

/** A few squares filled in, like a puzzle half done. */
const NonogramGlyph = () => (
  <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true">
    {[0, 1, 2].flatMap((r) =>
      [0, 1, 2].map((c) => (
        <rect
          key={`${r}${c}`}
          x={3 + c * 6.5}
          y={3 + r * 6.5}
          width="5"
          height="5"
          rx="1.2"
          fill="currentColor"
          opacity={[1, 0.25, 1, 1, 1, 0.25, 0.25, 1, 1][r * 3 + c]}
        />
      )),
    )}
  </svg>
);

/** A crown, for the court of Avalon. */
const AvalonGlyph = () => (
  <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true">
    <path d="M3 8l4.5 4L12 5l4.5 7L21 8l-2 10H5L3 8z" fill="currentColor" opacity="0.9" />
    <rect x="5" y="19.5" width="14" height="2" rx="1" fill="currentColor" />
  </svg>
);

/** Columns under a pediment: a wonder. */
const DuelGlyph = () => (
  <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true">
    <path d="M12 3l9 5H3l9-5z" fill="currentColor" />
    {[5, 10.5, 16].map((x) => (
      <rect key={x} x={x} y="10" width="3" height="8" rx="0.8" fill="currentColor" opacity="0.85" />
    ))}
    <rect x="3" y="19" width="18" height="2" rx="1" fill="currentColor" />
  </svg>
);

const WondersGlyph = () => (
  <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true">
    <path d="M12 3 4 20h16L12 3z" fill="currentColor" opacity="0.9" />
    <path d="M12 3 8 20h8L12 3z" fill="currentColor" />
    <rect x="2" y="20" width="20" height="1.6" rx="0.8" fill="currentColor" />
  </svg>
);

const IsleGlyph = () => (
  <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true">
    <path d="M12 2.5 20.2 7.25v9.5L12 21.5l-8.2-4.75v-9.5z" fill="currentColor" opacity="0.35" />
    <path d="M7 15.5V12l3-2.8 3 2.8v3.5z" fill="currentColor" />
    <path d="M13.5 15.5v-2.5l2.2-2 2.2 2v2.5z" fill="currentColor" opacity="0.85" />
  </svg>
);

/** Two blades crossed over the island they fight on. */
const BrawlGlyph = () => (
  <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true">
    <path d="M18.6 2.8 20.2 4.4 9.4 15.2l-1.6-1.6z" fill="currentColor" />
    <path d="M5.4 2.8 3.8 4.4l10.8 10.8 1.6-1.6z" fill="currentColor" opacity="0.6" />
    <rect x="3" y="18.5" width="18" height="2.6" rx="1.3" fill="currentColor" />
  </svg>
);

function greeting() {
  const hour = new Date().getHours();
  if (hour < 5) return 'Good night';
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

/** The games, and who you are. */
export function Home() {
  const player = useGameStore((s) => s.player);
  const level = useNonogramStore((s) => s.level);
  const name = player?.displayName;
  // A party game you were in the middle of; the nonogram tile already shows your level.
  const path = lastRoom();
  const room = path && { path, game: GAME_NAMES[path.split('/')[1]], code: path.split('/')[2] };

  return (
    <main className="screen">
      <header className="home-head">
        <div>
          <p className="home-hello">{greeting()}</p>
          <h1 className="home-name">{name ?? 'Welcome'}</h1>
        </div>
        <Link className="avatar" to="/account" aria-label="Account">
          {name ? name.slice(0, 1).toUpperCase() : '·'}
        </Link>
      </header>

      {room && (
        <Link className="continue-card" to={room.path}>
          <div>
            <span className="micro">Continue</span>
            <strong>{room.game}</strong>
            <span className="note">Room {room.code}</span>
          </div>
          <span className="continue-play" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="20" height="20">
              <path d="M8 5.5v13l10.5-6.5L8 5.5z" fill="currentColor" />
            </svg>
          </span>
        </Link>
      )}

      <p className="group-title">Games</p>
      <nav className="game-tiles" aria-label="Games">
        <Link className="game-tile" to="/nonograms">
          <span className="game-glyph nonogram">
            <NonogramGlyph />
          </span>
          <div>
            <strong>Nonograms</strong>
            <small>Puzzles for between chapters</small>
          </div>
          <span className="tile-chip">Lv {level}</span>
        </Link>
        <Link className="game-tile" to="/avalon">
          <span className="game-glyph avalon">
            <AvalonGlyph />
          </span>
          <div>
            <strong>Avalon</strong>
            <small>Hidden roles, one table</small>
          </div>
          <span className="tile-chip">5–10</span>
        </Link>
        <Link className="game-tile" to="/duel">
          <span className="game-glyph duel">
            <DuelGlyph />
          </span>
          <div>
            <strong>Rival Wonders</strong>
            <small>Two cities, head to head</small>
          </div>
          <span className="tile-chip">2</span>
        </Link>
        <Link className="game-tile" to="/wonders">
          <span className="game-glyph wonders">
            <WondersGlyph />
          </span>
          <div>
            <strong>Ancient Wonders</strong>
            <small>Build a city, bots welcome</small>
          </div>
          <span className="tile-chip">3–7</span>
        </Link>
        <Link className="game-tile" to="/isle">
          <span className="game-glyph isle">
            <IsleGlyph />
          </span>
          <div>
            <strong>Island Settlers</strong>
            <small>Build, trade, bots welcome</small>
          </div>
          <span className="tile-chip">3–4</span>
        </Link>
        <Link className="game-tile" to="/brawl">
          <span className="game-glyph brawl">
            <BrawlGlyph />
          </span>
          <div>
            <strong>Sky Brawl</strong>
            <small>Fight bots, one thumb</small>
          </div>
          <span className="tile-chip">1–3 bots</span>
        </Link>
      </nav>

    </main>
  );
}
