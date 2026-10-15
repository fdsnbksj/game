import type { ReactNode } from 'react';
import { Link } from 'react-router';
import type { GameId } from '../screens/world/games';

/**
 * A page: a way back (none on a tab page, where the tabs are the way round), a title, and
 * its content. A game's pages pass `game`, which dresses them like the game centre: the
 * title in the game's colour, pill buttons, and the lobby's code on a banner.
 */
export function Page({ title, back = '/', onBack, game, children }: { title: string; back?: string | null; onBack?: () => void; game?: GameId; children: ReactNode }) {
  return (
    <main className={game ? `screen game-room tile-${game}` : 'screen'}>
      <header className="bar">
        {onBack ? (
          <button className="icon-button" onClick={onBack} aria-label="Back">
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
              <path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        ) : back === null ? (
          <span className="icon-button" aria-hidden="true" />
        ) : (
          <Link className="icon-button" to={back} aria-label="Back">
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
              <path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
        )}
        <h1 className="bar-title">
          {game && title ? (
            <span className="room-title">
              <i aria-hidden="true" />
              {title}
            </span>
          ) : (
            title
          )}
        </h1>
        <span className="icon-button" aria-hidden="true" />
      </header>
      {children}
    </main>
  );
}

export function Toggle({ label, on, onChange }: { label: string; on: boolean; onChange: (on: boolean) => void }) {
  return (
    <button className="row" role="switch" aria-checked={on} onClick={() => onChange(!on)}>
      <span>{label}</span>
      <span className={on ? 'switch on' : 'switch'} aria-hidden="true">
        <span />
      </span>
    </button>
  );
}
